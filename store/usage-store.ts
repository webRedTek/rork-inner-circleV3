import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UsageCache, BatchUpdate, SyncStrategy, RateLimits, CacheConfig, RetryStrategy, UsageTrackingOptions, UsageResult, UsageStats } from '@/types/user';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useNotificationStore } from './notification-store';

// Helper function to extract readable error message
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error && error.error.message) return error.error.message;
  if (error.details) return String(error.details);
  if (error.code) return `Error code: ${error.code}`;
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

interface UsageState {
  usageCache: UsageCache | null;
  batchUpdates: BatchUpdate[];
  syncStrategy: SyncStrategy;
  rateLimits: RateLimits;
  cacheConfig: CacheConfig;
  retryStrategy: RetryStrategy;
  isSyncing: boolean;
  lastSyncError: string | null;
  initializeUsage: (userId: string) => Promise<void>;
  trackUsage: (options: UsageTrackingOptions) => Promise<UsageResult>;
  getUsageStats: () => UsageStats | null;
  queueBatchUpdate: (actionType: string, countChange: number) => void;
  syncUsageData: (force?: boolean) => Promise<void>;
  checkLimit: (actionType: string, limit: number) => boolean;
  resetUsage: (actionType?: string) => void;
  clearError: () => void;
  resetUsageCache: () => Promise<void>;
}

// Default usage cache
const defaultUsageCache: UsageCache = {
  lastSyncTimestamp: 0,
  usageData: {},
  premiumFeatures: {
    boostMinutesRemaining: 0,
    boostUsesRemaining: 0,
  },
  analytics: {
    profileViews: 0,
    searchAppearances: 0,
  },
};

// Sync strategy configuration
const defaultSyncStrategy: SyncStrategy = {
  critical: {
    interval: 30 * 1000, // 30 seconds
    features: ['swipes', 'matches', 'messages'],
  },
  standard: {
    interval: 5 * 60 * 1000, // 5 minutes
    features: ['groups', 'portfolio'],
  },
  analytics: {
    interval: 30 * 60 * 1000, // 30 minutes
    features: ['profileViews', 'searchAppearances'],
  },
};

// Rate limits configuration
const defaultRateLimits: RateLimits = {
  reads: { perSecond: 5, perMinute: 100 },
  writes: { perSecond: 2, perMinute: 30 },
};

// Cache configuration
const defaultCacheConfig: CacheConfig = {
  standardTTL: 5 * 60 * 1000, // 5 minutes
  criticalTTL: 60 * 1000, // 1 minute
  maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
};

// Retry strategy configuration
const defaultRetryStrategy: RetryStrategy = {
  maxRetries: 3,
  backoffMultiplier: 1.5,
  initialDelay: 1000,
  maxDelay: 10000,
  criticalActions: ['swipe', 'match', 'message'],
};

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      usageCache: null,
      batchUpdates: [],
      syncStrategy: defaultSyncStrategy,
      rateLimits: defaultRateLimits,
      cacheConfig: defaultCacheConfig,
      retryStrategy: defaultRetryStrategy,
      isSyncing: false,
      lastSyncError: null,

      initializeUsage: async (userId: string) => {
        if (!userId || !isSupabaseConfigured() || !supabase) {
          console.log('Skipping usage initialization: Invalid user ID or Supabase not configured');
          set({ usageCache: defaultUsageCache });
          return;
        }

        try {
          console.log('Initializing usage data for user:', userId);
          const { data: usageData, error: usageError } = await supabase
            .from('usage_tracking')
            .select('*')
            .eq('user_id', userId);

          if (usageError) {
            console.error('Error initializing usage data:', usageError);
            set({ usageCache: defaultUsageCache });
          } else {
            const usageCache: UsageCache = {
              lastSyncTimestamp: Date.now(),
              usageData: {},
              premiumFeatures: {
                boostMinutesRemaining: 0,
                boostUsesRemaining: 0,
              },
              analytics: {
                profileViews: 0,
                searchAppearances: 0,
              },
            };

            usageData?.forEach(entry => {
              usageCache.usageData[entry.action_type] = {
                currentCount: entry.current_count,
                firstActionTimestamp: entry.first_action_timestamp || Date.now(),
                lastActionTimestamp: entry.last_action_timestamp || Date.now(),
                resetTimestamp: entry.reset_timestamp || Date.now() + 24 * 60 * 60 * 1000,
              };
            });

            console.log('Usage data initialized successfully:', usageCache);
            set({ usageCache });
          }
        } catch (error) {
          console.error('Error initializing usage:', getReadableError(error));
          set({ usageCache: defaultUsageCache, lastSyncError: getReadableError(error) });
        }
      },

      trackUsage: async (options: UsageTrackingOptions): Promise<UsageResult> => {
        const { actionType, count = 1, batchProcess = false, forceSync = false } = options;
        const { user } = useAuthStore.getState();
        const { usageCache } = get();
        
        if (!user) {
          return {
            isAllowed: false,
            actionType,
            currentCount: 0,
            limit: 0,
            remaining: 0,
            timestamp: Date.now(),
            error: 'User not authenticated',
          };
        }

        if (!usageCache) {
          return {
            isAllowed: false,
            actionType,
            currentCount: 0,
            limit: 0,
            remaining: 0,
            timestamp: Date.now(),
            error: 'Usage cache not initialized',
          };
        }

        const tierSettings = useAuthStore.getState().getTierSettings();
        const limit = actionType === 'swipe' 
          ? tierSettings?.daily_swipe_limit || 10 
          : actionType === 'match' 
            ? tierSettings?.daily_match_limit || 5 
            : tierSettings?.message_sending_limit || 20;

        const now = Date.now();
        const usageData = usageCache.usageData[actionType];
        const resetTimestamp = usageData?.resetTimestamp || now + 24 * 60 * 60 * 1000;
        const currentCount = usageData ? usageData.currentCount : 0;
        const isAllowed = currentCount < limit;

        // Optimistic update if action is allowed
        if (isAllowed && count > 0) {
          const updatedCount = currentCount + count;
          set({
            usageCache: {
              ...usageCache,
              usageData: {
                ...usageCache.usageData,
                [actionType]: {
                  currentCount: updatedCount,
                  firstActionTimestamp: usageData?.firstActionTimestamp || now,
                  lastActionTimestamp: now,
                  resetTimestamp,
                },
              },
            },
          });

          // Queue for batch update if not forced sync
          if (!forceSync && batchProcess) {
            get().queueBatchUpdate(actionType, count);
          } else if (isSupabaseConfigured() && supabase) {
            try {
              const { error } = await supabase.rpc('handle_user_usage', {
                p_user_id: user.id,
                p_action_type: actionType,
                p_count_change: count,
              });

              if (error) {
                console.error(`Error tracking ${actionType} usage:`, error);
                set({ lastSyncError: getReadableError(error) });
              }
            } catch (error) {
              console.error(`Exception tracking ${actionType} usage:`, error);
              set({ lastSyncError: getReadableError(error) });
              get().queueBatchUpdate(actionType, count); // Queue for later sync on error
            }
          }
        }

        return {
          isAllowed,
          actionType,
          currentCount,
          limit,
          remaining: Math.max(0, limit - currentCount),
          timestamp: now,
        };
      },

      getUsageStats: (): UsageStats | null => {
        const { usageCache } = get();
        const tierSettings = useAuthStore.getState().getTierSettings();
        
        if (!usageCache || !tierSettings) return null;

        const swipeData = usageCache.usageData['swipe'] || { currentCount: 0 };
        const matchData = usageCache.usageData['match'] || { currentCount: 0 };
        const messageData = usageCache.usageData['message'] || { currentCount: 0 };

        return {
          swipeCount: swipeData.currentCount,
          swipeLimit: tierSettings.daily_swipe_limit,
          swipeRemaining: Math.max(0, tierSettings.daily_swipe_limit - swipeData.currentCount),
          matchCount: matchData.currentCount,
          matchLimit: tierSettings.daily_match_limit,
          matchRemaining: Math.max(0, tierSettings.daily_match_limit - matchData.currentCount),
          messageCount: messageData.currentCount,
          messageLimit: tierSettings.message_sending_limit,
          messageRemaining: Math.max(0, tierSettings.message_sending_limit - messageData.currentCount),
          timestamp: Date.now(),
        };
      },

      queueBatchUpdate: (actionType: string, countChange: number) => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const now = Date.now();
        set(state => {
          const existingBatch = state.batchUpdates.find(b => b.user_id === user.id);
          if (existingBatch) {
            const existingUpdate = existingBatch.updates.find(u => u.action_type === actionType);
            if (existingUpdate) {
              existingUpdate.count_change += countChange;
              existingUpdate.timestamp = now;
            } else {
              existingBatch.updates.push({
                action_type: actionType,
                count_change: countChange,
                timestamp: now,
              });
            }
            return { batchUpdates: [...state.batchUpdates] };
          } else {
            return {
              batchUpdates: [
                ...state.batchUpdates,
                {
                  user_id: user.id,
                  updates: [
                    {
                      action_type: actionType,
                      count_change: countChange,
                      timestamp: now,
                    },
                  ],
                },
              ],
            };
          }
        });
      },

      syncUsageData: async (force = false) => {
        const { user } = useAuthStore.getState();
        const { batchUpdates, usageCache, syncStrategy, isSyncing } = get();
        if (!user || isSyncing || batchUpdates.length === 0) return;

        const now = Date.now();
        if (!force && usageCache && usageCache.lastSyncTimestamp + syncStrategy.critical.interval > now) {
          console.log('Skipping sync: Too soon since last sync');
          return;
        }

        set({ isSyncing: true, lastSyncError: null });
        try {
          if (isSupabaseConfigured() && supabase) {
            for (const batch of batchUpdates) {
              const { error } = await supabase.rpc('handle_user_usage', {
                p_user_id: batch.user_id,
                p_action_type: 'batch',
                p_count_change: 0,
                p_batch_updates: batch.updates,
              });

              if (error) {
                console.error('Error syncing batch update:', error);
                throw error;
              }
            }

            // Clear batch updates after successful sync
            set({
              batchUpdates: [],
              usageCache: usageCache ? { ...usageCache, lastSyncTimestamp: now } : usageCache,
              isSyncing: false,
            });
            console.log('Usage data synced successfully');
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error syncing usage data:', getReadableError(error));
          set({ lastSyncError: getReadableError(error), isSyncing: false });
        }
      },

      checkLimit: (actionType: string, limit: number) => {
        const { usageCache } = get();
        if (!usageCache || !usageCache.usageData[actionType]) {
          return true; // Allow action if no usage data is available
        }

        const now = Date.now();
        const usage = usageCache.usageData[actionType];
        if (now > usage.resetTimestamp) {
          // Reset count if past reset timestamp
          set(state => ({
            usageCache: state.usageCache ? {
              ...state.usageCache,
              usageData: {
                ...state.usageCache.usageData,
                [actionType]: {
                  ...state.usageCache.usageData[actionType],
                  currentCount: 0,
                  resetTimestamp: now + 24 * 60 * 60 * 1000, // Reset after 24 hours
                },
              },
            } : state.usageCache,
          }));
          return true;
        }

        return usage.currentCount < limit;
      },

      resetUsage: (actionType?: string) => {
        const { usageCache } = get();
        if (!usageCache) return;

        const now = Date.now();
        if (actionType) {
          set({
            usageCache: {
              ...usageCache,
              usageData: {
                ...usageCache.usageData,
                [actionType]: {
                  ...usageCache.usageData[actionType],
                  currentCount: 0,
                  resetTimestamp: now + 24 * 60 * 60 * 1000,
                },
              },
            },
          });
        } else {
          const resetUsageData = Object.keys(usageCache.usageData).reduce((acc, key) => {
            acc[key] = {
              ...usageCache.usageData[key],
              currentCount: 0,
              resetTimestamp: now + 24 * 60 * 60 * 1000,
            };
            return acc;
          }, {} as UsageCache['usageData']);
          set({
            usageCache: {
              ...usageCache,
              usageData: resetUsageData,
            },
          });
        }
      },

      clearError: () => set({ lastSyncError: null }),

      resetUsageCache: async () => {
        try {
          console.log('Resetting usage cache...');
          set({
            usageCache: defaultUsageCache,
            batchUpdates: [],
            lastSyncError: null,
            isSyncing: false
          });
          console.log('Usage cache reset successfully');
          useNotificationStore.getState().addNotification({
            id: `usage-reset-${Date.now()}`,
            type: 'success',
            message: 'Usage data reset successfully',
            displayStyle: 'toast',
            duration: 3000,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error resetting usage cache:', getReadableError(error));
          useNotificationStore.getState().addNotification({
            id: `usage-reset-error-${Date.now()}`,
            type: 'error',
            message: 'Failed to reset usage data',
            displayStyle: 'toast',
            duration: 5000,
            timestamp: Date.now()
          });
        }
      }
    }),
    {
      name: 'usage-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Set up periodic sync for usage data
let syncIntervalId: number | null = null;

export const startUsageSync = () => {
  if (syncIntervalId !== null) {
    console.log('Usage sync already active');
    return;
  }

  const intervalMs = useUsageStore.getState().syncStrategy.critical.interval;
  syncIntervalId = setInterval(async () => {
    const { user } = useAuthStore.getState();
    if (!user) return; // Silent fail if not authenticated

    await useUsageStore.getState().syncUsageData();
  }, intervalMs) as unknown as number;

  console.log('Usage data sync started');
};

export const stopUsageSync = () => {
  if (syncIntervalId === null) {
    console.log('Usage sync not active');
    return;
  }

  clearInterval(syncIntervalId);
  syncIntervalId = null;
  console.log('Usage data sync stopped');
};
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
  isSyncing: boolean;
  lastSyncError: string | null;
  saveStrategy: {
    critical: {
      interval: number;
      features: string[];
    };
  };
  initializeUsage: (userId: string) => Promise<void>;
  syncUsageData: (force?: boolean) => Promise<void>;
  trackUsage: (options: UsageTrackingOptions) => Promise<UsageResult>;
  getUsageStats: () => UsageStats | null;
  queueBatchUpdate: (actionType: string, count: number) => void;
  rateLimits: RateLimits;
  cacheConfig: CacheConfig;
  retryStrategy: RetryStrategy;
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
      isSyncing: false,
      lastSyncError: null,
      saveStrategy: {
        critical: {
          interval: 30 * 1000, // 30 seconds
          features: ['swipes', 'matches', 'messages'],
        },
      },
      rateLimits: defaultRateLimits,
      cacheConfig: defaultCacheConfig,
      retryStrategy: defaultRetryStrategy,

      initializeUsage: async (userId: string) => {
        if (!userId || !isSupabaseConfigured() || !supabase) {
          console.log('Skipping usage initialization: Invalid user ID or Supabase not configured');
          throw new Error('Cannot initialize usage: Invalid user ID or Supabase not configured');
        }

        try {
          console.log('Initializing usage data for user:', userId);
          const now = Date.now();
          
          // Get the user's single usage record
          const { data: usageData, error: usageError } = await supabase
            .from('user_daily_usage')
            .select('*')
            .eq('user_id', userId)
            .single();

          // If no record exists, create one
          if (usageError || !usageData) {
            const { data: newData, error: createError } = await supabase
              .from('user_daily_usage')
              .insert({
                user_id: userId,
                swipe_count: 0,
                match_count: 0,
                message_count: 0,
                daily_reset_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                last_updated: new Date().toISOString()
              })
              .select()
              .single();

            if (createError) {
              throw new Error(`Failed to create usage record: ${getReadableError(createError)}`);
            }

            const usageCache: UsageCache = {
              lastSyncTimestamp: now,
              usageData: {
                swipe: {
                  currentCount: 0,
                  firstActionTimestamp: now,
                  lastActionTimestamp: now,
                  resetTimestamp: now + 24 * 60 * 60 * 1000,
                },
                match: {
                  currentCount: 0,
                  firstActionTimestamp: now,
                  lastActionTimestamp: now,
                  resetTimestamp: now + 24 * 60 * 60 * 1000,
                },
                message: {
                  currentCount: 0,
                  firstActionTimestamp: now,
                  lastActionTimestamp: now,
                  resetTimestamp: now + 24 * 60 * 60 * 1000,
                }
              },
              premiumFeatures: {
                boostMinutesRemaining: 0,
                boostUsesRemaining: 0,
              },
              analytics: {
                profileViews: 0,
                searchAppearances: 0,
              },
            };

            console.log('New usage record created:', usageCache);
            set({ usageCache });
          } else {
            // Check if we need to reset counts (24 hours passed)
            const shouldReset = usageData.daily_reset_at && new Date(usageData.daily_reset_at).getTime() < now;
            
            if (shouldReset) {
              // Reset counts and update reset timestamp
              const { data: resetData, error: resetError } = await supabase
                .from('user_daily_usage')
                .update({
                  swipe_count: 0,
                  match_count: 0,
                  message_count: 0,
                  daily_reset_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
                  last_updated: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

              if (resetError) {
                throw new Error(`Failed to reset usage counts: ${getReadableError(resetError)}`);
              }

              const usageCache: UsageCache = {
                lastSyncTimestamp: now,
                usageData: {
                  swipe: {
                    currentCount: 0,
                    firstActionTimestamp: now,
                    lastActionTimestamp: now,
                    resetTimestamp: now + 24 * 60 * 60 * 1000,
                  },
                  match: {
                    currentCount: 0,
                    firstActionTimestamp: now,
                    lastActionTimestamp: now,
                    resetTimestamp: now + 24 * 60 * 60 * 1000,
                  },
                  message: {
                    currentCount: 0,
                    firstActionTimestamp: now,
                    lastActionTimestamp: now,
                    resetTimestamp: now + 24 * 60 * 60 * 1000,
                  }
                },
                premiumFeatures: {
                  boostMinutesRemaining: 0,
                  boostUsesRemaining: 0,
                },
                analytics: {
                  profileViews: 0,
                  searchAppearances: 0,
                },
              };

              console.log('Usage counts reset after 24 hours:', usageCache);
              set({ usageCache });
            } else {
              // Use existing counts
              const usageCache: UsageCache = {
                lastSyncTimestamp: now,
                usageData: {
                  swipe: {
                    currentCount: usageData.swipe_count || 0,
                    firstActionTimestamp: usageData.created_at ? new Date(usageData.created_at).getTime() : now,
                    lastActionTimestamp: usageData.last_updated ? new Date(usageData.last_updated).getTime() : now,
                    resetTimestamp: usageData.daily_reset_at ? new Date(usageData.daily_reset_at).getTime() : now + 24 * 60 * 60 * 1000,
                  },
                  match: {
                    currentCount: usageData.match_count || 0,
                    firstActionTimestamp: usageData.created_at ? new Date(usageData.created_at).getTime() : now,
                    lastActionTimestamp: usageData.last_updated ? new Date(usageData.last_updated).getTime() : now,
                    resetTimestamp: usageData.daily_reset_at ? new Date(usageData.daily_reset_at).getTime() : now + 24 * 60 * 60 * 1000,
                  },
                  message: {
                    currentCount: usageData.message_count || 0,
                    firstActionTimestamp: usageData.created_at ? new Date(usageData.created_at).getTime() : now,
                    lastActionTimestamp: usageData.last_updated ? new Date(usageData.last_updated).getTime() : now,
                    resetTimestamp: usageData.daily_reset_at ? new Date(usageData.daily_reset_at).getTime() : now + 24 * 60 * 60 * 1000,
                  }
                },
                premiumFeatures: {
                  boostMinutesRemaining: 0,
                  boostUsesRemaining: 0,
                },
                analytics: {
                  profileViews: 0,
                  searchAppearances: 0,
                },
              };

              console.log('Using existing usage record:', usageCache);
              set({ usageCache });
            }
          }
        } catch (error) {
          console.error('Error initializing usage:', getReadableError(error));
          set({ lastSyncError: getReadableError(error) });
          throw new Error(`Usage initialization failed: ${getReadableError(error)}`);
        }
      },

      trackUsage: async (options: UsageTrackingOptions): Promise<UsageResult> => {
        const { actionType, count = 1 } = options;
        const { user } = useAuthStore.getState();
        const { usageCache } = get();
        
        if (!user) {
          throw new Error('User not authenticated for usage tracking');
        }

        if (!usageCache) {
          throw new Error('Usage cache not initialized for tracking');
        }

        const tierSettings = useAuthStore.getState().getTierSettings();
        if (!tierSettings) {
          throw new Error('Tier settings not available for usage limits');
        }

        const limit = actionType === 'swipe' 
          ? tierSettings.daily_swipe_limit
          : actionType === 'match' 
            ? tierSettings.daily_match_limit
            : tierSettings.message_sending_limit;

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

          // Always queue for batch update
          get().queueBatchUpdate(actionType, count);
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
        
        if (!usageCache || !tierSettings) {
          throw new Error('Usage cache or tier settings not available for stats');
        }

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
        if (!user) {
          throw new Error('User not authenticated for batch update');
        }

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

      syncUsageData: async (force?: boolean) => {
        const { user } = useAuthStore.getState();
        const { usageCache, batchUpdates } = get();

        if (!user || !isSupabaseConfigured() || !supabase) {
          console.warn('Cannot save usage data: User not authenticated or Supabase not configured');
          return;
        }

        if (!force && get().isSyncing) {
          console.log('Usage save already in progress, skipping...');
          return;
        }

        set({ isSyncing: true });

        try {
          // Only process batch updates if any exist
          if (batchUpdates.length > 0) {
            // Aggregate counts by type
            const counts = {
              swipe_count: 0,
              match_count: 0,
              message_count: 0
            };

            batchUpdates[0].updates.forEach(update => {
              switch (update.action_type) {
                case 'swipe':
                  counts.swipe_count += update.count_change;
                  break;
                case 'match':
                  counts.match_count += update.count_change;
                  break;
                case 'message':
                  counts.message_count += update.count_change;
                  break;
              }
            });

            // Update the user's single usage record
            const { error: updateError } = await supabase
              .from('user_daily_usage')
              .update({
                ...counts,
                last_updated: new Date().toISOString()
              })
              .eq('user_id', user.id);

            if (updateError) {
              throw updateError;
            }

            // Clear processed batch updates
            set(state => ({
              ...state,
              batchUpdates: [],
              lastSyncTimestamp: Date.now()
            }));
          }

          set({ isSyncing: false, lastSyncError: null });
        } catch (error) {
          console.error('Error saving usage data:', error);
          set({ 
            isSyncing: false,
            lastSyncError: getReadableError(error)
          });
          throw error;
        }
      },

      checkLimit: (actionType: string, limit: number) => {
        const { usageCache } = get();
        if (!usageCache || !usageCache.usageData[actionType]) {
          throw new Error(`Usage data not available for action type: ${actionType}`);
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
        if (!usageCache) {
          throw new Error('Usage cache not available for reset');
        }

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
            type: 'success',
            message: 'Usage data reset successfully',
            displayStyle: 'toast',
            duration: 3000
          });
        } catch (error) {
          console.error('Error resetting usage cache:', getReadableError(error));
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: 'Failed to reset usage data',
            displayStyle: 'toast',
            duration: 5000
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

// Set up periodic save for usage data
let saveIntervalId: number | null = null;

export const startUsageSync = () => {
  if (saveIntervalId !== null) {
    console.log('Usage save already active');
    return;
  }

  const intervalMs = useUsageStore.getState().saveStrategy.critical.interval;
  saveIntervalId = setInterval(async () => {
    const { user } = useAuthStore.getState();
    if (!user) return; // Silent fail if not authenticated

    await useUsageStore.getState().syncUsageData();
  }, intervalMs) as unknown as number;

  console.log('Usage data save started');
};

export const stopUsageSync = () => {
  if (saveIntervalId === null) {
    console.log('Usage save not active');
    return;
  }

  clearInterval(saveIntervalId);
  saveIntervalId = null;
  console.log('Usage data save stopped');
};
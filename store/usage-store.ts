import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UsageCache, BatchUpdate, SyncStrategy, RateLimits, CacheConfig, RetryStrategy } from '@/types/user';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';

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
  incrementUsage: (actionType: string, count?: number) => void;
  queueBatchUpdate: (actionType: string, countChange: number) => void;
  syncUsageData: (force?: boolean) => Promise<void>;
  checkLimit: (actionType: string, limit: number) => boolean;
  resetUsage: (actionType?: string) => void;
  clearError: () => void;
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
        if (!userId || !isSupabaseConfigured()) {
          console.log('Skipping usage initialization: Invalid user ID or Supabase not configured');
          set({ usageCache: defaultUsageCache });
          return;
        }

        try {
          console.log('Initializing usage data for user:', userId);
          const usageResult = await supabase.from('usage_tracking').select('*').eq('user_id', userId);

          if (usageResult.error) {
            console.error('Error initializing usage data:', usageResult.error);
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

            usageResult?.forEach(entry => {
              usageCache.usageData[entry.action_type] = {
                currentCount: entry.count,
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

      incrementUsage: (actionType: string, count = 1) => {
        const { usageCache } = get();
        if (!usageCache) return;

        const now = Date.now();
        const usageData = usageCache.usageData[actionType];
        const resetTimestamp = usageData?.resetTimestamp || now + 24 * 60 * 60 * 1000;
        const updatedCount = usageData ? usageData.currentCount + count : count;

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

        // Queue batch update for sync
        get().queueBatchUpdate(actionType, count);
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
          if (isSupabaseConfigured()) {
            for (const batch of batchUpdates) {
              const result = await supabase.rpc('batch_update_usage', {
                p_user_id: batch.user_id,
                p_updates: batch.updates,
              });

              if (result.error) {
                console.error('Error syncing batch update:', result.error);
                throw result.error;
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
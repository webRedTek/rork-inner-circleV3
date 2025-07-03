import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StoreApi, StateCreator } from 'zustand';
import { UsageCache, BatchUpdate, SyncStrategy, RateLimits, CacheConfig, RetryStrategy, UsageTrackingOptions, UsageResult, UsageStats, UsageStore, DatabaseTotals } from '@/types/user';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useNotificationStore } from './notification-store';
import { handleError, withErrorHandling, withRetry, ErrorCodes, ErrorCategory } from '@/utils/error-utils';

/**
 * FILE: store/usage-store.ts
 * LAST UPDATED: 2025-07-03 10:30
 * 
 * CURRENT STATE:
 * Central store for all usage tracking and batch processing. Features:
 * - Tracks all user actions and enforces tier-based limits
 * - Handles batch processing for all usage data
 * - Manages periodic syncing with database
 * - Uses cached tier settings from auth store
 * - Provides usage stats and limit checking
 * 
 * RECENT CHANGES:
 * - Centralized all batch processing here (moved from matches store)
 * - Enhanced error handling with proper error stringification
 * - Improved user feedback through notification system
 * - Better error categorization and messages
 * - Enhanced database operations with error recovery
 * 
 * FILE INTERACTIONS:
 * - Imports from: auth-store (tier settings)
 * - Exports to: All stores that need usage tracking
 * - Used by: matches-store, groups-store, messages-store
 * - Dependencies: AsyncStorage (persistence), Supabase (database)
 * 
 * KEY FUNCTIONS:
 * - updateUsage: Track new usage with validation
 * - queueBatchUpdate: Add updates to batch queue
 * - syncUsageData: Sync batched updates with database
 * - startUsageSync/stopUsageSync: Control sync intervals
 * - getUsageStats: Get current usage with limits
 * 
 * BATCH PROCESSING:
 * This store is the central point for all batch processing:
 * 1. Other stores call updateUsage/trackUsage
 * 2. Updates are queued via queueBatchUpdate
 * 3. Periodic sync via syncUsageData (every 30s)
 * 4. Manual sync available via force parameter
 * 5. Handles all error cases and retries
 * 
 * INITIALIZATION ORDER:
 * 1. Requires auth-store for tier settings
 * 2. Initializes after user session
 * 3. Sets up sync intervals
 * 4. Starts background sync
 */

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
    features: ['swipes', 'matches', 'messages', 'likes'],
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

// Enhanced helper function to safely stringify errors
const safeStringifyError = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try {
      // Handle structured error objects with priority order
      if (error.userMessage) return error.userMessage;
      if (error.message) return error.message;
      if (error.error?.message) return error.error.message;
      if (error.details) return String(error.details);
      if (error.hint) return String(error.hint);
      if (error.description) return String(error.description);
      if (error.code) return `Error code: ${error.code}`;
      
      // Try to extract meaningful properties
      const meaningfulProps = ['reason', 'cause', 'statusText', 'data'];
      for (const prop of meaningfulProps) {
        if (error[prop]) return String(error[prop]);
      }
      
      // Last resort: try to stringify safely
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch (e) {
      try {
        return JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e2) {
        return 'Error occurred but could not be parsed';
      }
    }
  }
  return String(error);
};

export const useUsageStore = create<UsageStore>()(
  persist(
    ((set: StoreApi<UsageStore>['setState'], get: StoreApi<UsageStore>['getState']) => ({
      usageCache: null,
      batchUpdates: [],
      isSyncing: false,
      lastSyncError: null,
      databaseTotals: null as DatabaseTotals | null,
      saveStrategy: defaultSyncStrategy,
      rateLimits: defaultRateLimits,
      cacheConfig: defaultCacheConfig,
      retryStrategy: defaultRetryStrategy,

      fetchDatabaseTotals: async (userId: string) => {
        if (!userId || !isSupabaseConfigured() || !supabase) {
          console.log('Cannot fetch database totals: Invalid user ID or Supabase not configured');
          return;
        }

        try {
          // Get today's date in YYYY-MM-DD format
          const today = new Date().toISOString().split('T')[0];
          
          const { data, error } = await supabase
            .from('user_daily_usage')
            .select('swipe_count, match_count, message_count, like_count, daily_reset_at')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

          if (error) {
            const errorMessage = safeStringifyError(error);
            console.error('Failed to fetch database totals:', errorMessage);
            
            // Use error handler to show user-friendly error
            const appError = handleError(error);
            useNotificationStore.getState().addNotification({
              type: 'error',
              message: `Failed to fetch usage data: ${appError.userMessage}`,
              displayStyle: 'toast',
              duration: 5000
            });
            throw new Error(`Failed to fetch database totals: ${appError.userMessage}`);
          }

          // If no record exists for today, return default values
          if (!data) {
            const defaultTotals: DatabaseTotals = {
              swipe_count: 0,
              match_count: 0,
              message_count: 0,
              like_count: 0,
              daily_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            set({ databaseTotals: defaultTotals });
            return defaultTotals;
          }

          set({ databaseTotals: data });
          return data;
        } catch (error) {
          const appError = handleError(error);
          const errorMessage = safeStringifyError(error);
          console.error('Error fetching database totals:', errorMessage);
          set({ databaseTotals: null });
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: `Database error: ${appError.userMessage}`,
            displayStyle: 'toast',
            duration: 5000
          });
        }
      },

      initializeUsage: async (userId: string) => {
        if (!userId || !isSupabaseConfigured() || !supabase) {
          const errorMessage = 'Cannot initialize usage: Invalid user ID or Supabase not configured';
          console.log('Skipping usage initialization:', errorMessage);
          
          const appError = handleError(new Error(errorMessage));
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw new Error(errorMessage);
        }

        try {
          console.log('Initializing usage data for user:', userId);
          const now = Date.now();
          
          // Get today's date in YYYY-MM-DD format
          const today = new Date().toISOString().split('T')[0];
          
          // First try to find any existing record for this user for today
          const { data: existingData, error: findError } = await supabase
            .from('user_daily_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

          if (findError) {
            const appError = handleError(findError);
            const errorMessage = safeStringifyError(findError);
            console.error('Error finding existing usage record:', errorMessage);
            
            useNotificationStore.getState().addNotification({
              type: 'error',
              message: `Failed to check usage record: ${appError.userMessage}`,
              displayStyle: 'toast',
              duration: 5000
            });
            throw new Error(`Failed to check for existing usage record: ${appError.userMessage}`);
          }

          // If record exists, update it (including resetting if expired)
          if (existingData) {
            const isExpired = existingData.daily_reset_at && new Date(existingData.daily_reset_at).getTime() < now;
            
            const { data: updatedData, error: updateError } = await supabase
              .from('user_daily_usage')
              .update({
                swipe_count: isExpired ? 0 : existingData.swipe_count,
                match_count: isExpired ? 0 : existingData.match_count,
                message_count: isExpired ? 0 : existingData.message_count,
                like_count: isExpired ? 0 : existingData.like_count,
                daily_reset_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
                last_updated: new Date().toISOString()
              })
              .eq('id', existingData.id)
              .select()
              .single();

            if (updateError) {
              const appError = handleError(updateError);
              const errorMessage = safeStringifyError(updateError);
              console.error('Failed to update usage record:', errorMessage);
              
              useNotificationStore.getState().addNotification({
                type: 'error',
                message: `Failed to update usage: ${appError.userMessage}`,
                displayStyle: 'toast',
                duration: 5000
              });
              throw new Error(`Failed to update usage record: ${appError.userMessage}`);
            }

            const usageCache: UsageCache = {
              lastSyncTimestamp: now,
              usageData: {
                swipe: {
                  currentCount: updatedData.swipe_count,
                  firstActionTimestamp: new Date(updatedData.created_at).getTime(),
                  lastActionTimestamp: now,
                  resetTimestamp: new Date(updatedData.daily_reset_at).getTime(),
                },
                match: {
                  currentCount: updatedData.match_count,
                  firstActionTimestamp: new Date(updatedData.created_at).getTime(),
                  lastActionTimestamp: now,
                  resetTimestamp: new Date(updatedData.daily_reset_at).getTime(),
                },
                message: {
                  currentCount: updatedData.message_count,
                  firstActionTimestamp: new Date(updatedData.created_at).getTime(),
                  lastActionTimestamp: now,
                  resetTimestamp: new Date(updatedData.daily_reset_at).getTime(),
                },
                like: {
                  currentCount: updatedData.like_count,
                  firstActionTimestamp: new Date(updatedData.created_at).getTime(),
                  lastActionTimestamp: now,
                  resetTimestamp: new Date(updatedData.daily_reset_at).getTime(),
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

            console.log('Updated existing usage record:', usageCache);
            set({ usageCache });
            return;
          }

          // Only create new record if none exists
          const { data: newData, error: createError } = await supabase
            .from('user_daily_usage')
            .insert({
              user_id: userId,
              date: today,
              swipe_count: 0,
              match_count: 0,
              message_count: 0,
              like_count: 0,
              daily_reset_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
              created_at: new Date().toISOString(),
              last_updated: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) {
            const appError = handleError(createError);
            const errorMessage = safeStringifyError(createError);
            console.error('Failed to create usage record:', errorMessage);
            
            useNotificationStore.getState().addNotification({
              type: 'error',
              message: `Failed to create usage record: ${appError.userMessage}`,
              displayStyle: 'toast',
              duration: 5000
            });
            throw new Error(`Failed to create usage record: ${appError.userMessage}`);
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
              },
              like: {
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

          console.log('Created new usage record:', usageCache);
          set({ usageCache });
        } catch (error) {
          const appError = handleError(error);
          const errorMessage = safeStringifyError(error);
          console.error('Error initializing usage:', errorMessage);
          set({ lastSyncError: appError.userMessage });
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: `Usage initialization failed: ${appError.userMessage}`,
            displayStyle: 'toast',
            duration: 5000
          });
          throw error;
        }
      },

      getUsageStats: async (): Promise<UsageStats> => {
        const { usageCache } = get();
        const tierSettings = useAuthStore.getState().getTierSettings();
        
        if (!usageCache || !tierSettings) {
          const errorMessage = 'Usage cache or tier settings not available for stats';
          const appError = handleError(new Error(errorMessage));
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: appError.userMessage
          };
        }

        const swipeData = usageCache.usageData['swipe'] || { currentCount: 0 };
        const matchData = usageCache.usageData['match'] || { currentCount: 0 };
        const messageData = usageCache.usageData['message'] || { currentCount: 0 };
        const likeData = usageCache.usageData['like'] || { currentCount: 0 };

        return {
          swipeCount: swipeData.currentCount,
          swipeLimit: tierSettings.dailySwipeLimit,
          swipeRemaining: Math.max(0, tierSettings.dailySwipeLimit - swipeData.currentCount),
          matchCount: matchData.currentCount,
          matchLimit: tierSettings.dailyMatchLimit,
          matchRemaining: Math.max(0, tierSettings.dailyMatchLimit - matchData.currentCount),
          messageCount: messageData.currentCount,
          messageLimit: tierSettings.messageSendingLimit,
          messageRemaining: Math.max(0, tierSettings.messageSendingLimit - messageData.currentCount),
          likeCount: likeData.currentCount,
          likeLimit: tierSettings.dailyLikeLimit,
          likeRemaining: Math.max(0, tierSettings.dailyLikeLimit - likeData.currentCount),
          timestamp: Date.now(),
        };
      },

      updateUsage: async (action: string): Promise<UsageResult> => {
        const { usageCache } = get();
        const { user } = useAuthStore.getState();
        const tierSettings = useAuthStore.getState().getTierSettings();
        
        if (!usageCache || !tierSettings || !user) {
          const errorMessage = 'Usage cache or tier settings not available';
          const appError = handleError(new Error(errorMessage));
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: appError.userMessage
          };
        }

        const limit = action === 'swipe' 
          ? tierSettings.dailySwipeLimit
          : action === 'match' 
            ? tierSettings.dailyMatchLimit
            : action === 'like'
              ? tierSettings.dailyLikeLimit
              : tierSettings.messageSendingLimit;

        const now = Date.now();
        const usageData = usageCache.usageData[action];
        const resetTimestamp = usageData?.resetTimestamp || now + 24 * 60 * 60 * 1000;
        const currentCount = usageData ? usageData.currentCount : 0;
        const isAllowed = currentCount < limit;

        if (isAllowed) {
          // Update usage count
          set({
            usageCache: {
              ...usageCache,
              usageData: {
                ...usageCache.usageData,
                [action]: {
                  currentCount: currentCount + 1,
                  firstActionTimestamp: usageData?.firstActionTimestamp || now,
                  lastActionTimestamp: now,
                  resetTimestamp,
                },
              },
            },
          });

          // Queue update for sync
          get().queueBatchUpdate(action, 1);
        }

        return {
          isAllowed,
          actionType: action,
          currentCount: currentCount + (isAllowed ? 1 : 0),
          limit,
          remaining: Math.max(0, limit - (currentCount + (isAllowed ? 1 : 0))),
          timestamp: now,
        };
      },

      trackUsage: async (options: UsageTrackingOptions): Promise<UsageResult> => {
        const { user } = useAuthStore.getState();
        if (!user) {
          const errorMessage = 'User not authenticated for usage tracking';
          const appError = handleError(new Error(errorMessage));
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: 'AUTH',
            code: 'AUTH_NOT_AUTHENTICATED',
            message: appError.userMessage
          };
        }

        // Map action types to the correct action string
        let action: string;
        switch (options.actionType) {
          case 'message':
            action = 'message';
            break;
          case 'join_group':
          case 'leave_group':
          case 'create_group':
          case 'send_group_message':
          case 'event_create':
          case 'update_group_event':
          case 'rsvp_event':
          case 'update_group':
            action = 'message'; // Group actions count as messages
            break;
          default:
            action = options.actionType;
        }

        return await get().updateUsage(action);
      },

      queueBatchUpdate: (action: string, count: number) => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const batchUpdate = {
          userId: user.id,
          action,
          count,
          timestamp: Date.now()
        };

        set(state => ({
          batchUpdates: [...state.batchUpdates, batchUpdate]
        }));
      },

      syncUsageData: async (force?: boolean) => {
        const { user } = useAuthStore.getState();
        const { usageCache, batchUpdates } = get();

        if (!user || !isSupabaseConfigured() || !supabase) {
          const errorMessage = 'Cannot save usage data: User not authenticated or Supabase not configured';
          console.warn(errorMessage);
          
          const appError = handleError(new Error(errorMessage));
          useNotificationStore.getState().addNotification({
            type: 'warning',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
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
            // Get today's date in YYYY-MM-DD format
            const today = new Date().toISOString().split('T')[0];
            
            // First check if user has a usage record for today
            const { data: existingRecord, error: fetchError } = await supabase
              .from('user_daily_usage')
              .select('id')
              .eq('user_id', user.id)
              .eq('date', today)
              .maybeSingle();

            if (fetchError) {
              const appError = handleError(fetchError);
              const errorMessage = safeStringifyError(fetchError);
              console.error('Error fetching existing usage record:', errorMessage);
              
              useNotificationStore.getState().addNotification({
                type: 'error',
                message: `Failed to fetch usage record: ${appError.userMessage}`,
                displayStyle: 'toast',
                duration: 5000
              });
              throw fetchError;
            }

            // Aggregate counts by type
            const counts = {
              swipe_count: 0,
              match_count: 0,
              message_count: 0,
              like_count: 0
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
                case 'like':
                  counts.like_count += update.count_change;
                  break;
              }
            });

            console.log('Syncing usage data - Current counts to add:', counts);

            // Update existing record
            console.log('Updating usage record with increments:', counts);
            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            // Update or create the usage record
            const { error: updateError } = await supabase
              .from('user_daily_usage')
              .upsert({
                user_id: user.id,
                date: today,
                swipe_count: counts.swipe_count,
                match_count: counts.match_count,
                message_count: counts.message_count,
                like_count: counts.like_count,
                last_updated: now.toISOString(),
                daily_reset_at: tomorrow.toISOString()
              }, {
                onConflict: 'user_id, date'
              });

            if (updateError) {
              const appError = handleError(updateError);
              const errorMessage = safeStringifyError(updateError);
              console.error('Error updating usage record:', errorMessage);
              
              useNotificationStore.getState().addNotification({
                type: 'error',
                message: `Failed to sync usage data: ${appError.userMessage}`,
                displayStyle: 'toast',
                duration: 5000
              });
              throw updateError;
            }

            console.log('Usage record updated successfully');

            // Clear processed batch updates
            set(state => ({
              ...state,
              batchUpdates: [],
              lastSyncTimestamp: Date.now(),
              lastSyncError: null // Clear any previous errors on success
            }));

            // Show success notification for manual syncs
            if (force) {
              useNotificationStore.getState().addNotification({
                type: 'success',
                message: 'Usage data synced successfully',
                displayStyle: 'toast',
                duration: 3000
              });
            }
          }
        } catch (error) {
          const appError = handleError(error);
          const errorMessage = safeStringifyError(error);
          console.error('Error syncing usage data:', errorMessage);
          set({ lastSyncError: appError.userMessage });
          
          // Show error notification to user with readable error message
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: `Usage sync failed: ${appError.userMessage}`,
            displayStyle: 'toast',
            duration: 8000
          });
          
          throw new Error(appError.userMessage);
        } finally {
          set({ isSyncing: false });
        }
      },

      checkLimit: (actionType: string, limit: number) => {
        const { usageCache } = get();
        if (!usageCache || !usageCache.usageData[actionType]) {
          const errorMessage = `Usage data not available for action type: ${actionType}`;
          const appError = handleError(new Error(errorMessage));
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: appError.userMessage
          };
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
          const errorMessage = 'Usage cache not available for reset';
          const appError = handleError(new Error(errorMessage));
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: 'BUSINESS',
            code: 'BUSINESS_LIMIT_REACHED',
            message: appError.userMessage
          };
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
          const appError = handleError(error);
          const errorMessage = safeStringifyError(error);
          console.error('Error resetting usage cache:', errorMessage);
          
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: `Failed to reset usage data: ${appError.userMessage}`,
            displayStyle: 'toast',
            duration: 5000
          });
        }
      }
    })) as StateCreator<UsageStore>,
    {
      name: 'usage-store',
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

    try {
      await useUsageStore.getState().syncUsageData();
    } catch (error) {
      const appError = handleError(error);
      const errorMessage = safeStringifyError(error);
      console.error('Periodic usage sync failed:', errorMessage);
      // Don't show notification for periodic sync failures to avoid spam
    }
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
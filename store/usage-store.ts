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
 * LAST UPDATED: 2024-12-20 10:30
 * 
 * CURRENT STATE:
 * Central usage tracking store using Zustand. Handles tracking and limiting
 * user actions based on their membership tier. Uses cached tier settings
 * from auth store for feature permissions and limits. Implements optimized
 * batching and caching strategies for usage data.
 * 
 * RECENT CHANGES:
 * - Fixed fetchDatabaseTotals to use .maybeSingle() instead of .single()
 * - Added date filtering to get today's usage record
 * - Improved error handling to properly display readable error messages
 * - Enhanced notification system integration for better error visibility
 * - Added proper error logging and user-friendly error messages
 * 
 * FILE INTERACTIONS:
 * - Imports from: user types (UserProfile, MembershipTier)
 * - Imports from: supabase lib (database operations)
 * - Imports from: auth-store (user data, tier settings access)
 * - Imports from: error-utils, network-utils (error handling and network checks)
 * - Exports to: All stores and screens that need usage tracking
 * - Dependencies: AsyncStorage (persistence), Zustand (state management)
 * - Data flow: Tracks user actions, enforces limits, provides usage data to UI
 * 
 * KEY FUNCTIONS:
 * - getUsageStats: Get current usage stats with tier limits
 * - updateUsage: Track new usage with proper validation
 * - syncUsageData: Sync usage data with database
 * - checkUsageLimits: Check if action is allowed based on limits
 * - resetUsage: Reset usage tracking data
 * 
 * INITIALIZATION ORDER:
 * 1. Requires auth-store to be initialized first
 * 2. Initializes after auth-store confirms user session
 * 3. Sets up sync intervals based on feature criticality
 * 4. Starts background sync process if needed
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

// Helper function to safely stringify errors
const safeStringifyError = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try {
      // Try to extract meaningful properties
      const message = error.message || error.details || error.hint || 'Unknown error';
      const code = error.code ? ` (Code: ${error.code})` : '';
      return `${message}${code}`;
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
          console.error('Error fetching database totals:', appError);
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
          
          // Check if user is authenticated
          const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
          if (authError || !authUser || authUser.id !== userId) {
            const errorMessage = 'User not authenticated for usage initialization';
            console.log(errorMessage);
            
            const appError = handleError(new Error(errorMessage));
            useNotificationStore.getState().addNotification({
              type: 'error',
              message: appError.userMessage,
              displayStyle: 'toast',
              duration: 5000
            });
            throw new Error(errorMessage);
          }
          
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
            console.error('Error finding existing usage record:', appError);
            
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
              console.error('Failed to update usage record:', appError);
              
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
            console.error('Failed to create usage record:', appError);
            
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
          console.error('Error initializing usage:', appError);
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

      getUsageStats: async (userId: string): Promise<UsageStats> => {
        const { usageCache } = get();
        const { user, allTierSettings } = useAuthStore.getState();
        
        if (!usageCache || !user || !allTierSettings) {
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

        const tierSettings = allTierSettings[user.membershipTier];
        if (!tierSettings) {
          const errorMessage = 'Tier settings not available for your membership level';
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
          swipeLimit: tierSettings.daily_swipe_limit,
          swipeRemaining: Math.max(0, tierSettings.daily_swipe_limit - swipeData.currentCount),
          matchCount: matchData.currentCount,
          matchLimit: tierSettings.daily_match_limit,
          matchRemaining: Math.max(0, tierSettings.daily_match_limit - matchData.currentCount),
          messageCount: messageData.currentCount,
          messageLimit: tierSettings.message_sending_limit,
          messageRemaining: Math.max(0, tierSettings.message_sending_limit - messageData.currentCount),
          likeCount: likeData.currentCount,
          likeLimit: tierSettings.daily_like_limit,
          likeRemaining: Math.max(0, tierSettings.daily_like_limit - likeData.currentCount),
          timestamp: Date.now(),
        };
      },

      updateUsage: async (userId: string, action: string): Promise<UsageResult> => {
        const { usageCache } = get();
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

        if (!usageCache) {
          const errorMessage = 'Usage cache not initialized for tracking';
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

        const tierSettings = useAuthStore.getState().getTierSettings();
        if (!tierSettings) {
          const errorMessage = 'Tier settings not available for usage limits';
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

        const limit = action === 'swipe' 
          ? tierSettings.daily_swipe_limit
          : action === 'match' 
            ? tierSettings.daily_match_limit
            : tierSettings.message_sending_limit;

        const now = Date.now();
        const usageData = usageCache.usageData[action];
        const resetTimestamp = usageData?.resetTimestamp || now + 24 * 60 * 60 * 1000;
        const currentCount = usageData ? usageData.currentCount : 0;
        const isAllowed = currentCount < limit;

        // Optimistic update if action is allowed
        if (isAllowed) {
          const updatedCount = currentCount + 1;
          set({
            usageCache: {
              ...usageCache,
              usageData: {
                ...usageCache.usageData,
                [action]: {
                  currentCount: updatedCount,
                  firstActionTimestamp: usageData?.firstActionTimestamp || now,
                  lastActionTimestamp: now,
                  resetTimestamp,
                },
              },
            },
          });

          // Always queue for batch update
          get().queueBatchUpdate(action, 1);
        }

        return {
          isAllowed,
          actionType: action,
          currentCount,
          limit,
          remaining: Math.max(0, limit - currentCount),
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

        return await get().updateUsage(user.id, action);
      },

      queueBatchUpdate: (actionType: string, countChange: number) => {
        const { user } = useAuthStore.getState();
        if (!user) {
          const errorMessage = 'User not authenticated for batch update';
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
              console.error('Error fetching existing usage record:', appError);
              
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
              console.error('Error updating usage record:', appError);
              
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
          console.error('Error syncing usage data:', appError);
          set({ lastSyncError: appError.userMessage });
          
          // Show error notification to user
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
            category: 'BUSINESS',
            code: 'BUSINESS_LIMIT_REACHED',
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
          console.error('Error resetting usage cache:', appError);
          
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

    try {
      await useUsageStore.getState().syncUsageData();
    } catch (error) {
      const appError = handleError(error);
      console.error('Periodic usage sync failed:', appError);
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
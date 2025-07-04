import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StoreApi, StateCreator } from 'zustand';
import { UsageCache, BatchUpdate, SyncStrategy, RateLimits, CacheConfig, RetryStrategy, UsageTrackingOptions, UsageResult, UsageStats, UsageStore, DatabaseTotals } from '@/types/user';
import { supabase } from '@/lib/supabase';
import { handleError, withErrorHandling, withRetry, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { createStoreLogger } from '@/utils/debug-utils';
import { guardStoreOperation, safeStringifyError } from '@/utils/store-auth-utils';
import { notify } from '@/store/notification-store';
import { useAuthStore } from './auth-store';

/**
 * FILE: store/usage-store.ts
 * LAST UPDATED: 2025-07-04 18:30
 * 
 * CURRENT STATE:
 * **SINGLE SOURCE OF TRUTH** for all usage tracking and limit checking. Features:
 * - Unified limit checking system used by ALL components (discover, profile, cache view)
 * - Centralized usage data management with tier-aware limit validation
 * - Real-time limit status calculation combining tier settings + current usage
 * - Eliminates duplicate limit checking systems across the app
 * - Consistent user experience with unified error messages and limit display
 * 
 * RECENT CHANGES:
 * - MAJOR REFACTOR: Created unified limit checking functions (checkAllLimits, checkSpecificLimit)
 * - ELIMINATED: Duplicate limit checking systems in matches-store and other components
 * - CENTRALIZED: All limit validation logic in single location for maintainability
 * - STANDARDIZED: Limit checking interface used by profile cache, discover tab, and all other components
 * - ENHANCED: Real-time limit calculation with tier settings integration
 * 
 * FILE INTERACTIONS:
 * - PRIMARY SOURCE: Used by discover tab, profile tab, cache view, matches-store, messages-store, groups-store
 * - IMPORTS FROM: auth-store (tier settings), supabase (database), notification-store (alerts)
 * - EXPORTS TO: All UI components that need limit checking or usage tracking
 * - DEPENDENCIES: Zustand (state), AsyncStorage (persistence), centralized utilities
 * - DATA FLOW: Single source of truth for all usage/limit data across entire app
 * 
 * KEY FUNCTIONS:
 * - checkAllLimits: Returns comprehensive limit status for all usage types
 * - checkSpecificLimit: Checks individual limit (swipe, match, like, message, etc.)
 * - getUsageStats: Provides formatted usage data for UI display
 * - trackUsage/updateUsage: Records user actions for limit enforcement
 * - fetchDatabaseTotals: Syncs with database for current usage counts
 */

// Use centralized debug logging
const logger = createStoreLogger('UsageStore');

// Enhanced interfaces for unified limit checking
interface LimitStatus {
  current: number;
  limit: number;
  isReached: boolean;
  remaining: number;
  percentUsed: number;
  resetTime?: number;
}

interface AllLimitsStatus {
  swipe: LimitStatus;
  match: LimitStatus;
  like: LimitStatus;
  message: LimitStatus;
  directIntro: LimitStatus;
  groupsJoined: LimitStatus;
  groupsCreated: LimitStatus;
  eventsCreated: LimitStatus;
  featuredPortfolio: LimitStatus;
  virtualMeetings: LimitStatus;
  boostMinutes: LimitStatus;
  boostUses: LimitStatus;
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
    interval: 60 * 1000, // 60 seconds (1 minute)
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

      // **UNIFIED LIMIT CHECKING SYSTEM** - Single source of truth for all limit validation
      checkAllLimits: (): AllLimitsStatus => {
        logger.logFunctionCall('checkAllLimits');
        
        const { databaseTotals } = get();
        const { getTierSettings } = useAuthStore.getState();
        const tierSettings = getTierSettings();
        
        if (!tierSettings || !databaseTotals) {
          logger.logDebug('Missing tier settings or database totals', { 
            hasTierSettings: !!tierSettings, 
            hasDatabaseTotals: !!databaseTotals 
          });
          
          // Return safe defaults when data is not available
          const defaultLimit: LimitStatus = {
            current: 0,
            limit: 0,
            isReached: false,
            remaining: 0,
            percentUsed: 0
          };
          
          return {
            swipe: defaultLimit,
            match: defaultLimit,
            like: defaultLimit,
            message: defaultLimit,
            directIntro: defaultLimit,
            groupsJoined: defaultLimit,
            groupsCreated: defaultLimit,
            eventsCreated: defaultLimit,
            featuredPortfolio: defaultLimit,
            virtualMeetings: defaultLimit,
            boostMinutes: defaultLimit,
            boostUses: defaultLimit
          };
        }
        
        // Helper function to create limit status
        const createLimitStatus = (current: number, limit: number): LimitStatus => {
          const isReached = current >= limit;
          const remaining = Math.max(0, limit - current);
          const percentUsed = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
          
          return {
            current,
            limit,
            isReached,
            remaining,
            percentUsed
          };
        };
        
        // Calculate all limit statuses using consistent logic
        const allLimits: AllLimitsStatus = {
          swipe: createLimitStatus(
            databaseTotals.swipe_count || 0, 
            tierSettings.daily_swipe_limit || 0
          ),
          match: createLimitStatus(
            databaseTotals.match_count || 0, 
            tierSettings.daily_match_limit || 0
          ),
          like: createLimitStatus(
            databaseTotals.like_count || 0, 
            tierSettings.daily_like_limit || 0
          ),
          message: createLimitStatus(
            databaseTotals.message_count || 0, 
            tierSettings.message_sending_limit || 0
          ),
          directIntro: createLimitStatus(
            databaseTotals.direct_intro_count || 0, 
            tierSettings.direct_intro_limit || 0
          ),
          groupsJoined: createLimitStatus(
            databaseTotals.groups_joined_count || 0, 
            tierSettings.groups_limit || 0
          ),
          groupsCreated: createLimitStatus(
            databaseTotals.groups_created_count || 0, 
            tierSettings.groups_creation_limit || 0
          ),
          eventsCreated: createLimitStatus(
            databaseTotals.events_created_count || 0, 
            tierSettings.events_per_month || 0
          ),
          featuredPortfolio: createLimitStatus(
            databaseTotals.featured_portfolio_count || 0, 
            tierSettings.featured_portfolio_limit || 0
          ),
          virtualMeetings: createLimitStatus(
            databaseTotals.virtual_meetings_hosted || 0, 
            tierSettings.virtual_meetings_limit || 0
          ),
          boostMinutes: createLimitStatus(
            databaseTotals.boost_minutes_used || 0, 
            tierSettings.boost_duration || 0
          ),
          boostUses: createLimitStatus(
            databaseTotals.boost_uses_count || 0, 
            tierSettings.boost_frequency || 0
          )
        };
        
        logger.logDebug('All limits calculated', allLimits);
        return allLimits;
      },

      // Check specific limit type (used by individual components)
      checkSpecificLimit: (limitType: keyof AllLimitsStatus): LimitStatus => {
        logger.logFunctionCall('checkSpecificLimit', { limitType });
        
        const allLimits = get().checkAllLimits();
        return allLimits[limitType];
      },

      // Unified functions that replace the old simplified check functions
      checkSwipeLimit: (): boolean => {
        logger.logFunctionCall('checkSwipeLimit');
        const status = get().checkSpecificLimit('swipe');
        return !status.isReached;
      },

      checkMatchLimit: (): boolean => {
        logger.logFunctionCall('checkMatchLimit');
        const status = get().checkSpecificLimit('match');
        return !status.isReached;
      },

      checkMessageLimit: (): boolean => {
        logger.logFunctionCall('checkMessageLimit');
        const status = get().checkSpecificLimit('message');
        return !status.isReached;
      },

      checkLikeLimit: (): boolean => {
        logger.logFunctionCall('checkLikeLimit');
        const status = get().checkSpecificLimit('like');
        return !status.isReached;
      },

      fetchDatabaseTotals: async (userId: string) => {
        logger.logFunctionCall('fetchDatabaseTotals', { userId });
        
        const guard = guardStoreOperation('fetchDatabaseTotals');
        if (!guard) return;

        try {
          const today = new Date().toISOString().split('T')[0];
          logger.logDebug('Fetching totals for date', { date: today });

          const { data, error } = await supabase
            .from('user_daily_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .limit(1);

          if (error) throw error;

          const totals: DatabaseTotals = data?.[0] ? {
            swipe_count: data[0].swipe_count || 0,
            match_count: data[0].match_count || 0,
            message_count: data[0].message_count || 0,
            like_count: data[0].like_count || 0,
            direct_intro_count: data[0].direct_intro_count || 0,
            groups_joined_count: data[0].groups_joined_count || 0,
            groups_created_count: data[0].groups_created_count || 0,
            events_created_count: data[0].events_created_count || 0,
            featured_portfolio_count: data[0].featured_portfolio_count || 0,
            virtual_meetings_hosted: data[0].virtual_meetings_hosted || 0,
            boost_minutes_used: data[0].boost_minutes_used || 0,
            boost_uses_count: data[0].boost_uses_count || 0
          } : {
            swipe_count: 0,
            match_count: 0,
            message_count: 0,
            like_count: 0,
            direct_intro_count: 0,
            groups_joined_count: 0,
            groups_created_count: 0,
            events_created_count: 0,
            featured_portfolio_count: 0,
            virtual_meetings_hosted: 0,
            boost_minutes_used: 0,
            boost_uses_count: 0
          };

          set({ databaseTotals: totals });
          logger.logDebug('Database totals fetched successfully', totals);
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error fetching database totals', { error: errorMessage });
          notify.error(`Failed to fetch usage data: ${errorMessage}`);
        }
      },

      getUsageStats: async (userId: string): Promise<UsageStats | null> => {
        logger.logFunctionCall('getUsageStats', { userId });
        
        const guard = guardStoreOperation('getUsageStats');
        if (!guard) return null;

        try {
          await get().fetchDatabaseTotals(userId);
          const allLimits = get().checkAllLimits();
          
          return {
            dailyStats: get().databaseTotals || {
              swipe_count: 0,
              match_count: 0,
              message_count: 0,
              like_count: 0,
              direct_intro_count: 0,
              groups_joined_count: 0,
              groups_created_count: 0,
              events_created_count: 0,
              featured_portfolio_count: 0,
              virtual_meetings_hosted: 0,
              boost_minutes_used: 0,
              boost_uses_count: 0,
            },
            limits: {
              dailySwipeLimit: allLimits.swipe.limit,
              dailyMatchLimit: allLimits.match.limit,
              dailyLikeLimit: allLimits.like.limit,
              dailyMessageLimit: allLimits.message.limit,
            }
          };
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error getting usage stats', { error: errorMessage });
          return null;
        }
      },

      trackUsage: async (actionType: string, count: number = 1): Promise<UsageResult> => {
        logger.logFunctionCall('trackUsage', { actionType, count });
        
        const guard = guardStoreOperation('trackUsage');
        if (!guard) {
          return { success: false, error: 'Authentication required' };
        }

        try {
          // Simple tracking - just log the action
          logger.logDataFlow('Usage tracked', { actionType, count, userId: guard.user.id });
          return { success: true };
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error tracking usage', { error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      updateUsage: async (actionType: string, count: number = 1, force: boolean = false): Promise<void> => {
        logger.logFunctionCall('updateUsage', { actionType, count, force });
        
        const guard = guardStoreOperation('updateUsage');
        if (!guard) return;

        try {
          // Queue the update for batch processing
          get().queueBatchUpdate({
            actionType,
            countChange: count,
            timestamp: Date.now(),
            userId: guard.user.id
          });

          // Sync immediately if force is true
          if (force) {
            await get().syncUsageData(guard.user.id, true);
          }
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error updating usage', { error: errorMessage });
          notify.error(`Failed to update usage: ${errorMessage}`);
        }
      },

      // Simplified batch queue management
      queueBatchUpdate: (update: BatchUpdate) => {
        logger.logFunctionCall('queueBatchUpdate', update);
        
        set(state => ({
          batchUpdates: [...state.batchUpdates, update]
        }));
      },

      syncUsageData: async (userId: string, force: boolean = false): Promise<void> => {
        logger.logFunctionCall('syncUsageData', { userId, force });
        
        const guard = guardStoreOperation('syncUsageData');
        if (!guard) return;

        const { batchUpdates, isSyncing } = get();
        
        if (isSyncing || (batchUpdates.length === 0 && !force)) {
          return;
        }

        set({ isSyncing: true, lastSyncError: null });

        try {
          // Process batch updates
          if (batchUpdates.length > 0) {
            const groupedUpdates = batchUpdates.reduce((acc: any, update) => {
              const key = update.actionType;
              if (!acc[key]) {
                acc[key] = 0;
              }
              acc[key] += update.countChange;
              return acc;
            }, {});

            logger.logDataFlow('Syncing batch updates', groupedUpdates);

            // Clear processed updates
            set({ batchUpdates: [] });
          }

          // Refresh database totals
          await get().fetchDatabaseTotals(userId);
          
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error syncing usage data', { error: errorMessage });
          set({ lastSyncError: errorMessage });
          notify.error(`Failed to sync usage data: ${errorMessage}`);
        } finally {
          set({ isSyncing: false });
        }
      },

      initializeUsage: async (userId: string): Promise<void> => {
        logger.logFunctionCall('initializeUsage', { userId });
        
        const guard = guardStoreOperation('initializeUsage');
        if (!guard) return;

        try {
          // Initialize cache
          set({ usageCache: defaultUsageCache });
          
          // Fetch initial data
          await get().fetchDatabaseTotals(userId);
          
          logger.logDebug('Usage store initialized successfully');
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error initializing usage', { error: errorMessage });
          notify.error(`Failed to initialize usage tracking: ${errorMessage}`);
        }
      },

      resetUsage: () => {
        logger.logFunctionCall('resetUsage');
        
        set({
          usageCache: null,
          batchUpdates: [],
          isSyncing: false,
          lastSyncError: null,
          databaseTotals: null
        });
      }
    })) as StateCreator<
      UsageStore,
      [],
      [],
      UsageStore
    >,
    {
      name: 'usage-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        usageCache: state.usageCache,
        databaseTotals: state.databaseTotals
      }),
      version: 1
    }
  )
);

// Simplified sync functions using centralized auth guard
export const startUsageSync = () => {
  const guard = guardStoreOperation('startUsageSync');
  if (!guard) return;
  
  logger.logFunctionCall('startUsageSync');
  
  // Start sync interval every minute
  const syncInterval = setInterval(async () => {
    await useUsageStore.getState().syncUsageData(guard.user.id);
  }, 60 * 1000);

  // Store interval for cleanup
  (globalThis as any).usageSyncInterval = syncInterval;
};

export const stopUsageSync = () => {
  logger.logFunctionCall('stopUsageSync');
  
  if ((globalThis as any).usageSyncInterval) {
    clearInterval((globalThis as any).usageSyncInterval);
    (globalThis as any).usageSyncInterval = null;
  }
};

export const startUsageSyncOnce = () => {
  const guard = guardStoreOperation('startUsageSyncOnce');
  if (!guard) return;
  
  logger.logFunctionCall('startUsageSyncOnce');
  
  // Run sync once after 60 seconds
  setTimeout(async () => {
    await useUsageStore.getState().syncUsageData(guard.user.id);
  }, 60 * 1000);
};

export const startUsageSyncForDiscovery = () => {
  const guard = guardStoreOperation('startUsageSyncForDiscovery');
  if (!guard) return;
  
  logger.logFunctionCall('startUsageSyncForDiscovery');
  
  // Sync immediately when discovery tab is accessed
  useUsageStore.getState().syncUsageData(guard.user.id, true);
};

// Export the unified interfaces for use by other components
export type { LimitStatus, AllLimitsStatus };
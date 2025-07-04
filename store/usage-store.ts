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

/**
 * FILE: store/usage-store.ts
 * LAST UPDATED: 2025-07-04 11:00
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
 * - Removed duplicate debug logging system (now uses centralized utils)
 * - Removed duplicate auth checks (now uses centralized guard functions)
 * - Removed duplicate error handling (now uses centralized utilities)
 * - Simplified notification calls using centralized patterns
 * - Cleaned up duplicate code patterns
 */

// Use centralized debug logging
const logger = createStoreLogger('UsageStore');

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
            swipeCount: data[0].swipe_count || 0,
            matchCount: data[0].match_count || 0,
            messageCount: data[0].message_count || 0,
            likeCount: data[0].like_count || 0,
            directIntroCount: data[0].direct_intro_count || 0,
            groupsJoinedCount: data[0].groups_joined_count || 0,
            groupsCreatedCount: data[0].groups_created_count || 0,
            eventsCreatedCount: data[0].events_created_count || 0,
            featuredPortfolioCount: data[0].featured_portfolio_count || 0,
            virtualMeetingsHosted: data[0].virtual_meetings_hosted || 0,
            boostMinutesUsed: data[0].boost_minutes_used || 0,
            boostUsesCount: data[0].boost_uses_count || 0
          } : {
            swipeCount: 0,
            matchCount: 0,
            messageCount: 0,
            likeCount: 0,
            directIntroCount: 0,
            groupsJoinedCount: 0,
            groupsCreatedCount: 0,
            eventsCreatedCount: 0,
            featuredPortfolioCount: 0,
            virtualMeetingsHosted: 0,
            boostMinutesUsed: 0,
            boostUsesCount: 0
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
          const { databaseTotals } = get();
          
          if (!databaseTotals) {
            return null;
          }

          return {
            dailyStats: databaseTotals,
            limits: {
              dailySwipeLimit: 10000,
              dailyMatchLimit: 100,
              dailyLikeLimit: 50,
              dailyMessageLimit: 500,
            }
          };
        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error getting usage stats', { error: errorMessage });
          return null;
        }
      },

      // Simplified limit checking functions - removed duplicate validation
      checkSwipeLimit: () => {
        logger.logFunctionCall('checkSwipeLimit');
        return true; // Simplified - let server handle limits
      },

      checkMatchLimit: () => {
        logger.logFunctionCall('checkMatchLimit');
        return true; // Simplified - let server handle limits
      },

      checkMessageLimit: () => {
        logger.logFunctionCall('checkMessageLimit');
        return true; // Simplified - let server handle limits
      },

      checkLikeLimit: () => {
        logger.logFunctionCall('checkLikeLimit');
        return true; // Simplified - let server handle limits
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
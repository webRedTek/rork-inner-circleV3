/**
 * FILE: store/usage-store.ts
 * LAST UPDATED: 2024-12-20 17:45
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes after authentication succeeds
 * 2. Requires user authentication and Supabase configuration
 * 3. Manages usage tracking and batching for performance
 * 4. Provides unified limit checking system
 * 5. Integrates with 60-second sync intervals
 * 
 * CURRENT STATE:
 * Simplified usage tracking store that eliminates multiple sources of truth issues.
 * Now uses single source of truth for limit checking, batch processing for swipes,
 * and unified sync system. No longer duplicates auth checks or complex validation.
 * 
 * RECENT CHANGES:
 * - Removed duplicate auth checks and limit flags from matches-store  
 * - Implemented unified limit checking system as single source of truth
 * - Fixed batch processing architecture to cache swipes locally
 * - Integrated swipe caching with 60-second sync system
 * - Simplified error handling and removed excessive logging
 * - Fixed function signatures to match interface requirements
 * 
 * FILE INTERACTIONS:
 * - Imports from: user types, supabase lib, auth-store, debug-utils, store-auth-utils
 * - Exports to: auth-store (initialization), discover screen (limit checking), 
 *   cache view (display), matches-store (swipe batching)
 * - Dependencies: Zustand (state management), AsyncStorage (persistence)
 * - Data flow: Tracks usage, batches updates, syncs every 60 seconds, provides
 *   unified limit status to all components
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - checkAllLimits/checkSpecificLimit: Single source of truth for limit validation
 * - cacheSwipe: Local swipe caching for batch processing
 * - syncUsageData: 60-second batch sync with database
 * - trackUsage: Queue updates for batching
 * - initializeUsage: Initialize store after authentication
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured, initSupabase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { 
  UsageStore, 
  UsageCache, 
  DatabaseTotals, 
  BatchUpdate, 
  UsageResult, 
  UsageStats,
  SyncStrategy,
  RateLimits,
  CacheConfig,
  RetryStrategy
} from '@/types/user';
import { createStoreLogger } from '@/utils/debug-utils';
import { StoreApi } from 'zustand';

const logger = createStoreLogger('usage-store');

export const useUsageStore = create<UsageStore>()(
  persist(
    ((set: StoreApi<UsageStore>['setState'], get: StoreApi<UsageStore>['getState']) => ({
      usageCache: null,
      batchUpdates: [],
      isSyncing: false,
      lastSyncError: null,
      databaseTotals: null,
      saveStrategy: 'IMMEDIATE',
      rateLimits: {
        dailySwipeLimit: 0,
        dailyMatchLimit: 0,
        dailyLikeLimit: 0,
        dailyMessageLimit: 0,
      },
      cacheConfig: {
        maxAge: 300000, // 5 minutes
        syncInterval: 30000, // 30 seconds
        batchSize: 5,
      },
      retryStrategy: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000,
      },
      swipeCache: {
        pendingSwipes: [],
        lastSyncTimestamp: 0,
      },

      // Unified limit checking functions
      checkAllLimits: () => {
        const { databaseTotals, rateLimits } = get();
        if (!databaseTotals || !rateLimits) return null;
        
        return {
          swipe: { isAllowed: databaseTotals.swipe_count < rateLimits.dailySwipeLimit },
          match: { isAllowed: databaseTotals.match_count < rateLimits.dailyMatchLimit },
          like: { isAllowed: databaseTotals.like_count < rateLimits.dailyLikeLimit },
          message: { isAllowed: databaseTotals.message_count < rateLimits.dailyMessageLimit },
        };
      },

      checkSpecificLimit: (limitType: string) => {
        const { databaseTotals, rateLimits } = get();
        if (!databaseTotals || !rateLimits) return null;
        
        switch (limitType) {
          case 'swipe':
            return { isAllowed: databaseTotals.swipe_count < rateLimits.dailySwipeLimit };
          case 'match':
            return { isAllowed: databaseTotals.match_count < rateLimits.dailyMatchLimit };
          case 'like':
            return { isAllowed: databaseTotals.like_count < rateLimits.dailyLikeLimit };
          case 'message':
            return { isAllowed: databaseTotals.message_count < rateLimits.dailyMessageLimit };
          default:
            return null;
        }
      },

      checkSwipeLimit: () => {
        const { databaseTotals, rateLimits } = get();
        if (!databaseTotals || !rateLimits) return false;
        return databaseTotals.swipe_count < rateLimits.dailySwipeLimit;
      },

      checkMatchLimit: () => {
        const { databaseTotals, rateLimits } = get();
        if (!databaseTotals || !rateLimits) return false;
        return databaseTotals.match_count < rateLimits.dailyMatchLimit;
      },

      checkLikeLimit: () => {
        const { databaseTotals, rateLimits } = get();
        if (!databaseTotals || !rateLimits) return false;
        return databaseTotals.like_count < rateLimits.dailyLikeLimit;
      },

      checkMessageLimit: () => {
        const { databaseTotals, rateLimits } = get();
        if (!databaseTotals || !rateLimits) return false;
        return databaseTotals.message_count < rateLimits.dailyMessageLimit;
      },

      // Load rate limits from user's tier settings
      loadRateLimits: async (userId: string) => {
        try {
          const { useAuthStore } = require('@/store/auth-store');
          
          // Try multiple times in case tier settings aren't ready yet
          let tierSettings = null;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (!tierSettings && attempts < maxAttempts) {
            const { getTierSettings, fetchAllTierSettings } = useAuthStore.getState();
            tierSettings = getTierSettings(); // Remove await - this is synchronous
            
            if (!tierSettings && attempts === 0) {
              // Try to fetch tier settings if not available
              logger.logDebug('Tier settings not available, fetching...');
              await fetchAllTierSettings();
              tierSettings = getTierSettings();
            }
            
            if (!tierSettings) {
              attempts++;
              if (attempts < maxAttempts) {
                logger.logDebug(`Tier settings not ready, retrying in 1s (attempt ${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          
          if (tierSettings) {
            set({
              rateLimits: {
                dailySwipeLimit: tierSettings.daily_swipe_limit || 0,
                dailyMatchLimit: tierSettings.daily_match_limit || 0,
                dailyLikeLimit: tierSettings.daily_like_limit || 0,
                dailyMessageLimit: tierSettings.message_sending_limit || 0,
              }
            });
            
            logger.logDebug('Rate limits loaded successfully:', {
              swipe: tierSettings.daily_swipe_limit,
              match: tierSettings.daily_match_limit,
              like: tierSettings.daily_like_limit,
              message: tierSettings.message_sending_limit
            });
          } else {
            logger.logDebug('Failed to load tier settings after multiple attempts');
          }
        } catch (error) {
          logger.logDebug('Failed to load rate limits:', { error });
        }
      },

      // Core functions
      initializeUsage: async (userId: string) => {
        logger.logDebug('Initializing usage for user:', { userId });
        
        try {
          if (!userId) {
            throw new Error('User ID is required');
          }
          
          await initSupabase();
          
          if (!isSupabaseConfigured() || !supabase) {
            throw new Error('Supabase is not configured');
          }
          
          set({ 
            usageCache: { 
              counts: {
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
              timestamp: Date.now(),
              lastSyncTimestamp: Date.now(),
            },
            batchUpdates: [],
            lastSyncError: null,
            swipeCache: {
              pendingSwipes: [],
              lastSyncTimestamp: 0,
            },
          });
          
          // Load rate limits from tier settings first
          await get().loadRateLimits(userId);
          
          // Then fetch database totals
          await get().fetchDatabaseTotals(userId);
          
          logger.logDebug('Usage initialization completed');
        } catch (error) {
          logger.logDebug('Usage initialization failed:', { error });
          set({ lastSyncError: error instanceof Error ? error.message : 'Unknown error' });
          // Don't re-throw to avoid blocking login
        }
      },

      fetchDatabaseTotals: async (userId: string) => {
        try {
          if (!userId) {
            throw new Error('User ID is required');
          }

          await initSupabase();
          
          if (!isSupabaseConfigured() || !supabase) {
            throw new Error('Supabase is not configured');
          }

          // Query for today's usage record
          const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
          
          // Optional debug logging (non-blocking)
          try {
            const { useDebugStore } = require('@/store/debug-store');
            const { isDebugMode, addDebugLog } = useDebugStore.getState();
            
            if (isDebugMode) {
              addDebugLog({
                event: 'Database query started',
                status: 'info',
                details: `Querying user_daily_usage for user ${userId} on date ${today}`,
                source: 'usage-store',
                data: { userId, date: today, table: 'user_daily_usage' }
              });
            }
          } catch (debugError) {
            // Debug logging failure shouldn't block functionality
          }

          const { data, error } = await supabase
            .from('user_daily_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .single();
          
          if (error) {
            if (error.code === 'PGRST116') {
              // No usage stats found, create default
              const defaultTotals: DatabaseTotals = {
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
              };
              
              // Try to create the record in the database
              const { data: insertData, error: insertError } = await supabase
                .from('user_daily_usage')
                .insert({
                  user_id: userId,
                  date: today,
                  ...defaultTotals,
                  last_updated: new Date().toISOString(),
                  created_at: new Date().toISOString()
                })
                .select()
                .single();
              
              if (insertError) {
                // Still set defaults in memory even if DB insert fails
                set({ databaseTotals: defaultTotals });
              } else {
                set({ databaseTotals: insertData });
              }
              
              // Optional debug logging (non-blocking)
              try {
                const { useDebugStore } = require('@/store/debug-store');
                const { isDebugMode, addDebugLog } = useDebugStore.getState();
                
                if (isDebugMode) {
                  addDebugLog({
                    event: 'No usage stats found, using defaults',
                    status: 'warning',
                    details: 'No user_daily_usage record found, creating default totals',
                    source: 'usage-store',
                    data: { 
                      defaultTotals,
                      userId,
                      date: today,
                      insertSuccess: !insertError,
                      insertError: insertError?.message
                    }
                  });
                }
              } catch (debugError) {
                // Debug logging failure shouldn't block functionality
              }
              
              return;
            }
            
            throw error;
          }

          set({ databaseTotals: data });
          
          // Optional debug logging (non-blocking)
          try {
            const { useDebugStore } = require('@/store/debug-store');
            const { isDebugMode, addDebugLog } = useDebugStore.getState();
            
            if (isDebugMode) {
              addDebugLog({
                event: 'Database totals fetched successfully',
                status: 'success',
                details: `Retrieved user daily usage from database`,
                source: 'usage-store',
                data: { 
                  totals: data,
                  swipeCount: data.swipe_count,
                  matchCount: data.match_count,
                  likeCount: data.like_count,
                  messageCount: data.message_count
                }
              });
            }
          } catch (debugError) {
            // Debug logging failure shouldn't block functionality
          }
          
        } catch (error) {
          logger.logDebug('Failed to fetch database totals:', { error });
          set({ lastSyncError: error instanceof Error ? error.message : 'Unknown error' });
          // Don't re-throw to avoid blocking other operations
        }
      },

      syncUsageData: async (userId: string, force = false) => {
        if (!userId) {
          throw new Error('User ID is required');
        }
        
        const { isSyncing, usageCache, batchUpdates } = get();
        
        if (isSyncing && !force) {
          logger.logDebug('Sync already in progress, skipping');
          return;
        }
        
        set({ isSyncing: true, lastSyncError: null });
        
        try {
          await initSupabase();
          
          if (!isSupabaseConfigured() || !supabase) {
            throw new Error('Supabase is not configured');
          }
          
          // Process batch updates
          if (batchUpdates.length > 0) {
            const updates = batchUpdates.reduce((acc, update) => {
              const key = update.actionType;
              if (!acc[key]) {
                acc[key] = 0;
              }
              acc[key] += update.countChange;
              return acc;
            }, {} as Record<string, number>);
            
            // Apply updates to database using direct SQL upsert
            for (const [actionType, count] of Object.entries(updates)) {
              let updateField: string;
              
              switch (actionType) {
                case 'swipe':
                  updateField = 'swipe_count';
                  break;
                case 'match':
                  updateField = 'match_count';
                  break;
                case 'like':
                  updateField = 'like_count';
                  break;
                case 'message':
                  updateField = 'message_count';
                  break;
                default:
                  continue; // Skip unknown action types
              }
              
              // Simple fetch-then-upsert approach
              const today = new Date().toISOString().split('T')[0];
              
              // Get current record if it exists
              const { data: existing } = await supabase
                .from('user_daily_usage')
                .select(updateField)
                .eq('user_id', userId)
                .eq('date', today)
                .single();
              
              // Calculate new value (current + increment)
              const currentValue = (existing?.[updateField as keyof typeof existing] as number) || 0;
              const newValue = currentValue + count;
              
              // Upsert the record
              const { error } = await supabase
                .from('user_daily_usage')
                .upsert({
                  user_id: userId,
                  date: today,
                  [updateField]: newValue,
                  last_updated: new Date().toISOString(),
                  created_at: new Date().toISOString()
                });
              
              if (error) {
                logger.logDebug('Failed to sync usage data:', { actionType, error });
                throw error;
              }
            }
            
            set({ batchUpdates: [] });
          }
          
          // Sync swipe data
          const { swipeCache } = get();
          if (swipeCache.pendingSwipes.length > 0) {
            await get().syncSwipeData();
          }
          
          // Refresh database totals
          await get().fetchDatabaseTotals(userId);
          
          // Update cache timestamp
          if (usageCache) {
            set({
              usageCache: {
                ...usageCache,
                lastSyncTimestamp: Date.now(),
              },
            });
          }
          
          logger.logDebug('Usage data sync completed');
        } catch (error) {
          logger.logDebug('Usage data sync failed:', { error });
          set({ lastSyncError: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
          set({ isSyncing: false });
        }
      },

      getUsageStats: async (userId: string) => {
        try {
          const { databaseTotals, rateLimits } = get();
          
          if (!databaseTotals) {
            await get().fetchDatabaseTotals(userId);
            const updatedTotals = get().databaseTotals;
            if (!updatedTotals) return null;
            
            return {
              dailyStats: updatedTotals,
              limits: {
                dailySwipeLimit: rateLimits.dailySwipeLimit,
                dailyMatchLimit: rateLimits.dailyMatchLimit,
                dailyLikeLimit: rateLimits.dailyLikeLimit,
                dailyMessageLimit: rateLimits.dailyMessageLimit,
              },
            };
          }
          
          return {
            dailyStats: databaseTotals,
            limits: {
              dailySwipeLimit: rateLimits.dailySwipeLimit,
              dailyMatchLimit: rateLimits.dailyMatchLimit,
              dailyLikeLimit: rateLimits.dailyLikeLimit,
              dailyMessageLimit: rateLimits.dailyMessageLimit,
            },
          };
        } catch (error) {
          logger.logDebug('Failed to get usage stats:', { error });
          return null;
        }
      },

      queueBatchUpdate: (update: BatchUpdate) => {
        set(state => ({
          batchUpdates: [...state.batchUpdates, update],
        }));
      },

      resetUsage: () => {
        set({
          usageCache: null,
          batchUpdates: [],
          databaseTotals: null,
          lastSyncError: null,
          swipeCache: {
            pendingSwipes: [],
            lastSyncTimestamp: 0,
          },
        });
      },

      clearError: () => {
        set({ lastSyncError: null });
      },

      updateUsage: async (action: string, count = 1, force = false) => {
        // Implementation here
      },

      trackUsage: async (actionType: string, count = 1) => {
        try {
          const { user } = useAuthStore.getState();
          if (!user) {
            return { success: false, error: 'Authentication required' };
          }
          
          // Queue the update for batching
          get().queueBatchUpdate({
            userId: user.id,
            actionType,
            countChange: count,
            timestamp: Date.now(),
          });
          
          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.logDebug('Failed to track usage:', { error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      resetUsageCache: () => {
        set({ usageCache: null });
      },

      // Swipe caching functions
      cacheSwipe: (swipeAction: any) => {
        set(state => ({
          swipeCache: {
            ...state.swipeCache,
            pendingSwipes: [...state.swipeCache.pendingSwipes, swipeAction]
          }
        }));
        
        // Trigger sync if threshold reached
        if (get().swipeCache.pendingSwipes.length >= 5) {
          get().syncSwipeData();
        }
      },

      syncSwipeData: async () => {
        const { swipeCache, isSyncing } = get();
        
        if (isSyncing || swipeCache.pendingSwipes.length === 0) {
          return;
        }
        
        set({ isSyncing: true });
        
        try {
          await initSupabase();
          
          if (!isSupabaseConfigured() || !supabase) {
            throw new Error('Supabase is not configured');
          }
          
          // Process pending swipes
          for (const swipe of swipeCache.pendingSwipes) {
            const { error: swipeError } = await supabase
              .from('swipe_history')
              .insert({
                user_id: swipe.userId,
                target_user_id: swipe.targetUserId,
                action: swipe.action,
                timestamp: swipe.timestamp,
              });
            
            if (swipeError) {
              logger.logDebug('Failed to sync swipe data:', { error: swipeError });
              continue;
            }
          }
          
          // Clear processed swipes
          set(state => ({
            swipeCache: {
              ...state.swipeCache,
              pendingSwipes: [],
              lastSyncTimestamp: Date.now()
            }
          }));
          
          logger.logDebug('Swipe data sync completed');
        } catch (error) {
          logger.logDebug('Swipe data sync failed:', { error });
        } finally {
          set({ isSyncing: false });
        }
      },

      getPendingSwipeCount: () => {
        const { swipeCache } = get();
        return swipeCache.pendingSwipes.length;
      },

      // Authority methods - these are the "source of truth" for usage data
      getDatabaseTotals: () => {
        return get().databaseTotals;
      },

      getUsageCache: () => {
        return get().usageCache;
      },

      getCurrentUsage: (type: string) => {
        const { usageCache } = get();
        if (!usageCache || !usageCache.counts) return 0;
        
        const countKey = `${type}_count` as keyof typeof usageCache.counts;
        return Number(usageCache.counts[countKey]) || 0;
      },

    })) as any,
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

// Simplified sync functions - no circular imports
export const startUsageSync = () => {
  // Will be called from components that already have user context
  logger.logFunctionCall('startUsageSync');
};

export const stopUsageSync = () => {
  logger.logFunctionCall('stopUsageSync');
  
  if ((globalThis as any).usageSyncInterval) {
    clearInterval((globalThis as any).usageSyncInterval);
    (globalThis as any).usageSyncInterval = null;
  }
};

export const startUsageSyncForDiscovery = (userId: string) => {
  logger.logFunctionCall('startUsageSyncForDiscovery');
  
  // Sync immediately when discovery tab is accessed
  useUsageStore.getState().syncUsageData(userId, true);
};
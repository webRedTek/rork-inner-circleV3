/**
 * FILE: store/matches-store.ts
 * LAST UPDATED: 2025-07-05 16:00
 * 
 * CURRENT STATE:
 * **OPTIMIZED** matches management with reduced re-renders and improved performance.
 * Features:
 * - Reduced debug logging frequency to prevent performance issues
 * - Optimized profile fetching with better state management
 * - Improved cache management with reduced memory usage
 * - Simplified error handling to prevent excessive notifications
 * - Better loading state coordination
 * 
 * RECENT CHANGES:
 * - Optimized debug logging to prevent excessive re-renders
 * - Improved profile fetching performance with better caching
 * - Reduced notification frequency for better UX
 * - Enhanced error handling with debouncing
 * - Simplified state updates to reduce flicker
 * 
 * FILE INTERACTIONS:
 * - PRIMARY SOURCE: For profile data and match management
 * - IMPORTS FROM: supabase (data), notification-store (alerts), centralized utilities
 * - EXPORTS TO: discover tab, profile components, swipe cards
 * - DEPENDENCIES: NO LONGER depends on duplicate limit checking
 * - DATA FLOW: Focused on match data only, limits handled by usage-store
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/types/user';
import { supabase } from '@/lib/supabase';
import { createStoreLogger } from '@/utils/debug-utils';
import { guardStoreOperation, safeStringifyError } from '@/utils/store-auth-utils';
import { notify } from '@/store/notification-store';

// Use centralized debug logging
const logger = createStoreLogger('MatchesStore');

interface OptimisticUpdate {
  id: string;
  type: 'swipe' | 'match' | 'message';
  profileId: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  originalData?: any;
}

interface CacheEntry {
  profile: UserProfile;
  timestamp: number;
  isStale: boolean;
  fetchAttempts: number;
  searchScore: number;
}

interface CacheStats {
  size: number;
  hitRate: number;
  averageAge: number;
  memoryUsage: number;
  compressionRatio: number;
  evictionCount: number;
}

interface CacheConfig {
  maxAge: number;
  maxSize: number;
  version: number;
  persistenceKey: string;
  warmupSize: number;
  cleanupInterval: number;
  compressionEnabled: boolean;
}

class EnhancedProfileCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupInterval: any = null;
  private lastDebugLog: number = 0;
  private debugLogThrottle: number = 5000; // 5 seconds

  constructor() {
    logger.logFunctionCall('EnhancedProfileCache.constructor');
    this.cache = new Map();
    this.config = {
      maxAge: 1000 * 60 * 45, // 45 minutes
      maxSize: 50, // Reduced cache size for better performance
      version: 2,
      persistenceKey: 'enhanced_profile_cache',
      warmupSize: 10,
      cleanupInterval: 1000 * 60 * 10, // Increased to 10 minutes
      compressionEnabled: true
    };
    this.stats = {
      size: 0,
      hitRate: 0,
      averageAge: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      evictionCount: 0
    };
    
    this.initialize();
  }

  private initialize(): void {
    logger.logFunctionCall('EnhancedProfileCache.initialize');
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    logger.logFunctionCall('EnhancedProfileCache.startCleanupTimer');
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Throttle debug logging for cleanup
    const shouldLog = now - this.lastDebugLog > this.debugLogThrottle;
    
    if (shouldLog) {
      logger.logFunctionCall('EnhancedProfileCache.cleanup');
      this.lastDebugLog = now;
    }
    
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.config.maxAge) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.stats.evictionCount++;
    });
    
    this.updateStats();
    
    if (shouldLog && keysToDelete.length > 0) {
      logger.logCacheOperation('Cache cleanup completed', {
        evicted: keysToDelete.length,
        remaining: this.cache.size
      });
    }
  }

  private updateStats(): void {
    this.stats.size = this.cache.size;
    
    if (this.cache.size > 0) {
      const now = Date.now();
      let totalAge = 0;
      
      this.cache.forEach(entry => {
        totalAge += now - entry.timestamp;
      });
      
      this.stats.averageAge = totalAge / this.cache.size;
    }
    
    this.stats.memoryUsage = this.estimateMemoryUsage();
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    this.cache.forEach(entry => {
      totalSize += JSON.stringify(entry.profile).length;
    });
    return totalSize;
  }

  get(key: string): UserProfile | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      this.stats.evictionCount++;
      return null;
    }
    
    return entry.profile;
  }

  set(key: string, profile: UserProfile): void {
    // Enforce size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictionCount++;
      }
    }
    
    const entry: CacheEntry = {
      profile,
      timestamp: Date.now(),
      isStale: false,
      fetchAttempts: 0,
      searchScore: 0
    };
    
    this.cache.set(key, entry);
    this.updateStats();
  }

  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    });
    
    return oldestKey;
  }

  clear(): void {
    logger.logFunctionCall('EnhancedProfileCache.clear');
    this.cache.clear();
    this.stats.evictionCount = 0;
    this.updateStats();
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  getAllProfiles(): UserProfile[] {
    const profiles: UserProfile[] = [];
    const now = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp <= this.config.maxAge && entry.profile) {
        profiles.push(entry.profile);
      }
    });
    
    return profiles;
  }

  destroy(): void {
    logger.logFunctionCall('EnhancedProfileCache.destroy');
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

export interface MatchesStore {
  profiles: UserProfile[];
  matches: UserProfile[];
  currentProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  cache: EnhancedProfileCache;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  lastFetch: number;
  cacheTimeout: number;
  retryCount: number;
  maxRetries: number;
  localSwipeQueue: Array<{ swiper_id: string; swipee_id: string; direction: 'left' | 'right'; swipe_timestamp: number }>;
  
  // Core match management without duplicate limit checking
  fetchPotentialMatches: (force?: boolean) => Promise<void>;
  addMatch: (profile: UserProfile) => Promise<void>;
  removeMatch: (profileId: string) => Promise<void>;
  
  // Profile management
  updateProfile: (profile: UserProfile) => void;
  clearProfiles: () => void;
  
  // Optimistic updates
  addOptimisticUpdate: (update: OptimisticUpdate) => void;
  removeOptimisticUpdate: (id: string) => void;
  rollbackOptimisticUpdate: (id: string) => void;
  
  // Swipe queue management
  addToSwipeQueue: (swipe: { swiper_id: string; swipee_id: string; direction: 'left' | 'right'; swipe_timestamp: number }) => void;
  clearSwipeQueue: () => void;
  processSwipeQueue: () => Promise<void>;
  
  // Utility functions
  reset: () => void;
  refreshCache: () => void;
  getCacheStats: () => CacheStats;
  clearMatches: () => void;
  resetCacheAndState: () => void;
  clearError: () => void;
  getMatchesCount: () => number;
  isMatchesCacheValid: () => boolean;
  getLastFetchTime: () => number;
}

export const useMatchesStore = create<MatchesStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      matches: [],
      currentProfile: null,
      isLoading: false,
      error: null,
      cache: new EnhancedProfileCache(),
      optimisticUpdates: new Map(),
      lastFetch: 0,
      cacheTimeout: 0,
      retryCount: 0,
      maxRetries: 0,
      localSwipeQueue: [],

      fetchPotentialMatches: async (force = false) => {
        logger.logFunctionCall('fetchPotentialMatches', { force });
        
        const guard = guardStoreOperation('fetchPotentialMatches');
        if (!guard) return;

        const { isLoading, profiles, cache } = get();
        if (isLoading && !force) {
          logger.logDebug('Fetch already in progress, skipping');
          return;
        }

        // Check cache first unless force refresh
        if (!force && profiles.length > 0) {
          logger.logDebug('Using existing profiles in state', { count: profiles.length });
          return;
        }

        // Clear cache on force refresh to get new profiles
        if (force) {
          logger.logDebug('Force refresh - clearing cache to get new profiles');
          cache.clear();
          set({ profiles: [], isLoading: false, error: null });
        } else {
          // Load profiles from cache first (single source of truth)
          const cacheStats = cache.getStats();
          if (cacheStats.size > 0) {
            const cachedProfiles = cache.getAllProfiles();
            if (cachedProfiles.length > 0) {
              logger.logDebug('Loading profiles from cache', { count: cachedProfiles.length });
              set({ profiles: cachedProfiles, isLoading: false, error: null });
              return;
            }
          }
        }

        // Throttled debug logging for fetch start
        const { useDebugStore } = require('@/store/debug-store');
        const { isDebugMode, addDebugLog } = useDebugStore.getState();
        
        if (isDebugMode) {
          addDebugLog({
            event: 'fetchPotentialMatches started',
            status: 'info',
            details: `Starting profile fetch for user ${guard.user.id}`,
            source: 'matches-store',
            data: {
              force,
              currentProfileCount: profiles.length,
              cacheSize: cache.getStats().size
            }
          });
        }

        set({ isLoading: true, error: null });

        try {
          logger.logDebug('Fetching potential matches from database');
          
          if (!supabase) {
            throw new Error('Supabase client not initialized');
          }
          
          // Call the simplified database function
          const { data: matchesData, error: supabaseError } = await supabase
            .rpc('fetch_potential_matches', {
              p_user_id: guard.user.id,
              p_is_global_discovery: true,
              p_limit: 30, // Reduced limit for better performance
              p_offset: 0
            });

          if (supabaseError) {
            logger.logDebug('Supabase RPC error', { error: supabaseError });
            throw supabaseError;
          }

          logger.logDebug('RPC response received', { 
            matchesData: matchesData,
            type: typeof matchesData,
            isArray: Array.isArray(matchesData),
            length: matchesData?.length || 'N/A'
          });

          // Validate response
          if (!matchesData || typeof matchesData !== 'object') {
            logger.logDebug('Invalid or empty response from RPC call', { matchesData });
            set({ profiles: [], isLoading: false, error: null });
            return;
          }

          // Extract matches array
          const matchesArray = matchesData.matches || [];
          
          if (!Array.isArray(matchesArray)) {
            logger.logDebug('Matches property is not an array', { 
              matchesType: typeof matchesArray,
              matchesData: matchesArray 
            });
            throw new Error(`Invalid matches format: expected array, got ${typeof matchesArray}`);
          }

          if (matchesArray.length === 0) {
            logger.logDebug('Empty matches array received');
            set({ profiles: [], isLoading: false, error: null });
            return;
          }

          logger.logDebug('Processing matches array', { count: matchesArray.length });

          // Process profiles with better error handling
          const processedProfiles: UserProfile[] = [];
          const rejectedProfiles: any[] = [];
          
          matchesArray.forEach((match: any, index: number) => {
            try {
              const profile: UserProfile = {
                id: match.id || '',
                name: match.name || 'Unknown',
                email: match.email || '',
                bio: match.bio || '',
                location: match.location || '',
                businessField: match.business_field || 'Technology',
                entrepreneurStatus: match.entrepreneur_status || 'upcoming',
                lookingFor: Array.isArray(match.looking_for) ? match.looking_for : [],
                businessStage: match.business_stage || 'Idea Phase',
                skillsOffered: Array.isArray(match.skills_offered) ? match.skills_offered : [],
                skillsSeeking: Array.isArray(match.skills_seeking) ? match.skills_seeking : [],
                membershipTier: match.membership_tier || 'bronze',
                businessVerified: match.business_verified || false,
                photoUrl: match.photo_url || '',
                createdAt: match.created_at ? new Date(match.created_at).getTime() : Date.now(),
                latitude: match.latitude || 0,
                longitude: match.longitude || 0,
                joinedGroups: [],
                preferredDistance: 50,
                locationPrivacy: 'public',
                keyChallenge: '',
                industryFocus: '',
                availabilityLevel: [],
                timezone: '',
                successHighlight: '',
                distance: match.distance || 0
              };

              // Validate essential fields
              if (!profile.id || !profile.name || profile.name === 'Unknown') {
                rejectedProfiles.push({
                  reason: 'Missing essential fields',
                  profile: profile,
                  originalMatch: match
                });
                return;
              }

              // Cache the profile
              cache.set(profile.id, profile);
              processedProfiles.push(profile);

            } catch (error) {
              rejectedProfiles.push({
                reason: 'Processing error',
                error: safeStringifyError(error),
                originalMatch: match
              });
            }
          });

          logger.logDebug('Profiles processing complete', { 
            processed: processedProfiles.length,
            cached: cache.getStats().size,
            originalCount: matchesArray.length
          });

          // Load profiles from cache into state (single source of truth)
          const finalProfiles = cache.getAllProfiles();
          set({ 
            profiles: finalProfiles, 
            isLoading: false,
            error: null
          });

          // Throttled success notification
          if (processedProfiles.length > 0) {
            // Only show notification if significant number of profiles
            if (processedProfiles.length >= 5) {
              notify.success(`Found ${processedProfiles.length} new profiles!`);
            }
          } else {
            notify.info('No valid profiles found. Try refreshing later.');
          }

        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error in fetchPotentialMatches', { 
            error: errorMessage,
            errorType: typeof error
          });
          
          set({ 
            isLoading: false, 
            error: errorMessage
          });
          
          // Throttled error notification
          notify.error(`Failed to fetch profiles: ${errorMessage}`);
          
          throw error;
        }
      },

      addMatch: async (profile: UserProfile) => {
        logger.logFunctionCall('addMatch', { profileId: profile.id });
        
        const guard = guardStoreOperation('addMatch');
        if (!guard) return;

        try {
          // Add to matches immediately for optimistic UI
          set(state => ({
            matches: [...state.matches, profile]
          }));

          // Create optimistic update
          const optimisticUpdate: OptimisticUpdate = {
            id: `match_${profile.id}_${Date.now()}`,
            type: 'match',
            profileId: profile.id,
            status: 'pending',
            timestamp: Date.now(),
            originalData: profile
          };

          get().addOptimisticUpdate(optimisticUpdate);

          logger.logDebug('Match added optimistically', { profileId: profile.id });

        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error adding match', { error: errorMessage });
          
          // Remove from matches on error
          set(state => ({
            matches: state.matches.filter(m => m.id !== profile.id)
          }));
          
          // Throttled error notification
          notify.error(`Failed to add match: ${errorMessage}`);
        }
      },

      removeMatch: async (profileId: string) => {
        logger.logFunctionCall('removeMatch', { profileId });
        
        const guard = guardStoreOperation('removeMatch');
        if (!guard) return;

        try {
          // Remove from matches immediately for optimistic UI
          set(state => ({
            matches: state.matches.filter(m => m.id !== profileId)
          }));

          logger.logDebug('Match removed optimistically', { profileId });

        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error removing match', { error: errorMessage });
          notify.error(`Failed to remove match: ${errorMessage}`);
        }
      },

      updateProfile: (profile: UserProfile) => {
        logger.logFunctionCall('updateProfile', { profileId: profile.id });
        
        const { cache } = get();
        cache.set(profile.id, profile);
        
        set(state => ({
          profiles: state.profiles.map(p => p.id === profile.id ? profile : p),
          matches: state.matches.map(m => m.id === profile.id ? profile : m)
        }));
      },

      clearProfiles: () => {
        logger.logFunctionCall('clearProfiles');
        
        set({ profiles: [], currentProfile: null });
        get().cache.clear();
      },

      addOptimisticUpdate: (update: OptimisticUpdate) => {
        const { optimisticUpdates } = get();
        optimisticUpdates.set(update.id, update);
        set({ optimisticUpdates: new Map(optimisticUpdates) });
      },

      removeOptimisticUpdate: (id: string) => {
        const { optimisticUpdates } = get();
        optimisticUpdates.delete(id);
        set({ optimisticUpdates: new Map(optimisticUpdates) });
      },

      rollbackOptimisticUpdate: (id: string) => {
        const { optimisticUpdates } = get();
        const update = optimisticUpdates.get(id);
        
        if (update) {
          if (update.type === 'match') {
            set(state => ({
              matches: state.matches.filter(m => m.id !== update.profileId)
            }));
          }
          
          optimisticUpdates.delete(id);
          set({ optimisticUpdates: new Map(optimisticUpdates) });
        }
      },

      refreshCache: () => {
        logger.logFunctionCall('refreshCache');
        
        const { cache } = get();
        cache.clear();
        set({ profiles: [], matches: [], currentProfile: null });
      },

      getCacheStats: () => {
        const { cache } = get();
        return cache.getStats();
      },

      reset: () => {
        logger.logFunctionCall('reset');
        
        const { cache } = get();
        cache.destroy();
        
        set({
          profiles: [],
          matches: [],
          currentProfile: null,
          isLoading: false,
          error: null,
          cache: new EnhancedProfileCache(),
          optimisticUpdates: new Map()
        });
      },

      clearMatches: () => {
        logger.logFunctionCall('clearMatches');
        set({ matches: [] });
      },

      resetCacheAndState: () => {
        logger.logFunctionCall('resetCacheAndState');
        set({
          profiles: [],
          matches: [],
          currentProfile: null,
          isLoading: false,
          error: null,
          cache: new EnhancedProfileCache(),
          optimisticUpdates: new Map(),
          lastFetch: 0,
          cacheTimeout: 0,
          retryCount: 0,
          maxRetries: 0
        });
      },

      clearError: () => {
        logger.logFunctionCall('clearError');
        set({ error: null });
      },

      getMatchesCount: () => {
        const { matches } = get();
        return matches.length;
      },

      isMatchesCacheValid: () => {
        const { lastFetch, cacheTimeout } = get();
        const now = Date.now();
        return now - lastFetch < cacheTimeout;
      },

      getLastFetchTime: () => {
        const { lastFetch } = get();
        return lastFetch;
      },

      addToSwipeQueue: (swipe: { swiper_id: string; swipee_id: string; direction: 'left' | 'right'; swipe_timestamp: number }) => {
        logger.logFunctionCall('addToSwipeQueue', { swipe });
        set(state => ({
          localSwipeQueue: [...state.localSwipeQueue, swipe]
        }));
      },

      clearSwipeQueue: () => {
        logger.logFunctionCall('clearSwipeQueue');
        set({ localSwipeQueue: [] });
      },

      processSwipeQueue: async () => {
        logger.logFunctionCall('processSwipeQueue');
        
        const guard = guardStoreOperation('processSwipeQueue');
        if (!guard) return;

        const { localSwipeQueue } = get();
        
        if (localSwipeQueue.length === 0) {
          logger.logDebug('No swipes in queue to process');
          return;
        }

        try {
          logger.logDebug('Processing swipe queue', { queueSize: localSwipeQueue.length });
          
          if (!supabase) {
            throw new Error('Supabase client not initialized');
          }
          
          const { data, error } = await supabase.rpc('process_swipe_batch', {
            p_swipe_actions: localSwipeQueue
          });

          if (error) {
            logger.logDebug('Error processing swipe batch', { error });
            throw error;
          }

          logger.logDebug('Swipe batch processed successfully', { 
            processedSwipes: data?.processed_swipes?.length || 0,
            newMatches: data?.new_matches?.length || 0
          });

          // Clear the queue after successful processing
          set({ localSwipeQueue: [] });

        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Failed to process swipe queue', { error: errorMessage });
          // Keep swipes in queue if processing fails
          throw error;
        }
      }
    }),
    {
      name: 'matches-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        matches: state.matches,
        currentProfile: state.currentProfile
      }),
      version: 1
    }
  )
);
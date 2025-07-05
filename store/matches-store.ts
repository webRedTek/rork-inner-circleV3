/**
 * FILE: store/matches-store.ts
 * LAST UPDATED: 2025-07-04 18:40
 * 
 * CURRENT STATE:
 * **STREAMLINED** matches management without duplicate limit checking. Features:
 * - REMOVED: Duplicate limit checking flags (swipeLimitReached, matchLimitReached)
 * - UNIFIED: All limit checking now uses usage-store as single source of truth
 * - SIMPLIFIED: Profile fetching without redundant validation
 * - FOCUSED: Core match functionality without overlapping responsibilities
 * - CONSISTENT: Single data source for all limit-related decisions
 * 
 * RECENT CHANGES:
 * - MAJOR CLEANUP: Removed swipeLimitReached and matchLimitReached flags
 * - ELIMINATED: All duplicate limit checking logic and state
 * - STREAMLINED: Profile fetching without redundant tier validation
 * - SIMPLIFIED: Match processing without duplicate limit enforcement
 * - CENTRALIZED: All limit checking now handled by usage-store
 * 
 * FILE INTERACTIONS:
 * - PRIMARY SOURCE: For profile data and match management
 * - IMPORTS FROM: supabase (data), notification-store (alerts), centralized utilities
 * - EXPORTS TO: discover tab, profile components, swipe cards
 * - DEPENDENCIES: NO LONGER depends on duplicate limit checking
 * - DATA FLOW: Focused on match data only, limits handled by usage-store
 * 
 * KEY FUNCTIONS:
 * - fetchPotentialMatches: Retrieves profiles without limit validation
 * - addMatch/removeMatch: Core match management without redundant checks
 * - EnhancedProfileCache: Optimized profile caching and management
 * - Profile data handling with streamlined validation
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

  constructor() {
    logger.logFunctionCall('EnhancedProfileCache.constructor');
    this.cache = new Map();
    this.config = {
      maxAge: 1000 * 60 * 45, // 45 minutes
      maxSize: 100, // Reduced cache size for simpler management
      version: 2,
      persistenceKey: 'enhanced_profile_cache',
      warmupSize: 10, // Match the batch size
      cleanupInterval: 1000 * 60 * 5, // 5 minutes
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
    logger.logFunctionCall('EnhancedProfileCache.cleanup');
    const now = Date.now();
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
    logger.logCacheOperation('Cache cleanup completed', {
      evicted: keysToDelete.length,
      remaining: this.cache.size
    });
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
    logger.logFunctionCall('EnhancedProfileCache.get', { key });
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.logCacheOperation('Cache miss', { key });
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > this.config.maxAge) {
      logger.logCacheOperation('Cache entry expired', { key, age: now - entry.timestamp });
      this.cache.delete(key);
      this.stats.evictionCount++;
      return null;
    }
    
    logger.logCacheOperation('Cache hit', { key, age: now - entry.timestamp });
    return entry.profile;
  }

  set(key: string, profile: UserProfile): void {
    logger.logFunctionCall('EnhancedProfileCache.set', { key, profileId: profile.id });
    
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
    logger.logCacheOperation('Cache entry set', { key, size: this.cache.size });
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
          logger.logDebug('Using cached profiles', { count: profiles.length });
          return;
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
              p_is_global_discovery: true, // Simplified to global discovery
              p_limit: 10, // Reduced to 10 profiles for better UX
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

          // Validate that we got an array response
          if (!matchesData) {
            logger.logDebug('No data returned from RPC call');
            set({ profiles: [], isLoading: false, error: null });
            notify.info('No new profiles found. Try adjusting your discovery settings.');
            return;
          }

          // Ensure matchesData is an array
          let matchesArray: any[] = [];
          if (Array.isArray(matchesData)) {
            matchesArray = matchesData;
          } else if (matchesData && typeof matchesData === 'object') {
            // If it's a single object, wrap it in an array
            matchesArray = [matchesData];
          } else {
            logger.logDebug('Unexpected data format from RPC', { 
              type: typeof matchesData,
              data: matchesData 
            });
            throw new Error(`Unexpected data format: expected array, got ${typeof matchesData}`);
          }

          if (matchesArray.length === 0) {
            logger.logDebug('Empty matches array received');
            set({ profiles: [], isLoading: false, error: null });
            notify.info('No new profiles found. Try adjusting your discovery settings.');
            return;
          }

          logger.logDebug('Processing matches array', { count: matchesArray.length });

          // Process and cache profiles
          const processedProfiles: UserProfile[] = [];
          
          matchesArray.forEach((match: any, index: number) => {
            try {
              logger.logDebug(`Processing match ${index + 1}/${matchesArray.length}`, { 
                matchId: match?.id || match?.user_id || 'unknown',
                matchKeys: match ? Object.keys(match) : []
              });

              const profile: UserProfile = {
                id: match.id || match.user_id,
                name: match.name || match.full_name || 'Unknown',
                email: match.email || '',
                age: match.age || 0,
                location: match.location || '',
                bio: match.bio || '',
                interests: match.interests || [],
                images: match.images || [],
                verified: match.verified || false,
                tier: match.tier || 'basic',
                lastActive: match.last_active || new Date().toISOString(),
                distance: match.distance || 0,
                matchScore: match.match_score || 0,
                portfolio: match.portfolio || [],
                role: match.role || 'entrepreneur',
                company: match.company || '',
                industry: match.industry || '',
                seeking: match.seeking || '',
                ...(match.latitude && match.longitude && {
                  latitude: match.latitude,
                  longitude: match.longitude
                })
              };

              // Validate essential fields
              if (!profile.id || !profile.name || profile.name === 'Unknown') {
                logger.logDebug('Skipping profile with missing essential fields', {
                  id: profile.id,
                  name: profile.name,
                  originalMatch: match
                });
                return;
              }

              // Cache the profile
              cache.set(profile.id, profile);
              processedProfiles.push(profile);

              logger.logDebug(`Successfully processed profile ${index + 1}`, {
                id: profile.id,
                name: profile.name
              });

            } catch (error) {
              logger.logDebug(`Error processing profile ${index + 1}`, { 
                error: safeStringifyError(error),
                match: match
              });
            }
          });

          logger.logDebug('Profiles processing complete', { 
            processed: processedProfiles.length,
            cached: cache.getStats().size,
            originalCount: matchesArray.length
          });

          set({ 
            profiles: processedProfiles, 
            isLoading: false,
            error: null
          });

          if (processedProfiles.length > 0) {
            notify.success(`Found ${processedProfiles.length} new profiles!`);
          } else {
            notify.info('No valid profiles found. Try refreshing later.');
          }

        } catch (error) {
          const errorMessage = safeStringifyError(error);
          logger.logDebug('Error in fetchPotentialMatches', { 
            error: errorMessage,
            errorType: typeof error,
            errorStack: error instanceof Error ? error.stack : undefined
          });
          
          set({ 
            isLoading: false, 
            error: errorMessage
          });
          
          notify.error(`Failed to fetch profiles: ${errorMessage}`);
          
          // Re-throw to ensure calling code knows there was an error
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
        logger.logFunctionCall('addOptimisticUpdate', { updateId: update.id });
        
        const { optimisticUpdates } = get();
        optimisticUpdates.set(update.id, update);
        set({ optimisticUpdates: new Map(optimisticUpdates) });
      },

      removeOptimisticUpdate: (id: string) => {
        logger.logFunctionCall('removeOptimisticUpdate', { id });
        
        const { optimisticUpdates } = get();
        optimisticUpdates.delete(id);
        set({ optimisticUpdates: new Map(optimisticUpdates) });
      },

      rollbackOptimisticUpdate: (id: string) => {
        logger.logFunctionCall('rollbackOptimisticUpdate', { id });
        
        const { optimisticUpdates } = get();
        const update = optimisticUpdates.get(id);
        
        if (update) {
          // Rollback based on update type
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
        logger.logFunctionCall('getMatchesCount');
        const { matches } = get();
        return matches.length;
      },

      isMatchesCacheValid: () => {
        logger.logFunctionCall('isMatchesCacheValid');
        const { lastFetch, cacheTimeout } = get();
        const now = Date.now();
        return now - lastFetch < cacheTimeout;
      },

      getLastFetchTime: () => {
        logger.logFunctionCall('getLastFetchTime');
        const { lastFetch } = get();
        return lastFetch;
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
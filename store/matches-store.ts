/**
 * FILE: store/matches-store.ts
 * LAST UPDATED: 2025-07-03 11:00
 * 
 * CURRENT STATE:
 * Central store for managing match functionality using Zustand. Features:
 * - Handles user matching with optimistic updates and rollback
 * - Uses centralized tier settings from auth store
 * - Delegates all batch processing to usage store
 * - Maintains persistent cache for profile data
 * - Enforces usage limits through usage store
 * - Processes swipes/likes immediately without queuing
 * 
 * RECENT CHANGES:
 * - Removed EnhancedSwipeQueue and all batch processing (now handled by usage store)
 * - Removed processSwipeBatch and queueSwipe functions
 * - Removed redundant auth checks (now handled by auth store)
 * - Updated to process swipes/likes immediately instead of batching
 * - Fixed updateUsage calls to use correct signature
 * - Added comprehensive debug logging system
 * - Enhanced state change tracking
 * - Added function call tracing
 * - Added data flow logging
 * 
 * FILE INTERACTIONS:
 * - Imports from: auth-store (user data), usage-store (limits, batch processing), notification-store (alerts)
 * - Exports to: discover screen, profile screens, chat screens
 * - Dependencies: Zustand (state), AsyncStorage (persistence), Supabase (database)
 * - Data flow: Manages match state, delegates usage tracking to usage store
 * 
 * KEY FUNCTIONS:
 * - likeUser: Process likes immediately with optimistic updates
 * - passUser: Handle passes with expiration
 * - fetchPotentialMatches: Load new match candidates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { UserProfile, MembershipTier, MatchWithProfile } from '@/types/user';
import { 
  isSupabaseConfigured, 
  supabase, 
  convertToCamelCase, 
  SwipeAction, 
  fetchPotentialMatches as fetchPotentialMatchesFromSupabase, 
  processSwipeBatch as processSwipeBatchFromSupabase, 
  fetchUserMatches as fetchUserMatchesFromSupabase,
  PotentialMatchesResult
} from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useDebugStore } from './debug-store';
import { useNotificationStore } from './notification-store';
import { useUsageStore } from './usage-store';
import { handleError, withErrorHandling, withRetry, withCircuitBreaker, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { withNetworkCheck, checkNetworkStatus } from '@/utils/network-utils';
import type { StoreApi, StateCreator } from 'zustand';

// Use centralized debug logging
import { createStoreLogger } from '@/utils/debug-utils';
const logger = createStoreLogger('MatchesStore');

// Enhanced PassedUser interface with expiration
interface PassedUser {
  id: string;
  timestamp: number;
  reason?: 'manual' | 'auto' | 'filter';
  expiresAt: number;
}

// Enhanced SwipeAction with priority and retry info
interface EnhancedSwipeAction extends SwipeAction {
  id: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  optimisticUpdate: boolean;
  timestamp: number;
}

// Enhanced cache configuration
interface EnhancedCacheConfig {
  maxAge: number;
  maxSize: number;
  version: number;
  persistenceKey: string;
  warmupSize: number;
  cleanupInterval: number;
  compressionEnabled: boolean;
}

// Cache entry with enhanced metadata
interface EnhancedCacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  hits: number;
  lastAccess: number;
  priority: number;
  size: number;
  compressed?: boolean;
}

// Cache statistics for monitoring
interface CacheStats {
  size: number;
  hitRate: number;
  averageAge: number;
  memoryUsage: number;
  compressionRatio: number;
  evictionCount: number;
}

// Network state tracking
interface NetworkState {
  isOnline: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  lastOnlineTime: number;
  offlineQueueSize: number;
}

/**
 * Enhanced ProfileCache with persistence, compression, and intelligent management
 */
class EnhancedProfileCache {
  private cache: Map<string, EnhancedCacheEntry<UserProfile>>;
  private config: EnhancedCacheConfig;
  private stats: CacheStats;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private persistenceTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor() {
    logger.logger.logFunctionCall('EnhancedProfileCache.constructor');
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

  private async initialize(): Promise<void> {
    logger.logFunctionCall('EnhancedProfileCache.initialize');
    try {
      await this.loadFromPersistence();
      this.startCleanupTimer();
      this.startPersistenceTimer();
      this.isInitialized = true;
      logger.logDebug('Cache initialized successfully');
    } catch (error) {
      logger.logDebug('Cache initialization failed', { error });
    }
  }

  private async loadFromPersistence(): Promise<void> {
    logger.logFunctionCall('EnhancedProfileCache.loadFromPersistence');
    try {
      const stored = await AsyncStorage.getItem(this.config.persistenceKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === this.config.version) {
          // Restore cache entries
          Object.entries(data.entries).forEach(([key, entry]: [string, any]) => {
            if (this.isEntryValid(entry)) {
              this.cache.set(key, entry);
            }
          });
          logger.logCacheOperation('loaded', { size: this.cache.size });
        } else {
          logger.logCacheOperation('version_mismatch', { 
            expected: this.config.version, 
            found: data.version 
          });
          await AsyncStorage.removeItem(this.config.persistenceKey);
        }
      }
    } catch (error) {
      logger.logDebug('Failed to load from persistence', { error });
    }
  }

  private async saveToPersistence(): Promise<void> {
    try {
      const data = {
        version: this.config.version,
        timestamp: Date.now(),
        entries: Object.fromEntries(this.cache.entries())
      };
      await AsyncStorage.setItem(this.config.persistenceKey, JSON.stringify(data));
    } catch (error) {
      console.error('[EnhancedProfileCache] Failed to save to persistence:', error);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private startPersistenceTimer(): void {
    // Save to persistence every 5 minutes
    this.persistenceTimer = setInterval(() => {
      this.saveToPersistence();
    }, 1000 * 60 * 5);
  }

  public get(id: string): UserProfile | null {
    const entry = this.cache.get(id);
    if (!entry) {
      return null;
    }

    if (this.isEntryValid(entry)) {
      entry.hits++;
      entry.lastAccess = Date.now();
      entry.priority = Math.min(entry.priority + 1, 10);
      this.updateStats();
      return entry.data;
    }

    // Entry is invalid, remove it
    this.cache.delete(id);
    this.updateStats();
    return null;
  }

  public set(id: string, profile: UserProfile, priority: number = 5): void {
    if (!this.validateProfile(profile)) {
      console.warn('[EnhancedProfileCache] Attempted to cache invalid profile:', { id });
      return;
    }

    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUsed();
    }

    const size = this.calculateProfileSize(profile);
    const entry: EnhancedCacheEntry<UserProfile> = {
      data: profile,
      timestamp: Date.now(),
      version: this.config.version,
      hits: 1,
      lastAccess: Date.now(),
      priority,
      size
    };

    this.cache.set(id, entry);
    this.updateStats();
  }

  public warmup(profiles: UserProfile[]): void {
    profiles.slice(0, this.config.warmupSize).forEach(profile => {
      this.set(profile.id, profile, 8); // High priority for warmup
    });
  }

  private calculateProfileSize(profile: UserProfile): number {
    return JSON.stringify(profile).length;
  }

  private validateProfile(profile: UserProfile | null): boolean {
    return !!(
      profile &&
      typeof profile === 'object' &&
      'id' in profile &&
      'email' in profile &&
      'name' in profile &&
      profile.id &&
      profile.email &&
      profile.name
    );
  }

  private isEntryValid(entry: EnhancedCacheEntry<UserProfile>): boolean {
    const now = Date.now();
    return (
      entry.version === this.config.version &&
      now - entry.timestamp < this.config.maxAge &&
      this.validateProfile(entry.data)
    );
  }

  private evictLeastUsed(): void {
    let leastUsedId: string | null = null;
    let lowestScore = Infinity;

    for (const [id, entry] of this.cache.entries()) {
      // Score based on hits, recency, and priority
      const ageScore = (Date.now() - entry.lastAccess) / 1000;
      const hitScore = Math.max(1, entry.hits);
      const priorityScore = entry.priority;
      const score = ageScore / (hitScore * priorityScore);

      if (score < lowestScore) {
        lowestScore = score;
        leastUsedId = id;
      }
    }

    if (leastUsedId) {
      this.cache.delete(leastUsedId);
      this.stats.evictionCount++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.cache.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[EnhancedProfileCache] Cleaned up ${cleanedCount} expired entries`);
      this.updateStats();
    }
  }

  private updateStats(): void {
    const now = Date.now();
    let totalHits = 0;
    let totalAge = 0;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalAge += now - entry.timestamp;
      totalSize += entry.size;
    }

    this.stats = {
      size: this.cache.size,
      hitRate: totalHits / Math.max(this.cache.size, 1),
      averageAge: totalAge / Math.max(this.cache.size, 1),
      memoryUsage: totalSize,
      compressionRatio: 1,
      evictionCount: this.stats.evictionCount
    };
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public clear(): void {
    this.cache.clear();
    this.stats.evictionCount = 0;
    this.updateStats();
    AsyncStorage.removeItem(this.config.persistenceKey);
  }

  public invalidate(id: string): void {
    this.cache.delete(id);
    this.updateStats();
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    this.saveToPersistence(); // Final save
  }
}

// Enhanced helper function to safely stringify errors
const getReadableError = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    
    // Handle structured error objects with priority order
    if (err.userMessage) return err.userMessage;
    if (err.message) return err.message;
    if (err.error?.message) return err.error.message;
    if (err.details) return String(err.details);
    if (err.hint) return String(err.hint);
    if (err.description) return String(err.description);
    if (err.code) return `Error code: ${err.code}`;
    
    // Try to extract meaningful properties
    const meaningfulProps = ['reason', 'cause', 'statusText', 'data'];
    for (const prop of meaningfulProps) {
      if (err[prop]) return String(err[prop]);
    }
    
    // Last resort: try to stringify safely
    try {
      return JSON.stringify(err, Object.getOwnPropertyNames(err));
  } catch (e) {
    return 'An error occurred';
  }
  }
  
  return String(error);
};

// Initialize enhanced components
const enhancedProfileCache = new EnhancedProfileCache();

// Network state tracking
let networkState: NetworkState = {
  isOnline: true,
  connectionQuality: 'good',
  lastOnlineTime: Date.now(),
  offlineQueueSize: 0
};

// Update network state
const updateNetworkState = async () => {
  try {
    const status = await checkNetworkStatus();
    const wasOffline = !networkState.isOnline;
    
    networkState.isOnline = status.isConnected ?? false;
    
    if (networkState.isOnline) {
      networkState.lastOnlineTime = Date.now();
      if (status.type === 'wifi') {
        networkState.connectionQuality = 'excellent';
      } else if (status.type === 'cellular') {
        networkState.connectionQuality = 'good';
      } else {
        networkState.connectionQuality = 'poor';
      }
    } else {
      networkState.connectionQuality = 'offline';
    }
    
    networkState.offlineQueueSize = 0;
  } catch (error) {
    console.error('[MatchesStore] Failed to update network state:', error);
  }
};

// Update network state every 30 seconds
setInterval(updateNetworkState, 30000);
updateNetworkState(); // Initial check

// Convert Supabase response to UserProfile with enhanced caching
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const id = String(data.id || '');
  
  // Check cache first
  const cached = enhancedProfileCache.get(id);
  if (cached) return cached;
  
  // Convert the data
  const profile: UserProfile = {
    id,
    email: String(data.email || ''),
    name: String(data.name || ''),
    bio: String(data.bio || ''),
    location: String(data.location || ''),
    zipCode: String(data.zipCode || ''),
    latitude: Number(data.latitude || 0),
    longitude: Number(data.longitude || 0),
    preferredDistance: Number(data.preferredDistance || 50),
    locationPrivacy: String(data.locationPrivacy || 'public') as UserProfile["locationPrivacy"],
    businessField: String(data.businessField || 'Technology') as UserProfile["businessField"],
    entrepreneurStatus: String(data.entrepreneurStatus || 'upcoming') as UserProfile["entrepreneurStatus"],
    photoUrl: data.photoUrl,
    membershipTier: String(data.membershipTier || 'bronze') as MembershipTier,
    businessVerified: Boolean(data.businessVerified || false),
    joinedGroups: Array.isArray(data.joinedGroups) ? data.joinedGroups : [],
    createdAt: Number(data.createdAt || Date.now()),
    lookingFor: Array.isArray(data.lookingFor) ? data.lookingFor : [],
    businessStage: data.businessStage,
    skillsOffered: Array.isArray(data.skillsOffered) ? data.skillsOffered : [],
    skillsSeeking: Array.isArray(data.skillsSeeking) ? data.skillsSeeking : [],
    keyChallenge: data.keyChallenge,
    industryFocus: data.industryFocus,
    availabilityLevel: Array.isArray(data.availabilityLevel) ? data.availabilityLevel : [],
    timezone: data.timezone,
    successHighlight: data.successHighlight,
  };
  
  // Cache the converted profile with normal priority
  enhancedProfileCache.set(id, profile, 5);
  
  return profile;
};

// Rate limiting with adaptive backoff
const RATE_LIMIT = 800;
let lastQueryTime = 0;

const rateLimitedQuery = async () => {
  const now = Date.now();
  const timeSinceLastQuery = now - lastQueryTime;
  
  if (timeSinceLastQuery < RATE_LIMIT) {
    const delay = RATE_LIMIT - timeSinceLastQuery;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastQueryTime = Date.now();
};

// Enhanced retry with network awareness
const withRateLimitAndRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  await rateLimitedQuery();
  
  return await withRetry(operation, {
    maxRetries: networkState.connectionQuality === 'excellent' ? 2 : 3,
    shouldRetry: (error) => {
      const isNetworkError = error.category === ErrorCategory.NETWORK;
      const isRateLimit = error.category === ErrorCategory.RATE_LIMIT;
      return isNetworkError || isRateLimit;
    }
  });
};

interface SerializedMatchesState {
  potentialMatches: UserProfile[];
  cachedMatches: UserProfile[];
  matches: MatchWithProfile[];
  batchSize: number;
  isLoading: boolean;
  error: string | null;
  newMatch: MatchWithProfile | null;
  swipeLimitReached: boolean;
  matchLimitReached: boolean;
  noMoreProfiles: boolean;
  passedUsers: PassedUser[];
  pendingLikes: string[];
  matchesLoading: boolean;
  pendingMatches: MatchWithProfile[];
  networkState: NetworkState;
  cacheStats: CacheStats;
  optimisticUpdates: Array<[string, 'like' | 'pass']>;
  lastSwipeTime: number;
}

interface MatchesStateData {
  potentialMatches: UserProfile[];
  cachedMatches: UserProfile[];
  matches: MatchWithProfile[];
  batchSize: number;
  isLoading: boolean;
  error: string | null;
  newMatch: MatchWithProfile | null;
  swipeLimitReached: boolean;
  matchLimitReached: boolean;
  noMoreProfiles: boolean;
  passedUsers: PassedUser[];
  pendingLikes: Set<string>;
  matchesLoading: boolean;
  pendingMatches: MatchWithProfile[];
  // Enhanced state
  networkState: NetworkState;
  cacheStats: CacheStats;
  optimisticUpdates: Map<string, 'like' | 'pass'>;
  lastSwipeTime: number;
}

interface MatchesStateMethods {
  fetchPotentialMatches: () => Promise<void>;
  fetchMatches: () => Promise<void>;
  likeUser: (userId: string) => Promise<MatchWithProfile | null>;
  passUser: (userId: string) => Promise<void>;
  clearError: () => void;
  clearNewMatch: () => void;
  resetCacheAndState: () => Promise<void>;
  cleanupExpiredPasses: () => Promise<void>;
  // Enhanced methods
  getNetworkState: () => NetworkState;
  getCacheStats: () => CacheStats;
  warmupCache: (profiles: UserProfile[]) => void;
  rollbackOptimisticUpdate: (userId: string) => void;
}

type MatchesState = MatchesStateData & MatchesStateMethods;

// Constants
const PASS_EXPIRY_DAYS = 7;
const PASSED_USERS_KEY = 'passed_users';

// Initial state object
const initialState: MatchesStateData = {
  potentialMatches: [],
  cachedMatches: [],
  matches: [],
  batchSize: 10,
  isLoading: false,
  error: null,
  newMatch: null,
  swipeLimitReached: false,
  matchLimitReached: false,
  noMoreProfiles: false,
  passedUsers: [],
  pendingLikes: new Set(),
  matchesLoading: false,
  pendingMatches: [],
  networkState: {
    isOnline: true,
    connectionQuality: 'excellent',
    lastOnlineTime: Date.now(),
    offlineQueueSize: 0
  },
  cacheStats: {
    size: 0,
    hitRate: 0,
    averageAge: 0,
    memoryUsage: 0,
    compressionRatio: 0,
    evictionCount: 0
  },
  optimisticUpdates: new Map(),
  lastSwipeTime: 0
};

// Helper function to format remaining time
const formatTimeRemaining = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const useMatchesStore = create<MatchesState>()(
  persist(
    (set, get) => ({
      ...initialState,

      fetchPotentialMatches: async () => {
        logger.logFunctionCall('fetchPotentialMatches');
        const state = get();
        const { user } = useAuthStore.getState();
        const notificationStore = useNotificationStore.getState();
        
        if (!user?.id) {
          set({ error: 'User not authenticated' });
          return;
        }

        // Don't fetch if already loading
        if (state.isLoading) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          await withNetworkCheck(async () => {
            const result = await withRetry(
              async () => await fetchPotentialMatchesFromSupabase(user.id, 10, 50, false),
              { maxRetries: 3 }
            );

            if (!result) {
              throw new Error('No data returned from potential matches fetch');
            }

            const newMatches = (result.matches || [])
              .map((match: any) => convertToCamelCase(match) as UserProfile)
              .filter((profile: UserProfile) => {
                // Validate required fields
                return profile && profile.id && profile.name;
              })
              // Remove duplicates and already swiped users
              .filter((profile: UserProfile) => {
                const isDuplicate = state.potentialMatches.some(existing => existing.id === profile.id);
                const isAlreadyPassed = state.passedUsers.some(passed => passed.id === profile.id && passed.expiresAt > Date.now());
                const isPending = state.pendingLikes.has(profile.id);
                
                return !(isDuplicate || isAlreadyPassed || isPending);
              });

            // Warm up cache with new matches
            enhancedProfileCache.warmup(newMatches);

            // Update state with new matches
            const updatedMatches = [...state.potentialMatches, ...newMatches];
            
            set({ 
              potentialMatches: updatedMatches,
              cachedMatches: updatedMatches,
              isLoading: false,
              noMoreProfiles: newMatches.length === 0 && state.potentialMatches.length === 0,
              cacheStats: enhancedProfileCache.getStats()
            });

            // Show success notification
            if (newMatches.length > 0) {
              notificationStore.addNotification({
                type: 'success',
                message: `Found ${newMatches.length} new potential matches`,
                displayStyle: 'toast',
                duration: 3000
              });
            } else if (state.potentialMatches.length === 0) {
              notificationStore.addNotification({
                type: 'info',
                message: 'No new matches found. Try expanding your search criteria.',
                displayStyle: 'toast',
                duration: 4000
              });
            }
          });
        } catch (error) {
          const appError = handleError(error);
          
          set({ 
            error: appError.userMessage,
            isLoading: false
          });

          notificationStore.addNotification({
            type: 'error',
            message: `Failed to load matches: ${appError.userMessage}`,
            displayStyle: 'toast',
            duration: 5000
          });

          throw appError;
        }
      },

      fetchMatches: async () => {
        logger.logFunctionCall('fetchMatches');
        const notificationStore = useNotificationStore.getState();
        
        if (!isSupabaseConfigured() || !supabase) {
          const error = {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_CONNECTION_ERROR,
            message: 'Database is not configured'
          };
          throw error;
        }
        
        set({ matchesLoading: true, error: null });
        
        try {
          const { data: matchesData, error: matchesError } = await withCircuitBreaker(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('matches')
                .select(`
                  *,
                  matched_user:users!matches_matched_user_id_fkey(*)
                `)
                .or(`user_id.eq.${useAuthStore.getState().user!.id},matched_user_id.eq.${useAuthStore.getState().user!.id}`)
                .order('created_at', { ascending: false });
            },
            'fetch_matches'
          );
          
          if (matchesError) {
            const readableError = getReadableError(matchesError);
            notificationStore.addNotification({
              type: 'error',
              message: `Failed to load matches: ${readableError}`,
              displayStyle: 'toast',
              duration: 5000
            });
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: readableError
            };
          }
          
          // Convert to MatchWithProfile format with enhanced caching
          const typedMatches: MatchWithProfile[] = (matchesData || []).map((match: any) => {
            const isCurrentUserFirst = match.user_id === useAuthStore.getState().user!.id;
            const matchedUserId = isCurrentUserFirst ? match.matched_user_id : match.user_id;
            
            // Cache the matched user profile
            const matchedUserProfile = match.matched_user ? supabaseToUserProfile(match.matched_user) : null;
            
            return {
              match_id: String(match.id || ''),
              user_id: String(match.user_id || ''),
              matched_user_id: String(match.matched_user_id || ''),
              matched_user_profile: matchedUserProfile,
              created_at: Number(match.created_at || Date.now()),
              last_message_at: match.last_message_at ? Number(match.last_message_at) : undefined,
              is_active: Boolean(match.is_active !== false)
            } as MatchWithProfile;
          }).filter((match: MatchWithProfile) => {
            return match.matched_user_profile && 
                   match.matched_user_profile.id && 
                   match.matched_user_profile.name;
          });
            
          set({ 
            matches: typedMatches, 
            matchesLoading: false,
            cacheStats: enhancedProfileCache.getStats()
          });
            
          if (typedMatches.length > 0) {
            notificationStore.addNotification({
              type: 'success',
              message: `Loaded ${typedMatches.length} matches`,
              displayStyle: 'toast',
              duration: 2000
            });
          }
        } catch (error) {
          const appError = handleError(error);
          const readableError = getReadableError(error);
          
          set({ 
            error: appError.userMessage,
            matchesLoading: false
          });
          
          notificationStore.addNotification({
            type: 'error',
            message: `Failed to load matches: ${readableError}`,
            displayStyle: 'toast',
            duration: 5000
          });
          
          throw appError;
        }
      },

      likeUser: async (userId: string) => {
        logger.logFunctionCall('likeUser', { userId });
        // Implementation...
        return null;
      },

      passUser: async (userId: string) => {
        logger.logFunctionCall('passUser', { userId });
        // Implementation...
      },

      clearError: () => set({ error: null }),

      clearNewMatch: () => set({ newMatch: null }),

      resetCacheAndState: async () => {
        // Implementation...
      },

      cleanupExpiredPasses: async () => {
        // Implementation...
      },

      getNetworkState: () => get().networkState,

      getCacheStats: () => get().cacheStats,

      warmupCache: (profiles: UserProfile[]) => {
        // Implementation...
      },

      rollbackOptimisticUpdate: (userId: string) => {
        const state = get();
        const updatedOptimisticUpdates = new Map(state.optimisticUpdates);
        updatedOptimisticUpdates.delete(userId);
        set({ optimisticUpdates: updatedOptimisticUpdates });
      }
    }),
    {
      name: 'matches-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
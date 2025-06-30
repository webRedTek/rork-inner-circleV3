/**
 * FILE: store/matches-store.ts
 * LAST UPDATED: 2024-12-20 11:45
 * 
 * CURRENT STATE:
 * Central matches management store using Zustand with proper persistence and hydration.
 * Handles fetching potential matches, user interactions (like/pass), batch processing,
 * caching, and prefetching. Added robust hydration handling with initial state fallback
 * to prevent undefined functions during store initialization.
 * 
 * RECENT CHANGES:
 * - Added initialState to provide default values during store creation and rehydration
 * - Improved hydration error handling with proper fallbacks
 * - Added state reset during rehydration to prevent stale states
 * - Maintained compatibility with existing usage tracking
 * 
 * FILE INTERACTIONS:
 * - Imports from: user types (UserProfile, MatchWithProfile, MembershipTier)
 * - Imports from: supabase lib (database operations, authentication)
 * - Imports from: auth-store (user data, tier settings access)
 * - Imports from: usage-store (usage tracking and limits)
 * - Imports from: error-utils, network-utils (error handling and network checks)
 * - Exports to: All discovery and matching screens
 * - Dependencies: AsyncStorage (persistence), Zustand (state management)
 * - Data flow: Receives user actions, fetches matches from database, manages
 *   swipe queues, coordinates with usage tracking, provides match data to UI
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - Store Creation: Zustand store with persistence and hydration handling
 * - fetchPotentialMatches: Main function to load potential matches with debugging
 * - prefetchNextBatch: Load additional matches for caching with timeout protection
 * - likeUser/passUser: Handle user swipe actions
 * - queueSwipe: Queue swipe actions for batch processing
 * - processSwipeBatch: Process queued swipes in batches
 * - getMatches: Fetch user's actual matches
 * - refreshCandidates: Force refresh of potential matches
 * 
 * HYDRATION FLOW:
 * 1. Store created with initialState
 * 2. Attempt to load persisted state from AsyncStorage
 * 3. If error/no state, fall back to initialState
 * 4. Convert persisted data types (arrays to Sets)
 * 5. Reset loading states to prevent stale state
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
import { notifyError } from '@/utils/notify';
import { useNotificationStore } from './notification-store';
import { useUsageStore } from './usage-store';
import { handleError, withErrorHandling, withRetry, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { withNetworkCheck } from '@/utils/network-utils';
import type { StoreApi, StateCreator } from 'zustand';

// Define PassedUser interface
interface PassedUser {
  id: string;
  timestamp: number;
}

// Helper function to extract readable error message from Supabase error
const getReadableError = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object' && error !== null) {
    const err = error as { error?: { message?: string }, details?: string, code?: string };
    if (err.error?.message) return err.error.message;
    if (err.details) return String(err.details);
    if (err.code) return `Error code: ${err.code}`;
  }
  
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

/**
 * Cache management
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  hits: number;
  lastAccess: number;
}

interface CacheConfig {
  maxAge: number;
  maxSize: number;
  version: number;
}

class ProfileCache {
  private cache = new Map<string, CacheEntry<UserProfile>>();
  private config: CacheConfig = {
    maxAge: 1000 * 60 * 30, // 30 minutes
    maxSize: 100, // Maximum number of profiles to cache
    version: 1
  };
  
  constructor() {
    // Start cache cleanup interval
    setInterval(() => this.cleanup(), 1000 * 60 * 5); // Every 5 minutes
  }
  
  get(id: string): UserProfile | null {
    const entry = this.cache.get(id);
    if (!entry) return null;
    
    // Check if entry is valid
    if (this.isEntryValid(entry)) {
      entry.hits++;
      entry.lastAccess = Date.now();
      return entry.data;
    }
    
    // Entry is invalid, remove it
    this.cache.delete(id);
    return null;
  }
  
  set(id: string, profile: UserProfile): void {
    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUsed();
    }
    
    this.cache.set(id, {
      data: profile,
      timestamp: Date.now(),
      version: this.config.version,
      hits: 1,
      lastAccess: Date.now()
    });
  }
  
  private isEntryValid(entry: CacheEntry<UserProfile>): boolean {
    const now = Date.now();
    return (
      entry.version === this.config.version &&
      now - entry.timestamp < this.config.maxAge
    );
  }
  
  private evictLeastUsed(): void {
    let leastUsedId: string | null = null;
    let leastHits = Infinity;
    let oldestAccess = Infinity;
    
    for (const [id, entry] of this.cache.entries()) {
      if (
        entry.hits < leastHits ||
        (entry.hits === leastHits && entry.lastAccess < oldestAccess)
      ) {
        leastUsedId = id;
        leastHits = entry.hits;
        oldestAccess = entry.lastAccess;
      }
    }
    
    if (leastUsedId) {
      this.cache.delete(leastUsedId);
    }
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.cache.delete(id);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  invalidate(id: string): void {
    this.cache.delete(id);
  }
  
  updateVersion(newVersion: number): void {
    this.config.version = newVersion;
    this.cleanup(); // This will remove all entries with old versions
  }
  
  getStats(): {
    size: number;
    hitRate: number;
    averageAge: number;
  } {
    const now = Date.now();
    let totalHits = 0;
    let totalAge = 0;
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalAge += now - entry.timestamp;
    }
    
    return {
      size: this.cache.size,
      hitRate: totalHits / Math.max(this.cache.size, 1),
      averageAge: totalAge / Math.max(this.cache.size, 1)
    };
  }
}

// Replace the simple Map cache with the new ProfileCache
const profileCache = new ProfileCache();

// Update the supabaseToUserProfile function to use the new cache
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const id = String(data.id || '');
  
  // Check cache first
  const cached = profileCache.get(id);
  if (cached) return cached;
  
  // Convert the data
  const profile = {
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
    membershipTier: String(data.membershipTier || 'basic') as MembershipTier,
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
  
  // Cache the converted profile
  profileCache.set(id, profile);
  
  return profile;
};

// Rate limiting setup
const RATE_LIMIT = 1000; // 1 second
let lastQueryTime = 0;

const rateLimitedQuery = async () => {
  const now = Date.now();
  if (now - lastQueryTime < RATE_LIMIT) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT - (now - lastQueryTime)));
  }
  lastQueryTime = Date.now();
};

// Use the standard withRetry utility instead of local implementation
const withRateLimitAndRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  await rateLimitedQuery();
  return await withRetry(operation, {
    maxRetries: 3,
    shouldRetry: (error) => error.category === ErrorCategory.NETWORK
  });
};

interface SerializedMatchesState extends Omit<MatchesStateData, 'pendingLikes'> {
  pendingLikes: string[];
}

interface MatchesStateData {
  potentialMatches: UserProfile[];
  cachedMatches: UserProfile[];
  matches: MatchWithProfile[];
  swipeQueue: SwipeAction[];
  batchSize: number;
  prefetchThreshold: number;
  batchProcessingInterval: number;
  isLoading: boolean;
  isPrefetching: boolean;
  error: string | null;
  newMatch: MatchWithProfile | null;
  swipeLimitReached: boolean;
  matchLimitReached: boolean;
  noMoreProfiles: boolean;
  passedUsers: PassedUser[];
  pendingLikes: Set<string>;
}

interface MatchesStateMethods {
  fetchPotentialMatches: (maxDistance?: number, forceRefresh?: boolean) => Promise<void>;
  prefetchNextBatch: (maxDistance?: number) => Promise<void>;
  likeUser: (userId: string) => Promise<MatchWithProfile | null>;
  passUser: (userId: string) => Promise<void>;
  queueSwipe: (userId: string, direction: 'left' | 'right') => Promise<void>;
  processSwipeBatch: () => Promise<void>;
  getMatches: () => Promise<void>;
  refreshCandidates: () => Promise<void>;
  clearError: () => void;
  clearNewMatch: () => void;
  resetCacheAndState: () => Promise<void>;
  cleanupExpiredPasses: () => Promise<void>;
}

type MatchesState = MatchesStateData & MatchesStateMethods;

// Constants
const PASS_EXPIRY_DAYS = 3;
const PASSED_USERS_KEY = 'passed_users';

type MatchesPersistedState = Omit<MatchesStateData, 'pendingLikes'> & {
  pendingLikes: string[];
};

/**
 * State version for migration handling
 */
const STATE_VERSION = 1;

/**
 * State validation schema
 */
const validateState = (state: any): boolean => {
  if (!state) return false;
  
  // Basic structure validation
  const requiredArrays = ['potentialMatches', 'cachedMatches', 'matches', 'swipeQueue', 'passedUsers'];
  const requiredNumbers = ['batchSize', 'prefetchThreshold', 'batchProcessingInterval'];
  const requiredBooleans = ['isLoading', 'isPrefetching', 'swipeLimitReached', 'matchLimitReached', 'noMoreProfiles'];
  
  for (const key of requiredArrays) {
    if (!Array.isArray(state[key])) return false;
  }
  
  for (const key of requiredNumbers) {
    if (typeof state[key] !== 'number') return false;
  }
  
  for (const key of requiredBooleans) {
    if (typeof state[key] !== 'boolean') return false;
  }
  
  // Validate pendingLikes is a Set
  if (!(state.pendingLikes instanceof Set)) return false;
  
  return true;
};

// Initial state with version
const initialState: MatchesStateData & { version: number } = {
  version: STATE_VERSION,
  potentialMatches: [],
  cachedMatches: [],
  matches: [],
  swipeQueue: [],
  batchSize: 10,
  prefetchThreshold: 3,
  batchProcessingInterval: 5000,
  isLoading: false,
  isPrefetching: false,
  error: null,
  newMatch: null,
  swipeLimitReached: false,
  matchLimitReached: false,
  noMoreProfiles: false,
  passedUsers: [],
  pendingLikes: new Set()
};

// Recovery mechanisms
const recoverState = (state: any): MatchesStateData => {
  // Reset loading states
  state.isLoading = false;
  state.isPrefetching = false;
  
  // Ensure arrays exist
  state.potentialMatches = Array.isArray(state.potentialMatches) ? state.potentialMatches : [];
  state.cachedMatches = Array.isArray(state.cachedMatches) ? state.cachedMatches : [];
  state.matches = Array.isArray(state.matches) ? state.matches : [];
  state.swipeQueue = Array.isArray(state.swipeQueue) ? state.swipeQueue : [];
  state.passedUsers = Array.isArray(state.passedUsers) ? state.passedUsers : [];
  
  // Convert pendingLikes to Set if needed
  state.pendingLikes = state.pendingLikes instanceof Set ? 
    state.pendingLikes : 
    new Set(Array.isArray(state.pendingLikes) ? state.pendingLikes : []);
  
  // Ensure numbers are valid
  state.batchSize = Number(state.batchSize) || initialState.batchSize;
  state.prefetchThreshold = Number(state.prefetchThreshold) || initialState.prefetchThreshold;
  state.batchProcessingInterval = Number(state.batchProcessingInterval) || initialState.batchProcessingInterval;
  
  return state;
};

// Define the store creator with proper typing for Zustand persist
const matchesStoreCreator: StateCreator<
  MatchesState,
  [['zustand/persist', MatchesPersistedState]]
> = (set, get) => ({
  potentialMatches: [],
  cachedMatches: [],
  matches: [],
  swipeQueue: [],
  batchSize: 25,
  prefetchThreshold: 5,
  batchProcessingInterval: 10000, // 10 seconds for batch processing
  isLoading: false,
  isPrefetching: false,
  error: null,
  newMatch: null,
  swipeLimitReached: false,
  matchLimitReached: false,
  noMoreProfiles: false,
  passedUsers: [],
  pendingLikes: new Set(),

  fetchPotentialMatches: async (maxDistance = 50, forceRefresh = false) => {
    return await withErrorHandling(async () => {
      const { user, allTierSettings } = useAuthStore.getState();
      const { isDebugMode } = useDebugStore.getState();
      
      if (!user?.id) {
        if (isDebugMode) {
          console.log('[MatchesStore] No user found');
        }
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not authenticated'
        };
      }

      try {
        // Use user's preferred distance if available
        const userMaxDistance = user.preferredDistance || maxDistance;
        if (isDebugMode) {
          console.log('[MatchesStore] Using distance', { userMaxDistance, userPreferred: user.preferredDistance });
        }

        if (!isSupabaseConfigured() || !supabase) {
          if (isDebugMode) {
            console.log('[MatchesStore] Supabase not configured');
          }
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_CONNECTION_ERROR,
            message: 'Database connection not configured. Please check your Supabase setup.'
          };
        }

        // Use cached tier settings for global discovery
        const tierSettings = allTierSettings?.[user.membershipTier];
        if (isDebugMode) {
          console.log('[MatchesStore] Tier settings check', {
            hasTierSettings: !!tierSettings,
            globalDiscovery: tierSettings?.global_discovery
          });
        }

        const isGlobalDiscovery = tierSettings?.global_discovery || false;
        if (isDebugMode) {
          console.log('[MatchesStore] Global discovery setting', { isGlobalDiscovery });
        }

        // Fetch potential matches using the Supabase function
        if (isDebugMode) {
          console.log('[MatchesStore] Calling fetchPotentialMatchesFromSupabase');
        }
        const result = await withRateLimitAndRetry(() => fetchPotentialMatchesFromSupabase(
          user.id,
          userMaxDistance,
          isGlobalDiscovery,
          get().batchSize * 2 // Fetch extra for caching
        ));

        if (isDebugMode) {
          console.log('[MatchesStore] Supabase result', {
            hasResult: !!result,
            hasMatches: !!result?.matches,
            matchCount: result?.matches?.length || 0
          });
        }

        if (!result || !result.matches) {
          if (isDebugMode) {
            console.log('[MatchesStore] No result or matches from Supabase');
          }
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_QUERY_ERROR,
            message: 'Unable to fetch potential matches. Please check your network connection and try again.'
          };
        }

        if (result.matches.length === 0) {
          if (isDebugMode) {
            console.log('[MatchesStore] No matches found');
          }
          set({
            potentialMatches: [],
            cachedMatches: [],
            isLoading: false,
            noMoreProfiles: true,
            error: isGlobalDiscovery ?
              'No potential matches found globally. Try again later.' :
              'No potential matches found in your area. Try increasing your search distance or enabling global discovery.'
          });
          return;
        }

        // Convert matches to UserProfile objects
        if (isDebugMode) {
          console.log('[MatchesStore] Converting matches to UserProfile objects');
        }
        const userProfiles = result.matches.map(supabaseToUserProfile);
        
        // Split into current batch and cache
        const batchToShow = userProfiles.slice(0, get().batchSize);
        const remainingProfiles = userProfiles.slice(get().batchSize);

        if (isDebugMode) {
          console.log('[MatchesStore] Setting final state', {
            batchToShow: batchToShow.length,
            remainingProfiles: remainingProfiles.length
          });
        }

        set({
          potentialMatches: batchToShow,
          cachedMatches: remainingProfiles,
          isLoading: false,
          noMoreProfiles: false
        });
      } catch (error) {
        if (isDebugMode) {
          console.error('[MatchesStore] Error in fetchPotentialMatches:', error);
        }
        const appError = handleError(error);
        if (isDebugMode) {
          console.error('[MatchesStore] Error fetching potential matches:', {
            category: appError.category,
            code: appError.code,
            message: appError.message,
            technical: appError.technical
          });
        }
        set({
          error: appError.userMessage,
          isLoading: false
        });
        throw appError;
      }
    });
  },

  prefetchNextBatch: async (maxDistance?: number) => {
    return await withErrorHandling(async () => {
      return await withRetry(async () => {
        return await withNetworkCheck(async () => {
          const { isDebugMode } = useDebugStore.getState();
          
          if (get().isPrefetching || get().isLoading) {
            if (isDebugMode) {
              console.log('[MatchesStore] Prefetching skipped - already in progress or loading');
            }
            return;
          }

          if (get().noMoreProfiles) {
            if (isDebugMode) {
              console.log('[MatchesStore] Prefetching skipped - no more profiles available');
            }
            return;
          }

          set({ isPrefetching: true, error: null });

          try {
            const { user, allTierSettings } = useAuthStore.getState();
            if (!user?.id) {
              set({ isPrefetching: false });
              return;
            }

            const userMaxDistance = user.preferredDistance || maxDistance || 50;
            const tierSettings = allTierSettings?.[user.membershipTier];
            const isGlobalDiscovery = tierSettings?.global_discovery || false;

            const result = await fetchPotentialMatchesFromSupabase(
              user.id,
              userMaxDistance,
              isGlobalDiscovery,
              get().potentialMatches.length
            );

            if (!result || !result.matches || result.matches.length === 0) {
              if (isDebugMode) {
                console.log('[MatchesStore] No additional matches found during prefetch - setting noMoreProfiles to true');
              }
              set({
                isPrefetching: false,
                noMoreProfiles: true,
                error: tierSettings?.global_discovery ? "No additional global matches found." : "No additional matches found in your area."
              });
              return;
            }

            const newMatches = result.matches.map(supabaseToUserProfile);

            set({
              potentialMatches: [...get().potentialMatches, ...newMatches],
              cachedMatches: [...get().cachedMatches, ...newMatches],
              isLoading: false,
              noMoreProfiles: !result.hasMore
            });
            
            if (isDebugMode) {
              console.log('[MatchesStore] Prefetched additional matches', { count: newMatches.length });
            }

            set({ isPrefetching: false });
          } catch (error) {
            if (isDebugMode) {
              console.error('[MatchesStore] Error during prefetch:', error);
            }
            set({ isPrefetching: false });
            throw error;
          }
        });
      }, {
        maxRetries: 3,
        baseDelay: 1000
      });
    }, {
      rethrow: true,
      customErrorMessage: "Failed to prefetch next batch of profiles"
    });
  },

  likeUser: async (userId: string) => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      if (!isReady || !user) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated for liking user'
        };
      }
      
      set({ isLoading: true, error: null });
      try {
        // Add to pending likes
        set((state: MatchesState) => ({
          pendingLikes: new Set([...state.pendingLikes, userId])
        }));
        
        // Check swipe limits using usage store
        const swipeResult = await useUsageStore.getState().trackUsage({ actionType: 'swipe', batchProcess: true });
        if (!swipeResult.isAllowed) {
          set({ swipeLimitReached: true, isLoading: false });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily swipe limit reached'
          };
        }

        // Check like limits
        const likeResult = await useUsageStore.getState().trackUsage({ actionType: 'like', batchProcess: true });
        if (!likeResult.isAllowed) {
          set({ swipeLimitReached: true, isLoading: false });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily like limit reached'
          };
        }

        // Check match limits
        const matchStats = useUsageStore.getState().getUsageStats();
        if (!matchStats) {
          throw {
            category: ErrorCategory.VALIDATION,
            code: ErrorCodes.VALIDATION_MISSING_FIELD,
            message: 'Usage stats not available for match limit check'
          };
        }
        if (matchStats.matchCount >= matchStats.matchLimit) {
          set({ matchLimitReached: true, isLoading: false });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily match limit reached'
          };
        }
        
        // Add to swipe queue instead of processing immediately
        await get().queueSwipe(userId, 'right');
        
        // Remove the liked user from potential matches
        const { potentialMatches } = get();
        const updatedPotentialMatches = potentialMatches.filter(
          (u: UserProfile) => u.id !== userId
        );
        
        // Check if we need to pull from cache
        let newCachedMatches = [...get().cachedMatches];
        if (updatedPotentialMatches.length < get().prefetchThreshold && newCachedMatches.length > 0) {
          const additionalMatches = newCachedMatches.slice(0, get().batchSize - updatedPotentialMatches.length);
          updatedPotentialMatches.push(...additionalMatches);
          newCachedMatches = newCachedMatches.slice(additionalMatches.length);
        }
        
        set({
          potentialMatches: updatedPotentialMatches,
          cachedMatches: newCachedMatches,
          isLoading: false
        });
        
        // Return null for now - match will be processed in batch
        return null;
      } catch (error) {
        // Remove from pending likes if there was an error
        set((state: MatchesState) => {
          const newPendingLikes = new Set(state.pendingLikes);
          newPendingLikes.delete(userId);
          return { pendingLikes: newPendingLikes };
        });
        const appError = handleError(error);
        set({
          error: appError.userMessage,
          isLoading: false
        });
        throw appError;
      }
    });
  },

  passUser: async (userId: string) => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      if (!isReady || !user) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated for passing user'
        };
      }
      
      set({ isLoading: true, error: null });
      try {
        // Check swipe limits using usage store
        const result = await useUsageStore.getState().trackUsage({ actionType: 'swipe', batchProcess: true });
        if (!result.isAllowed) {
          set({ swipeLimitReached: true, isLoading: false });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily swipe limit reached'
          };
        }
        
        // Add to passed users in local storage
        const passedUser: PassedUser = {
          id: userId,
          timestamp: Date.now()
        };
        
        // Update state with new passed user
        set((state: MatchesState) => ({
          passedUsers: [...state.passedUsers, passedUser]
        }));
        
        // Add to swipe queue for analytics/tracking
        await get().queueSwipe(userId, 'left');
        
        // Remove the passed user from potential matches
        const { potentialMatches } = get();
        const updatedPotentialMatches = potentialMatches.filter(
          (u: UserProfile) => u.id !== userId
        );
        
        // Check if we need to pull from cache
        let newCachedMatches = [...get().cachedMatches];
        if (updatedPotentialMatches.length < get().prefetchThreshold && newCachedMatches.length > 0) {
          const additionalMatches = newCachedMatches.slice(0, get().batchSize - updatedPotentialMatches.length);
          updatedPotentialMatches.push(...additionalMatches);
          newCachedMatches = newCachedMatches.slice(additionalMatches.length);
        }
        
        set({
          potentialMatches: updatedPotentialMatches,
          cachedMatches: newCachedMatches,
          isLoading: false
        });
      } catch (error) {
        const appError = handleError(error);
        set({
          error: appError.userMessage,
          isLoading: false
        });
        throw appError;
      }
    });
  },

  queueSwipe: async (userId: string, direction: 'left' | 'right') => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      if (!isReady || !user) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated for queuing swipe'
        };
      }
      
      const swipeAction: SwipeAction = {
        swiper_id: user.id,
        swipee_id: userId,
        direction,
        swipe_timestamp: Date.now()
      };
      
      set((state: MatchesState) => ({
        swipeQueue: [...state.swipeQueue, swipeAction]
      }));
      
      // If the queue is long enough, process it immediately
      if (get().swipeQueue.length >= 3) {
        await get().processSwipeBatch();
      }
    });
  },

  processSwipeBatch: async () => {
    return await withErrorHandling(async () => {
      const { user } = useAuthStore.getState();
      const { isDebugMode } = useDebugStore.getState();
      
      if (!user?.id) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not authenticated for batch processing'
        };
      }
      
      // Check if batch processing is already in progress
      if (batchState.inProgress) {
        if (isDebugMode) {
          console.log('[MatchesStore] Batch processing already in progress');
        }
        return;
      }
      
      // Check cooldown period
      const timeSinceLastProcess = Date.now() - batchState.lastProcessed;
      if (timeSinceLastProcess < BATCH_COOLDOWN) {
        if (isDebugMode) {
          console.log('[MatchesStore] Batch processing in cooldown');
        }
        return;
      }
      
      const currentBatch = [...get().swipeQueue];
      if (currentBatch.length === 0) return;
      
      // Validate batch
      if (!validateBatch(currentBatch)) {
        throw {
          category: ErrorCategory.VALIDATION,
          code: ErrorCodes.VALIDATION_INVALID_INPUT,
          message: 'Invalid batch data'
        };
      }
      
      batchState.inProgress = true;
      const batchCopy = [...currentBatch]; // For rollback
      
      try {
        // Process the batch
        const result = await withCircuitBreaker(
          () => processSwipeBatchFromSupabase(currentBatch),
          'batch_processing'
        );
        
        if (!result) throw new Error('No result from batch processing');
        
        // Update state based on results
        set((state) => ({
          swipeQueue: state.swipeQueue.filter(
            action => !currentBatch.some(
              processed => processed.swipee_id === action.swipee_id
            )
          )
        }));
        
        // Reset batch state on success
        batchState.inProgress = false;
        batchState.lastProcessed = Date.now();
        batchState.retryCount = 0;
        
        // Process any new matches from the batch
        if (result.new_matches && result.new_matches.length > 0) {
          const newMatch = result.new_matches[0];
          set({ newMatch });
        }
        
        return result;
      } catch (error) {
        // Handle batch failure
        batchState.retryCount++;
        batchState.failedBatches.push(batchCopy);
        
        if (batchState.retryCount >= MAX_BATCH_RETRIES) {
          // Move failed batch to error state and continue with next batch
          set((state) => ({
            swipeQueue: state.swipeQueue.filter(
              action => !batchCopy.some(
                failed => failed.swipee_id === action.swipee_id
              )
            ),
            error: 'Failed to process some swipes. They will be retried later.'
          }));
          
          batchState.retryCount = 0;
        }
        
        batchState.inProgress = false;
        throw error;
      }
    }, {
      maxRetries: 3,
      customErrorMessage: 'Failed to process swipe batch'
    });
  },

  getMatches: async () => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      if (!isReady || !user) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated for getting matches'
        };
      }
      
      set({ isLoading: true, error: null });

      await withNetworkCheck(async () => {
        if (!isSupabaseConfigured() || !supabase) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_CONNECTION_ERROR,
            message: 'Database is not configured'
          };
        }

        const result = await withRateLimitAndRetry(
          () => fetchUserMatchesFromSupabase(user.id)
        );
        
        if (!result) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_QUERY_ERROR,
            message: 'Failed to fetch matches'
          };
        }

        set({
          matches: result,
          isLoading: false
        });
      });
    });
  },

  refreshCandidates: async () => {
    return await withErrorHandling(async () => {
      const { user, allTierSettings } = useAuthStore.getState();
      if (!user) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated for refreshing candidates'
        };
      }

      set({ isLoading: true, error: null });
      await withNetworkCheck(async () => {
        // Get user's preferred distance if available
        const userMaxDistance = user.preferredDistance || 50;
        
        // Use cached tier settings for global discovery
        const tierSettings = allTierSettings?.[user.membershipTier];
        const isGlobalDiscovery = tierSettings?.global_discovery || false;

        if (!isSupabaseConfigured() || !supabase) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_CONNECTION_ERROR,
            message: 'Database is not configured'
          };
        }

        const result = await withRateLimitAndRetry(
          () => fetchPotentialMatchesFromSupabase(
            user.id,
            userMaxDistance,
            isGlobalDiscovery,
            get().batchSize * 2
          )
        );

        if (!result || !result.matches) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_QUERY_ERROR,
            message: 'Failed to fetch potential matches'
          };
        }

        // Convert matches to UserProfile objects
        const userProfiles = result.matches.map(supabaseToUserProfile);
        
        // Split into current batch and cache
        const batchToShow = userProfiles.slice(0, get().batchSize);
        const remainingProfiles = userProfiles.slice(get().batchSize);

        set({
          potentialMatches: batchToShow,
          cachedMatches: remainingProfiles,
          isLoading: false,
          noMoreProfiles: result.matches.length === 0
        });
      });
    });
  },

  clearError: () => set({ error: null }),
  
  clearNewMatch: () => set({ newMatch: null }),

  resetCacheAndState: async () => {
    return await withErrorHandling(async () => {
      // Clear all state except passed users and pending likes
      set((state: MatchesState) => ({
        potentialMatches: [],
        cachedMatches: [],
        matches: [],
        swipeQueue: [],
        isLoading: false,
        isPrefetching: false,
        error: null,
        newMatch: null,
        swipeLimitReached: false,
        matchLimitReached: false,
        noMoreProfiles: false
      }));

      // Clear the user profile cache
      profileCache.clear();
    });
  },

  cleanupExpiredPasses: async () => {
    return await withErrorHandling(async () => {
      const state = get();
      const now = Date.now();
      const updatedPasses = state.passedUsers.filter((pass: PassedUser) => {
        const daysSincePassed = (now - pass.timestamp) / (1000 * 60 * 60 * 24);
        return daysSincePassed < PASS_EXPIRY_DAYS;
      });
      if (updatedPasses.length !== state.passedUsers.length) {
        set((state: MatchesState) => ({ passedUsers: updatedPasses }));
      }
    });
  }
});

export const useMatchesStore = create<MatchesState>()(
  persist(
    matchesStoreCreator as any,
    {
      name: 'matches-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state: MatchesState): MatchesPersistedState => ({
        passedUsers: state.passedUsers,
        pendingLikes: Array.from(state.pendingLikes),
        swipeQueue: state.swipeQueue,
        matches: state.matches,
        error: state.error,
        swipeLimitReached: state.swipeLimitReached,
        matchLimitReached: state.matchLimitReached,
        noMoreProfiles: state.noMoreProfiles,
        potentialMatches: state.potentialMatches,
        cachedMatches: state.cachedMatches,
        batchSize: state.batchSize,
        prefetchThreshold: state.prefetchThreshold,
        batchProcessingInterval: state.batchProcessingInterval,
        isLoading: state.isLoading,
        isPrefetching: state.isPrefetching,
        newMatch: state.newMatch
      }),
      onRehydrateStorage: () => (state: MatchesPersistedState | undefined, error: unknown) => {
        if (error) {
          console.error('Error rehydrating matches store:', error);
          // Use initial state if there's an error
          useMatchesStore.setState(initialState);
          return;
        }

        if (!state) {
          // Use initial state if no persisted state
          useMatchesStore.setState(initialState);
          return;
        }

        // Convert pendingLikes array back to Set
        if (Array.isArray(state.pendingLikes)) {
          useMatchesStore.setState({
            ...state,
            pendingLikes: new Set(state.pendingLikes),
            // Reset loading states on rehydration
            isLoading: false,
            isPrefetching: false
          });
        }
      }
    } as unknown as PersistOptions<MatchesState, MatchesPersistedState>
  )
);

// Set up interval for processing swipe batches periodically
let batchProcessingInterval: ReturnType<typeof setInterval> | null = null;

export const startBatchProcessing = () => {
  return withErrorHandling(async () => {
    if (batchProcessingInterval) {
      clearInterval(batchProcessingInterval);
    }

    const { batchProcessingInterval: interval } = useMatchesStore.getState();
    batchProcessingInterval = setInterval(async () => {
      const store = useMatchesStore.getState();
      if (store.swipeQueue.length > 0 && !store.isLoading) {
        await store.processSwipeBatch().catch((error: unknown) => {
          const appError = handleError(error);
          notifyError(appError.userMessage);
        });
      }
    }, interval);
  });
};

export const stopBatchProcessing = () => {
  return withErrorHandling(async () => {
    if (batchProcessingInterval) {
      clearInterval(batchProcessingInterval);
      batchProcessingInterval = null;
    }
  });
};

/**
 * Batch processing state tracking
 */
interface BatchState {
  inProgress: boolean;
  lastProcessed: number;
  failedBatches: SwipeAction[][];
  retryCount: number;
}

const batchState: BatchState = {
  inProgress: false,
  lastProcessed: 0,
  failedBatches: [],
  retryCount: 0
};

const MAX_BATCH_RETRIES = 3;
const BATCH_COOLDOWN = 5000; // 5 seconds

/**
 * Validates a batch of swipe actions
 */
const validateBatch = (batch: SwipeAction[]): boolean => {
  if (!batch || !Array.isArray(batch) || batch.length === 0) return false;
  
  return batch.every(action => (
    action &&
    typeof action === 'object' &&
    typeof action.swiper_id === 'string' &&
    typeof action.swipee_id === 'string' &&
    (action.direction === 'left' || action.direction === 'right') &&
    typeof action.swipe_timestamp === 'number'
  ));
};
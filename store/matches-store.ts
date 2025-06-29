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

// Helper function to convert Supabase response to UserProfile type
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    email: String(camelCaseData.email || ''),
    name: String(camelCaseData.name || ''),
    bio: String(camelCaseData.bio || ''),
    location: String(camelCaseData.location || ''),
    zipCode: String(camelCaseData.zipCode || ''),
    latitude: Number(camelCaseData.latitude || 0),
    longitude: Number(camelCaseData.longitude || 0),
    preferredDistance: Number(camelCaseData.preferredDistance || 50),
    locationPrivacy: String(camelCaseData.locationPrivacy || 'public') as UserProfile["locationPrivacy"],
    businessField: String(camelCaseData.businessField || 'Technology') as UserProfile["businessField"],
    entrepreneurStatus: String(camelCaseData.entrepreneurStatus || 'upcoming') as UserProfile["entrepreneurStatus"],
    photoUrl: camelCaseData.photoUrl,
    membershipTier: String(camelCaseData.membershipTier || 'basic') as MembershipTier,
    businessVerified: Boolean(camelCaseData.businessVerified || false),
    joinedGroups: Array.isArray(camelCaseData.joinedGroups) ? camelCaseData.joinedGroups : [],
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    lookingFor: Array.isArray(camelCaseData.lookingFor) ? camelCaseData.lookingFor : [],
    businessStage: camelCaseData.businessStage,
    skillsOffered: Array.isArray(camelCaseData.skillsOffered) ? camelCaseData.skillsOffered : [],
    skillsSeeking: Array.isArray(camelCaseData.skillsSeeking) ? camelCaseData.skillsSeeking : [],
    keyChallenge: camelCaseData.keyChallenge,
    industryFocus: camelCaseData.industryFocus,
    availabilityLevel: Array.isArray(camelCaseData.availabilityLevel) ? camelCaseData.availabilityLevel : [],
    timezone: camelCaseData.timezone,
    successHighlight: camelCaseData.successHighlight,
  };
};

// In-memory cache for user profiles
const userProfileCache = new Map<string, UserProfile>();

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
      set({ isLoading: true, error: null });

      try {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for fetching matches'
          };
        }

        await withNetworkCheck(async () => {
          // Clean up expired passes first
          await get().cleanupExpiredPasses();
          
          // Get current passed users and pending likes
          const passedUserIds = get().passedUsers.map((pass: PassedUser) => pass.id);
          const pendingLikeIds = Array.from(get().pendingLikes);
          
          // If we have cached matches and not forcing refresh, use them
          if (!forceRefresh && get().cachedMatches.length > 0) {
            const { cachedMatches } = get();
            // Filter out passed users and pending likes from cached matches
            const filteredCache = cachedMatches.filter((match: UserProfile) => 
              passedUserIds.indexOf(match.id) === -1 && 
              pendingLikeIds.indexOf(match.id) === -1
            );
            const batchToShow = filteredCache.slice(0, get().batchSize);
            const remainingCache = filteredCache.slice(get().batchSize);
            console.log('[MatchesStore] Using cached matches', { batchToShow: batchToShow.length, remainingCache: remainingCache.length });
            set({ 
              potentialMatches: batchToShow, 
              cachedMatches: remainingCache, 
              isLoading: false,
              noMoreProfiles: false
            });
            return;
          }

          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }

          // Use cached tier settings for global discovery
          const tierSettings = useAuthStore.getState().getTierSettings();
          if (!tierSettings) {
            throw {
              category: ErrorCategory.VALIDATION,
              code: ErrorCodes.VALIDATION_MISSING_FIELD,
              message: 'Tier settings not available for global discovery check'
            };
          }

          const isGlobalDiscovery = tierSettings.global_discovery;

          // Fetch potential matches using the Supabase function
          const result = await withRateLimitAndRetry(() => fetchPotentialMatchesFromSupabase(
            user.id,
            maxDistance,
            isGlobalDiscovery,
            get().batchSize * 2 // Fetch extra for caching
          ));

          if (!result || !result.matches) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: 'Failed to fetch matches'
            };
          }

          if (result.matches.length === 0) {
            set({ 
              potentialMatches: [], 
              cachedMatches: [],
              isLoading: false,
              noMoreProfiles: true
            });
            return;
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
            noMoreProfiles: false
          });
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

  prefetchNextBatch: async (maxDistance = 50) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for prefetching matches');
    }
    
    if (get().isPrefetching || get().isLoading || get().noMoreProfiles) {
      console.log('[MatchesStore] Prefetching skipped - already in progress, loading, or no more profiles');
      set({ isPrefetching: false });
      return;
    }
    
    set({ isPrefetching: true, error: null });
    try {
      // Use cached tier settings for global discovery
      const tierSettings = useAuthStore.getState().getTierSettings();
      if (!tierSettings) {
        throw new Error('Tier settings not available for global discovery check');
      }
      const isGlobalDiscovery = tierSettings.global_discovery;
      // Use user's preferred distance if available
      const userMaxDistance = user.preferredDistance || maxDistance;
      
      if (isSupabaseConfigured() && supabase) {
        // Apply rate limiting
        await rateLimitedQuery();
        
        // Fetch potential matches with retry logic
        const result = await withRateLimitAndRetry(() => fetchPotentialMatchesFromSupabase(user.id, userMaxDistance, isGlobalDiscovery, get().batchSize));
        
        if (!result || result.count === 0) {
          console.log('[MatchesStore] No additional matches found during prefetch');
          set({ 
            isPrefetching: false,
            noMoreProfiles: true,
            error: tierSettings.global_discovery ? "No additional global matches found." : "No additional matches found in your area."
          });
          return;
        }
        
        // Convert raw matches to UserProfile type and cache
        const potentialMatches = result.matches.map((match: Record<string, any>) => {
          const profile = supabaseToUserProfile(match);
          userProfileCache.set(profile.id, profile);
          return profile;
        });
        
        console.log('[MatchesStore] Prefetched additional matches', { count: potentialMatches.length });
        set({ 
          cachedMatches: [...get().cachedMatches, ...potentialMatches].slice(0, 50), 
          isPrefetching: false,
          noMoreProfiles: false
        });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('[MatchesStore] Error prefetching potential matches:', getReadableError(error));
      notifyError('Error prefetching matches: ' + getReadableError(error));
      const tierSettings = useAuthStore.getState().getTierSettings();
      set({ 
        error: tierSettings?.global_discovery ? "No additional global matches found." : "No additional matches found in your area.",
        isPrefetching: false,
        noMoreProfiles: true
      });
    }
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
      const { user, isReady } = useAuthStore.getState();
      if (!isReady || !user) {
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated for processing swipe batch'
        };
      }
      
      set({ isLoading: true, error: null });
      
      const { swipeQueue } = get();
      if (swipeQueue.length === 0) {
        set({ isLoading: false });
        return;
      }
      
      if (!isSupabaseConfigured() || !supabase) {
        throw {
          category: ErrorCategory.DATABASE,
          code: ErrorCodes.DB_CONNECTION_ERROR,
          message: 'Database is not configured'
        };
      }

      // Process swipe batch using the optimized stored procedure
      const result = await withRateLimitAndRetry(
        () => processSwipeBatchFromSupabase(swipeQueue)
      );
      
      if (!result) {
        throw {
          category: ErrorCategory.DATABASE,
          code: ErrorCodes.DB_QUERY_ERROR,
          message: 'Failed to process swipe batch'
        };
      }

      // Convert any new matches to the correct type and update state
      if (result.new_matches && result.new_matches.length > 0) {
        const typedMatches = result.new_matches.map(match => ({
          ...match,
          profile: supabaseToUserProfile(match.profile)
        })) as MatchWithProfile[];
        
        set((state: MatchesState) => ({
          matches: [...state.matches, ...typedMatches],
          newMatch: typedMatches[0] // Set the first new match for UI notification
        }));
      }

      // Update match limit reached status
      const matchStats = useUsageStore.getState().getUsageStats();
      if (!matchStats) {
        throw {
          category: ErrorCategory.VALIDATION,
          code: ErrorCodes.VALIDATION_MISSING_FIELD,
          message: 'Usage stats not available for match limit update'
        };
      }
      set((state: MatchesState) => ({
        matchLimitReached: matchStats.matchCount >= matchStats.matchLimit
      }));

      // Update swipe limit reached status
      const swipeStats = useUsageStore.getState().getUsageStats();
      if (!swipeStats) {
        throw {
          category: ErrorCategory.VALIDATION,
          code: ErrorCodes.VALIDATION_MISSING_FIELD,
          message: 'Usage stats not available for swipe limit update'
        };
      }
      set((state: MatchesState) => ({
        swipeLimitReached: swipeStats.swipeCount >= swipeStats.swipeLimit,
        swipeQueue: [], 
        isLoading: false 
      }));
      
      // Clear pending likes for processed swipes
      const processedIds = result.processed_swipes.map(swipe => swipe.swipee_id);
      set((state: MatchesState) => {
        const newPendingLikes = new Set(state.pendingLikes);
        processedIds.forEach(id => newPendingLikes.delete(id));
        return { pendingLikes: newPendingLikes };
      });
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
      const { user, isReady } = useAuthStore.getState();
      if (!isReady || !user) {
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
        const tierSettings = useAuthStore.getState().getTierSettings();
        if (!tierSettings) {
          throw {
            category: ErrorCategory.VALIDATION,
            code: ErrorCodes.VALIDATION_MISSING_FIELD,
            message: 'Tier settings not available for global discovery check'
          };
        }

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
            tierSettings.global_discovery,
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
      userProfileCache.clear();
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
    matchesStoreCreator as any, // Use type assertion to bypass complex type mismatch
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
        if (state && Array.isArray(state.pendingLikes)) {
          useMatchesStore.setState({
            pendingLikes: new Set(state.pendingLikes)
          });
        }
      }
    } as unknown as PersistOptions<MatchesState, MatchesPersistedState> // Use type assertion to resolve PersistOptions mismatch
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
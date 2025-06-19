import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Match, UserProfile, MembershipTier } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, SwipeAction, fetchPotentialMatches as fetchPotentialMatchesFromSupabase, processSwipeBatch as processSwipeBatchFromSupabase, syncUsageCounters as syncUsageCountersFromSupabase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { notifyError } from '@/utils/notify';

// Helper function to extract readable error message from Supabase error
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error && error.error.message) return error.error.message;
  
  if (error.details) return String(error.details);
  
  if (error.code) return `Error code: ${error.code}`;
  
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

// Helper function to convert Supabase response to Match type
const supabaseToMatch = (data: Record<string, any>): Match => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    userId: String(camelCaseData.userId || ''),
    matchedUserId: String(camelCaseData.matchedUserId || ''),
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    lastMessageAt: camelCaseData.lastMessageAt,
  };
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

// Retry logic for failed RPC calls
const retryOperation = async <T>(operation: () => Promise<T>, maxRetries: number = 3, delay: number = 1000): Promise<T | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`[MatchesStore] Attempt ${attempt} failed:`, getReadableError(error));
      if (attempt === maxRetries) {
        console.error(`[MatchesStore] Max retries reached. Operation failed.`);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  return null;
};

interface MatchesState {
  potentialMatches: UserProfile[];
  cachedMatches: UserProfile[];
  matches: Match[];
  swipeQueue: SwipeAction[];
  batchSize: number;
  prefetchThreshold: number;
  batchProcessingInterval: number;
  isLoading: boolean;
  isPrefetching: boolean;
  error: string | null;
  newMatch: Match | null;
  swipeLimitReached: boolean;
  matchLimitReached: boolean;
  fetchPotentialMatches: (maxDistance?: number, forceRefresh?: boolean) => Promise<void>;
  prefetchNextBatch: (maxDistance?: number) => Promise<void>;
  likeUser: (userId: string) => Promise<Match | null>;
  passUser: (userId: string) => Promise<void>;
  queueSwipe: (userId: string, direction: 'left' | 'right') => Promise<void>;
  processSwipeBatch: () => Promise<void>;
  getMatches: () => Promise<void>;
  refreshCandidates: () => Promise<void>;
  clearError: () => void;
  clearNewMatch: () => void;
  checkSwipeLimits: () => Promise<boolean>;
  syncUsageCounters: () => Promise<void>;
}

export const useMatchesStore = create<MatchesState>()(
  persist(
    (set, get) => ({
      potentialMatches: [],
      cachedMatches: [],
      matches: [],
      swipeQueue: [],
      batchSize: 25,
      prefetchThreshold: 5,
      batchProcessingInterval: 15000, // 15 seconds, increased to run less frequently
      isLoading: false,
      isPrefetching: false,
      error: null,
      newMatch: null,
      swipeLimitReached: false,
      matchLimitReached: false,
      fetchPotentialMatches: async (maxDistance = 50, forceRefresh = false) => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        if (get().isLoading && !forceRefresh) return;
        
        set({ isLoading: true, error: null });
        try {
          // If we have cached matches and not forcing refresh, use them
          if (!forceRefresh && get().cachedMatches.length > 0) {
            const { cachedMatches } = get();
            const batchToShow = cachedMatches.slice(0, get().batchSize);
            const remainingCache = cachedMatches.slice(get().batchSize);
            console.log('[MatchesStore] Using cached matches', { batchToShow: batchToShow.length, remainingCache: remainingCache.length });
            set({ 
              potentialMatches: batchToShow, 
              cachedMatches: remainingCache, 
              isLoading: false 
            });
            return;
          }
          
          if (isSupabaseConfigured() && supabase) {
            // Use cached tier settings for global discovery
            const isGlobalDiscovery = tierSettings?.global_discovery || false;
            // Use user's preferred distance if available
            const userMaxDistance = user.preferredDistance || maxDistance;
            
            // Apply rate limiting
            await rateLimitedQuery();
            
            // Fetch potential matches with retry logic
            const result = await retryOperation(() => fetchPotentialMatchesFromSupabase(user.id, userMaxDistance, isGlobalDiscovery, get().batchSize * 2));
            
            if (!result || result.count === 0) {
              throw new Error(isGlobalDiscovery ? "No global matches found. Try adjusting your preferences." : "No matches found in your area. Try increasing your distance.");
            }
            
            // Convert raw matches to UserProfile type and cache
            const potentialMatches = result.matches.map((match: Record<string, any>) => {
              const profile = supabaseToUserProfile(match);
              userProfileCache.set(profile.id, profile);
              return profile;
            });
            
            // Split into potential and cached
            const batchToShow = potentialMatches.slice(0, get().batchSize);
            const remainingCache = potentialMatches.slice(get().batchSize);
            
            console.log('[MatchesStore] Fetched potential matches', { total: potentialMatches.length, batchToShow: batchToShow.length, cached: remainingCache.length });
            set({ 
              potentialMatches: batchToShow, 
              cachedMatches: remainingCache, 
              isLoading: false 
            });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('[MatchesStore] Error fetching potential matches:', getReadableError(error));
          notifyError('Error fetching matches: ' + getReadableError(error));
          set({ 
            error: tierSettings?.global_discovery ? "No global matches found. Try adjusting your preferences." : "No matches found in your area. Try increasing your distance.",
            isLoading: false 
          });
        }
      },

      prefetchNextBatch: async (maxDistance = 50) => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        if (get().isPrefetching || get().isLoading) return;
        
        set({ isPrefetching: true, error: null });
        try {
          // Use cached tier settings for global discovery
          const isGlobalDiscovery = tierSettings?.global_discovery || false;
          // Use user's preferred distance if available
          const userMaxDistance = user.preferredDistance || maxDistance;
          
          if (isSupabaseConfigured() && supabase) {
            // Apply rate limiting
            await rateLimitedQuery();
            
            // Fetch potential matches with retry logic
            const result = await retryOperation(() => fetchPotentialMatchesFromSupabase(user.id, userMaxDistance, isGlobalDiscovery, get().batchSize * 2));
            
            if (!result || result.count === 0) {
              throw new Error(isGlobalDiscovery ? "No additional global matches found." : "No additional matches found in your area.");
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
              isPrefetching: false 
            });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('[MatchesStore] Error prefetching potential matches:', getReadableError(error));
          notifyError('Error prefetching matches: ' + getReadableError(error));
          set({ 
            error: tierSettings?.global_discovery ? "No additional global matches found." : "No additional matches found in your area.",
            isPrefetching: false 
          });
        }
      },

      likeUser: async (userId: string) => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return null; // Silent fail if not ready or authenticated
        
        set({ isLoading: true, error: null });
        try {
          const tierSettings = useAuthStore.getState().tierSettings;
          
          // Check swipe limits before proceeding
          const canSwipe = await get().checkSwipeLimits();
          if (!canSwipe) {
            set({ swipeLimitReached: true, isLoading: false });
            notifyError('Daily swipe limit reached');
            throw new Error('Daily swipe limit reached');
          }

          // Check match limits
          if (get().matchLimitReached) {
            set({ isLoading: false });
            notifyError('Daily match limit reached');
            throw new Error('Daily match limit reached');
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
          
          console.log('[MatchesStore] Liked user', { userId, remainingMatches: updatedPotentialMatches.length });
          set({ 
            potentialMatches: updatedPotentialMatches, 
            cachedMatches: newCachedMatches, 
            isLoading: false 
          });
          
          // Return null for now - match will be processed in batch
          return null;
        } catch (error) {
          console.error('[MatchesStore] Error liking user:', getReadableError(error));
          notifyError('Error liking user: ' + getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
          return null;
        }
      },

      passUser: async (userId: string) => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        set({ isLoading: true, error: null });
        try {
          // Check swipe limits before proceeding
          const canSwipe = await get().checkSwipeLimits();
          if (!canSwipe) {
            set({ swipeLimitReached: true, isLoading: false });
            notifyError('Daily swipe limit reached');
            throw new Error('Daily swipe limit reached');
          }
          
          // Add to swipe queue instead of processing immediately
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
          
          console.log('[MatchesStore] Passed user', { userId, remainingMatches: updatedPotentialMatches.length });
          set({ 
            potentialMatches: updatedPotentialMatches, 
            cachedMatches: newCachedMatches, 
            isLoading: false 
          });
        } catch (error) {
          console.error('[MatchesStore] Error passing user:', getReadableError(error));
          notifyError('Error passing user: ' + getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      queueSwipe: async (userId: string, direction: 'left' | 'right') => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        try {
          const swipeAction: SwipeAction = {
            swiper_id: user.id,
            swipee_id: userId,
            direction,
            swipe_timestamp: Date.now()
          };
          
          set(state => ({
            swipeQueue: [...state.swipeQueue, swipeAction]
          }));
          
          console.log('[MatchesStore] Queued swipe', { userId, direction, queueLength: get().swipeQueue.length });
          
          // If the queue is long enough, process it immediately
          if (get().swipeQueue.length >= 5) {
            await get().processSwipeBatch();
          }
        } catch (error) {
          console.error('[MatchesStore] Error queuing swipe:', getReadableError(error));
          notifyError('Error queuing swipe: ' + getReadableError(error));
          throw error;
        }
      },

      processSwipeBatch: async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        set({ isLoading: true, error: null });
        try {
          const { swipeQueue } = get();
          
          if (swipeQueue.length === 0) {
            set({ isLoading: false });
            return;
          }
          
          console.log('[MatchesStore] Processing swipe batch', { queueLength: swipeQueue.length });
          
          if (isSupabaseConfigured() && supabase) {
            // Apply rate limiting
            await rateLimitedQuery();
            
            // Process swipe batch using the optimized stored procedure
            const result = await processSwipeBatchFromSupabase(swipeQueue);
            
            if (!result) {
              throw new Error('Failed to process swipe batch');
            }
            
            // Update matches if any new ones were created
            if (result.new_matches.length > 0) {
              const typedMatches = result.new_matches.map((match: Record<string, any>) => supabaseToMatch(match));
              
              set(state => ({
                matches: [...state.matches, ...typedMatches],
                newMatch: typedMatches[0] // Set the first new match for UI notification
              }));
              
              // Check if match limit is reached
              const tierSettings = useAuthStore.getState().tierSettings;
              if (tierSettings && result.match_count >= tierSettings.daily_match_limit) {
                set({ matchLimitReached: true });
              }
              
              console.log(`[MatchesStore] Batch processing created ${typedMatches.length} new matches`);
            }
            
            // Update swipe limit reached status
            set({ 
              swipeLimitReached: result.swipe_count >= result.swipe_limit,
              swipeQueue: [], 
              isLoading: false 
            });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('[MatchesStore] Error processing swipe batch:', getReadableError(error));
          notifyError('Error processing swipe batch: ' + getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      getMatches: async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        set({ isLoading: true, error: null });
        try {
          if (isSupabaseConfigured() && supabase) {
            // Apply rate limiting
            await rateLimitedQuery();
            
            // Get matches from Supabase
            const { data: matchesData, error: matchesError } = await supabase
              .from('matches')
              .select('*')
              .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`)
              .order('created_at', { ascending: false });
              
            if (matchesError) throw matchesError;
            
            // Convert to Match type
            const typedMatches: Match[] = (matchesData || []).map(supabaseToMatch);
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: user.id,
                action: 'view_matches',
                details: { count: typedMatches.length }
              });
            } catch (logError) {
              console.warn('[MatchesStore] Failed to log view_matches action:', getReadableError(logError));
              notifyError('Failed to log view matches action: ' + getReadableError(logError));
            }
            
            console.log('[MatchesStore] Fetched user matches', { count: typedMatches.length });
            set({ matches: typedMatches, isLoading: false });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('[MatchesStore] Error getting matches:', getReadableError(error));
          notifyError('Error getting matches: ' + getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      refreshCandidates: async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or authenticated
        
        console.log('[MatchesStore] Refreshing candidates - clearing current matches');
        set({ potentialMatches: [], cachedMatches: [] });
        await get().fetchPotentialMatches(50, true);
      },

      clearError: () => set({ error: null }),
      
      clearNewMatch: () => set({ newMatch: null }),

      checkSwipeLimits: async () => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user || !tierSettings) {
          return false; // Silent fail if not ready or not authenticated
        }
        
        try {
          const dailySwipeLimit = tierSettings.daily_swipe_limit || 10;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTimestamp = today.getTime();
          
          if (isSupabaseConfigured() && supabase) {
            // Apply rate limiting
            await rateLimitedQuery();
            
            const { data: likesData, error } = await supabase
              .from('likes')
              .select('id, timestamp')
              .eq('liker_id', user.id)
              .gte('timestamp', todayTimestamp);
              
            if (error) {
              console.error('[MatchesStore] Error checking swipe limits:', getReadableError(error));
              notifyError('Error checking swipe limits: ' + getReadableError(error));
              return true; // Allow swipe in case of error to not block user
            }
            
            const todaySwipes = likesData ? likesData.length : 0;
            const canSwipe = todaySwipes < dailySwipeLimit;
            set({ swipeLimitReached: !canSwipe });
            console.log('[MatchesStore] Checked swipe limits', { todaySwipes, dailyLimit: dailySwipeLimit, canSwipe });
            return canSwipe;
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('[MatchesStore] Error checking swipe limits:', getReadableError(error));
          notifyError('Error checking swipe limits: ' + getReadableError(error));
          return true; // Allow swipe in case of error to not block user
        }
      },

      syncUsageCounters: async () => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user || !tierSettings) {
          return; // Silent fail if not ready or not authenticated
        }
        
        try {
          if (isSupabaseConfigured() && supabase) {
            // Apply rate limiting
            await rateLimitedQuery();
            
            // Sync usage counters using the optimized function
            const result = await syncUsageCountersFromSupabase(user.id);
            
            if (result) {
              set({ 
                swipeLimitReached: result.swipe_count >= result.swipe_limit,
                matchLimitReached: result.match_count >= result.match_limit
              });
              console.log('[MatchesStore] Synced usage counters', { 
                swipeCount: result.swipe_count, 
                swipeLimit: result.swipe_limit,
                matchCount: result.match_count,
                matchLimit: result.match_limit
              });
            }
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('[MatchesStore] Error syncing usage counters:', getReadableError(error));
          notifyError('Error syncing usage counters: ' + getReadableError(error));
        }
      }
    }),
    {
      name: 'matches-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

// Set up interval for processing swipe batches periodically
let batchProcessingIntervalId: number | null = null;
let isBatchProcessingActive = false;

export const startBatchProcessing = () => {
  if (isBatchProcessingActive || batchProcessingIntervalId !== null) {
    console.log('[MatchesStore] Batch processing already active');
    return;
  }
  
  const { batchProcessingInterval: intervalMs } = useMatchesStore.getState();
  batchProcessingIntervalId = setInterval(async () => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or authenticated
    
    const { swipeQueue } = useMatchesStore.getState();
    if (swipeQueue.length >= 5) {
      console.log(`[MatchesStore] Periodic batch processing: ${swipeQueue.length} swipes in queue`);
      await useMatchesStore.getState().processSwipeBatch();
    }
  }, intervalMs) as unknown as number;
  
  isBatchProcessingActive = true;
  console.log('[MatchesStore] Batch swipe processing started');
};

export const stopBatchProcessing = () => {
  if (!isBatchProcessingActive || batchProcessingIntervalId === null) {
    console.log('[MatchesStore] Batch processing not active');
    return;
  }
  
  clearInterval(batchProcessingIntervalId);
  batchProcessingIntervalId = null;
  isBatchProcessingActive = false;
  console.log('[MatchesStore] Batch swipe processing stopped');
};
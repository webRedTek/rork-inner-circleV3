import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Match, UserProfile, MembershipTier } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase, SwipeAction } from '@/lib/supabase';
import { useAuthStore } from './auth-store';

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
      batchProcessingInterval: 3000, // 3 seconds
      isLoading: false,
      isPrefetching: false,
      error: null,
      newMatch: null,
      swipeLimitReached: false,
      matchLimitReached: false,

      fetchPotentialMatches: async (maxDistance = 50, forceRefresh = false) => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
        if (get().isLoading && !forceRefresh) return;
        
        set({ isLoading: true, error: null });
        try {
          // If we have cached matches and not forcing refresh, use them
          if (!forceRefresh && get().cachedMatches.length > 0) {
            const { cachedMatches } = get();
            const batchToShow = cachedMatches.slice(0, get().batchSize);
            const remainingCache = cachedMatches.slice(get().batchSize);
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
            
            let potentialUsers: any[] = [];
            let matchError: any = null;
            
            if (isGlobalDiscovery) {
              // For global discovery, query users directly based on matching criteria
              const { data, error } = await supabase
                .from('users')
                .select('*')
                .neq('id', user.id);
                
              if (error) {
                matchError = error;
              } else {
                potentialUsers = data || [];
              }
            } else {
              // Get potential matches based on location
              const { data, error } = await supabase
                .from('users')
                .select('*')
                .neq('id', user.id);
                
              if (error) {
                matchError = error;
              } else {
                potentialUsers = data || [];
              }
            }
            
            if (matchError) throw matchError;
            
            // Filter out users that have already been matched or passed
            const { data: existingLikes, error: likesError } = await supabase
              .from('likes')
              .select('liked_id')
              .eq('liker_id', user.id);
              
            if (likesError) throw likesError;
            
            const likedIds = existingLikes ? existingLikes.map((like: any) => like.liked_id) : [];
            
            // Convert to UserProfile type
            const potentialData = potentialUsers as Record<string, any>[] || [];
            const filteredMatches = potentialData
              .filter((user: any) => !likedIds.includes(user.id))
              .map(supabaseToUserProfile);
            
            // Sort based on discovery type
            const sortedMatches = isGlobalDiscovery 
              ? filteredMatches.sort(() => Math.random() - 0.5) // Randomize for global
              : filteredMatches.sort((a, b) => {
                  const aDist = (a as any).distance || 0;
                  const bDist = (b as any).distance || 0;
                  return aDist - bDist;
                });
            
            // Split into potential and cached
            const batchToShow = sortedMatches.slice(0, get().batchSize);
            const remainingCache = sortedMatches.slice(get().batchSize);
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: user.id,
                action: 'fetch_potential_matches',
                details: { 
                  count: sortedMatches.length,
                  max_distance: userMaxDistance,
                  global_discovery: isGlobalDiscovery
                }
              });
            } catch (logError) {
              console.warn('Failed to log fetch_potential_matches action:', getReadableError(logError));
            }
            
            set({ 
              potentialMatches: batchToShow, 
              cachedMatches: remainingCache, 
              isLoading: false 
            });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error fetching potential matches:', getReadableError(error));
          set({ 
            error: tierSettings?.global_discovery ? "No global matches found. Try adjusting your preferences." : "No matches found in your area. Try increasing your distance.",
            isLoading: false 
          });
        }
      },

      prefetchNextBatch: async (maxDistance = 50) => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
        if (get().isPrefetching || get().isLoading) return;
        
        set({ isPrefetching: true, error: null });
        try {
          // Use cached tier settings for global discovery
          const isGlobalDiscovery = tierSettings?.global_discovery || false;
          // Use user's preferred distance if available
          const userMaxDistance = user.preferredDistance || maxDistance;
          
          if (isSupabaseConfigured() && supabase) {
            let potentialUsers: any[] = [];
            let matchError: any = null;
            
            if (isGlobalDiscovery) {
              // For global discovery, query users directly based on matching criteria
              const { data, error } = await supabase
                .from('users')
                .select('*')
                .neq('id', user.id);
                
              if (error) {
                matchError = error;
              } else {
                potentialUsers = data || [];
              }
            } else {
              // Get potential matches based on location
              const { data, error } = await supabase
                .from('users')
                .select('*')
                .neq('id', user.id);
                
              if (error) {
                matchError = error;
              } else {
                potentialUsers = data || [];
              }
            }
            
            if (matchError) throw matchError;
            
            // Filter out users that have already been matched or passed
            const { data: existingLikes, error: likesError } = await supabase
              .from('likes')
              .select('liked_id')
              .eq('liker_id', user.id);
              
            if (likesError) throw likesError;
            
            const likedIds = existingLikes ? existingLikes.map((like: any) => like.liked_id) : [];
            
            // Convert to UserProfile type
            const potentialData = potentialUsers as Record<string, any>[] || [];
            const filteredMatches = potentialData
              .filter((user: any) => !likedIds.includes(user.id))
              .map(supabaseToUserProfile);
            
            // Sort based on discovery type
            const sortedMatches = isGlobalDiscovery 
              ? filteredMatches.sort(() => Math.random() - 0.5) // Randomize for global
              : filteredMatches.sort((a, b) => {
                  const aDist = (a as any).distance || 0;
                  const bDist = (b as any).distance || 0;
                  return aDist - bDist;
                });
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: user.id,
                action: 'prefetch_potential_matches',
                details: { 
                  count: sortedMatches.length,
                  max_distance: userMaxDistance,
                  global_discovery: isGlobalDiscovery
                }
              });
            } catch (logError) {
              console.warn('Failed to log prefetch_potential_matches action:', getReadableError(logError));
            }
            
            set({ 
              cachedMatches: [...get().cachedMatches, ...sortedMatches].slice(0, 50), 
              isPrefetching: false 
            });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error prefetching potential matches:', getReadableError(error));
          set({ 
            error: tierSettings?.global_discovery ? "No additional global matches found." : "No additional matches found in your area.",
            isPrefetching: false 
          });
        }
      },

      likeUser: async (userId: string) => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return null; // Silent fail if not ready or not authenticated
        
        set({ isLoading: true, error: null });
        try {
          const tierSettings = useAuthStore.getState().tierSettings;
          
          // Check swipe limits before proceeding
          const canSwipe = await get().checkSwipeLimits();
          if (!canSwipe) {
            set({ swipeLimitReached: true, isLoading: false });
            throw new Error('Daily swipe limit reached');
          }

          // Check match limits
          if (get().matchLimitReached) {
            set({ isLoading: false });
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
          
          set({ 
            potentialMatches: updatedPotentialMatches, 
            cachedMatches: newCachedMatches, 
            isLoading: false 
          });
          
          // Return null for now - match will be processed in batch
          return null;
        } catch (error) {
          console.error('Error liking user:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
          return null;
        }
      },

      passUser: async (userId: string) => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
        set({ isLoading: true, error: null });
        try {
          // Check swipe limits before proceeding
          const canSwipe = await get().checkSwipeLimits();
          if (!canSwipe) {
            set({ swipeLimitReached: true, isLoading: false });
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
          
          set({ 
            potentialMatches: updatedPotentialMatches, 
            cachedMatches: newCachedMatches, 
            isLoading: false 
          });
        } catch (error) {
          console.error('Error passing user:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      queueSwipe: async (userId: string, direction: 'left' | 'right') => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
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
          
          // If the queue is long enough, process it immediately
          if (get().swipeQueue.length >= 5) {
            await get().processSwipeBatch();
          }
        } catch (error) {
          console.error('Error queuing swipe:', getReadableError(error));
          throw error;
        }
      },

      processSwipeBatch: async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
        set({ isLoading: true, error: null });
        try {
          const { swipeQueue } = get();
          
          if (swipeQueue.length === 0) {
            set({ isLoading: false });
            return;
          }
          
          if (isSupabaseConfigured() && supabase) {
            // Process the batch of swipes using the Supabase RPC
            const newMatches = await processBatchSwipes(swipeQueue);
            
            // Update matches if any new ones were created
            if (newMatches && newMatches.length > 0) {
              const typedMatches = newMatches.map((match: any) => ({
                id: match.matchId,
                userId: match.userId,
                matchedUserId: match.matchedUserId,
                createdAt: match.createdAt
              })) as Match[];
              
              set(state => ({
                matches: [...state.matches, ...typedMatches],
                newMatch: typedMatches[0] // Set the first new match for UI notification
              }));
              
              // Check if match limit is reached
              const tierSettings = useAuthStore.getState().tierSettings;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const todayTimestamp = today.getTime();
              const todayMatches = typedMatches.filter(m => m.createdAt >= todayTimestamp).length;
              if (tierSettings && todayMatches >= tierSettings.daily_match_limit) {
                set({ matchLimitReached: true });
              }
              
              // Return the first match for immediate feedback if needed
              console.log(`Batch processing created ${typedMatches.length} new matches`);
            }
            
            // Clear the swipe queue
            set({ swipeQueue: [], isLoading: false });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error processing swipe batch:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      getMatches: async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
        set({ isLoading: true, error: null });
        try {
          if (isSupabaseConfigured() && supabase) {
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
              console.warn('Failed to log view_matches action:', getReadableError(logError));
            }
            
            set({ matches: typedMatches, isLoading: false });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error getting matches:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      refreshCandidates: async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) return; // Silent fail if not ready or not authenticated
        
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
            const { data: likesData, error } = await supabase
              .from('likes')
              .select('id, timestamp')
              .eq('liker_id', user.id)
              .gte('timestamp', todayTimestamp);
              
            if (error) {
              console.error('Error checking swipe limits:', error);
              return true; // Allow swipe in case of error to not block user
            }
            
            const todaySwipes = likesData ? likesData.length : 0;
            const canSwipe = todaySwipes < dailySwipeLimit;
            set({ swipeLimitReached: !canSwipe });
            return canSwipe;
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error checking swipe limits:', error);
          return true; // Allow swipe in case of error to not block user
        }
      },

      syncUsageCounters: async () => {
        const { user, isReady, tierSettings } = useAuthStore.getState();
        if (!isReady || !user || !tierSettings) {
          return; // Silent fail if not ready or not authenticated
        }
        
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTimestamp = today.getTime();
          
          if (isSupabaseConfigured() && supabase) {
            // Sync swipe count
            const { data: likesData, error: likesError } = await supabase
              .from('likes')
              .select('id, timestamp')
              .eq('liker_id', user.id)
              .gte('timestamp', todayTimestamp);
              
            if (likesError) {
              console.error('Error syncing swipe count:', likesError);
            } else {
              const todaySwipes = likesData ? likesData.length : 0;
              const swipeLimitReached = todaySwipes >= tierSettings.daily_swipe_limit;
              set({ swipeLimitReached });
            }
            
            // Sync match count
            const { data: matchesData, error: matchesError } = await supabase
              .from('matches')
              .select('id, created_at')
              .eq('user_id', user.id)
              .gte('created_at', todayTimestamp);
              
            if (matchesError) {
              console.error('Error syncing match count:', matchesError);
            } else {
              const todayMatches = matchesData ? matchesData.length : 0;
              const matchLimitReached = todayMatches >= tierSettings.daily_match_limit;
              set({ matchLimitReached });
            }
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Error syncing usage counters:', error);
        }
      }
    }),
    {
      name: 'matches-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Set up interval for processing swipe batches periodically
let batchProcessingInterval: NodeJS.Timeout | null = null;

export const startBatchProcessing = () => {
  if (batchProcessingInterval) return;
  
  const { batchProcessingInterval: intervalMs } = useMatchesStore.getState();
  batchProcessingInterval = setInterval(async () => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    const { swipeQueue } = useMatchesStore.getState();
    if (swipeQueue.length > 0) {
      console.log(`Periodic batch processing: ${swipeQueue.length} swipes in queue`);
      await useMatchesStore.getState().processSwipeBatch();
    }
    // Sync usage counters periodically
    await useMatchesStore.getState().syncUsageCounters();
  }, intervalMs) as unknown as NodeJS.Timeout;
  
  console.log('Batch swipe processing started');
};

export const stopBatchProcessing = () => {
  if (batchProcessingInterval) {
    clearInterval(batchProcessingInterval);
    batchProcessingInterval = null;
    console.log('Batch swipe processing stopped');
  }
};

// Helper function to process batch swipes
const processBatchSwipes = async (swipes: SwipeAction[]): Promise<any[]> => {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    if (!swipes || swipes.length === 0) {
      console.log('No swipes to process');
      return [];
    }

    console.log(`Processing batch of ${swipes.length} swipes`);

    // Convert the swipes to snake_case for Supabase
    const formattedSwipes = swipes.map(swipe => convertToSnakeCase(swipe));

    // Call the RPC function to process batch swipes
    const { data, error } = await supabase.rpc('process_batch_swipes', { swipes: formattedSwipes });

    if (error) {
      console.error('Error processing batch swipes:', error);
      throw error;
    }

    // Convert the response back to camelCase
    const matches = data ? data.map((match: any) => convertToCamelCase(match)) : [];
    console.log(`Batch swipe processing complete. New matches: ${matches.length}`);
    return matches;
  } catch (error) {
    console.error('Error in processBatchSwipes:', error);
    throw error;
  }
};
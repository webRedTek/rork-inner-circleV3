import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Match, UserProfile, MembershipTier } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase, processBatchSwipes, SwipeAction } from '@/lib/supabase';
import { useAuthStore } from './auth-store';

// Helper function to extract readable error message from Supabase error
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  // If it's a string, return it directly
  if (typeof error === 'string') return error;
  
  // If it has a message property, return that
  if (error.message) return error.message;
  
  // If it has an error property with a message (nested error)
  if (error.error && error.error.message) return error.error.message;
  
  // If it has a details property
  if (error.details) return String(error.details);
  
  // If it has a code property
  if (error.code) return `Error code: ${error.code}`;
  
  // Last resort: stringify the object
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

// Helper function to convert Supabase response to Match type
const supabaseToMatch = (data: Record<string, any>): Match => {
  // First convert snake_case to camelCase
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
  // First convert snake_case to camelCase
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    email: String(camelCaseData.email || ''),
    name: String(camelCaseData.name || ''),
    bio: String(camelCaseData.bio || ''),
    location: String(camelCaseData.location || ''),
    zipCode: String(camelCaseData.zipCode || ''),
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
  fetchPotentialMatches: (maxDistance?: number, forceRefresh?: boolean) => Promise<void>;
  prefetchNextBatch: (maxDistance?: number) => Promise<void>;
  likeUser: (userId: string) => Promise<Match | null>;
  passUser: (userId: string) => Promise<void>;
  queueSwipe: (userId: string, direction: 'left' | 'right') => Promise<void>;
  processSwipeBatch: () => Promise<void>;
  getMatches: () => Promise<void>;
  refreshCandidates: () => Promise<void>;
  clearError: () => void;
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

      fetchPotentialMatches: async (maxDistance = 50, forceRefresh = false) => {
        if (get().isLoading && !forceRefresh) return;
        
        set({ isLoading: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          const tierSettings = useAuthStore.getState().tierSettings;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
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
            // Get user's tier settings to check if global discovery is enabled
            const { data: tierSettingsData, error: tierError } = await supabase
              .rpc('get_user_tier_settings', { user_id: currentUser.id });
              
            if (tierError) throw tierError;
            
            const tierData = tierSettingsData as Record<string, any> || {};
            const globalDiscovery = tierData && typeof tierData === 'object' && 'global_discovery' in tierData 
              ? Boolean(tierData.global_discovery) 
              : false;
            
            // Get potential matches based on location and tier settings
            const { data: potentialUsers, error: matchError } = await supabase
              .rpc('find_users_within_distance', { 
                user_id: currentUser.id,
                max_distance: maxDistance,
                global_search: globalDiscovery
              });
              
            if (matchError) throw matchError;
            
            // Filter out users that have already been matched or passed
            const { data: existingLikes, error: likesError } = await supabase
              .from('likes')
              .select('liked_id')
              .eq('liker_id', currentUser.id);
              
            if (likesError) throw likesError;
            
            const likedIds = existingLikes ? existingLikes.map((like: any) => like.liked_id) : [];
            
            // Convert to UserProfile type
            const potentialData = potentialUsers as Record<string, any>[] || [];
            const filteredMatches = potentialData
              .filter((user: any) => !likedIds.includes(user.id))
              .map(supabaseToUserProfile);
            
            // Shuffle the array for randomization
            const shuffledMatches = filteredMatches.sort(() => Math.random() - 0.5);
            
            // Split into potential and cached
            const batchToShow = shuffledMatches.slice(0, get().batchSize);
            const remainingCache = shuffledMatches.slice(get().batchSize);
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: currentUser.id,
                action: 'fetch_potential_matches',
                details: { 
                  count: shuffledMatches.length,
                  max_distance: maxDistance,
                  global_discovery: globalDiscovery
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
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // For demo, we'll get users from AsyncStorage
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            // Filter out users that have already been matched or passed
            // In a real app, this would be handled by the backend
            const { matches } = get();
            
            const matchedUserIds = matches.map((m: Match) => 
              m.userId === currentUser.id ? m.matchedUserId : m.userId
            );
            
            // Simulate global discovery based on membership tier
            const isGlobalDiscovery = tierSettings?.global_discovery || false;
            
            // Filter users based on location if not global discovery
            let filteredUsers = users.filter((u: UserProfile) => u.id !== currentUser.id);
            
            if (!isGlobalDiscovery && currentUser?.zipCode) {
              // Simulate distance filtering based on ZIP code
              // In a real app, this would use geolocation data
              filteredUsers = filteredUsers.filter((u: UserProfile) => {
                // If user has no ZIP code, exclude them
                if (!u.zipCode) return false;
                
                // Simple mock distance calculation (first digit difference)
                const zipDiff = Math.abs(
                  parseInt(u.zipCode.substring(0, 1)) - 
                  parseInt((currentUser?.zipCode || '0').substring(0, 1))
                );
                
                // Convert to "miles" (mock)
                const distance = zipDiff * 10;
                return distance <= maxDistance;
              });
            }
            
            const potentialMatches = filteredUsers
              .filter((u: UserProfile) => !matchedUserIds.includes(u.id))
              .map(({ password, ...user }: any) => user);
            
            // Shuffle for randomization
            const shuffledMatches = potentialMatches.sort(() => Math.random() - 0.5);
            const batchToShow = shuffledMatches.slice(0, get().batchSize);
            const remainingCache = shuffledMatches.slice(get().batchSize);
            
            // Log the action in mock audit log
            const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
            const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
            auditLogs.push({
              id: `log-${Date.now()}`,
              user_id: currentUser.id,
              action: 'fetch_potential_matches',
              details: { 
                count: shuffledMatches.length,
                max_distance: maxDistance,
                global_discovery: isGlobalDiscovery
              },
              timestamp: new Date().toISOString()
            });
            await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
            
            set({ 
              potentialMatches: batchToShow, 
              cachedMatches: remainingCache, 
              isLoading: false 
            });
          }
        } catch (error) {
          console.error('Error fetching potential matches:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      prefetchNextBatch: async (maxDistance = 50) => {
        if (get().isPrefetching || get().isLoading) return;
        
        set({ isPrefetching: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          const tierSettings = useAuthStore.getState().tierSettings;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
          if (isSupabaseConfigured() && supabase) {
            // Get user's tier settings to check if global discovery is enabled
            const { data: tierSettingsData, error: tierError } = await supabase
              .rpc('get_user_tier_settings', { user_id: currentUser.id });
              
            if (tierError) throw tierError;
            
            const tierData = tierSettingsData as Record<string, any> || {};
            const globalDiscovery = tierData && typeof tierData === 'object' && 'global_discovery' in tierData 
              ? Boolean(tierData.global_discovery) 
              : false;
            
            // Get potential matches based on location and tier settings
            const { data: potentialUsers, error: matchError } = await supabase
              .rpc('find_users_within_distance', { 
                user_id: currentUser.id,
                max_distance: maxDistance,
                global_search: globalDiscovery
              });
              
            if (matchError) throw matchError;
            
            // Filter out users that have already been matched or passed
            const { data: existingLikes, error: likesError } = await supabase
              .from('likes')
              .select('liked_id')
              .eq('liker_id', currentUser.id);
              
            if (likesError) throw likesError;
            
            const likedIds = existingLikes ? existingLikes.map((like: any) => like.liked_id) : [];
            
            // Convert to UserProfile type
            const potentialData = potentialUsers as Record<string, any>[] || [];
            const filteredMatches = potentialData
              .filter((user: any) => !likedIds.includes(user.id))
              .map(supabaseToUserProfile);
            
            // Shuffle the array for randomization
            const shuffledMatches = filteredMatches.sort(() => Math.random() - 0.5);
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: currentUser.id,
                action: 'prefetch_potential_matches',
                details: { 
                  count: shuffledMatches.length,
                  max_distance: maxDistance,
                  global_discovery: globalDiscovery
                }
              });
            } catch (logError) {
              console.warn('Failed to log prefetch_potential_matches action:', getReadableError(logError));
            }
            
            set({ 
              cachedMatches: [...get().cachedMatches, ...shuffledMatches].slice(0, 50), 
              isPrefetching: false 
            });
          } else {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // For demo, we'll get users from AsyncStorage
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            // Filter out users that have already been matched or passed
            const { matches } = get();
            
            const matchedUserIds = matches.map((m: Match) => 
              m.userId === currentUser.id ? m.matchedUserId : m.userId
            );
            
            // Simulate global discovery based on membership tier
            const isGlobalDiscovery = tierSettings?.global_discovery || false;
            
            // Filter users based on location if not global discovery
            let filteredUsers = users.filter((u: UserProfile) => u.id !== currentUser.id);
            
            if (!isGlobalDiscovery && currentUser?.zipCode) {
              filteredUsers = filteredUsers.filter((u: UserProfile) => {
                if (!u.zipCode) return false;
                const zipDiff = Math.abs(
                  parseInt(u.zipCode.substring(0, 1)) - 
                  parseInt((currentUser?.zipCode || '0').substring(0, 1))
                );
                const distance = zipDiff * 10;
                return distance <= maxDistance;
              });
            }
            
            const potentialMatches = filteredUsers
              .filter((u: UserProfile) => !matchedUserIds.includes(u.id))
              .map(({ password, ...user }: any) => user);
            
            // Shuffle for randomization
            const shuffledMatches = potentialMatches.sort(() => Math.random() - 0.5);
            
            // Log the action in mock audit log
            const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
            const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
            auditLogs.push({
              id: `log-${Date.now()}`,
              user_id: currentUser.id,
              action: 'prefetch_potential_matches',
              details: { 
                count: shuffledMatches.length,
                max_distance: maxDistance,
                global_discovery: isGlobalDiscovery
              },
              timestamp: new Date().toISOString()
            });
            await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
            
            set({ 
              cachedMatches: [...get().cachedMatches, ...shuffledMatches].slice(0, 50), 
              isPrefetching: false 
            });
          }
        } catch (error) {
          console.error('Error prefetching potential matches:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isPrefetching: false 
          });
        }
      },

      likeUser: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          const tierSettings = useAuthStore.getState().tierSettings;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
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
          // In a real app, you might want to return a pending match or handle this differently
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
        set({ isLoading: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
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
        try {
          const currentUser = useAuthStore.getState().user;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
          const swipeAction: SwipeAction = {
            swiper_id: currentUser.id,
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
                matches: [...state.matches, ...typedMatches]
              }));
              
              // Return the first match for immediate feedback if needed
              // In the UI, you might want to show a match animation or notification
              console.log(`Batch processing created ${typedMatches.length} new matches`);
            }
            
            // Clear the swipe queue
            set({ swipeQueue: [], isLoading: false });
          } else {
            // Simulate batch processing for mock data
            const currentUser = useAuthStore.getState().user;
            const tierSettings = useAuthStore.getState().tierSettings;
            const dailySwipeLimit = tierSettings?.daily_swipe_limit || 10;
            const dailyMatchLimit = tierSettings?.daily_match_limit || 5;
            
            // Get today's timestamp
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();
            
            // Get mock data
            const mockLikes = await AsyncStorage.getItem('mockLikes');
            let likes = mockLikes ? JSON.parse(mockLikes) : [];
            
            // Count today's likes
            let todayLikesCount = likes.filter((like: any) => 
              like.likerId === currentUser?.id && like.timestamp >= todayTimestamp
            ).length;
            
            // Process each swipe in the queue
            let newLikes = [];
            let newMatches = [];
            
            for (const swipe of swipeQueue) {
              if (todayLikesCount >= dailySwipeLimit) {
                console.log("Swipe limit reached in mock batch processing");
                break;
              }
              
              if (swipe.direction === 'right') {
                newLikes.push({
                  likerId: swipe.swiper_id,
                  likedId: swipe.swipee_id,
                  timestamp: swipe.swipe_timestamp
                });
                
                // Check for match (reciprocal like)
                const isMatch = likes.some((like: any) => 
                  like.likerId === swipe.swipee_id && like.likedId === swipe.swiper_id
                );
                
                if (isMatch) {
                  // Check match limit
                  const mockMatches = await AsyncStorage.getItem('mockMatches');
                  const storedMatches = mockMatches ? JSON.parse(mockMatches) : [];
                  
                  const todayMatches = storedMatches.filter((m: any) => 
                    m.userId === currentUser?.id && m.createdAt >= todayTimestamp
                  ).length;
                  
                  if (todayMatches < dailyMatchLimit) {
                    const match = {
                      id: `match-${Date.now()}`,
                      userId: swipe.swiper_id,
                      matchedUserId: swipe.swipee_id,
                      createdAt: swipe.swipe_timestamp
                    };
                    newMatches.push(match);
                  }
                }
                
                todayLikesCount++;
              }
            }
            
            // Update storage
            likes = [...likes, ...newLikes];
            await AsyncStorage.setItem('mockLikes', JSON.stringify(likes));
            
            if (newMatches.length > 0) {
              const mockMatches = await AsyncStorage.getItem('mockMatches');
              let storedMatches = mockMatches ? JSON.parse(mockMatches) : [];
              storedMatches = [...storedMatches, ...newMatches];
              await AsyncStorage.setItem('mockMatches', JSON.stringify(storedMatches));
              
              set(state => ({
                matches: [...state.matches, ...newMatches]
              }));
            }
            
            // Log the batch processing
            const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
            const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
            auditLogs.push({
              id: `log-${Date.now()}`,
              user_id: currentUser?.id,
              action: 'batch_swipe_processed',
              details: { 
                swipe_count: swipeQueue.length,
                new_matches: newMatches.length
              },
              timestamp: new Date().toISOString()
            });
            await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
            
            // Clear the swipe queue
            set({ swipeQueue: [], isLoading: false });
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
        set({ isLoading: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
          if (isSupabaseConfigured() && supabase) {
            // Get matches from Supabase
            const { data: matchesData, error: matchesError } = await supabase
              .from('matches')
              .select('*')
              .or(`user_id.eq.${currentUser.id},matched_user_id.eq.${currentUser.id}`)
              .order('created_at', { ascending: false });
              
            if (matchesError) throw matchesError;
            
            // Convert to Match type
            const typedMatches: Match[] = (matchesData || []).map(supabaseToMatch);
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: currentUser.id,
                action: 'view_matches',
                details: { count: typedMatches.length }
              });
            } catch (logError) {
              console.warn('Failed to log view_matches action:', getReadableError(logError));
            }
            
            set({ matches: typedMatches, isLoading: false });
          } else {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get matches from storage
            const mockMatches = await AsyncStorage.getItem('mockMatches');
            const allMatches = mockMatches ? JSON.parse(mockMatches) : [];
            
            // Filter matches for the current user
            const userMatches = allMatches.filter((match: Match) => 
              match.userId === currentUser.id || match.matchedUserId === currentUser.id
            );
            
            // Log the action in mock audit log
            const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
            const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
            auditLogs.push({
              id: `log-${Date.now()}`,
              user_id: currentUser.id,
              action: 'view_matches',
              details: { count: userMatches.length },
              timestamp: new Date().toISOString()
            });
            await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
            
            set({ matches: userMatches, isLoading: false });
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
        set({ potentialMatches: [], cachedMatches: [] });
        await get().fetchPotentialMatches(50, true);
      },

      clearError: () => set({ error: null })
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
    const { swipeQueue } = useMatchesStore.getState();
    if (swipeQueue.length > 0) {
      console.log(`Periodic batch processing: ${swipeQueue.length} swipes in queue`);
      await useMatchesStore.getState().processSwipeBatch();
    }
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
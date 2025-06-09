import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Match, UserProfile, MembershipTier } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
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
  matches: Match[];
  isLoading: boolean;
  error: string | null;
  fetchPotentialMatches: (maxDistance?: number) => Promise<void>;
  likeUser: (userId: string) => Promise<Match | null>;
  passUser: (userId: string) => Promise<void>;
  getMatches: () => Promise<void>;
  clearError: () => void;
}

export const useMatchesStore = create<MatchesState>()(
  persist(
    (set, get) => ({
      potentialMatches: [],
      matches: [],
      isLoading: false,
      error: null,

      fetchPotentialMatches: async (maxDistance = 50) => {
        set({ isLoading: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
          if (isSupabaseConfigured() && supabase) {
            // Get user's tier settings to check if global discovery is enabled
            const { data: tierSettings, error: tierError } = await supabase
              .rpc('get_user_tier_settings', { user_id: currentUser.id });
              
            if (tierError) throw tierError;
            
            const tierData = tierSettings as Record<string, any> || {};
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
            
            // Log the action
            try {
              await supabase.rpc('log_user_action', {
                user_id: currentUser.id,
                action: 'fetch_potential_matches',
                details: { 
                  count: filteredMatches.length,
                  max_distance: maxDistance,
                  global_discovery: globalDiscovery
                }
              });
            } catch (logError) {
              console.warn('Failed to log fetch_potential_matches action:', getReadableError(logError));
            }
            
            set({ potentialMatches: filteredMatches, isLoading: false });
          } else {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // For demo, we'll get users from AsyncStorage
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            // Filter out users that have already been matched or passed
            // In a real app, this would be handled by the backend
            const { matches } = get();
            
            const matchedUserIds = matches.map(m => 
              m.userId === currentUser.id ? m.matchedUserId : m.userId
            );
            
            // Simulate global discovery based on membership tier
            const isGlobalDiscovery = currentUser.membershipTier === 'gold';
            
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
            
            // Log the action in mock audit log
            const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
            const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
            auditLogs.push({
              id: `log-${Date.now()}`,
              user_id: currentUser.id,
              action: 'fetch_potential_matches',
              details: { 
                count: potentialMatches.length,
                max_distance: maxDistance,
                global_discovery: isGlobalDiscovery
              },
              timestamp: new Date().toISOString()
            });
            await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
            
            set({ potentialMatches, isLoading: false });
          }
        } catch (error) {
          console.error('Error fetching potential matches:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      likeUser: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const currentUser = useAuthStore.getState().user;
          
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          
          if (isSupabaseConfigured() && supabase) {
            // Check user's daily like limit
            const { data: tierSettings, error: tierError } = await supabase
              .rpc('get_user_tier_settings', { user_id: currentUser.id });
              
            if (tierError) throw tierError;
            
            const tierData = tierSettings as Record<string, any> || {};
            const dailySwipeLimit = tierData && typeof tierData === 'object' && 'daily_swipe_limit' in tierData 
              ? Number(tierData.daily_swipe_limit) 
              : 10;
            
            // Count today's likes
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();
            
            const { count: todayLikes, error: countError } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .eq('liker_id', currentUser.id)
              .gte('timestamp', todayTimestamp);
              
            if (countError) throw countError;
              
            const likesCount = todayLikes ?? 0;
            
            if (likesCount >= dailySwipeLimit) {
              throw new Error(`You've reached your daily swipe limit of ${dailySwipeLimit}. Upgrade your membership for more swipes!`);
            }
            
            // Record the like
            const { error: likeError } = await supabase
              .from('likes')
              .insert({
                liker_id: currentUser.id,
                liked_id: userId,
                timestamp: Date.now()
              });
              
            if (likeError) throw likeError;
            
            // Check if it's a match (other user already liked current user)
            const { data: otherLike, error: matchCheckError } = await supabase
              .from('likes')
              .select('*')
              .eq('liker_id', userId)
              .eq('liked_id', currentUser.id)
              .single();
              
            if (matchCheckError && matchCheckError.code !== 'PGRST116') {
              throw matchCheckError;
            }
            
            // If it's a match, create a match record
            let match = null;
            if (otherLike) {
              // Count today's matches
              const { count: todayMatches, error: matchCountError } = await supabase
                .from('matches')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .gte('created_at', todayTimestamp);
                
              if (matchCountError) throw matchCountError;
              
              const matchesCount = todayMatches ?? 0;
              const dailyMatchLimit = tierData && typeof tierData === 'object' && 'daily_match_limit' in tierData 
                ? Number(tierData.daily_match_limit) 
                : 5;
              
              if (matchesCount >= dailyMatchLimit) {
                // Still like, but don't create match
                try {
                  await supabase.rpc('log_user_action', {
                    user_id: currentUser.id,
                    action: 'match_limit_reached',
                    details: { matched_user_id: userId }
                  });
                } catch (logError) {
                  console.warn('Failed to log match_limit_reached action:', getReadableError(logError));
                }
              } else {
                // Create the match
                const newMatch: Match = {
                  id: `match-${Date.now()}`,
                  userId: currentUser.id,
                  matchedUserId: userId,
                  createdAt: Date.now()
                };
                
                // Convert Match to snake_case for Supabase
                const matchRecord = convertToSnakeCase(newMatch);
                
                const { error: createMatchError } = await supabase
                  .from('matches')
                  .insert(matchRecord);
                  
                if (createMatchError) throw createMatchError;
                
                // Log the match
                try {
                  await supabase.rpc('log_user_action', {
                    user_id: currentUser.id,
                    action: 'new_match',
                    details: { matched_user_id: userId }
                  });
                } catch (logError) {
                  console.warn('Failed to log new_match action:', getReadableError(logError));
                }
                
                const { matches } = get();
                set({ matches: [...matches, newMatch] });
                match = newMatch;
              }
            } else {
              // Log the like
              try {
                await supabase.rpc('log_user_action', {
                  user_id: currentUser.id,
                  action: 'like_user',
                  details: { liked_user_id: userId }
                });
              } catch (logError) {
                console.warn('Failed to log like_user action:', getReadableError(logError));
              }
            }
            
            // Remove the liked user from potential matches
            const { potentialMatches } = get();
            const updatedPotentialMatches = potentialMatches.filter(
              (u: UserProfile) => u.id !== userId
            );
            
            set({ potentialMatches: updatedPotentialMatches, isLoading: false });
            return match;
          } else {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get tier settings from mock data
            const tierLimits: Record<string, { swipes: number, matches: number }> = {
              basic: { swipes: 10, matches: 5 },
              bronze: { swipes: 10, matches: 5 },
              silver: { swipes: 30, matches: 15 },
              gold: { swipes: 100, matches: 50 }
            };
            
            const userTier = currentUser.membershipTier || 'basic';
            const dailySwipeLimit = tierLimits[userTier]?.swipes || 10;
            const dailyMatchLimit = tierLimits[userTier]?.matches || 5;
            
            // Check if user has reached daily swipe limit
            const mockLikes = await AsyncStorage.getItem('mockLikes');
            const likes = mockLikes ? JSON.parse(mockLikes) : [];
            
            // Count today's likes
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTimestamp = today.getTime();
            
            const todayLikes = likes.filter((like: any) => 
              like.likerId === currentUser.id && like.timestamp >= todayTimestamp
            ).length;
            
            if (todayLikes >= dailySwipeLimit) {
              throw new Error(`You've reached your daily swipe limit of ${dailySwipeLimit}. Upgrade your membership for more swipes!`);
            }
            
            // Store the like
            likes.push({
              likerId: currentUser.id,
              likedId: userId,
              timestamp: Date.now()
            });
            
            await AsyncStorage.setItem('mockLikes', JSON.stringify(likes));
            
            // Check if the other user has already liked the current user
            const isMatch = likes.some((like: any) => 
              like.likerId === userId && like.likedId === currentUser.id
            );
            
            // If it's a match, create a match record
            let match = null;
            if (isMatch) {
              // Check if user has reached daily match limit
              const mockMatches = await AsyncStorage.getItem('mockMatches');
              const storedMatches = mockMatches ? JSON.parse(mockMatches) : [];
              
              // Count today's matches
              const todayMatches = storedMatches.filter((m: any) => 
                m.userId === currentUser.id && m.createdAt >= todayTimestamp
              ).length;
              
              if (todayMatches >= dailyMatchLimit) {
                // Log the match limit reached
                const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
                const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
                auditLogs.push({
                  id: `log-${Date.now()}`,
                  user_id: currentUser.id,
                  action: 'match_limit_reached',
                  details: { matched_user_id: userId },
                  timestamp: new Date().toISOString()
                });
                await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
              } else {
                // Create the match
                const newMatch: Match = {
                  id: `match-${Date.now()}`,
                  userId: currentUser.id,
                  matchedUserId: userId,
                  createdAt: Date.now()
                };
                
                storedMatches.push(newMatch);
                await AsyncStorage.setItem('mockMatches', JSON.stringify(storedMatches));
                
                // Log the match
                const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
                const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
                auditLogs.push({
                  id: `log-${Date.now()}`,
                  user_id: currentUser.id,
                  action: 'new_match',
                  details: { matched_user_id: userId },
                  timestamp: new Date().toISOString()
                });
                await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
                
                const { matches } = get();
                set({ matches: [...matches, newMatch] });
                match = newMatch;
              }
            } else {
              // Log the like
              const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
              const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
              auditLogs.push({
                id: `log-${Date.now()}`,
                user_id: currentUser.id,
                action: 'like_user',
                details: { liked_user_id: userId },
                timestamp: new Date().toISOString()
              });
              await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
            }
            
            // Remove the liked user from potential matches
            const { potentialMatches } = get();
            const updatedPotentialMatches = potentialMatches.filter(
              (u: UserProfile) => u.id !== userId
            );
            
            set({ potentialMatches: updatedPotentialMatches, isLoading: false });
            return match;
          }
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
          
          if (isSupabaseConfigured() && supabase) {
            // Log the pass action
            try {
              await supabase.rpc('log_user_action', {
                user_id: currentUser.id,
                action: 'pass_user',
                details: { passed_user_id: userId }
              });
            } catch (logError) {
              console.warn('Failed to log pass_user action:', getReadableError(logError));
            }
          } else {
            // Log the pass action in mock audit log
            const mockAuditLog = await AsyncStorage.getItem('mockAuditLog');
            const auditLogs = mockAuditLog ? JSON.parse(mockAuditLog) : [];
            auditLogs.push({
              id: `log-${Date.now()}`,
              user_id: currentUser.id,
              action: 'pass_user',
              details: { passed_user_id: userId },
              timestamp: new Date().toISOString()
            });
            await AsyncStorage.setItem('mockAuditLog', JSON.stringify(auditLogs));
          }
          
          // Remove the passed user from potential matches
          const { potentialMatches } = get();
          const updatedPotentialMatches = potentialMatches.filter(
            (u: UserProfile) => u.id !== userId
          );
          
          set({ potentialMatches: updatedPotentialMatches, isLoading: false });
        } catch (error) {
          console.error('Error passing user:', getReadableError(error));
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

      clearError: () => set({ error: null })
    }),
    {
      name: 'matches-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
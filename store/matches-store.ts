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
            // Supabase is required - no fallback to mock data
            throw new Error('Database connection required. Please check your internet connection and try again.');
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
            // Supabase is required - no fallback to mock data
            throw new Error('Database connection required. Please check your internet connection and try again.');
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
            // Supabase is required - no fallback to mock data
            throw new Error('Database connection required. Please check your internet connection and try again.');
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
            // Supabase is required - no fallback to mock data
            throw new Error('Database connection required. Please check your internet connection and try again.');
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
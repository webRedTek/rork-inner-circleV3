import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, MembershipTier, TierSettings, UserRole, UsageCache } from '@/types/user';
import { isSupabaseConfigured, supabase, initSupabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { Platform } from 'react-native';

interface AuthState {
  user: UserProfile | null;
  tierSettings: TierSettings | null;
  usageCache: UsageCache | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean; // Indicates if initial session check is complete
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<UserProfile>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateMembership: (tier: MembershipTier) => Promise<void>;
  fetchTierSettings: (userId: string) => Promise<void>;
  fetchUsageData: (userId: string) => Promise<void>;
  checkLimit: (actionType: string, limit: number) => boolean;
  incrementUsage: (actionType: string) => Promise<void>;
  clearError: () => void;
  clearCache: () => Promise<void>;
  checkSession: () => Promise<void>; // Method to check/restore session on app start
}

// Helper function to extract readable error message from Supabase error
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.details || error.hint || error.code) {
    return `Supabase Error: ${error.code || 'N/A'} - ${error.details || error.message || 'Unknown'} ${error.hint ? `(Hint: ${error.hint})` : ''}`;
  }
  
  try {
    return JSON.stringify(error, null, 2);
  } catch (e) {
    return 'An error occurred, but it could not be parsed';
  }
};

// Helper function to convert Supabase response to UserProfile type
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    email: String(camelCaseData.email || ''),
    role: String(camelCaseData.role || 'user') as UserRole,
    name: String(camelCaseData.name || ''),
    bio: String(camelCaseData.bio || ''),
    location: String(camelCaseData.location || ''),
    zipCode: String(camelCaseData.zipCode || ''),
    latitude: Number(camelCaseData.latitude || 0),
    longitude: Number(camelCaseData.longitude || 0),
    preferredDistance: Number(camelCaseData.preferredDistance || 50),
    locationPrivacy: String(camelCaseData.locationPrivacy || 'public') as UserProfile["locationPrivacy"],
    businessField: (String(camelCaseData.businessField || 'Technology')) as UserProfile["businessField"],
    entrepreneurStatus: (String(camelCaseData.entrepreneurStatus || 'upcoming')) as UserProfile["entrepreneurStatus"],
    photoUrl: String(camelCaseData.photoUrl || ''),
    membershipTier: (String(camelCaseData.membershipTier || 'basic')) as MembershipTier,
    businessVerified: Boolean(camelCaseData.businessVerified || false),
    joinedGroups: Array.isArray(camelCaseData.joinedGroups) ? camelCaseData.joinedGroups : [],
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    lookingFor: Array.isArray(camelCaseData.lookingFor) ? camelCaseData.lookingFor as UserProfile["lookingFor"] : [],
    businessStage: camelCaseData.businessStage as UserProfile["businessStage"] || 'Idea Phase',
    skillsOffered: Array.isArray(camelCaseData.skillsOffered) ? camelCaseData.skillsOffered as UserProfile["skillsOffered"] : [],
    skillsSeeking: Array.isArray(camelCaseData.skillsSeeking) ? camelCaseData.skillsSeeking as UserProfile["skillsSeeking"] : [],
    keyChallenge: String(camelCaseData.keyChallenge || ''),
    industryFocus: String(camelCaseData.industryFocus || ''),
    availabilityLevel: Array.isArray(camelCaseData.availabilityLevel) ? camelCaseData.availabilityLevel as UserProfile["availabilityLevel"] : [],
    timezone: String(camelCaseData.timezone || ''),
    successHighlight: String(camelCaseData.successHighlight || ''),
  };
};

// Default tier settings for fallback
const defaultTierSettings: TierSettings = {
  daily_swipe_limit: 10,
  daily_match_limit: 5,
  message_sending_limit: 20,
  can_see_who_liked_you: false,
  can_rewind_last_swipe: false,
  boost_duration: 0,
  boost_frequency: 0,
  profile_visibility_control: false,
  priority_listing: false,
  premium_filters_access: false,
  global_discovery: false,
  groups_limit: 0,
  groups_creation_limit: 0,
  featured_portfolio_limit: 0,
  events_per_month: 0,
  can_create_groups: false,
  has_business_verification: false,
  has_advanced_analytics: false,
  has_priority_inbox: false,
  can_send_direct_intro: false,
  has_virtual_meeting_room: false,
  has_custom_branding: false,
  has_dedicated_support: false,
};

// Default usage cache
const defaultUsageCache: UsageCache = {
  lastSyncTimestamp: 0,
  usageData: {},
  premiumFeatures: {
    boostMinutesRemaining: 0,
    boostUsesRemaining: 0,
  },
  analytics: {
    profileViews: 0,
    searchAppearances: 0,
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tierSettings: null,
      usageCache: null,
      isAuthenticated: false,
      isLoading: false,
      isReady: false, // Initially false until session check is complete
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Login attempt with email:', email);
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            console.log('Using Supabase for login');
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (error) {
              console.error('Supabase login error:', error);
              throw error;
            }

            console.log('Supabase login successful, fetching profile...');
            const { data: profileData, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError) {
              console.error('Profile fetch error:', profileError);
              if (profileError.code === 'PGRST116') {
                const newProfile: UserProfile = {
                  id: data.user.id,
                  email: data.user.email || email,
                  name: email.split('@')[0],
                  bio: '',
                  location: '',
                  zipCode: '',
                  latitude: 0,
                  longitude: 0,
                  preferredDistance: 50,
                  locationPrivacy: 'public',
                  businessField: 'Technology',
                  entrepreneurStatus: 'upcoming',
                  photoUrl: '',
                  membershipTier: 'basic',
                  businessVerified: false,
                  joinedGroups: [],
                  createdAt: Date.now(),
                  lookingFor: [],
                  businessStage: 'Idea Phase',
                  skillsOffered: [],
                  skillsSeeking: [],
                  keyChallenge: '',
                  industryFocus: '',
                  availabilityLevel: [],
                  timezone: '',
                  successHighlight: '',
                };
                
                const profileRecord = convertToSnakeCase(newProfile);
                
                console.log('Creating new profile in Supabase...');
                const { error: insertError } = await supabase
                  .from('users')
                  .insert(profileRecord);
                
                if (insertError) {
                  console.error('Profile insert error:', insertError);
                  throw insertError;
                }
                
                set({
                  user: newProfile,
                  isAuthenticated: true,
                  isLoading: false,
                });
                // Fetch tier settings after creating profile
                await get().fetchTierSettings(data.user.id);
                await get().fetchUsageData(data.user.id);
              } else {
                throw profileError;
              }
            } else {
              const userProfile = supabaseToUserProfile(profileData);
              console.log('Profile fetched successfully:', userProfile.name);
              
              set({
                user: userProfile,
                isAuthenticated: true,
                isLoading: false,
              });
              // Fetch tier settings after login
              await get().fetchTierSettings(data.user.id);
              await get().fetchUsageData(data.user.id);
            }
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Login error:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      signup: async (userData: Partial<UserProfile>, password: string) => {
        set({ isLoading: true, error: null });
        try {
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            try {
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              console.log('Attempting Supabase signup with email:', userData.email);
              
              if (!supabase.auth) {
                throw new Error('Supabase auth is not initialized properly');
              }
              
              const { data, error } = await supabase.auth.signUp({
                email: userData.email!,
                password,
                options: {
                  data: {
                    name: userData.name,
                  }
                }
              });

              if (error) {
                console.error('Supabase signup error details:', getReadableError(error));
                throw error;
              }

              const newUser: UserProfile = {
                id: data.user?.id || `user-${Date.now()}`,
                email: userData.email!,
                name: userData.name || userData.email!.split('@')[0],
                bio: userData.bio || '',
                location: userData.location || '',
                zipCode: userData.zipCode || '',
                latitude: userData.latitude || 0,
                longitude: userData.longitude || 0,
                preferredDistance: userData.preferredDistance || 50,
                locationPrivacy: userData.locationPrivacy || 'public',
                businessField: userData.businessField || 'Technology',
                entrepreneurStatus: userData.entrepreneurStatus || 'upcoming',
                photoUrl: userData.photoUrl || '',
                membershipTier: 'basic',
                businessVerified: false,
                joinedGroups: [],
                createdAt: Date.now(),
                lookingFor: userData.lookingFor || [],
                businessStage: userData.businessStage || 'Idea Phase',
                skillsOffered: userData.skillsOffered || [],
                skillsSeeking: userData.skillsSeeking || [],
                keyChallenge: userData.keyChallenge || '',
                industryFocus: userData.industryFocus || '',
                availabilityLevel: userData.availabilityLevel || [],
                timezone: userData.timezone || '',
                successHighlight: userData.successHighlight || '',
                ...userData
              };

              const profileRecord = convertToSnakeCase(newUser);
              
              console.log('Creating user profile in Supabase:', profileRecord);
              
              const { error: profileError } = await supabase
                .from('users')
                .insert(profileRecord);

              if (profileError) {
                console.error('Error creating user profile in Supabase:', getReadableError(profileError));
                throw profileError;
              }
              
              console.log('User profile created successfully in Supabase');
              set({
                user: newUser,
                isAuthenticated: true,
                isLoading: false,
              });
              // Fetch tier settings after signup
              if (data.user?.id) {
                await get().fetchTierSettings(data.user.id);
                await get().fetchUsageData(data.user.id);
              }
            } catch (supabaseError) {
              console.error('Supabase signup error:', getReadableError(supabaseError));
              throw new Error('Signup failed with Supabase');
            }
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Signup error:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          const { user } = get();
          
          if (isSupabaseConfigured() && supabase && user) {
            const { error } = await supabase.auth.signOut();
            if (error) {
              console.warn('Supabase signOut error:', getReadableError(error));
            }
          }
          
          await AsyncStorage.removeItem('auth-storage');
          
          set({ user: null, tierSettings: null, usageCache: null, isAuthenticated: false, isLoading: false });
          
          console.log('Logout successful');
          return;
        } catch (error) {
          console.error('Logout error:', getReadableError(error));
          await AsyncStorage.removeItem('auth-storage');
          set({ user: null, tierSettings: null, usageCache: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateProfile: async (data: Partial<UserProfile>) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = get();
          if (!user) throw new Error('Not authenticated');
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            const profileRecord = convertToSnakeCase(data);
            
            const { error } = await supabase
              .from('users')
              .update(profileRecord)
              .eq('id', user.id);

            if (error) throw error;

            set({
              user: { ...user, ...data },
              isLoading: false,
            });
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Update profile error:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      updateMembership: async (tier: MembershipTier) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = get();
          if (!user) throw new Error('Not authenticated');
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            const { error } = await supabase
              .from('users')
              .update({ membership_tier: tier })
              .eq('id', user.id);

            if (error) throw error;

            set({
              user: { ...user, membershipTier: tier },
              isLoading: false,
            });
            // Refresh tier settings after membership update
            await get().fetchTierSettings(user.id);
          } else {
            throw new Error('Supabase is not configured');
          }
        } catch (error) {
          console.error('Update membership error:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      fetchTierSettings: async (userId: string) => {
        // Guard clause to prevent fetching if user ID is invalid
        if (!userId || userId.trim() === '' || !isSupabaseConfigured() || !supabase) {
          console.log('Skipping tier settings fetch: Invalid user ID or Supabase not configured', { 
            userId, 
            supabaseConfigured: isSupabaseConfigured(),
            hasSupabase: !!supabase
          });
          set({ tierSettings: defaultTierSettings, isLoading: false });
          return;
        }

        // Don't fetch if we're already loading
        if (get().isLoading) {
          console.log('Skipping tier settings fetch: Already loading');
          return;
        }

        set({ isLoading: true, error: null });
        try {
          console.log('Fetching tier settings for user:', userId);
          const { data: tierSettings, error: tierError } = await supabase
            .rpc('get_user_tier_settings', { p_user_id: userId });
            
          if (tierError) {
            console.error('Error fetching tier settings:', JSON.stringify(tierError, null, 2));
            set({ tierSettings: defaultTierSettings, isLoading: false });
          } else {
            console.log('Tier settings fetched successfully:', tierSettings);
            set({ tierSettings: tierSettings as TierSettings, isLoading: false });
          }
        } catch (error) {
          console.error('Fetch tier settings error:', JSON.stringify(error, null, 2));
          set({ 
            tierSettings: defaultTierSettings,
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      fetchUsageData: async (userId: string) => {
        if (!userId || userId.trim() === '' || !isSupabaseConfigured() || !supabase) {
          console.log('Skipping usage data fetch: Invalid user ID or Supabase not configured', { 
            userId, 
            supabaseConfigured: isSupabaseConfigured(),
            hasSupabase: !!supabase
          });
          set({ usageCache: defaultUsageCache });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          console.log('Fetching usage data for user:', userId);
          const { data: usageData, error: usageError } = await supabase
            .from('usage_tracking')
            .select('*')
            .eq('user_id', userId);

          if (usageError) {
            console.error('Error fetching usage data:', JSON.stringify(usageError, null, 2));
            set({ usageCache: defaultUsageCache, isLoading: false });
          } else {
            const usageCache: UsageCache = {
              lastSyncTimestamp: Date.now(),
              usageData: {},
              premiumFeatures: {
                boostMinutesRemaining: 0,
                boostUsesRemaining: 0,
              },
              analytics: {
                profileViews: 0,
                searchAppearances: 0,
              },
            };

            usageData?.forEach(entry => {
              usageCache.usageData[entry.action_type] = {
                currentCount: entry.count,
                firstActionTimestamp: entry.first_action_timestamp || Date.now(),
                lastActionTimestamp: entry.last_action_timestamp || Date.now(),
                resetTimestamp: entry.reset_timestamp || Date.now() + 24 * 60 * 60 * 1000,
              };
            });

            console.log('Usage data fetched successfully:', usageCache);
            set({ usageCache, isLoading: false });
          }
        } catch (error) {
          console.error('Fetch usage data error:', JSON.stringify(error, null, 2));
          set({ 
            usageCache: defaultUsageCache,
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      checkLimit: (actionType: string, limit: number) => {
        const { usageCache } = get();
        if (!usageCache || !usageCache.usageData[actionType]) {
          return true; // Allow action if no usage data is available
        }

        const now = Date.now();
        const usage = usageCache.usageData[actionType];
        if (now > usage.resetTimestamp) {
          // Reset count if past reset timestamp
          set(state => ({
            usageCache: state.usageCache ? {
              ...state.usageCache,
              usageData: {
                ...state.usageCache.usageData,
                [actionType]: {
                  ...state.usageCache.usageData[actionType],
                  currentCount: 0,
                  resetTimestamp: now + 24 * 60 * 60 * 1000, // Reset after 24 hours
                },
              },
            } : state.usageCache,
          }));
          return true;
        }

        return usage.currentCount < limit;
      },

      incrementUsage: async (actionType: string) => {
        const { user, usageCache } = get();
        if (!user || !usageCache) return;

        const now = Date.now();
        const usageData = usageCache.usageData[actionType];
        const resetTimestamp = usageData?.resetTimestamp || now + 24 * 60 * 60 * 1000;
        const updatedCount = usageData ? usageData.currentCount + 1 : 1;

        set(state => ({
          usageCache: state.usageCache ? {
            ...state.usageCache,
            usageData: {
              ...state.usageCache.usageData,
              [actionType]: {
                currentCount: updatedCount,
                firstActionTimestamp: usageData?.firstActionTimestamp || now,
                lastActionTimestamp: now,
                resetTimestamp,
              },
            },
          } : state.usageCache,
        }));

        if (isSupabaseConfigured() && supabase) {
          try {
            await supabase.rpc('log_user_action', {
              user_id: user.id,
              action: actionType,
              details: { timestamp: now },
            });
          } catch (error) {
            console.warn('Failed to log user action:', getReadableError(error));
          }
        }
      },

      clearError: () => set({ error: null }),
      
      clearCache: async () => {
        try {
          console.log('Clearing auth cache...');
          await AsyncStorage.removeItem('auth-storage');
          set({ 
            user: null, 
            tierSettings: null,
            usageCache: null,
            isAuthenticated: false, 
            isLoading: false,
            error: null
          });
          
          console.log('Auth cache cleared successfully');
        } catch (error) {
          console.error('Error clearing auth cache:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      checkSession: async () => {
        set({ isLoading: true, error: null });
        try {
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              console.error('Error checking session:', error);
              set({ isReady: true, isLoading: false, isAuthenticated: false });
              return;
            }

            if (data.session && data.session.user) {
              const { data: profileData, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.session.user.id)
                .single();

              if (profileError) {
                console.error('Error fetching user profile on session check:', profileError);
                set({ isReady: true, isLoading: false, isAuthenticated: false });
                return;
              }

              const userProfile = supabaseToUserProfile(profileData);
              set({
                user: userProfile,
                isAuthenticated: true,
                isReady: true,
                isLoading: false,
              });
              // Fetch tier settings only after confirming session and user ID
              await get().fetchTierSettings(data.session.user.id);
              await get().fetchUsageData(data.session.user.id);
            } else {
              set({ isReady: true, isLoading: false, isAuthenticated: false });
            }
          } else {
            set({ isReady: true, isLoading: false, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Session check error:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isReady: true,
            isLoading: false,
            isAuthenticated: false
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
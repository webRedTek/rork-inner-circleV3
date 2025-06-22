import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, MembershipTier, TierSettings } from '@/types/user';
import { isSupabaseConfigured, supabase, initSupabase, convertToCamelCase, convertToSnakeCase, retryOperation } from '@/lib/supabase';
import { Platform } from 'react-native';
import { useNotificationStore } from './notification-store';
import NetInfo from '@react-native-community/netinfo';
import { useUsageStore } from './usage-store';

interface AuthState {
  user: UserProfile | null;
  tierSettings: TierSettings | null;
  tierSettingsTimestamp: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  networkStatus: { isConnected: boolean | null; type?: string | null; } | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<UserProfile>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateMembership: (tier: MembershipTier) => Promise<void>;
  fetchTierSettings: (userId: string, forceRefresh?: boolean) => Promise<void>;
  getTierSettings: () => TierSettings | null;
  invalidateTierSettingsCache: () => Promise<void>;
  clearError: () => void;
  clearCache: () => Promise<void>;
  checkSession: () => Promise<void>;
  checkNetworkConnection: () => Promise<void>;
}

// Helper function to extract readable error message from Supabase error
const getReadableError = (error: any): string => {
  if (!error) return 'An error occurred. Please try again.';
  
  if (typeof error === 'string') return error;
  
  if (error.message) {
    if (error.message.includes('Failed to fetch') || error.message.includes('Network') || error.message.includes('offline') || error.message.includes('AuthRetryableFetchError')) {
      return 'Unable to connect. Please check your internet connection and try again.';
    }
    return error.message;
  }
  
  if (error.details || error.hint || error.code) {
    return `Error: ${error.code || 'Unknown'} - ${error.details || error.message || 'Something went wrong.'}`;
  }
  
  try {
    return JSON.stringify(error, null, 2);
  } catch (e) {
    return 'An error occurred, but it could not be parsed. Please try again.';
  }
};

// Helper function to convert Supabase response to UserProfile type
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    email: String(camelCaseData.email || ''),
    name: String(camelCaseData.name || ''),
		role: String(camelCaseData.role || 'member') as UserRole,
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

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tierSettings: null,
      tierSettingsTimestamp: null,
      isAuthenticated: false,
      isLoading: false,
      isReady: false,
      error: null,
      networkStatus: null,

      checkNetworkConnection: async () => {
        try {
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
        } catch (error) {
          console.error('Error checking network connection:', error);
          set({ networkStatus: { isConnected: null } });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          console.log('Login attempt with email:', email);
          
          // Check network connectivity first
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          
          if (state.isConnected === false) {
            throw new Error('No internet connection. Please check your network and try again.');
          }
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            console.log('Using database for login');
            
            // Use retry operation for login
            const { data, error } = await retryOperation(async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase.auth.signInWithPassword({
                email,
                password,
              });
            });

            if (error) {
              console.error('Login error:', error);
              throw error;
            }

            console.log('Login successful, fetching profile...');
            
            // Use retry operation for profile fetch
            const { data: profileData, error: profileError } = await retryOperation(async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();
            });

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
                
                console.log('Creating new profile in database...');
                
                // Use retry operation for profile creation
                const { error: insertError } = await retryOperation(async () => {
                  if (!supabase) throw new Error('Supabase client is not initialized');
                  return await supabase
                    .from('users')
                    .insert(profileRecord);
                });
                
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
                // Initialize usage tracking
                await useUsageStore.getState().initializeUsage(data.user.id);
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
              // Initialize usage tracking
              await useUsageStore.getState().initializeUsage(data.user.id);
            }
          } else {
            throw new Error('Authentication service is not configured');
          }
        } catch (error) {
          console.error('Login error:', getReadableError(error));
          
          // Check if it's a network-related error
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('Failed to fetch') || 
              errorMsg.includes('Network') || 
              errorMsg.includes('offline') ||
              errorMsg.includes('AuthRetryableFetchError')) {
            // Re-check network status
            const state = await NetInfo.fetch();
            set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          }
          
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      signup: async (userData: Partial<UserProfile>, password: string) => {
        set({ isLoading: true, error: null });
        try {
          // Check network connectivity first
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          
          if (state.isConnected === false) {
            throw new Error('No internet connection. Please check your network and try again.');
          }
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            try {
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              console.log('Attempting signup with email:', userData.email);
              
              if (!supabase.auth) {
                throw new Error('Authentication service is not initialized properly');
              }
              
              // Use retry operation for signup
              const { data, error } = await retryOperation(async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase.auth.signUp({
                  email: userData.email!,
                  password,
                  options: {
                    data: {
                      name: userData.name,
                    }
                  }
                });
              });

              if (error) {
                console.error('Signup error details:', getReadableError(error));
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
              
              console.log('Creating user profile in database:', profileRecord);
              
              // Use retry operation for profile creation
              const { error: profileError } = await retryOperation(async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .insert(profileRecord);
              });

              if (profileError) {
                console.error('Error creating user profile in database:', getReadableError(profileError));
                throw profileError;
              }
              
              console.log('User profile created successfully in database');
              set({
                user: newUser,
                isAuthenticated: true,
                isLoading: false,
              });
              // Fetch tier settings after signup
              if (data.user?.id) {
                await get().fetchTierSettings(data.user.id);
                // Initialize usage tracking
                await useUsageStore.getState().initializeUsage(data.user.id);
              }
            } catch (authError) {
              console.error('Signup error:', getReadableError(authError));
              throw new Error('Signup failed. Please try again.');
            }
          } else {
            throw new Error('Authentication service is not configured');
          }
        } catch (error) {
          console.error('Signup error:', getReadableError(error));
          
          // Check if it's a network-related error
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('Failed to fetch') || 
              errorMsg.includes('Network') || 
              errorMsg.includes('offline') ||
              errorMsg.includes('AuthRetryableFetchError')) {
            // Re-check network status
            const state = await NetInfo.fetch();
            set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          }
          
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
            try {
              // Use retry operation for logout
              const { error } = await retryOperation(async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase.auth.signOut();
              }, 2); // Only retry twice for logout
              
              if (error) {
                console.warn('Sign out error:', getReadableError(error));
              }
            } catch (error) {
              console.warn('Error during sign out:', getReadableError(error));
            }
          }
          
          await AsyncStorage.removeItem('auth-storage');
          
          set({ user: null, tierSettings: null, tierSettingsTimestamp: null, isAuthenticated: false, isLoading: false });
          
          console.log('Logout successful');
          useNotificationStore.getState().addNotification({
            type: 'success',
            message: 'Successfully logged out',
            displayStyle: 'toast',
            duration: 3000,
          });
          return;
        } catch (error) {
          console.error('Logout error:', getReadableError(error));
          await AsyncStorage.removeItem('auth-storage');
          set({ user: null, tierSettings: null, tierSettingsTimestamp: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateProfile: async (data: Partial<UserProfile>) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = get();
          if (!user) throw new Error('Not authenticated');
          
          // Check network connectivity first
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          
          if (state.isConnected === false) {
            throw new Error('No internet connection. Please check your network and try again.');
          }
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            const profileRecord = convertToSnakeCase(data);
            
            // Use retry operation for profile update
            const { error } = await retryOperation(async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('users')
                .update(profileRecord)
                .eq('id', user.id);
            });

            if (error) throw error;

            set({
              user: { ...user, ...data },
              isLoading: false,
            });
          } else {
            throw new Error('Database is not configured');
          }
        } catch (error) {
          console.error('Update profile error:', getReadableError(error));
          
          // Check if it's a network-related error
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('Failed to fetch') || 
              errorMsg.includes('Network') || 
              errorMsg.includes('offline') ||
              errorMsg.includes('AuthRetryableFetchError')) {
            // Re-check network status
            const state = await NetInfo.fetch();
            set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          }
          
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
          
          // Check network connectivity first
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          
          if (state.isConnected === false) {
            throw new Error('No internet connection. Please check your network and try again.');
          }
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            // Use retry operation for membership update
            const { error } = await retryOperation(async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('users')
                .update({ membership_tier: tier })
                .eq('id', user.id);
            });

            if (error) throw error;

            set({
              user: { ...user, membershipTier: tier },
              isLoading: false,
            });
            // Refresh tier settings after membership update
            await get().fetchTierSettings(user.id, true);
          } else {
            throw new Error('Database is not configured');
          }
        } catch (error) {
          console.error('Update membership error:', getReadableError(error));
          
          // Check if it's a network-related error
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('Failed to fetch') || 
              errorMsg.includes('Network') || 
              errorMsg.includes('offline') ||
              errorMsg.includes('AuthRetryableFetchError')) {
            // Re-check network status
            const state = await NetInfo.fetch();
            set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          }
          
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      fetchTierSettings: async (userId: string, forceRefresh = false) => {
        // Guard clause to prevent fetching if user ID is invalid
        if (!userId || userId.trim() === '' || !isSupabaseConfigured() || !supabase) {
          console.log('Skipping tier settings fetch: Invalid user ID or database not configured', { 
            userId, 
            supabaseConfigured: isSupabaseConfigured(),
            hasSupabase: !!supabase
          });
          throw new Error('Cannot fetch tier settings: Invalid user ID or Supabase not configured');
        }

        // Check if cached settings are still valid (less than 24 hours old)
        const { tierSettingsTimestamp } = get();
        const now = Date.now();
        if (!forceRefresh && tierSettingsTimestamp && (now - tierSettingsTimestamp) < CACHE_EXPIRATION_TIME) {
          console.log('Using cached tier settings', { ageInHours: (now - tierSettingsTimestamp) / (60 * 60 * 1000) });
          return;
        }

        // Don't fetch if we're already loading
        if (get().isLoading && !forceRefresh) {
          console.log('Skipping tier settings fetch: Already loading');
          return;
        }

        set({ isLoading: true, error: null });
        try {
          // Check network connectivity first
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          
          if (state.isConnected === false) {
            console.warn('Network appears to be offline. Cannot fetch tier settings.');
            throw new Error('Network appears to be offline. Cannot fetch tier settings.');
          }
          
          console.log('Fetching tier settings for user:', userId);
          
          // Use retry operation for tier settings fetch
          const { data: tierSettings, error: tierError } = await retryOperation(async () => {
            if (!supabase) throw new Error('Supabase client is not initialized');
            return await supabase
              .rpc('get_user_tier_settings', { p_user_id: userId });
          });
            
          if (tierError) {
            console.error('Error fetching tier settings:', JSON.stringify(tierError, null, 2));
            throw new Error(`Failed to fetch tier settings: ${getReadableError(tierError)}`);
          } else {
            console.log('Tier settings fetched successfully:', tierSettings);
            set({ 
              tierSettings: tierSettings as TierSettings, 
              tierSettingsTimestamp: now,
              isLoading: false 
            });
          }
        } catch (error) {
          console.error('Fetch tier settings error:', JSON.stringify(error, null, 2));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
          throw new Error(`Error fetching tier settings: ${getReadableError(error)}`);
        }
      },

      getTierSettings: () => {
        const { tierSettings, tierSettingsTimestamp } = get();
        const now = Date.now();
        if (tierSettings && tierSettingsTimestamp && (now - tierSettingsTimestamp) < CACHE_EXPIRATION_TIME) {
          return tierSettings;
        }
        throw new Error('Tier settings not available or cache expired');
      },

      invalidateTierSettingsCache: async () => {
        set({ tierSettingsTimestamp: null });
        const { user } = get();
        if (user) {
          await get().fetchTierSettings(user.id, true);
        }
        console.log('Tier settings cache invalidated');
        useNotificationStore.getState().addNotification({
          type: 'success',
          message: 'Tier settings refreshed',
          displayStyle: 'toast',
          duration: 3000,
        });
      },

      clearError: () => set({ error: null }),
      
      clearCache: async () => {
        try {
          console.log('Clearing auth cache...');
          await AsyncStorage.removeItem('auth-storage');
          set({ 
            user: null, 
            tierSettings: null,
            tierSettingsTimestamp: null,
            isAuthenticated: false, 
            isLoading: false,
            error: null
          });
          
          console.log('Auth cache cleared successfully');
          useNotificationStore.getState().addNotification({
            type: 'success',
            message: 'App cache cleared successfully',
            displayStyle: 'toast',
            duration: 3000,
          });
        } catch (error) {
          console.error('Error clearing auth cache:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: 'Failed to clear app cache',
            displayStyle: 'toast',
            duration: 5000,
          });
        }
      },

      checkSession: async () => {
        set({ isLoading: true, error: null });
        try {
          // Check network connectivity first
          const state = await NetInfo.fetch();
          set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          
          if (state.isConnected === false) {
            console.warn('Network appears to be offline. Session check may fail.');
          }
          
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            // Use retry operation for session check
            const { data, error } = await retryOperation(async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase.auth.getSession();
            });
            
            if (error) {
              console.error('Error checking session:', error);
              set({ isReady: true, isLoading: false, isAuthenticated: false });
              return;
            }

            if (data.session && data.session.user) {
              // Use retry operation for profile fetch
              const { data: profileData, error: profileError } = await retryOperation(async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .select('*')
                  .eq('id', data.session.user.id)
                  .single();
              });

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
            } else {
              set({ isReady: true, isLoading: false, isAuthenticated: false });
            }
          } else {
            set({ isReady: true, isLoading: false, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Session check error:', getReadableError(error));
          
          // Check if it's a network-related error
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (errorMsg.includes('Failed to fetch') || 
              errorMsg.includes('Network') || 
              errorMsg.includes('offline') ||
              errorMsg.includes('AuthRetryableFetchError')) {
            // Re-check network status
            const state = await NetInfo.fetch();
            set({ networkStatus: { isConnected: state.isConnected, type: state.type } });
          }
          
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
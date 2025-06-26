import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, MembershipTier, TierSettings, UserRole } from '@/types/user';
import { isSupabaseConfigured, supabase, initSupabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { Platform } from 'react-native';
import { useNotificationStore } from './notification-store';
import NetInfo from '@react-native-community/netinfo';
import { useUsageStore, startUsageSync, stopUsageSync } from './usage-store';
import { handleError, withErrorHandling, withRetry, ErrorCodes, ErrorCategory, showError } from '@/utils/error-utils';
import { checkNetworkStatus, withNetworkCheck } from '@/utils/network-utils';

interface AuthState {
  user: UserProfile | null;
  tierSettings: TierSettings | null;
  tierSettingsTimestamp: number | null;
  hasFetchedTierSettingsThisSession: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  networkStatus: { isConnected: boolean | null; type?: string | null; } | null;
  updateNetworkStatus: (status: { isConnected: boolean | null; type?: string | null; }) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<UserProfile>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateMembership: (tier: MembershipTier) => Promise<void>;
  fetchTierSettings: (userId: string) => Promise<void>;
  getTierSettings: () => TierSettings | null;
  invalidateTierSettingsCache: () => Promise<void>;
  clearError: () => void;
  clearCache: () => Promise<void>;
  checkSession: () => Promise<void>;
  checkNetworkConnection: () => Promise<void>;
}

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

// Helper function to create a default user profile
const createDefaultProfile = (userId: string, email: string): UserProfile => ({
  id: userId,
  email: email,
  name: email.split('@')[0],
  role: 'member',
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
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tierSettings: null,
      tierSettingsTimestamp: null,
      hasFetchedTierSettingsThisSession: false,
      isAuthenticated: false,
      isLoading: false,
      isReady: false,
      error: null,
      networkStatus: null,

      updateNetworkStatus: (status) => {
        set({ networkStatus: status });
      },

      checkNetworkConnection: async () => {
        await withErrorHandling(
          async () => {
            await checkNetworkStatus();
          },
          {
            silent: true,
            customErrorMessage: 'Network connection check failed'
          }
        );
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await withNetworkCheck(async () => {
            await initSupabase();
            
            if (!isSupabaseConfigured() || !supabase) {
              throw {
                category: ErrorCategory.AUTH,
                code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
                message: 'Authentication service is not configured'
              };
            }

            // Login operation
            const { data, error } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase.auth.signInWithPassword({ email, password });
              },
              {
                maxRetries: 3,
                shouldRetry: (error) => error.category === ErrorCategory.NETWORK
              }
            );

            if (error) throw error;

            // Profile fetch operation
            const { data: profileData, error: profileError } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .select('*')
                  .eq('id', data.user.id)
                  .single();
              }
            );

            if (profileError?.code === 'PGRST116') {
              // Create new profile if it doesn't exist
              const newProfile = createDefaultProfile(data.user.id, email);
              const profileRecord = convertToSnakeCase(newProfile);

              const { error: insertError } = await withRetry(
                async () => {
                  if (!supabase) throw new Error('Supabase client is not initialized');
                  return await supabase
                    .from('users')
                    .insert(profileRecord);
                }
              );

              if (insertError) throw insertError;

              set({
                user: newProfile,
                isAuthenticated: true,
                isLoading: false
              });

              // Initialize services
              await get().fetchTierSettings(data.user.id);
              await useUsageStore.getState().initializeUsage(data.user.id);
            } else if (profileError) {
              throw profileError;
            } else {
              const userProfile = supabaseToUserProfile(profileData || {});
              await useUsageStore.getState().initializeUsage(userProfile.id);

              set({
                user: userProfile,
                isAuthenticated: true,
                isLoading: false,
                error: null
              });
            }
          });
        } catch (error) {
          const appError = handleError(error);
          set({
            isLoading: false,
            error: appError.userMessage
          });
          throw appError;
        }
      },

      signup: async (userData: Partial<UserProfile>, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await withNetworkCheck(async () => {
            await initSupabase();
            
            if (!isSupabaseConfigured() || !supabase) {
              throw {
                category: ErrorCategory.AUTH,
                code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
                message: 'Authentication service is not configured'
              };
            }

            // Signup operation
            const { data, error } = await withRetry(
              async () => {
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
              }
            );

            if (error) throw error;

            const newUser = {
              ...createDefaultProfile(data.user?.id || `user-${Date.now()}`, userData.email!),
              ...userData
            };

            // Create profile
            const { error: profileError } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .insert(convertToSnakeCase(newUser));
              }
            );

            if (profileError) throw profileError;

            set({
              user: newUser,
              isAuthenticated: true,
              isLoading: false
            });

            if (data.user?.id) {
              await get().fetchTierSettings(data.user.id);
              await useUsageStore.getState().initializeUsage(data.user.id);
            }
          });
        } catch (error) {
          const appError = handleError(error);
          set({
            error: appError.userMessage,
            isLoading: false
          });
        }
      },

      logout: async () => {
        await withErrorHandling(
          async () => {
            if (isSupabaseConfigured() && supabase) {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
            }
            
            set({
              user: null,
              isAuthenticated: false,
              hasFetchedTierSettingsThisSession: false,
              tierSettingsTimestamp: null
            });
            
            stopUsageSync();
          },
          {
            customErrorMessage: 'Failed to log out. Please try again.'
          }
        );
      },

      updateProfile: async (data: Partial<UserProfile>) => {
        set({ isLoading: true, error: null });
        
        try {
          const { user } = get();
          if (!user) {
            throw {
              category: ErrorCategory.AUTH,
              code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
              message: 'Not authenticated'
            };
          }
          
          await withNetworkCheck(async () => {
            await initSupabase();
            
            if (!isSupabaseConfigured() || !supabase) {
              throw {
                category: ErrorCategory.DATABASE,
                code: ErrorCodes.DB_CONNECTION_ERROR,
                message: 'Database is not configured'
              };
            }

            const { error } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .update(convertToSnakeCase(data))
                  .eq('id', user.id);
              }
            );

            if (error) throw error;

            set({
              user: { ...user, ...data },
              isLoading: false
            });
          });
        } catch (error) {
          const appError = handleError(error);
          set({
            error: appError.userMessage,
            isLoading: false
          });
        }
      },

      updateMembership: async (tier: MembershipTier) => {
        set({ isLoading: true, error: null });
        
        try {
          const { user } = get();
          if (!user) {
            throw {
              category: ErrorCategory.AUTH,
              code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
              message: 'Not authenticated'
            };
          }
          
          await withNetworkCheck(async () => {
            await initSupabase();
            
            if (!isSupabaseConfigured() || !supabase) {
              throw {
                category: ErrorCategory.DATABASE,
                code: ErrorCodes.DB_CONNECTION_ERROR,
                message: 'Database is not configured'
              };
            }

            const { error } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .update({ membership_tier: tier })
                  .eq('id', user.id);
              }
            );

            if (error) throw error;

            set({
              user: { ...user, membershipTier: tier },
              isLoading: false
            });

            await get().fetchTierSettings(user.id);
          });
        } catch (error) {
          const appError = handleError(error);
          set({
            error: appError.userMessage,
            isLoading: false
          });
        }
      },

      fetchTierSettings: async (userId: string) => {
        try {
          await withNetworkCheck(async () => {
            await initSupabase();
            
            if (!isSupabaseConfigured() || !supabase) {
              throw {
                category: ErrorCategory.DATABASE,
                code: ErrorCodes.DB_CONNECTION_ERROR,
                message: 'Database is not configured'
              };
            }

            const { data, error } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .rpc('get_user_tier_settings', { user_id: userId });
              }
            );

            if (error) throw error;

            set({
              tierSettings: data,
              tierSettingsTimestamp: Date.now(),
              hasFetchedTierSettingsThisSession: true
            });
          });
        } catch (error) {
          // Silent error handling for background fetches
          console.error('Error fetching tier settings:', error);
        }
      },

      getTierSettings: () => {
        const { tierSettings, user } = get();
        
        if (tierSettings) {
          if (user && !get().hasFetchedTierSettingsThisSession) {
            get().fetchTierSettings(user.id).catch(() => {
              // Silently handle errors - using cached settings
            });
          }
          return tierSettings;
        }
        
        if (user) {
          get().fetchTierSettings(user.id).catch(() => {
            // Silently handle errors
          });
        }
        
        return null;
      },

      invalidateTierSettingsCache: async () => {
        const { user } = get();
        if (user) {
          set({
            hasFetchedTierSettingsThisSession: false,
            tierSettingsTimestamp: null
          });
          await get().fetchTierSettings(user.id);
        }
      },

      clearError: () => set({ error: null }),

      clearCache: async () => {
        await withErrorHandling(
          async () => {
            await AsyncStorage.removeItem('auth-storage');
            set({
              user: null,
              tierSettings: null,
              tierSettingsTimestamp: null,
              hasFetchedTierSettingsThisSession: false,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });
            
            useNotificationStore.getState().addNotification({
              type: 'success',
              message: 'App cache cleared successfully',
              displayStyle: 'toast',
              duration: 3000,
            });
          },
          {
            customErrorMessage: 'Failed to clear cache. Please try again.'
          }
        );
      },

      checkSession: async () => {
        try {
          await initSupabase();
          
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.AUTH,
              code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
              message: 'Authentication service is not configured'
            };
          }

          const { data: { session }, error } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase.auth.getSession();
            }
          );

          if (error) throw error;

          if (session?.user) {
            const { data: profileData, error: profileError } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('users')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
              }
            );

            if (profileError) throw profileError;

            const userProfile = supabaseToUserProfile(profileData || {});
            await useUsageStore.getState().initializeUsage(userProfile.id);
            startUsageSync();

            await get().fetchTierSettings(userProfile.id);

            set({
              user: userProfile,
              isAuthenticated: true,
              isReady: true,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isReady: true,
            });
          }
        } catch (error) {
          const appError = handleError(error);
          set({
            user: null,
            isAuthenticated: false,
            isReady: true,
            error: appError.userMessage,
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tierSettings: state.tierSettings,
        tierSettingsTimestamp: state.tierSettingsTimestamp,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
/**
 * FILE: store/auth-store.ts
 * LAST UPDATED: 2024-12-20 17:30
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes early in app startup after AsyncStorage is ready
 * 2. Requires AsyncStorage and Supabase config to be initialized
 * 3. Initializes user authentication state and tier settings
 * 4. All other stores depend on this being initialized
 * 5. Race condition: Must wait for AsyncStorage hydration before accessing state
 * 
 * CURRENT STATE:
 * Central authentication and user management store using Zustand. Handles user login,
 * signup, profile management, tier settings, and session management. Provides
 * tier settings access that is used by matches-store and other stores for feature
 * permissions and limits. Now includes cache validation to ensure data consistency
 * across user sessions.
 * 
 * RECENT CHANGES:
 * - Fixed fetchAllTierSettings to ensure proper error handling and data validation
 * - Improved tier settings cache management with better error messages
 * - Enhanced getTierSettings to provide more helpful error messages
 * - Added better loading state management for tier settings
 * - Preserved tier settings cache while refreshing other store data
 * 
 * FILE INTERACTIONS:
 * - Imports from: user types (UserProfile, MembershipTier, TierSettings, UserRole)
 * - Imports from: supabase lib (authentication, database operations)
 * - Imports from: usage-store (usage tracking initialization and sync)
 * - Imports from: matches-store (cache management)
 * - Imports from: groups-store (cache management)
 * - Imports from: messages-store (cache management)
 * - Imports from: affiliate-store (cache management)
 * - Imports from: notification-store (success notifications)
 * - Imports from: error-utils, network-utils (error handling and network checks)
 * - Exports to: All stores and screens that need user data or tier settings
 * - Dependencies: AsyncStorage (persistence), Zustand (state management)
 * - Data flow: Manages user authentication state, provides tier settings to other
 *   stores, coordinates with usage tracking, handles profile updates, manages
 *   cache consistency across user sessions
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - login/signup: User authentication with profile creation and cache validation
 * - validateAndRefreshCache: Ensures data consistency when different user logs in
 * - getTierSettings: Returns tier settings for current user (used by matches-store)
 * - fetchAllTierSettings: Loads all tier settings from database
 * - updateProfile/updateMembership: Profile and membership management
 * - checkSession: Session validation and restoration
 * - clearCache: Cache management for troubleshooting
 * - Network status tracking and error handling
 */

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
import { useMatchesStore } from './matches-store';
import { useGroupsStore } from './groups-store';
import { useMessagesStore } from './messages-store';
import { useAffiliateStore } from './affiliate-store';
import { useDebugStore } from './debug-store';
import { useSubscriptionStore } from './subscription-store';

interface AuthState {
  user: UserProfile | null;
  allTierSettings: Record<MembershipTier, TierSettings> | null;
  userTierSettings: TierSettings | null;
  tierSettingsTimestamp: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  networkStatus: { isConnected: boolean | null; type?: string | null; } | null;
  updateNetworkStatus: (status: { isConnected: boolean | null; type?: string | null; }) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<UserProfile>, password: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateMembership: (tier: MembershipTier) => Promise<void>;
  fetchAllTierSettings: () => Promise<void>;
  getTierSettings: () => TierSettings | null;
  invalidateTierSettingsCache: () => Promise<void>;
  clearError: () => void;
  clearCache: () => Promise<void>;
  checkSession: () => Promise<void>;
  checkNetworkConnection: () => Promise<void>;
  validateAndRefreshCache: (newUserId: string) => Promise<void>;
  initializeTierSettings: () => Promise<void>;
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
    membershipTier: (String(camelCaseData.membershipTier || 'bronze')) as MembershipTier,
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
  membershipTier: 'bronze',
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
      allTierSettings: null,
      userTierSettings: null,
      tierSettingsTimestamp: null,
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

      validateAndRefreshCache: async (newUserId: string) => {
        const { user } = get();
        
        // If there's cached data and the user ID doesn't match
        if (user && user.id !== newUserId) {
          set({ isLoading: true });
          
          // Clear matches, groups, and messages data
          useMatchesStore.getState().resetCacheAndState();
          useGroupsStore.getState().clearGroups();
          useMessagesStore.getState().clearMessages();
          
          // Reset usage tracking data
          useUsageStore.getState().resetUsage();
          
          // Reset affiliate data
          useAffiliateStore.getState().resetAffiliateCache();
          
          // Fetch fresh data (removed fetchPotentialMatches to avoid duplicates)
          await Promise.all([
            useGroupsStore.getState().fetchGroups(),
            useMessagesStore.getState().fetchMessages(),
            useUsageStore.getState().initializeUsage(newUserId),
            useAffiliateStore.getState().fetchAffiliateData()
          ]);
          
          set({ isLoading: false });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await withNetworkCheck(async () => {
            try {
              await initSupabase();
            } catch (error) {
              throw {
                category: ErrorCategory.AUTH,
                code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
                message: error instanceof Error ? error.message : 'Failed to initialize authentication service.'
              };
            }
            
            if (!isSupabaseConfigured() || !supabase) {
              throw {
                category: ErrorCategory.AUTH,
                code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
                message: 'Authentication service is not configured.'
              };
            }

            // Login operation
            const { data: authData, error: authError } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase.auth.signInWithPassword({ email, password });
              },
              {
                maxRetries: 3,
                shouldRetry: (error) => error.category === ErrorCategory.NETWORK
              }
            );

            if (authError) throw authError;

            const userId = authData.user?.id;
            if (!userId) {
              throw new Error('No user ID returned from authentication');
            }

            // Fetch user profile
            const { data: profileData, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .single();

            if (profileError) throw profileError;

            const userProfile = supabaseToUserProfile(profileData);
            
            set({ 
              user: userProfile,
              isAuthenticated: true,
              isReady: true
            });

            // Initialize tier settings AFTER user is set
            await get().fetchAllTierSettings();
            await get().initializeTierSettings();

            // Initialize usage store AFTER successful authentication (non-blocking)
            try {
              await useUsageStore.getState().initializeUsage(userId);
              // Start sync once after 60 seconds - call directly from usage store
              setTimeout(async () => {
                await useUsageStore.getState().syncUsageData(userId);
              }, 60 * 1000);
            } catch (error) {
              // Don't block authentication if usage store fails
            }

            // Initialize subscription store AFTER successful authentication (non-blocking)
            try {
              await useSubscriptionStore.getState().initialize(userId);
            } catch (error) {
              // Don't block authentication if subscription store fails
              console.warn('Failed to initialize subscription store:', error);
            }

            // Validate and refresh cache for the new user
            await get().validateAndRefreshCache(userId);
          });
        } catch (error) {
          const appError = handleError(error);
          set({ error: appError.userMessage });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      signup: async (userData: Partial<UserProfile>, password: string, referralCode?: string) => {
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

            // Create affiliate referral if referral code was provided
            if (referralCode && referralCode.trim() && data.user?.id) {
              console.log('Attempting to create affiliate referral:', {
                referralCode: referralCode.trim(),
                userId: data.user.id
              });
              
              try {
                const { data: referralResult, error: referralError } = await supabase.rpc(
                  'create_affiliate_referral',
                  {
                    p_referral_code: referralCode.trim(),
                    p_referred_user_id: data.user.id
                  }
                );

                if (referralError) {
                  console.warn('Failed to create affiliate referral:', referralError);
                  console.warn('Error details:', {
                    message: referralError.message,
                    details: referralError.details,
                    hint: referralError.hint
                  });
                  // Don't fail signup if referral creation fails
                } else {
                  console.log('Affiliate referral created successfully:', referralResult);
                }
              } catch (referralError) {
                console.warn('Error creating affiliate referral:', referralError);
                console.warn('Exception details:', referralError);
                // Don't fail signup if referral creation fails
              }
            } else {
              console.log('No referral code provided or missing user ID:', {
                hasReferralCode: !!referralCode,
                referralCodeLength: referralCode?.length,
                hasUserId: !!data.user?.id,
                userId: data.user?.id
              });
            }

            set({
              user: newUser,
              isAuthenticated: true,
              isLoading: false
            });

            if (data.user?.id) {
              // Load tier settings for new user
              await get().fetchAllTierSettings();
              await get().initializeTierSettings();
              await useUsageStore.getState().initializeUsage(data.user.id);
              
              // Initialize subscription store for new user (non-blocking)
              try {
                await useSubscriptionStore.getState().initialize(data.user.id);
              } catch (error) {
                console.warn('Failed to initialize subscription store for new user:', error);
              }
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
              allTierSettings: null,
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
                  .eq('id', user!.id);
              }
            );

            if (error) throw error;

            set({
              user: { ...user!, membershipTier: tier },
              isLoading: false
            });

            // Fetch new tier settings after membership change
            await get().invalidateTierSettingsCache();
          });
        } catch (error) {
          const appError = handleError(error);
          set({
            error: appError.userMessage,
            isLoading: false
          });
        }
      },

      fetchAllTierSettings: async () => {
        const { useDebugStore } = require('@/store/debug-store');
        const { isDebugMode, addDebugLog } = useDebugStore.getState();
        
        const { allTierSettings, tierSettingsTimestamp } = get();
        
        // Check if cache is still valid (24 hours TTL)
        const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const now = Date.now();
        const isCacheValid = allTierSettings && tierSettingsTimestamp && (now - tierSettingsTimestamp) < CACHE_TTL;
        
        if (isCacheValid) {
          if (isDebugMode) {
            addDebugLog({
              event: 'fetchAllTierSettings Cache Hit',
              status: 'info',
              details: `Using cached tier settings (age: ${Math.round((now - tierSettingsTimestamp!) / (1000 * 60))} minutes)`,
              source: 'auth-store',
              data: {
                cacheAge: now - tierSettingsTimestamp!,
                cacheValidUntil: tierSettingsTimestamp! + CACHE_TTL,
                tierCount: Object.keys(allTierSettings).length
              }
            });
          }
          return; // Use cached tier settings
        }
        
        if (isDebugMode) {
          addDebugLog({
            event: 'fetchAllTierSettings Started',
            status: 'info',
            details: allTierSettings ? 'Refreshing stale tier settings cache' : 'Fetching tier settings for first time',
            source: 'auth-store',
            data: {
              hadCache: !!allTierSettings,
              cacheAge: tierSettingsTimestamp ? now - tierSettingsTimestamp : null,
              reason: !allTierSettings ? 'No cache' : 'Cache expired'
            }
          });
        }

        try {
          await withNetworkCheck(async () => {
            await initSupabase();
            
            if (!isSupabaseConfigured() || !supabase) {
              throw new Error('Supabase not configured for tier settings fetch');
            }

            if (isDebugMode) {
              addDebugLog({
                event: 'fetchAllTierSettings Database Query',
                status: 'info',
                details: 'Querying app_settings table for all tier configurations',
                source: 'auth-store'
              });
            }

            const queryStartTime = Date.now();
            const { data, error } = await supabase
              .from('app_settings')
              .select('*');
            const queryDuration = Date.now() - queryStartTime;

            if (error) throw error;

            if (!data || !Array.isArray(data)) {
              throw new Error('Invalid tier settings data format');
            }

            if (isDebugMode) {
              addDebugLog({
                event: 'fetchAllTierSettings Data Received',
                status: 'success',
                details: `Received ${data.length} tier settings from database (${queryDuration}ms)`,
                data: {
                  queryDuration,
                  tierCount: data.length,
                  tiers: data.map(tier => ({
                    tier: tier.tier,
                    limits: {
                      swipe: tier.daily_swipe_limit,
                      match: tier.daily_match_limit,
                      message: tier.message_sending_limit,
                      like: tier.daily_like_limit
                    }
                  }))
                },
                source: 'auth-store'
              });
            }

            const settings: Record<MembershipTier, TierSettings> = {} as Record<MembershipTier, TierSettings>;
            data.forEach(tier => {
              const tierData = convertToCamelCase(tier);
              settings[tierData.tier as MembershipTier] = tierData as TierSettings;
            });

            set({ 
              allTierSettings: settings,
              tierSettingsTimestamp: Date.now()
            });
            
            // Update userTierSettings if user exists
            const { user } = get();
            if (user && settings[user.membershipTier]) {
              set({ userTierSettings: settings[user.membershipTier] });
            }

            if (isDebugMode) {
              addDebugLog({
                event: 'fetchAllTierSettings Completed',
                status: 'success',
                details: `Successfully cached ${Object.keys(settings).length} tier settings (valid for 24 hours)`,
                data: {
                  tierNames: Object.keys(settings),
                  cacheTimestamp: Date.now(),
                  cacheValidUntil: Date.now() + CACHE_TTL
                },
                source: 'auth-store'
              });
            }
          });
        } catch (error) {
          const appError = handleError(error);
          
          if (isDebugMode) {
            addDebugLog({
              event: 'fetchAllTierSettings Failed',
              status: 'error',
              details: `Failed to fetch tier settings: ${appError.userMessage}`,
              data: {
                error: appError.userMessage,
                originalError: error,
                fallbackToCache: !!allTierSettings
              },
              source: 'auth-store'
            });
          }

          // If we have cached data (even if stale), use it and warn user
          if (allTierSettings) {
            if (isDebugMode) {
              addDebugLog({
                event: 'fetchAllTierSettings Using Stale Cache',
                status: 'warning',
                details: 'Using stale cached tier settings due to fetch failure',
                source: 'auth-store'
              });
            }
            
            useNotificationStore.getState().addNotification({
              type: 'warning',
              message: 'Using cached tier settings - some limits may be outdated',
              displayStyle: 'toast',
              duration: 5000
            });
            return; // Use stale cache rather than failing
          }

          useNotificationStore.getState().addNotification({
            type: 'error',
            message: appError.userMessage,
            displayStyle: 'toast',
            duration: 5000
          });
          throw error;
        }
      },

      initializeTierSettings: async () => {
        try {
          const { user } = get();
          if (!user) {
            // Don't block authentication if no user
            return;
          }
          
          // Fetch fresh tier settings first
          await get().fetchAllTierSettings();
          
          // Then load rate limits using the tier settings
          await useUsageStore.getState().loadRateLimits(user.id);
        } catch (error) {
          // Debug logging failure shouldn't block login
          try {
            const { useDebugStore } = require('@/store/debug-store');
            const { isDebugMode, addDebugLog } = useDebugStore.getState();
            
            if (isDebugMode) {
              addDebugLog({
                event: 'Tier settings initialization failed',
                status: 'error',
                details: 'Failed to initialize tier settings after authentication',
                source: 'auth-store',
                data: { error: error instanceof Error ? error.message : 'Unknown error' }
              });
            }
          } catch (debugError) {
            // Debug logging failure shouldn't block login
          }
        }
      },

      getTierSettings: () => {
        const { userTierSettings } = get();
        return userTierSettings;
      },

      invalidateTierSettingsCache: async () => {
        set({ allTierSettings: null, tierSettingsTimestamp: null });
        await get().fetchAllTierSettings();
      },

      clearError: () => set({ error: null }),

      clearCache: async () => {
        await withErrorHandling(
          async () => {
            await AsyncStorage.removeItem('auth-storage');
            set({
              user: null,
              allTierSettings: null,
              tierSettingsTimestamp: null,
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
            
            set({
              user: userProfile,
              isAuthenticated: true,
              isReady: true,
            });

            // Initialize tier settings AFTER user is set
            await get().fetchAllTierSettings();
            await get().initializeTierSettings();

            // Initialize usage tracking AFTER successful authentication (non-blocking)
            try {
              await useUsageStore.getState().initializeUsage(userProfile.id);
              // Start sync once after 60 seconds - call directly from usage store
              setTimeout(async () => {
                await useUsageStore.getState().syncUsageData(userProfile.id);
              }, 60 * 1000);
            } catch (error) {
              // Don't block authentication if usage store fails
            }

            // Initialize subscription store AFTER successful authentication (non-blocking)
            try {
              await useSubscriptionStore.getState().initialize(userProfile.id);
            } catch (error) {
              // Don't block authentication if subscription store fails
              console.warn('Failed to initialize subscription store:', error);
            }
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
      },

      // Authority methods - these are the "source of truth" for auth data
      getUserProfile: () => {
        return get().user;
      },

      isUserAuthenticated: () => {
        return get().isAuthenticated;
      },

      getUserRole: () => {
        const { user } = get();
        return user?.role || 'member';
      },

      getUserMembershipTier: () => {
        const { user } = get();
        return user?.membershipTier || 'bronze';
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
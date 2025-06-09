import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, MembershipTier } from '@/types/user';
import { isSupabaseConfigured, supabase, initSupabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { Platform } from 'react-native';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: Partial<UserProfile>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateMembership: (tier: MembershipTier) => Promise<void>;
  clearError: () => void;
  clearCache: () => Promise<void>;
}

// Helper function to extract readable error message from Supabase error
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
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

// Auth store with Supabase integration (falls back to mock if not configured)
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          await initSupabase();
          
          if (isSupabaseConfigured() && supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (error) throw error;

            const { data: profileData, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', data.user.id)
              .single();

            if (profileError) {
              if (profileError.code === 'PGRST116') {
                const newProfile: UserProfile = {
                  id: data.user.id,
                  email: data.user.email || email,
                  name: email.split('@')[0],
                  bio: '',
                  location: '',
                  zipCode: '',
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
                
                const { error: insertError } = await supabase
                  .from('users')
                  .insert(profileRecord);
                
                if (insertError) throw insertError;
                
                set({
                  user: newProfile,
                  isAuthenticated: true,
                  isLoading: false,
                });
              } else {
                throw profileError;
              }
            } else {
              const userProfile = supabaseToUserProfile(profileData);
              
              set({
                user: userProfile,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            const user = users.find((u: any) => 
              u.email === email && u.password === password
            );
            
            if (!user) {
              throw new Error('Invalid email or password');
            }
            
            const { password: _, ...userWithoutPassword } = user;
            
            set({ 
              user: userWithoutPassword as UserProfile, 
              isAuthenticated: true, 
              isLoading: false 
            });
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
            } catch (supabaseError) {
              console.error('Supabase signup error:', getReadableError(supabaseError));
              throw new Error('Signup failed with Supabase');
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            if (users.some((u: any) => u.email === userData.email)) {
              throw new Error('Email already in use');
            }
            
            const newUser = {
              id: `user-${Date.now()}`,
              email: userData.email!,
              name: userData.name || userData.email!.split('@')[0],
              bio: userData.bio || '',
              location: userData.location || '',
              zipCode: userData.zipCode || '',
              businessField: userData.businessField || 'Technology',
              entrepreneurStatus: userData.entrepreneurStatus || 'upcoming',
              photoUrl: userData.photoUrl || '',
              membershipTier: 'basic' as MembershipTier,
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
              ...userData,
              password
            };
            
            users.push(newUser);
            await AsyncStorage.setItem('mockUsers', JSON.stringify(users));
            
            const { password: _, ...userWithoutPassword } = newUser;
            
            set({ 
              user: userWithoutPassword as UserProfile, 
              isAuthenticated: true, 
              isLoading: false 
            });
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
          
          set({ user: null, isAuthenticated: false, isLoading: false });
          
          console.log('Logout successful');
          return;
        } catch (error) {
          console.error('Logout error:', getReadableError(error));
          await AsyncStorage.removeItem('auth-storage');
          set({ user: null, isAuthenticated: false, isLoading: false });
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
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            const updatedUsers = users.map((u: any) => {
              if (u.id === user.id) {
                return { ...u, ...data };
              }
              return u;
            });
            
            await AsyncStorage.setItem('mockUsers', JSON.stringify(updatedUsers));
            
            set({ 
              user: { ...user, ...data }, 
              isLoading: false 
            });
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
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const mockUsers = await AsyncStorage.getItem('mockUsers');
            const users = mockUsers ? JSON.parse(mockUsers) : [];
            
            const updatedUsers = users.map((u: any) => {
              if (u.id === user.id) {
                return { ...u, membershipTier: tier };
              }
              return u;
            });
            
            await AsyncStorage.setItem('mockUsers', JSON.stringify(updatedUsers));
            
            set({ 
              user: { ...user, membershipTier: tier }, 
              isLoading: false 
            });
          }
        } catch (error) {
          console.error('Update membership error:', getReadableError(error));
          set({ 
            error: getReadableError(error), 
            isLoading: false 
          });
        }
      },

      clearError: () => set({ error: null }),
      
      clearCache: async () => {
        try {
          console.log('Clearing auth cache...');
          await AsyncStorage.removeItem('auth-storage');
          
          set({ 
            user: null, 
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
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Group, UserProfile } from '@/types/user';
import { mockGroups } from '@/mocks/users';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';

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

// Helper function to convert Supabase response to Group type
const supabaseToGroup = (data: Record<string, any>): Group => {
  // First convert snake_case to camelCase
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    name: String(camelCaseData.name || ''),
    description: String(camelCaseData.description || ''),
    imageUrl: camelCaseData.imageUrl || '',
    memberIds: Array.isArray(camelCaseData.memberIds) ? camelCaseData.memberIds : [],
    createdBy: String(camelCaseData.createdBy || ''),
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    category: String(camelCaseData.category || ''),
    industry: camelCaseData.industry || undefined,
  };
};

interface GroupsState {
  groups: Group[];
  userGroups: Group[];
  availableGroups: Group[];
  isLoading: boolean;
  error: string | null;
  fetchGroups: () => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  createGroup: (groupData: Partial<Group>) => Promise<void>;
  clearError: () => void;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  userGroups: [],
  availableGroups: [],
  isLoading: false,
  error: null,

  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get current user
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Fetch groups from Supabase
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*');
          
        if (groupsError) throw groupsError;
        
        // Convert Supabase response to Group type
        const typedGroups: Group[] = (groupsData || []).map(supabaseToGroup);
        
        // Filter groups for the current user
        const userGroups = typedGroups.filter((group: Group) => 
          group.memberIds.includes(currentUser.id)
        );
        
        // Filter available groups (not joined by the user)
        const availableGroups = typedGroups.filter((group: Group) => 
          !group.memberIds.includes(currentUser.id)
        );
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'view_groups',
            details: { 
              user_groups_count: userGroups.length,
              available_groups_count: availableGroups.length
            }
          });
        } catch (logError) {
          console.warn('Failed to log view_groups action:', getReadableError(logError));
        }
        
        set({ 
          groups: typedGroups, 
          userGroups, 
          availableGroups, 
          isLoading: false 
        });
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Initialize mock groups if they don't exist
        const storedGroups = await AsyncStorage.getItem('mockGroups');
        if (!storedGroups) {
          await AsyncStorage.setItem('mockGroups', JSON.stringify(mockGroups));
        }
        
        // Get groups from storage
        const groups = storedGroups ? JSON.parse(storedGroups) : mockGroups;
        
        // Filter groups for the current user
        const userGroups = groups.filter((group: Group) => 
          group.memberIds.includes(currentUser.id)
        );
        
        // Filter available groups (not joined by the user)
        const availableGroups = groups.filter((group: Group) => 
          !group.memberIds.includes(currentUser.id)
        );
        
        set({ 
          groups, 
          userGroups, 
          availableGroups, 
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Error fetching groups:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  joinGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get current user
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Check membership tier restrictions
      if (currentUser.membershipTier === 'bronze') {
        throw new Error('Bronze members cannot join groups. Please upgrade to Silver or Gold.');
      }
      
      if (currentUser.membershipTier === 'silver') {
        // Silver members can only join one group
        const userGroups = get().userGroups;
        if (userGroups.length >= 1) {
          throw new Error('Silver members can only join one group. Please leave a group or upgrade to Gold.');
        }
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Get the group to update
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single();
          
        if (groupError) throw groupError;
        
        // Convert to Group type
        const group = supabaseToGroup(groupData || {});
        
        // Update the group with the new member
        const updatedMemberIds = [...group.memberIds, currentUser.id];
        
        const { error: updateError } = await supabase
          .from('groups')
          .update({ member_ids: updatedMemberIds })
          .eq('id', groupId);
          
        if (updateError) throw updateError;
        
        // Update user's joinedGroups
        const updatedJoinedGroups = [...currentUser.joinedGroups, groupId];
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ joined_groups: updatedJoinedGroups })
          .eq('id', currentUser.id);
          
        if (userUpdateError) throw userUpdateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'join_group',
            details: { group_id: groupId, group_name: group.name }
          });
        } catch (logError) {
          console.warn('Failed to log join_group action:', getReadableError(logError));
        }
        
        // Update auth store
        const authStorage = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}');
        if (authStorage.state) {
          authStorage.state.user = {
            ...authStorage.state.user,
            joinedGroups: updatedJoinedGroups
          };
          await AsyncStorage.setItem('auth-storage', JSON.stringify(authStorage));
        }
        
        // Refresh groups
        await get().fetchGroups();
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get groups from storage
        const storedGroups = await AsyncStorage.getItem('mockGroups');
        const groups = storedGroups ? JSON.parse(storedGroups) : [];
        
        // Update the group with the new member
        const updatedGroups = groups.map((group: Group) => {
          if (group.id === groupId) {
            return {
              ...group,
              memberIds: [...group.memberIds, currentUser.id]
            };
          }
          return group;
        });
        
        // Update user's joinedGroups
        const updatedUser = {
          ...currentUser,
          joinedGroups: [...currentUser.joinedGroups, groupId]
        };
        
        // Update in storage
        await AsyncStorage.setItem('mockGroups', JSON.stringify(updatedGroups));
        
        // Update user in storage
        const mockUsers = await AsyncStorage.getItem('mockUsers');
        const users = mockUsers ? JSON.parse(mockUsers) : [];
        
        const updatedUsers = users.map((u: any) => {
          if (u.id === currentUser.id) {
            return { ...u, joinedGroups: [...u.joinedGroups, groupId] };
          }
          return u;
        });
        
        await AsyncStorage.setItem('mockUsers', JSON.stringify(updatedUsers));
        
        // Update auth store
        const authStorage = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}');
        if (authStorage.state) {
          authStorage.state.user = updatedUser;
          await AsyncStorage.setItem('auth-storage', JSON.stringify(authStorage));
        }
        
        // Refresh groups
        await get().fetchGroups();
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error joining group:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  leaveGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get current user
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Get the group to update
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single();
          
        if (groupError) throw groupError;
        
        // Convert to Group type
        const group = supabaseToGroup(groupData || {});
        
        // Update the group by removing the member
        const updatedMemberIds = group.memberIds.filter((id: string) => id !== currentUser.id);
        
        const { error: updateError } = await supabase
          .from('groups')
          .update({ member_ids: updatedMemberIds })
          .eq('id', groupId);
          
        if (updateError) throw updateError;
        
        // Update user's joinedGroups
        const updatedJoinedGroups = currentUser.joinedGroups.filter((id: string) => id !== groupId);
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ joined_groups: updatedJoinedGroups })
          .eq('id', currentUser.id);
          
        if (userUpdateError) throw userUpdateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'leave_group',
            details: { group_id: groupId, group_name: group.name }
          });
        } catch (logError) {
          console.warn('Failed to log leave_group action:', getReadableError(logError));
        }
        
        // Update auth store
        const authStorage = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}');
        if (authStorage.state) {
          authStorage.state.user = {
            ...authStorage.state.user,
            joinedGroups: updatedJoinedGroups
          };
          await AsyncStorage.setItem('auth-storage', JSON.stringify(authStorage));
        }
        
        // Refresh groups
        await get().fetchGroups();
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get groups from storage
        const storedGroups = await AsyncStorage.getItem('mockGroups');
        const groups = storedGroups ? JSON.parse(storedGroups) : [];
        
        // Update the group by removing the member
        const updatedGroups = groups.map((group: Group) => {
          if (group.id === groupId) {
            return {
              ...group,
              memberIds: group.memberIds.filter((id: string) => id !== currentUser.id)
            };
          }
          return group;
        });
        
        // Update user's joinedGroups
        const updatedUser = {
          ...currentUser,
          joinedGroups: currentUser.joinedGroups.filter((id: string) => id !== groupId)
        };
        
        // Update in storage
        await AsyncStorage.setItem('mockGroups', JSON.stringify(updatedGroups));
        
        // Update user in storage
        const mockUsers = await AsyncStorage.getItem('mockUsers');
        const users = mockUsers ? JSON.parse(mockUsers) : [];
        
        const updatedUsers = users.map((u: any) => {
          if (u.id === currentUser.id) {
            return { 
              ...u, 
              joinedGroups: u.joinedGroups.filter((id: string) => id !== groupId) 
            };
          }
          return u;
        });
        
        await AsyncStorage.setItem('mockUsers', JSON.stringify(updatedUsers));
        
        // Update auth store
        const authStorage = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}');
        if (authStorage.state) {
          authStorage.state.user = updatedUser;
          await AsyncStorage.setItem('auth-storage', JSON.stringify(authStorage));
        }
        
        // Refresh groups
        await get().fetchGroups();
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error leaving group:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  createGroup: async (groupData: Partial<Group>) => {
    set({ isLoading: true, error: null });
    try {
      // Get current user
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Check membership tier restrictions
      if (currentUser.membershipTier === 'bronze') {
        throw new Error('Bronze members cannot create groups. Please upgrade to Silver or Gold.');
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Create new group
        const newGroup: Group = {
          id: `group-${Date.now()}`,
          name: groupData.name || 'New Group',
          description: groupData.description || '',
          imageUrl: groupData.imageUrl,
          memberIds: [currentUser.id], // Creator is the first member
          createdBy: currentUser.id,
          createdAt: Date.now(),
          category: groupData.category || 'Interest',
          industry: groupData.industry
        };
        
        // Convert Group to snake_case for Supabase
        const groupRecord = convertToSnakeCase(newGroup);
        
        // Insert group into Supabase
        const { error: insertError } = await supabase
          .from('groups')
          .insert(groupRecord);
          
        if (insertError) throw insertError;
        
        // Update user's joinedGroups
        const updatedJoinedGroups = [...currentUser.joinedGroups, newGroup.id];
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ joined_groups: updatedJoinedGroups })
          .eq('id', currentUser.id);
          
        if (userUpdateError) throw userUpdateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'create_group',
            details: { group_id: newGroup.id, group_name: newGroup.name }
          });
        } catch (logError) {
          console.warn('Failed to log create_group action:', getReadableError(logError));
        }
        
        // Update auth store
        const authStorage = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}');
        if (authStorage.state) {
          authStorage.state.user = {
            ...authStorage.state.user,
            joinedGroups: updatedJoinedGroups
          };
          await AsyncStorage.setItem('auth-storage', JSON.stringify(authStorage));
        }
        
        // Refresh groups
        await get().fetchGroups();
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create new group
        const newGroup: Group = {
          id: `group-${Date.now()}`,
          name: groupData.name || 'New Group',
          description: groupData.description || '',
          imageUrl: groupData.imageUrl,
          memberIds: [currentUser.id], // Creator is the first member
          createdBy: currentUser.id,
          createdAt: Date.now(),
          category: groupData.category || 'Interest',
          industry: groupData.industry
        };
        
        // Get groups from storage
        const storedGroups = await AsyncStorage.getItem('mockGroups');
        const groups = storedGroups ? JSON.parse(storedGroups) : [];
        
        // Add new group
        const updatedGroups = [...groups, newGroup];
        
        // Update user's joinedGroups
        const updatedUser = {
          ...currentUser,
          joinedGroups: [...currentUser.joinedGroups, newGroup.id]
        };
        
        // Update in storage
        await AsyncStorage.setItem('mockGroups', JSON.stringify(updatedGroups));
        
        // Update user in storage
        const mockUsers = await AsyncStorage.getItem('mockUsers');
        const users = mockUsers ? JSON.parse(mockUsers) : [];
        
        const updatedUsers = users.map((u: any) => {
          if (u.id === currentUser.id) {
            return { ...u, joinedGroups: [...u.joinedGroups, newGroup.id] };
          }
          return u;
        });
        
        await AsyncStorage.setItem('mockUsers', JSON.stringify(updatedUsers));
        
        // Update auth store
        const authStorage = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}');
        if (authStorage.state) {
          authStorage.state.user = updatedUser;
          await AsyncStorage.setItem('auth-storage', JSON.stringify(authStorage));
        }
        
        // Refresh groups
        await get().fetchGroups();
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error creating group:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  clearError: () => set({ error: null })
}));
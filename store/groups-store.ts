import { create } from 'zustand';
import { Group } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useUsageStore } from './usage-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Helper function to convert Supabase response to Group type
const supabaseToGroup = (data: Record<string, any>): Group => {
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
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
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
          group.memberIds.includes(user.id)
        );
        
        // Filter available groups (not joined by the user)
        const availableGroups = typedGroups.filter((group: Group) => 
          !group.memberIds.includes(user.id)
        );
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'view_groups',
            details: { 
              user_groups_count: userGroups.length,
              available_groups_count: availableGroups.length
            }
          });
          useUsageStore.getState().incrementUsage('view_groups');
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
        throw new Error('Supabase is not configured');
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
    const { user, isReady, tierSettings } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      // Check membership tier restrictions using tier settings
      if (!tierSettings || tierSettings.groups_limit <= 0) { // Check if user's tier allows group joining
        throw new Error('Basic/Bronze members cannot join groups. Please upgrade to Silver or Gold.');
      }
      
      const userGroups = get().userGroups;
      const groupsLimit = tierSettings.groups_limit || 0;
      if (userGroups.length >= groupsLimit) {
        const nextTier = tierSettings.groups_limit <= 3 ? 'Gold' : 'Gold';
        throw new Error(`You have reached your group limit (${userGroups.length} of ${groupsLimit} groups). Upgrade to ${nextTier} to join more groups.`);
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
        const updatedMemberIds = [...group.memberIds, user.id];
        
        const { error: updateError } = await supabase
          .from('groups')
          .update({ member_ids: updatedMemberIds })
          .eq('id', groupId);
          
        if (updateError) throw updateError;
        
        // Update user's joinedGroups
        const updatedJoinedGroups = [...user.joinedGroups, groupId];
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ joined_groups: updatedJoinedGroups })
          .eq('id', user.id);
          
        if (userUpdateError) throw userUpdateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'join_group',
            details: { group_id: groupId, group_name: group.name }
          });
          useUsageStore.getState().incrementUsage('join_group');
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
        throw new Error('Supabase is not configured');
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
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
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
        const updatedMemberIds = group.memberIds.filter((id: string) => id !== user.id);
        
        const { error: updateError } = await supabase
          .from('groups')
          .update({ member_ids: updatedMemberIds })
          .eq('id', groupId);
          
        if (updateError) throw updateError;
        
        // Update user's joinedGroups
        const updatedJoinedGroups = user.joinedGroups.filter((id: string) => id !== groupId);
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ joined_groups: updatedJoinedGroups })
          .eq('id', user.id);
          
        if (userUpdateError) throw userUpdateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'leave_group',
            details: { group_id: groupId, group_name: group.name }
          });
          useUsageStore.getState().incrementUsage('leave_group');
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
        throw new Error('Supabase is not configured');
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
    const { user, isReady, tierSettings } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      // Check membership tier restrictions using tier settings
      if (!tierSettings || !tierSettings.can_create_groups) {  // Basic or Bronze tier (based on swipe limit)
        throw new Error('Basic/Bronze members cannot create groups. Please upgrade to Silver or Gold.');
      }
      
      const userGroups = get().userGroups;
      const groupsLimit = tierSettings.groups_limit || 0;
      if (userGroups.length >= groupsLimit) {
        const nextTier = tierSettings.groups_creation_limit <= 1 ? 'Gold' : 'Gold';
        throw new Error(`You have reached your group creation limit (${userGroups.length} of ${groupsLimit} groups). Upgrade to ${nextTier} to create more groups.`);
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Create new group with snake_case fields, letting Postgres generate the UUID
        const newGroup = {
          name: groupData.name || 'New Group',
          description: groupData.description || '',
          image_url: groupData.imageUrl,
          member_ids: [user.id], // Creator is the first member
          created_by: user.id,
          created_at: Date.now(),
          category: groupData.category || 'Interest',
          industry: groupData.industry
        };
        
        // Insert group into Supabase and get the created group with generated UUID
        const { data: createdGroup, error: insertError } = await supabase
          .from('groups')
          .insert(newGroup)
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        // Update user's joinedGroups with the Postgres-generated UUID
        const updatedJoinedGroups = [...user.joinedGroups, createdGroup.id];
        
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ joined_groups: updatedJoinedGroups })
          .eq('id', user.id);
          
        if (userUpdateError) throw userUpdateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'create_group',
            details: { group_id: createdGroup.id, group_name: newGroup.name }
          });
          useUsageStore.getState().incrementUsage('create_group');
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
        throw new Error('Supabase is not configured');
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
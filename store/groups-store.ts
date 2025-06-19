import { create } from 'zustand';
import { Group, GroupMessage, GroupEvent, GroupEventRSVP } from '@/types/user';
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

// Helper function to convert Supabase response to GroupMessage type
const supabaseToGroupMessage = (data: Record<string, any>): GroupMessage => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    groupId: String(camelCaseData.groupId || ''),
    senderId: String(camelCaseData.senderId || ''),
    content: String(camelCaseData.content || ''),
    type: String(camelCaseData.type || 'text') as 'text' | 'image',
    imageUrl: camelCaseData.imageUrl || undefined,
    createdAt: Number(camelCaseData.createdAt || Date.now()),
  };
};

// Helper function to convert Supabase response to GroupEvent type
const supabaseToGroupEvent = (data: Record<string, any>): GroupEvent => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    groupId: String(camelCaseData.groupId || ''),
    createdBy: String(camelCaseData.createdBy || ''),
    title: String(camelCaseData.title || ''),
    description: String(camelCaseData.description || ''),
    location: camelCaseData.location || undefined,
    startTime: Number(camelCaseData.startTime || Date.now()),
    endTime: camelCaseData.endTime ? Number(camelCaseData.endTime) : undefined,
    reminder: camelCaseData.reminder ? Number(camelCaseData.reminder) : undefined,
    createdAt: Number(camelCaseData.createdAt || Date.now()),
  };
};

// Helper function to convert Supabase response to GroupEventRSVP type
const supabaseToGroupEventRSVP = (data: Record<string, any>): GroupEventRSVP => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    eventId: String(camelCaseData.eventId || ''),
    userId: String(camelCaseData.userId || ''),
    response: String(camelCaseData.response || 'maybe') as 'yes' | 'no' | 'maybe',
    createdAt: Number(camelCaseData.createdAt || Date.now()),
  };
};

// In-memory cache for group data
const groupMessagesCache = new Map<string, GroupMessage[]>();
const groupEventsCache = new Map<string, GroupEvent[]>();

interface GroupsState {
  groups: Group[];
  userGroups: Group[];
  availableGroups: Group[];
  currentGroup: Group | null;
  groupMessages: GroupMessage[];
  groupEvents: GroupEvent[];
  userRSVPs: GroupEventRSVP[];
  isLoading: boolean;
  isMessagesLoading: boolean;
  isEventsLoading: boolean;
  error: string | null;
  messagesPage: number;
  eventsPage: number;
  messagesPerPage: number;
  eventsPerPage: number;
  fetchGroups: () => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  createGroup: (groupData: Partial<Group>) => Promise<void>;
  fetchGroupDetails: (groupId: string) => Promise<void>;
  sendGroupMessage: (groupId: string, content: string, type?: 'text' | 'image', imageUrl?: string) => Promise<void>;
  fetchGroupMessages: (groupId: string, page?: number) => Promise<void>;
  fetchGroupEvents: (groupId: string, page?: number) => Promise<void>;
  createGroupEvent: (eventData: Partial<GroupEvent>) => Promise<void>;
  updateGroupEvent: (eventData: Partial<GroupEvent>) => Promise<void>;
  rsvpToEvent: (eventId: string, response: 'yes' | 'no' | 'maybe') => Promise<void>;
  updateGroup: (groupData: Partial<Group>) => Promise<void>;
  clearError: () => void;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  userGroups: [],
  availableGroups: [],
  currentGroup: null,
  groupMessages: [],
  groupEvents: [],
  userRSVPs: [],
  isLoading: false,
  isMessagesLoading: false,
  isEventsLoading: false,
  error: null,
  messagesPage: 1,
  eventsPage: 1,
  messagesPerPage: 20,
  eventsPerPage: 10,

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
      if (!tierSettings || tierSettings.groups_limit <= 0) {
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

  fetchGroupDetails: async (groupId: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        // Fetch group details
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single();
          
        if (groupError) throw groupError;
        
        const group = supabaseToGroup(groupData || {});
        set({ currentGroup: group, isLoading: false });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error fetching group details:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  sendGroupMessage: async (groupId: string, content: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const newMessage = {
          group_id: groupId,
          sender_id: user.id,
          content,
          type,
          image_url: imageUrl,
          created_at: Date.now()
        };
        
        const { data: insertedMessage, error: insertError } = await supabase
          .from('group_messages')
          .insert(newMessage)
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'send_group_message',
            details: { group_id: groupId, message_type: type }
          });
        } catch (logError) {
          console.warn('Failed to log send_group_message action:', getReadableError(logError));
        }
        
        // Refresh messages
        await get().fetchGroupMessages(groupId);
      } else {
        throw new Error('Supabase is not configured');
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error sending group message:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  fetchGroupMessages: async (groupId: string, page: number = 1) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isMessagesLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const messagesPerPage = get().messagesPerPage;
        const offset = (page - 1) * messagesPerPage;
        
        const { data: messagesData, error: messagesError } = await supabase
          .from('group_messages')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .range(offset, offset + messagesPerPage - 1);
          
        if (messagesError) throw messagesError;
        
        const typedMessages: GroupMessage[] = (messagesData || []).map(supabaseToGroupMessage);
        
        // Cache messages
        const cachedMessages = groupMessagesCache.get(groupId) || [];
        const updatedMessages = [...cachedMessages, ...typedMessages].sort((a, b) => a.createdAt - b.createdAt);
        groupMessagesCache.set(groupId, updatedMessages);
        
        set({ groupMessages: typedMessages, messagesPage: page, isMessagesLoading: false });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error fetching group messages:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isMessagesLoading: false 
      });
    }
  },

  createGroupEvent: async (eventData: Partial<GroupEvent>) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const newEvent = {
          group_id: eventData.groupId,
          created_by: user.id,
          title: eventData.title || 'New Event',
          description: eventData.description || '',
          location: eventData.location,
          start_time: eventData.startTime || Date.now(),
          end_time: eventData.endTime,
          reminder: eventData.reminder,
          created_at: Date.now()
        };
        
        const { data: insertedEvent, error: insertError } = await supabase
          .from('group_events')
          .insert(newEvent)
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'create_group_event',
            details: { group_id: eventData.groupId, event_title: newEvent.title }
          });
          useUsageStore.getState().incrementUsage('event_create');
        } catch (logError) {
          console.warn('Failed to log create_group_event action:', getReadableError(logError));
        }
        
        // Refresh events
        if (eventData.groupId) {
          await get().fetchGroupEvents(eventData.groupId);
        }
      } else {
        throw new Error('Supabase is not configured');
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error creating group event:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  updateGroupEvent: async (eventData: Partial<GroupEvent>) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const updatedEvent = {
          title: eventData.title || 'Updated Event',
          description: eventData.description || '',
          location: eventData.location,
          start_time: eventData.startTime || Date.now(),
          end_time: eventData.endTime,
        };
        
        const { data: updatedEventData, error: updateError } = await supabase
          .from('group_events')
          .update(updatedEvent)
          .eq('id', eventData.id)
          .select()
          .single();
          
        if (updateError) throw updateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'update_group_event',
            details: { group_id: eventData.groupId, event_id: eventData.id, event_title: updatedEvent.title }
          });
        } catch (logError) {
          console.warn('Failed to log update_group_event action:', getReadableError(logError));
        }
        
        // Refresh events
        if (eventData.groupId) {
          await get().fetchGroupEvents(eventData.groupId);
        }
      } else {
        throw new Error('Supabase is not configured');
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error updating group event:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  fetchGroupEvents: async (groupId: string, page: number = 1) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isEventsLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const eventsPerPage = get().eventsPerPage;
        const offset = (page - 1) * eventsPerPage;
        
        // Fetch events for the group with pagination
        const { data: eventsData, error: eventsError } = await supabase
          .from('group_events')
          .select('*')
          .eq('group_id', groupId)
          .order('start_time', { ascending: true })
          .range(offset, offset + eventsPerPage - 1);
          
        if (eventsError) throw eventsError;
        
        const typedEvents: GroupEvent[] = (eventsData || []).map(supabaseToGroupEvent);
        
        // Cache events
        const cachedEvents = groupEventsCache.get(groupId) || [];
        const updatedEvents = [...cachedEvents, ...typedEvents].sort((a, b) => a.startTime - b.startTime);
        groupEventsCache.set(groupId, updatedEvents);
        
        // Fetch user's RSVPs for these events
        const eventIds = typedEvents.map(event => event.id);
        const { data: rsvpData, error: rsvpError } = await supabase
          .from('group_event_rsvps')
          .select('*')
          .eq('user_id', user.id)
          .in('event_id', eventIds);
          
        if (rsvpError) throw rsvpError;
        
        const typedRSVPs: GroupEventRSVP[] = (rsvpData || []).map(supabaseToGroupEventRSVP);
        set({ groupEvents: typedEvents, userRSVPs: typedRSVPs, eventsPage: page, isEventsLoading: false });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error fetching group events:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isEventsLoading: false 
      });
    }
  },

  rsvpToEvent: async (eventId: string, response: 'yes' | 'no' | 'maybe') => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        // Check if user already has an RSVP for this event
        const { data: existingRSVP, error: checkError } = await supabase
          .from('group_event_rsvps')
          .select('*')
          .eq('user_id', user.id)
          .eq('event_id', eventId)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        
        if (existingRSVP) {
          // Update existing RSVP
          const { error: updateError } = await supabase
            .from('group_event_rsvps')
            .update({ response, created_at: Date.now() })
            .eq('id', existingRSVP.id);
            
          if (updateError) throw updateError;
        } else {
          // Create new RSVP
          const newRSVP = {
            event_id: eventId,
            user_id: user.id,
            response,
            created_at: Date.now()
          };
          
          const { error: insertError } = await supabase
            .from('group_event_rsvps')
            .insert(newRSVP);
            
          if (insertError) throw insertError;
        }
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'rsvp_event',
            details: { event_id: eventId, response }
          });
        } catch (logError) {
          console.warn('Failed to log rsvp_event action:', getReadableError(logError));
        }
        
        // Refresh RSVPs (assuming groupId is available from current context)
        const groupId = get().groupEvents.find(event => event.id === eventId)?.groupId;
        if (groupId) {
          await get().fetchGroupEvents(groupId);
        }
      } else {
        throw new Error('Supabase is not configured');
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error RSVPing to event:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  updateGroup: async (groupData: Partial<Group>) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const updatedGroup = {
          name: groupData.name,
          description: groupData.description,
          category: groupData.category,
          industry: groupData.industry
        };
        
        const { error: updateError } = await supabase
          .from('groups')
          .update(updatedGroup)
          .eq('id', groupData.id);
          
        if (updateError) throw updateError;
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'update_group',
            details: { group_id: groupData.id, group_name: groupData.name }
          });
        } catch (logError) {
          console.warn('Failed to log update_group action:', getReadableError(logError));
        }
        
        // Refresh group details
        if (groupData.id) {
          await get().fetchGroupDetails(groupData.id);
        }
      } else {
        throw new Error('Supabase is not configured');
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Error updating group:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  clearError: () => set({ error: null })
}));
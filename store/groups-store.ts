import { create } from 'zustand';
import { Group, GroupMessage, GroupEvent, GroupEventRSVP } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useUsageStore } from './usage-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationStore } from './notification-store';
import { handleError, withErrorHandling, withRetry, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { withNetworkCheck } from '@/utils/network-utils';

/**
 * FILE: store/groups-store.ts
 * LAST UPDATED: 2024-12-20 10:30
 * 
 * CURRENT STATE:
 * Central groups management store using Zustand. Handles group creation,
 * joining/leaving groups, and enforcing tier-based limits on group actions.
 * Uses cached tier settings from auth store for feature permissions and limits.
 * 
 * RECENT CHANGES:
 * - Modified to use cached tier settings from auth store instead of getTierSettings()
 * - Removed unnecessary tier settings validation that was causing errors
 * - Improved error handling for missing tier settings
 * - Maintains compatibility with existing group functionality
 * - Fixed groups loading issues and improved error handling
 * 
 * FILE INTERACTIONS:
 * - Imports from: user types (UserProfile, Group, MembershipTier)
 * - Imports from: supabase lib (database operations)
 * - Imports from: auth-store (user data, tier settings access)
 * - Imports from: error-utils, network-utils (error handling and network checks)
 * - Exports to: Group screens and components
 * - Dependencies: AsyncStorage (persistence), Zustand (state management)
 * - Data flow: Manages group operations, enforces tier limits, provides group data to UI
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - joinGroup: Handle user joining a group with tier limit checks
 * - createGroup: Create new group with tier permission checks
 * - leaveGroup: Handle user leaving a group
 * - fetchGroups: Load user's groups and available groups
 */

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
    recurrencePattern: camelCaseData.recurrencePattern || undefined,
    recurrenceEnd: camelCaseData.recurrenceEnd ? Number(camelCaseData.recurrenceEnd) : undefined,
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
  resetGroupsCache: () => Promise<void>;
  clearGroups: () => void;
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
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for fetching groups'
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Fetch groups from Supabase with retry on network errors
          const { data: groupsData, error: groupsError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .select('*')
                .order('created_at', { ascending: false });
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (groupsError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: groupsError.message
            };
          }
          
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
          
          set({ 
            groups: typedGroups, 
            userGroups, 
            availableGroups, 
            isLoading: false 
          });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      console.error('Error fetching groups:', appError);
    }
  },

  joinGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, allTierSettings } = useAuthStore.getState();
        if (!user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not authenticated for joining group'
          };
        }
        
        const tierSettings = allTierSettings?.[user.membershipTier];
        if (!tierSettings?.groups_limit) {
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Bronze members cannot join groups. Please upgrade to Silver or Gold.'
          };
        }
        
        const userGroups = get().userGroups;
        const groupsLimit = tierSettings.groups_limit;
        if (userGroups.length >= groupsLimit) {
          const nextTier = tierSettings.groups_limit <= 3 ? 'Gold' : 'Gold';
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: `You have reached your group limit (${userGroups.length} of ${groupsLimit} groups). Upgrade to ${nextTier} to join more groups.`
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Get the group to update with retry on network errors
          const { data: groupData, error: groupError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single();
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (groupError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: groupError.message
            };
          }
          
          // Convert to Group type
          const group = supabaseToGroup(groupData || {});
          
          // Update the group with the new member
          const updatedMemberIds = [...group.memberIds, user.id];
          
          const { error: updateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .update({ member_ids: updatedMemberIds })
                .eq('id', groupId);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (updateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: updateError.message
            };
          }
          
          // Update user's joinedGroups
          const updatedJoinedGroups = [...user.joinedGroups, groupId];
          
          const { error: userUpdateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('users')
                .update({ joined_groups: updatedJoinedGroups })
                .eq('id', user.id);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (userUpdateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: userUpdateError.message
            };
          }
          
          // Log the action using usage store
          await useUsageStore.getState().updateUsage(user.id, 'join_group');
          
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
          
          set({ isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  leaveGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for leaving group'
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Get the group to update with retry
          const { data: groupData, error: groupError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single();
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (groupError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: groupError.message
            };
          }
          
          // Convert to Group type and update members
          const group = supabaseToGroup(groupData || {});
          const updatedMemberIds = group.memberIds.filter((id: string) => id !== user.id);
          
          // Update group members with retry
          const { error: updateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .update({ member_ids: updatedMemberIds })
                .eq('id', groupId);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (updateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: updateError.message
            };
          }
          
          // Update user's joinedGroups
          const updatedJoinedGroups = user.joinedGroups.filter((id: string) => id !== groupId);
          
          // Update user with retry
          const { error: userUpdateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('users')
                .update({ joined_groups: updatedJoinedGroups })
                .eq('id', user.id);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (userUpdateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: userUpdateError.message
            };
          }
          
          // Log the action using usage store
          await useUsageStore.getState().updateUsage(user.id, 'leave_group');
          
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
          set({ isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  createGroup: async (groupData: Partial<Group>) => {
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, allTierSettings } = useAuthStore.getState();
        if (!user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not authenticated for creating group'
          };
        }
        
        const tierSettings = allTierSettings?.[user.membershipTier];
        if (!tierSettings?.can_create_groups) {
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Bronze members cannot create groups. Please upgrade to Silver or Gold.'
          };
        }
        
        const userGroups = get().userGroups;
        const groupsLimit = tierSettings.groups_limit;
        if (userGroups.length >= groupsLimit) {
          const nextTier = tierSettings.groups_creation_limit <= 1 ? 'Gold' : 'Gold';
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: `You have reached your group creation limit (${userGroups.length} of ${groupsLimit} groups). Upgrade to ${nextTier} to create more groups.`
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Create new group with retry
          const newGroup = {
            name: groupData.name || 'New Group',
            description: groupData.description || '',
            image_url: groupData.imageUrl,
            member_ids: [user.id],
            created_by: user.id,
            created_at: Date.now(),
            category: groupData.category || 'Interest',
            industry: groupData.industry
          };
          
          const { data: createdGroup, error: insertError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .insert(newGroup)
                .select()
                .single();
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (insertError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: insertError.message
            };
          }
          
          // Update user's joinedGroups with retry
          const updatedJoinedGroups = [...user.joinedGroups, createdGroup.id];
          
          const { error: userUpdateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('users')
                .update({ joined_groups: updatedJoinedGroups })
                .eq('id', user.id);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (userUpdateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: userUpdateError.message
            };
          }
          
          // Log the action using usage store
          await useUsageStore.getState().updateUsage(user.id, 'create_group');
          
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
          set({ isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  fetchGroupDetails: async (groupId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for fetching group details'
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Fetch group details with retry
          const { data: groupData, error: groupError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single();
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (groupError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: groupError.message
            };
          }
          
          const group = supabaseToGroup(groupData || {});
          set({ currentGroup: group, isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  sendGroupMessage: async (groupId: string, content: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for sending group message');
    }
    
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
        
        // Log the action using usage store
        useUsageStore.getState().updateUsage(user.id, 'send_group_message');
        
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
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for fetching group messages');
    }
    
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
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for creating group event');
    }
    
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
          created_at: Date.now(),
          recurrence_pattern: eventData.recurrencePattern,
          recurrence_end: eventData.recurrenceEnd,
        };
        
        const { data: insertedEvent, error: insertError } = await supabase
          .from('group_events')
          .insert(newEvent)
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        // Log the action using usage store
        useUsageStore.getState().updateUsage(user.id, 'event_create');
        
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
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for updating group event'
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          const updatedEvent = {
            title: eventData.title || 'Updated Event',
            description: eventData.description || '',
            location: eventData.location,
            start_time: eventData.startTime || Date.now(),
            end_time: eventData.endTime,
            recurrence_pattern: eventData.recurrencePattern,
            recurrence_end: eventData.recurrenceEnd,
          };
          
          const { data: updatedEventData, error: updateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('group_events')
                .update(updatedEvent)
                .eq('id', eventData.id)
                .select()
                .single();
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (updateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: updateError.message
            };
          }
          
          // Log the action using usage store
          await useUsageStore.getState().updateUsage(user.id, 'update_group_event');
          
          // Refresh events
          if (eventData.groupId) {
            await get().fetchGroupEvents(eventData.groupId);
          }
          
          set({ isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  fetchGroupEvents: async (groupId: string, page: number = 1) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for fetching group events');
    }
    
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
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for RSVPing to event'
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Check if user already has an RSVP for this event
          const { data: existingRSVP, error: checkError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('group_event_rsvps')
                .select('*')
                .eq('user_id', user.id)
                .eq('event_id', eventId)
                .single();
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (checkError && checkError.code !== 'PGRST116') {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: checkError.message
            };
          }
          
          if (existingRSVP) {
            // Update existing RSVP
            const { error: updateError } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('group_event_rsvps')
                  .update({ response, created_at: Date.now() })
                  .eq('id', existingRSVP.id);
              },
              {
                maxRetries: 3,
                shouldRetry: (error) => error.category === ErrorCategory.NETWORK
              }
            );
            
            if (updateError) {
              throw {
                category: ErrorCategory.DATABASE,
                code: ErrorCodes.DB_QUERY_ERROR,
                message: updateError.message
              };
            }
          } else {
            // Create new RSVP
            const newRSVP = {
              event_id: eventId,
              user_id: user.id,
              response,
              created_at: Date.now()
            };
            
            const { error: insertError } = await withRetry(
              async () => {
                if (!supabase) throw new Error('Supabase client is not initialized');
                return await supabase
                  .from('group_event_rsvps')
                  .insert(newRSVP);
              },
              {
                maxRetries: 3,
                shouldRetry: (error) => error.category === ErrorCategory.NETWORK
              }
            );
            
            if (insertError) {
              throw {
                category: ErrorCategory.DATABASE,
                code: ErrorCodes.DB_QUERY_ERROR,
                message: insertError.message
              };
            }
          }
          
          // Log the action using usage store
          await useUsageStore.getState().updateUsage(user.id, 'rsvp_event');
          
          // Refresh RSVPs
          const groupId = get().groupEvents.find(event => event.id === eventId)?.groupId;
          if (groupId) {
            await get().fetchGroupEvents(groupId);
          }
          
          set({ isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  updateGroup: async (groupData: Partial<Group>) => {
    set({ isLoading: true, error: null });
    
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for updating group'
          };
        }
        
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          const updatedGroup = {
            name: groupData.name,
            description: groupData.description,
            category: groupData.category,
            industry: groupData.industry
          };
          
          const { error: updateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('groups')
                .update(updatedGroup)
                .eq('id', groupData.id);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
          
          if (updateError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: updateError.message
            };
          }
          
          // Log the action using usage store
          await useUsageStore.getState().updateUsage(user.id, 'update_group');
          
          // Refresh group details
          if (groupData.id) {
            await get().fetchGroupDetails(groupData.id);
          }
          
          set({ isLoading: false });
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage, 
        isLoading: false 
      });
      throw appError;
    }
  },

  clearError: () => set({ error: null }),

  resetGroupsCache: async () => {
    try {
      await withErrorHandling(async () => {
        // Clear state
        set({
          groups: [],
          userGroups: [],
          availableGroups: [],
          currentGroup: null,
          groupMessages: [],
          groupEvents: [],
          userRSVPs: [],
          error: null,
          isLoading: false,
          isMessagesLoading: false,
          isEventsLoading: false
        });
        
        // Clear in-memory caches
        groupMessagesCache.clear();
        groupEventsCache.clear();
        
        // Notify success
        useNotificationStore.getState().addNotification({
          type: 'success',
          message: 'Groups data refreshed',
          displayStyle: 'toast',
          duration: 3000
        });
        
        // Refetch groups data
        await get().fetchGroups();
      });
    } catch (error) {
      const appError = handleError(error);
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: appError.userMessage,
        displayStyle: 'toast',
        duration: 5000
      });
      set({ error: appError.userMessage });
      throw appError;
    }
  },

  clearGroups: () => {
    set({ groups: [], userGroups: [], availableGroups: [], isLoading: false });
  }
}));
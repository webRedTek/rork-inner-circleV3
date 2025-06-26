import { create } from 'zustand';
import { Message, MessageWithSender } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useUsageStore } from './usage-store';
import { useNotificationStore } from './notification-store';
import { handleError, withErrorHandling, withRetry, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { withNetworkCheck } from '@/utils/network-utils';

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

// Helper function to convert Supabase response to Message type
const supabaseToMessage = (data: Record<string, any>): Message => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    senderId: String(camelCaseData.senderId || ''),
    receiverId: String(camelCaseData.receiverId || ''),
    content: String(camelCaseData.content || ''),
    type: camelCaseData.type as Message['type'],
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    read: Boolean(camelCaseData.read || false),
  };
};

interface MessagesState {
  messages: Record<string, Message[]>; // Keyed by conversationId (matchId or groupId)
  isLoading: Record<string, boolean>; // Loading state per conversation
  error: Record<string, string | null>; // Error state per conversation
  pagination: Record<string, { page: number; hasMore: boolean; lastFetched: number }>; // Pagination info per conversation
  subscriptions: Record<string, any>; // Real-time subscription handles
  sendMessage: (conversationId: string, content: string, receiverId: string) => Promise<void>;
  getMessages: (conversationId: string, pageSize?: number) => Promise<void>;
  loadMoreMessages: (conversationId: string, pageSize?: number) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  subscribeToMessages: (conversationId: string) => void;
  unsubscribeFromMessages: (conversationId: string) => void;
  clearError: (conversationId: string) => void;
  resetMessagesCache: () => Promise<void>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: {},
  isLoading: {},
  error: {},
  pagination: {},
  subscriptions: {},

  sendMessage: async (conversationId: string, content: string, receiverId: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw {
        category: ErrorCategory.AUTH,
        code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
        message: 'User not ready or authenticated for sending message'
      };
    }
    
    set(state => ({ 
      isLoading: { ...state.isLoading, [conversationId]: true },
      error: { ...state.error, [conversationId]: null }
    }));

    try {
      await withNetworkCheck(async () => {
        // Check message sending limit based on tier settings
        const result = await useUsageStore.getState().trackUsage({ actionType: 'message', batchProcess: true });
        if (!result.isAllowed) {
          throw {
            category: ErrorCategory.RATE_LIMIT,
            code: ErrorCodes.USAGE_LIMIT_EXCEEDED,
            message: 'Daily message limit reached. Upgrade your plan for more messages.'
          };
        }
        
        if (!isSupabaseConfigured() || !supabase) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DATABASE_NOT_CONFIGURED,
            message: 'Database is not configured'
          };
        }

        // Create message in Supabase
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          senderId: user.id,
          receiverId,
          content,
          type: 'text',
          createdAt: Date.now(),
          read: false
        };
        
        // Convert to snake_case for Supabase
        const messageRecord = convertToSnakeCase(newMessage);
        messageRecord.conversation_id = conversationId;
        
        // Insert message with retry on network errors
        const { error: insertError } = await withRetry(
          async () => {
            if (!supabase) throw new Error('Supabase client is not initialized');
            return await supabase
              .from('messages')
              .insert(messageRecord);
          },
          {
            maxRetries: 3,
            shouldRetry: (error) => error.category === ErrorCategory.NETWORK
          }
        );
          
        if (insertError) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DATABASE_INSERT_FAILED,
            message: getReadableError(insertError)
          };
        }
        
        // Update last message timestamp in match if it's a match conversation
        if (conversationId.startsWith('match-')) {
          const { error: updateMatchError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('matches')
                .update({ last_message_at: newMessage.createdAt })
                .eq('id', conversationId);
            },
            {
              maxRetries: 2,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
            
          if (updateMatchError) {
            console.warn('Failed to update match last_message_at:', getReadableError(updateMatchError));
          }
        }
        
        // Get existing messages for this conversation
        const { messages } = get();
        const conversationMessages = messages[conversationId] || [];
        
        // Add new message
        const updatedMessages = [...conversationMessages, newMessage];
        
        // Update state
        set({ 
          messages: { 
            ...messages, 
            [conversationId]: updatedMessages 
          }, 
          isLoading: { ...get().isLoading, [conversationId]: false }
        });
      });
    } catch (error) {
      const handledError = handleError(error, {
        defaultMessage: 'Failed to send message',
        context: { conversationId }
      });

      set({ 
        error: { ...get().error, [conversationId]: handledError.message }, 
        isLoading: { ...get().isLoading, [conversationId]: false }
      });
    }
  },

  getMessages: async (conversationId: string, pageSize = 20) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for getting messages');
    }
    
    set(state => ({ 
      isLoading: { ...state.isLoading, [conversationId]: true },
      error: { ...state.error, [conversationId]: null }
    }));
    try {
      if (isSupabaseConfigured() && supabase) {
        // Get messages from Supabase with pagination
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .range(0, pageSize - 1);
          
        if (messagesError) throw messagesError;
        
        // Convert Supabase response to Message objects
        const conversationMessages = (messagesData || []).map(supabaseToMessage).reverse();
        
        // Update state with pagination info
        set({ 
          messages: { 
            ...get().messages, 
            [conversationId]: conversationMessages 
          }, 
          isLoading: { ...get().isLoading, [conversationId]: false },
          pagination: {
            ...get().pagination,
            [conversationId]: {
              page: 1,
              hasMore: conversationMessages.length === pageSize,
              lastFetched: Date.now()
            }
          }
        });
      } else {
        throw new Error('Database is not configured');
      }
    } catch (error) {
      console.error('Error getting messages:', getReadableError(error));
      set({ 
        error: { ...get().error, [conversationId]: getReadableError(error) }, 
        isLoading: { ...get().isLoading, [conversationId]: false }
      });
    }
  },

  loadMoreMessages: async (conversationId: string, pageSize = 20) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for loading more messages');
    }
    
    const currentPagination = get().pagination[conversationId];
    if (!currentPagination || !currentPagination.hasMore) {
      throw new Error('No more messages to load or pagination data not available');
    }
    
    set(state => ({ 
      isLoading: { ...state.isLoading, [conversationId]: true },
      error: { ...state.error, [conversationId]: null }
    }));
    try {
      if (isSupabaseConfigured() && supabase) {
        const nextPage = currentPagination.page + 1;
        const startIndex = nextPage * pageSize;
        const endIndex = startIndex + pageSize - 1;
        
        // Get more messages from Supabase with pagination
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex);
          
        if (messagesError) throw messagesError;
        
        // Convert Supabase response to Message objects
        const additionalMessages = (messagesData || []).map(supabaseToMessage).reverse();
        
        // Get existing messages for this conversation
        const { messages } = get();
        const conversationMessages = messages[conversationId] || [];
        
        // Update state with pagination info
        set({ 
          messages: { 
            ...messages, 
            [conversationId]: [...additionalMessages, ...conversationMessages]
          }, 
          isLoading: { ...get().isLoading, [conversationId]: false },
          pagination: {
            ...get().pagination,
            [conversationId]: {
              page: nextPage,
              hasMore: additionalMessages.length === pageSize,
              lastFetched: Date.now()
            }
          }
        });
      } else {
        throw new Error('Database is not configured');
      }
    } catch (error) {
      console.error('Error loading more messages:', getReadableError(error));
      set({ 
        error: { ...get().error, [conversationId]: getReadableError(error) }, 
        isLoading: { ...get().isLoading, [conversationId]: false }
      });
    }
  },

  markAsRead: async (conversationId: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      throw new Error('User not ready or authenticated for marking messages as read');
    }
    
    try {
      const { messages } = get();
      const conversationMessages = messages[conversationId] || [];
      
      if (conversationMessages.length === 0) return;
      
      if (isSupabaseConfigured() && supabase) {
        // Mark messages as read in Supabase
        const unreadMessageIds = conversationMessages
          .filter(msg => msg.receiverId === user.id && !msg.read)
          .map(msg => msg.id);
          
        if (unreadMessageIds.length === 0) return;
        
        const { error: updateError } = await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessageIds);
          
        if (updateError) {
          console.warn('Failed to mark messages as read:', getReadableError(updateError));
          throw updateError;
        }
        
        // Update local state
        const updatedMessages = conversationMessages.map(msg => {
          if (msg.receiverId === user.id && !msg.read) {
            return { ...msg, read: true };
          }
          return msg;
        });
        
        // Update state
        set({ 
          messages: { 
            ...messages, 
            [conversationId]: updatedMessages 
          }
        });
      } else {
        throw new Error('Database is not configured');
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', getReadableError(error));
      throw new Error(`Failed to mark messages as read: ${getReadableError(error)}`);
    }
  },

  subscribeToMessages: (conversationId: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase not initialized for message subscription');
    }
    
    const { user } = useAuthStore.getState();
    if (!user) {
      throw new Error('User not authenticated for message subscription');
    }
    
    // Check if already subscribed
    if (get().subscriptions[conversationId]) return;
    
    const subscription = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        const newMessage = supabaseToMessage(payload.new);
        console.log('[MessagesStore] New message received:', newMessage);
        
        // Update messages for this conversation
        set(state => {
          const conversationMessages = state.messages[conversationId] || [];
          return {
            messages: {
              ...state.messages,
              [conversationId]: [...conversationMessages, newMessage]
            }
          };
        });
        
        // If the message is for the current user, log it
        if (newMessage.receiverId === user.id) {
          useNotificationStore.getState().addNotification({
            type: 'info',
            message: 'New message received',
            displayStyle: 'toast',
            duration: 3000
          });
        }
      })
      .subscribe();
      
    set(state => ({
      subscriptions: {
        ...state.subscriptions,
        [conversationId]: subscription
      }
    }));
    console.log(`[MessagesStore] Subscribed to messages for conversation ${conversationId}`);
  },

  unsubscribeFromMessages: (conversationId: string) => {
    const subscription = get().subscriptions[conversationId];
    if (subscription) {
      if (isSupabaseConfigured() && supabase) {
        supabase.removeChannel(subscription);
        set(state => {
          const newSubscriptions = { ...state.subscriptions };
          delete newSubscriptions[conversationId];
          return { subscriptions: newSubscriptions };
        });
        console.log(`[MessagesStore] Unsubscribed from messages for conversation ${conversationId}`);
      } else {
        throw new Error('Supabase not initialized for unsubscribe');
      }
    }
  },

  clearError: (conversationId: string) => set(state => ({ 
    error: { ...state.error, [conversationId]: null }
  })),

  resetMessagesCache: async () => {
    try {
      console.log('[MessagesStore] Resetting messages cache');
      // Unsubscribe from all real-time updates
      const subscriptions = get().subscriptions;
      if (isSupabaseConfigured() && supabase) {
        Object.values(subscriptions).forEach(subscription => {
          supabase.removeChannel(subscription);
        });
      }
      
      set({
        messages: {},
        error: {},
        isLoading: {},
        pagination: {},
        subscriptions: {}
      });
      console.log('[MessagesStore] Messages cache reset successfully');
      useNotificationStore.getState().addNotification({
        type: 'success',
        message: 'Messages data cleared',
        displayStyle: 'toast',
        duration: 3000
      });
    } catch (error) {
      console.error('[MessagesStore] Error resetting messages cache:', getReadableError(error));
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: 'Failed to reset messages data',
        displayStyle: 'toast',
        duration: 5000
      });
      set(state => ({ 
        error: { ...state.error, global: getReadableError(error) }
      }));
    }
  }
}));
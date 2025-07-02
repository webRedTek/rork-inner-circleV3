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
  subscriptions: Record<string, any>; // Real-time subscriptions per conversation
  sendMessage: (conversationId: string, content: string, receiverId: string) => Promise<void>;
  getMessages: (conversationId: string, pageSize?: number) => Promise<void>;
  loadMoreMessages: (conversationId: string, pageSize?: number) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  subscribeToMessages: (conversationId: string) => void;
  unsubscribeFromMessages: (conversationId: string) => void;
  clearError: (conversationId: string) => void;
  resetMessagesCache: () => Promise<void>;
  clearMessages: () => void;
  fetchMessages: () => Promise<void>;
}

type SetState = (fn: (state: MessagesState) => Partial<MessagesState>) => void;
type GetState = () => MessagesState;

export const useMessagesStore = create<MessagesState>()((set: SetState, get: GetState) => ({
  messages: {},
  isLoading: {},
  error: {},
  pagination: {},
  subscriptions: {},

  sendMessage: async (conversationId: string, content: string, receiverId: string): Promise<void> => {
    set((state: MessagesState) => ({ 
      isLoading: { ...state.isLoading, [conversationId]: true },
      error: { ...state.error, [conversationId]: null }
    }));

    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for sending message'
          };
        }

        await withNetworkCheck(async () => {
          // Check message sending limit based on tier settings
          const result = await useUsageStore.getState().updateUsage(user.id, 'message');
          if (!result.isAllowed) {
            throw {
              category: ErrorCategory.RATE_LIMIT,
              code: ErrorCodes.RATE_LIMIT_EXCEEDED,
              message: 'Daily message limit reached. Upgrade your plan for more messages.'
            };
          }
          
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
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
              code: ErrorCodes.DB_QUERY_ERROR,
              message: insertError.message
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
              console.warn('Failed to update match last_message_at:', updateMatchError.message);
            }
          }
          
          // Get existing messages for this conversation
          const { messages } = get();
          const conversationMessages = messages[conversationId] || [];
          
          // Add new message
          const updatedMessages = [...conversationMessages, newMessage];
          
          // Update state
          set((state: MessagesState) => ({ 
            messages: { 
              ...state.messages, 
              [conversationId]: updatedMessages 
            }, 
            isLoading: { ...state.isLoading, [conversationId]: false }
          }));
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set((state: MessagesState) => ({ 
        error: { ...state.error, [conversationId]: appError.userMessage },
        isLoading: { ...state.isLoading, [conversationId]: false }
      }));
      throw appError;
    }
  },

  getMessages: async (conversationId: string, pageSize = 20): Promise<void> => {
    set((state: MessagesState) => ({ 
      isLoading: { ...state.isLoading, [conversationId]: true },
      error: { ...state.error, [conversationId]: null }
    }));

    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for getting messages'
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

          // Get messages from Supabase with pagination
          const { data: messagesData, error: messagesError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .range(0, pageSize - 1);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
            
          if (messagesError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: messagesError.message
            };
          }
          
          // Convert Supabase response to Message objects
          const conversationMessages = (messagesData || []).map(supabaseToMessage).reverse();
          
          // Update state with pagination info
          set((state: MessagesState) => ({ 
            messages: { 
              ...state.messages, 
              [conversationId]: conversationMessages 
            }, 
            isLoading: { ...state.isLoading, [conversationId]: false },
            pagination: {
              ...state.pagination,
              [conversationId]: {
                page: 1,
                hasMore: conversationMessages.length === pageSize,
                lastFetched: Date.now()
              }
            }
          }));
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set((state: MessagesState) => ({ 
        error: { ...state.error, [conversationId]: appError.userMessage },
        isLoading: { ...state.isLoading, [conversationId]: false }
      }));
      throw appError;
    }
  },

  loadMoreMessages: async (conversationId: string, pageSize = 20): Promise<void> => {
    set((state: MessagesState) => ({ 
      isLoading: { ...state.isLoading, [conversationId]: true },
      error: { ...state.error, [conversationId]: null }
    }));

    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for loading more messages'
          };
        }

        const currentPagination = get().pagination[conversationId];
        if (!currentPagination || !currentPagination.hasMore) {
          throw {
            category: ErrorCategory.VALIDATION,
            code: ErrorCodes.VALIDATION_INVALID_INPUT,
            message: 'No more messages to load or pagination data not available'
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

          const nextPage = currentPagination.page + 1;
          const startIndex = nextPage * pageSize;
          const endIndex = startIndex + pageSize - 1;
          
          // Get more messages from Supabase with pagination
          const { data: messagesData, error: messagesError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .range(startIndex, endIndex);
            },
            {
              maxRetries: 3,
              shouldRetry: (error) => error.category === ErrorCategory.NETWORK
            }
          );
            
          if (messagesError) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: messagesError.message
            };
          }
          
          // Convert Supabase response to Message objects
          const additionalMessages = (messagesData || []).map(supabaseToMessage).reverse();
          
          // Get existing messages for this conversation
          const { messages } = get();
          const conversationMessages = messages[conversationId] || [];
          
          // Update state with pagination info
          const newState: Partial<MessagesState> = {
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
          };
          set(() => newState);
        });
      });
    } catch (error) {
      const appError = handleError(error);
      set((state: MessagesState) => ({ 
        error: { ...state.error, [conversationId]: appError.userMessage },
        isLoading: { ...state.isLoading, [conversationId]: false }
      }));
      throw appError;
    }
  },

  markAsRead: async (conversationId: string): Promise<void> => {
    try {
      await withErrorHandling(async () => {
        const { user, isReady } = useAuthStore.getState();
        if (!isReady || !user) {
          throw {
            category: ErrorCategory.AUTH,
            code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
            message: 'User not ready or authenticated for marking messages as read'
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

          const { messages } = get();
          const conversationMessages = messages[conversationId] || [];
          
          if (conversationMessages.length === 0) return;
          
          // Mark messages as read in Supabase
          const unreadMessageIds = conversationMessages
            .filter((msg: Message) => msg.receiverId === user.id && !msg.read)
            .map((msg: Message) => msg.id);
            
          if (unreadMessageIds.length === 0) return;
          
          const { error: updateError } = await withRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('messages')
                .update({ read: true })
                .in('id', unreadMessageIds);
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
          
          // Update local state
          const updatedMessages = conversationMessages.map((msg: Message) => {
            if (msg.receiverId === user.id && !msg.read) {
              return { ...msg, read: true };
            }
            return msg;
          });
          
          // Update state
          const newState: Partial<MessagesState> = {
            messages: { 
              ...messages, 
              [conversationId]: updatedMessages 
            }
          };
          set(() => newState);
        });
      });
    } catch (error) {
      const appError = handleError(error);
      throw appError;
    }
  },

  subscribeToMessages: (conversationId: string) => {
    try {
      // Check if already subscribed
      const { subscriptions } = get();
      if (subscriptions[conversationId]) {
        console.log(`Already subscribed to messages for conversation: ${conversationId}`);
        return;
      }

      if (!isSupabaseConfigured() || !supabase) {
        console.warn('Supabase not configured, cannot subscribe to messages');
        return;
      }

      console.log(`Subscribing to messages for conversation: ${conversationId}`);

      // Create real-time subscription
      const subscription = supabase
        .channel(`messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            console.log('New message received:', payload);
            
            if (payload.new) {
              const newMessage = supabaseToMessage(payload.new);
              
              // Add new message to state
              set((state: MessagesState) => {
                const conversationMessages = state.messages[conversationId] || [];
                const updatedMessages = [...conversationMessages, newMessage];
                
                return {
                  messages: {
                    ...state.messages,
                    [conversationId]: updatedMessages
                  }
                };
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            console.log('Message updated:', payload);
            
            if (payload.new) {
              const updatedMessage = supabaseToMessage(payload.new);
              
              // Update message in state
              set((state: MessagesState) => {
                const conversationMessages = state.messages[conversationId] || [];
                const updatedMessages = conversationMessages.map((msg: Message) =>
                  msg.id === updatedMessage.id ? updatedMessage : msg
                );
                
                return {
                  messages: {
                    ...state.messages,
                    [conversationId]: updatedMessages
                  }
                };
              });
            }
          }
        )
        .subscribe((status) => {
          console.log(`Subscription status for ${conversationId}:`, status);
        });

      // Store subscription
      set((state: MessagesState) => ({
        subscriptions: {
          ...state.subscriptions,
          [conversationId]: subscription
        }
      }));

    } catch (error) {
      console.error('Error subscribing to messages:', error);
    }
  },

  unsubscribeFromMessages: (conversationId: string) => {
    try {
      const { subscriptions } = get();
      const subscription = subscriptions[conversationId];
      
      if (subscription) {
        console.log(`Unsubscribing from messages for conversation: ${conversationId}`);
        
        // Unsubscribe from real-time updates
        supabase?.removeChannel(subscription);
        
        // Remove subscription from state
        set((state: MessagesState) => {
          const newSubscriptions = { ...state.subscriptions };
          delete newSubscriptions[conversationId];
          
          return {
            subscriptions: newSubscriptions
          };
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from messages:', error);
    }
  },

  clearError: (conversationId: string) => set((state: MessagesState) => ({ 
    error: { ...state.error, [conversationId]: null }
  })),

  resetMessagesCache: async (): Promise<void> => {
    try {
      await withErrorHandling(async () => {
        console.log('[MessagesStore] Resetting messages cache');
        
        // Unsubscribe from all active subscriptions
        const { subscriptions } = get();
        Object.keys(subscriptions).forEach((conversationId) => {
          get().unsubscribeFromMessages(conversationId);
        });
        
        const newState: Partial<MessagesState> = { 
          messages: {}, 
          isLoading: {}, 
          error: {}, 
          pagination: {},
          subscriptions: {}
        };
        set(() => newState);
      });
    } catch (error) {
      const appError = handleError(error);
      throw appError;
    }
  },

  clearMessages: () => {
    // Unsubscribe from all active subscriptions
    const { subscriptions } = get();
    Object.keys(subscriptions).forEach((conversationId) => {
      get().unsubscribeFromMessages(conversationId);
    });
    
    set({ 
      messages: {}, 
      isLoading: {},
      subscriptions: {}
    });
  },
  
  fetchMessages: async () => {
    set({ isLoading: { ...get().isLoading, '*': true } });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', useAuthStore.getState().user?.id);
        
      if (error) throw error;
      
      set({ messages: data || {}, isLoading: { ...get().isLoading, '*': false } });
    } catch (error) {
      set({ isLoading: { ...get().isLoading, '*': false } });
      handleError(error);
    }
  }
}));
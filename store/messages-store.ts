import { create } from 'zustand';
import { Message } from '@/types/user';
import { isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useUsageStore } from './usage-store';

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
    voiceUrl: camelCaseData.voiceUrl,
    voiceDuration: camelCaseData.voiceDuration,
    imageUrl: camelCaseData.imageUrl,
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    read: Boolean(camelCaseData.read || false),
  };
};

interface MessagesState {
  messages: Record<string, Message[]>; // Keyed by conversationId (matchId or groupId)
  isLoading: boolean;
  error: string | null;
  sendMessage: (conversationId: string, content: string, receiverId: string) => Promise<void>;
  sendVoiceMessage: (conversationId: string, voiceUrl: string, duration: number, receiverId: string) => Promise<void>;
  getMessages: (conversationId: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  clearError: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: {},
  isLoading: false,
  error: null,

  sendMessage: async (conversationId: string, content: string, receiverId: string) => {
    const { user, isReady, tierSettings } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      // Check message sending limit based on tier settings
      if (tierSettings) {
        const dailyMessageLimit = tierSettings.message_sending_limit || 20;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        
        if (isSupabaseConfigured()) {
          const messagesResult = await supabase.from('messages').select('id, created_at').eq('sender_id', user.id).gte('created_at', todayTimestamp);
            
          if (messagesResult.error) {
            console.error('Error checking message limit:', messagesResult.error);
          } else {
            const todayMessages = messagesResult ? messagesResult.length : 0;
            if (todayMessages >= dailyMessageLimit) {
              throw new Error('Daily message limit reached. Upgrade your plan for more messages.');
            }
          }
        } else {
          throw new Error('Supabase is not configured');
        }
      }
      
      if (isSupabaseConfigured()) {
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
        
        const insertResult = await supabase.from('messages').insert(messageRecord);
          
        if (insertResult.error) throw insertResult.error;
        
        // Update last message timestamp in match if it's a match conversation
        if (conversationId.startsWith('match-')) {
          const updateMatchResult = await supabase.from('matches').update({ last_message_at: newMessage.createdAt }).eq('id', conversationId);
            
          if (updateMatchResult.error) {
            console.warn('Failed to update match last_message_at:', getReadableError(updateMatchResult.error));
          }
        }
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'send_message',
            details: { 
              conversation_id: conversationId,
              receiver_id: receiverId,
              message_type: 'text'
            }
          });
          useUsageStore.getState().incrementUsage('send_message');
        } catch (logError) {
          console.warn('Failed to log send_message action:', getReadableError(logError));
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
          isLoading: false 
        });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error sending message:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  sendVoiceMessage: async (conversationId: string, voiceUrl: string, duration: number, receiverId: string) => {
    const { user, isReady, tierSettings } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      // Check message sending limit based on tier settings
      if (tierSettings) {
        const dailyMessageLimit = tierSettings.message_sending_limit || 20;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();
        
        if (isSupabaseConfigured()) {
          const messagesResult = await supabase.from('messages').select('id, created_at').eq('sender_id', user.id).gte('created_at', todayTimestamp);
            
          if (messagesResult.error) {
            console.error('Error checking message limit:', messagesResult.error);
          } else {
            const todayMessages = messagesResult ? messagesResult.length : 0;
            if (todayMessages >= dailyMessageLimit) {
              throw new Error('Daily message limit reached. Upgrade your plan for more messages.');
            }
          }
        } else {
          throw new Error('Supabase is not configured');
        }
      }
      
      if (isSupabaseConfigured()) {
        // Create voice message in Supabase
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          senderId: user.id,
          receiverId,
          content: 'Voice message',
          type: 'voice',
          voiceUrl,
          voiceDuration: duration,
          createdAt: Date.now(),
          read: false
        };
        
        // Convert to snake_case for Supabase
        const messageRecord = convertToSnakeCase(newMessage);
        messageRecord.conversation_id = conversationId;
        
        const insertResult = await supabase.from('messages').insert(messageRecord);
          
        if (insertResult.error) throw insertResult.error;
        
        // Update last message timestamp in match if it's a match conversation
        if (conversationId.startsWith('match-')) {
          const updateMatchResult = await supabase.from('matches').update({ last_message_at: newMessage.createdAt }).eq('id', conversationId);
            
          if (updateMatchResult.error) {
            console.warn('Failed to update match last_message_at:', getReadableError(updateMatchResult.error));
          }
        }
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'send_message',
            details: { 
              conversation_id: conversationId,
              receiver_id: receiverId,
              message_type: 'voice',
              duration
            }
          });
          useUsageStore.getState().incrementUsage('send_message');
        } catch (logError) {
          console.warn('Failed to log send_message action:', getReadableError(logError));
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
          isLoading: false 
        });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error sending voice message:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  getMessages: async (conversationId: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured()) {
        // Get messages from Supabase
        const messagesResult = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
          
        if (messagesResult.error) throw messagesResult.error;
        
        // Convert Supabase response to Message objects
        const conversationMessages = (messagesResult || []).map(supabaseToMessage);
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'view_messages',
            details: { 
              conversation_id: conversationId,
              message_count: conversationMessages.length
            }
          });
          useUsageStore.getState().incrementUsage('view_messages');
        } catch (logError) {
          console.warn('Failed to log view_messages action:', getReadableError(logError));
        }
        
        // Log received messages
        const receivedMessages = conversationMessages.filter(msg => msg.receiverId === user.id);
        for (const msg of receivedMessages) {
          try {
            await supabase.rpc('log_user_action', {
              user_id: user.id,
              action: 'receive_message',
              details: { 
                conversation_id: conversationId,
                sender_id: msg.senderId,
                message_type: msg.type
              }
            });
            useUsageStore.getState().incrementUsage('receive_message');
          } catch (logError) {
            console.warn('Failed to log receive_message action:', getReadableError(logError));
          }
        }
        
        // Update state
        set({ 
          messages: { 
            ...get().messages, 
            [conversationId]: conversationMessages 
          }, 
          isLoading: false 
        });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error getting messages:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  markAsRead: async (conversationId: string) => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return; // Silent fail if not ready or not authenticated
    
    try {
      const { messages } = get();
      const conversationMessages = messages[conversationId] || [];
      
      if (conversationMessages.length === 0) return;
      
      if (isSupabaseConfigured()) {
        // Mark messages as read in Supabase
        const unreadMessageIds = conversationMessages
          .filter(msg => msg.receiverId === user.id && !msg.read)
          .map(msg => msg.id);
          
        if (unreadMessageIds.length === 0) return;
        
        const updateResult = await supabase.from('messages').update({ read: true }).in('id', unreadMessageIds);
          
        if (updateResult.error) {
          console.warn('Failed to mark messages as read:', getReadableError(updateResult.error));
          return;
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
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: user.id,
            action: 'mark_messages_read',
            details: { 
              conversation_id: conversationId,
              count: unreadMessageIds.length
            }
          });
          useUsageStore.getState().incrementUsage('mark_messages_read');
        } catch (logError) {
          console.warn('Failed to log mark_messages_read action:', getReadableError(logError));
        }
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', getReadableError(error));
    }
  },

  clearError: () => set({ error: null })
}));
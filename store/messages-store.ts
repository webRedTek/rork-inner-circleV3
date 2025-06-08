import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Message } from '@/types/user';
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

// Helper function to convert Supabase response to Message type
const supabaseToMessage = (data: Record<string, any>): Message => {
  // First convert snake_case to camelCase
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
    set({ isLoading: true, error: null });
    try {
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Create message in Supabase
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          senderId: currentUser.id,
          receiverId,
          content,
          type: 'text',
          createdAt: Date.now(),
          read: false
        };
        
        // Convert to snake_case for Supabase
        const messageRecord = convertToSnakeCase(newMessage);
        messageRecord.conversation_id = conversationId;
        
        const { error: insertError } = await supabase
          .from('messages')
          .insert(messageRecord);
          
        if (insertError) throw insertError;
        
        // Update last message timestamp in match if it's a match conversation
        if (conversationId.startsWith('match-')) {
          const { error: updateMatchError } = await supabase
            .from('matches')
            .update({ last_message_at: newMessage.createdAt })
            .eq('id', conversationId);
            
          if (updateMatchError) {
            console.warn('Failed to update match last_message_at:', getReadableError(updateMatchError));
          }
        }
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'send_message',
            details: { 
              conversation_id: conversationId,
              receiver_id: receiverId,
              message_type: 'text'
            }
          });
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
        // Supabase is required - no fallback to mock data
        throw new Error('Database connection required. Please check your internet connection and try again.');
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
    set({ isLoading: true, error: null });
    try {
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Create voice message in Supabase
        const newMessage: Message = {
          id: `msg-${Date.now()}`,
          senderId: currentUser.id,
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
        
        const { error: insertError } = await supabase
          .from('messages')
          .insert(messageRecord);
          
        if (insertError) throw insertError;
        
        // Update last message timestamp in match if it's a match conversation
        if (conversationId.startsWith('match-')) {
          const { error: updateMatchError } = await supabase
            .from('matches')
            .update({ last_message_at: newMessage.createdAt })
            .eq('id', conversationId);
            
          if (updateMatchError) {
            console.warn('Failed to update match last_message_at:', getReadableError(updateMatchError));
          }
        }
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'send_message',
            details: { 
              conversation_id: conversationId,
              receiver_id: receiverId,
              message_type: 'voice',
              duration
            }
          });
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
        // Supabase is required - no fallback to mock data
        throw new Error('Database connection required. Please check your internet connection and try again.');
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
    set({ isLoading: true, error: null });
    try {
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      if (isSupabaseConfigured() && supabase) {
        // Get messages from Supabase
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
          
        if (messagesError) throw messagesError;
        
        // Convert Supabase response to Message objects
        const conversationMessages = (messagesData || []).map(supabaseToMessage);
        
        // Log the action
        try {
          await supabase.rpc('log_user_action', {
            user_id: currentUser.id,
            action: 'view_messages',
            details: { 
              conversation_id: conversationId,
              message_count: conversationMessages.length
            }
          });
        } catch (logError) {
          console.warn('Failed to log view_messages action:', getReadableError(logError));
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
        // Supabase is required - no fallback to mock data
        throw new Error('Database connection required. Please check your internet connection and try again.');
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
    try {
      const { messages } = get();
      const conversationMessages = messages[conversationId] || [];
      
      if (conversationMessages.length === 0) return;
      
      const currentUser = JSON.parse(await AsyncStorage.getItem('auth-storage') || '{}')?.state?.user;
      
      if (!currentUser) return;
      
      if (isSupabaseConfigured() && supabase) {
        // Mark messages as read in Supabase
        const unreadMessageIds = conversationMessages
          .filter(msg => msg.receiverId === currentUser.id && !msg.read)
          .map(msg => msg.id);
          
        if (unreadMessageIds.length === 0) return;
        
        const { error: updateError } = await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadMessageIds);
          
        if (updateError) {
          console.warn('Failed to mark messages as read:', getReadableError(updateError));
          return;
        }
        
        // Update local state
        const updatedMessages = conversationMessages.map(msg => {
          if (msg.receiverId === currentUser.id && !msg.read) {
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
        // Supabase is required - no fallback to mock data
        console.warn('Database connection required to mark messages as read');
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', getReadableError(error));
    }
  },

  clearError: () => set({ error: null })
}));
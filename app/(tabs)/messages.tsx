import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { Match, Message, UserProfile } from '@/types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMatchesStore } from '@/store/matches-store';
import { useMessagesStore } from '@/store/messages-store';

interface ChatPreview {
  id: string;
  user: UserProfile;
  lastMessage?: Message;
  unreadCount: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { matches, getMatches } = useMatchesStore();
  const { messages, getMessages } = useMessagesStore();
  
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    await getMatches();
    
    // Load messages for each match
    if (matches.length > 0) {
      for (const match of matches) {
        await getMessages(match.id);
      }
    }
    
    setLoading(false);
  };
  
  useEffect(() => {
    if (!user) return;
    
    const loadChatPreviews = async () => {
      try {
        // Get all users
        const mockUsers = await AsyncStorage.getItem('mockUsers');
        const users = mockUsers ? JSON.parse(mockUsers) : [];
        
        // Create chat previews
        const previews = await Promise.all(matches.map(async (match) => {
          // Determine the other user in the match
          const otherUserId = match.userId === user.id ? match.matchedUserId : match.userId;
          
          // Find the other user's profile
          const otherUser = users.find((u: any) => u.id === otherUserId);
          if (!otherUser) return null;
          
          // Remove password from user object
          const { password, ...userWithoutPassword } = otherUser;
          
          // Get messages for this match
          const matchMessages = messages[match.id] || [];
          
          // Get last message
          const lastMessage = matchMessages.length > 0 
            ? matchMessages[matchMessages.length - 1] 
            : undefined;
          
          // Count unread messages
          const unreadCount = matchMessages.filter(
            msg => msg.receiverId === user.id && !msg.read
          ).length;
          
          return {
            id: match.id,
            user: userWithoutPassword,
            lastMessage,
            unreadCount
          } as ChatPreview;
        }));
        
        // Filter out null values and sort by last message time (newest first)
        const validPreviews = previews
          .filter((preview): preview is ChatPreview => preview !== null)
          .sort((a, b) => {
            const timeA = a?.lastMessage?.createdAt || 0;
            const timeB = b?.lastMessage?.createdAt || 0;
            return timeB - timeA;
          });
        
        setChatPreviews(validPreviews);
      } catch (error) {
        console.error('Failed to load chat previews', error);
      }
    };
    
    loadChatPreviews();
  }, [user, matches, messages]);
  
  const formatTime = (timestamp: number) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    
    // If today, show time
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this week, show day name
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Otherwise show date
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  const renderChatPreview = ({ item }: { item: ChatPreview }) => {
    return (
      <TouchableOpacity
        style={styles.chatPreview}
        onPress={() => router.push(`/chat/${item.user.id}`)}
      >
        <Image
          source={{ 
            uri: item.user.photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop' 
          }}
          style={styles.avatar}
        />
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName}>{item.user.name}</Text>
            {item.lastMessage && (
              <Text style={styles.timestamp}>
                {formatTime(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>
          
          <View style={styles.messagePreview}>
            {item.lastMessage ? (
              <Text 
                style={[
                  styles.previewText,
                  item.unreadCount > 0 && styles.unreadText
                ]}
                numberOfLines={1}
              >
                {item.lastMessage.type === 'voice' 
                  ? '🎤 Voice message' 
                  : item.lastMessage.content}
              </Text>
            ) : (
              <Text style={styles.previewText}>Start a conversation</Text>
            )}
            
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {chatPreviews.length > 0 ? (
        <FlatList
          data={chatPreviews}
          renderItem={renderChatPreview}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Messages Yet</Text>
          <Text style={styles.emptyText}>
            Start connecting with entrepreneurs to begin messaging
          </Text>
          <TouchableOpacity
            style={styles.discoverButton}
            onPress={() => router.push('/discover')}
          >
            <Text style={styles.discoverButtonText}>Discover Entrepreneurs</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  chatPreview: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  unreadText: {
    color: Colors.dark.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  discoverButton: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  discoverButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { MatchWithProfile, UserProfile } from '@/types/user';
import { useMatchesStore } from '@/store/matches-store';
import { useMessagesStore } from '@/store/messages-store';
import { Button } from '@/components/Button';

interface ChatPreview {
  id: string;
  user: UserProfile;
  lastMessage?: any;
  unreadCount: number;
  lastMessageTime: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user, isReady } = useAuthStore();
  const { matches, fetchMatches } = useMatchesStore();
  const { messages, getMessages } = useMessagesStore();
  
  const [chatPreviews, setChatPreviews] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  useEffect(() => {
    if (isReady && user) {
      loadData();
      setInitialLoad(false);
    }
  }, [isReady, user]);
  
  useFocusEffect(
    useCallback(() => {
      if (isReady && user) {
        loadData();
      }
    }, [isReady, user])
  );
  
  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await fetchMatches();
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const onRefresh = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      await fetchMatches();
    } catch (error) {
      console.error('Error refreshing matches:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    if (!user || !isReady) return;
    
    // Filter out matches without user profiles and create chat previews
    const validMatches = matches.filter((match: MatchWithProfile) => {
      return match && 
             match.matched_user_profile && 
             match.matched_user_profile.id && 
             match.matched_user_profile.name;
    });
    
    // Create chat previews from valid matches
    const previews = validMatches.map((match: MatchWithProfile) => {
      // Get messages for this match
      const matchMessages = messages[match.match_id] || [];
      
      // Get last message
      const lastMessage = matchMessages.length > 0 
        ? matchMessages[matchMessages.length - 1] 
        : undefined;
      
      // Count unread messages
      const unreadCount = matchMessages.filter(
        msg => msg.receiverId === user.id && !msg.read
      ).length;
      
      return {
        id: match.match_id,
        user: match.matched_user_profile,
        lastMessage,
        unreadCount,
        lastMessageTime: match.last_message_at || match.created_at
      } as ChatPreview;
    });
    
    // Sort by last message time (newest first)
    const sortedPreviews = previews.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    
    setChatPreviews(sortedPreviews);
  }, [user, isReady, matches, messages]);
  
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
  
  const handleChatPress = (matchId: string, userId: string) => {
    // Fetch messages only when conversation is opened (lazy loading)
    if (!messages[matchId] || messages[matchId].length === 0) {
      getMessages(matchId);
    }
    router.push(`/chat/${userId}`);
  };
  
  const renderChatPreview = ({ item }: { item: ChatPreview }) => {
    // Additional safety check for item.user
    if (!item || !item.user || !item.user.id) {
      return null;
    }
    
    return (
      <TouchableOpacity
        style={styles.chatPreview}
        onPress={() => handleChatPress(item.id, item.user.id)}
      >
        <Image
          source={{ 
            uri: item.user.photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop' 
          }}
          style={styles.avatar}
        />
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName}>{item.user.name || 'Unknown User'}</Text>
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
                  : item.lastMessage.content || 'Message'}
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
  
  if (loading || initialLoad || !isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </SafeAreaView>
    );
  }
  
  if (!user) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <Text style={styles.errorText}>Not authenticated</Text>
        <Button
          title="Login"
          onPress={() => router.replace('/(auth)')}
          variant="primary"
          style={styles.retryButton}
        />
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.accent}
              colors={[Colors.dark.accent]}
            />
          }
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 150,
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
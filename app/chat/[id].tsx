import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useMessagesStore } from '@/store/messages-store';
import { Message, UserProfile } from '@/types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageBubble } from '@/components/MessageBubble';
import { Send, Mic, X } from 'lucide-react-native';
import { ProfileHeader } from '@/components/ProfileHeader';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { messages, sendMessage, getMessages, markAsRead } = useMessagesStore();
  
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  
  const flatListRef = useRef<FlatList>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get other user profile
        const mockUsers = await AsyncStorage.getItem('mockUsers');
        const users = mockUsers ? JSON.parse(mockUsers) : [];
        
        const foundUser = users.find((u: any) => u.id === id);
        
        if (!foundUser || !user) {
          setError('User not found');
          return;
        }
        
        // Remove password from user object
        const { password, ...userWithoutPassword } = foundUser;
        setOtherUser(userWithoutPassword);
        
        // Find match between current user and other user
        const mockMatches = await AsyncStorage.getItem('mockMatches');
        const matches = mockMatches ? JSON.parse(mockMatches) : [];
        
        const match = matches.find(
          (m: any) => 
            (m.userId === user.id && m.matchedUserId === id) || 
            (m.userId === id && m.matchedUserId === user.id)
        );
        
        if (!match) {
          // Create a new match if it doesn't exist
          const newMatch = {
            id: `match-${Date.now()}`,
            userId: user.id,
            matchedUserId: id,
            createdAt: Date.now()
          };
          
          matches.push(newMatch);
          await AsyncStorage.setItem('mockMatches', JSON.stringify(matches));
          
          setMatchId(newMatch.id);
        } else {
          setMatchId(match.id);
        }
      } catch (err) {
        setError('Failed to load chat');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (id && user) {
      fetchData();
    }
  }, [id, user]);
  
  useEffect(() => {
    if (matchId) {
      getMessages(matchId);
      
      // Mark messages as read
      markAsRead(matchId);
    }
  }, [matchId, getMessages, markAsRead]);
  
  const handleSend = async () => {
    if (!messageText.trim() || !matchId || !otherUser) return;
    
    await sendMessage(matchId, messageText, otherUser.id);
    setMessageText('');
    
    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };
  
  const handleRecordVoice = () => {
    // In a real app, this would start recording a voice message
    setIsRecording(!isRecording);
  };
  
  const handleCancelRecording = () => {
    setIsRecording(false);
  };
  
  const handlePlayVoice = (messageId: string) => {
    // In a real app, this would play the voice message
    if (currentlyPlayingId === messageId) {
      setCurrentlyPlayingId(null);
    } else {
      setCurrentlyPlayingId(messageId);
    }
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </SafeAreaView>
    );
  }
  
  if (error || !otherUser) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Something went wrong'}</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  const chatMessages = matchId ? messages[matchId] || [] : [];
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{
          headerTitle: () => (
            <TouchableOpacity onPress={() => router.push(`/profile/${otherUser.id}`)}>
              <Text style={styles.headerTitle}>{otherUser.name}</Text>
            </TouchableOpacity>
          ),
        }}
      />
      
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={() => (
            <View style={styles.header}>
              <ProfileHeader 
                profile={otherUser}
                onPress={() => router.push(`/profile/${otherUser.id}`)}
              />
            </View>
          )}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isCurrentUser={item.senderId === user?.id}
              onPlayVoice={item.type === 'voice' ? () => handlePlayVoice(item.id) : undefined}
              isPlaying={currentlyPlayingId === item.id}
            />
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        
        <View style={styles.inputContainer}>
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingText}>Recording...</Text>
              </View>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelRecording}
              >
                <X size={20} color={Colors.dark.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor={Colors.dark.textSecondary}
              multiline
            />
          )}
          
          {messageText.trim() ? (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
            >
              <Send size={20} color={Colors.dark.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.micButton}
              onPress={handleRecordVoice}
            >
              <Mic size={20} color={Colors.dark.text} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
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
    padding: 24,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  messagesList: {
    paddingBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    color: Colors.dark.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingText: {
    color: Colors.dark.accent,
    marginLeft: 8,
  },
  cancelButton: {
    padding: 4,
  },
});
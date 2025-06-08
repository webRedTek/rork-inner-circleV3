import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Message } from '@/types/user';
import Colors from '@/constants/colors';
import { Play, Pause } from 'lucide-react-native';

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  onPlayVoice?: () => void;
  isPlaying?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  onPlayVoice,
  isPlaying
}) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
    ]}>
      {message.type === 'text' ? (
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.currentUserText : styles.otherUserText
        ]}>
          {message.content}
        </Text>
      ) : (
        <View style={styles.voiceContainer}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={onPlayVoice}
          >
            {isPlaying ? (
              <Pause size={20} color={isCurrentUser ? Colors.dark.text : Colors.dark.accent} />
            ) : (
              <Play size={20} color={isCurrentUser ? Colors.dark.text : Colors.dark.accent} />
            )}
          </TouchableOpacity>
          
          <View style={styles.voiceInfo}>
            <View style={styles.voiceWaveform}>
              {/* Simplified waveform visualization */}
              {Array.from({ length: 10 }).map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.waveformBar,
                    { 
                      height: 4 + Math.random() * 12,
                      backgroundColor: isCurrentUser ? Colors.dark.text : Colors.dark.accent
                    }
                  ]} 
                />
              ))}
            </View>
            
            {message.voiceDuration && (
              <Text style={[
                styles.durationText,
                isCurrentUser ? styles.currentUserText : styles.otherUserText
              ]}>
                {formatDuration(message.voiceDuration)}
              </Text>
            )}
          </View>
        </View>
      )}
      
      <Text style={[
        styles.timeText,
        isCurrentUser ? styles.currentUserTimeText : styles.otherUserTimeText
      ]}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.dark.accent,
    borderBottomRightRadius: 4,
  },
  otherUserContainer: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  currentUserText: {
    color: Colors.dark.text,
  },
  otherUserText: {
    color: Colors.dark.text,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  currentUserTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserTimeText: {
    color: Colors.dark.textSecondary,
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    marginBottom: 4,
  },
  waveformBar: {
    width: 3,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  durationText: {
    fontSize: 12,
  },
});
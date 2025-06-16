import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  TextInput, 
  ScrollView, 
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useGroupsStore } from '@/store/groups-store';
import { Button } from '@/components/Button';
import { ArrowLeft, Edit, Send, Calendar, Plus, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function GroupDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const { 
    currentGroup, 
    groupMessages, 
    groupEvents, 
    userRSVPs, 
    fetchGroupDetails, 
    sendGroupMessage, 
    createGroupEvent, 
    rsvpToEvent, 
    isLoading, 
    error 
  } = useGroupsStore();
  
  const [activeTab, setActiveTab] = useState<'info' | 'messages' | 'events'>('info');
  const [messageText, setMessageText] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartTime, setEventStartTime] = useState(new Date());
  const [eventEndTime, setEventEndTime] = useState(new Date());
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [createEventLoading, setCreateEventLoading] = useState(false);
  
  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchGroupDetails(id);
    }
  }, [id]);
  
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await sendGroupMessage(id as string, messageText);
      setMessageText('');
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
    }
  };
  
  const handleRSVP = async (eventId: string, response: 'yes' | 'no' | 'maybe') => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await rsvpToEvent(eventId, response);
    } catch (err) {
      Alert.alert('Error', 'Failed to RSVP');
    }
  };
  
  const handleAddToCalendar = (event: any) => {
    if (Platform.OS === 'web') {
      Alert.alert('Calendar Integration', 'Calendar integration is not available on web. Please add the event manually to your calendar.');
      return;
    }
    
    // For native platforms, we would use expo-calendar, but it's not available in this setup
    // As a fallback, show event details for manual addition
    Alert.alert(
      'Add to Calendar',
      `Event: ${event.title}\nDate: ${new Date(event.startTime).toLocaleString()}\nLocation: ${event.location || 'Not specified'}`,
      [
        { text: 'OK', style: 'cancel' }
      ]
    );
  };
  
  const handleCreateEvent = async () => {
    if (!eventTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }
    
    setCreateEventLoading(true);
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      await createGroupEvent({
        groupId: id as string,
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        startTime: eventStartTime.getTime(),
        endTime: eventEndTime.getTime()
      });
      
      setShowEventModal(false);
      setEventTitle('');
      setEventDescription('');
      setEventLocation('');
      setEventStartTime(new Date());
      setEventEndTime(new Date());
    } catch (err) {
      Alert.alert('Error', 'Failed to create event');
    } finally {
      setCreateEventLoading(false);
    }
  };
  
  const onStartTimeChange = (event: any, selectedDate?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEventStartTime(selectedDate);
    }
  };
  
  const onEndTimeChange = (event: any, selectedDate?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEventEndTime(selectedDate);
    }
  };
  
  const isAdmin = user && currentGroup && user.id === currentGroup.createdBy;
  
  if (isLoading || !currentGroup) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </SafeAreaView>
    );
  }
  
  if (error || !currentGroup) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <Text style={styles.errorText}>Failed to load group details. Please try again.</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="primary"
          style={styles.errorButton}
        />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{currentGroup.name}</Text>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => Alert.alert('Edit Group', 'Editing group functionality coming soon')}
          >
            <Edit size={20} color={Colors.dark.text} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'info' && styles.activeTab]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Info</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>Events</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.content}>
        {activeTab === 'info' && (
          <View style={styles.infoContainer}>
            <Image
              source={{ uri: currentGroup.imageUrl || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2942&auto=format&fit=crop' }}
              style={styles.groupImage}
            />
            <Text style={styles.groupDescription}>{currentGroup.description}</Text>
            <View style={styles.groupMeta}>
              <View style={styles.memberCount}>
                <Calendar size={16} color={Colors.dark.textSecondary} style={styles.memberIcon} />
                <Text style={styles.memberText}>{currentGroup.memberIds.length} members</Text>
              </View>
              {currentGroup.category && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryText}>{currentGroup.category}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {activeTab === 'messages' && (
          <View style={styles.messagesContainer}>
            {groupMessages.length > 0 ? (
              groupMessages.map((message) => (
                <View key={message.id} style={styles.messageBubble}>
                  <Text style={styles.messageSender}>Admin</Text>
                  <Text style={styles.messageContent}>{message.content}</Text>
                  <Text style={styles.messageTime}>
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noMessagesText}>No messages yet.</Text>
            )}
            
            {isAdmin && (
              <View style={styles.messageInputContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Type a message..."
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={messageText}
                  onChangeText={setMessageText}
                />
                <TouchableOpacity 
                  style={styles.sendButton}
                  onPress={handleSendMessage}
                >
                  <Send size={20} color={Colors.dark.accent} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        {activeTab === 'events' && (
          <View style={styles.eventsContainer}>
            {isAdmin && (
              <Button
                title="Create Event"
                onPress={() => setShowEventModal(true)}
                variant="primary"
                size="small"
                style={styles.createEventButton}
              />
            )}
            
            {groupEvents.length > 0 ? (
              groupEvents.map((event) => {
                const userRSVP = userRSVPs.find(rsvp => rsvp.eventId === event.id);
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventTime}>
                      {new Date(event.startTime).toLocaleString()}
                    </Text>
                    {event.location && (
                      <Text style={styles.eventLocation}>{event.location}</Text>
                    )}
                    <Text style={styles.eventDescription} numberOfLines={2}>
                      {event.description}
                    </Text>
                    <View style={styles.rsvpContainer}>
                      <Button
                        title="Yes"
                        onPress={() => handleRSVP(event.id, 'yes')}
                        variant={userRSVP?.response === 'yes' ? 'primary' : 'outline'}
                        size="small"
                        style={styles.rsvpButton}
                      />
                      <Button
                        title="No"
                        onPress={() => handleRSVP(event.id, 'no')}
                        variant={userRSVP?.response === 'no' ? 'primary' : 'outline'}
                        size="small"
                        style={styles.rsvpButton}
                      />
                      <Button
                        title="Maybe"
                        onPress={() => handleRSVP(event.id, 'maybe')}
                        variant={userRSVP?.response === 'maybe' ? 'primary' : 'outline'}
                        size="small"
                        style={styles.rsvpButton}
                      />
                    </View>
                    <Button
                      title="Add to Calendar"
                      onPress={() => handleAddToCalendar(event)}
                      variant="outline"
                      size="small"
                      style={styles.calendarButton}
                    />
                  </View>
                );
              })
            ) : (
              <Text style={styles.noEventsText}>No upcoming events.</Text>
            )}
          </View>
        )}
      </ScrollView>
      
      <Modal
        visible={showEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Group Event</Text>
              <TouchableOpacity 
                onPress={() => setShowEventModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TextInput
                style={styles.input}
                placeholder="Event Title"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventTitle}
                onChangeText={setEventTitle}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Event Description"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={4}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Location (optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventLocation}
                onChangeText={setEventLocation}
              />
              
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  Start Time: {eventStartTime.toLocaleString()}
                </Text>
              </TouchableOpacity>
              
              {showStartTimePicker && (
                <DateTimePicker
                  value={eventStartTime}
                  mode="datetime"
                  display="default"
                  onChange={onStartTimeChange}
                />
              )}
              
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  End Time: {eventEndTime.toLocaleString()}
                </Text>
              </TouchableOpacity>
              
              {showEndTimePicker && (
                <DateTimePicker
                  value={eventEndTime}
                  mode="datetime"
                  display="default"
                  onChange={onEndTimeChange}
                />
              )}
              
              <Button
                title="Create Event"
                onPress={handleCreateEvent}
                variant="primary"
                size="large"
                loading={createEventLoading}
                style={styles.createEventModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    width: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  editButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  activeTabText: {
    color: Colors.dark.accent,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  infoContainer: {
    padding: 16,
  },
  groupImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  groupDescription: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 16,
    lineHeight: 22,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  memberIcon: {
    marginRight: 6,
  },
  memberText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  categoryTag: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageSender: {
    fontSize: 12,
    color: Colors.dark.accent,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  messageContent: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  messageTime: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  noMessagesText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 10,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sendButton: {
    marginLeft: 10,
    padding: 10,
    backgroundColor: Colors.dark.background,
    borderRadius: 20,
  },
  eventsContainer: {
    padding: 16,
  },
  createEventButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  eventCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  eventTime: {
    fontSize: 14,
    color: Colors.dark.accent,
    marginBottom: 8,
  },
  eventLocation: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  rsvpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rsvpButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  calendarButton: {
    width: '100%',
    marginTop: 8,
  },
  noEventsText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  createEventModalButton: {
    marginTop: 8,
  },
});
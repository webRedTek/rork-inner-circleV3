import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useGroupsStore } from '@/store/groups-store';
import { useAuthStore } from '@/store/auth-store';
import { Group, GroupEvent, GroupEventRSVP, GroupMessage } from '@/types/user';
import { Button } from '@/components/Button';
import { 
  Users, 
  Calendar as CalendarIcon, 
  MessageCircle, 
  Info, 
  Edit, 
  Plus, 
  X, 
  Check, 
  Clock, 
  MapPin,
  Send
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { notify } from '@/store/notification-store';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    currentGroup, 
    groupMessages, 
    groupEvents,
    userRSVPs,
    fetchGroupDetails, 
    sendGroupMessage,
    createGroupEvent,
    updateGroupEvent,
    rsvpToEvent,
    updateGroup,
    fetchGroupMessages,
    fetchGroupEvents,
    isLoading, 
    isMessagesLoading,
    isEventsLoading,
    error 
  } = useGroupsStore();
  
  const [activeTab, setActiveTab] = useState<'info' | 'messages' | 'events'>('info');
  const [message, setMessage] = useState('');
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupEvent | null>(null);
  const [messagesPage, setMessagesPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [isMessagesLoadingMore, setIsMessagesLoadingMore] = useState(false);
  const [isEventsLoadingMore, setIsEventsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  
  // Event form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventReminder, setEventReminder] = useState('30'); // minutes before
  const [eventTimezone, setEventTimezone] = useState('UTC');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Group edit form state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupCategory, setGroupCategory] = useState('');
  const [groupIndustry, setGroupIndustry] = useState('');
  
  // Location autocomplete state
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationSuggestions = [
    "123 Main St, City",
    "456 Business Ave, Town",
    "789 Conference Rd, Metro",
    "Central Park, City",
    "Downtown Cafe, Urban Area"
  ];
  
  const scrollViewRef = useRef<ScrollView>(null);
  
  useEffect(() => {
    if (id) {
      fetchGroupDetails(id);
    }
  }, [id, fetchGroupDetails]);
  
  useEffect(() => {
    if (error) {
      notify.error(error);
    }
  }, [error]);
  
  useEffect(() => {
    if (currentGroup) {
      setGroupName(currentGroup.name);
      setGroupDescription(currentGroup.description);
      setGroupCategory(currentGroup.category || '');
      setGroupIndustry(currentGroup.industry || '');
    }
  }, [currentGroup]);
  
  useEffect(() => {
    if (activeTab === 'messages' && !messagesLoaded && currentGroup) {
      loadMessages();
    }
  }, [activeTab, messagesLoaded, currentGroup]);
  
  useEffect(() => {
    if (activeTab === 'events' && !eventsLoaded && currentGroup) {
      loadEvents();
    }
  }, [activeTab, eventsLoaded, currentGroup]);
  
  const isGroupAdmin = currentGroup?.createdBy === user?.id;
  
  const loadMessages = async (page: number = 1) => {
    if (!currentGroup) return;
    setIsMessagesLoading(true);
    try {
      await fetchGroupMessages(currentGroup.id, page);
      setMessagesLoaded(true);
      setMessagesPage(page);
    } catch (err) {
      notify.error('Failed to load messages');
      console.error('Error loading messages:', err);
    } finally {
      setIsMessagesLoading(false);
    }
  };
  
  const loadMoreMessages = async () => {
    if (!currentGroup || isMessagesLoadingMore) return;
    setIsMessagesLoadingMore(true);
    try {
      await loadMessages(messagesPage + 1);
    } catch (err) {
      notify.error('Failed to load more messages');
      console.error('Error loading more messages:', err);
    } finally {
      setIsMessagesLoadingMore(false);
    }
  };
  
  const loadEvents = async (page: number = 1) => {
    if (!currentGroup) return;
    setIsEventsLoading(true);
    try {
      await fetchGroupEvents(currentGroup.id, page);
      setEventsLoaded(true);
      setEventsPage(page);
    } catch (err) {
      notify.error('Failed to load events');
      console.error('Error loading events:', err);
    } finally {
      setIsEventsLoading(false);
    }
  };
  
  const loadMoreEvents = async () => {
    if (!currentGroup || isEventsLoadingMore) return;
    setIsEventsLoadingMore(true);
    try {
      await loadEvents(eventsPage + 1);
    } catch (err) {
      notify.error('Failed to load more events');
      console.error('Error loading more events:', err);
    } finally {
      setIsEventsLoadingMore(false);
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (currentGroup) {
        await fetchGroupDetails(currentGroup.id);
        if (activeTab === 'messages') {
          await loadMessages();
        } else if (activeTab === 'events') {
          await loadEvents();
        }
      }
    } catch (err) {
      notify.error('Failed to refresh content');
      console.error('Error refreshing:', err);
    } finally {
      setRefreshing(false);
    }
  };
  
  const handleSendMessage = async () => {
    if (!message.trim() || !currentGroup || !isGroupAdmin) return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      await sendGroupMessage(currentGroup.id, message);
      setMessage('');
      
      // Scroll to bottom after sending
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      notify.success('Message sent');
    } catch (error) {
      notify.error('Failed to send message');
      console.error('Error sending message:', error);
    }
  };
  
  const validateEventForm = (): boolean => {
    const errors: Record<string, string> = {};
    const now = new Date();
    let isValid = true;
    
    if (!eventTitle.trim()) {
      errors.title = 'Title is required';
      isValid = false;
    }
    
    if (!eventDate) {
      errors.date = 'Date is required';
      isValid = false;
    }
    
    if (!eventTime) {
      errors.time = 'Start time is required';
      isValid = false;
    }
    
    if (eventDate && eventTime) {
      try {
        const startDateTime = new Date(`${eventDate}T${eventTime}:00`);
        if (startDateTime < now) {
          errors.date = 'Event cannot be in the past';
          isValid = false;
        }
        
        if (eventEndTime) {
          const endDateTime = new Date(`${eventDate}T${eventEndTime}:00`);
          if (endDateTime <= startDateTime) {
            errors.endTime = 'End time must be after start time';
            isValid = false;
          }
        }
      } catch (e) {
        errors.date = 'Invalid date or time format';
        isValid = false;
      }
    }
    
    if (eventReminder) {
      const reminderMinutes = parseInt(eventReminder);
      if (isNaN(reminderMinutes) || reminderMinutes < 0) {
        errors.reminder = 'Reminder must be a positive number';
        isValid = false;
      }
    }
    
    setFormErrors(errors);
    return isValid;
  };
  
  const handleCreateEvent = async () => {
    if (!validateEventForm() || !currentGroup) {
      notify.warning('Please correct the errors in the form');
      return;
    }
    
    try {
      // Parse date and time
      const dateTimeString = `${eventDate}T${eventTime}:00`;
      const startTime = new Date(dateTimeString).getTime();
      
      let endTime: number | undefined;
      if (eventEndTime) {
        const endTimeString = `${eventDate}T${eventEndTime}:00`;
        endTime = new Date(endTimeString).getTime();
      }
      
      let reminder: number | undefined;
      if (eventReminder) {
        const reminderMinutes = parseInt(eventReminder);
        if (!isNaN(reminderMinutes)) {
          reminder = reminderMinutes * 60 * 1000; // Convert to milliseconds
        }
      }
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      await createGroupEvent({
        groupId: currentGroup.id,
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        startTime,
        endTime,
        reminder
      });
      
      // Reset form
      setEventTitle('');
      setEventDescription('');
      setEventLocation('');
      setEventDate('');
      setEventTime('');
      setEventEndTime('');
      setEventReminder('30');
      setFormErrors({});
      
      setShowCreateEventModal(false);
      notify.success('Event created successfully');
    } catch (error) {
      notify.error('Failed to create event');
      console.error('Error creating event:', error);
    }
  };
  
  const handleEditEvent = async () => {
    if (!selectedEvent || !validateEventForm() || !currentGroup) {
      notify.warning('Please correct the errors in the form');
      return;
    }
    
    try {
      // Parse date and time
      const dateTimeString = `${eventDate}T${eventTime}:00`;
      const startTime = new Date(dateTimeString).getTime();
      
      let endTime: number | undefined;
      if (eventEndTime) {
        const endTimeString = `${eventDate}T${eventEndTime}:00`;
        endTime = new Date(endTimeString).getTime();
      }
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      await updateGroupEvent({
        id: selectedEvent.id,
        groupId: currentGroup.id,
        title: eventTitle,
        description: eventDescription,
        location: eventLocation,
        startTime,
        endTime
      });
      
      setShowEditEventModal(false);
      notify.success('Event updated successfully');
    } catch (error) {
      notify.error('Failed to update event');
      console.error('Error updating event:', error);
    }
  };
  
  const handleEditGroup = async () => {
    if (!groupName.trim() || !currentGroup) {
      notify.warning('Group name is required');
      return;
    }
    
    try {
      await updateGroup({
        id: currentGroup.id,
        name: groupName,
        description: groupDescription,
        category: groupCategory || 'Interest',
        industry: groupIndustry || undefined
      });
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setShowEditGroupModal(false);
      notify.success('Group updated successfully');
    } catch (error) {
      notify.error('Failed to update group');
      console.error('Error updating group:', error);
    }
  };
  
  const handleRSVP = async (eventId: string, response: 'yes' | 'no' | 'maybe') => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      await rsvpToEvent(eventId, response);
      notify.success(`RSVP updated to ${response}`);
    } catch (error) {
      notify.error('Failed to update RSVP');
      console.error('Error updating RSVP:', error);
    }
  };
  
  const handleAddToCalendar = async (event: GroupEvent) => {
    if (Platform.OS === 'web') {
      notify.info('Calendar integration is not available on web');
      return;
    }
    
    try {
      // Calendar functionality is not available in this implementation
      // This would require expo-calendar package
      notify.info('Calendar integration requires expo-calendar package');
    } catch (error) {
      notify.error('Failed to add event to calendar');
      console.error('Error adding to calendar:', error);
    }
  };
  
  const openEditEventModal = (event: GroupEvent) => {
    setSelectedEvent(event);
    
    // Format date and time for the form
    const eventDate = new Date(event.startTime);
    const formattedDate = eventDate.toISOString().split('T')[0];
    const formattedTime = eventDate.toTimeString().substring(0, 5);
    
    let formattedEndTime = '';
    if (event.endTime) {
      const endDate = new Date(event.endTime);
      formattedEndTime = endDate.toTimeString().substring(0, 5);
    }
    
    setEventTitle(event.title);
    setEventDescription(event.description);
    setEventLocation(event.location || '');
    setEventDate(formattedDate);
    setEventTime(formattedTime);
    setEventEndTime(formattedEndTime);
    
    setShowEditEventModal(true);
  };
  
  const getUserRSVPStatus = (eventId: string): 'yes' | 'no' | 'maybe' | null => {
    const rsvp = userRSVPs.find(r => r.eventId === eventId);
    return rsvp ? rsvp.response : null;
  };
  
  const handleLocationSelect = (location: string) => {
    setEventLocation(location);
    setShowLocationSuggestions(false);
  };
  
  const handleTabChange = (tab: 'info' | 'messages' | 'events') => {
    setActiveTab(tab);
  };
  
  if (isLoading && !currentGroup) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </SafeAreaView>
    );
  }
  
  if (!currentGroup) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <Text style={styles.errorText}>Group not found</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="primary"
          style={styles.backButton}
        />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.header}>
          <Image
            source={{ uri: currentGroup.imageUrl || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2942&auto=format&fit=crop' }}
            style={styles.headerImage}
          />
          
          <View style={styles.headerOverlay}>
            <Text style={styles.groupName}>{currentGroup.name}</Text>
            
            <View style={styles.groupMeta}>
              <View style={styles.memberCount}>
                <Users size={14} color={Colors.dark.text} style={styles.memberIcon} />
                <Text style={styles.memberText}>{currentGroup.memberIds.length} members</Text>
              </View>
              
              {currentGroup.category && (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryText}>{currentGroup.category}</Text>
                </View>
              )}
            </View>
            
            {isGroupAdmin && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setShowEditGroupModal(true)}
              >
                <Edit size={16} color={Colors.dark.text} />
                <Text style={styles.editButtonText}>Edit Group</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.activeTab]}
            onPress={() => handleTabChange('info')}
          >
            <Info size={20} color={activeTab === 'info' ? Colors.dark.accent : Colors.dark.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
            onPress={() => handleTabChange('messages')}
          >
            <MessageCircle size={20} color={activeTab === 'messages' ? Colors.dark.accent : Colors.dark.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>Messages</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.activeTab]}
            onPress={() => handleTabChange('events')}
          >
            <CalendarIcon size={20} color={activeTab === 'events' ? Colors.dark.accent : Colors.dark.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>Events</Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'info' && (
          <ScrollView 
            style={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{currentGroup.description}</Text>
            </View>
            
            {currentGroup.industry && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Industry</Text>
                <Text style={styles.sectionText}>{currentGroup.industry}</Text>
              </View>
            )}
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Created By</Text>
              <Text style={styles.sectionText}>
                {user?.id === currentGroup.createdBy ? 'You' : 'Another member'}
              </Text>
            </View>
          </ScrollView>
        )}
        
        {activeTab === 'messages' && (
          <>
            <ScrollView 
              style={styles.content}
              ref={scrollViewRef}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
                if (isCloseToBottom && !isMessagesLoadingMore) {
                  loadMoreMessages();
                }
              }}
              scrollEventThrottle={400}
            >
              {isMessagesLoading && !isMessagesLoadingMore ? (
                <View style={styles.tabLoadingContainer}>
                  <ActivityIndicator size="large" color={Colors.dark.accent} />
                  <Text style={styles.tabLoadingText}>Loading messages...</Text>
                </View>
              ) : groupMessages.length === 0 ? (
                <View style={styles.emptyState}>
                  <MessageCircle size={40} color={Colors.dark.textSecondary} />
                  <Text style={styles.emptyStateText}>No messages yet</Text>
                  {isGroupAdmin && (
                    <Text style={styles.emptyStateSubtext}>
                      As the group admin, you can send the first message to get the conversation started.
                    </Text>
                  )}
                  {!isGroupAdmin && (
                    <Text style={styles.emptyStateSubtext}>
                      Only group admins can send messages to the entire group.
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.messagesList}>
                  {groupMessages.map((message) => (
                    <View key={message.id} style={styles.messageItem}>
                      <View style={styles.messageHeader}>
                        <Text style={styles.messageSender}>
                          {message.senderId === user?.id ? 'You' : 'Admin'}
                        </Text>
                        <Text style={styles.messageTime}>
                          {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                        </Text>
                      </View>
                      <Text style={styles.messageContent}>{message.content}</Text>
                    </View>
                  ))}
                  {isMessagesLoadingMore && (
                    <View style={styles.loadMoreContainer}>
                      <ActivityIndicator size="small" color={Colors.dark.accent} />
                      <Text style={styles.loadMoreText}>Loading more messages...</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            
            {isGroupAdmin && (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                />
                <TouchableOpacity 
                  style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={!message.trim()}
                >
                  <Send size={20} color={message.trim() ? Colors.dark.text : Colors.dark.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        
        {activeTab === 'events' && (
          <>
            <ScrollView 
              style={styles.content}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
                if (isCloseToBottom && !isEventsLoadingMore) {
                  loadMoreEvents();
                }
              }}
              scrollEventThrottle={400}
            >
              {isGroupAdmin && (
                <TouchableOpacity 
                  style={styles.createEventButton}
                  onPress={() => setShowCreateEventModal(true)}
                >
                  <Plus size={20} color={Colors.dark.text} />
                  <Text style={styles.createEventText}>Create New Event</Text>
                </TouchableOpacity>
              )}
              
              {isEventsLoading && !isEventsLoadingMore ? (
                <View style={styles.tabLoadingContainer}>
                  <ActivityIndicator size="large" color={Colors.dark.accent} />
                  <Text style={styles.tabLoadingText}>Loading events...</Text>
                </View>
              ) : groupEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <CalendarIcon size={40} color={Colors.dark.textSecondary} />
                  <Text style={styles.emptyStateText}>No events scheduled</Text>
                  {isGroupAdmin && (
                    <Text style={styles.emptyStateSubtext}>
                      Create an event to bring group members together.
                    </Text>
                  )}
                  {!isGroupAdmin && (
                    <Text style={styles.emptyStateSubtext}>
                      There are no upcoming events for this group.
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.eventsList}>
                  {groupEvents
                    .sort((a, b) => a.startTime - b.startTime)
                    .map((event) => {
                      const eventDate = new Date(event.startTime);
                      const isUpcoming = eventDate > new Date();
                      const userRSVP = getUserRSVPStatus(event.id);
                      
                      return (
                        <View key={event.id} style={[styles.eventItem, !isUpcoming && styles.pastEvent]}>
                          <View style={styles.eventHeader}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            {isGroupAdmin && isUpcoming && (
                              <TouchableOpacity 
                                style={styles.editEventButton}
                                onPress={() => openEditEventModal(event)}
                              >
                                <Edit size={16} color={Colors.dark.textSecondary} />
                              </TouchableOpacity>
                            )}
                          </View>
                          
                          <View style={styles.eventDetails}>
                            <View style={styles.eventDetailItem}>
                              <Clock size={16} color={Colors.dark.textSecondary} style={styles.eventDetailIcon} />
                              <Text style={styles.eventDetailText}>
                                {format(eventDate, 'EEEE, MMMM d, yyyy')} at {format(eventDate, 'h:mm a')}
                              </Text>
                            </View>
                            
                            {event.location && (
                              <View style={styles.eventDetailItem}>
                                <MapPin size={16} color={Colors.dark.textSecondary} style={styles.eventDetailIcon} />
                                <Text style={styles.eventDetailText}>{event.location}</Text>
                              </View>
                            )}
                          </View>
                          
                          {event.description && (
                            <Text style={styles.eventDescription}>{event.description}</Text>
                          )}
                          
                          {isUpcoming && (
                            <View style={styles.eventActions}>
                              <View style={styles.rsvpButtons}>
                                <TouchableOpacity 
                                  style={[
                                    styles.rsvpButton, 
                                    userRSVP === 'yes' && styles.rsvpButtonActive,
                                    styles.rsvpYesButton
                                  ]}
                                  onPress={() => handleRSVP(event.id, 'yes')}
                                >
                                  <Text style={[
                                    styles.rsvpButtonText,
                                    userRSVP === 'yes' && styles.rsvpButtonTextActive
                                  ]}>Going</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                  style={[
                                    styles.rsvpButton, 
                                    userRSVP === 'maybe' && styles.rsvpButtonActive,
                                    styles.rsvpMaybeButton
                                  ]}
                                  onPress={() => handleRSVP(event.id, 'maybe')}
                                >
                                  <Text style={[
                                    styles.rsvpButtonText,
                                    userRSVP === 'maybe' && styles.rsvpButtonTextActive
                                  ]}>Maybe</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                  style={[
                                    styles.rsvpButton, 
                                    userRSVP === 'no' && styles.rsvpButtonActive,
                                    styles.rsvpNoButton
                                  ]}
                                  onPress={() => handleRSVP(event.id, 'no')}
                                >
                                  <Text style={[
                                    styles.rsvpButtonText,
                                    userRSVP === 'no' && styles.rsvpButtonTextActive
                                  ]}>Can't Go</Text>
                                </TouchableOpacity>
                              </View>
                              
                              <TouchableOpacity 
                                style={styles.calendarButton}
                                onPress={() => handleAddToCalendar(event)}
                              >
                                <CalendarIcon size={16} color={Colors.dark.accent} />
                                <Text style={styles.calendarButtonText}>Add to Calendar</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  {isEventsLoadingMore && (
                    <View style={styles.loadMoreContainer}>
                      <ActivityIndicator size="small" color={Colors.dark.accent} />
                      <Text style={styles.loadMoreText}>Loading more events...</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
      
      {/* Create Event Modal */}
      <Modal
        visible={showCreateEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Event</Text>
              <TouchableOpacity 
                onPress={() => setShowCreateEventModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <TextInput
                style={[styles.modalInput, formErrors.title && styles.inputError]}
                placeholder="Event Title *"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventTitle}
                onChangeText={setEventTitle}
              />
              {formErrors.title && <Text style={styles.errorText}>{formErrors.title}</Text>}
              
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Event Description"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={4}
              />
              
              <View style={styles.locationContainer}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Location"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={eventLocation}
                  onChangeText={(text) => {
                    setEventLocation(text);
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                />
                {showLocationSuggestions && eventLocation.length > 2 && (
                  <View style={styles.locationSuggestions}>
                    {locationSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(eventLocation.toLowerCase()))
                      .map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.locationSuggestionItem}
                          onPress={() => handleLocationSelect(suggestion)}
                        >
                          <Text style={styles.locationSuggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>
              
              <Text style={styles.inputLabel}>Date *</Text>
              <TextInput
                style={[styles.modalInput, formErrors.date && styles.inputError]}
                placeholder="YYYY-MM-DD (e.g., 2025-06-20)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventDate}
                onChangeText={setEventDate}
              />
              <Text style={styles.inputHint}>Format: YYYY-MM-DD. In a full implementation, this would be a date picker.</Text>
              {formErrors.date && <Text style={styles.errorText}>{formErrors.date}</Text>}
              
              <Text style={styles.inputLabel}>Start Time *</Text>
              <TextInput
                style={[styles.modalInput, formErrors.time && styles.inputError]}
                placeholder="HH:MM (24-hour format, e.g., 14:30)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventTime}
                onChangeText={setEventTime}
              />
              <Text style={styles.inputHint}>Format: HH:MM (24-hour). In a full implementation, this would be a time picker.</Text>
              {formErrors.time && <Text style={styles.errorText}>{formErrors.time}</Text>}
              
              <Text style={styles.inputLabel}>End Time (optional)</Text>
              <TextInput
                style={[styles.modalInput, formErrors.endTime && styles.inputError]}
                placeholder="HH:MM (24-hour format, e.g., 16:30)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventEndTime}
                onChangeText={setEventEndTime}
              />
              <Text style={styles.inputHint}>Format: HH:MM (24-hour). In a full implementation, this would be a time picker.</Text>
              {formErrors.endTime && <Text style={styles.errorText}>{formErrors.endTime}</Text>}
              
              <Text style={styles.inputLabel}>Reminder (minutes before)</Text>
              <TextInput
                style={[styles.modalInput, formErrors.reminder && styles.inputError]}
                placeholder="30"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventReminder}
                onChangeText={setEventReminder}
                keyboardType="numeric"
              />
              {formErrors.reminder && <Text style={styles.errorText}>{formErrors.reminder}</Text>}
              
              <Text style={styles.inputLabel}>Timezone</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="UTC"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventTimezone}
                onChangeText={setEventTimezone}
              />
              
              <Button
                title="Create Event"
                onPress={handleCreateEvent}
                variant="primary"
                size="large"
                style={styles.modalButton}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Edit Event Modal */}
      <Modal
        visible={showEditEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditEventModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Event</Text>
              <TouchableOpacity 
                onPress={() => setShowEditEventModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <TextInput
                style={[styles.modalInput, formErrors.title && styles.inputError]}
                placeholder="Event Title *"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventTitle}
                onChangeText={setEventTitle}
              />
              {formErrors.title && <Text style={styles.errorText}>{formErrors.title}</Text>}
              
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Event Description"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventDescription}
                onChangeText={setEventDescription}
                multiline
                numberOfLines={4}
              />
              
              <View style={styles.locationContainer}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Location"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={eventLocation}
                  onChangeText={(text) => {
                    setEventLocation(text);
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                />
                {showLocationSuggestions && eventLocation.length > 2 && (
                  <View style={styles.locationSuggestions}>
                    {locationSuggestions
                      .filter(suggestion => suggestion.toLowerCase().includes(eventLocation.toLowerCase()))
                      .map((suggestion, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.locationSuggestionItem}
                          onPress={() => handleLocationSelect(suggestion)}
                        >
                          <Text style={styles.locationSuggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                )}
              </View>
              
              <Text style={styles.inputLabel}>Date *</Text>
              <TextInput
                style={[styles.modalInput, formErrors.date && styles.inputError]}
                placeholder="YYYY-MM-DD (e.g., 2025-06-20)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventDate}
                onChangeText={setEventDate}
              />
              <Text style={styles.inputHint}>Format: YYYY-MM-DD. In a full implementation, this would be a date picker.</Text>
              {formErrors.date && <Text style={styles.errorText}>{formErrors.date}</Text>}
              
              <Text style={styles.inputLabel}>Start Time *</Text>
              <TextInput
                style={[styles.modalInput, formErrors.time && styles.inputError]}
                placeholder="HH:MM (24-hour format, e.g., 14:30)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventTime}
                onChangeText={setEventTime}
              />
              <Text style={styles.inputHint}>Format: HH:MM (24-hour). In a full implementation, this would be a time picker.</Text>
              {formErrors.time && <Text style={styles.errorText}>{formErrors.time}</Text>}
              
              <Text style={styles.inputLabel}>End Time (optional)</Text>
              <TextInput
                style={[styles.modalInput, formErrors.endTime && styles.inputError]}
                placeholder="HH:MM (24-hour format, e.g., 16:30)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={eventEndTime}
                onChangeText={setEventEndTime}
              />
              <Text style={styles.inputHint}>Format: HH:MM (24-hour). In a full implementation, this would be a time picker.</Text>
              {formErrors.endTime && <Text style={styles.errorText}>{formErrors.endTime}</Text>}
              
              <Button
                title="Update Event"
                onPress={handleEditEvent}
                variant="primary"
                size="large"
                style={styles.modalButton}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Edit Group Modal */}
      <Modal
        visible={showEditGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Group</Text>
              <TouchableOpacity 
                onPress={() => setShowEditGroupModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <TextInput
                style={styles.modalInput}
                placeholder="Group Name *"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
              />
              
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Group Description"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupDescription}
                onChangeText={setGroupDescription}
                multiline
                numberOfLines={4}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Category (e.g., Industry, Interest, Community)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupCategory}
                onChangeText={setGroupCategory}
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Industry Focus (optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupIndustry}
                onChangeText={setGroupIndustry}
              />
              
              <Button
                title="Update Group"
                onPress={handleEditGroup}
                variant="primary"
                size="large"
                style={styles.modalButton}
              />
            </ScrollView>
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
  keyboardAvoidingView: {
    flex: 1,
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
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.error,
    marginBottom: 16,
  },
  backButton: {
    minWidth: 120,
  },
  header: {
    position: 'relative',
    height: 180,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  memberIcon: {
    marginRight: 4,
  },
  memberText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  categoryTag: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.dark.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    fontSize: 12,
    color: Colors.dark.text,
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: 4,
  },
  activeTabText: {
    color: Colors.dark.accent,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: Colors.dark.text,
    lineHeight: 24,
  },
  sectionText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
  },
  messageItem: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageSender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  messageTime: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  messageContent: {
    fontSize: 16,
    color: Colors.dark.text,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
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
    color: Colors.dark.text,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.dark.border,
  },
  createEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.card,
    margin: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  createEventText: {
    fontSize: 16,
    color: Colors.dark.text,
    marginLeft: 8,
  },
  eventsList: {
    padding: 16,
  },
  eventItem: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.accent,
  },
  pastEvent: {
    opacity: 0.7,
    borderLeftColor: Colors.dark.border,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    flex: 1,
  },
  editEventButton: {
    padding: 4,
  },
  eventDetails: {
    marginBottom: 12,
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailIcon: {
    marginRight: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  eventDescription: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  eventActions: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingTop: 12,
  },
  rsvpButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  rsvpButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  rsvpButtonActive: {
    borderWidth: 0,
  },
  rsvpYesButton: {
    backgroundColor: 'rgba(75, 181, 67, 0.1)',
  },
  rsvpMaybeButton: {
    backgroundColor: 'rgba(255, 187, 0, 0.1)',
  },
  rsvpNoButton: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  rsvpButtonText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  rsvpButtonTextActive: {
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  calendarButtonText: {
    fontSize: 14,
    color: Colors.dark.accent,
    marginLeft: 8,
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
    maxWidth: 500,
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
  modalInput: {
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
  inputLabel: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: -12,
    marginBottom: 16,
  },
  modalButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  locationContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  locationSuggestions: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    maxHeight: 200,
    overflow: 'hidden',
    zIndex: 1000,
  },
  locationSuggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  locationSuggestionText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  inputError: {
    borderColor: Colors.dark.error,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 12,
    marginTop: -12,
    marginBottom: 16,
  },
  tabLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tabLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
});
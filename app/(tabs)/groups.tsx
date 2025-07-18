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
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { UNIVERSAL_SAFE_AREA_EDGES } from '@/constants/safeArea';
import { useAuthStore } from '@/store/auth-store';
import { useGroupsStore } from '@/store/groups-store';
import { Group } from '@/types/user';
import { Button } from '@/components/Button';
import { Users, Plus, X, Camera } from 'lucide-react-native';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    userGroups, 
    availableGroups, 
    fetchGroups, 
    joinGroup, 
    leaveGroup, 
    createGroup,
    isLoading, 
    error 
  } = useGroupsStore();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupCategory, setGroupCategory] = useState('');
  const [groupIndustry, setGroupIndustry] = useState('');
  const [groupImageUri, setGroupImageUri] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);
  
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);
  
  const handleJoinGroup = async (groupId: string) => {
    try {
      setJoinLoading(groupId);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await joinGroup(groupId);
      // Refresh the groups list after joining
      await fetchGroups();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join group');
    } finally {
      setJoinLoading(null);
    }
  };
  
  const handleLeaveGroup = async (groupId: string) => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              await leaveGroup(groupId);
              // Refresh the groups list after leaving
              await fetchGroups();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to leave group');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleSelectGroupImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to grant permission to access your photos.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGroupImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while selecting an image');
    }
  };
  
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setCreateError('Group name is required');
      return;
    }
    
    setCreateLoading(true);
    setCreateError(null);
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      await createGroup({
        name: groupName,
        description: groupDescription,
        category: groupCategory || 'Interest',
        industry: groupIndustry || undefined,
        imageUrl: groupImageUri || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2942&auto=format&fit=crop'
      });
      
      setShowCreateModal(false);
      setGroupName('');
      setGroupDescription('');
      setGroupCategory('');
      setGroupIndustry('');
      setGroupImageUri(null);
      // Refresh the groups list after creating a new group
      await fetchGroups();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create group');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGroupPress = (groupId: string) => {
    router.push(`/group/${groupId}`);
  };
  
  const renderGroupItem = ({ item, isJoined }: { item: Group, isJoined: boolean }) => {
    const isJoining = joinLoading === item.id;
    
    return (
      <TouchableOpacity 
        style={styles.groupCard}
        onPress={() => handleGroupPress(item.id)}
      >
        <Image
          source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2942&auto=format&fit=crop' }}
          style={styles.groupImage}
        />
        
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription} numberOfLines={2}>{item.description}</Text>
          
          <View style={styles.groupMeta}>
            <View style={styles.memberCount}>
              <Users size={14} color={Colors.dark.textSecondary} style={styles.memberIcon} />
              <Text style={styles.memberText}>{item.memberIds.length} members</Text>
            </View>
            
            {item.category && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            )}
          </View>
          
          <Button
            title={isJoined ? "Leave Group" : "Join Group"}
            onPress={() => isJoined ? handleLeaveGroup(item.id) : handleJoinGroup(item.id)}
            variant={isJoined ? "outline" : "primary"}
            size="small"
            style={styles.groupButton}
            loading={isJoining}
            disabled={isJoining}
          />
        </View>
      </TouchableOpacity>
    );
  };
  
  if (isLoading && userGroups.length === 0 && availableGroups.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Groups</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Plus size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>
        
        {userGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {userGroups.map(item => (
                <View key={item.id} style={styles.horizontalCardWrapper}>
                  {renderGroupItem({ item, isJoined: true })}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        
        {user?.membershipTier === 'bronze' && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Upgrade to Silver or Gold</Text>
            <Text style={styles.upgradeText}>
              Bronze members cannot join groups. Upgrade to Silver to join one group or Gold to join multiple groups.
            </Text>
            <Button
              title="Upgrade Membership"
              onPress={() => router.push('/membership')}
              variant="primary"
              size="small"
              style={styles.upgradeButton}
            />
          </View>
        )}
        
        {user?.membershipTier === 'silver' && userGroups.length >= 1 && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Upgrade to Gold</Text>
            <Text style={styles.upgradeText}>
              Silver members can only join one group. Upgrade to Gold to join multiple groups.
            </Text>
            <Button
              title="Upgrade Membership"
              onPress={() => router.push('/membership')}
              variant="primary"
              size="small"
              style={styles.upgradeButton}
            />
          </View>
        )}
        
        {availableGroups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discover Groups</Text>
            {availableGroups.map(item => (
              <View key={item.id} style={styles.verticalCardWrapper}>
                {renderGroupItem({ item, isJoined: false })}
              </View>
            ))}
          </View>
        )}
        
        {userGroups.length === 0 && availableGroups.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Groups Available</Text>
            <Text style={styles.emptyText}>
              Be the first to create a group and connect with like-minded entrepreneurs.
            </Text>
            <Button
              title="Create a Group"
              onPress={() => setShowCreateModal(true)}
              variant="primary"
              style={styles.emptyButton}
            />
          </View>
        )}
      </ScrollView>
      
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Group</Text>
              <TouchableOpacity 
                onPress={() => setShowCreateModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {createError && (
                <Text style={styles.createErrorText}>{createError}</Text>
              )}
              
              <TextInput
                style={styles.input}
                placeholder="Group Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
              />
              
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Group Description"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupDescription}
                onChangeText={setGroupDescription}
                multiline
                numberOfLines={4}
              />
              
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Group Image</Text>
                <TouchableOpacity 
                  style={styles.imagePickerContainer}
                  onPress={handleSelectGroupImage}
                >
                  {groupImageUri ? (
                    <Image source={{ uri: groupImageUri }} style={styles.selectedImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Camera size={40} color={Colors.dark.textSecondary} />
                      <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Category (e.g. Industry, Interest, Community)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupCategory}
                onChangeText={setGroupCategory}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Industry Focus (optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={groupIndustry}
                onChangeText={setGroupIndustry}
              />
              
              <Button
                title="Create Group"
                onPress={handleCreateGroup}
                variant="primary"
                size="large"
                loading={createLoading}
                error={!!createError}
                style={styles.createGroupButton}
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100, // Add extra padding at the bottom to ensure content is scrollable
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginLeft: 16,
    marginBottom: 12,
  },
  horizontalList: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  horizontalCardWrapper: {
    width: 280,
    marginRight: 12,
  },
  verticalCardWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  groupCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  groupImage: {
    width: '100%',
    height: 120,
  },
  groupInfo: {
    padding: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 12,
    color: Colors.dark.textSecondary,
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
  groupButton: {
    width: '100%',
  },
  upgradeCard: {
    backgroundColor: Colors.dark.primary,
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  upgradeText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
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
  emptyButton: {
    minWidth: 200,
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
  imageSection: {
    marginBottom: 16,
  },
  imageLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  imagePickerContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  selectedImage: {
    width: '100%',
    height: 120,
  },
  imagePlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
  },
  imagePlaceholderText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  createGroupButton: {
    marginTop: 8,
  },
  createErrorText: {
    color: Colors.dark.error,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});
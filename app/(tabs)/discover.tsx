import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text,
  TouchableOpacity,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { SwipeCards } from '@/components/SwipeCards';
import { useMatchesStore } from '@/store/matches-store';
import { UserProfile } from '@/types/user';
import { Button } from '@/components/Button';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { ProfileDetailCard } from '@/components/ProfileDetailCard';
import { X, ArrowLeft, RefreshCw } from 'lucide-react-native';

export default function DiscoverScreen() {
  const router = useRouter();
  const { 
    potentialMatches, 
    fetchPotentialMatches, 
    prefetchNextBatch,
    likeUser, 
    passUser,
    refreshCandidates,
    isLoading,
    isPrefetching,
    error
  } = useMatchesStore();
  
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  
  useEffect(() => {
    fetchPotentialMatches();
  }, []);
  
  useEffect(() => {
    // Prefetch more profiles if we're running low
    if (potentialMatches.length <= useMatchesStore.getState().prefetchThreshold && !isPrefetching && !isLoading) {
      prefetchNextBatch();
    }
  }, [potentialMatches.length, isPrefetching]);
  
  const handleSwipeRight = async (profile: UserProfile) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    const match = await likeUser(profile.id);
    
    if (match) {
      // It's a match!
      setMatchedUser(profile);
      setShowMatchModal(true);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };
  
  const handleSwipeLeft = async (profile: UserProfile) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    await passUser(profile.id);
  };
  
  const handleMessageMatch = () => {
    if (matchedUser) {
      router.push(`/chat/${matchedUser.id}`);
      setShowMatchModal(false);
      setMatchedUser(null);
    }
  };
  
  const handleCloseMatchModal = () => {
    setShowMatchModal(false);
    setMatchedUser(null);
  };
  
  const handleProfilePress = (profile: UserProfile) => {
    setSelectedProfile(profile);
    setShowProfileDetail(true);
  };
  
  const handleRefresh = () => {
    refreshCandidates();
  };
  
  if (isLoading && potentialMatches.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Finding entrepreneurs...</Text>
      </SafeAreaView>
    );
  }
  
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <Text style={styles.errorText}>Something went wrong</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <Button
          title="Try Again"
          onPress={fetchPotentialMatches}
          variant="primary"
          style={styles.retryButton}
        />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {showMatchModal ? (
        <View style={styles.matchModalContainer}>
          <View style={styles.matchModal}>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              You and {matchedUser?.name} have liked each other
            </Text>
            
            <Button
              title="Send Message"
              onPress={handleMessageMatch}
              variant="primary"
              size="large"
              style={styles.messageButton}
            />
            
            <Button
              title="Keep Browsing"
              onPress={handleCloseMatchModal}
              variant="outline"
              size="large"
              style={styles.keepBrowsingButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.cardsContainer}>
          {isPrefetching && (
            <View style={styles.prefetchingIndicator}>
              <ActivityIndicator size="small" color={Colors.dark.accent} />
              <Text style={styles.prefetchingText}>Loading more entrepreneurs...</Text>
            </View>
          )}
          <SwipeCards
            profiles={potentialMatches}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onEmpty={() => fetchPotentialMatches()}
            onProfilePress={handleProfilePress}
          />
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={isLoading || isPrefetching}
          >
            <RefreshCw size={24} color={Colors.dark.accent} />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <Modal
        visible={showProfileDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileDetail(false)}
      >
        <View style={styles.profileModalContainer}>
          <View style={styles.profileModalContent}>
            <View style={styles.profileModalHeader}>
              <TouchableOpacity 
                onPress={() => setShowProfileDetail(false)}
                style={styles.backButton}
              >
                <ArrowLeft size={24} color={Colors.dark.text} />
                <Text style={styles.backButtonText}>Back to Swiping</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setShowProfileDetail(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            {selectedProfile && (
              <View style={styles.profileDetailContainer}>
                <ProfileDetailCard 
                  title="Profile Details"
                  content={selectedProfile.bio || "No bio available"}
                  profile={selectedProfile} 
                />
                
                <View style={styles.actionButtons}>
                  <Button
                    title="Pass"
                    onPress={() => {
                      handleSwipeLeft(selectedProfile);
                      setShowProfileDetail(false);
                    }}
                    variant="outline"
                    size="medium"
                    style={[styles.actionButton, styles.passButton]}
                  />
                  
                  <Button
                    title="Connect"
                    onPress={() => {
                      handleSwipeRight(selectedProfile);
                      setShowProfileDetail(false);
                    }}
                    variant="primary"
                    size="medium"
                    style={styles.actionButton}
                  />
                </View>
              </View>
            )}
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
    padding: 24,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    minWidth: 150,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefetchingIndicator: {
    position: 'absolute',
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10,
  },
  prefetchingText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    zIndex: 10,
  },
  refreshButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.dark.accent,
    fontWeight: '500',
  },
  matchModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  matchModal: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  matchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.accent,
    marginBottom: 16,
  },
  matchSubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  messageButton: {
    width: '100%',
    marginBottom: 12,
  },
  keepBrowsingButton: {
    width: '100%',
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  profileModalContent: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  profileDetailContainer: {
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  passButton: {
    borderColor: Colors.dark.error,
  },
});
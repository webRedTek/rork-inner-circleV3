import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text,
  TouchableOpacity,
  Modal,
  Switch,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { SwipeCards } from '@/components/SwipeCards';
import { useMatchesStore, startBatchProcessing, stopBatchProcessing } from '@/store/matches-store';
import { useAuthStore } from '@/store/auth-store';
import { UserProfile } from '@/types/user';
import { Button } from '@/components/Button';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { ProfileDetailCard } from '@/components/ProfileDetailCard';
import { X, ArrowLeft, RefreshCw, MapPin } from 'lucide-react-native';
import { isSupabaseConfigured, supabase, convertToCamelCase } from '@/lib/supabase';
import { Input } from '@/components/Input';

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
    error,
    newMatch,
    clearNewMatch,
    swipeLimitReached,
    matchLimitReached,
    syncUsageCounters
  } = useMatchesStore();
  
  const { user, isReady, tierSettings } = useAuthStore();
  
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [preferredDistance, setPreferredDistance] = useState('50');
  const [globalSearch, setGlobalSearch] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  
  const isGlobalSearchAllowed = tierSettings?.global_discovery || false;

  useEffect(() => {
    if (isReady && user) {
      console.log('[Discover] Initial load - fetching potential matches', { userId: user.id });
      fetchPotentialMatches();
      startBatchProcessing();
      syncUsageCounters();
      setInitialLoad(false);
      // Set user's preferred distance from profile
      if (user.preferredDistance) {
        setPreferredDistance(user.preferredDistance.toString());
      }
    }
    
    return () => {
      stopBatchProcessing();
    };
  }, [isReady, user, fetchPotentialMatches, syncUsageCounters]);
  
  // Add focus effect to refresh data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (isReady && user) {
        console.log('[Discover] Screen focused - refreshing potential matches', { userId: user.id, matchesCount: potentialMatches.length });
        fetchPotentialMatches();
        syncUsageCounters();
      }
    }, [isReady, user, fetchPotentialMatches, syncUsageCounters])
  );
  
  useEffect(() => {
    // Prefetch more profiles if we're running low
    if (potentialMatches.length <= 3 && !isPrefetching && !isLoading && user) {
      console.log('[Discover] Running low on matches, prefetching more', { currentMatches: potentialMatches.length });
      prefetchNextBatch();
    }
  }, [potentialMatches.length, isPrefetching, isLoading, user, prefetchNextBatch]);
  
  useEffect(() => {
    // Check for new matches and display modal
    const checkNewMatch = async () => {
      if (newMatch && user) {
        try {
          // Get the matched user's profile via Supabase
          if (isSupabaseConfigured() && supabase) {
            const matchedUserId = newMatch.userId === user.id ? newMatch.matchedUserId : newMatch.userId;
            const { data: matchedProfile, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', matchedUserId)
              .single();
            
            if (error) {
              console.error('[Discover] Error fetching matched user profile:', error);
              return;
            }
            
            if (matchedProfile) {
              const userProfile = supabaseToUserProfile(matchedProfile);
              setMatchedUser(userProfile);
              setShowMatchModal(true);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }
          }
        } catch (err) {
          console.error('[Discover] Error fetching matched user profile:', err);
        } finally {
          clearNewMatch(); // Clear the new match after processing
        }
      }
    };
    
    checkNewMatch();
  }, [newMatch, clearNewMatch, user]);
  
  useEffect(() => {
    // Show limit modal if swipe or match limit is reached
    if (swipeLimitReached || matchLimitReached) {
      setShowLimitModal(true);
    }
  }, [swipeLimitReached, matchLimitReached]);
  
  useEffect(() => {
    console.log('[Discover] Potential matches updated', { count: potentialMatches.length, isLoading, isPrefetching, error: error || 'none' });
  }, [potentialMatches, isLoading, isPrefetching, error]);
  
  const handleSwipeRight = async (profile: UserProfile) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (swipeLimitReached) {
      setShowLimitModal(true);
      return;
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
    
    if (swipeLimitReached) {
      setShowLimitModal(true);
      return;
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
    console.log('[Discover] Manual refresh triggered');
    refreshCandidates();
  };
  
  const handleCloseLimitModal = () => {
    setShowLimitModal(false);
  };
  
  const handleUpgradePlan = () => {
    router.push('/membership');
    setShowLimitModal(false);
  };
  
  const handleApplyFilters = () => {
    const distanceNum = parseInt(preferredDistance);
    if (isNaN(distanceNum) || distanceNum < 1 || distanceNum > 500) {
      setDistanceError('Distance must be between 1 and 500 km');
      return;
    }
    setDistanceError('');
    // Update the fetch with the new distance
    fetchPotentialMatches(distanceNum, true);
    setShowFilterModal(false);
  };
  
  const handleToggleGlobalSearch = () => {
    if (isGlobalSearchAllowed) {
      setGlobalSearch(!globalSearch);
    } else {
      Alert.alert('Premium Feature', 'Global search is available for premium members only.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade Plan', onPress: () => router.push('/membership') }
      ]);
    }
  };
  
  if ((isLoading && potentialMatches.length === 0) || initialLoad || !isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>
          {tierSettings?.global_discovery ? "Searching for global matches..." : "Finding entrepreneurs in your area..."}
        </Text>
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
      ) : showLimitModal ? (
        <View style={styles.matchModalContainer}>
          <View style={styles.matchModal}>
            <Text style={styles.matchTitle}>
              {swipeLimitReached ? 'Swipe Limit Reached' : 'Match Limit Reached'}
            </Text>
            <Text style={styles.matchSubtitle}>
              {swipeLimitReached 
                ? "You've reached your daily swipe limit. Upgrade your plan for more swipes." 
                : "You've reached your daily match limit. Upgrade your plan for more matches."
              }
            </Text>
            
            <Button
              title="Upgrade Plan"
              onPress={handleUpgradePlan}
              variant="primary"
              size="large"
              style={styles.messageButton}
            />
            
            <Button
              title="Continue Browsing"
              onPress={handleCloseLimitModal}
              variant="outline"
              size="large"
              style={styles.keepBrowsingButton}
            />
          </View>
        </View>
      ) : showFilterModal ? (
        <View style={styles.matchModalContainer}>
          <View style={styles.matchModal}>
            <Text style={styles.matchTitle}>Distance Filters</Text>
            
            <Input
              label="Max Distance (km)"
              value={preferredDistance}
              onChangeText={setPreferredDistance}
              placeholder="Enter max distance"
              keyboardType="numeric"
              error={distanceError}
              style={styles.distanceInput}
            />
            
            {isGlobalSearchAllowed && (
              <View style={styles.globalSearchContainer}>
                <Text style={styles.globalSearchLabel}>Global Search</Text>
                <Switch
                  value={globalSearch}
                  onValueChange={handleToggleGlobalSearch}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.accent }}
                  thumbColor={globalSearch ? Colors.dark.primary : Colors.dark.textSecondary}
                />
              </View>
            )}
            
            {!isGlobalSearchAllowed && (
              <Text style={styles.globalSearchNote}>
                Global search available for premium members
              </Text>
            )}
            
            <Button
              title="Apply Filters"
              onPress={handleApplyFilters}
              variant="primary"
              size="large"
              style={styles.messageButton}
            />
            
            <Button
              title="Cancel"
              onPress={() => setShowFilterModal(false)}
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
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <MapPin size={24} color={Colors.dark.accent} />
            <Text style={styles.filterButtonText}>{preferredDistance} km</Text>
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
                  title="Bio"
                  content={selectedProfile.bio || "No bio available"}
                  profile={selectedProfile} 
                />
                
                <ProfileDetailCard 
                  title="Location"
                  content={`${selectedProfile.location || 'Not specified'}${selectedProfile.zipCode ? ` (${selectedProfile.zipCode})` : ''}`} 
                />
                
                <ProfileDetailCard 
                  title="Industry"
                  content={selectedProfile.industryFocus || selectedProfile.businessField || 'Not specified'} 
                />
                
                <ProfileDetailCard 
                  title="Business Stage"
                  content={selectedProfile.businessStage || 'Not specified'} 
                />
                
                <ProfileDetailCard 
                  title="Skills Offered"
                  content={
                    selectedProfile.skillsOffered && selectedProfile.skillsOffered.length > 0 
                      ? selectedProfile.skillsOffered 
                      : 'No skills added yet'
                  } 
                />
                
                {selectedProfile.skillsSeeking && selectedProfile.skillsSeeking.length > 0 && (
                  <ProfileDetailCard 
                    title="Skills Seeking"
                    content={selectedProfile.skillsSeeking} 
                  />
                )}
                
                {selectedProfile.lookingFor && selectedProfile.lookingFor.length > 0 && (
                  <ProfileDetailCard 
                    title="Looking For"
                    content={selectedProfile.lookingFor} 
                  />
                )}
                
                {selectedProfile.availabilityLevel && selectedProfile.availabilityLevel.length > 0 && (
                  <ProfileDetailCard 
                    title="Availability"
                    content={selectedProfile.availabilityLevel} 
                  />
                )}
                
                {selectedProfile.keyChallenge && (
                  <ProfileDetailCard 
                    title="Current Challenge"
                    content={selectedProfile.keyChallenge} 
                  />
                )}
                
                {selectedProfile.successHighlight && (
                  <ProfileDetailCard 
                    title="Success Highlight"
                    content={selectedProfile.successHighlight} 
                  />
                )}
                
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
                    disabled={swipeLimitReached}
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
                    disabled={swipeLimitReached}
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

// Helper function to convert Supabase response to UserProfile type
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    email: String(camelCaseData.email || ''),
    name: String(camelCaseData.name || ''),
    bio: String(camelCaseData.bio || ''),
    location: String(camelCaseData.location || ''),
    zipCode: String(camelCaseData.zipCode || ''),
    latitude: Number(camelCaseData.latitude || 0),
    longitude: Number(camelCaseData.longitude || 0),
    preferredDistance: Number(camelCaseData.preferredDistance || 50),
    locationPrivacy: String(camelCaseData.locationPrivacy || 'public') as UserProfile["locationPrivacy"],
    businessField: (String(camelCaseData.businessField || 'Technology')) as UserProfile["businessField"],
    entrepreneurStatus: (String(camelCaseData.entrepreneurStatus || 'upcoming')) as UserProfile["entrepreneurStatus"],
    photoUrl: String(camelCaseData.photoUrl || ''),
    membershipTier: (String(camelCaseData.membershipTier || 'basic')) as UserProfile["membershipTier"],
    businessVerified: Boolean(camelCaseData.businessVerified || false),
    joinedGroups: Array.isArray(camelCaseData.joinedGroups) ? camelCaseData.joinedGroups : [],
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    lookingFor: Array.isArray(camelCaseData.lookingFor) ? camelCaseData.lookingFor as UserProfile["lookingFor"] : [],
    businessStage: camelCaseData.businessStage as UserProfile["businessStage"] || 'Idea Phase',
    skillsOffered: Array.isArray(camelCaseData.skillsOffered) ? camelCaseData.skillsOffered as UserProfile["skillsOffered"] : [],
    skillsSeeking: Array.isArray(camelCaseData.skillsSeeking) ? camelCaseData.skillsSeeking as UserProfile["skillsSeeking"] : [],
    keyChallenge: String(camelCaseData.keyChallenge || ''),
    industryFocus: String(camelCaseData.industryFocus || ''),
    availabilityLevel: Array.isArray(camelCaseData.availabilityLevel) ? camelCaseData.availabilityLevel as UserProfile["availabilityLevel"] : [],
    timezone: String(camelCaseData.timezone || ''),
    successHighlight: String(camelCaseData.successHighlight || ''),
  };
};

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
    left: 20,
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
  filterButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    zIndex: 10,
  },
  filterButtonText: {
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
  distanceInput: {
    marginBottom: 16,
    width: '100%',
  },
  globalSearchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  globalSearchLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  globalSearchNote: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
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
    gap: 16,
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
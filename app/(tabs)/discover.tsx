/**
 * FILE: app/(tabs)/discover.tsx
 * LAST UPDATED: 2025-07-02 19:30
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes after auth-store confirms user session
 * 2. Requires matches-store to be initialized for profile fetching
 * 3. Requires notification-store for match alerts
 * 4. Requires usage-store for swipe/match limits
 * 5. Race condition: Must wait for user location before fetching matches
 * 
 * CURRENT STATE:
 * Simplified discover screen for entrepreneur matching. Handles:
 * - Manual-only profile fetching (initial load + refresh button)
 * - Enhanced distance filtering and global search with better UX
 * - Improved match notifications and modals with better animations
 * - Enhanced usage limit enforcement with better user feedback
 * - Better error handling and user feedback throughout
 * - Fixed 10-match loading per request
 * 
 * RECENT CHANGES:
 * - Removed all automatic prefetching and adaptive behavior
 * - Simplified to manual-only fetching (initial load + refresh button)
 * - Removed prefetching triggers and thresholds
 * - Enhanced swipe action handling with better error feedback
 * - Improved animation performance and responsiveness
 * - Better haptic feedback integration throughout the interface
 * - Enhanced loading states and error handling
 * - Improved global search logic with better validation
 * - Added better debugging to track multiple calls issue
 * 
 * FILE INTERACTIONS:
 * - Imports from: matches-store, auth-store, notification-store, usage-store
 * - Components: SwipeCards, EntrepreneurCard, Button, Input
 * - Dependencies: expo-router for navigation, react-native for UI
 * - Data flow: Bidirectional with matches-store
 * 
 * KEY FUNCTIONS:
 * - handleSwipeRight/Left: Enhanced swipe actions with better feedback
 * - handleManualRefresh: Manual refresh with better loading states
 * - handleToggleGlobalSearch: Enhanced global search toggle
 * - handleModalAction: Better modal action handling
 * 
 * STORE DEPENDENCIES:
 * matches-store -> Handles all match data and swipe logic
 * auth-store -> User authentication and tier settings
 * usage-store -> Tracks swipe/match limits
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { SwipeCards } from '@/components/SwipeCards';
import { useMatchesStore, startBatchProcessing, stopBatchProcessing } from '@/store/matches-store';
import { useAuthStore } from '@/store/auth-store';
import { UserProfile, MatchWithProfile } from '@/types/user';
import { Button } from '@/components/Button';
import * as Haptics from 'expo-haptics';
import { ProfileDetailCard } from '@/components/ProfileDetailCard';
import { X, ArrowLeft, RefreshCw, MapPin } from 'lucide-react-native';
import { Input } from '@/components/Input';
import { useDebugStore } from '@/store/debug-store';
import { withErrorHandling, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { useNotificationStore } from '@/store/notification-store';

export default function DiscoverScreen() {
  const router = useRouter();
  const { 
    potentialMatches, 
    fetchPotentialMatches, 
    likeUser, 
    passUser,
    isLoading,
    error,
    newMatch,
    clearNewMatch,
    swipeLimitReached,
    matchLimitReached,
    noMoreProfiles
  } = useMatchesStore();
  
  const { user, isReady } = useAuthStore();
  const { isDebugMode } = useDebugStore();
  const { addNotification } = useNotificationStore();
  
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
  const [refreshing, setRefreshing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Simplified global search - allow for all users (can be restricted later if needed)
  const isGlobalSearchAllowed = true;

  // Enhanced haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if (Platform.OS === 'web') return;
    
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  }, []);

  // DEBUG: Add temporary debugging state
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const addDebugInfo = useCallback((info: string) => {
    if (isDebugMode) {
      console.log(`[DISCOVER-DEBUG] ${info}`);
    }
    setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${info}`]);
  }, [isDebugMode]);

  // SINGLE INITIALIZATION EFFECT - Only runs once when component mounts and user is ready
  useEffect(() => {
    let isMounted = true;
    
    const initializeDiscoverScreen = async () => {
      if (!isReady || !user || hasInitialized) {
        addDebugInfo(`Skipping init - ready: ${isReady}, user: ${!!user}, initialized: ${hasInitialized}`);
        return;
      }

      addDebugInfo(`Starting initialization for user: ${user.id}`);
      setHasInitialized(true);

      try {
        // Initial fetch with proper distance
        const distance = isGlobalSearchAllowed && globalSearch 
          ? undefined 
          : (user.preferredDistance || parseInt(preferredDistance) || 50);

        addDebugInfo(`Fetching initial matches - distance: ${distance}, global: ${globalSearch}`);
        
        if (isMounted) {
          await fetchPotentialMatches(distance);
          startBatchProcessing();
          setInitialLoad(false);
          addDebugInfo('Initial fetch completed successfully');
        }
      } catch (error) {
        if (isMounted) {
          console.error('[Discover] Error during initialization:', error);
          addDebugInfo(`Initialization error: ${error}`);
          setDistanceError('Error loading matches');
          addNotification({
            type: 'error',
            message: 'Failed to load matches. Please try again.',
            displayStyle: 'toast',
            duration: 5000
          });
        }
      }
    };

    initializeDiscoverScreen();
    
    return () => {
      isMounted = false;
      stopBatchProcessing();
    };
  }, [isReady, user]); // Only depend on isReady and user, not other state

  // Add validation for distance changes - skip validation when global search is enabled
  useEffect(() => {
    if (!user) {
      addDebugInfo('Missing user for distance validation');
      return;
    }

    // Skip distance validation if global search is enabled
    if (globalSearch && isGlobalSearchAllowed) {
      setDistanceError('');
      return;
    }

    const distance = parseInt(preferredDistance) || 50;
    addDebugInfo(`Distance validation - distance: ${distance}, global: ${globalSearch}`);

    if (distance < 1 || distance > 500) {
      setDistanceError(`Distance must be between 1 and 500 miles`);
      setPreferredDistance('50');
    } else {
      setDistanceError('');
    }
  }, [preferredDistance, user, isGlobalSearchAllowed, globalSearch]);
  
  useEffect(() => {
    // Check for new matches and display modal
    const checkNewMatch = async () => {
      if (newMatch && user) {
        try {
          setMatchedUser(newMatch.matched_user_profile);
          setShowMatchModal(true);
          
          triggerHapticFeedback('success');
          
          addNotification({
            type: 'success',
            message: `It's a match with ${newMatch.matched_user_profile?.name}!`,
            displayStyle: 'toast',
            duration: 4000
          });
        } catch (err) {
          console.error('[Discover] Error handling new match:', err);
        } finally {
          clearNewMatch(); // Clear the new match after processing
        }
      }
    };
    
    checkNewMatch();
  }, [newMatch, clearNewMatch, user, triggerHapticFeedback, addNotification]);
  
  useEffect(() => {
    // Show limit modal if swipe or match limit is reached
    if (swipeLimitReached || matchLimitReached) {
      setShowLimitModal(true);
      triggerHapticFeedback('error');
      
      addNotification({
        type: 'warning',
        message: swipeLimitReached ? 'Daily swipe limit reached' : 'Daily match limit reached',
        displayStyle: 'toast',
        duration: 5000
      });
    }
  }, [swipeLimitReached, matchLimitReached, triggerHapticFeedback, addNotification]);
  
  useEffect(() => {
    addDebugInfo(`Matches state updated - count: ${potentialMatches.length}, loading: ${isLoading}, error: ${error || 'none'}`);
  }, [potentialMatches, isLoading, error, addDebugInfo]);
  
  // DEBUG: Add timeout to detect if loading takes too long
  useEffect(() => {
    if (isLoading && potentialMatches.length === 0) {
      const timeout = setTimeout(() => {
        addDebugInfo(`WARNING: Loading for more than 5 seconds - this might indicate an issue`);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, potentialMatches.length, addDebugInfo]);
  
  // Enhanced swipe handlers with better error handling and feedback
  const handleSwipeRight = useCallback(async (profile: UserProfile) => {
    if (swipeLimitReached) {
      setShowLimitModal(true);
      triggerHapticFeedback('error');
      return;
    }
    
    try {
      addDebugInfo(`Swiping right on profile: ${profile.id}`);
      const match = await likeUser(profile.id);
      
      if (match) {
        // It's a match!
        setMatchedUser(profile);
        setShowMatchModal(true);
        triggerHapticFeedback('success');
        
        addNotification({
          type: 'success',
          message: `It's a match with ${profile.name}!`,
          displayStyle: 'toast',
          duration: 4000
        });
      } else {
        // Just a like, no match yet
        triggerHapticFeedback('medium');
        
        addNotification({
          type: 'info',
          message: `Liked ${profile.name}`,
          displayStyle: 'toast',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('[Discover] Error liking user:', error);
      addDebugInfo(`Error liking user: ${error}`);
      triggerHapticFeedback('error');
      
      addNotification({
        type: 'error',
        message: 'Failed to like profile. Please try again.',
        displayStyle: 'toast',
        duration: 4000
      });
    }
  }, [likeUser, swipeLimitReached, triggerHapticFeedback, addNotification, addDebugInfo]);
  
  const handleSwipeLeft = useCallback(async (profile: UserProfile) => {
    if (swipeLimitReached) {
      setShowLimitModal(true);
      triggerHapticFeedback('error');
      return;
    }
    
    try {
      addDebugInfo(`Swiping left on profile: ${profile.id}`);
      await passUser(profile.id);
      triggerHapticFeedback('light');
      
      if (isDebugMode) {
        addNotification({
          type: 'info',
          message: `Passed on ${profile.name}`,
          displayStyle: 'toast',
          duration: 1500
        });
      }
    } catch (error) {
      console.error('[Discover] Error passing user:', error);
      addDebugInfo(`Error passing user: ${error}`);
      triggerHapticFeedback('error');
      
      addNotification({
        type: 'error',
        message: 'Failed to pass on profile. Please try again.',
        displayStyle: 'toast',
        duration: 4000
      });
    }
  }, [passUser, swipeLimitReached, triggerHapticFeedback, addNotification, isDebugMode, addDebugInfo]);
  
  const handleModalAction = useCallback((action: 'message' | 'close' | 'upgrade' | 'applyFilters' | 'cancel') => {
    triggerHapticFeedback('light');
    
    switch (action) {
      case 'message':
        if (matchedUser) {
          router.push(`/chat/${matchedUser.id}`);
          setShowMatchModal(false);
          setMatchedUser(null);
          
          addNotification({
            type: 'success',
            message: `Opening chat with ${matchedUser.name}`,
            displayStyle: 'toast',
            duration: 2000
          });
        }
        break;
      case 'close':
        setShowMatchModal(false);
        setShowLimitModal(false);
        setMatchedUser(null);
        break;
      case 'upgrade':
        router.push('/membership');
        setShowLimitModal(false);
        
        addNotification({
          type: 'info',
          message: 'Redirecting to membership plans',
          displayStyle: 'toast',
          duration: 2000
        });
        break;
      case 'applyFilters':
        // Skip distance validation if global search is enabled
        if (!globalSearch || !isGlobalSearchAllowed) {
          const distanceNum = parseInt(preferredDistance);
          if (isNaN(distanceNum) || distanceNum < 1 || distanceNum > 500) {
            setDistanceError('Distance must be between 1 and 500 miles');
            triggerHapticFeedback('error');
            return;
          }
        }
        setDistanceError('');
        
        // Handle global search vs local search
        const distance = isGlobalSearchAllowed && globalSearch 
          ? undefined 
          : parseInt(preferredDistance);
        
        addDebugInfo(`Applying filters - distance: ${distance}, global: ${globalSearch}`);
        fetchPotentialMatches(distance, true);
        setShowFilterModal(false);
        
        addNotification({
          type: 'success',
          message: globalSearch ? 'Applied global search' : `Applied ${distance} mile filter`,
          displayStyle: 'toast',
          duration: 3000
        });
        break;
      case 'cancel':
        setShowFilterModal(false);
        break;
    }
  }, [matchedUser, router, preferredDistance, isGlobalSearchAllowed, globalSearch, fetchPotentialMatches, triggerHapticFeedback, addNotification, addDebugInfo]);
  
  const handleProfilePress = useCallback((profile: UserProfile) => {
    triggerHapticFeedback('selection');
    setSelectedProfile(profile);
    setShowProfileDetail(true);
  }, [triggerHapticFeedback]);
  
  // MANUAL REFRESH ONLY - No automatic fetching
  const handleManualRefresh = useCallback(async () => {
    if (isLoading || refreshing) return;
    
    addDebugInfo('Manual refresh triggered');
    setRefreshing(true);
    triggerHapticFeedback('light');
    
    try {
      // Always use fetchPotentialMatches for consistency
      const distance = isGlobalSearchAllowed && globalSearch 
        ? undefined 
        : parseInt(preferredDistance);
      
      addDebugInfo(`Manual refresh - distance: ${distance}, global: ${globalSearch}`);
      await fetchPotentialMatches(distance, true); // Force refresh
      
      addNotification({
        type: 'success',
        message: 'Refreshed matches successfully',
        displayStyle: 'toast',
        duration: 2000
      });
    } catch (error) {
      console.error('[Discover] Error refreshing matches:', error);
      addDebugInfo(`Refresh error: ${error}`);
      triggerHapticFeedback('error');
      
      addNotification({
        type: 'error',
        message: 'Failed to refresh matches. Please try again.',
        displayStyle: 'toast',
        duration: 4000
      });
    } finally {
      setRefreshing(false);
    }
  }, [isLoading, refreshing, addDebugInfo, isGlobalSearchAllowed, globalSearch, preferredDistance, fetchPotentialMatches, triggerHapticFeedback, addNotification]);
  
  const handleToggleGlobalSearch = useCallback(() => {
    triggerHapticFeedback('medium');
    
    if (!isGlobalSearchAllowed) {
      setDistanceError('Global search not available for your tier');
      setGlobalSearch(false);
      triggerHapticFeedback('error');
      
      addNotification({
        type: 'warning',
        message: 'Global search requires premium membership',
        displayStyle: 'toast',
        duration: 4000
      });
      return;
    }

    setGlobalSearch(!globalSearch);
    if (!globalSearch) {
      // Switching to global search - clear distance error and set to infinity symbol
      setDistanceError('');
      setPreferredDistance('∞');
      
      addNotification({
        type: 'info',
        message: 'Global search enabled - distance filter disabled',
        displayStyle: 'toast',
        duration: 3000
      });
    } else {
      // Switching back to local search
      const distance = user?.preferredDistance || 50;
      setPreferredDistance(distance.toString());
      
      addNotification({
        type: 'info',
        message: `Local search enabled - ${distance} mile radius`,
        displayStyle: 'toast',
        duration: 3000
      });
    }
  }, [isGlobalSearchAllowed, globalSearch, user, triggerHapticFeedback, addNotification]);

  // Memoized SwipeCards props to prevent unnecessary re-renders
  const swipeCardsProps = useMemo(() => ({
    profiles: potentialMatches,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onProfilePress: handleProfilePress,
    isLoading,
    error,
    onRetry: handleManualRefresh
  }), [potentialMatches, handleSwipeLeft, handleSwipeRight, handleProfilePress, isLoading, error, handleManualRefresh]);
  
  if (isLoading && potentialMatches.length === 0 && initialLoad) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Finding entrepreneurs...</Text>
        {isDebugMode && (
          <Text style={styles.debugText}>Initial load in progress...</Text>
        )}
      </SafeAreaView>
    );
  }
  
  if (error && !noMoreProfiles) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <Text style={styles.errorText}>{error}</Text>
        <Button 
          title="Try Again" 
          onPress={handleManualRefresh}
          loading={refreshing}
          variant="primary"
        />
        {isDebugMode && (
          <Text style={styles.debugText}>Error: {error}</Text>
        )}
      </SafeAreaView>
    );
  }
  
  if (noMoreProfiles && potentialMatches.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No More Profiles</Text>
          <Text style={styles.emptySubtitle}>
            We've shown you all available entrepreneurs in your area.
          </Text>
          <Text style={styles.emptySubtitle}>
            Try expanding your search distance or enabling global search.
          </Text>
          <Button 
            title="Refresh" 
            onPress={handleManualRefresh}
            loading={refreshing}
            variant="primary"
            style={styles.refreshButton}
          />
        </View>
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
              onPress={() => handleModalAction('message')}
              variant="primary"
              size="large"
              style={styles.messageButton}
            />
            
            <Button
              title="Keep Browsing"
              onPress={() => handleModalAction('close')}
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
              onPress={() => handleModalAction('upgrade')}
              variant="primary"
              size="large"
              style={styles.messageButton}
            />
            
            <Button
              title="Continue Browsing"
              onPress={() => handleModalAction('close')}
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
            
            {/* Only show distance input if global search is disabled */}
            {(!globalSearch || !isGlobalSearchAllowed) && (
              <Input
                label="Max Distance (miles)"
                value={preferredDistance}
                onChangeText={setPreferredDistance}
                placeholder="Enter max distance"
                keyboardType="numeric"
                error={distanceError}
                style={styles.distanceInput}
              />
            )}
            
            {globalSearch && isGlobalSearchAllowed && (
              <Text style={styles.globalSearchNote}>
                Global search enabled - distance filter disabled
              </Text>
            )}
            
            {!isGlobalSearchAllowed && (
              <Text style={styles.globalSearchNote}>
                Global search available for premium members
              </Text>
            )}
            
            <Button
              title="Apply Filters"
              onPress={() => handleModalAction('applyFilters')}
              variant="primary"
              size="large"
              style={styles.messageButton}
            />
            
            <Button
              title="Cancel"
              onPress={() => handleModalAction('cancel')}
              variant="outline"
              size="large"
              style={styles.keepBrowsingButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.cardsContainer}>
          <SwipeCards {...swipeCardsProps} />
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.refreshButton,
                (refreshing || isLoading) && styles.buttonDisabled
              ]}
              onPress={handleManualRefresh}
              disabled={refreshing || isLoading}
            >
              <RefreshCw 
                size={24} 
                color={refreshing || isLoading ? Colors.dark.disabled : Colors.dark.accent} 
                style={refreshing ? styles.spinningIcon : undefined}
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.filterButton,
                (refreshing || isLoading) && styles.buttonDisabled
              ]}
              onPress={() => setShowFilterModal(true)}
              disabled={refreshing || isLoading}
            >
              <MapPin 
                size={24} 
                color={refreshing || isLoading ? Colors.dark.disabled : Colors.dark.text} 
              />
              <Text style={[
                styles.filterButtonText,
                (refreshing || isLoading) && styles.textDisabled
              ]}>
                {globalSearch && isGlobalSearchAllowed ? 'Global' : `${preferredDistance} miles`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Debug information */}
      {isDebugMode && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>DEBUG INFO:</Text>
          <Text style={styles.debugText}>User: {user?.id || 'none'}</Text>
          <Text style={styles.debugText}>Tier: {user?.membershipTier || 'none'}</Text>
          <Text style={styles.debugText}>Global Search: {isGlobalSearchAllowed ? 'enabled' : 'disabled'}</Text>
          <Text style={styles.debugText}>Matches: {potentialMatches.length}</Text>
          <Text style={styles.debugText}>Loading: {isLoading ? 'true' : 'false'}</Text>
          <Text style={styles.debugText}>No More: {noMoreProfiles ? 'true' : 'false'}</Text>
          <Text style={styles.debugText}>Error: {error || 'none'}</Text>
          <Text style={styles.debugText}>Ready: {isReady ? 'true' : 'false'}</Text>
          <Text style={styles.debugText}>Initialized: {hasInitialized ? 'true' : 'false'}</Text>
          <Text style={styles.debugTitle}>RECENT ACTIONS:</Text>
          {debugInfo.slice(-5).map((info, index) => (
            <Text key={index} style={styles.debugText}>{info}</Text>
          ))}
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
                  <TouchableOpacity 
                    style={StyleSheet.compose(
                      styles.actionButton,
                      styles.passButton
                    )}
                    onPress={() => handleSwipeLeft(selectedProfile)}
                    disabled={isLoading}
                  >
                    <X size={24} color={isLoading ? Colors.dark.disabled : Colors.dark.error} />
                  </TouchableOpacity>
                  
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: Colors.dark.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    marginBottom: 16,
    fontSize: 18,
    color: Colors.dark.error,
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshButton: {
    backgroundColor: Colors.dark.card,
    marginTop: 16,
  },
  filterButton: {
    width: 'auto',
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: Colors.dark.card,
  },
  filterButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: Colors.dark.disabled,
  },
  spinningIcon: {
    transform: [{ rotate: '45deg' }],
  },
  debugContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 16,
  },
  debugTitle: {
    color: Colors.dark.accent,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    color: Colors.dark.text,
    fontSize: 12,
    marginBottom: 4,
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
  passButton: {
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.error,
    borderWidth: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
});
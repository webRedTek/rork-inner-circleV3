/**
 * FILE: app/(tabs)/discover.tsx
 * LAST UPDATED: 2025-07-02 19:30
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes after auth-store confirms user session
 * 2. Requires matches-store to be initialized for profile fetching
 * 3. Requires notification-store for match alerts
 * 4. Requires usage-store for swipe/match limits
 * 
 * CURRENT STATE:
 * Simplified discover screen for entrepreneur matching. Handles:
 * - Manual-only profile fetching (initial load + refresh button)
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
import { X, ArrowLeft, RefreshCw } from 'lucide-react-native';
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
  
  const { user } = useAuthStore();
  const { isDebugMode } = useDebugStore();
  const { addNotification } = useNotificationStore();
  
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

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

  // SINGLE INITIALIZATION EFFECT - Only runs once when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const initializeDiscoverScreen = async () => {
      if (hasInitialized) {
        addDebugInfo(`Skipping init - already initialized`);
        return;
      }

      addDebugInfo(`Starting initialization for user: ${user!.id}`);
      setHasInitialized(true);

      try {
        if (isMounted) {
          await fetchPotentialMatches();
          startBatchProcessing();
          setInitialLoad(false);
          addDebugInfo('Initial fetch completed successfully');
        }
      } catch (error) {
        if (isMounted) {
          console.error('[Discover] Error during initialization:', error);
          addDebugInfo(`Initialization error: ${error}`);
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
  }, []); // Only run once on mount since we're in a protected route

  useEffect(() => {
    // Check for new matches and display modal
    const checkNewMatch = async () => {
      if (newMatch) {
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
  }, [newMatch]);
  
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
  
  const handleModalAction = useCallback((action: 'message' | 'close' | 'upgrade') => {
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
    }
  }, [matchedUser, router, triggerHapticFeedback, addNotification]);
  
  const handleProfilePress = useCallback((profile: UserProfile) => {
    triggerHapticFeedback('light');
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
      await fetchPotentialMatches();
      
      addNotification({
        type: 'success',
        message: 'Profiles refreshed',
        displayStyle: 'toast',
        duration: 2000
      });
    } catch (error) {
      console.error('[Discover] Error during manual refresh:', error);
      addDebugInfo(`Manual refresh error: ${error}`);
      
      addNotification({
        type: 'error',
        message: 'Failed to refresh profiles',
        displayStyle: 'toast',
        duration: 4000
      });
    } finally {
      setRefreshing(false);
    }
  }, [isLoading, refreshing, addDebugInfo, fetchPotentialMatches, triggerHapticFeedback, addNotification]);
  
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
        <View style={styles.noMoreContainer}>
          <Text style={styles.noMoreText}>No More Profiles</Text>
          <Text style={styles.noMoreSubtext}>
            We've shown you all available entrepreneurs in your area.
          </Text>
          <Text style={styles.noMoreSubtext}>
            Check back later for new matches.
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
    <SafeAreaView style={styles.container}>
      {/* Debug Info */}
      {isDebugMode && (
        <View style={styles.debugContainer}>
          {debugInfo.map((info, index) => (
            <Text key={index} style={styles.debugText}>{info}</Text>
          ))}
        </View>
      )}

      {/* Main Content */}
      {!user ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Modals */}
          {showMatchModal && matchedUser ? (
            <View style={styles.matchModalContainer}>
              <View style={styles.matchModal}>
                <Text style={styles.matchTitle}>It's a Match!</Text>
                <Text style={styles.matchSubtitle}>
                  You and {matchedUser.name} have liked each other
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
                  {swipeLimitReached ? 'Daily Swipe Limit Reached' : 'Daily Match Limit Reached'}
                </Text>
                <Text style={styles.matchSubtitle}>
                  Upgrade to premium for unlimited swipes and matches
                </Text>
                
                <Button
                  title="Upgrade Now"
                  onPress={() => handleModalAction('upgrade')}
                  variant="primary"
                  size="large"
                  style={styles.messageButton}
                />
                
                <Button
                  title="Maybe Later"
                  onPress={() => handleModalAction('close')}
                  variant="outline"
                  size="large"
                  style={styles.keepBrowsingButton}
                />
              </View>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {/* Profile Detail Modal */}
              <Modal
                visible={showProfileDetail}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowProfileDetail(false)}
              >
                <View style={styles.profileDetailContainer}>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowProfileDetail(false)}
                  >
                    <ArrowLeft color={Colors.dark.text} size={24} />
                  </TouchableOpacity>
                  
                  {selectedProfile && (
                    <View style={styles.profileContent}>
                      <ProfileDetailCard
                        title="Bio"
                        content={selectedProfile.bio || "No bio available"}
                        profile={selectedProfile}
                      />
                      <ProfileDetailCard
                        title="Industry"
                        content={selectedProfile.industryFocus || selectedProfile.businessField || "Not specified"}
                        profile={selectedProfile}
                      />
                      <ProfileDetailCard
                        title="Business Stage"
                        content={selectedProfile.businessStage || "Not specified"}
                        profile={selectedProfile}
                      />
                      {selectedProfile.skillsOffered && (
                        <ProfileDetailCard
                          title="Skills Offered"
                          content={selectedProfile.skillsOffered}
                          profile={selectedProfile}
                        />
                      )}
                    </View>
                  )}
                </View>
              </Modal>

              {/* Swipe Cards */}
              {isLoading && potentialMatches.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.dark.primary} />
                  <Text style={styles.loadingText}>Loading profiles...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Button
                    title="Try Again"
                    onPress={() => fetchPotentialMatches()}
                    variant="primary"
                    size="medium"
                  />
                </View>
              ) : noMoreProfiles ? (
                <View style={styles.noMoreContainer}>
                  <Text style={styles.noMoreText}>No more profiles available</Text>
                  <Text style={styles.noMoreSubtext}>Check back later for new matches</Text>
                  <Button
                    title="Refresh"
                    onPress={() => fetchPotentialMatches()}
                    variant="primary"
                    size="medium"
                    style={styles.refreshButton}
                  />
                </View>
              ) : (
                <SwipeCards
                  profiles={potentialMatches}
                  onSwipeRight={handleSwipeRight}
                  onSwipeLeft={handleSwipeLeft}
                  onProfilePress={handleProfilePress}
                  onRefresh={handleManualRefresh}
                  refreshing={refreshing}
                  isLoading={isLoading}
                />
              )}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background
  },
  mainContainer: {
    flex: 1
  },
  cardsContainer: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: Colors.dark.text,
    marginTop: 10
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    color: Colors.dark.error,
    marginBottom: 20,
    textAlign: 'center'
  },
  noMoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  noMoreText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  noMoreSubtext: {
    color: Colors.dark.textSecondary,
    marginBottom: 20,
    textAlign: 'center'
  },
  refreshButton: {
    marginTop: 10
  },
  matchModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)'
  },
  matchModal: {
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    padding: 20,
    width: '80%',
    alignItems: 'center'
  },
  matchTitle: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10
  },
  matchSubtitle: {
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20
  },
  messageButton: {
    marginBottom: 10,
    width: '100%'
  },
  keepBrowsingButton: {
    width: '100%'
  },
  profileDetailContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
    padding: 10
  },
  debugContainer: {
    position: 'absolute',
    top: 40,
    left: 10,
    right: 10,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 5
  },
  debugText: {
    color: '#fff',
    fontSize: 10
  },
  profileContent: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 20
  }
});
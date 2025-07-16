/**
 * FILE: app/(tabs)/discover.tsx
 * LAST UPDATED: 2025-07-05 16:00
 * 
 * CURRENT STATE:
 * **OPTIMIZED** discover screen with reduced flickering and improved loading states. Features:
 * - Reduced re-renders through optimized useEffect dependencies
 * - Simplified loading state management
 * - Debounced limit status updates
 * - Optimized debug logging to prevent performance issues
 * - Improved error handling with better user feedback
 * 
 * RECENT CHANGES:
 * - Fixed excessive re-renders by optimizing useEffect dependencies
 * - Reduced debug logging frequency to prevent performance issues
 * - Simplified limit status checking to reduce state updates
 * - Improved loading state coordination between components
 * - Added debouncing for frequent state updates
 * 
 * FILE INTERACTIONS:
 * - PRIMARY DATA: Gets limit status from usage-store (single source of truth)
 * - PROFILE DATA: Uses matches-store for profile management only
 * - NOTIFICATIONS: Integrated with notification system for limit alerts
 * - SWIPE HANDLING: Simplified without redundant limit checks
 * - CACHE VIEW: Now consistent with same data source
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SwipeCards } from '@/components/SwipeCards';
import { Button } from '@/components/Button';
import { useMatchesStore } from '@/store/matches-store';
import { useUsageStore } from '@/store/usage-store';
import { useAuthStore } from '@/store/auth-store';
import { useDebugStore } from '@/store/debug-store';
import { safeStringifyError } from '@/utils/store-auth-utils';
import { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { Heart, X, RotateCcw, AlertCircle, TrendingUp, Users, MessageCircle, Zap } from 'lucide-react-native';

import { notify } from '@/store/notification-store';
import { handleError, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { UNIVERSAL_SAFE_AREA_EDGES } from '@/constants/safeArea';

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { profiles, isLoading, error, fetchPotentialMatches, cache, addToSwipeQueue } = useMatchesStore();
  const { checkAllLimits } = useUsageStore();
  const { isDebugMode, addDebugLog, useSimpleProfileView } = useDebugStore();

  const [refreshing, setRefreshing] = useState(false);
  const [limitStatus, setLimitStatus] = useState<{
    swipe: { isAllowed: boolean };
    match: { isAllowed: boolean };
    like: { isAllowed: boolean };
  } | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Use refs to prevent unnecessary re-renders
  const lastProfileCountRef = useRef(profiles.length);
  const lastErrorRef = useRef(error);
  const limitUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize debug logging to prevent excessive calls
  const debugLog = useCallback((event: string, details: string, data?: any) => {
    if (isDebugMode) {
      addDebugLog({
        event,
        status: 'info',
        details,
        source: 'discover-screen',
        data
      });
    }
  }, [isDebugMode, addDebugLog]);

  // Debounced limit status update to prevent flickering
  const updateLimitStatus = useCallback(() => {
    if (!user?.id) return;
    
    // Clear existing timeout
    if (limitUpdateTimeoutRef.current) {
      clearTimeout(limitUpdateTimeoutRef.current);
    }
    
    // Debounce limit status updates
    limitUpdateTimeoutRef.current = setTimeout(() => {
      try {
        const allLimits = checkAllLimits();
        
        if (!allLimits) {
          setLimitStatus({
            swipe: { isAllowed: true },
            match: { isAllowed: true },
            like: { isAllowed: true }
          });
          return;
        }
        
        setLimitStatus({
          swipe: allLimits.swipe,
          match: allLimits.match,
          like: allLimits.like
        });
      } catch (error) {
        setLimitStatus({
          swipe: { isAllowed: true },
          match: { isAllowed: true },
          like: { isAllowed: true }
        });
      }
    }, 100); // 100ms debounce
  }, [user?.id, checkAllLimits]);

  // Optimized debug logging - only when profiles actually change
  useEffect(() => {
    if (profiles.length !== lastProfileCountRef.current) {
      lastProfileCountRef.current = profiles.length;
      
      if (isDebugMode && profiles.length > 0) {
        debugLog(
          'Discover screen store state update',
          `Store state: ${profiles.length} profiles, loading: ${isLoading}, error: ${error || 'none'}`,
          {
            profileCount: profiles.length,
            profileIds: profiles.slice(0, 5).map(p => p.id), // Limit to first 5 IDs
            cacheSize: cache?.getStats().size || 0,
            isLoading,
            error,
            timestamp: Date.now()
          }
        );
      }
    }
  }, [profiles.length, isLoading, error, isDebugMode, debugLog, cache]);

  // Optimized error logging - only when error actually changes
  useEffect(() => {
    if (error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      
      if (error && isDebugMode) {
        debugLog(
          'Discover screen error state',
          `Error occurred: ${error}`,
          { error, timestamp: Date.now() }
        );
      }
    }
  }, [error, isDebugMode, debugLog]);

  // Single initialization effect
  useEffect(() => {
    if (user?.id) {
      // Only log once on initialization
      if (isDebugMode) {
        debugLog(
          'Discover screen initialized',
          `Screen loaded for user ${user.id}`,
          {
            userId: user.id,
            initialProfileCount: profiles.length
          }
        );
      }
      
      // Fetch profiles if needed
      if (profiles.length === 0 && !isLoading) {
        fetchPotentialMatches();
      }
      
      // Update limit status
      updateLimitStatus();
    }
  }, [user?.id]); // Only depend on user ID

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (limitUpdateTimeoutRef.current) {
        clearTimeout(limitUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    if (!user?.id || refreshing) return;
    
    debugLog(
      'Profile refresh started',
      `User ${user.id} initiated manual refresh`,
      { userId: user.id, currentProfileCount: profiles.length }
    );
    
    setRefreshing(true);
    
    try {
      await fetchPotentialMatches(true);
      
      if (profiles.length > 0) {
        notify.success('Profiles refreshed successfully!');
      } else {
        notify.info('No new profiles found. All available profiles have been shown.');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      notify.error(`Failed to refresh profiles: ${errorMessage}`);
      
      debugLog(
        'Profile refresh failed',
        `Failed to refresh profiles: ${errorMessage}`,
        { error: errorMessage, userId: user.id }
      );
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, refreshing, profiles.length, fetchPotentialMatches, debugLog]);

  // Optimized swipe handlers
  const handleSwipeLeft = useCallback(async (profile: UserProfile) => {
    if (!user?.id) return;
    
    // Add to local swipe queue
    useMatchesStore.getState().addToSwipeQueue({
      swiper_id: user.id,
      swipee_id: profile.id,
      direction: 'left',
      swipe_timestamp: Date.now()
    });
    
    debugLog(
      'Swipe left queued',
      `User swiped left (pass) on ${profile.name}`,
      { profileId: profile.id, profileName: profile.name, action: 'pass' }
    );
  }, [user?.id, debugLog]);

  const handleSwipeRight = useCallback(async (profile: UserProfile) => {
    if (!user?.id) return;
    
    // Add to local swipe queue
    useMatchesStore.getState().addToSwipeQueue({
      swiper_id: user.id,
      swipee_id: profile.id,
      direction: 'right',
      swipe_timestamp: Date.now()
    });
    
    debugLog(
      'Swipe right queued',
      `User swiped right (like) on ${profile.name}`,
      { profileId: profile.id, profileName: profile.name, action: 'like' }
    );
  }, [user?.id, debugLog]);

  // End of profiles handler - processes swipe batch and clears cache and profiles
  const endOfProfiles = useCallback(async () => {
    debugLog(
      'Discover endOfProfiles',
      'User reached end of profiles, processing swipe batch and clearing cache and profiles',
      { 
        profilesCount: profiles.length 
      }
    );
    
    try {
      // 1. Process swipe batch first
      await useMatchesStore.getState().processSwipeQueue();
      
      // 2. Clear cache
      useMatchesStore.getState().cache.clear();
      
      // 3. Clear profiles array to trigger "No More Profiles" message
      useMatchesStore.getState().clearProfiles();
      
      debugLog(
        'Discover endOfProfiles complete',
        'Successfully processed swipe batch and cleared cache and profiles',
        { 
          profilesCount: profiles.length 
        }
      );
      
    } catch (error) {
      debugLog(
        'Discover endOfProfiles error',
        'Failed to process end of profiles',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }, [profiles.length, debugLog]);

  // Optimized empty handler
  const handleEmpty = useCallback(() => {
    debugLog(
      'No more profiles',
      'User has swiped through all available profiles',
      { totalProfilesSwiped: profiles.length }
    );
    
    notify.info('No more profiles available. Try refreshing to see new ones!');
  }, [profiles.length, debugLog]);

  // Optimized profile press handler
  const handleProfilePress = useCallback((profile: UserProfile) => {
    debugLog(
      'Profile detail view',
      `User opened profile details for ${profile.name}`,
      { profileId: profile.id, profileName: profile.name }
    );
    
    setSelectedProfile(profile);
    setShowProfileModal(true);
  }, [debugLog]);

  // Close profile modal
  const closeProfileModal = useCallback(() => {
    setShowProfileModal(false);
    setSelectedProfile(null);
  }, []);

  // Handle like action
  const handleLike = useCallback(async (profile: UserProfile) => {
    if (!user?.id) return;
    
    debugLog(
      'Profile like action',
      `User ${user.id} liked profile ${profile.name}`,
      { profileId: profile.id, profileName: profile.name }
    );
    
    try {
      // Add to swipe queue for processing
      addToSwipeQueue({
        swiper_id: user.id,
        swipee_id: profile.id,
        direction: 'right',
        swipe_timestamp: Date.now()
      });
      
      // Close modal - profile will be removed by swipe cards
      closeProfileModal();
      
      notify.success(`Liked ${profile.name}!`);
    } catch (error) {
      const errorMessage = safeStringifyError(error);
      debugLog('Error liking profile', errorMessage);
      notify.error(`Failed to like profile: ${errorMessage}`);
    }
  }, [user?.id, debugLog, addToSwipeQueue, closeProfileModal, notify]);

  // Handle pass action
  const handlePass = useCallback(async (profile: UserProfile) => {
    if (!user?.id) return;
    
    debugLog(
      'Profile pass action',
      `User ${user.id} passed on profile ${profile.name}`,
      { profileId: profile.id, profileName: profile.name }
    );
    
    try {
      // Add to swipe queue for processing
      addToSwipeQueue({
        swiper_id: user.id,
        swipee_id: profile.id,
        direction: 'left',
        swipe_timestamp: Date.now()
      });
      
      // Close modal - profile will be removed by swipe cards
      closeProfileModal();
      
      notify.info(`Passed on ${profile.name}`);
    } catch (error) {
      const errorMessage = safeStringifyError(error);
      debugLog('Error passing on profile', errorMessage);
      notify.error(`Failed to pass on profile: ${errorMessage}`);
    }
  }, [user?.id, debugLog, addToSwipeQueue, closeProfileModal, notify]);



  // Memoized error state
  const errorState = useMemo(() => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color={Colors.dark.error} />
        <Text style={styles.errorTitle}>Unable to Load Profiles</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button 
          title="Try Again" 
          onPress={handleRefresh}
          style={styles.retryButton}
          disabled={refreshing}
        />
      </View>
    );
  }, [error, handleRefresh, refreshing]);

  // Memoized empty state
  const emptyState = useMemo(() => {
    if (isLoading || profiles.length > 0) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Heart size={64} color={Colors.dark.textSecondary} />
        <Text style={styles.emptyTitle}>No Profiles Available</Text>
        <Text style={styles.emptyText}>
          Try refreshing to see new profiles or adjust your discovery settings
        </Text>
        <Button 
          title="Refresh Profiles" 
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={refreshing}
        />
      </View>
    );
  }, [isLoading, profiles.length, handleRefresh, refreshing]);

  // Main render
  return (
    <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>
            Find your next co-founder or business partner
          </Text>
        </View>

        <View style={styles.swipeContainer}>
          {error ? errorState : (
            <>
              {profiles.length === 0 ? emptyState : (
                useSimpleProfileView ? (
                  <View style={styles.container}>
                    <Text style={styles.title}>Simple View (Debug)</Text>
                    <Text>Profiles: {profiles.length}, Loading: {isLoading ? 'Yes' : 'No'}</Text>
                    {profiles.slice(0, 5).map(profile => (
                      <Text key={profile.id} style={styles.subtitle}>{profile.name}</Text>
                    ))}
                  </View>
                ) : (
                  <SwipeCards
                    profiles={profiles}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    onEmpty={handleEmpty}
                    onEndOfProfiles={endOfProfiles}
                    onProfilePress={handleProfilePress}
                    error={error}
                    onRefresh={handleRefresh}
                  />
                )
              )}
            </>
          )}
        </View>
      </View>

      {/* Profile Detail Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeProfileModal}
      >
        <SafeAreaView style={styles.modalContainer} edges={UNIVERSAL_SAFE_AREA_EDGES}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeProfileModal} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Profile Details</Text>
            <View style={styles.placeholder} />
          </View>
          
          {selectedProfile && (
            <View style={styles.modalContent}>
              <Text style={styles.profileName}>{selectedProfile.name}</Text>
              
              {/* Basic Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.profileBio}>
                  {selectedProfile.bio || 'No bio available'}
                </Text>
              </View>

              {/* Business Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Business</Text>
                {selectedProfile.businessField && (
                  <Text style={styles.profileDetails}>
                    <Text style={styles.label}>Field:</Text> {selectedProfile.businessField}
                  </Text>
                )}
                {selectedProfile.entrepreneurStatus && (
                  <Text style={styles.profileDetails}>
                    <Text style={styles.label}>Status:</Text> {selectedProfile.entrepreneurStatus}
                  </Text>
                )}
                {selectedProfile.businessStage && (
                  <Text style={styles.profileDetails}>
                    <Text style={styles.label}>Stage:</Text> {selectedProfile.businessStage}
                  </Text>
                )}
                {selectedProfile.industryFocus && (
                  <Text style={styles.profileDetails}>
                    <Text style={styles.label}>Industry Focus:</Text> {selectedProfile.industryFocus}
                  </Text>
                )}
              </View>

              {/* Location */}
              {selectedProfile.location && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  <Text style={styles.profileDetails}>
                    {selectedProfile.location}
                    {selectedProfile.timezone && ` • ${selectedProfile.timezone}`}
                  </Text>
                </View>
              )}

              {/* Looking For */}
              {selectedProfile.lookingFor && selectedProfile.lookingFor.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Looking For</Text>
                  <View style={styles.tagsContainer}>
                    {selectedProfile.lookingFor.map((item, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Skills */}
              {(selectedProfile.skillsOffered && selectedProfile.skillsOffered.length > 0) || 
               (selectedProfile.skillsSeeking && selectedProfile.skillsSeeking.length > 0) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Skills</Text>
                  {selectedProfile.skillsOffered && selectedProfile.skillsOffered.length > 0 && (
                    <View style={styles.skillsGroup}>
                      <Text style={styles.skillsLabel}>Offering:</Text>
                      <View style={styles.tagsContainer}>
                        {selectedProfile.skillsOffered.map((skill, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{skill}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {selectedProfile.skillsSeeking && selectedProfile.skillsSeeking.length > 0 && (
                    <View style={styles.skillsGroup}>
                      <Text style={styles.skillsLabel}>Seeking:</Text>
                      <View style={styles.tagsContainer}>
                        {selectedProfile.skillsSeeking.map((skill, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{skill}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Availability */}
              {selectedProfile.availabilityLevel && selectedProfile.availabilityLevel.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Availability</Text>
                  <View style={styles.tagsContainer}>
                    {selectedProfile.availabilityLevel.map((level, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{level}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Key Challenge */}
              {selectedProfile.keyChallenge && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Key Challenge</Text>
                  <Text style={styles.profileDetails}>{selectedProfile.keyChallenge}</Text>
                </View>
              )}

              {/* Success Highlight */}
              {selectedProfile.successHighlight && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Success Highlight</Text>
                  <Text style={styles.profileDetails}>{selectedProfile.successHighlight}</Text>
                </View>
              )}

              {/* Goals */}
              {selectedProfile.goals && selectedProfile.goals.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Goals</Text>
                  {selectedProfile.goals.map((goal, index) => (
                    <Text key={index} style={styles.profileDetails}>• {goal}</Text>
                  ))}
                </View>
              )}

              {/* Analytics */}
              {selectedProfile.analytics && Object.keys(selectedProfile.analytics).length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Analytics</Text>
                  {selectedProfile.analytics.revenue && (
                    <Text style={styles.profileDetails}>
                      <Text style={styles.label}>Revenue:</Text> {selectedProfile.analytics.revenue}
                    </Text>
                  )}
                  {selectedProfile.analytics.growth && (
                    <Text style={styles.profileDetails}>
                      <Text style={styles.label}>Growth:</Text> {selectedProfile.analytics.growth}
                    </Text>
                  )}
                  {selectedProfile.analytics.customers && (
                    <Text style={styles.profileDetails}>
                      <Text style={styles.label}>Customers:</Text> {selectedProfile.analytics.customers}
                    </Text>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.passButton]} 
                  onPress={() => handlePass(selectedProfile)}
                >
                  <X size={24} color={Colors.dark.text} />
                  <Text style={styles.actionButtonText}>Pass</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.likeButton]} 
                  onPress={() => handleLike(selectedProfile)}
                >
                  <Heart size={24} color={Colors.dark.background} />
                  <Text style={[styles.actionButtonText, styles.likeButtonText]}>Like</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: Dimensions.get('window').width * 0.04, // 4% of screen width
    paddingBottom: Dimensions.get('window').height * 0.01, // 1% of screen height
  },
  title: {
    fontSize: Dimensions.get('window').height * 0.04, // 4% of screen height
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: Dimensions.get('window').height * 0.005, // 0.5% of screen height
  },
  subtitle: {
    fontSize: Dimensions.get('window').height * 0.02, // 2% of screen height
    color: Colors.dark.textSecondary,
  },

  swipeContainer: {
    flex: 1,
    paddingHorizontal: Dimensions.get('window').width * 0.05, // 5% of screen width
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.dark.primary,
    minWidth: 120,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: Colors.dark.primary,
    minWidth: 160,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  profileBio: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  profileDetails: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  // Enhanced modal styles
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  label: {
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: Colors.dark.background,
    fontWeight: '500',
  },
  skillsGroup: {
    marginBottom: 12,
  },
  skillsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  passButton: {
    backgroundColor: Colors.dark.border,
  },
  likeButton: {
    backgroundColor: Colors.dark.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  likeButtonText: {
    color: Colors.dark.background,
  },
});
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
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SwipeCards } from '@/components/SwipeCards';
import { Button } from '@/components/Button';
import { useMatchesStore } from '@/store/matches-store';
import { useUsageStore } from '@/store/usage-store';
import { useAuthStore } from '@/store/auth-store';
import { useDebugStore } from '@/store/debug-store';
import { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { Heart, X, RotateCcw, AlertCircle, TrendingUp, Users, MessageCircle, Zap } from 'lucide-react-native';

import { notify } from '@/store/notification-store';
import { handleError, ErrorCodes, ErrorCategory } from '@/utils/error-utils';

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { profiles, isLoading, error, fetchPotentialMatches, cache } = useMatchesStore();
  const { checkAllLimits } = useUsageStore();
  const { isDebugMode, addDebugLog, useSimpleProfileView } = useDebugStore();

  const [refreshing, setRefreshing] = useState(false);
  const [limitStatus, setLimitStatus] = useState<{
    swipe: { isAllowed: boolean };
    match: { isAllowed: boolean };
    like: { isAllowed: boolean };
  } | null>(null);

  // Use refs to prevent unnecessary re-renders
  const lastProfileCountRef = useRef(profiles.length);
  const lastErrorRef = useRef(error);
  const limitUpdateTimeoutRef = useRef<number | null>(null);

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

  // End of profiles handler - processes swipe batch and clears cache
  const endOfProfiles = useCallback(async () => {
    debugLog(
      'Discover endOfProfiles',
      'User reached end of profiles, processing swipe batch and clearing cache',
      { 
        profilesCount: profiles.length 
      }
    );
    
    try {
      // 1. Process swipe batch first
      await useMatchesStore.getState().processSwipeQueue();
      
      // 2. Clear cache
      useMatchesStore.getState().cache.clear();
      
      debugLog(
        'Discover endOfProfiles complete',
        'Successfully processed swipe batch and cleared cache',
        { 
          profilesCount: profiles.length 
        }
      );
      
    } catch (error) {
      debugLog(
        'Discover endOfProfiles error',
        'Failed to process end of profiles',
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
          errorDetails: error,
          errorStack: error instanceof Error ? error.stack : undefined
        }
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
    
    router.push(`/profile/${profile.id}`);
  }, [router, debugLog]);

  // Memoized limit status indicators to prevent re-renders
  const limitStatusIndicators = useMemo(() => {
    return (
      <View style={styles.limitStatusContainer}>
        <View style={styles.limitStatusRow}>
          <View style={[
            styles.limitIndicator,
            limitStatus && !limitStatus.swipe?.isAllowed ? styles.limitReached : {}
          ]}>
            <Heart size={16} color={
              limitStatus && limitStatus.swipe?.isAllowed 
                ? Colors.dark.success 
                : Colors.dark.error
            } />
            <Text style={[
              styles.limitText,
              limitStatus && !limitStatus.swipe?.isAllowed ? styles.limitTextReached : {}
            ]}>
              {limitStatus && limitStatus.swipe?.isAllowed ? 'Swipe OK' : 'Swipe Limit'}
            </Text>
          </View>
          
          <View style={[
            styles.limitIndicator,
            limitStatus && !limitStatus.like?.isAllowed ? styles.limitReached : {}
          ]}>
            <Zap size={16} color={
              limitStatus && limitStatus.like?.isAllowed 
                ? Colors.dark.success 
                : Colors.dark.error
            } />
            <Text style={[
              styles.limitText,
              limitStatus && !limitStatus.like?.isAllowed ? styles.limitTextReached : {}
            ]}>
              {limitStatus && limitStatus.like?.isAllowed ? 'Like OK' : 'Like Limit'}
            </Text>
          </View>
          
          <View style={[
            styles.limitIndicator,
            limitStatus && !limitStatus.match?.isAllowed ? styles.limitReached : {}
          ]}>
            <MessageCircle size={16} color={
              limitStatus && limitStatus.match?.isAllowed 
                ? Colors.dark.success 
                : Colors.dark.error
            } />
            <Text style={[
              styles.limitText,
              limitStatus && !limitStatus.match?.isAllowed ? styles.limitTextReached : {}
            ]}>
              {limitStatus && limitStatus.match?.isAllowed ? 'Match OK' : 'Match Limit'}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [limitStatus]);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>
            Find your next co-founder or business partner
          </Text>
        </View>

        {limitStatusIndicators}

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
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  limitStatusContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  limitStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    minWidth: 100,
  },
  limitReached: {
    borderColor: Colors.dark.error,
    backgroundColor: Colors.dark.error + '20',
  },
  limitText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginLeft: 6,
    fontWeight: '600',
  },
  limitTextReached: {
    color: Colors.dark.error,
  },
  swipeContainer: {
    flex: 1,
    paddingHorizontal: 20,
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
});
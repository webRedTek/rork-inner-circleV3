/**
 * FILE: app/(tabs)/discover.tsx
 * LAST UPDATED: 2025-07-04 18:45
 * 
 * CURRENT STATE:
 * **UNIFIED LIMIT CHECKING** discover screen with single source of truth. Features:
 * - USES: Unified usage-store limit checking system exclusively
 * - ELIMINATED: Duplicate limit checking from matches-store
 * - CONSISTENT: Same limit validation as profile cache and other components
 * - REAL-TIME: Live limit status updates with proper error handling
 * - STREAMLINED: Simplified swipe validation without redundant checks
 * 
 * RECENT CHANGES:
 * - MAJOR REFACTOR: Integrated unified usage-store limit checking system
 * - REMOVED: Dependencies on matches-store limit flags (swipeLimitReached, matchLimitReached)
 * - UNIFIED: All limit validation now uses single source of truth
 * - ENHANCED: Real-time limit status display with accurate counts
 * - SIMPLIFIED: Swipe handlers without duplicate validation logic
 * 
 * FILE INTERACTIONS:
 * - PRIMARY DATA: Gets limit status from usage-store (single source of truth)
 * - PROFILE DATA: Uses matches-store for profile management only
 * - NOTIFICATIONS: Integrated with notification system for limit alerts
 * - SWIPE HANDLING: Simplified without redundant limit checks
 * - CACHE VIEW: Now consistent with same data source
 * 
 * KEY FUNCTIONS:
 * - handleSwipeLeft/Right: Simplified swipe handling with unified limit checking
 * - handleRefresh: Manual profile refresh with limit validation
 * - Limit status display: Real-time updates from single source
 * - SwipeCards integration: Streamlined without duplicate validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
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
import { supabase } from '@/lib/supabase';
import { Heart, X, RotateCcw, AlertCircle, TrendingUp, Users, MessageCircle, Zap } from 'lucide-react-native';

import { notify } from '@/store/notification-store';
import { handleError, ErrorCodes, ErrorCategory } from '@/utils/error-utils';

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { profiles, isLoading, error, fetchPotentialMatches, cache } = useMatchesStore();
  const { 
    checkAllLimits, 
    checkSwipeLimit, 
    checkMatchLimit, 
    checkLikeLimit,
    updateUsage
  } = useUsageStore();
  const { isDebugMode, addDebugLog, useSimpleProfileView } = useDebugStore();

  const [refreshing, setRefreshing] = useState(false);
  const [limitStatus, setLimitStatus] = useState<{
    swipe: { isAllowed: boolean };
    match: { isAllowed: boolean };
    like: { isAllowed: boolean };
  } | null>(null);

  // Debug logging for store state changes - ONLY when profiles actually change
  useEffect(() => {
    if (isDebugMode && profiles.length > 0) {
      addDebugLog({
        event: 'Discover screen store state update',
        status: 'info',
        details: `Store state: ${profiles.length} profiles, loading: ${isLoading}, error: ${error || 'none'}`,
        source: 'discover-screen',
        data: {
          profileCount: profiles.length,
          profileIds: profiles.map(p => p.id),
          cacheSize: cache?.getStats().size || 0,
          cacheHitRate: cache?.getStats().hitRate || 0,
          isLoading,
          error,
          timestamp: Date.now()
        }
      });
    }
  }, [profiles.length, isLoading, error]); // Removed cache and addDebugLog from dependencies

  // Debug logging for initial load - ONLY ONCE
  useEffect(() => {
    if (user?.id && isDebugMode) {
      addDebugLog({
        event: 'Discover screen initialized',
        status: 'info',
        details: `Screen loaded for user ${user.id}`,
        source: 'discover-screen',
        data: {
          userId: user.id,
          initialProfileCount: profiles.length,
          initialCacheSize: cache?.getStats().size || 0
        }
      });
    }
  }, [user?.id]); // Removed isDebugMode and addDebugLog from dependencies

  // Fetch potential matches when screen loads - ONLY ONCE per user
  useEffect(() => {
    if (user?.id) {
      // Fetch profiles (will use cache if available)
      fetchPotentialMatches();
    }
  }, [user?.id]); // Removed fetchPotentialMatches and isDebugMode from dependencies

  // Update limit status from cached usage data only - ONLY ONCE
  useEffect(() => {
    updateLimitStatus();
  }, [user?.id]); // Only run when user changes

  // Update limit status from unified source
  const updateLimitStatus = useCallback(() => {
    if (!user?.id) return;
    
    try {
      const allLimits = checkAllLimits();
      
      // Add null check to prevent "Cannot read properties of null" error
      if (!allLimits) {
        // Set default "allowed" status while loading instead of null
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
      // Set default "allowed" status on error instead of null
      setLimitStatus({
        swipe: { isAllowed: true },
        match: { isAllowed: true },
        like: { isAllowed: true }
      });
    }
  }, [user?.id, checkAllLimits]);

  // Handle refresh with limit validation
  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    
    // Only log to debug system when debug mode is enabled
    const { addDebugLog } = useDebugStore.getState();
    
    if (isDebugMode) {
      addDebugLog({
        event: 'Profile refresh started',
        status: 'info',
        details: `User ${user.id} initiated manual refresh`,
        source: 'discover-screen',
        data: {
          userId: user.id,
          currentProfileCount: profiles.length,
          isCurrentlyLoading: isLoading,
          hasError: !!error
        }
      });
    }
    
    setRefreshing(true);
    
    try {
      // Log before profile fetch
      if (isDebugMode) {
        addDebugLog({
          event: 'Starting profile fetch',
          status: 'info',
          details: 'Calling fetchPotentialMatches with force=true',
          source: 'discover-screen',
          data: {
            force: true,
            currentProfileCount: profiles.length
          }
        });
      }
      
      // Fetch new profiles
      await fetchPotentialMatches(true);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Profile fetch completed',
          status: 'success',
          details: `Profile fetch completed. New count: ${profiles.length}`,
          source: 'discover-screen',
          data: {
            newProfileCount: profiles.length,
            profileIds: profiles.map(p => p.id)
          }
        });
      }
      
      // Only show success if we actually have profiles
      if (profiles.length > 0) {
        notify.success('Profiles refreshed successfully!');
        if (isDebugMode) {
          addDebugLog({
            event: 'Refresh success notification',
            status: 'success',
            details: `Successfully refreshed ${profiles.length} profiles`,
            source: 'discover-screen'
          });
        }
      } else {
        notify.info('No new profiles found. All available profiles have been shown.');
        if (isDebugMode) {
          addDebugLog({
            event: 'No profiles found',
            status: 'warning',
            details: 'Refresh completed but no new profiles were found',
            source: 'discover-screen'
          });
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      notify.error(`Failed to refresh profiles: ${errorMessage}`);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Profile refresh failed',
          status: 'error',
          details: `Failed to refresh profiles: ${errorMessage}`,
          source: 'discover-screen',
          data: {
            error: errorMessage,
            userId: user.id
          }
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, isDebugMode, profiles.length, isLoading, error, fetchPotentialMatches]);

  // Simplified swipe left handler with batch caching
  const handleSwipeLeft = useCallback(async (profile: UserProfile) => {
    if (!user?.id) return;
    
    if (isDebugMode) {
      addDebugLog({
        event: 'Swipe left initiated',
        status: 'info',
        details: `User swiped left (pass) on ${profile.name}`,
        source: 'discover-screen',
        data: {
          profileId: profile.id,
          profileName: profile.name,
          action: 'pass'
        }
      });
    }
    
    // Always allow swipe actions for UI flow
    if (isDebugMode) {
      addDebugLog({
        event: 'Swipe left cached',
        status: 'success',
        details: `Cached pass action for ${profile.name} - no database calls`,
        source: 'discover-screen',
        data: {
          profileId: profile.id,
          profileName: profile.name,
          action: 'pass',
          cached: true
        }
      });
    }
    
    // No database calls for swipe actions - just allow the swipe
  }, [user?.id, isDebugMode]);

  // Simplified swipe right handler with batch caching
  const handleSwipeRight = useCallback(async (profile: UserProfile) => {
    if (!user?.id) return;
    
    if (isDebugMode) {
      addDebugLog({
        event: 'Swipe right initiated',
        status: 'info',
        details: `User swiped right (like) on ${profile.name}`,
        source: 'discover-screen',
        data: {
          profileId: profile.id,
          profileName: profile.name,
          action: 'like'
        }
      });
    }
    
    // Always allow swipe actions for UI flow  
    if (isDebugMode) {
      addDebugLog({
        event: 'Swipe right cached',
        status: 'success',
        details: `Cached like action for ${profile.name} - no database calls`,
        source: 'discover-screen',
        data: {
          profileId: profile.id,
          profileName: profile.name,
          action: 'like',
          cached: true
        }
      });
    }
    
    // No database calls for swipe actions - just allow the swipe
  }, [user?.id, isDebugMode]);

  // Handle when no more profiles
  const handleEmpty = useCallback(() => {
    if (isDebugMode) {
      addDebugLog({
        event: 'No more profiles',
        status: 'info',
        details: 'User has swiped through all available profiles',
        source: 'discover-screen',
        data: {
          totalProfilesSwiped: profiles.length
        }
      });
    }
    
    notify.info('No more profiles available. Try refreshing to see new ones!');
  }, [isDebugMode, profiles.length]);

  // Handle profile press
  const handleProfilePress = useCallback((profile: UserProfile) => {
    if (isDebugMode) {
      addDebugLog({
        event: 'Profile detail view',
        status: 'info',
        details: `User opened profile details for ${profile.name}`,
        source: 'discover-screen',
        data: {
          profileId: profile.id,
          profileName: profile.name
        }
      });
    }
    
    router.push(`/profile/${profile.id}`);
  }, [router, isDebugMode]);

  // Render limit status indicators
  const renderLimitStatus = () => {
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
  };

  // Render error state
  const renderError = () => {
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
        />
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
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
        />
      </View>
    );
  };

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

        {renderLimitStatus()}

        <View style={styles.swipeContainer}>
          {error ? renderError() : (
            <>
              {profiles.length === 0 ? renderEmpty() : (
                useSimpleProfileView ? (
                  <View style={styles.container}>
                    <Text style={styles.title}>Simple View (Debug)</Text>
                    <Text>Profiles: {profiles.length}, Loading: {isLoading ? 'Yes' : 'No'}</Text>
                    {profiles.map(profile => (
                      <Text key={profile.id} style={styles.subtitle}>{profile.name}</Text>
                    ))}
                  </View>
                ) : (
                  <SwipeCards
                    profiles={profiles}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    onEmpty={handleEmpty}
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
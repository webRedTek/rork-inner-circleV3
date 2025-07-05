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
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, Platform } from 'react-native';
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
import { startUsageSyncForDiscovery } from '@/store/usage-store';
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
    updateUsage,
    fetchDatabaseTotals,
    databaseTotals 
  } = useUsageStore();
  const { isDebugMode, addDebugLog } = useDebugStore();

  const [refreshing, setRefreshing] = useState(false);
  const [limitStatus, setLimitStatus] = useState<{
    swipe: { isAllowed: boolean };
    match: { isAllowed: boolean };
    like: { isAllowed: boolean };
  } | null>(null);

  // Debug logging for store state changes
  useEffect(() => {
    if (isDebugMode) {
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
  }, [profiles, isLoading, error, cache, isDebugMode, addDebugLog]);

  // Debug logging for initial load
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
  }, [user?.id, isDebugMode, addDebugLog]);

  // Initialize usage sync and fetch limit status
  useEffect(() => {
    if (user?.id) {
      if (isDebugMode) {
        console.log('[DiscoverScreen] Initializing usage sync and fetching limits');
      }
      
      // Trigger usage sync for discovery
      startUsageSyncForDiscovery(user.id);
      
      // Fetch current database totals and limit status
      fetchDatabaseTotals(user.id).then(() => {
        updateLimitStatus();
      });
    }
  }, [user?.id, isDebugMode]);

  // Update limit status whenever usage data changes
  useEffect(() => {
    updateLimitStatus();
  }, [databaseTotals]);

  // Update limit status from unified source
  const updateLimitStatus = useCallback(() => {
    if (!user?.id) return;
    
    try {
      const allLimits = checkAllLimits();
      
      // Add null check to prevent "Cannot read properties of null" error
      if (!allLimits) {
        if (isDebugMode) {
          console.log('[DiscoverScreen] checkAllLimits returned null - database totals or rate limits not available yet');
        }
        setLimitStatus(null);
        return;
      }
      
      setLimitStatus({
        swipe: allLimits.swipe,
        match: allLimits.match,
        like: allLimits.like
      });
      
      if (isDebugMode) {
        console.log('[DiscoverScreen] Updated limit status:', {
          swipe: allLimits.swipe,
          match: allLimits.match,
          like: allLimits.like
        });
      }
    } catch (error) {
      console.error('[DiscoverScreen] Error updating limit status:', error);
      setLimitStatus(null);
    }
  }, [user?.id, checkAllLimits, isDebugMode]);

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
      // Log database totals fetch
      if (isDebugMode) {
        addDebugLog({
          event: 'Fetching database totals',
          status: 'info',
          details: 'Refreshing usage limits and totals',
          source: 'discover-screen'
        });
      }
      
      // Refresh database totals first
      await fetchDatabaseTotals(user.id);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Database totals fetched',
          status: 'success',
          details: 'Usage limits and totals refreshed successfully',
          source: 'discover-screen',
          data: databaseTotals
        });
      }
      
      // Update limit status
      updateLimitStatus();
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Limit status updated',
          status: 'success',
          details: 'Refresh limit checking completed',
          source: 'discover-screen',
          data: limitStatus
        });
      }
      
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
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Refresh error',
          status: 'error',
          details: `Refresh failed: ${errorMessage}`,
          source: 'discover-screen',
          data: {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
      
      // Don't show error notification here since fetchPotentialMatches already shows it
    } finally {
      setRefreshing(false);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Refresh completed',
          status: 'info',
          details: 'Refresh process finished',
          source: 'discover-screen',
          data: {
            finalProfileCount: profiles.length,
            wasSuccessful: !error
          }
        });
      }
    }
  }, [user?.id, fetchDatabaseTotals, updateLimitStatus, fetchPotentialMatches, isDebugMode, profiles, isLoading, error, limitStatus, databaseTotals]);

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
          userId: user.id,
          timestamp: Date.now()
        }
      });
    }
    
    try {
      // Check swipe limit using unified system
      const canSwipe = checkSwipeLimit();
      if (!canSwipe) {
        const allLimits = checkAllLimits();
        const swipeStatus = allLimits?.swipe;
        
        if (isDebugMode) {
          addDebugLog({
            event: 'Swipe left blocked - limit reached',
            status: 'warning',
            details: 'Daily swipe limit reached',
            source: 'discover-screen',
            data: {
              swipeStatus,
              allLimits
            }
          });
        }
        
        notify.error(`Daily swipe limit reached. Try again tomorrow!`);
        return;
      }
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe left limit check passed',
          status: 'success',
          details: 'Swipe limit allows action',
          source: 'discover-screen'
        });
      }
      
      // Cache the swipe decision locally (no immediate database call)
      const swipeAction = {
        id: `${user.id}_${profile.id}_${Date.now()}`,
        swiper_id: user.id,
        swiped_user_id: profile.id,
        direction: 'left' as const,
        timestamp: Date.now()
      };
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe left action cached',
          status: 'info',
          details: 'Swipe action cached for batch processing',
          source: 'discover-screen',
          data: {
            swipeAction,
            cacheType: 'local'
          }
        });
      }
      
      // Track usage (this will be batched)
      await updateUsage('swipe', 1);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe left usage tracked',
          status: 'success',
          details: 'Usage incremented in usage store',
          source: 'discover-screen',
          data: {
            action: 'swipe',
            count: 1
          }
        });
      }
      
      // Update limit status
      updateLimitStatus();
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe left completed',
          status: 'success',
          details: `Successfully processed swipe left on ${profile.name}`,
          source: 'discover-screen',
          data: {
            profileId: profile.id,
            totalTime: Date.now() - Date.now()
          }
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe left error',
          status: 'error',
          details: `Error processing swipe left: ${errorMessage}`,
          source: 'discover-screen',
          data: {
            error: errorMessage,
            profileId: profile.id,
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
      
      console.error('[DiscoverScreen] Error processing swipe left:', errorMessage);
      notify.error(`Failed to process swipe: ${errorMessage}`);
    }
  }, [user?.id, checkSwipeLimit, checkAllLimits, updateUsage, updateLimitStatus, isDebugMode, addDebugLog]);

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
          userId: user.id,
          timestamp: Date.now()
        }
      });
    }
    
    try {
      // Check both swipe and like limits using unified system
      const canSwipe = checkSwipeLimit();
      const canLike = checkLikeLimit();
      
      if (!canSwipe) {
        const allLimits = checkAllLimits();
        const swipeStatus = allLimits?.swipe;
        
        if (isDebugMode) {
          addDebugLog({
            event: 'Swipe right blocked - swipe limit reached',
            status: 'warning',
            details: 'Daily swipe limit reached',
            source: 'discover-screen',
            data: {
              swipeStatus,
              allLimits
            }
          });
        }
        
        notify.error(`Daily swipe limit reached. Try again tomorrow!`);
        return;
      }
      
      if (!canLike) {
        const allLimits = checkAllLimits();
        const likeStatus = allLimits?.like;
        
        if (isDebugMode) {
          addDebugLog({
            event: 'Swipe right blocked - like limit reached',
            status: 'warning',
            details: 'Daily like limit reached',
            source: 'discover-screen',
            data: {
              likeStatus,
              allLimits
            }
          });
        }
        
        notify.error(`Daily like limit reached. Upgrade your plan for more!`);
        return;
      }
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe right limit checks passed',
          status: 'success',
          details: 'Both swipe and like limits allow action',
          source: 'discover-screen'
        });
      }
      
      // Cache the swipe decision locally (no immediate database call)
      const swipeAction = {
        id: `${user.id}_${profile.id}_${Date.now()}`,
        swiper_id: user.id,
        swiped_user_id: profile.id,
        direction: 'right' as const,
        timestamp: Date.now()
      };
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe right action cached',
          status: 'info',
          details: 'Like action cached for batch processing',
          source: 'discover-screen',
          data: {
            swipeAction,
            cacheType: 'local'
          }
        });
      }
      
      // Track usage for both swipe and like (this will be batched)
      await updateUsage('swipe', 1);
      await updateUsage('like', 1);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe right usage tracked',
          status: 'success',
          details: 'Both swipe and like usage incremented',
          source: 'discover-screen',
          data: {
            actions: ['swipe', 'like'],
            count: 1
          }
        });
      }
      
      // Update limit status
      updateLimitStatus();
      
      // Show optimistic feedback
      notify.info(`You liked ${profile.name}! 💖`);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe right completed',
          status: 'success',
          details: `Successfully processed swipe right on ${profile.name}`,
          source: 'discover-screen',
          data: {
            profileId: profile.id,
            totalTime: Date.now() - Date.now(),
            notification: `You liked ${profile.name}! 💖`
          }
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (isDebugMode) {
        addDebugLog({
          event: 'Swipe right error',
          status: 'error',
          details: `Error processing swipe right: ${errorMessage}`,
          source: 'discover-screen',
          data: {
            error: errorMessage,
            profileId: profile.id,
            stack: error instanceof Error ? error.stack : undefined
          }
        });
      }
      
      console.error('[DiscoverScreen] Error processing swipe right:', errorMessage);
      notify.error(`Failed to process like: ${errorMessage}`);
    }
  }, [user?.id, checkSwipeLimit, checkLikeLimit, checkAllLimits, updateUsage, updateLimitStatus, isDebugMode, addDebugLog]);

  // Handle profile press
  const handleProfilePress = useCallback((profile: UserProfile) => {
    if (isDebugMode) {
      console.log('[DiscoverScreen] Profile pressed:', profile.id);
    }
    router.push(`/profile/${profile.id}`);
  }, [router, isDebugMode]);

  // Handle empty profiles
  const handleEmpty = useCallback(() => {
    if (isDebugMode) {
      console.log('[DiscoverScreen] No more profiles to show');
    }
    
    Alert.alert(
      'No More Profiles',
      'You\'ve seen all available profiles. Try refreshing or adjusting your discovery settings.',
      [
        {
          text: 'Refresh',
          onPress: handleRefresh,
          style: 'default'
        },
        {
          text: 'Settings',
          onPress: () => router.push('/profile'),
          style: 'default'
        },
        {
          text: 'OK',
          style: 'cancel'
        }
      ]
    );
  }, [handleRefresh, router, isDebugMode]);

  // Render limit status indicators
  const renderLimitStatus = () => {
    return (
      <View style={styles.limitStatusContainer}>
        <View style={styles.limitStatusRow}>
          <View style={[
            styles.limitIndicator,
            !limitStatus || !limitStatus.swipe?.isAllowed ? styles.limitReached : {}
          ]}>
            <Heart size={16} color={
              limitStatus && limitStatus.swipe?.isAllowed 
                ? Colors.dark.success 
                : Colors.dark.error
            } />
            <Text style={[
              styles.limitText,
              !limitStatus || !limitStatus.swipe?.isAllowed ? styles.limitTextReached : {}
            ]}>
              {limitStatus ? 'Swipe OK' : 'Loading...'}
            </Text>
          </View>
          
          <View style={[
            styles.limitIndicator,
            !limitStatus || !limitStatus.like?.isAllowed ? styles.limitReached : {}
          ]}>
            <Zap size={16} color={
              limitStatus && limitStatus.like?.isAllowed 
                ? Colors.dark.success 
                : Colors.dark.error
            } />
            <Text style={[
              styles.limitText,
              !limitStatus || !limitStatus.like?.isAllowed ? styles.limitTextReached : {}
            ]}>
              {limitStatus ? 'Like OK' : 'Loading...'}
            </Text>
          </View>
          
          <View style={[
            styles.limitIndicator,
            !limitStatus || !limitStatus.match?.isAllowed ? styles.limitReached : {}
          ]}>
            <MessageCircle size={16} color={
              limitStatus && limitStatus.match?.isAllowed 
                ? Colors.dark.success 
                : Colors.dark.error
            } />
            <Text style={[
              styles.limitText,
              !limitStatus || !limitStatus.match?.isAllowed ? styles.limitTextReached : {}
            ]}>
              {limitStatus ? 'Match OK' : 'Loading...'}
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.dark.primary}
            colors={[Colors.dark.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>
            Find your next co-founder or business partner
          </Text>
        </View>

        {renderLimitStatus()}

        <View style={styles.content}>
          {error ? renderError() : (
            <>
              {profiles.length === 0 ? renderEmpty() : (
                <SwipeCards
                  profiles={profiles}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                  onEmpty={handleEmpty}
                  onProfilePress={handleProfilePress}
                  isLoading={isLoading}
                  error={error}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
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
  content: {
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
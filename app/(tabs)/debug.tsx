/**
 * FILE: app/(tabs)/debug.tsx
 * LAST UPDATED: 2025-07-03 20:56
 * 
 * CURRENT STATE:
 * Debug screen showing real-time app state and operation timeline:
 * - Shows usage store state and cache
 * - Shows matches store state and stats
 * - Shows auth store state and tier settings
 * - Shows chronological operation timeline
 * 
 * RECENT CHANGES:
 * - Fixed color constants usage
 * - Fixed DebugLogEntry type usage
 * - Enhanced timeline display
 * - Added source-based filtering
 * - Fixed log display formatting
 * 
 * FILE INTERACTIONS:
 * - Imports from: usage-store, matches-store, auth-store, debug-store, notification-store
 * - Components: None (uses native components)
 * - Dependencies: react-native, safe-area-context
 * - Data flow: Reads from all stores, displays state
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { useUsageStore } from '@/store/usage-store';
import { useMatchesStore } from '@/store/matches-store';
import { useAuthStore } from '@/store/auth-store';
import { useDebugStore } from '@/store/debug-store';
import { MembershipTier, TierSettings } from '@/types/user';
import type { DebugLogEntry } from '@/store/debug-store';
import { useNotificationStore } from '@/store/notification-store';
import { supabase } from '@/lib/supabase';

export default function DebugScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Get store states
  const { 
    usageCache, 
    batchUpdates, 
    isSyncing, 
    lastSyncError,
    databaseTotals 
  } = useUsageStore();
  
  const {
    profiles,
    matches,
    isLoading,
    error,
    getCacheStats,
    fetchPotentialMatches
  } = useMatchesStore();

  const { user, allTierSettings, tierSettingsTimestamp } = useAuthStore();

  // Get debug logs
  const { debugLog } = useDebugStore();

  const { clearAllNotifications, notifications } = useNotificationStore();

  // Format timestamps
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Format durations
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  const handleClearNotifications = () => {
    clearAllNotifications();
    console.log('All notifications cleared');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <Text style={styles.title}>Debug Information</Text>
        <Text style={styles.subtitle}>Last Updated: {lastRefresh.toLocaleTimeString()}</Text>

        {/* Timeline Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operation Timeline</Text>
          <View style={styles.timelineContainer}>
            {debugLog
              .filter(log => 
                ['matches-store', 'usage-store', 'discover-screen'].includes(log.source)
              )
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((log) => (
                <View key={log.id} style={styles.timelineEntry}>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>
                      {formatTime(log.timestamp)}
                    </Text>
                    <Text style={[
                      styles.timelineSource,
                      { color: log.source === 'matches-store' ? Colors.light.tint :
                              log.source === 'usage-store' ? Colors.light.success :
                              Colors.light.text }
                    ]}>
                      {log.source}
                    </Text>
                    <Text style={[
                      styles.timelineMessage,
                      { color: log.status === 'error' ? Colors.light.error :
                              log.status === 'success' ? Colors.light.success :
                              log.status === 'warning' ? Colors.light.warning :
                              Colors.light.text }
                    ]}>
                      {log.event}
                    </Text>
                    {log.details && (
                      <Text style={styles.timelineDetails}>
                        {log.details}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
          </View>
        </View>

        {/* Usage Store Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage Store</Text>
          
          <View style={styles.infoBlock}>
            <Text style={styles.label}>Cache Status:</Text>
            <Text style={styles.value}>
              {usageCache ? 'Initialized' : 'Not Initialized'}
            </Text>
          </View>

          {usageCache && (
            <>
              <View style={styles.infoBlock}>
                <Text style={styles.label}>Last Sync:</Text>
                <Text style={styles.value}>
                  {formatTime(usageCache.lastSyncTimestamp)}
                </Text>
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.label}>Usage Counts:</Text>
                <Text style={styles.value}>
                  Swipes: {usageCache.counts.swipe_count}{'\n'}
                  Matches: {usageCache.counts.match_count}{'\n'}
                  Likes: {usageCache.counts.like_count}{'\n'}
                  Messages: {usageCache.counts.message_count}{'\n'}
                  Boost Minutes Used: {usageCache.counts.boost_minutes_used}{'\n'}
                  Boost Uses: {usageCache.counts.boost_uses_count}
                </Text>
              </View>
            </>
          )}

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Sync Status:</Text>
            <Text style={styles.value}>
              {isSyncing ? 'Syncing...' : 'Idle'}{'\n'}
              {lastSyncError ? `Error: ${lastSyncError}` : 'No Errors'}
            </Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Batch Updates:</Text>
            <Text style={styles.value}>
              Pending: {batchUpdates.length}
            </Text>
          </View>

          {databaseTotals && (
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Database Totals:</Text>
              <Text style={styles.value}>
                {JSON.stringify(databaseTotals, null, 2)}
              </Text>
            </View>
          )}
        </View>

        {/* Matches Store Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Matches Store</Text>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Cache Stats:</Text>
            <Text style={styles.value}>
              Size: {getCacheStats().size}{'\n'}
              Hit Rate: {(getCacheStats().hitRate * 100).toFixed(1)}%{'\n'}
              Average Age: {formatDuration(getCacheStats().averageAge)}{'\n'}
              Memory Usage: {(getCacheStats().memoryUsage / 1024).toFixed(2)} KB{'\n'}
              Compression Ratio: {getCacheStats().compressionRatio.toFixed(2)}{'\n'}
              Eviction Count: {getCacheStats().evictionCount}
            </Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Match Counts:</Text>
            <Text style={styles.value}>
              Profiles: {profiles.length}{'\n'}
              Matches: {matches.length}{'\n'}
              Loading: {isLoading ? 'Yes' : 'No'}{'\n'}
              Error: {error || 'None'}
            </Text>
          </View>
        </View>

        {/* Auth Store Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auth Store</Text>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>User:</Text>
            <Text style={styles.value}>
              ID: {user?.id || 'Not logged in'}{'\n'}
              Tier: {user?.membershipTier || 'None'}
            </Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Tier Settings Cache:</Text>
            <Text style={styles.value}>
              {allTierSettings ? (
                <>
                  Status: Cached{'\n'}
                  Tiers Available: {Object.keys(allTierSettings).join(', ')}{'\n'}
                                     Cache Age: {formatDuration(Date.now() - (tierSettingsTimestamp || 0))}{'\n'}
                   Cache Valid: {(() => {
                     if (!tierSettingsTimestamp) return 'No';
                     const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
                     const isValid = (Date.now() - tierSettingsTimestamp) < CACHE_TTL;
                     const expiresIn = tierSettingsTimestamp + CACHE_TTL - Date.now();
                     return isValid ? `Yes (expires in ${formatDuration(expiresIn)})` : 'No (expired)';
                   })()}
                </>
              ) : (
                'Not cached - will fetch on next request'
              )}
            </Text>
          </View>

          {allTierSettings && user?.membershipTier && (
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Current User Tier Settings:</Text>
              <Text style={styles.value}>
                {(() => {
                  const userTier = allTierSettings[user.membershipTier];
                  if (!userTier) return 'No settings found for current tier';
                  return `Swipe Limit: ${userTier.daily_swipe_limit}${'\n'}Match Limit: ${userTier.daily_match_limit}${'\n'}Like Limit: ${userTier.daily_like_limit}${'\n'}Message Limit: ${userTier.message_sending_limit}`;
                })()}
              </Text>
            </View>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications Debug</Text>
          <Text style={styles.text}>Active notifications: {notifications.length}</Text>
          {notifications.length > 0 && (
            <View style={styles.notificationsContainer}>
              {notifications.map((notification, index) => (
                <Text key={notification.id} style={styles.notificationItem}>
                  {index + 1}. {notification.type} - {notification.displayStyle}: {notification.message}
                </Text>
              ))}
            </View>
          )}
          <Button
            title="Clear All Notifications"
            onPress={handleClearNotifications}
            variant="danger"
          />
        </View>

        {/* Profile Refresh Debug Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Refresh Debug</Text>
          <Text style={styles.subtitle}>
            Complete refresh flow tracking - Click refresh on Discover tab to see detailed logs
          </Text>
          
          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Current State</Text>
            <Text style={styles.debugText}>
              Total Profiles: {profiles.length}{'\n'}
              Is Loading: {isLoading ? 'Yes' : 'No'}{'\n'}
              Has Error: {error ? 'Yes' : 'No'}{'\n'}
              Database Totals: {databaseTotals ? 'Available' : 'Not Available'}{'\n'}
              Cache Stats: {getCacheStats().size} profiles cached
            </Text>
          </View>

          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Refresh Flow Timeline</Text>
            <View style={styles.refreshTimelineContainer}>
              {debugLog
                .filter(log => 
                  log.source === 'matches-store' || 
                  log.source === 'usage-store' ||
                  log.source === 'discover-screen' ||
                  log.event.toLowerCase().includes('refresh') ||
                  log.event.toLowerCase().includes('fetch') ||
                  log.event.toLowerCase().includes('profile') ||
                  log.event.toLowerCase().includes('database') ||
                  log.event.toLowerCase().includes('limit') ||
                  log.event.toLowerCase().includes('swipe')
                )
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 20) // Show last 20 relevant entries
                .map((log) => (
                  <View key={log.id} style={styles.refreshTimelineEntry}>
                    <Text style={styles.refreshTimelineTime}>
                      {formatTime(log.timestamp)}
                    </Text>
                    <Text style={[
                      styles.refreshTimelineSource,
                      { color: log.source === 'matches-store' ? Colors.light.tint :
                              log.source === 'usage-store' ? Colors.light.success :
                              log.source === 'discover-screen' ? Colors.light.warning :
                              Colors.light.text }
                    ]}>
                      [{log.source}]
                    </Text>
                    <Text style={[
                      styles.refreshTimelineEvent,
                      { color: log.status === 'error' ? Colors.light.error :
                              log.status === 'success' ? Colors.light.success :
                              log.status === 'warning' ? Colors.light.warning :
                              Colors.light.text }
                    ]}>
                      {log.event}
                    </Text>
                    {log.details && (
                      <Text style={styles.refreshTimelineDetails}>
                        {log.details}
                      </Text>
                    )}
                    {log.data && (
                      <Text style={styles.refreshTimelineData}>
                        Data: {JSON.stringify(log.data, null, 2)}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          </View>

          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Database Query Debug</Text>
            <Text style={styles.debugText}>
              RPC Function: fetch_potential_matches{'\n'}
              Query Parameters:{'\n'}
              - User ID: {user?.id || 'Not available'}{'\n'}
              - Global Discovery: true{'\n'}
              - Limit: 50{'\n'}
              - Offset: 0{'\n'}
              {'\n'}
              Expected Response Flow:{'\n'}
              1. Database RPC execution{'\n'}
              2. Raw profile results returned{'\n'}
              3. Profile validation & processing{'\n'}
              4. Cache population{'\n'}
              5. UI update with new profiles{'\n'}
              {'\n'}
              {databaseTotals && (
                <>
                  Current Database Totals:{'\n'}
                  - Swipes: {databaseTotals.swipe_count}{'\n'}
                  - Matches: {databaseTotals.match_count}{'\n'}
                  - Likes: {databaseTotals.like_count}{'\n'}
                  - Messages: {databaseTotals.message_count}{'\n'}
                  {'\n'}
                </>
              )}
              Check timeline below for:{'\n'}
              - RPC response details (count, timing){'\n'}
              - Profile processing results{'\n'}
              - Rejection reasons if profiles excluded{'\n'}
              - Cache population success/failure
            </Text>
          </View>

          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Live Supabase Response</Text>
            <View style={styles.supabaseResponseContainer}>
              {(() => {
                // Find the most recent database response in debug logs
                const recentDbResponse = debugLog
                  .filter(log => 
                    log.source === 'matches-store' && 
                    (log.event === 'Database RPC response received' || 
                     log.event === 'Empty RPC response' ||
                     log.event === 'Invalid RPC response format' ||
                     log.event === 'Database RPC error')
                  )
                  .sort((a, b) => b.timestamp - a.timestamp)[0];

                if (!recentDbResponse) {
                  return (
                    <Text style={styles.debugText}>
                      No recent database response found.{'\n'}
                      Trigger a refresh to see live Supabase response data.
                    </Text>
                  );
                }

                const isError = recentDbResponse.status === 'error';
                const isWarning = recentDbResponse.status === 'warning';

                return (
                  <View>
                    <Text style={[styles.debugText, { fontWeight: 'bold' }]}>
                      Latest Response ({formatTime(recentDbResponse.timestamp)}):
                    </Text>
                    <Text style={[
                      styles.debugText,
                      { color: isError ? Colors.light.error : 
                               isWarning ? Colors.light.warning : 
                               Colors.light.success }
                    ]}>
                      Status: {recentDbResponse.event}{'\n'}
                      Details: {recentDbResponse.details}{'\n'}
                    </Text>
                    
                    {recentDbResponse.data && (
                      <View style={styles.responseDataContainer}>
                        <Text style={[styles.debugText, { fontWeight: 'bold' }]}>
                          Raw Response Data:
                        </Text>
                        <Text style={styles.responseDataText}>
                          {JSON.stringify(recentDbResponse.data, null, 2)}
                        </Text>
                      </View>
                    )}

                    {/* Show processing results if available */}
                    {(() => {
                      const processingResult = debugLog
                        .filter(log => 
                          log.source === 'matches-store' && 
                          log.event === 'Profile processing completed' &&
                          log.timestamp > recentDbResponse.timestamp - 5000 // Within 5 seconds
                        )
                        .sort((a, b) => b.timestamp - a.timestamp)[0];

                      if (processingResult?.data) {
                        return (
                          <View style={styles.processingResultContainer}>
                            <Text style={[styles.debugText, { fontWeight: 'bold' }]}>
                              Processing Results:
                            </Text>
                            <Text style={styles.debugText}>
                              Processed: {processingResult.data.processedCount || 0}{'\n'}
                              Rejected: {processingResult.data.rejectedCount || 0}{'\n'}
                              {processingResult.data.processedIds && (
                                `Profile IDs: ${processingResult.data.processedIds.slice(0, 3).join(', ')}${processingResult.data.processedIds.length > 3 ? '...' : ''}\n`
                              )}
                              {processingResult.data.rejectedReasons && processingResult.data.rejectedReasons.length > 0 && (
                                `Rejection Reasons: ${processingResult.data.rejectedReasons.join(', ')}\n`
                              )}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>
                );
              })()}
            </View>
          </View>

          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Profile Processing Debug</Text>
            <Text style={styles.debugText}>
              Cache Size: {getCacheStats().size}{'\n'}
              Hit Rate: {(getCacheStats().hitRate * 100).toFixed(1)}%{'\n'}
              Memory Usage: {(getCacheStats().memoryUsage / 1024).toFixed(2)} KB{'\n'}
              
              Recent Profile Processing:{'\n'}
              {profiles.slice(0, 5).map((profile, index) => (
                `${index + 1}. ${profile.name} (ID: ${profile.id})\n`
              )).join('')}
            </Text>
          </View>

          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Limit Checking Debug</Text>
            <Text style={styles.debugText}>
              {usageCache ? (
                <>
                  Current Limits:{'\n'}
                  - Swipe: {usageCache.counts.swipe_count}/10000{'\n'}
                  - Match: {usageCache.counts.match_count}/100{'\n'}
                  - Like: {usageCache.counts.like_count}/50{'\n'}
                  - Message: {usageCache.counts.message_count}/500{'\n'}
                  
                  Last Sync: {formatTime(usageCache.lastSyncTimestamp)}{'\n'}
                  Batch Updates: {batchUpdates.length} pending{'\n'}
                </>
              ) : (
                'Usage cache not initialized'
              )}
            </Text>
          </View>

          <View style={styles.debugSubsection}>
            <Text style={styles.debugSubtitle}>Troubleshooting</Text>
            <Text style={styles.debugText}>
              Common issues to check:{'\n'}
              1. Database connection: {supabase ? 'Connected' : 'Not connected'}{'\n'}
              2. User authentication: {user?.id ? 'Authenticated' : 'Not authenticated'}{'\n'}
              3. Profile cache: {getCacheStats().size > 0 ? 'Has data' : 'Empty'}{'\n'}
              4. Error state: {error || 'No errors'}{'\n'}
              5. Loading state: {isLoading ? 'Currently loading' : 'Not loading'}{'\n'}
              6. Sync status: {isSyncing ? 'Currently syncing' : 'Not syncing'}{'\n'}
              7. Tier settings: {allTierSettings ? 'Cached' : 'Not cached'}{'\n'}
              
              If profiles not showing:{'\n'}
              - Check timeline for RPC response count{'\n'}
              - Look for profile processing rejections{'\n'}
              - Verify cache population completed{'\n'}
              - Check for database query errors{'\n'}
              - Ensure profile validation criteria met{'\n'}
              
              Performance optimizations:{'\n'}
              - Tier settings now cached (24hr TTL){'\n'}
              - Debug logs only in debug mode{'\n'}
              - Detailed timeline shows exact failure points
            </Text>
          </View>

          <Button
            title="Force Refresh Profiles"
            onPress={async () => {
              if (user?.id) {
                await fetchPotentialMatches(true);
              }
            }}
            variant="primary"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16
  },
  section: {
    marginBottom: 24,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 12
  },
  infoBlock: {
    marginBottom: 12
  },
  label: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4
  },
  value: {
    fontSize: 14,
    color: Colors.light.text
  },
  timelineContainer: {
    marginTop: 8
  },
  timelineEntry: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: Colors.light.cardAlt,
    borderRadius: 8
  },
  timelineContent: {
    gap: 4
  },
  timelineTime: {
    fontSize: 12,
    color: Colors.light.textSecondary
  },
  timelineSource: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  timelineMessage: {
    fontSize: 14
  },
  timelineDetails: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4
  },
  notificationsContainer: {
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  notificationItem: {
    color: Colors.dark.text,
    fontSize: 12,
    marginBottom: 4,
  },
  button: {
    marginTop: 16,
    alignSelf: 'center'
  },
  text: {
    marginBottom: 8
  },
  debugSubsection: {
    marginBottom: 16
  },
  debugSubtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8
  },
  debugText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4
  },
  refreshTimelineContainer: {
    marginTop: 8
  },
  refreshTimelineEntry: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: Colors.light.cardAlt,
    borderRadius: 8
  },
  refreshTimelineTime: {
    fontSize: 12,
    color: Colors.light.textSecondary
  },
  refreshTimelineSource: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  refreshTimelineEvent: {
    fontSize: 14
  },
  refreshTimelineDetails: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4
  },
  refreshTimelineData: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4
  },
  supabaseResponseContainer: {
    marginTop: 8
  },
  responseDataContainer: {
    marginTop: 8
  },
  responseDataText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4
  },
  processingResultContainer: {
    marginTop: 8
  }
}); 
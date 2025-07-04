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
    potentialMatches,
    matches,
    isLoading,
    error,
    swipeLimitReached,
    matchLimitReached,
    cacheStats
  } = useMatchesStore();

  const { user, allTierSettings } = useAuthStore();

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
                <Text style={styles.label}>Premium Features:</Text>
                <Text style={styles.value}>
                  Boost Minutes: {usageCache.premiumFeatures.boostMinutesRemaining}{'\n'}
                  Boost Uses: {usageCache.premiumFeatures.boostUsesRemaining}
                </Text>
              </View>

              <View style={styles.infoBlock}>
                <Text style={styles.label}>Analytics:</Text>
                <Text style={styles.value}>
                  Profile Views: {usageCache.analytics.profileViews}{'\n'}
                  Search Appearances: {usageCache.analytics.searchAppearances}
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
              Size: {cacheStats.size}{'\n'}
              Hit Rate: {(cacheStats.hitRate * 100).toFixed(1)}%{'\n'}
              Average Age: {formatDuration(cacheStats.averageAge)}{'\n'}
              Memory Usage: {(cacheStats.memoryUsage / 1024).toFixed(2)} KB{'\n'}
              Compression Ratio: {cacheStats.compressionRatio.toFixed(2)}{'\n'}
              Eviction Count: {cacheStats.evictionCount}
            </Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.label}>Match Counts:</Text>
            <Text style={styles.value}>
              Potential: {potentialMatches.length}{'\n'}
              Matches: {matches.length}{'\n'}
              Loading: {isLoading ? 'Yes' : 'No'}{'\n'}
              Error: {error || 'None'}{'\n'}
              Swipe Limit: {swipeLimitReached ? 'Reached' : 'Available'}{'\n'}
              Match Limit: {matchLimitReached ? 'Reached' : 'Available'}
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

          {allTierSettings && (
            <View style={styles.infoBlock}>
              <Text style={styles.label}>Tier Settings:</Text>
              <Text style={styles.value}>
                {(Object.keys(allTierSettings) as MembershipTier[]).map(tier => (
                  `${tier}:\n${JSON.stringify(allTierSettings[tier], null, 2)}\n`
                ))}
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
  }
}); 
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useUsageStore } from '@/store/usage-store';
import { useMatchesStore } from '@/store/matches-store';
import { useAuthStore } from '@/store/auth-store';
import { useDebugStore } from '@/store/debug-store';
import { MembershipTier, TierSettings } from '@/types/user';

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

        {/* Timeline Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operation Timeline</Text>
          <View style={styles.timelineContainer}>
            {useDebugStore.getState().debugLog
              .filter(log => ['matches-store', 'usage-store', 'discover-screen'].includes(log.source))
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((log, index) => (
                <View key={log.id} style={styles.timelineEntry}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={[
                      styles.timelineStatus,
                      { color: log.status === 'error' ? Colors.dark.error :
                              log.status === 'warning' ? Colors.dark.warning :
                              log.status === 'success' ? Colors.dark.success :
                              Colors.dark.info }
                    ]}>
                      [{log.source}] {log.status.toUpperCase()}
                    </Text>
                    <Text style={styles.timelineEvent}>{log.event}</Text>
                    <Text style={styles.timelineDetails}>{log.details}</Text>
                  </View>
                </View>
              ))
            }
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background
  },
  scrollView: {
    flex: 1,
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 16
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16
  },
  infoBlock: {
    marginBottom: 12
  },
  label: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 4
  },
  value: {
    fontSize: 14,
    color: Colors.dark.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  timelineContainer: {
    paddingLeft: 20,
  },
  timelineEntry: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.accent,
    marginRight: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: Colors.dark.border,
    paddingLeft: 12,
    marginLeft: -6,
  },
  timelineTime: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  timelineStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  timelineEvent: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  timelineDetails: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
}); 
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useDebugStore } from '@/store/debug-store';
import { useAuthStore } from '@/store/auth-store';
import { useUsageStore } from '@/store/usage-store';
import Colors from '@/constants/colors';



export default function DebugScreen() {
  const { isDebugMode, debugLog, clearDebugLog } = useDebugStore();
  const { allTierSettings, tierSettingsTimestamp, user, getTierSettings } = useAuthStore();
  const { usageCache } = useUsageStore();

  // Add current state info to debug log when component mounts
  useEffect(() => {
    if (isDebugMode) {
      // Add current state snapshot
      const debugStore = useDebugStore.getState();
      
      // Check current state
      if (allTierSettings) {
        debugStore.addDebugLog({
          event: 'Current State: allTierSettings',
          status: 'success',
          details: `Currently loaded: ${Object.keys(allTierSettings).length} tier settings`,
          data: Object.keys(allTierSettings),
          source: 'debug-screen'
        });
      }
      
      if (user) {
        debugStore.addDebugLog({
          event: 'Current State: User',
          status: 'success',
          details: `User: ${user.name} (${user.membershipTier})`,
          data: { id: user.id, membershipTier: user.membershipTier },
          source: 'debug-screen'
        });
      }
    }
  }, [isDebugMode, allTierSettings, user]);

  if (!isDebugMode) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Debug Mode</Text>
        <Text style={styles.message}>Debug mode is disabled. Enable it in admin settings to view debugging information.</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'info': return '#2196F3';
      case 'warning': return '#FF9800';
      default: return Colors.dark.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      default: return '•';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Tier Settings Debug</Text>
      
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <Text style={styles.summaryText}>
          • User: {user ? `${user.name} (${user.membershipTier})` : 'Not logged in'}
        </Text>
        <Text style={styles.summaryText}>
          • Tier Settings: {allTierSettings ? `${Object.keys(allTierSettings).length} loaded` : 'Not loaded'}
        </Text>
        <Text style={styles.summaryText}>
          • Usage Cache: {usageCache ? 'Loaded' : 'Not loaded'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Debug Log</Text>
      
      {debugLog.map((log, index) => (
        <View key={log.id} style={styles.logEntry}>
          <View style={styles.logHeader}>
            <Text style={styles.logIcon}>{getStatusIcon(log.status)}</Text>
            <Text style={[styles.logStatus, { color: getStatusColor(log.status) }]}>
              {log.status.toUpperCase()}
            </Text>
            <Text style={styles.logTimestamp}>
              {new Date(log.timestamp).toLocaleTimeString()}
            </Text>
            <Text style={styles.logSource}>[{log.source}]</Text>
          </View>
          
          <Text style={styles.logEvent}>{log.event}</Text>
          <Text style={styles.logDetails}>{log.details}</Text>
          
          {log.data && (
            <View style={styles.logData}>
              <Text style={styles.logDataTitle}>Data:</Text>
              <Text style={styles.logDataText}>
                {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
              </Text>
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={clearDebugLog}
      >
        <Text style={styles.refreshButtonText}>Clear Debug Log</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 50,
  },
  summary: {
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  logEntry: {
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  logTimestamp: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  logSource: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontStyle: 'italic',
    marginLeft: 'auto',
  },
  logEvent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  logDetails: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  logData: {
    backgroundColor: Colors.dark.background,
    padding: 8,
    borderRadius: 4,
  },
  logDataTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  logDataText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  refreshButton: {
    backgroundColor: Colors.dark.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  refreshButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 
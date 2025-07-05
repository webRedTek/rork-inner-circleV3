// @ts-ignore - Types are provided by Expo
import React, { useState, useEffect } from 'react';
// @ts-ignore - Types are provided by Expo
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Clipboard, ActivityIndicator } from 'react-native';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { useUsageStore } from '@/store/usage-store';
import { useAuthStore } from '@/store/auth-store';
// @ts-ignore - Types are provided by Expo
import { Database, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react-native';
import { MembershipTier, TierSettings } from '@/types/user';

interface CacheViewModalProps {
  visible: boolean;
  onClose: () => void;
}

const formatTimeRemaining = (ms: number): string => {
  if (ms <= 0) return '0m';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const CacheViewModal: React.FC<CacheViewModalProps> = ({ visible, onClose }) => {
  const { usageCache, isSyncing, lastSyncError, rateLimits, getDatabaseTotals, getUsageCache, getCurrentUsage } = useUsageStore();
  const { allTierSettings, tierSettingsTimestamp, getTierSettings } = useAuthStore();
  const [collapsedSections, setCollapsedSections] = useState({
    usage: false,
    premium: false,
    analytics: false,
    tier: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Cache store data to prevent setState during render
  const [cachedUsageData, setCachedUsageData] = useState<any>(null);
  const [cachedTierSettings, setCachedTierSettings] = useState<any>(null);
  const [cachedUsageCache, setCachedUsageCache] = useState<any>(null);

  // Load data once when modal opens, not during every render
  useEffect(() => {
    if (visible) {
      setCachedUsageCache(getUsageCache());
      setCachedTierSettings(getTierSettings());
      setCachedUsageData({
        swipe: getCurrentUsage('swipe'),
        match: getCurrentUsage('match'),
        like: getCurrentUsage('like'),
        message: getCurrentUsage('message'),
        boost_minutes: getCurrentUsage('boost_minutes'),
        boost_uses: getCurrentUsage('boost_uses'),
        groups_joined: getCurrentUsage('groups_joined'),
        groups_created: getCurrentUsage('groups_created'),
        events_created: getCurrentUsage('events_created'),
        direct_intro: getCurrentUsage('direct_intro'),
      });
    }
  }, [visible, getUsageCache, getTierSettings, getCurrentUsage]);

  const getDailyLimit = (type: string) => {
    if (!cachedTierSettings) return 'N/A';
    
    switch (type) {
      case 'swipe':
        return cachedTierSettings.daily_swipe_limit || 'N/A';
      case 'match':
        return cachedTierSettings.daily_match_limit || 'N/A';
      case 'like':
        return cachedTierSettings.daily_like_limit || 'N/A';
      case 'message':
        return cachedTierSettings.message_sending_limit || 'N/A';
      default:
        return 'N/A';
    }
  };

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    // Refresh logic here
    setIsLoading(false);
  };

  const handleCopyToClipboard = () => {
    const cacheData = {
      usageCache: cachedUsageCache,
      usageData: cachedUsageData,
      tierSettings: cachedTierSettings,
      timestamp: new Date().toISOString(),
    };
    
    // Copy to clipboard implementation
    console.log('Cache data copied:', cacheData);
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getTimeUntilReset = (resetTimestamp: number) => {
    const now = Date.now();
    const timeLeft = resetTimestamp - now;
    return formatTimeRemaining(timeLeft);
  };

  const renderUsageData = () => {
    if (!cachedUsageCache || !cachedUsageData) return <Text style={styles.noDataText}>No usage data available</Text>;

    const usageTypes = [
      { type: 'swipe', label: 'Swipe' },
      { type: 'match', label: 'Match' },
      { type: 'message', label: 'Message' },
      { type: 'like', label: 'Like' }
    ];
    
    return usageTypes.map(({ type, label }) => {
      const currentCount = cachedUsageData[type] || 0;
      const limit = getDailyLimit(type);
      const isCloseToLimit = typeof limit === 'number' && currentCount >= limit * 0.8;

      return (
        <View key={type} style={styles.row}>
          <Text style={styles.cell}>{label}</Text>
          <Text style={[styles.cell, isCloseToLimit && styles.warningText]}>
            {currentCount} / {limit}
          </Text>
          <Text style={styles.cell}>
            Daily Reset
          </Text>
          <Text style={styles.cell}>
            {formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}
          </Text>
        </View>
      );
    });
  };

  const renderPremiumFeatures = () => {
    if (!cachedUsageData || !cachedUsageCache) return <Text style={styles.noDataText}>No premium data available</Text>;
    
    const boostMinutesUsed = cachedUsageData.boost_minutes || 0;
    const boostUsesCount = cachedUsageData.boost_uses || 0;
    
    return (
      <>
        <View style={styles.row}>
          <Text style={styles.cell}>Boost Minutes Used</Text>
          <Text style={styles.cell}>{boostMinutesUsed}</Text>
          <Text style={styles.cell}>Daily Reset</Text>
          <Text style={styles.cell}>{formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Boost Uses</Text>
          <Text style={styles.cell}>{boostUsesCount}</Text>
          <Text style={styles.cell}>Daily Reset</Text>
          <Text style={styles.cell}>{formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}</Text>
        </View>
      </>
    );
  };

  const renderAnalytics = () => {
    if (!cachedUsageData || !cachedUsageCache) return <Text style={styles.noDataText}>No analytics data available</Text>;
    
    const groupsJoined = cachedUsageData.groups_joined || 0;
    const groupsCreated = cachedUsageData.groups_created || 0;
    const eventsCreated = cachedUsageData.events_created || 0;
    const directIntros = cachedUsageData.direct_intro || 0;
    
    return (
      <>
        <View style={styles.row}>
          <Text style={styles.cell}>Groups Joined</Text>
          <Text style={styles.cell}>{groupsJoined}</Text>
          <Text style={styles.cell}>Daily Reset</Text>
          <Text style={styles.cell}>{formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Groups Created</Text>
          <Text style={styles.cell}>{groupsCreated}</Text>
          <Text style={styles.cell}>Daily Reset</Text>
          <Text style={styles.cell}>{formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Events Created</Text>
          <Text style={styles.cell}>{eventsCreated}</Text>
          <Text style={styles.cell}>Daily Reset</Text>
          <Text style={styles.cell}>{formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Direct Intros</Text>
          <Text style={styles.cell}>{directIntros}</Text>
          <Text style={styles.cell}>Daily Reset</Text>
          <Text style={styles.cell}>{formatTimestamp(cachedUsageCache.lastSyncTimestamp ?? null)}</Text>
        </View>
      </>
    );
  };

  const renderTierSettings = () => {
    if (!cachedTierSettings) return <Text style={styles.noDataText}>No tier settings available</Text>;

    return (
      <>
        <View style={styles.row}>
          <Text style={styles.cell}>Daily Swipe Limit</Text>
          <Text style={styles.cell}>{cachedTierSettings.daily_swipe_limit}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>{formatTimestamp(tierSettingsTimestamp)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Daily Like Limit</Text>
          <Text style={styles.cell}>{cachedTierSettings.daily_like_limit}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>{formatTimestamp(tierSettingsTimestamp)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Daily Match Limit</Text>
          <Text style={styles.cell}>{cachedTierSettings.daily_match_limit}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>{formatTimestamp(tierSettingsTimestamp)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Message Sending Limit</Text>
          <Text style={styles.cell}>{cachedTierSettings.message_sending_limit}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>{formatTimestamp(tierSettingsTimestamp)}</Text>
        </View>
      </>
    );
  };

  const renderSection = (
    title: string,
    key: keyof typeof collapsedSections,
    renderContent: () => React.ReactNode
  ) => {
    const isCollapsed = collapsedSections[key];
    return (
      <View style={styles.section}>
        <TouchableOpacity onPress={() => toggleSection(key)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {isCollapsed ? (
            <ChevronDown size={20} color={Colors.dark.text} />
          ) : (
            <ChevronUp size={20} color={Colors.dark.text} />
          )}
        </TouchableOpacity>
        {!isCollapsed && (
          <View style={styles.sectionContent}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell]}>Item</Text>
              <Text style={[styles.cell, styles.headerCell]}>Count</Text>
              <Text style={[styles.cell, styles.headerCell]}>Reset In</Text>
              <Text style={[styles.cell, styles.headerCell]}>Last Updated</Text>
            </View>
            {renderContent()}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Cache Data Overview</Text>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
            {lastSyncError && (
              <Text style={styles.errorText}>Last Sync Error: {lastSyncError}</Text>
            )}
            {renderSection('Current Session Usage', 'usage', renderUsageData)}
            {renderSection('Premium Features', 'premium', renderPremiumFeatures)}
            {renderSection('Analytics', 'analytics', renderAnalytics)}
            {renderSection('Tier Settings', 'tier', renderTierSettings)}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button
              title="Refresh"
              onPress={handleRefresh}
              variant="primary"
              size="medium"
              icon={<RefreshCw size={18} color={Colors.dark.text} />}
              loading={isLoading || isSyncing}
              style={styles.actionButton}
            />
            <Button
              title="Copy to Clipboard"
              onPress={handleCopyToClipboard}
              variant="outline"
              size="medium"
              icon={<Copy size={18} color={Colors.dark.text} />}
              style={styles.actionButton}
            />
            <Button
              title="Close"
              onPress={onClose}
              variant="danger"
              size="medium"
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.overlay,
  },
  modalContainer: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  scrollView: {
    flexGrow: 1,
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
    backgroundColor: Colors.dark.cardAlt,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  sectionContent: {
    padding: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  headerCell: {
    fontWeight: 'bold',
    color: Colors.dark.textSecondary,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  cell: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  closeToLimit: {
    color: Colors.dark.error,
    fontWeight: 'bold',
  },
  noDataText: {
    color: Colors.dark.textDim,
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  warningText: {
    color: Colors.dark.warning,
    fontWeight: 'bold',
  },
});
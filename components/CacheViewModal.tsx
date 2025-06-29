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

interface CacheViewModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CacheViewModal: React.FC<CacheViewModalProps> = ({ visible, onClose }) => {
  const { usageCache, lastSyncError, isSyncing, syncUsageData } = useUsageStore();
  const { tierSettings, tierSettingsTimestamp, fetchAllTierSettings, user, isLoading } = useAuthStore();
  const [collapsedSections, setCollapsedSections] = useState<{
    usage: boolean;
    premium: boolean;
    analytics: boolean;
    tier: boolean;
  }>({
    usage: false,
    premium: false,
    analytics: false,
    tier: false,
  });

  useEffect(() => {
    if (visible && user) {
      fetchAllTierSettings().catch((error: unknown) => console.error('Error refreshing tier settings:', error));
    }
  }, [visible, user]);

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev: typeof collapsedSections) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRefresh = async () => {
    if (user) {
      await fetchAllTierSettings();
      await syncUsageData(true);
    }
  };

  const handleCopyToClipboard = () => {
    const cacheData = JSON.stringify(
      {
        usageCache,
        tierSettings,
        lastSyncTimestamp: usageCache?.lastSyncTimestamp || 'N/A',
        tierSettingsTimestamp: tierSettingsTimestamp || 'N/A',
        lastSyncError: lastSyncError || 'None',
      },
      null,
      2
    );
    Clipboard.setString(cacheData);
    alert('Cache data copied to clipboard');
  };

  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getTimeUntilReset = (resetTimestamp: number) => {
    const now = Date.now();
    if (resetTimestamp < now) return 'Already reset';
    const diffMs = resetTimestamp - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const renderUsageData = () => {
    if (!usageCache) return <Text style={styles.noDataText}>No usage data available</Text>;

    const usageTypes = ['swipe', 'match', 'message'];
    return usageTypes.map(type => {
      const data = usageCache.usageData[type];
      if (!data) return null;

      const limit = type === 'swipe' 
        ? tierSettings?.daily_swipe_limit || 'N/A'
        : type === 'match'
        ? tierSettings?.daily_match_limit || 'N/A'
        : tierSettings?.message_sending_limit || 'N/A';
      const isCloseToLimit = typeof limit === 'number' && data.currentCount >= limit * 0.8;

      return (
        <View key={type} style={styles.row}>
          <Text style={styles.cell}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
          <Text style={[styles.cell, isCloseToLimit && styles.closeToLimit]}>
            {data.currentCount} / {limit}
          </Text>
          <Text style={styles.cell}>{getTimeUntilReset(data.resetTimestamp)}</Text>
          <Text style={styles.cell}>{formatTimestamp(data.lastActionTimestamp)}</Text>
        </View>
      );
    });
  };

  const renderPremiumFeatures = () => {
    if (!usageCache) return <Text style={styles.noDataText}>No premium data available</Text>;

    const { boostMinutesRemaining, boostUsesRemaining } = usageCache.premiumFeatures;
    return (
      <View style={styles.row}>
        <Text style={styles.cell}>Boost Minutes</Text>
        <Text style={styles.cell}>{boostMinutesRemaining}</Text>
        <Text style={styles.cell}>N/A</Text>
        <Text style={styles.cell}>N/A</Text>
      </View>
    );
  };

  const renderAnalytics = () => {
    if (!usageCache) return <Text style={styles.noDataText}>No analytics data available</Text>;

    const { profileViews, searchAppearances } = usageCache.analytics;
    return (
      <>
        <View style={styles.row}>
          <Text style={styles.cell}>Profile Views</Text>
          <Text style={styles.cell}>{profileViews}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>N/A</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Search Appearances</Text>
          <Text style={styles.cell}>{searchAppearances}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>N/A</Text>
        </View>
      </>
    );
  };

  const renderTierSettings = () => {
    if (!tierSettings) return <Text style={styles.noDataText}>No tier settings available</Text>;

    return (
      <>
        <View style={styles.row}>
          <Text style={styles.cell}>Daily Swipe Limit</Text>
          <Text style={styles.cell}>{tierSettings.daily_swipe_limit}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>{formatTimestamp(tierSettingsTimestamp)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Daily Match Limit</Text>
          <Text style={styles.cell}>{tierSettings.daily_match_limit}</Text>
          <Text style={styles.cell}>N/A</Text>
          <Text style={styles.cell}>{formatTimestamp(tierSettingsTimestamp)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cell}>Message Sending Limit</Text>
          <Text style={styles.cell}>{tierSettings.message_sending_limit}</Text>
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
            {renderSection('Usage Data', 'usage', renderUsageData)}
            {renderSection('Premium Features', 'premium', renderPremiumFeatures)}
            {renderSection('Analytics', 'analytics', renderAnalytics)}
            {renderSection('Tier Settings & Limits', 'tier', renderTierSettings)}
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
});
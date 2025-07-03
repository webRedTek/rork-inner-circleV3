import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useDebugStore } from '@/store/debug-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { Shield } from 'lucide-react-native';
import { MembershipTier } from '@/types/user';
import { handleError } from '@/utils/error-utils';
import { useNotificationStore } from '@/store/notification-store';

/**
 * Admin Settings Screen
 * @rork Please update this component to fix the settings saving functionality
 * Last updated: 2025-07-01
 */
export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user, invalidateTierSettingsCache } = useAuthStore();
  const { isDebugMode, setDebugMode } = useDebugStore();
  const { addNotification } = useNotificationStore();
  const [settingsByTier, setSettingsByTier] = useState<Record<MembershipTier, Record<string, any>>>({
    bronze: {},
    silver: {},
    gold: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      router.replace('/(tabs)/profile');
      return;
    }
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      const { data, error: settingsError } = await supabase
        .from('app_settings')
        .select('*');

      if (settingsError) {
        const appError = handleError(settingsError);
        throw new Error(`Failed to fetch settings: ${appError.userMessage}`);
      }

      if (data && data.length > 0) {
        const settingsMap: Record<MembershipTier, Record<string, any>> = {
          bronze: {},
          silver: {},
          gold: {}
        };
        data.forEach(setting => {
          if (setting.tier in settingsMap) {
            settingsMap[setting.tier as MembershipTier] = setting;
          }
        });
        setSettingsByTier(settingsMap);
      } else {
        setError('No settings found.');
      }
    } catch (err) {
      const appError = handleError(err);
      setError(appError.userMessage);
      addNotification({
        type: 'error',
        message: `Failed to load settings: ${appError.userMessage}`,
        displayStyle: 'toast',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (tier: MembershipTier, key: string, value: any) => {
    setSettingsByTier(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      console.log('Saving settings for tiers:', Object.keys(settingsByTier));
      
      for (const tier in settingsByTier) {
        const tierKey = tier as MembershipTier;
        const settings = settingsByTier[tierKey];
        console.log(`Processing tier: ${tier}`, settings);
        
        // Validate numeric fields
        const numericFields = [
          'dailySwipeLimit',
          'dailyMatchLimit',
          'dailyLikeLimit',
          'messageSendingLimit',
          'boostDuration',
          'boostFrequency',
          'groupsLimit',
          'groupsCreationLimit',
          'featuredPortfolioLimit',
          'eventsPerMonth',
          'trialDuration'
        ];
        
        for (const field of numericFields) {
          const value = settings[field];
          if (value !== undefined && (isNaN(value) || value < 0)) {
            throw new Error(`Invalid value for ${field} in ${tier} tier. Must be a positive number.`);
          }
        }
        
        // Match schema exactly
        const settingsToSave = {
          tier: tierKey,
          dailySwipeLimit: parseInt(settings.dailySwipeLimit) || 0,
          dailyMatchLimit: parseInt(settings.dailyMatchLimit) || 0,
          dailyLikeLimit: parseInt(settings.dailyLikeLimit) || 0,
          messageSendingLimit: parseInt(settings.messageSendingLimit) || 0,
          canSeeWhoLikedYou: Boolean(settings.canSeeWhoLikedYou),
          canRewindLastSwipe: Boolean(settings.canRewindLastSwipe),
          boostDuration: parseInt(settings.boostDuration) || 0,
          boostFrequency: parseInt(settings.boostFrequency) || 0,
          profileVisibilityControl: Boolean(settings.profileVisibilityControl),
          priorityListing: Boolean(settings.priorityListing),
          premiumFiltersAccess: Boolean(settings.premiumFiltersAccess),
          globalDiscovery: Boolean(settings.globalDiscovery),
          groupsLimit: parseInt(settings.groupsLimit) || 1,
          groupsCreationLimit: parseInt(settings.groupsCreationLimit) || 0,
          featuredPortfolioLimit: parseInt(settings.featuredPortfolioLimit) || 1,
          eventsPerMonth: parseInt(settings.eventsPerMonth) || 0,
          hasBusinessVerification: Boolean(settings.hasBusinessVerification),
          hasAdvancedAnalytics: Boolean(settings.hasAdvancedAnalytics),
          hasPriorityInbox: Boolean(settings.hasPriorityInbox),
          canSendDirectIntro: Boolean(settings.canSendDirectIntro),
          hasVirtualMeetingRoom: Boolean(settings.hasVirtualMeetingRoom),
          hasCustomBranding: Boolean(settings.hasCustomBranding),
          hasDedicatedSupport: Boolean(settings.hasDedicatedSupport),
          canCreateGroups: Boolean(settings.canCreateGroups),
          trialDuration: parseInt(settings.trialDuration) || 14,
          updatedAt: new Date().toISOString()
        };
        
        try {
          if (settings.id) {
            console.log(`Updating settings for tier ${tier} with ID: ${settings.id}`);
            const { error: updateError } = await supabase
              .from('app_settings')
              .update(settingsToSave)
              .eq('id', settings.id);

            if (updateError) {
              const appError = handleError(updateError);
              throw new Error(`Failed to update settings for ${tier}: ${appError.userMessage}`);
            }
          } else {
            console.log(`Inserting new settings for tier ${tier}`);
            const { error: insertError } = await supabase
              .from('app_settings')
              .insert({
                ...settingsToSave,
                created_at: new Date().toISOString()
              });

            if (insertError) {
              const appError = handleError(insertError);
              throw new Error(`Failed to insert settings for ${tier}: ${appError.userMessage}`);
            }
          }
        } catch (dbError: any) {
          console.error(`Database error for tier ${tier}:`, dbError);
          const appError = handleError(dbError);
          throw new Error(`Failed to save settings for ${tier}: ${appError.userMessage}`);
        }
      }

      // Invalidate tier settings cache after successful save
      await invalidateTierSettingsCache();

      addNotification({
        type: 'success',
        message: 'Settings updated successfully',
        displayStyle: 'toast',
        duration: 3000
      });

      console.log('Settings saved successfully, refreshing data...');
      await fetchSettings(); // Refresh settings after save
    } catch (err) {
      console.error('Error saving settings:', err);
      const appError = handleError(err);
      setError(appError.userMessage);
      
      addNotification({
        type: 'error',
        message: `Failed to save settings: ${appError.userMessage}`,
        displayStyle: 'toast',
        duration: 8000
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Retry"
          onPress={fetchSettings}
          variant="outline"
          size="large"
          style={styles.retryButton}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Shield size={24} color={Colors.dark.primary} style={styles.icon} />
          <Text style={styles.title}>Admin Settings</Text>
          <Text style={styles.subtitle}>Configure app-wide settings and limits for each tier</Text>
        </View>

        {Object.keys(settingsByTier).map(tier => (
          <View key={tier} style={styles.tierSection}>
            <Text style={styles.tierTitle}>{tier.charAt(0).toUpperCase() + tier.slice(1)} Tier Settings</Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Usage Limits</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Daily Swipe Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.dailySwipeLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'dailySwipeLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Daily Match Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.dailyMatchLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'dailyMatchLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Daily Like Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.dailyLikeLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'dailyLikeLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Message Sending Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.messageSendingLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'messageSendingLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Feature Flags</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Can See Who Liked You</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.canSeeWhoLikedYou || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'canSeeWhoLikedYou', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Can Rewind Last Swipe</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.canRewindLastSwipe || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'canRewindLastSwipe', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Profile Visibility Control</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.profileVisibilityControl || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'profileVisibilityControl', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Priority Listing</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.priorityListing || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'priorityListing', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Premium Filters Access</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.premiumFiltersAccess || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'premiumFiltersAccess', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Global Discovery</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.globalDiscovery || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'globalDiscovery', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Boost Settings</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Boost Duration (minutes)</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.boostDuration?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'boostDuration', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Boost Frequency (hours)</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.boostFrequency?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'boostFrequency', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group Settings</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Groups Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.groupsLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'groupsLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Groups Creation Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.groupsCreationLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'groupsCreationLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Portfolio Settings</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Featured Portfolio Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.featuredPortfolioLimit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'featuredPortfolioLimit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event Settings</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Events Per Month</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.eventsPerMonth?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'eventsPerMonth', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Business Features</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Can Create Groups</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.canCreateGroups || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'canCreateGroups', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Has Business Verification</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.hasBusinessVerification || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'hasBusinessVerification', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Has Advanced Analytics</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.hasAdvancedAnalytics || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'hasAdvancedAnalytics', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Has Priority Inbox</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.hasPriorityInbox || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'hasPriorityInbox', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Can Send Direct Intro</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.canSendDirectIntro || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'canSendDirectIntro', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Has Virtual Meeting Room</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.hasVirtualMeetingRoom || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'hasVirtualMeetingRoom', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Has Custom Branding</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.hasCustomBranding || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'hasCustomBranding', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Has Dedicated Support</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.hasDedicatedSupport || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'hasDedicatedSupport', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trial Settings</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Trial Duration (Days)</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.trialDuration?.toString() || '14'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'trialDuration', parseInt(text) || 14)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
          </View>
        ))}
        
        <View style={styles.tierSection}>
          <Text style={styles.tierTitle}>Debug Settings</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Development Tools</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Debug Mode</Text>
              <Text style={styles.settingDescription}>Enable debug logging and UI elements for troubleshooting</Text>
              <Switch
                value={isDebugMode}
                onValueChange={setDebugMode}
                trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                thumbColor={Colors.dark.background}
              />
            </View>
          </View>
        </View>
        
        <Button
          title="Save Changes"
          onPress={handleSave}
          variant="primary"
          size="large"
          style={styles.saveButton}
          loading={saving}
        />
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
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  icon: {
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  tierSection: {
    marginBottom: 24,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
  },
  tierTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    flex: 1,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 2,
  },
  numberInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    padding: 12,
    color: Colors.dark.text,
    fontSize: 16,
    textAlign: 'right',
    minWidth: 120,
  },
  saveButton: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    width: 200,
  },
});
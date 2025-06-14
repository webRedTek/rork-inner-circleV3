import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';
import { Shield } from 'lucide-react-native';
import { MembershipTier } from '@/types/user';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [settingsByTier, setSettingsByTier] = useState<Record<MembershipTier, Record<string, any>>>({
    basic: {},
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
        throw new Error(`Failed to fetch settings: ${settingsError.message}`);
      }

      if (data && data.length > 0) {
        const settingsMap: Record<MembershipTier, Record<string, any>> = {
          basic: {},
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
      setError(err instanceof Error ? err.message : 'Failed to load settings. Please try again.');
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
      
      for (const tier in settingsByTier) {
        const settings = settingsByTier[tier as MembershipTier];
        if (settings.id) {
          const { error: updateError } = await supabase
            .from('app_settings')
            .update(settings)
            .eq('id', settings.id);

          if (updateError) {
            throw new Error(`Failed to update settings for ${tier}: ${updateError.message}`);
          }
        }
      }

      Alert.alert('Success', 'Settings updated successfully.', [{ text: 'OK' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings. Please try again.');
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
                  value={settingsByTier[tier as MembershipTier]?.daily_swipe_limit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'daily_swipe_limit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Daily Match Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.daily_match_limit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'daily_match_limit', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Message Sending Limit</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.message_sending_limit?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'message_sending_limit', parseInt(text) || 0)}
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
                  value={settingsByTier[tier as MembershipTier]?.can_see_who_liked_you || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'can_see_who_liked_you', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Can Rewind Last Swipe</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.can_rewind_last_swipe || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'can_rewind_last_swipe', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Profile Visibility Control</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.profile_visibility_control || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'profile_visibility_control', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Priority Listing</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.priority_listing || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'priority_listing', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Premium Filters Access</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.premium_filters_access || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'premium_filters_access', value)}
                  trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
                  thumbColor={Colors.dark.background}
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Global Discovery</Text>
                <Switch
                  value={settingsByTier[tier as MembershipTier]?.global_discovery || false}
                  onValueChange={value => handleSettingChange(tier as MembershipTier, 'global_discovery', value)}
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
                  value={settingsByTier[tier as MembershipTier]?.boost_duration?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'boost_duration', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Boost Frequency (hours)</Text>
                <TextInput
                  style={styles.numberInput}
                  value={settingsByTier[tier as MembershipTier]?.boost_frequency?.toString() || '0'}
                  onChangeText={text => handleSettingChange(tier as MembershipTier, 'boost_frequency', parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="Enter number"
                />
              </View>
            </View>
						<View style={styles.section}>
  <Text style={styles.sectionTitle}>Business Features</Text>
  
  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Groups Limit</Text>
    <TextInput
      style={styles.numberInput}
      value={settings.groups_limit?.toString() || '1'}
      onChangeText={text => handleSettingChange('groups_limit', parseInt(text) || 1)}
      keyboardType="numeric"
      placeholder="Enter number"
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Featured Portfolio Limit</Text>
    <TextInput
      style={styles.numberInput}
      value={settings.featured_portfolio_limit?.toString() || '1'}
      onChangeText={text => handleSettingChange('featured_portfolio_limit', parseInt(text) || 1)}
      keyboardType="numeric"
      placeholder="Enter number"
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Events Per Month</Text>
    <TextInput
      style={styles.numberInput}
      value={settings.events_per_month?.toString() || '0'}
      onChangeText={text => handleSettingChange('events_per_month', parseInt(text) || 0)}
      keyboardType="numeric"
      placeholder="Enter number"
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Can Create Events</Text>
    <Switch
      value={settings.can_create_events || false}
      onValueChange={value => handleSettingChange('can_create_events', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Business Verification</Text>
    <Switch
      value={settings.has_business_verification || false}
      onValueChange={value => handleSettingChange('has_business_verification', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Advanced Analytics</Text>
    <Switch
      value={settings.has_advanced_analytics || false}
      onValueChange={value => handleSettingChange('has_advanced_analytics', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Priority Inbox</Text>
    <Switch
      value={settings.has_priority_inbox || false}
      onValueChange={value => handleSettingChange('has_priority_inbox', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Direct Introductions</Text>
    <Switch
      value={settings.can_send_direct_intro || false}
      onValueChange={value => handleSettingChange('can_send_direct_intro', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Virtual Meeting Room</Text>
    <Switch
      value={settings.has_virtual_meeting_room || false}
      onValueChange={value => handleSettingChange('has_virtual_meeting_room', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Custom Branding</Text>
    <Switch
      value={settings.has_custom_branding || false}
      onValueChange={value => handleSettingChange('has_custom_branding', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>

  <View style={styles.settingItem}>
    <Text style={styles.settingLabel}>Dedicated Support</Text>
    <Switch
      value={settings.has_dedicated_support || false}
      onValueChange={value => handleSettingChange('has_dedicated_support', value)}
      trackColor={{ false: Colors.dark.textSecondary, true: Colors.dark.primary }}
      thumbColor={Colors.dark.background}
    />
  </View>
</View>
          </View>
        ))}
        
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
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { ProfileHeader } from '@/components/ProfileHeader';
import { ProfileDetailCard } from '@/components/ProfileDetailCard';
import { SupabaseStatus } from '@/components/SupabaseStatus';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Settings, Edit, LogOut, Database, RefreshCw, MapPin, Shield, Gift } from 'lucide-react-native';
import { useMatchesStore } from '@/store/matches-store';
import { useUsageStore } from '@/store/usage-store';
import { useGroupsStore } from '@/store/groups-store';
import { useMessagesStore } from '@/store/messages-store';
import { useAffiliateStore } from '@/store/affiliate-store';
import { CacheViewModal } from '@/components/CacheViewModal';
import { handleError, ErrorCategory, ErrorCodes } from '@/utils/error-utils';

/**
 * FILE: app/(tabs)/profile.tsx
 * LAST UPDATED: 2024-12-20 10:30
 * 
 * CURRENT STATE:
 * Profile screen component that displays user profile information and settings.
 * Shows membership tier benefits and allows access to admin settings for admins.
 * Uses cached tier settings from auth store for displaying tier benefits.
 * 
 * RECENT CHANGES:
 * - Removed all calls to non-existent getMatches() function
 * - Modified to use cached tier settings from auth store instead of getTierSettings()
 * - Improved error handling for missing tier settings
 * - Maintains compatibility with existing profile functionality
 * - Fixed profile saving functionality to use existing state
 * 
 * FILE INTERACTIONS:
 * - Imports from: user types (UserProfile, MembershipTier)
 * - Imports from: auth-store (user data, tier settings access)
 * - Imports from: debug-store (debug mode toggle)
 * - Imports from: components (Button, CacheViewModal)
 * - Exports to: Tab navigation
 * - Dependencies: expo-router, react-native components
 * - Data flow: Displays user profile and tier data from stores
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - handleAdminSettings: Navigate to admin settings
 * - handleViewCache: Show cache modal
 * - handleClearCache: Clear all app caches
 * - Display tier benefits based on user's membership
 */

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, clearCache, isLoading } = useAuthStore();
  const { resetCacheAndState, fetchPotentialMatches } = useMatchesStore();
  const { resetUsageCache } = useUsageStore();
  const { resetGroupsCache } = useGroupsStore();
  const { resetMessagesCache } = useMessagesStore();
  const { resetAffiliateCache } = useAffiliateStore();
  const [isSupabaseReady, setIsSupabaseReady] = useState<boolean | null>(null);
  const [isCacheModalVisible, setIsCacheModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSupabaseStatus();
  }, []);

  const checkSupabaseStatus = async () => {
    try {
      const configured = isSupabaseConfigured();
      setIsSupabaseReady(configured);
      if (!configured) {
        throw {
          category: ErrorCategory.DATABASE,
          code: ErrorCodes.DB_CONNECTION_ERROR,
          message: 'Supabase is not configured'
        };
      }
    } catch (err) {
      const appError = handleError(err);
      setError(appError.userMessage);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)');
            } catch (err) {
              const appError = handleError(err);
              Alert.alert('Error', appError.userMessage);
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const handleMembership = () => {
    router.push('/membership');
  };

  const handleAffiliateDashboard = () => {
    router.push('/affiliate-dashboard');
  };

  const handleSupabaseSetup = () => {
    router.push('/supabase-setup');
  };

  const handleAdminSettings = () => {
    router.push('/admin-settings');
  };

  const handleViewCache = () => {
    setIsCacheModalVisible(true);
  };

  const handleClearCache = async () => {
    try {
      await clearCache();
      await resetCacheAndState();
      await resetUsageCache();
      await resetGroupsCache();
      await resetMessagesCache();
      await resetAffiliateCache();
      Alert.alert('Success', 'Cache cleared successfully');
    } catch (err) {
      const appError = handleError(err);
      Alert.alert('Error', appError.userMessage);
    }
  };

  const handleRefreshMatches = async () => {
    try {
      if (user) {
        await fetchPotentialMatches(); // Force refresh - uses store method
        Alert.alert('Success', 'Matches refreshed successfully');
      }
    } catch (err) {
      const appError = handleError(err);
      Alert.alert('Error', appError.userMessage);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // Get current user's tier settings
  const { allTierSettings } = useAuthStore.getState();
  const tierSettings = user && allTierSettings ? allTierSettings[user.membershipTier] : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ProfileHeader />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bio}>{user.bio || 'No bio provided yet.'}</Text>
        </View>
        
        <ProfileDetailCard
          title="Entrepreneur Status"
          content={user.entrepreneurStatus === 'current' ? 'Current Entrepreneur' : 'Upcoming Entrepreneur'}
        />
        
        <ProfileDetailCard
          title="Business Stage"
          content={user.businessStage || 'Not specified'}
        />
        
        {user.lookingFor && user.lookingFor.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Looking For</Text>
            <View style={styles.tagContainer}>
              {user.lookingFor.map((item, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {user.skillsOffered && user.skillsOffered.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills Offered</Text>
            <View style={styles.tagContainer}>
              {user.skillsOffered.map((skill, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {user.skillsSeeking && user.skillsSeeking.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills Seeking</Text>
            <View style={styles.tagContainer}>
              {user.skillsSeeking.map((skill, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {user.keyChallenge && (
          <ProfileDetailCard
            title="Current Key Challenge"
            content={user.keyChallenge}
          />
        )}
        
        {user.successHighlight && (
          <ProfileDetailCard
            title="Success Highlight"
            content={user.successHighlight}
          />
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Preferences</Text>
          <View style={styles.locationContainer}>
            <View style={styles.locationItem}>
              <MapPin size={18} color={Colors.dark.accent} />
              <Text style={styles.locationValue}>{user.location || 'Not set'}</Text>
            </View>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Max Distance:</Text>
              <Text style={styles.locationValue}>{user.preferredDistance || 50} km</Text>
            </View>
            <View style={styles.locationItem}>
              <Text style={styles.locationLabel}>Privacy:</Text>
              <Text style={styles.locationValue}>
                {user.locationPrivacy === 'public' ? 'Public' : 
                 user.locationPrivacy === 'matches_only' ? 'Matches Only' : 'Hidden'}
              </Text>
            </View>
          </View>
        </View>
        
        {tierSettings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Membership Benefits</Text>
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitValue}>{tierSettings.daily_swipe_limit}</Text>
                <Text style={styles.benefitLabel}>Daily Swipes</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitValue}>{tierSettings.daily_match_limit}</Text>
                <Text style={styles.benefitLabel}>Daily Matches</Text>
              </View>
              <View style={styles.benefitItem}>
                <Text style={styles.benefitValue}>{tierSettings.message_sending_limit}</Text>
                <Text style={styles.benefitLabel}>Messages</Text>
              </View>
            </View>
          </View>
        )}
        
        {user.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Data</Text>
            <Text style={styles.sectionTitle}>Supabase Status</Text>
            <SupabaseStatus />
            <Button
              title="Configure Supabase"
              onPress={handleSupabaseSetup}
              variant="outline"
              size="large"
              icon={<Database size={18} color={Colors.dark.text} />}
              style={styles.adminButton}
            />
            <Button
              title="View Cache"
              onPress={handleViewCache}
              variant="outline"
              size="large"
              icon={<Database size={18} color={Colors.dark.text} />}
              style={styles.adminButton}
            />
            <Button
              title="Admin Settings"
              onPress={handleAdminSettings}
              variant="outline"
              size="large"
              icon={<Shield size={18} color={Colors.dark.primary} />}
              style={styles.adminButton}
            />
            <Button
              title="Refresh Matches"
              onPress={handleRefreshMatches}
              variant="outline"
              size="large"
              icon={<RefreshCw size={18} color={Colors.dark.accent} />}
              style={styles.adminButton}
            />
            <Button
              title="Clear Cache & Restart"
              onPress={handleClearCache}
              variant="danger"
              size="large"
              icon={<RefreshCw size={18} color={Colors.dark.error} />}
              style={styles.clearCacheButton}
              loading={isLoading}
            />
          </View>
        )}
        
        <View style={styles.bottomActions}>
          <Button
            title="Edit Profile"
            onPress={handleEditProfile}
            variant="outline"
            size="large"
            icon={<Edit size={18} color={Colors.dark.text} />}
            style={styles.actionButton}
          />
          <Button
            title="Membership"
            onPress={handleMembership}
            variant="outline"
            size="large"
            icon={<Settings size={18} color={Colors.dark.text} />}
            style={styles.actionButton}
          />
          {(user.membershipTier === 'silver' || user.membershipTier === 'gold') && (
            <Button
              title="Affiliate Dashboard"
              onPress={handleAffiliateDashboard}
              variant="outline"
              size="large"
              icon={<Gift size={18} color={Colors.dark.text} />}
              style={styles.actionButton}
            />
          )}
          <Button
            title="Log Out"
            onPress={handleLogout}
            variant="danger"
            size="large"
            icon={<LogOut size={18} color={Colors.dark.error} />}
            style={styles.logoutButton}
            loading={isLoading}
          />
        </View>
      </ScrollView>
      <CacheViewModal visible={isCacheModalVisible} onClose={() => setIsCacheModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  bio: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    lineHeight: 24,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: Colors.dark.accent + '30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: Colors.dark.accent,
    fontSize: 14,
  },
  locationContainer: {
    marginTop: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginRight: 8,
    width: 100,
  },
  locationValue: {
    fontSize: 14,
    color: Colors.dark.text,
    flex: 1,
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  benefitItem: {
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  benefitValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.accent,
    marginBottom: 4,
  },
  benefitLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  bottomActions: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 32,
  },
  actionButton: {
    marginBottom: 16,
  },
  adminButton: {
    marginHorizontal: 0,
    marginBottom: 16,
  },
  clearCacheButton: {
    marginTop: 8,
    marginBottom: 0,
  },
  logoutButton: {
    marginBottom: 0,
  },
});
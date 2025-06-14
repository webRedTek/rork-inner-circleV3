import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { ProfileDetailCard } from '@/components/ProfileDetailCard';
import { SupabaseStatus } from '@/components/SupabaseStatus';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Settings, Edit, LogOut, Database, RefreshCw, MapPin, Shield, Gift } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, tierSettings, logout, clearCache, isLoading } = useAuthStore();
  const [isSupabaseReady, setIsSupabaseReady] = useState<boolean | null>(null);

  useEffect(() => {
    checkSupabaseStatus();
  }, []);

  const checkSupabaseStatus = async () => {
    const configured = isSupabaseConfigured();
    setIsSupabaseReady(configured);
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
            await logout();
            router.replace('/(auth)');
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

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache & Restart',
      'Are you sure you want to clear the app cache? This will log you out and reset the app to its initial state.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear & Restart',
          onPress: async () => {
            await clearCache();
            router.replace('/(auth)');
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {user.photoUrl ? (
                <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>{user.name.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.membershipBadge}>
                <Text style={styles.membershipText}>{user.membershipTier}</Text>
              </View>
            </View>
            
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.businessField}>{user.businessField}</Text>
              <Text style={styles.location}>{user.location || 'No location set'}</Text>
            </View>
          </View>
          
          <View style={styles.actions}>
            <Button
              title="Edit Profile"
              onPress={handleEditProfile}
              variant="outline"
              size="small"
              icon={<Edit size={16} color={Colors.dark.text} />}
              style={styles.actionButton}
            />
            <Button
              title="Membership"
              onPress={handleMembership}
              variant="outline"
              size="small"
              icon={<Settings size={16} color={Colors.dark.text} />}
              style={styles.actionButton}
            />
            {(user.membershipTier === 'silver' || user.membershipTier === 'gold') && (
              <Button
                title="Affiliate Dashboard"
                onPress={handleAffiliateDashboard}
                variant="outline"
                size="small"
                icon={<Gift size={16} color={Colors.dark.text} />}
                style={styles.actionButton}
              />
            )}
          </View>
        </View>
        
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
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supabase Status</Text>
          <SupabaseStatus />
        </View>
        
        {user.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Data</Text>
            <Button
              title="Configure Supabase"
              onPress={handleSupabaseSetup}
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
        
        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="danger"
          size="large"
          icon={<LogOut size={18} color={Colors.dark.error} />}
          style={styles.logoutButton}
          loading={isLoading}
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
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  membershipBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  membershipText: {
    color: Colors.dark.text,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  businessField: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
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
  supabaseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  supabaseButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  adminButton: {
    marginHorizontal: 0,
    marginBottom: 16,
  },
  clearCacheButton: {
    marginTop: 8,
    marginBottom: 0,
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
});
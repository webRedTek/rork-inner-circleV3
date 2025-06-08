import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { ProfileHeader } from '@/components/ProfileHeader';
import { Button } from '@/components/Button';
import { UserProfile } from '@/types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [recentMatches, setRecentMatches] = useState<UserProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    fetchRecentMatches();
  }, []);
  
  const fetchRecentMatches = async () => {
    try {
      setRefreshing(true);
      
      // Get matches from storage
      const mockMatches = await AsyncStorage.getItem('mockMatches');
      const matches = mockMatches ? JSON.parse(mockMatches) : [];
      
      // Filter matches for the current user
      const userMatches = matches.filter((match: any) => 
        match.userId === user?.id || match.matchedUserId === user?.id
      );
      
      // Get matched user IDs
      const matchedUserIds = userMatches.map((match: any) => 
        match.userId === user?.id ? match.matchedUserId : match.userId
      );
      
      // Get user profiles
      const mockUsers = await AsyncStorage.getItem('mockUsers');
      const users = mockUsers ? JSON.parse(mockUsers) : [];
      
      // Filter users by matched IDs and remove passwords
      const matchedUsers = users
        .filter((u: any) => matchedUserIds.includes(u.id))
        .map(({ password, ...user }: any) => user);
      
      setRecentMatches(matchedUsers);
    } catch (error) {
      console.error('Failed to fetch recent matches', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  const onRefresh = () => {
    fetchRecentMatches();
  };
  
  if (!user) return null;
  
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.accent}
            colors={[Colors.dark.accent]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user.name}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <ProfileHeader 
            profile={user} 
            onPress={() => router.push('/profile')}
          />
          
          <View style={styles.membershipCard}>
            <View>
              <Text style={styles.membershipTitle}>
                {user.membershipTier === 'basic' ? 'Basic Membership' : 
                 user.membershipTier === 'silver' ? 'Silver Membership' : 
                 'Gold Membership'}
              </Text>
              <Text style={styles.membershipDescription}>
                {user.membershipTier === 'basic' ? 'Upgrade to unlock more features' : 
                 user.membershipTier === 'silver' ? 'Join 1 group and create a basic portfolio' : 
                 'Full access to all Inner Circle features'}
              </Text>
            </View>
            
            {user.membershipTier !== 'gold' && (
              <Button
                title="Upgrade"
                onPress={() => router.push('/membership')}
                variant="outline"
                size="small"
              />
            )}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Connections</Text>
          
          {recentMatches.length > 0 ? (
            recentMatches.map(match => (
              <ProfileHeader 
                key={match.id}
                profile={match}
                onPress={() => router.push(`/profile/${match.id}`)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No connections yet. Start discovering entrepreneurs!
              </Text>
              <Button
                title="Discover Now"
                onPress={() => router.push('/discover')}
                variant="primary"
                size="medium"
                style={styles.discoverButton}
              />
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.actionButtons}>
            <Button
              title="Discover"
              onPress={() => router.push('/discover')}
              variant="primary"
              size="medium"
              style={styles.actionButton}
            />
            
            <Button
              title="Messages"
              onPress={() => router.push('/messages')}
              variant="secondary"
              size="medium"
              style={styles.actionButton}
            />
          </View>
        </View>
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
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  membershipCard: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membershipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  membershipDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    maxWidth: '80%',
  },
  emptyState: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  discoverButton: {
    minWidth: 150,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
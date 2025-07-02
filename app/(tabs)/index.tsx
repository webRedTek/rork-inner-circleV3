import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { ProfileHeader } from '@/components/ProfileHeader';
import { Button } from '@/components/Button';
import { MatchWithProfile } from '@/types/user';
import { useMatchesStore } from '@/store/matches-store';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isReady } = useAuthStore();
  const { matches, fetchMatches } = useMatchesStore();
  const [recentMatches, setRecentMatches] = useState<MatchWithProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  useEffect(() => {
    if (isReady && user) {
      fetchRecentMatches();
      setInitialLoad(false);
    }
  }, [isReady, user]);
  
  const fetchRecentMatches = async () => {
    if (!user) return; // Silent fail if no user
    
    try {
      setRefreshing(true);
      await fetchMatches(); // Use fetchMatches instead of getMatches
      setRecentMatches(matches.slice(0, 5)); // Limit to 5 recent matches
    } catch (error) {
      console.error('Failed to fetch recent matches', error);
      setRecentMatches([]);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Update recent matches when matches state changes
  useEffect(() => {
    if (matches && matches.length > 0) {
      setRecentMatches(matches.slice(0, 5));
    }
  }, [matches]);
  
  const onRefresh = () => {
    if (user) {
      fetchRecentMatches();
    }
  };
  
  if (!isReady || initialLoad) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }
  
  if (!user) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['bottom']}>
        <Text style={styles.errorText}>Not authenticated</Text>
        <Button
          title="Login"
          onPress={() => router.replace('/(auth)')}
          variant="primary"
          style={styles.retryButton}
        />
      </SafeAreaView>
    );
  }
  
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
            onPress={() => router.push('/edit-profile')}
          />
          
          <View style={styles.membershipCard}>
            <View>
              <Text style={styles.membershipTitle}>
                {user.membershipTier === 'bronze' ? 'Bronze Membership' : 
                 user.membershipTier === 'silver' ? 'Silver Membership' : 
                 'Gold Membership'}
              </Text>
              <Text style={styles.membershipDescription}>
                {user.membershipTier === 'bronze' ? 'Upgrade to unlock more features' : 
                 user.membershipTier === 'silver' ? 'Join groups and create portfolios' : 
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
              match.matched_user_profile ? (
                <ProfileHeader 
                  key={match.match_id}
                  profile={match.matched_user_profile}
                  onPress={() => router.push(`/profile/${match.matched_user_id}`)}
                />
              ) : null
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No connections yet. Start discovering entrepreneurs!
              </Text>
              <Button
                title="Discover Now"
                onPress={() => router.push('/(tabs)/discover')}
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
              onPress={() => router.push('/(tabs)/discover')}
              variant="primary"
              size="medium"
              style={styles.actionButton}
            />
            
            <Button
              title="Messages"
              onPress={() => router.push('/(tabs)/messages')}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 150,
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
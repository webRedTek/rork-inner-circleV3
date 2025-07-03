import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { RefreshCw } from 'lucide-react-native';

interface User {
  id: string;
  name: string;
  bio: string;
  photo_url: string;
  business_stage: string;
  industry_focus: string;
  location: string;
  business_field: string;
  entrepreneur_status: string;
  membership_tier: string;
  business_verified: boolean;
}

export default function DiscoveryScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchUsers = async () => {
    if (!user?.id || !supabase) {
      setError('User not authenticated');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      console.log('Calling fetch_potential_matches function with user:', user.id);
      
      const { data, error } = await supabase.rpc('fetch_potential_matches', {
        p_user_id: user.id,
        p_limit: 15,
        p_max_distance: 50,
        p_is_global_discovery: false
      });

      if (error) {
        console.error('Error fetching users:', error);
        setError(`Error fetching users: ${error.message || 'Unknown error'}`);
        return;
      }

      console.log('Received data:', data);
      
      if (data && data.matches && data.matches.length > 0) {
        setUsers(data.matches);
        setNoMoreProfiles(false);
      } else {
        setUsers([]);
        setNoMoreProfiles(true);
      }
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      setError(`Error fetching users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.userCard}>
      <Image
        source={{ 
          uri: item.photo_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face'
        }}
        style={styles.profileImage}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userBio} numberOfLines={2}>
          {item.bio || 'No bio available'}
        </Text>
        <View style={styles.userDetails}>
          <Text style={styles.userDetail}>
            {item.business_stage || 'Not specified'}
          </Text>
          <Text style={styles.userDetail}>
            {item.industry_focus || item.business_field || 'Not specified'}
          </Text>
          {item.business_verified && (
            <Text style={[styles.userDetail, styles.verified]}>
              ✓ Verified
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.loadingText}>Loading entrepreneurs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <Button
            title="Try Again"
            onPress={handleRefresh}
            loading={refreshing}
            variant="primary"
            style={styles.refreshButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (noMoreProfiles && users.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noMoreContainer}>
          <Text style={styles.noMoreText}>No More Profiles</Text>
          <Text style={styles.noMoreSubtext}>
            We've shown you all available entrepreneurs in your area.
          </Text>
          <Text style={styles.noMoreSubtext}>
            Check back later for new matches.
          </Text>
          <Button
            title="Refresh"
            onPress={handleRefresh}
            loading={refreshing}
            variant="primary"
            style={styles.refreshButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discovery</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={refreshing}
          style={styles.refreshIcon}
        >
          <RefreshCw
            size={24}
            color={refreshing ? Colors.dark.textSecondary : Colors.dark.primary}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.dark.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No profiles found</Text>
            <Button
              title="Refresh"
              onPress={handleRefresh}
              loading={refreshing}
              variant="primary"
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  refreshIcon: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.dark.text,
    marginTop: 10,
    fontSize: 16,
  },
  noMoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noMoreText: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  noMoreSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshButton: {
    marginTop: 24,
    paddingHorizontal: 32,
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  userBio: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  userDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userDetail: {
    fontSize: 12,
    color: Colors.dark.primary,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    marginBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  verified: {
    backgroundColor: Colors.dark.success || '#10B981',
    color: Colors.dark.background,
  },
});
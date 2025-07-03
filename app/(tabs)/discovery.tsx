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
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { RefreshCw } from 'lucide-react-native';

interface User {
  id: string;
  name: string;
  bio: string;
  profile_image_url: string;
  business_stage: string;
  industry_focus: string;
}

export default function DiscoveryScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, bio, profile_image_url, business_stage, industry_focus')
        .limit(15);

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      if (data && data.length > 0) {
        setUsers(data);
        setNoMoreProfiles(false);
      } else {
        setUsers([]);
        setNoMoreProfiles(true);
      }
    } catch (error) {
      console.error('Error in fetchUsers:', error);
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
          uri: item.profile_image_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face'
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
            {item.industry_focus || 'Not specified'}
          </Text>
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
});
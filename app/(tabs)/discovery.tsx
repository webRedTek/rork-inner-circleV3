import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useUsageStore } from '@/store/usage-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { RefreshCw, X, Heart } from 'lucide-react-native';

// Debug logging configuration
const DEBUG_PREFIX = '[Discovery]';
const logDebug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${DEBUG_PREFIX} ${message}`;
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
};

const logLifecycle = (phase: string, data?: any) => {
  logDebug(`Lifecycle - ${phase}`, data);
};

const logDataFlow = (operation: string, data: any) => {
  logDebug(`Data Flow - ${operation}`, data);
};

const logStateChange = (action: string, prevState: any, nextState: any) => {
  logDebug(`State Change - ${action}`, {
    prev: prevState,
    next: nextState,
    changes: Object.keys(nextState).filter(key => prevState[key] !== nextState[key])
  });
};

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 40;
const CARD_HEIGHT = CARD_WIDTH * 1.2;

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
  age?: number;
}

export default function DiscoveryScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { usageCache, initializeUsage } = useUsageStore();

  const fetchUsers = async () => {
    logDebug('Starting fetchUsers');
    
    if (!user?.id || !supabase) {
      logDebug('Fetch aborted - missing user or supabase', { userId: user?.id });
      setError('User not authenticated');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      logDebug('Checking usage cache status', { 
        hasUsageCache: !!usageCache,
        userId: user.id 
      });

      // Initialize usage if not already done
      if (!usageCache) {
        logDebug('Usage cache not found, initializing');
        await initializeUsage(user.id);
        logDebug('Usage cache initialized');
      }

      logDebug('Calling fetch_potential_matches', { 
        userId: user.id,
        limit: 15,
        maxDistance: 50,
        isGlobalDiscovery: false
      });
      
      const { data, error } = await supabase.rpc('fetch_potential_matches', {
        p_user_id: user.id,
        p_limit: 15,
        p_max_distance: 50,
        p_is_global_discovery: false
      });

      if (error) {
        logDebug('RPC Error', { error });
        setError(`Error fetching users: ${error.message || 'Unknown error'}`);
        return;
      }

      logDataFlow('Received potential matches', {
        matchCount: data?.matches?.length || 0
      });
      
      if (data && data.matches && data.matches.length > 0) {
        const prevUsers = users;
        setUsers(data.matches);
        logStateChange('setUsers', prevUsers, data.matches);
        
        const prevIndex = currentIndex;
        setCurrentIndex(0);
        logStateChange('setCurrentIndex', prevIndex, 0);
        
        setNoMoreProfiles(false);
      } else {
        setUsers([]);
        setNoMoreProfiles(true);
        logDebug('No profiles available');
      }
    } catch (error) {
      logDebug('Error in fetchUsers', { error });
      setError(`Error fetching users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
      logDebug('Fetch completed', { 
        loading: false, 
        refreshing: false,
        error: error,
        userCount: users.length
      });
    }
  };

  useEffect(() => {
    logLifecycle('Mount');
    fetchUsers();
    return () => {
      logLifecycle('Unmount');
    };
  }, []);

  const handleRefresh = () => {
    logDebug('Refresh requested');
    setRefreshing(true);
    fetchUsers();
  };

  const handlePass = () => {
    logDebug('Pass action', { userId: users[currentIndex]?.id });
    if (currentIndex < users.length - 1) {
      const prevIndex = currentIndex;
      setCurrentIndex(currentIndex + 1);
      logStateChange('setCurrentIndex', prevIndex, currentIndex + 1);
    } else {
      setNoMoreProfiles(true);
      logDebug('No more profiles after pass');
    }
  };

  const handleConnect = () => {
    logDebug('Connect action', { 
      userId: users[currentIndex]?.id,
      userName: users[currentIndex]?.name 
    });
    if (currentIndex < users.length - 1) {
      const prevIndex = currentIndex;
      setCurrentIndex(currentIndex + 1);
      logStateChange('setCurrentIndex', prevIndex, currentIndex + 1);
    } else {
      setNoMoreProfiles(true);
      logDebug('No more profiles after connect');
    }
  };

  const currentUser = users[currentIndex];

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

  if (noMoreProfiles || !currentUser) {
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

      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <Image
            source={{ 
              uri: currentUser.photo_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face'
            }}
            style={styles.cardImage}
          />
          
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName}>
                {currentUser.name}
                {currentUser.age && `, ${currentUser.age}`}
              </Text>
              {currentUser.business_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.userLocation}>
              {currentUser.location || 'Location not specified'}
            </Text>
            
            <Text style={styles.userBio} numberOfLines={3}>
              {currentUser.bio || 'No bio available'}
            </Text>
            
            <View style={styles.userTags}>
              {currentUser.business_stage && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{currentUser.business_stage}</Text>
                </View>
              )}
              {currentUser.industry_focus && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{currentUser.industry_focus}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={handlePass}
        >
          <X size={32} color={Colors.dark.text} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.connectButton]}
          onPress={handleConnect}
        >
          <Heart size={32} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {currentIndex + 1} of {users.length}
        </Text>
      </View>
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
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardImage: {
    width: '100%',
    height: '60%',
    resizeMode: 'cover',
  },
  cardInfo: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  verifiedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userLocation: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  userBio: {
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  userTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tagText: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 30,
    gap: 40,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  passButton: {
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  connectButton: {
    backgroundColor: Colors.dark.primary,
  },
  progressContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  progressText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
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
});
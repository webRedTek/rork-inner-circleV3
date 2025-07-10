/**
 * FILE: components/SubscriptionCard.tsx
 * CREATED: 2025-07-10
 * 
 * Subscription status card component for displaying current subscription
 * information and quick actions.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Star, Shield, Settings } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { MembershipTier } from '@/types/user';
import { LinearGradient } from 'expo-linear-gradient';

interface SubscriptionCardProps {
  style?: any;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ style }) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { customerInfo, getActiveSubscriptions } = useSubscriptionStore();

  if (!user) return null;

  const getTierIcon = (tier: MembershipTier) => {
    switch (tier) {
      case 'bronze':
        return <Shield size={20} color={Colors.dark.textSecondary} />;
      case 'silver':
        return <Star size={20} color="#C0C0C0" />;
      case 'gold':
        return <Crown size={20} color="#FFD700" />;
      default:
        return <Shield size={20} color={Colors.dark.textSecondary} />;
    }
  };

  const getTierGradient = (tier: MembershipTier): [string, string] => {
    switch (tier) {
      case 'bronze':
        return ['#8B4513', '#CD853F'];
      case 'silver':
        return ['#708090', '#C0C0C0'];
      case 'gold':
        return ['#DAA520', '#FFD700'];
      default:
        return [Colors.dark.card, Colors.dark.card];
    }
  };

  const getTierDisplayName = (tier: MembershipTier) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getSubscriptionStatus = () => {
    if (Platform.OS === 'web') {
      return user.membershipTier === 'bronze' ? 'Free Plan' : 'Premium Plan';
    }

    if (!customerInfo) {
      return 'Loading...';
    }

    const activeSubscriptions = getActiveSubscriptions();
    if (activeSubscriptions.length === 0) {
      return user.membershipTier === 'bronze' ? 'Free Plan' : 'Premium Plan';
    }

    return 'Active Subscription';
  };

  const handleManageSubscription = () => {
    router.push('/subscription-details');
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handleManageSubscription}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={getTierGradient(user.membershipTier)}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.tierInfo}>
              {getTierIcon(user.membershipTier)}
              <View style={styles.tierText}>
                <Text style={styles.tierName}>
                  {getTierDisplayName(user.membershipTier)} Member
                </Text>
                <Text style={styles.subscriptionStatus}>
                  {getSubscriptionStatus()}
                </Text>
              </View>
            </View>
            <Settings size={20} color="rgba(255, 255, 255, 0.8)" />
          </View>
          
          {user.membershipTier === 'bronze' && (
            <View style={styles.upgradePrompt}>
              <Text style={styles.upgradeText}>
                Upgrade to unlock premium features
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  gradient: {
    padding: 16,
  },
  content: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tierText: {
    gap: 2,
  },
  tierName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subscriptionStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  upgradePrompt: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  upgradeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
});
/**
 * FILE: app/subscription-details.tsx
 * CREATED: 2025-07-10
 * 
 * Subscription details screen showing current subscription status,
 * billing information, and management options.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UNIVERSAL_SAFE_AREA_EDGES } from '@/constants/safeArea';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { Button } from '@/components/Button';
import { 
  Crown, 
  Star, 
  Shield, 
  Calendar, 
  CreditCard, 
  ExternalLink,
  RotateCcw,
  Settings
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MembershipTier } from '@/types/user';

export default function SubscriptionDetailsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    customerInfo, 
    isRestoring, 
    restorePurchases,
    getActiveSubscriptions 
  } = useSubscriptionStore();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
        <Stack.Screen options={{ title: 'Subscription Details' }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getTierIcon = (tier: MembershipTier) => {
    switch (tier) {
      case 'bronze':
        return <Shield size={24} color={Colors.dark.textSecondary} />;
      case 'silver':
        return <Star size={24} color="#C0C0C0" />;
      case 'gold':
        return <Crown size={24} color="#FFD700" />;
      default:
        return <Shield size={24} color={Colors.dark.textSecondary} />;
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

  const getSubscriptionInfo = () => {
    if (Platform.OS === 'web') {
      return {
        status: user.membershipTier === 'bronze' ? 'Free' : 'Active',
        nextBilling: null,
        product: null,
      };
    }

    if (!customerInfo) {
      return {
        status: 'Loading...',
        nextBilling: null,
        product: null,
      };
    }

    const activeSubscriptions = getActiveSubscriptions();
    if (activeSubscriptions.length === 0) {
      return {
        status: user.membershipTier === 'bronze' ? 'Free' : 'Inactive',
        nextBilling: null,
        product: null,
      };
    }

    // Get the first active subscription
    const activeEntitlement = customerInfo.entitlements.active[activeSubscriptions[0]];
    if (activeEntitlement) {
      return {
        status: 'Active',
        nextBilling: activeEntitlement.expirationDate,
        product: activeEntitlement.productIdentifier,
      };
    }

    return {
      status: 'Unknown',
      nextBilling: null,
      product: null,
    };
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Manage Subscription',
        'To manage your subscription, please use the mobile app or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Manage Subscription',
      'You will be redirected to your device\'s subscription management settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('https://apps.apple.com/account/subscriptions');
            } else {
              Linking.openURL('https://play.google.com/store/account/subscriptions');
            }
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Purchase restoration is not available on web.');
      return;
    }

    await restorePurchases();
  };

  const handleUpgrade = () => {
    router.push('/membership');
  };

  const subscriptionInfo = getSubscriptionInfo();

  return (
    <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
      <Stack.Screen 
        options={{ 
          title: 'Subscription Details',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Current Plan Card */}
        <View style={styles.section}>
          <LinearGradient
            colors={getTierGradient(user.membershipTier)}
            style={styles.planGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.planHeader}>
              <View style={styles.planTitleRow}>
                {getTierIcon(user.membershipTier)}
                <View>
                  <Text style={styles.planName}>
                    {user.membershipTier.charAt(0).toUpperCase() + user.membershipTier.slice(1)} Plan
                  </Text>
                  <Text style={styles.planStatus}>{subscriptionInfo.status}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Subscription Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Details</Text>
          
          <View style={styles.detailRow}>
            <Calendar size={20} color={Colors.dark.accent} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>{subscriptionInfo.status}</Text>
            </View>
          </View>

          {subscriptionInfo.nextBilling && (
            <View style={styles.detailRow}>
              <CreditCard size={20} color={Colors.dark.accent} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Next Billing</Text>
                <Text style={styles.detailValue}>
                  {new Date(subscriptionInfo.nextBilling).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}

          {subscriptionInfo.product && (
            <View style={styles.detailRow}>
              <Settings size={20} color={Colors.dark.accent} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Product</Text>
                <Text style={styles.detailValue}>{subscriptionInfo.product}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          {user.membershipTier === 'bronze' && (
            <Button
              title="Upgrade Plan"
              onPress={handleUpgrade}
              variant="primary"
              size="large"
              style={styles.actionButton}
            />
          )}

          <Button
            title="Manage Subscription"
            onPress={handleManageSubscription}
            variant="secondary"
            size="large"
            style={styles.actionButton}
            icon={<ExternalLink size={20} color={Colors.dark.text} />}
          />

          {Platform.OS !== 'web' && (
            <Button
              title="Restore Purchases"
              onPress={handleRestorePurchases}
              variant="secondary"
              size="large"
              style={styles.actionButton}
              loading={isRestoring}
              icon={<RotateCcw size={20} color={Colors.dark.text} />}
            />
          )}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            If you're experiencing issues with your subscription or have questions about billing, 
            please contact our support team.
          </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  planGradient: {
    borderRadius: 16,
    padding: 20,
  },
  planHeader: {
    alignItems: 'center',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  planStatus: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  actionButton: {
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
  },
});
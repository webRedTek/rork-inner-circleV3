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
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
                  </Text>\n                  <Text style={styles.planStatus}>{subscriptionInfo.status}</Text>\n                </View>\n              </View>\n            </View>\n          </LinearGradient>\n        </View>\n\n        {/* Subscription Details */}\n        <View style={styles.section}>\n          <Text style={styles.sectionTitle}>Subscription Details</Text>\n          \n          <View style={styles.detailRow}>\n            <Calendar size={20} color={Colors.dark.accent} />\n            <View style={styles.detailContent}>\n              <Text style={styles.detailLabel}>Status</Text>\n              <Text style={styles.detailValue}>{subscriptionInfo.status}</Text>\n            </View>\n          </View>\n\n          {subscriptionInfo.nextBilling && (\n            <View style={styles.detailRow}>\n              <CreditCard size={20} color={Colors.dark.accent} />\n              <View style={styles.detailContent}>\n                <Text style={styles.detailLabel}>Next Billing</Text>\n                <Text style={styles.detailValue}>\n                  {new Date(subscriptionInfo.nextBilling).toLocaleDateString()}\n                </Text>\n              </View>\n            </View>\n          )}\n\n          {subscriptionInfo.product && (\n            <View style={styles.detailRow}>\n              <Settings size={20} color={Colors.dark.accent} />\n              <View style={styles.detailContent}>\n                <Text style={styles.detailLabel}>Product</Text>\n                <Text style={styles.detailValue}>{subscriptionInfo.product}</Text>\n              </View>\n            </View>\n          )}\n        </View>\n\n        {/* Actions */}\n        <View style={styles.section}>\n          <Text style={styles.sectionTitle}>Actions</Text>\n          \n          {user.membershipTier === 'bronze' && (\n            <Button\n              title=\"Upgrade Plan\"\n              onPress={handleUpgrade}\n              variant=\"primary\"\n              size=\"large\"\n              style={styles.actionButton}\n              icon={<Crown size={18} color={Colors.dark.text} />}\n            />\n          )}\n\n          {Platform.OS !== 'web' && subscriptionInfo.status === 'Active' && (\n            <Button\n              title=\"Manage Subscription\"\n              onPress={handleManageSubscription}\n              variant=\"outline\"\n              size=\"large\"\n              style={styles.actionButton}\n              icon={<ExternalLink size={18} color={Colors.dark.text} />}\n            />\n          )}\n\n          {Platform.OS !== 'web' && (\n            <Button\n              title=\"Restore Purchases\"\n              onPress={handleRestorePurchases}\n              variant=\"outline\"\n              size=\"large\"\n              loading={isRestoring}\n              style={styles.actionButton}\n              icon={<RotateCcw size={18} color={Colors.dark.text} />}\n            />\n          )}\n        </View>\n\n        {/* Help Text */}\n        <View style={styles.section}>\n          <Text style={styles.helpTitle}>Need Help?</Text>\n          <Text style={styles.helpText}>\n            If you're experiencing issues with your subscription, try restoring purchases first. \n            For billing questions, contact your device's app store support.\n          </Text>\n          \n          {Platform.OS === 'web' && (\n            <Text style={styles.helpText}>\n              Subscription management is only available on mobile devices. \n              Please use the iOS or Android app to manage your subscription.\n            </Text>\n          )}\n        </View>\n      </ScrollView>\n    </SafeAreaView>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: {\n    flex: 1,\n    backgroundColor: Colors.dark.background,\n  },\n  loadingContainer: {\n    flex: 1,\n    justifyContent: 'center',\n    alignItems: 'center',\n    padding: 20,\n  },\n  scrollView: {\n    flex: 1,\n  },\n  section: {\n    backgroundColor: Colors.dark.card,\n    borderRadius: 12,\n    marginHorizontal: 16,\n    marginBottom: 16,\n    overflow: 'hidden',\n  },\n  sectionTitle: {\n    fontSize: 18,\n    fontWeight: 'bold',\n    color: Colors.dark.text,\n    marginBottom: 16,\n    paddingHorizontal: 16,\n    paddingTop: 16,\n  },\n  planGradient: {\n    padding: 16,\n  },\n  planHeader: {\n    flexDirection: 'row',\n    justifyContent: 'space-between',\n    alignItems: 'center',\n  },\n  planTitleRow: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    gap: 12,\n  },\n  planName: {\n    fontSize: 20,\n    fontWeight: 'bold',\n    color: '#FFFFFF',\n  },\n  planStatus: {\n    fontSize: 14,\n    color: 'rgba(255, 255, 255, 0.8)',\n    marginTop: 2,\n  },\n  detailRow: {\n    flexDirection: 'row',\n    alignItems: 'center',\n    paddingHorizontal: 16,\n    paddingVertical: 12,\n    gap: 12,\n  },\n  detailContent: {\n    flex: 1,\n  },\n  detailLabel: {\n    fontSize: 14,\n    color: Colors.dark.textSecondary,\n    marginBottom: 2,\n  },\n  detailValue: {\n    fontSize: 16,\n    color: Colors.dark.text,\n    fontWeight: '500',\n  },\n  actionButton: {\n    marginHorizontal: 16,\n    marginBottom: 12,\n  },\n  helpTitle: {\n    fontSize: 16,\n    fontWeight: '600',\n    color: Colors.dark.text,\n    marginBottom: 8,\n    paddingHorizontal: 16,\n    paddingTop: 16,\n  },\n  helpText: {\n    fontSize: 14,\n    color: Colors.dark.textSecondary,\n    lineHeight: 20,\n    paddingHorizontal: 16,\n    paddingBottom: 16,\n    marginBottom: 8,\n  },\n  errorText: {\n    color: Colors.dark.error,\n    fontSize: 16,\n    textAlign: 'center',\n  },\n});
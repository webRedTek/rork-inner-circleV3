/*
 * CHANGES (2025-07-08):
 * - Added logic to check for existing referral links on component load.
 * - If user already has a referral code, it displays the existing code and hides the generate button.
 * - Added hasExistingLink state to track whether user has already generated a referral link.
 * - Updated UI conditions to show referral code, link, and QR code when existing link is found.
 * - Imported isSupabaseConfigured and supabase for database queries.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import { useAffiliateStore } from '@/store/affiliate-store';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { Gift, Copy, Share2 } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function AffiliateDashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { stats, referralHistory, isLoading, error, fetchAffiliateData, generateReferralLink } = useAffiliateStore();
  const [referralLink, setReferralLink] = useState<string>('');
  const [referralCode, setReferralCode] = useState<string>('');
  const [hasExistingLink, setHasExistingLink] = useState<boolean>(false);

  useEffect(() => {
    if (user?.membershipTier !== 'silver' && user?.membershipTier !== 'gold') {
      router.replace('/(tabs)/profile');
    } else {
      fetchAffiliateData();
      checkExistingReferralLink();
    }
  }, []);

  const checkExistingReferralLink = async () => {
    try {
      if (isSupabaseConfigured() && supabase && user) {
        const { data: linkData, error: linkError } = await supabase
          .from('affiliate_links')
          .select('referral_code')
          .eq('user_id', user.id)
          .single();
          
        if (linkData && linkData.referral_code) {
          setHasExistingLink(true);
          setReferralCode(linkData.referral_code);
          setReferralLink(`https://app.example.com/referral/${linkData.referral_code}`);
        } else {
          setHasExistingLink(false);
        }
      }
    } catch (error) {
      console.log('No existing referral link found');
      setHasExistingLink(false);
    }
  };

  const loadReferralLink = async () => {
    try {
      const link = await generateReferralLink();
      setReferralLink(link);
      
      // Extract the referral code from the link
      const code = link.split('/').pop() || '';
      setReferralCode(code);
      setHasExistingLink(true); // Mark as having existing link after generation
    } catch (err) {
      Alert.alert('Error', 'Failed to generate referral link. Please try again.');
    }
  };

  const handleCopyLink = () => {
    // In a real app, this would copy to clipboard
    Alert.alert('Copied', 'Referral link copied to clipboard!');
  };

  const handleCopyCode = () => {
    // In a real app, this would copy to clipboard
    Alert.alert('Copied', 'Referral code copied to clipboard!');
  };

  const handleShare = () => {
    // In a real app, this would open share sheet
    Alert.alert('Share', 'Sharing referral link...');
  };

  const handleGenerateLink = () => {
    loadReferralLink();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Loading affiliate data...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Retry"
          onPress={() => {
            fetchAffiliateData();
          }}
          variant="outline"
          size="large"
          style={styles.retryButton}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Gift size={24} color={Colors.dark.primary} style={styles.icon} />
          <Text style={styles.title}>Affiliate Dashboard</Text>
          <Text style={styles.subtitle}>Track your referrals and earnings</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats Overview</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.totalReferrals || 0}</Text>
              <Text style={styles.statLabel}>Total Referrals</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats?.activeReferrals || 0}</Text>
              <Text style={styles.statLabel}>Active Referrals</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${stats?.totalEarnings || 0}</Text>
              <Text style={styles.statLabel}>Total Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${stats?.pendingPayouts || 0}</Text>
              <Text style={styles.statLabel}>Pending Payouts</Text>
            </View>
          </View>
        </View>

        {/* Referral Link */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral Link</Text>
          
          {/* Generate Button - Only show if no existing link */}
          {!hasExistingLink && !referralLink && (
            <View style={styles.generateContainer}>
              <Button
                title="Generate Link"
                onPress={handleGenerateLink}
                variant="primary"
                size="medium"
                style={styles.generateButton}
              />
            </View>
          )}
          
          {/* Referral Code - Show if exists or generated */}
          {(referralCode || hasExistingLink) && (
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Your Referral Code:</Text>
              <View style={styles.codeDisplay}>
                <Text style={styles.codeText}>{referralCode}</Text>
                <Button
                  title="Copy Code"
                  onPress={handleCopyCode}
                  variant="outline"
                  size="small"
                  icon={<Copy size={16} color={Colors.dark.text} />}
                  style={styles.copyCodeButton}
                />
              </View>
            </View>
          )}
          
          {/* Full Referral Link - Show if exists or generated */}
          {(referralLink || hasExistingLink) && (
            <View style={styles.linkContainer}>
              <Text style={styles.linkLabel}>Full Referral Link:</Text>
              <Text style={styles.linkText}>{referralLink}</Text>
              <View style={styles.linkActions}>
                <Button
                  title="Copy Link"
                  onPress={handleCopyLink}
                  variant="outline"
                  size="small"
                  icon={<Copy size={16} color={Colors.dark.text} />}
                  style={styles.linkButton}
                />
                <Button
                  title="Share"
                  onPress={handleShare}
                  variant="outline"
                  size="small"
                  icon={<Share2 size={16} color={Colors.dark.text} />}
                  style={styles.linkButton}
                />
              </View>
            </View>
          )}
          
          {/* QR Code */}
          <View style={styles.qrContainer}>
            {(referralLink || hasExistingLink) ? (
              <QRCode
                value={referralLink}
                size={200}
                color={Colors.dark.text}
                backgroundColor={Colors.dark.background}
              />
            ) : (
              <Text style={styles.qrText}>Generate a link to display QR code</Text>
            )}
            <Text style={styles.qrText}>Scan to share your referral link</Text>
          </View>
        </View>

        {/* Referral History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral History</Text>
          {referralHistory.length === 0 ? (
            <Text style={styles.emptyText}>No referrals yet. Start sharing your link!</Text>
          ) : (
            <View style={styles.historyContainer}>
              {referralHistory.map((item, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyDetails}>
                    <Text style={styles.historyName}>{item.referredUser.name}</Text>
                    <Text style={styles.historyDate}>Signed up: {item.referredUser.signupDate}</Text>
                    <Text style={styles.historyStatus}>Status: {item.status}</Text>
                  </View>
                  <Text style={styles.historyEarnings}>${item.earnings}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Payout History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout History</Text>
          {stats?.lastPayout ? (
            <View style={styles.payoutContainer}>
              <Text style={styles.payoutText}>Last Payout: ${stats.lastPayout.amount} on {stats.lastPayout.date}</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No payouts yet.</Text>
          )}
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
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  icon: {
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    width: '48%',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  linkContainer: {
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  linkText: {
    color: Colors.dark.text,
    fontSize: 16,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  linkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  generateContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  generateButton: {
    width: 200,
  },
  codeContainer: {
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  codeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.primary,
    flex: 1,
    marginRight: 12,
  },
  copyCodeButton: {
    minWidth: 120,
  },
  linkLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
  },
  qrText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  historyContainer: {
    marginTop: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  historyDetails: {
    flex: 1,
  },
  historyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  historyStatus: {
    fontSize: 14,
    color: Colors.dark.accent,
  },
  historyEarnings: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.primary,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  payoutContainer: {
    backgroundColor: Colors.dark.background,
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  payoutText: {
    color: Colors.dark.text,
    fontSize: 16,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    width: 200,
  },
});
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UNIVERSAL_SAFE_AREA_EDGES } from '@/constants/safeArea';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { useSubscriptionStore, getPackageByTier, formatPrice, getSubscriptionPeriod } from '@/store/subscription-store';
import { Button } from '@/components/Button';
import { Check, Crown, Star, Shield, RotateCcw } from 'lucide-react-native';
import { MembershipTier, TierSettings } from '@/types/user';
import { LinearGradient } from 'expo-linear-gradient';

export default function MembershipScreen() {
  const router = useRouter();
  const { user, updateMembership, isLoading, allTierSettings, fetchAllTierSettings } = useAuthStore();
  const { 
    offerings, 
    isPurchasing, 
    isRestoring, 
    purchasePackage, 
    restorePurchases, 
    hasActiveSubscription,
    error: subscriptionError,
    clearError
  } = useSubscriptionStore();
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierSettingsLoading, setTierSettingsLoading] = useState(false);

  useEffect(() => {
    // Load tier settings if not already loaded
    const loadTierSettings = async () => {
      if (!allTierSettings) {
        setTierSettingsLoading(true);
        try {
          await fetchAllTierSettings();
        } catch (err) {
          setError('Failed to load tier settings');
          console.error('Error loading tier settings:', err);
        } finally {
          setTierSettingsLoading(false);
        }
      }
    };

    loadTierSettings();
  }, [allTierSettings, fetchAllTierSettings]);
  
  if (tierSettingsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
          <Text style={styles.loadingText}>Loading membership plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!allTierSettings) {
    return (
      <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: Membership settings are not available. Please try again later.</Text>
          <Button
            title="Retry"
            onPress={async () => {
              setTierSettingsLoading(true);
              try {
                await fetchAllTierSettings();
                setError(null);
              } catch (err) {
                setError('Failed to load tier settings');
              } finally {
                setTierSettingsLoading(false);
              }
            }}
            variant="primary"
            size="large"
            style={styles.retryButton}
          />
          <Button
            title="Back"
            onPress={() => router.back()}
            variant="outline"
            size="large"
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }
  
  const handleUpgrade = async () => {
    if (!selectedTier) return;
    
    // On web, fall back to the old method
    if (Platform.OS === 'web') {
      setLoading(true);
      setError(null);
      
      try {
        await updateMembership(selectedTier);
        // Success notification handled by the store
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upgrade membership');
      } finally {
        setLoading(false);
      }
      return;
    }

    // On mobile, use RevenueCat
    if (!offerings) {
      setError('Subscription plans are not available. Please try again later.');
      return;
    }

    const packageToPurchase = getPackageByTier(offerings, selectedTier, selectedPeriod === 'annual');
    if (!packageToPurchase) {
      setError(`${selectedTier} ${selectedPeriod} plan is not available.`);
      return;
    }

    clearError();
    const success = await purchasePackage(packageToPurchase);
    
    if (success) {
      // Navigate back or show success
      router.back();
    }
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Purchase restoration is not available on web.');
      return;
    }

    clearError();
    await restorePurchases();
  };
  
  const renderFeature = (text: string, included: boolean) => (
    <View style={styles.featureRow}>
      {included ? (
        <Check size={18} color={Colors.dark.success} />
      ) : (
        <View style={styles.emptyCheck} />
      )}
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );

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

  const getPriceForTier = (tier: MembershipTier) => {
    if (Platform.OS === 'web' || !offerings) {
      // Fallback prices for web
      const prices = {
        bronze: 'Free',
        silver: selectedPeriod === 'annual' ? '$149.99/year' : '$14.99/month',
        gold: selectedPeriod === 'annual' ? '$299.99/year' : '$29.99/month'
      };
      return prices[tier];
    }

    if (tier === 'bronze') return 'Free';
    
    const packageItem = getPackageByTier(offerings, tier, selectedPeriod === 'annual');
    return packageItem ? formatPrice(packageItem) : 'N/A';
  };
  
  return (
    <SafeAreaView style={styles.container} edges={UNIVERSAL_SAFE_AREA_EDGES}>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Membership</Text>
          <Text style={styles.subtitle}>
            Upgrade your membership to unlock more features and connect with more entrepreneurs
          </Text>
        </View>
        
        {(error || subscriptionError) && (
          <Text style={styles.errorText}>{error || subscriptionError}</Text>
        )}

        {Platform.OS !== 'web' && (
          <View style={styles.periodSelector}>
            <Text style={styles.periodSelectorTitle}>Billing Period</Text>
            <View style={styles.periodButtons}>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  selectedPeriod === 'monthly' && styles.periodButtonActive
                ]}
                onPress={() => setSelectedPeriod('monthly')}
              >
                <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === 'monthly' && styles.periodButtonTextActive
                ]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.periodButton,
                  selectedPeriod === 'annual' && styles.periodButtonActive
                ]}
                onPress={() => setSelectedPeriod('annual')}
              >
                <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === 'annual' && styles.periodButtonTextActive
                ]}>Annual</Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Save 20%</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <View style={styles.plansContainer}>
          {/* Bronze Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedTier === 'bronze' && styles.selectedPlan
            ]}
            onPress={() => setSelectedTier('bronze')}
          >
            <LinearGradient
              colors={getTierGradient('bronze')}
              style={styles.planGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  {getTierIcon('bronze')}
                  <Text style={styles.planName}>Bronze</Text>
                </View>
                <Text style={styles.planPrice}>{getPriceForTier('bronze')}</Text>
              </View>
            </LinearGradient>
            
            <View style={styles.planFeatures}>
              {renderFeature('Create a basic profile', true)}
              {renderFeature('Discover entrepreneurs', true)}
              {renderFeature(`Limited swipes per day (${allTierSettings.bronze?.daily_swipe_limit || 'N/A'})`, true)}
              {renderFeature('Message your matches', true)}
              {renderFeature('Join groups', (allTierSettings.bronze?.groups_limit || 0) > 0)}
              {renderFeature('Create a portfolio', (allTierSettings.bronze?.featured_portfolio_limit || 0) > 0)}
              {renderFeature('Advanced matching algorithm', allTierSettings.bronze?.premium_filters_access || false)}
              {renderFeature('Priority in discovery queue', allTierSettings.bronze?.priority_listing || false)}
            </View>
            
            {user?.membershipTier === 'bronze' && (
              <View style={styles.currentPlanBadge}>
                <Text style={styles.currentPlanText}>Current Plan</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Silver Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedTier === 'silver' && styles.selectedPlan
            ]}
            onPress={() => setSelectedTier('silver')}
          >
            <LinearGradient
              colors={getTierGradient('silver')}
              style={styles.planGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  {getTierIcon('silver')}
                  <Text style={styles.planName}>Silver</Text>
                </View>
                <Text style={styles.planPrice}>{getPriceForTier('silver')}</Text>
              </View>
            </LinearGradient>
            
            <View style={styles.planFeatures}>
              {renderFeature('All Bronze features', true)}
              {renderFeature(`Increased swipes per day (${allTierSettings.silver?.daily_swipe_limit || 'N/A'})`, (allTierSettings.silver?.daily_swipe_limit || 0) > (allTierSettings.bronze?.daily_swipe_limit || 0))}
              {renderFeature('Join groups', (allTierSettings.silver?.groups_limit || 0) > 0)}
              {renderFeature('Create a basic portfolio', (allTierSettings.silver?.featured_portfolio_limit || 0) > 0)}
              {renderFeature('See who liked you', allTierSettings.silver?.can_see_who_liked_you || false)}
              {renderFeature('Advanced matching algorithm', allTierSettings.silver?.premium_filters_access || false)}
              {renderFeature('Priority in discovery queue', allTierSettings.silver?.priority_listing || false)}
              {renderFeature('Business verification badge', allTierSettings.silver?.has_business_verification || false)}
            </View>
            
            {user?.membershipTier === 'silver' && (
              <View style={styles.currentPlanBadge}>
                <Text style={styles.currentPlanText}>Current Plan</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Gold Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedTier === 'gold' && styles.selectedPlan,
              styles.popularPlan
            ]}
            onPress={() => setSelectedTier('gold')}
          >
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>Most Popular</Text>
            </View>
            <LinearGradient
              colors={getTierGradient('gold')}
              style={styles.planGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleRow}>
                  {getTierIcon('gold')}
                  <Text style={styles.planName}>Gold</Text>
                </View>
                <Text style={styles.planPrice}>{getPriceForTier('gold')}</Text>
              </View>
            </LinearGradient>
            
            <View style={styles.planFeatures}>
              {renderFeature('All Silver features', true)}
              {renderFeature('Unlimited swipes', (allTierSettings.gold?.daily_swipe_limit || 0) === 0 || (allTierSettings.gold?.daily_swipe_limit || 0) > 50)}
              {renderFeature('Join multiple groups', (allTierSettings.gold?.groups_limit || 0) > 1)}
              {renderFeature('Create an advanced portfolio', (allTierSettings.gold?.featured_portfolio_limit || 0) > 1)}
              {renderFeature('See who liked you', allTierSettings.gold?.can_see_who_liked_you || false)}
              {renderFeature('Advanced matching algorithm', allTierSettings.gold?.premium_filters_access || false)}
              {renderFeature('Priority in discovery queue', allTierSettings.gold?.priority_listing || false)}
              {renderFeature('Business verification badge', allTierSettings.gold?.has_business_verification || false)}
            </View>
            
            {user?.membershipTier === 'gold' && (
              <View style={styles.currentPlanBadge}>
                <Text style={styles.currentPlanText}>Current Plan</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.actionContainer}>
          {selectedTier && selectedTier !== user?.membershipTier && (
            <Button
              title={`Upgrade to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`}
              onPress={handleUpgrade}
              variant="primary"
              size="large"
              loading={loading || isLoading || isPurchasing}
              style={styles.upgradeButton}
            />
          )}
          
          {Platform.OS !== 'web' && (
            <Button
              title="Restore Purchases"
              onPress={handleRestorePurchases}
              variant="outline"
              size="large"
              loading={isRestoring}
              style={styles.restoreButton}
              icon={<RotateCcw size={18} color={Colors.dark.text} />}
            />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: Colors.dark.text,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  plansContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  planCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  planGradient: {
    padding: 16,
    borderRadius: 16,
  },
  selectedPlan: {
    borderColor: Colors.dark.accent,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  planFeatures: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: Colors.dark.text,
    marginLeft: 12,
  },
  emptyCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  currentPlanBadge: {
    backgroundColor: Colors.dark.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  currentPlanText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  actionContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  upgradeButton: {
    marginBottom: 16,
  },
  restoreButton: {
    marginBottom: 16,
  },
  periodSelector: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  periodSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  periodButtons: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    position: 'relative',
  },
  periodButtonActive: {
    backgroundColor: Colors.dark.accent,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  periodButtonTextActive: {
    color: Colors.dark.text,
  },
  saveBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.dark.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  popularPlan: {
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -1,
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.accent,
    paddingVertical: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  retryButton: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});
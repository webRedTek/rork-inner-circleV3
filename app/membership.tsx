import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/Button';
import { Check } from 'lucide-react-native';
import { MembershipTier, TierSettings } from '@/types/user';

export default function MembershipScreen() {
  const router = useRouter();
  const { user, updateMembership, isLoading, allTierSettings, fetchAllTierSettings } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
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
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Membership Plans' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
          <Text style={styles.loadingText}>Loading membership plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!allTierSettings) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Membership Plans' }} />
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
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Membership Plans' }} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Membership</Text>
          <Text style={styles.subtitle}>
            Upgrade your membership to unlock more features and connect with more entrepreneurs
          </Text>
        </View>
        
        {error && (
          <Text style={styles.errorText}>{error}</Text>
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
            <View style={styles.planHeader}>
              <Text style={styles.planName}>Bronze</Text>
              <Text style={styles.planPrice}>Free</Text>
            </View>
            
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
            <View style={styles.planHeader}>
              <Text style={styles.planName}>Silver</Text>
              <Text style={styles.planPrice}>$9.99/mo</Text>
            </View>
            
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
              selectedTier === 'gold' && styles.selectedPlan
            ]}
            onPress={() => setSelectedTier('gold')}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planName}>Gold</Text>
              <Text style={styles.planPrice}>$19.99/mo</Text>
            </View>
            
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
              loading={loading || isLoading}
              style={styles.upgradeButton}
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
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
    borderBottomColor: Colors.dark.border,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  planPrice: {
    fontSize: 18,
    color: Colors.dark.accent,
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
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/Button';
import { Check } from 'lucide-react-native';
import { MembershipTier } from '@/types/user';

export default function MembershipScreen() {
  const router = useRouter();
  const { user, updateMembership, isLoading } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState<MembershipTier>(user?.membershipTier || 'basic');
  const [loading, setLoading] = useState(false);
  
  const handleUpgrade = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // In a real app, this would process payment first
      await updateMembership(selectedTier);
      
      Alert.alert(
        'Membership Upgraded',
        `Your membership has been upgraded to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to upgrade membership');
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
        
        <View style={styles.plansContainer}>
          {/* Basic Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedTier === 'basic' && styles.selectedPlan
            ]}
            onPress={() => setSelectedTier('basic')}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planName}>Basic</Text>
              <Text style={styles.planPrice}>Free</Text>
            </View>
            
            <View style={styles.planFeatures}>
              {renderFeature('Create a basic profile', true)}
              {renderFeature('Discover entrepreneurs', true)}
              {renderFeature('Limited swipes per day (10)', true)}
              {renderFeature('Message your matches', true)}
              {renderFeature('Join groups', false)}
              {renderFeature('Create a portfolio', false)}
              {renderFeature('Advanced matching algorithm', false)}
              {renderFeature('Priority in discovery queue', false)}
            </View>
            
            {user?.membershipTier === 'basic' && (
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
              {renderFeature('All Basic features', true)}
              {renderFeature('Increased swipes per day (25)', true)}
              {renderFeature('Join 1 group', true)}
              {renderFeature('Create a basic portfolio', true)}
              {renderFeature('See who liked you', true)}
              {renderFeature('Advanced matching algorithm', false)}
              {renderFeature('Priority in discovery queue', false)}
              {renderFeature('Business verification badge', false)}
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
              {renderFeature('Unlimited swipes', true)}
              {renderFeature('Join multiple groups', true)}
              {renderFeature('Create an advanced portfolio', true)}
              {renderFeature('See who liked you', true)}
              {renderFeature('Advanced matching algorithm', true)}
              {renderFeature('Priority in discovery queue', true)}
              {renderFeature('Business verification badge', true)}
            </View>
            
            {user?.membershipTier === 'gold' && (
              <View style={styles.currentPlanBadge}>
                <Text style={styles.currentPlanText}>Current Plan</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.actionContainer}>
          {selectedTier !== user?.membershipTier ? (
            <Button
              title={`Upgrade to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`}
              onPress={handleUpgrade}
              variant="primary"
              size="large"
              loading={loading || isLoading}
              style={styles.upgradeButton}
            />
          ) : (
            <Button
              title="Back to Profile"
              onPress={() => router.back()}
              variant="outline"
              size="large"
              style={styles.backButton}
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
  backButton: {
    marginBottom: 16,
  },
});
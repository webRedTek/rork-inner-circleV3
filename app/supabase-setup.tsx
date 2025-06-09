import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { SupabaseSetup } from '@/components/SupabaseSetup';
import { isSupabaseConfigured, initSupabase, clearSupabaseConfig } from '@/lib/supabase';
import { RefreshCw } from 'lucide-react-native';

export default function SupabaseSetupScreen() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    checkSupabaseConfig();
  }, []);
  
  const checkSupabaseConfig = async () => {
    try {
      setLoading(true);
      const initialized = await initSupabase();
      setConfigured(isSupabaseConfigured() && initialized);
      setLoading(false);
    } catch (error) {
      console.error('Error checking Supabase configuration:', error);
      setConfigured(false);
      setLoading(false);
    }
  };
  
  const handleContinue = () => {
    router.replace('/(tabs)');
  };
  
  const handleSkip = () => {
    Alert.alert(
      'Skip Supabase Setup',
      'You can continue without Supabase, but some features may not work. You can set it up later from the profile screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue without Supabase',
          onPress: () => router.replace('/(tabs)'),
        },
      ]
    );
  };
  
  const handleReset = async () => {
    setLoading(true);
    try {
      await clearSupabaseConfig();
      Alert.alert(
        'Success', 
        'Supabase configuration reset. Please restart the app for changes to take effect.',
        [{ 
          text: 'OK',
          onPress: () => checkSupabaseConfig()
        }]
      );
    } catch (error) {
      console.error('Error resetting Supabase configuration:', error);
      Alert.alert('Error', 'Failed to reset Supabase configuration');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Checking Supabase configuration...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Supabase Setup' }} />
      {configured === true ? (
        <View style={styles.configuredContainer}>
          <View style={styles.statusContainer}>
            <View style={styles.statusIndicator}>
              <Text style={styles.statusText}>Supabase Configured</Text>
            </View>
            <Text style={styles.configuredText}>
              Your Supabase project is configured and ready to use.
            </Text>
          </View>
          <View style={styles.actionsContainer}>
            <Button
              title="Continue to App"
              onPress={handleContinue}
              variant="primary"
              style={styles.continueButton}
            />
            <Button
              title="Reset Configuration"
              onPress={handleReset}
              variant="outline"
              icon={<RefreshCw size={18} color={Colors.dark.text} />}
              style={styles.resetButton}
              loading={loading}
            />
          </View>
        </View>
      ) : (
        <View>
          <SupabaseSetup onSetupComplete={checkSupabaseConfig} />
          <Button
            title="Skip for now"
            onPress={handleSkip}
            variant="outline"
            style={styles.skipButton}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  configuredContainer: {
    padding: 16,
  },
  statusContainer: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusIndicator: {
    backgroundColor: Colors.dark.success,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  configuredText: {
    fontSize: 16,
    color: Colors.dark.text,
    lineHeight: 24,
  },
  actionsContainer: {
    gap: 12,
  },
  continueButton: {
    marginBottom: 0,
  },
  resetButton: {
    marginBottom: 0,
  },
  skipButton: {
    marginTop: 16,
    marginHorizontal: 16,
  },
});
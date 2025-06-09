import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { SupabaseSetup } from '@/components/SupabaseSetup';
import { isSupabaseConfigured, initSupabase, clearSupabaseConfig, testSupabaseConnection, ConnectionTestResult } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database, RefreshCw } from 'lucide-react-native';

export default function SupabaseSetupScreen() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isDatabasePopulated, setIsDatabasePopulated] = useState<boolean | null>(null);
  
  useEffect(() => {
    checkSupabaseConfig();
  }, []);
  
  const checkSupabaseConfig = async () => {
    try {
      console.log('Checking Supabase configuration...');
      setLoading(true);
      
      // Try to initialize with retry
      const maxRetries = 2;
      let retryCount = 0;
      let supabaseInitialized = false;
      
      while (retryCount <= maxRetries && !supabaseInitialized) {
        try {
          supabaseInitialized = await initSupabase();
          if (supabaseInitialized) {
            console.log("Supabase configured successfully");
            
            // Test the connection with a simple query
            const result = await testSupabaseConnection();
            setTestResult(result);
            
            // Check if database has data by checking if we can query users
            if (result.success) {
              setIsDatabasePopulated(true);
            } else {
              setIsDatabasePopulated(false);
            }
            
            break;
          } else {
            console.warn(`Supabase initialization attempt ${retryCount + 1}/${maxRetries + 1} failed`);
            retryCount++;
            if (retryCount <= maxRetries) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (err) {
          console.error(`Supabase initialization error (attempt ${retryCount + 1}/${maxRetries + 1}):`, err);
          retryCount++;
          if (retryCount <= maxRetries) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      const isConfigured = isSupabaseConfigured();
      console.log('Supabase configured:', isConfigured);
      setConfigured(isConfigured);
      setLoading(false);
    } catch (error) {
      console.error('Error checking Supabase configuration:', error);
      setConfigured(false);
      setLoading(false);
    }
  };
  
  // Helper function to extract readable error message
  const getReadableError = (error: any): string => {
    if (!error) return 'Unknown error occurred';
    
    // If it's a string, return it directly
    if (typeof error === 'string') return error;
    
    // If it has a message property, return that
    if (error.message) return error.message;
    
    // If it has an error property with a message (nested error)
    if (error.error && error.error.message) return error.error.message;
    
    // If it has a details property
    if (error.details) return String(error.details);
    
    // If it has a code property
    if (error.code) return `Error code: ${error.code}`;
    
    // Last resort: stringify the object
    try {
      return JSON.stringify(error);
    } catch (e) {
      return 'An error occurred';
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
      console.log('Resetting Supabase configuration...');
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
      
      <ScrollView style={styles.scrollView}>
        {configured === true ? (
          <View style={styles.configuredContainer}>
            <View style={styles.statusContainer}>
              <View style={styles.statusIndicator}>
                <Text style={styles.statusText}>Supabase Configured</Text>
              </View>
              
              <Text style={styles.configuredText}>
                Your Supabase project is configured and ready to use.
              </Text>
              
              {testResult && (
                <View style={styles.testResultContainer}>
                  <Text style={styles.testResultTitle}>Connection Test:</Text>
                  <Text style={[
                    styles.testResultText, 
                    testResult.success ? styles.testSuccess : styles.testError
                  ]}>
                    {testResult.success 
                      ? 'Connection successful' 
                      : `Connection failed: ${typeof testResult.error === 'string' ? testResult.error : getReadableError(testResult.error)}`}
                  </Text>
                </View>
              )}
              
              {isDatabasePopulated !== null && (
                <View style={styles.demoDataContainer}>
                  <Text style={styles.demoDataTitle}>Database Status:</Text>
                  <Text style={[
                    styles.demoDataText,
                    isDatabasePopulated ? styles.demoDataSeeded : styles.demoDataNotSeeded
                  ]}>
                    {isDatabasePopulated 
                      ? 'Database connection successful' 
                      : 'Database connection failed'}
                  </Text>
                </View>
              )}
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
  testResultContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.dark.background + '40',
    borderRadius: 8,
  },
  testResultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  testResultText: {
    fontSize: 14,
    lineHeight: 20,
  },
  testSuccess: {
    color: Colors.dark.success,
  },
  testError: {
    color: Colors.dark.error,
  },
  demoDataContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.dark.background + '40',
    borderRadius: 8,
  },
  demoDataTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  demoDataText: {
    fontSize: 14,
    lineHeight: 20,
  },
  demoDataSeeded: {
    color: Colors.dark.success,
  },
  demoDataNotSeeded: {
    color: Colors.dark.warning,
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
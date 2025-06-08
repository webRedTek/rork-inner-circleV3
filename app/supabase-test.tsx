import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { runSupabaseTests, SupabaseTestResults, seedTestData, clearTestData, testAuthSignup, testAuthLogin } from '@/utils/supabase-test-utils';
import { isSupabaseConfigured } from '@/lib/supabase';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

export default function SupabaseTestScreen() {
  const [testResults, setTestResults] = useState<SupabaseTestResults | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testPassword, setTestPassword] = useState('password123');
  const [isRunningAuthTest, setIsRunningAuthTest] = useState(false);
  const { isAuthenticated, logout } = useAuthStore();

  // Run tests when the screen loads
  useEffect(() => {
    handleRunTests();
  }, []);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await runSupabaseTests();
      setTestResults(results);
    } catch (error) {
      console.error('Error running tests:', error);
      Alert.alert('Test Error', 'An unexpected error occurred while running tests.');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const result = await seedTestData();
      if (result.success) {
        Alert.alert('Success', 'Test data seeded successfully');
        // Refresh tests
        handleRunTests();
      } else {
        Alert.alert('Seeding Failed', result.error || 'Failed to seed test data');
      }
    } catch (error) {
      console.error('Error seeding data:', error);
      Alert.alert('Seeding Error', 'An unexpected error occurred while seeding data');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      const result = await clearTestData();
      if (result.success) {
        Alert.alert('Success', 'Test data cleared successfully');
        // Refresh tests
        handleRunTests();
      } else {
        Alert.alert('Clearing Failed', result.error || 'Failed to clear test data');
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Clearing Error', 'An unexpected error occurred while clearing data');
    } finally {
      setIsClearing(false);
    }
  };

  const handleTestAuth = async (isSignup: boolean) => {
    if (!testEmail || !testPassword) {
      Alert.alert('Input Required', 'Please enter both email and password');
      return;
    }

    setIsRunningAuthTest(true);
    try {
      // If already authenticated, log out first
      if (isAuthenticated) {
        await logout();
      }

      const result = isSignup 
        ? await testAuthSignup(testEmail, testPassword)
        : await testAuthLogin(testEmail, testPassword);

      if (result.success) {
        Alert.alert('Success', `Auth ${isSignup ? 'signup' : 'login'} test passed`);
        // Refresh tests
        handleRunTests();
      } else {
        Alert.alert('Auth Test Failed', result.error || `Failed to ${isSignup ? 'signup' : 'login'}`);
      }
    } catch (error) {
      console.error('Error testing auth:', error);
      Alert.alert('Auth Test Error', 'An unexpected error occurred during auth test');
    } finally {
      setIsRunningAuthTest(false);
    }
  };

  const renderTestResult = (label: string, result?: { success: boolean; message: string; error?: string }) => {
    if (!result) return null;
    
    return (
      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>{label}</Text>
        <View style={[
          styles.statusBadge, 
          result.success ? styles.successBadge : styles.errorBadge
        ]}>
          <Text style={styles.statusText}>
            {result.success ? 'PASSED' : 'FAILED'}
          </Text>
        </View>
        <Text style={styles.resultMessage}>{result.message}</Text>
        {result.error && (
          <Text style={styles.errorText}>{result.error}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Supabase Test Suite' }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Supabase Test Suite</Text>
          <Text style={styles.subtitle}>
            {isSupabaseConfigured() 
              ? 'Supabase is configured' 
              : 'Supabase is not configured'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          
          {isRunningTests ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={styles.loadingText}>Running tests...</Text>
            </View>
          ) : testResults ? (
            <>
              {renderTestResult('Connection Test', testResults.connectionTest)}
              {renderTestResult('Authentication Test', testResults.authTest)}
              {renderTestResult('Matches Test', testResults.matchesTest)}
              {renderTestResult('Messages Test', testResults.messagesTest)}
            </>
          ) : (
            <Text style={styles.noResultsText}>No test results available</Text>
          )}
          
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={handleRunTests}
            disabled={isRunningTests}
          >
            <Text style={styles.buttonText}>
              {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Data Management</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton, styles.halfButton]} 
              onPress={handleSeedData}
              disabled={isSeeding}
            >
              <Text style={styles.buttonText}>
                {isSeeding ? 'Seeding...' : 'Seed Test Data'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.dangerButton, styles.halfButton]} 
              onPress={handleClearData}
              disabled={isClearing}
            >
              <Text style={styles.buttonText}>
                {isClearing ? 'Clearing...' : 'Clear Test Data'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication Tests</Text>
          
          <Input
            label="Test Email"
            value={testEmail}
            onChangeText={setTestEmail}
            placeholder="Enter test email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Input
            label="Test Password"
            value={testPassword}
            onChangeText={setTestPassword}
            placeholder="Enter test password"
            secureTextEntry
          />
          
          <View style={styles.buttonRow}>
            <Button
              title={isRunningAuthTest ? 'Testing...' : 'Test Signup'}
              onPress={() => handleTestAuth(true)}
              disabled={isRunningAuthTest}
              style={styles.halfButton}
            />
            
            <Button
              title={isRunningAuthTest ? 'Testing...' : 'Test Login'}
              onPress={() => handleTestAuth(false)}
              disabled={isRunningAuthTest}
              style={styles.halfButton}
              variant="secondary"
            />
          </View>
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
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
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
  },
  section: {
    marginBottom: 24,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.dark.textDim,
  },
  noResultsText: {
    fontSize: 16,
    color: Colors.dark.textDim,
    textAlign: 'center',
    padding: 24,
  },
  resultCard: {
    backgroundColor: Colors.dark.cardAlt,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  successBadge: {
    backgroundColor: '#2ecc71',
  },
  errorBadge: {
    backgroundColor: '#e74c3c',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultMessage: {
    fontSize: 14,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    marginTop: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: Colors.dark.primary,
  },
  secondaryButton: {
    backgroundColor: Colors.dark.secondary,
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  halfButton: {
    flex: 0.48,
  },
});
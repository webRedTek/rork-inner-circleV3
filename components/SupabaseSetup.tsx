import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { Input } from './Input';
import { Button } from './Button';
import { initSupabase, isSupabaseConfigured, testSupabaseConnection } from '@/lib/supabase';
import { hasSeededDemoData } from '@/utils/seed-supabase';
import { Database } from 'lucide-react-native';

interface SupabaseSetupProps {
  onSetupComplete: () => void;
}

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

export function SupabaseSetup({ onSetupComplete }: SupabaseSetupProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [keyError, setKeyError] = useState('');
  const [testStatus, setTestStatus] = useState<{success: boolean, message: string, error?: string;} | null>(null);
  
  const validateInputs = () => {
    let isValid = true;
    
    if (!supabaseUrl.trim()) {
      setUrlError('Supabase URL is required');
      isValid = false;
    } else if (!supabaseUrl.includes('supabase.co')) {
      setUrlError('Please enter a valid Supabase URL');
      isValid = false;
    } else {
      setUrlError('');
    }
    
    if (!supabaseKey.trim()) {
      setKeyError('Supabase Anon Key is required');
      isValid = false;
    } else if (supabaseKey.length < 20) {
      setKeyError('Please enter a valid Supabase Anon Key');
      isValid = false;
    } else {
      setKeyError('');
    }
    
    return isValid;
  };
  
  const handleSave = async () => {
    if (!validateInputs()) return;
    
    setLoading(true);
    setTestStatus(null);
    
    try {
      console.log('Saving Supabase configuration...');
      
      // Store Supabase credentials in AsyncStorage
      await AsyncStorage.setItem('SUPABASE_URL', supabaseUrl.trim());
      await AsyncStorage.setItem('SUPABASE_KEY', supabaseKey.trim());
      
      // Try to initialize Supabase with the new credentials
      const initialized = await initSupabase();
      
      if (initialized && isSupabaseConfigured()) {
        console.log('Supabase initialized successfully, testing connection...');
        
        // Test the connection
        const testResult = await testSupabaseConnection();
        
        if (testResult.success) {
          setTestStatus({
            success: true,
            message: 'Connection test successful!'
          });
          
          Alert.alert(
            'Success', 
            'Supabase configuration saved and connection verified successfully!',
            [{ text: 'OK', onPress: onSetupComplete }]
          );
        } else {
          setTestStatus({
            success: false,
            message: `Connection test failed`,
            error: getReadableError(testResult.error),
          });
          
          Alert.alert(
            'Partial Success', 
            'Supabase configuration saved, but connection test failed. You may need to check your database setup.',
            [{ text: 'OK', onPress: onSetupComplete }]
          );
        }
      } else {
        throw new Error('Failed to initialize Supabase with the provided credentials');
      }
    } catch (error) {
      console.error('Error saving Supabase configuration:', getReadableError(error));
      
      setTestStatus({
        success: false,
        message: 'Failed to connect to Supabase',
        error: getReadableError(error),
      });
      
      Alert.alert(
        'Error', 
        `Failed to connect to Supabase: ${getReadableError(error)}`
      );
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Connecting to Supabase...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.title}>Configure Supabase</Text>
        <Text style={styles.description}>
          To use Supabase features, please enter your Supabase project URL and anon key.
          You can find these in your Supabase project settings.
        </Text>
      </View>
      
      <View style={styles.form}>
        <Input
          label="Supabase URL"
          value={supabaseUrl}
          onChangeText={(text) => {
            setSupabaseUrl(text);
            setUrlError('');
          }}
          placeholder="https://your-project.supabase.co"
          error={urlError}
          autoCapitalize="none"
          keyboardType="url"
        />
        
        <Input
          label="Supabase Anon Key"
          value={supabaseKey}
          onChangeText={(text) => {
            setSupabaseKey(text);
            setKeyError('');
          }}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          error={keyError}
          autoCapitalize="none"
        />
        
        {testStatus && (
          <View style={[
            styles.testStatusContainer,
            testStatus.success ? styles.testSuccessContainer : styles.testErrorContainer
          ]}>
            <Text style={[
              styles.testStatusText,
              testStatus.success ? styles.testSuccessText : styles.testErrorText
            ]}>
              {testStatus.message}
            </Text>
						{testStatus.error && !testStatus.success && (
            <Text style={[styles.testStatusText, styles.testErrorText]}>
            Details: {testStatus.error}
            </Text>
            )}
          </View>
        )}
        
        <Button
          title="Save Configuration"
          onPress={handleSave}
          variant="primary"
          icon={<Database size={18} color={Colors.dark.text} />}
          style={styles.saveButton}
          loading={loading}
        />
      </View>
      
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          Don't have a Supabase project? Visit supabase.com to create one.
        </Text>
        <Text style={styles.helpText}>
          Make sure your Supabase project has the required tables and RLS policies.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  infoContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    lineHeight: 24,
  },
  form: {
    marginBottom: 24,
  },
  testStatusContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  testSuccessContainer: {
    backgroundColor: Colors.dark.success + '20',
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  testErrorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  testStatusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  testSuccessText: {
    color: Colors.dark.success,
  },
  testErrorText: {
    color: Colors.dark.error,
  },
  saveButton: {
    marginTop: 16,
  },
  helpContainer: {
    marginTop: 16,
  },
  helpText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
});
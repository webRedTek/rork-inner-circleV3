import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { Input } from './Input';
import { Button } from './Button';
import { initSupabase, isSupabaseConfigured, testSupabaseConnection, checkNetworkStatus } from '@/lib/supabase';
import { Database, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';

interface SupabaseSetupProps {
  onSetupComplete: () => void;
}

export function SupabaseSetup({ onSetupComplete }: SupabaseSetupProps) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [keyError, setKeyError] = useState('');
  const [testStatus, setTestStatus] = useState<{success: boolean, message: string} | null>(null);
  const [networkStatus, setNetworkStatus] = useState<{isConnected: boolean | null}>({isConnected: null});
  const [checkingNetwork, setCheckingNetwork] = useState(false);
  
  useEffect(() => {
    checkNetwork();
    loadSavedConfig();
  }, []);
  
  const checkNetwork = async () => {
    setCheckingNetwork(true);
    try {
      const status = await checkNetworkStatus();
      setNetworkStatus(status);
    } catch (error) {
      console.error('Error checking network:', error);
    } finally {
      setCheckingNetwork(false);
    }
  };
  
  const loadSavedConfig = async () => {
    try {
      const savedUrl = await AsyncStorage.getItem('SUPABASE_URL');
      const savedKey = await AsyncStorage.getItem('SUPABASE_KEY');
      
      if (savedUrl) setSupabaseUrl(savedUrl);
      if (savedKey) setSupabaseKey(savedKey);
    } catch (error) {
      console.error('Error loading saved config:', error);
    }
  };
  
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
    
    // Check network status before attempting to save
    await checkNetwork();
    if (networkStatus.isConnected === false) {
      setTestStatus({
        success: false,
        message: 'Network appears to be offline. Please check your internet connection.'
      });
      return;
    }
    
    setLoading(true);
    setTestStatus(null);
    
    try {
      await AsyncStorage.setItem('SUPABASE_URL', supabaseUrl.trim());
      await AsyncStorage.setItem('SUPABASE_KEY', supabaseKey.trim());
      
      // Try to initialize with retry logic
      const initialized = await initSupabase();
      
      if (initialized && isSupabaseConfigured()) {
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
          let errorMessage = 'Connection test failed';
          
          if (testResult.networkStatus?.isConnected === false) {
            errorMessage = 'Network appears to be offline. Please check your internet connection.';
          } else if (testResult.error) {
            errorMessage += ': ' + testResult.error;
          }
          
          setTestStatus({
            success: false,
            message: errorMessage
          });
          
          Alert.alert(
            'Error', 
            errorMessage,
            [{ text: 'OK' }]
          );
        }
      } else {
        throw new Error('Failed to initialize Supabase');
      }
    } catch (error) {
      console.error('Error saving Supabase configuration:', error);
      
      let errorMessage = 'Failed to connect to Supabase';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || 
            error.message.includes('Network') || 
            error.message.includes('offline')) {
          errorMessage = 'Network error: Please check your internet connection and try again.';
        } else {
          errorMessage += ': ' + error.message;
        }
      }
      
      setTestStatus({
        success: false,
        message: errorMessage
      });
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRetryConnection = async () => {
    setTestStatus(null);
    await checkNetwork();
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
      
      {networkStatus.isConnected === false && (
        <View style={styles.networkErrorContainer}>
          <WifiOff size={20} color={Colors.dark.error} />
          <Text style={styles.networkErrorText}>
            Network appears to be offline. Please check your internet connection.
          </Text>
          <Button
            title="Check Connection"
            onPress={handleRetryConnection}
            variant="outline"
            size="small"
            icon={<RefreshCw size={16} color={Colors.dark.text} />}
            loading={checkingNetwork}
            style={styles.retryButton}
          />
        </View>
      )}
      
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
            
            {!testStatus.success && testStatus.message.includes('Network') && (
              <Button
                title="Check Connection"
                onPress={handleRetryConnection}
                variant="outline"
                size="small"
                icon={<RefreshCw size={16} color={Colors.dark.error} />}
                loading={checkingNetwork}
                style={styles.errorRetryButton}
              />
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
          disabled={networkStatus.isConnected === false}
        />
      </View>
      
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          Don't have a Supabase project? Visit supabase.com to create one.
        </Text>
      </View>
      
      <View style={styles.networkStatusContainer}>
        <View style={styles.networkStatusRow}>
          {networkStatus.isConnected === true ? (
            <Wifi size={16} color={Colors.dark.success} />
          ) : networkStatus.isConnected === false ? (
            <WifiOff size={16} color={Colors.dark.error} />
          ) : (
            <Wifi size={16} color={Colors.dark.textSecondary} />
          )}
          <Text style={styles.networkStatusText}>
            {networkStatus.isConnected === true
              ? 'Network Connected'
              : networkStatus.isConnected === false
                ? 'Network Offline'
                : 'Network Status Unknown'}
          </Text>
          
          <Button
            title="Check"
            onPress={handleRetryConnection}
            variant="text"
            size="small"
            icon={<RefreshCw size={14} color={Colors.dark.accent} />}
            loading={checkingNetwork}
            style={styles.networkCheckButton}
          />
        </View>
        
        {networkStatus.type && (
          <Text style={styles.networkTypeText}>
            Connection type: {networkStatus.type}
          </Text>
        )}
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
  networkErrorContainer: {
    backgroundColor: Colors.dark.error + '20',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.error,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  networkErrorText: {
    color: Colors.dark.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 8,
  },
  errorRetryButton: {
    marginTop: 12,
    alignSelf: 'center',
  },
  networkStatusContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
  },
  networkStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkStatusText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  networkTypeText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    marginLeft: 24,
  },
  networkCheckButton: {
    marginLeft: 8,
  },
});
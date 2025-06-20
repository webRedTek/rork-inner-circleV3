import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/store/auth-store';
import { checkNetworkStatus } from '@/lib/supabase';
import { WifiOff, RefreshCw } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<{isConnected: boolean | null}>({isConnected: null});
  const [checkingNetwork, setCheckingNetwork] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);
  
  useEffect(() => {
    checkNetwork();
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
  
  useEffect(() => {
    if (error) {
      // Check if it's a network-related error
      if (error.includes('Failed to fetch') || 
          error.includes('Network') || 
          error.includes('offline') ||
          error.includes('AuthRetryableFetchError')) {
        setLoginError('Network error: Please check your internet connection and try again.');
        checkNetwork(); // Re-check network status
      } else {
        setLoginError(error);
      }
      clearError();
    }
  }, [error, clearError]);
  
  const validateForm = () => {
    let isValid = true;
    setLoginError('');
    
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email');
      isValid = false;
    } else {
      setEmailError('');
    }
    
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else {
      setPasswordError('');
    }
    
    return isValid;
  };
  
  const handleLogin = async () => {
    if (validateForm()) {
      try {
        // Check network status before attempting login
        const status = await checkNetworkStatus();
        setNetworkStatus(status);
        
        if (status.isConnected === false) {
          setLoginError('Network error: Please check your internet connection and try again.');
          return;
        }
        
        setLocalLoading(true);
        console.log('Attempting login with:', email);
        await login(email, password);
        setLocalLoading(false);
      } catch (err) {
        console.error('Login error in component:', 
          err instanceof Error ? err.message : 'Unknown error');
        
        // Check if it's a network-related error
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('Failed to fetch') || 
            errorMsg.includes('Network') || 
            errorMsg.includes('offline') ||
            errorMsg.includes('AuthRetryableFetchError')) {
          setLoginError('Network error: Please check your internet connection and try again.');
          checkNetwork(); // Re-check network status
        } else {
          setLoginError('Login failed. Please check your credentials or network connection.');
        }
        
        setLocalLoading(false);
      }
    }
  };
  
  const handleSupabaseSetup = () => {
    router.push('/supabase-setup');
  };
  
  const handleRetryConnection = async () => {
    setLoginError('');
    await checkNetwork();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to your Inner Circle account</Text>
        </View>
        
        {networkStatus.isConnected === false && (
          <View style={styles.networkErrorContainer}>
            <WifiOff size={20} color={Colors.dark.error} />
            <Text style={styles.networkErrorText}>
              Network appears to be offline. Please check your internet connection.
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={handleRetryConnection}
              disabled={checkingNetwork}
            >
              {checkingNetwork ? (
                <ActivityIndicator size="small" color={Colors.dark.text} />
              ) : (
                <View style={styles.retryButtonContent}>
                  <RefreshCw size={16} color={Colors.dark.text} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
              setLoginError('');
            }}
            placeholder="Enter your email"
            keyboardType="email-address"
            error={emailError}
            autoCapitalize="none"
            editable={!isLoading && !localLoading}
          />
          
          <Input
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
              setLoginError('');
            }}
            placeholder="Enter your password"
            secureTextEntry
            error={passwordError}
            editable={!isLoading && !localLoading}
          />
          
          {loginError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{loginError}</Text>
              
              {(loginError.includes('Network') || loginError.includes('Failed to fetch') || loginError.includes('offline')) && (
                <TouchableOpacity 
                  style={styles.errorRetryButton}
                  onPress={handleRetryConnection}
                  disabled={checkingNetwork}
                >
                  {checkingNetwork ? (
                    <ActivityIndicator size="small" color={Colors.dark.error} />
                  ) : (
                    <View style={styles.retryButtonContent}>
                      <RefreshCw size={16} color={Colors.dark.error} />
                      <Text style={styles.errorRetryText}>Check Connection</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          
          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={() => Alert.alert("Reset Password", "This feature is not implemented yet.")}
            disabled={isLoading || localLoading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
          
          <Button
            title="Log In"
            onPress={handleLogin}
            variant="primary"
            size="large"
            loading={isLoading || localLoading}
            style={styles.button}
            disabled={networkStatus.isConnected === false}
          />
          
          <Button
            title="Configure Supabase"
            onPress={handleSupabaseSetup}
            variant="outline"
            size="medium"
            style={styles.configButton}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don't have an account?{' '}
            <Text style={styles.signupLink} onPress={() => router.push('/signup')}>
              Sign Up
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: Colors.dark.accent,
    fontSize: 14,
  },
  button: {
    marginBottom: 16,
  },
  configButton: {
    marginBottom: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  signupLink: {
    color: Colors.dark.accent,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
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
    backgroundColor: Colors.dark.card,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  retryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '500',
  },
  errorRetryButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRetryText: {
    color: Colors.dark.error,
    fontSize: 14,
    fontWeight: '500',
  },
});
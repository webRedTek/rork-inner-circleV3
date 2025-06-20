import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { isSupabaseConfigured, testSupabaseConnection, checkNetworkStatus } from '@/lib/supabase';
import { CheckCircle2, XCircle, AlertCircle, Database, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';

export function SupabaseStatus() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'error'>('untested');
  const [networkStatus, setNetworkStatus] = useState<{isConnected: boolean | null}>({isConnected: null});
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    checkSupabaseStatus();
  }, []);
  
  const checkSupabaseStatus = async () => {
    try {
      setLoading(true);
      setErrorDetails(null);
      
      // First check network connectivity
      const netStatus = await checkNetworkStatus();
      setNetworkStatus(netStatus);
      
      if (netStatus.isConnected === false) {
        setErrorDetails("Network appears to be offline. Please check your internet connection.");
      }
      
      const configured = isSupabaseConfigured();
      setIsConfigured(configured);
      
      if (configured) {
        const testResult = await testSupabaseConnection();
        setConnectionStatus(testResult.success ? 'success' : 'error');
        
        if (!testResult.success && testResult.error) {
          setErrorDetails(String(testResult.error));
        }
      }
    } catch (error) {
      console.error('Error checking Supabase status:', error);
      setConnectionStatus('error');
      setErrorDetails(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handlePress = () => {
    if (!isConfigured || connectionStatus === 'error') {
      router.push('/supabase-setup');
    }
  };
  
  const handleRefresh = async () => {
    await checkSupabaseStatus();
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Checking Supabase status...</Text>
      </View>
    );
  }
  
  if (isConfigured === null) {
    return null;
  }
  
  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        isConfigured 
          ? connectionStatus === 'success' 
            ? styles.configuredContainer 
            : styles.errorContainer
          : styles.notConfiguredContainer
      ]}
      onPress={handlePress}
      disabled={isConfigured && connectionStatus === 'success'}
    >
      <View style={styles.content}>
        <View style={styles.statusRow}>
          {isConfigured ? (
            connectionStatus === 'success' ? (
              <CheckCircle2 size={20} color={Colors.dark.success} />
            ) : (
              <AlertCircle size={20} color={Colors.dark.warning} />
            )
          ) : (
            <XCircle size={20} color={Colors.dark.error} />
          )}
          <Text style={styles.text}>
            {isConfigured 
              ? connectionStatus === 'success'
                ? 'Supabase Connected'
                : 'Supabase Connection Issue'
              : 'Supabase Not Connected'}
          </Text>
          
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <RefreshCw size={16} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.networkRow}>
          {networkStatus.isConnected === true ? (
            <Wifi size={16} color={Colors.dark.success} />
          ) : networkStatus.isConnected === false ? (
            <WifiOff size={16} color={Colors.dark.error} />
          ) : (
            <Wifi size={16} color={Colors.dark.textSecondary} />
          )}
          <Text style={styles.networkText}>
            {networkStatus.isConnected === true
              ? 'Network Connected'
              : networkStatus.isConnected === false
                ? 'Network Offline'
                : 'Network Status Unknown'}
          </Text>
        </View>
      </View>
      
      {errorDetails && (
        <View style={styles.errorDetailsContainer}>
          <Text style={styles.errorDetailsText}>{errorDetails}</Text>
        </View>
      )}
      
      {(!isConfigured || connectionStatus === 'error') && (
        <View style={styles.actionContainer}>
          <Database size={16} color={Colors.dark.accent} />
          <Text style={styles.tapText}>Tap to configure</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  configuredContainer: {
    backgroundColor: Colors.dark.success + '20',
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  notConfiguredContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  errorContainer: {
    backgroundColor: Colors.dark.warning + '20',
    borderWidth: 1,
    borderColor: Colors.dark.warning,
  },
  content: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
    marginLeft: 8,
    flex: 1,
  },
  networkText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginLeft: 8,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 28,
  },
  tapText: {
    fontSize: 12,
    color: Colors.dark.accent,
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: 8,
  },
  errorDetailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  errorDetailsText: {
    fontSize: 12,
    color: Colors.dark.error,
    lineHeight: 16,
  },
  refreshButton: {
    padding: 4,
  },
});
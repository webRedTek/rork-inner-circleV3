import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { isSupabaseConfigured, testSupabaseConnection } from '@/lib/supabase';
import { CheckCircle2, XCircle, AlertCircle, Database } from 'lucide-react-native';

export function SupabaseStatus() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'success' | 'error'>('untested');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    checkSupabaseStatus();
  }, []);
  
  const checkSupabaseStatus = async () => {
    try {
      setLoading(true);
      const configured = isSupabaseConfigured();
      setIsConfigured(configured);
      
      if (configured) {
        const testResult = await testSupabaseConnection();
        setConnectionStatus(testResult.success ? 'success' : 'error');
      }
    } catch (error) {
      console.error('Error checking Supabase status:', error);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePress = () => {
    if (!isConfigured || connectionStatus === 'error') {
      router.push('/supabase-setup');
    }
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
      </View>
      
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
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
});
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';
import { isSupabaseConfigured } from '@/lib/supabase';
import { introspectSupabaseSchema, getGeneratedTypes, clearGeneratedTypes } from '@/utils/supabase-schema-introspector';
import { Database, Copy, RefreshCw, Trash2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export default function SupabaseSchemaScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generatedTypes, setGeneratedTypes] = useState<string | null>(null);
  const [isSupabaseReady, setIsSupabaseReady] = useState<boolean>(false);
  
  useEffect(() => {
    checkSupabaseStatus();
    loadGeneratedTypes();
  }, []);
  
  const checkSupabaseStatus = () => {
    const configured = isSupabaseConfigured();
    setIsSupabaseReady(configured);
    
    if (!configured) {
      Alert.alert(
        "Supabase Not Configured",
        "Supabase is not configured. Please configure Supabase first.",
        [
          {
            text: "Configure Now",
            onPress: () => router.push('/supabase-setup')
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => router.back()
          }
        ]
      );
    }
  };
  
  const loadGeneratedTypes = async () => {
    const types = await getGeneratedTypes();
    setGeneratedTypes(types);
  };
  
  const handleGenerateTypes = async () => {
    setLoading(true);
    try {
      const types = await introspectSupabaseSchema();
      setGeneratedTypes(types);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyToClipboard = async () => {
    if (generatedTypes) {
      await Clipboard.setStringAsync(generatedTypes);
      Alert.alert("Success", "Types copied to clipboard");
    }
  };
  
  const handleClearTypes = async () => {
    Alert.alert(
      "Clear Generated Types",
      "Are you sure you want to clear the generated types?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearGeneratedTypes();
            setGeneratedTypes(null);
          }
        }
      ]
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Introspecting Supabase schema...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Supabase Schema' }} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Supabase Schema Introspection</Text>
          <Text style={styles.description}>
            Generate TypeScript types from your Supabase database schema. This will help you ensure type safety when working with your database.
          </Text>
        </View>
        
        <View style={styles.actionsContainer}>
          <Button
            title="Generate Types"
            onPress={handleGenerateTypes}
            variant="primary"
            icon={<Database size={18} color={Colors.dark.text} />}
            style={styles.button}
            disabled={!isSupabaseReady}
          />
          
          {generatedTypes && (
            <>
              <Button
                title="Copy to Clipboard"
                onPress={handleCopyToClipboard}
                variant="outline"
                icon={<Copy size={18} color={Colors.dark.text} />}
                style={styles.button}
              />
              
              <Button
                title="Clear Types"
                onPress={handleClearTypes}
                variant="outline"
                icon={<Trash2 size={18} color={Colors.dark.error} />}
                style={styles.button}
              />
            </>
          )}
        </View>
        
        {generatedTypes ? (
          <View style={styles.typesContainer}>
            <View style={styles.typesHeader}>
              <Text style={styles.typesTitle}>Generated Types</Text>
              <TouchableOpacity onPress={handleCopyToClipboard} style={styles.copyButton}>
                <Copy size={16} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.codeScrollView} horizontal={false}>
              <Text style={styles.codeText}>{generatedTypes}</Text>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No types generated yet. Click "Generate Types" to introspect your Supabase schema.
            </Text>
          </View>
        )}
        
        <View style={styles.usageContainer}>
          <Text style={styles.usageTitle}>How to Use</Text>
          <Text style={styles.usageText}>
            1. Generate types by clicking the "Generate Types" button above.
          </Text>
          <Text style={styles.usageText}>
            2. Copy the generated types to your clipboard.
          </Text>
          <Text style={styles.usageText}>
            3. Create a new file in your project's types directory (e.g., types/supabase-schema.ts).
          </Text>
          <Text style={styles.usageText}>
            4. Paste the generated types into the file.
          </Text>
          <Text style={styles.usageText}>
            5. Import and use the types in your code:
          </Text>
          <View style={styles.codeExample}>
            <Text style={styles.codeExampleText}>
              {`import { SupabaseSchema } from '@/types/supabase-schema';

// Use the types
const user: SupabaseSchema.Users = { ... };

// Convert from snake_case to camelCase
const camelCaseUser = SupabaseSchema.convertToCamelCase(userFromSupabase);

// Convert from camelCase to snake_case
const snakeCaseUser = SupabaseSchema.convertToSnakeCase(userForSupabase);`}
            </Text>
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
  header: {
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    margin: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    gap: 8,
  },
  button: {
    flex: 1,
    minWidth: '48%',
  },
  typesContainer: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    margin: 16,
    padding: 16,
    maxHeight: 400,
  },
  typesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  copyButton: {
    padding: 4,
  },
  codeScrollView: {
    backgroundColor: Colors.dark.background + '80',
    borderRadius: 8,
    padding: 12,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  emptyContainer: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    margin: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  usageContainer: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    margin: 16,
    padding: 16,
    marginBottom: 32,
  },
  usageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  usageText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  codeExample: {
    backgroundColor: Colors.dark.background + '80',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  codeExampleText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
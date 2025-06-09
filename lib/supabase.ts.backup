import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Define the database schema types
export type Database = {
  public: {
    tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          bio: string | null;
          location: string | null;
          zip_code: string | null;
          business_field: string;
          entrepreneur_status: string;
          photo_url: string | null;
          membership_tier: string;
          business_verified: boolean;
          joined_groups: string[] | null;
          created_at: number;
          skills_offered: string[] | null;
          skills_seeking: string[] | null;
          industry_focus: string | null;
          business_stage: string | null;
          key_challenge: string | null;
          availability_level: string[] | null;
          timezone: string | null;
          success_highlight: string | null;
          looking_for: string[] | null;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          bio?: string | null;
          location?: string | null;
          zip_code?: string | null;
          business_field: string;
          entrepreneur_status: string;
          photo_url?: string | null;
          membership_tier?: string;
          business_verified?: boolean;
          joined_groups?: string[] | null;
          created_at?: number;
          skills_offered?: string[] | null;
          skills_seeking?: string[] | null;
          industry_focus?: string | null;
          business_stage?: string | null;
          key_challenge?: string | null;
          availability_level?: string[] | null;
          timezone?: string | null;
          success_highlight?: string | null;
          looking_for?: string[] | null;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          bio?: string | null;
          location?: string | null;
          zip_code?: string | null;
          business_field?: string;
          entrepreneur_status?: string;
          photo_url?: string | null;
          membership_tier?: string;
          business_verified?: boolean;
          joined_groups?: string[] | null;
          created_at?: number;
          skills_offered?: string[] | null;
          skills_seeking?: string[] | null;
          industry_focus?: string | null;
          business_stage?: string | null;
          key_challenge?: string | null;
          availability_level?: string[] | null;
          timezone?: string | null;
          success_highlight?: string | null;
          looking_for?: string[] | null;
        };
      };
      // Add other tables as needed
    };
  };
};

// Define the connection test result type
export type ConnectionTestResult = {
  success: boolean;
  error?: any;
};

/**
 * Converts error objects to readable strings
 */
export const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error';
  
  // Handle string errors
  if (typeof error === 'string') return error;
  
  // Handle Error objects
  if (error instanceof Error) return error.message;
  
  // Handle Supabase-style errors
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  if (error.hint) return error.hint;
  
  // Handle network errors
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return 'Connection failed: TypeError: Failed to fetch';
  }
  
  // Handle objects with error properties
  if (typeof error === 'object') {
    if (error.error) return getReadableError(error.error);
    if (error.details) return error.details;
    if (error.description) return error.description;
  }
  
  // Fallback - stringify the error object
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unparseable error object';
  }
};

// Initialize supabase client with proper typing
let supabase: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Checks if Supabase is configured in the environment
 */
export const isSupabaseConfigured = (): boolean => {
  const supabaseUrl = 
    process.env.EXPO_PUBLIC_SUPABASE_URL || 
    Constants.expoConfig?.extra?.supabaseUrl;
  
  const supabaseAnonKey = 
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
    Constants.expoConfig?.extra?.supabaseAnonKey;

  console.log('Supabase config check:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey,
    envVars: Object.keys(process.env).filter(key => key.startsWith('EXPO_')),
    constantsExtra: Constants.expoConfig?.extra ? Object.keys(Constants.expoConfig.extra) : 'no extra'
  });

  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Initializes the Supabase client with session pooler for production scale
 * @returns boolean indicating if initialization was successful
 */
export const initSupabase = async (): Promise<boolean> => {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.');
      return false;
    }

    const baseUrl = 
      process.env.EXPO_PUBLIC_SUPABASE_URL || 
      Constants.expoConfig?.extra?.supabaseUrl;
    
    const supabaseAnonKey = 
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
      Constants.expoConfig?.extra?.supabaseAnonKey;

    if (!baseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key is missing');
      return false;
    }

    // 🚀 SESSION POOLER CONFIGURATION FOR PRODUCTION SCALE
    // For 1000s of concurrent users, use session pooler for better connection management
    let supabaseUrl = baseUrl;
    
    // Check if we should use session pooler (recommended for production)
    const useSessionPooler = process.env.EXPO_PUBLIC_USE_SESSION_POOLER !== 'false';
    
    if (useSessionPooler) {
      // Convert direct URL to session pooler endpoint
      // Example: https://project.supabase.co -> https://project.supabase.co:5432
      if (!baseUrl.includes(':5432') && !baseUrl.includes(':6543')) {
        supabaseUrl = baseUrl.replace(/\/$/, '') + ':5432';
        console.log('🔧 Using session pooler for production scale:', supabaseUrl.substring(0, 30) + '...');
      }
    }

    console.log('🚀 Initializing Supabase with:', {
      url: supabaseUrl.substring(0, 30) + '...',
      pooler: useSessionPooler,
      production: process.env.NODE_ENV === 'production'
    });

    // Create the Supabase client optimized for high concurrency
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        // 🏆 Production auth settings for session pooler
        flowType: 'pkce',
      },
      // Optimized for session pooler and high concurrency
      db: {
        schema: 'public',
      },
      // Completely disable realtime to avoid Node.js stream dependency issues
      realtime: {
        params: {
          eventsPerSecond: 0,
        }
      },
      global: {
        // Custom headers for session pooler optimization
        headers: {
          'x-client-info': 'inner-circle-mobile@1.0.0',
          'x-connection-pooling': 'session'
        },
        // Enhanced fetch configuration for session pooler
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // Timeout configuration for production
            signal: AbortSignal.timeout(30000), // 30 second timeout
            headers: {
              ...options.headers,
              'Connection': 'keep-alive',
              'Keep-Alive': 'timeout=30, max=1000'
            }
          });
        }
      }
    });

    console.log('✅ Supabase client initialized successfully with session pooler');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Supabase:', getReadableError(error));
    return false;
  }
};

/**
 * Tests the Supabase connection with session pooler optimized queries
 * @returns Object with success status and optional error
 */
export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  try {
    if (!supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    console.log('🔍 Testing Supabase connection with session pooler...');

    // Test 1: Simple health check using RPC (works well with session pooler)
    const { data: healthData, error: healthError } = await supabase
      .rpc('version', {});

    if (healthError && !healthError.message?.includes('function') && !healthError.message?.includes('does not exist')) {
      // If it's not a "function doesn't exist" error, it's a real connection issue
      console.error('🚨 Health check failed:', healthError);
      return { success: false, error: getReadableError(healthError) };
    }

    // Test 2: Try a simple table query with session pooler optimization
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })
      .limit(0);

    if (error) {
      console.error('🚨 Database query test failed:', error);
      return { success: false, error: getReadableError(error) };
    }

    console.log('✅ Session pooler connection test successful');
    return { success: true };
  } catch (error) {
    console.error('🚨 Connection test exception:', error);
    return { success: false, error: getReadableError(error) };
  }
};

/**
 * Clears Supabase configuration and resets the client
 */
export const clearSupabaseConfig = async (): Promise<void> => {
  try {
    // Sign out if there's an active session
    if (supabase?.auth) {
      await supabase.auth.signOut();
    }
    
    // Reset the client
    supabase = null;
    
    console.log('Supabase configuration cleared');
  } catch (error) {
    console.error('Error clearing Supabase configuration:', error);
    throw error;
  }
};

/**
 * Helper function to convert snake_case object keys to camelCase
 */
export const convertToCamelCase = (obj: Record<string, any>): Record<string, any> => {
  if (!obj || typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertToCamelCase(item));
  }
  
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = obj[key];
    
    acc[camelKey] = value && typeof value === 'object' ? convertToCamelCase(value) : value;
    return acc;
  }, {} as Record<string, any>);
};

/**
 * Helper function to convert camelCase object keys to snake_case
 */
export const convertToSnakeCase = (obj: Record<string, any>): Record<string, any> => {
  if (!obj || typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertToSnakeCase(item));
  }
  
  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    const value = obj[key];
    
    acc[snakeKey] = value && typeof value === 'object' && !Array.isArray(value) 
      ? convertToSnakeCase(value) 
      : value;
    return acc;
  }, {} as Record<string, any>);
};

// Export the supabase client
export { supabase };
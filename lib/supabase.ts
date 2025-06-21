import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { MatchWithProfile } from '@/types/user';

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
      app_settings: {
        Row: {
          id: string;
          tier: string;
          daily_swipe_limit: number;
          daily_match_limit: number;
          message_sending_limit: number;
          can_see_who_liked_you: boolean;
          can_rewind_last_swipe: boolean;
          boost_duration: number;
          boost_frequency: number;
          profile_visibility_control: boolean;
          priority_listing: boolean;
          premium_filters_access: boolean;
          global_discovery: boolean;
          created_at: string;
          updated_at: string;
          groups_limit: number;
          groups_creation_limit: number;
          featured_portfolio_limit: number;
          events_per_month: number;
          can_create_groups: boolean;
          has_business_verification: boolean;
          has_advanced_analytics: boolean;
          has_priority_inbox: boolean;
          can_send_direct_intro: boolean;
          has_virtual_meeting_room: boolean;
          has_custom_branding: boolean;
          has_dedicated_support: boolean;
        };
        Insert: {
          id?: string;
          tier: string;
          daily_swipe_limit: number;
          daily_match_limit: number;
          message_sending_limit: number;
          can_see_who_liked_you: boolean;
          can_rewind_last_swipe: boolean;
          boost_duration: number;
          boost_frequency: number;
          profile_visibility_control: boolean;
          priority_listing: boolean;
          premium_filters_access: boolean;
          global_discovery: boolean;
          created_at?: string;
          updated_at?: string;
          groups_limit?: number;
          groups_creation_limit?: number;
          featured_portfolio_limit?: number;
          events_per_month?: number;
          can_create_groups?: boolean;
          has_business_verification?: boolean;
          has_advanced_analytics?: boolean;
          has_priority_inbox?: boolean;
          can_send_direct_intro?: boolean;
          has_virtual_meeting_room?: boolean;
          has_custom_branding?: boolean;
          has_dedicated_support?: boolean;
        };
        Update: {
          id?: string;
          tier?: string;
          daily_swipe_limit?: number;
          daily_match_limit?: number;
          message_sending_limit?: number;
          can_see_who_liked_you?: boolean;
          can_rewind_last_swipe?: boolean;
          boost_duration?: number;
          boost_frequency?: number;
          profile_visibility_control?: boolean;
          priority_listing?: boolean;
          premium_filters_access?: boolean;
          global_discovery?: boolean;
          updated_at?: string;
          groups_limit?: number;
          groups_creation_limit?: number;
          featured_portfolio_limit?: number;
          events_per_month?: number;
          can_create_groups?: boolean;
          has_business_verification?: boolean;
          has_advanced_analytics?: boolean;
          has_priority_inbox?: boolean;
          can_send_direct_intro?: boolean;
          has_virtual_meeting_room?: boolean;
          has_custom_branding?: boolean;
          has_dedicated_support?: boolean;
        };
      };
      usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          action_type: string;
          count: number;
          first_action_timestamp: number;
          last_action_timestamp: number;
          reset_timestamp: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action_type: string;
          count: number;
          first_action_timestamp: number;
          last_action_timestamp: number;
          reset_timestamp: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action_type?: string;
          count?: number;
          first_action_timestamp?: number;
          last_action_timestamp?: number;
          reset_timestamp?: number;
        };
      };
    };
  };
};

// Define the connection test result type
export type ConnectionTestResult = {
  success: boolean;
  error?: any;
  networkStatus?: {
    isConnected: boolean | null;
    type?: string | null;
    isInternetReachable?: boolean | null;
  };
};

// Define swipe action type for batch processing
export type SwipeAction = {
  swiper_id: string;
  swipee_id: string;
  direction: 'left' | 'right';
  swipe_timestamp: number;
};

// Define potential matches result type
export type PotentialMatchesResult = {
  matches: any[];
  count: number;
  max_distance: number;
  is_global: boolean;
};

// Define swipe batch result type
export type SwipeBatchResult = {
  processed_swipes: SwipeAction[];
  new_matches: any[];
  swipe_limit: number;
  match_limit: number;
  swipe_count: number;
  match_count: number;
};

// Define usage counters result type
export type UsageCountersResult = {
  swipe_count: number;
  match_count: number;
  swipe_limit: number;
  match_limit: number;
  swipe_remaining: number;
  match_remaining: number;
  timestamp: number;
};

// Initialize supabase client with proper typing
let supabase: ReturnType<typeof createClient<Database>> | null = null;

// Track connection status
let lastConnectionCheck = 0;
let isConnected = true;
const CONNECTION_CHECK_INTERVAL = 60000; // 1 minute

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRY_BACKOFF_FACTOR = 1.5;

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
    hasKey: !!supabaseAnonKey
  });

  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Checks network connectivity
 * @returns Promise with network status
 */
export const checkNetworkStatus = async (): Promise<{
  isConnected: boolean | null;
  type?: string | null;
  isInternetReachable?: boolean | null;
}> => {
  try {
    const now = Date.now();
    // Only check network status every minute to avoid excessive checks
    if (now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL) {
      return { isConnected };
    }
    
    lastConnectionCheck = now;
    const netInfo = await NetInfo.fetch();
    isConnected = !!netInfo.isConnected;
    
    console.log('Network status check:', {
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      isInternetReachable: netInfo.isInternetReachable
    });
    
    return {
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      isInternetReachable: netInfo.isInternetReachable
    };
  } catch (error) {
    console.error('Error checking network status:', error);
    return { isConnected: null };
  }
};

/**
 * Initializes the Supabase client with retry logic
 * @returns boolean indicating if initialization was successful
 */
export const initSupabase = async (): Promise<boolean> => {
  try {
    // Check network connectivity first
    const networkStatus = await checkNetworkStatus();
    if (networkStatus.isConnected === false) {
      console.warn('Network appears to be offline. Supabase initialization may fail.');
    }
    
    if (!isSupabaseConfigured()) {
      console.warn('Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.');
      // Check AsyncStorage for saved values
      const savedUrl = await AsyncStorage.getItem('SUPABASE_URL');
      const savedKey = await AsyncStorage.getItem('SUPABASE_KEY');
      if (savedUrl && savedKey) {
        console.log('Using saved Supabase configuration from AsyncStorage');
        return await initWithRetry(savedUrl, savedKey);
      }
      console.error('No saved configuration found in AsyncStorage.');
      return false;
    }

    const supabaseUrl = 
      process.env.EXPO_PUBLIC_SUPABASE_URL || 
      Constants.expoConfig?.extra?.supabaseUrl;
    
    const supabaseAnonKey = 
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
      Constants.expoConfig?.extra?.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key is missing in environment variables.');
      return false;
    }

    return await initWithRetry(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Error initializing Supabase:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    return false;
  }
};

/**
 * Initialize Supabase with retry logic
 */
const initWithRetry = async (url: string, key: string, retryCount = 0): Promise<boolean> => {
  try {
    console.log(`Initializing Supabase with URL: ${url.substring(0, 15)}... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
    
    supabase = createClient<Database>(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: {
        fetch: customFetch
      }
    });
    
    // Test the connection with a simple query
    const { data, error } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
    
    if (error) {
      if (retryCount < MAX_RETRIES - 1) {
        console.warn(`Supabase initialization attempt ${retryCount + 1} failed: ${error.message}. Retrying...`);
        const delay = RETRY_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return initWithRetry(url, key, retryCount + 1);
      } else {
        throw error;
      }
    }
    
    console.log('Supabase client initialized successfully.');
    return true;
  } catch (error) {
    if (retryCount < MAX_RETRIES - 1) {
      console.warn(`Supabase initialization attempt ${retryCount + 1} failed. Retrying...`);
      const delay = RETRY_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initWithRetry(url, key, retryCount + 1);
    }
    
    console.error('All Supabase initialization attempts failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

/**
 * Custom fetch implementation with timeout and retry logic
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const timeout = 15000; // 15 seconds timeout
  
  const fetchWithTimeout = async (attempt = 0): Promise<Response> => {
    try {
      // Check network status before making request
      const networkStatus = await checkNetworkStatus();
      if (networkStatus.isConnected === false) {
        throw new Error('Network appears to be offline');
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(input, {
        ...init,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      const isTimeoutError = error instanceof Error && error.name === 'AbortError';
      const isNetworkError = error instanceof Error && 
        (error.message.includes('Network') || 
         error.message.includes('Failed to fetch') ||
         error.message.includes('offline'));
      
      if ((isTimeoutError || isNetworkError) && attempt < MAX_RETRIES - 1) {
        console.warn(`Fetch attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying...`);
        const delay = RETRY_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithTimeout(attempt + 1);
      }
      
      throw error;
    }
  };
  
  return fetchWithTimeout();
};

/**
 * Tests the Supabase connection with a simple query to app_settings table
 * @returns Object with success status and optional error
 */
export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  try {
    // Check network connectivity first
    const networkStatus = await checkNetworkStatus();
    
    if (networkStatus.isConnected === false) {
      console.warn('Network appears to be offline. Connection test will likely fail.');
      return { 
        success: false, 
        error: 'Network appears to be offline', 
        networkStatus 
      };
    }
    
    if (!supabase) {
      console.error('Supabase client not initialized during connection test.');
      return { 
        success: false, 
        error: 'Supabase client not initialized',
        networkStatus
      };
    }

    console.log('Testing Supabase connection with app_settings query...');
    
    // Use retry logic for the test
    let lastError = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.from('app_settings').select('id').limit(1);
        
        if (error) {
          lastError = error;
          console.warn(`Connection test attempt ${attempt + 1} failed: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt)));
          continue;
        }
        
        console.log('Supabase connection test successful. app_settings query returned data:', data);
        return { success: true, networkStatus };
      } catch (error) {
        lastError = error;
        console.warn(`Connection test attempt ${attempt + 1} failed with exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt)));
        }
      }
    }
    
    console.error('All connection test attempts failed:', lastError);
    return { 
      success: false, 
      error: lastError instanceof Error ? lastError.message : String(lastError),
      networkStatus
    };
  } catch (error) {
    console.error('Error testing Supabase connection:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    const networkStatus = await checkNetworkStatus();
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      networkStatus
    };
  }
};

/**
 * Clears Supabase configuration and resets the client
 */
export const clearSupabaseConfig = async (): Promise<void> => {
  try {
    if (supabase?.auth) {
      await supabase.auth.signOut();
    }
    
    supabase = null;
    
    // Clear saved configuration
    await AsyncStorage.removeItem('SUPABASE_URL');
    await AsyncStorage.removeItem('SUPABASE_KEY');
    
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

/**
 * Helper function to extract readable error message from Supabase error
 */
export const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.details || error.hint || error.code) {
    return `Error: ${error.code || 'N/A'} - ${error.details || error.message || 'Unknown'} ${error.hint ? `(${error.hint})` : ''}`;
  }
  
  try {
    return JSON.stringify(error, null, 2);
  } catch (e) {
    return 'An error occurred, but it could not be parsed';
  }
};

/**
 * Generic retry function for Supabase operations
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = RETRY_DELAY,
  backoffFactor: number = RETRY_BACKOFF_FACTOR
): Promise<T> => {
  let lastError: any = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check network connectivity before operation
      const networkStatus = await checkNetworkStatus();
      if (networkStatus.isConnected === false) {
        console.warn(`Network appears to be offline on attempt ${attempt + 1}. Operation may fail.`);
      }
      
      return await operation();
    } catch (error) {
      lastError = error;
      
      const isNetworkError = error instanceof Error && 
        (error.message.includes('Network') || 
         error.message.includes('Failed to fetch') ||
         error.message.includes('offline') ||
         error.message.includes('AuthRetryableFetchError'));
      
      console.warn(`Operation attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(backoffFactor, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('All operation attempts failed:', lastError);
  throw lastError;
};

/**
 * Fetches app settings from Supabase
 * @returns Promise with app settings data or error
 */
export const getAppSettings = async () => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    return data?.[0] || null;
  });
};

/**
 * Updates app settings in Supabase
 * @param settings - The settings object to update
 * @returns Promise with updated data or error
 */
export const updateAppSettings = async (settings: Record<string, any>) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .update(settings)
      .eq('id', settings.id);
    
    if (error) {
      throw error;
    }
    
    return data;
  });
};

/**
 * Fetches tier settings for a specific membership tier
 * @param tier - The membership tier to fetch settings for
 * @returns Promise with tier settings data or error
 */
export const getUserTierSettings = async (tier: string) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('tier', tier)
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    if (data && data.length > 0) {
      return data[0];
    }
    
    return null;
  });
};

/**
 * Batch updates usage tracking data in Supabase
 * @param userId - The user ID for whom to update usage data
 * @param updates - Array of updates with action type, count change, and timestamp
 * @returns Promise with result or error
 */
export const batchUpdateUsage = async (userId: string, updates: Array<{ action_type: string; count_change: number; timestamp: number }>) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase.rpc('batch_update_usage', {
      p_user_id: userId,
      p_updates: updates,
    });
    
    if (error) {
      console.error('Error in batchUpdateUsage:', error);
      throw error;
    }
    
    return data;
  });
};

/**
 * Logs a user action to Supabase for analytics
 * @param userId - The user ID performing the action
 * @param action - The action type being performed
 * @param details - Additional details about the action
 * @returns Promise with result or error
 */
export const logUserAction = async (userId: string, action: string, details: Record<string, any> = {}) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  try {
    return await retryOperation(async () => {
      const { error } = await supabase.rpc('log_user_action', {
        user_id: userId,
        action,
        details,
      });
      
      if (error) {
        console.warn('Failed to log user action:', error);
        throw error;
      }
      
      return true;
    }, 2); // Only retry twice for logging actions
  } catch (error) {
    console.warn('Exception while logging user action:', error);
    return false;
  }
};

/**
 * Processes a batch of swipe actions in Supabase
 * @param swipeActions - Array of swipe actions to process
 * @returns Promise with batch processing results or error
 */
export const processSwipeBatch = async (swipeActions: SwipeAction[]): Promise<SwipeBatchResult | null> => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase.rpc('process_swipe_batch', {
      p_swipe_actions: swipeActions,
    });
    
    if (error) {
      console.error('Error processing swipe batch:', error);
      throw error;
    }
    
    return data as SwipeBatchResult;
  });
};

/**
 * Fetches potential matches for a user from Supabase
 * @param userId - The user ID to fetch matches for
 * @param maxDistance - Maximum distance for local discovery
 * @param isGlobalDiscovery - Whether to use global discovery
 * @param limit - Maximum number of matches to return
 * @returns Promise with potential matches or error
 */
export const fetchPotentialMatches = async (userId: string, maxDistance: number = 50, isGlobalDiscovery: boolean = false, limit: number = 25): Promise<PotentialMatchesResult | null> => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase.rpc('fetch_potential_matches', {
      p_user_id: userId,
      p_max_distance: maxDistance,
      p_is_global_discovery: isGlobalDiscovery,
      p_limit: limit,
    });
    
    if (error) {
      console.error('Error fetching potential matches:', error);
      throw error;
    }
    
    return data as PotentialMatchesResult;
  });
};

/**
 * Syncs usage counters for a user from Supabase
 * @param userId - The user ID to sync counters for
 * @returns Promise with usage counters or error
 */
export const syncUsageCounters = async (userId: string): Promise<UsageCountersResult | null> => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase.rpc('sync_usage_counters', {
      p_user_id: userId,
    });
    
    if (error) {
      console.error('Error syncing usage counters:', error);
      throw error;
    }
    
    return data as UsageCountersResult;
  });
};

/**
 * Fetches user matches with profiles from Supabase
 * @param userId - The user ID to fetch matches for
 * @returns Promise with matches including matched user profiles or error
 */
export const fetchUserMatches = async (userId: string): Promise<MatchWithProfile[] | null> => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  
  return retryOperation(async () => {
    const { data, error } = await supabase.rpc('fetch_user_matches', {
      p_user_id: userId,
    });
    
    if (error) {
      console.error('Error fetching user matches:', error);
      throw error;
    }
    
    return data as MatchWithProfile[];
  });
};

// Export the supabase client
export { supabase };
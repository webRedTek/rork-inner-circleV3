import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
          trial_duration: number;
          daily_like_limit: number | null;
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
          trial_duration?: number;
          daily_like_limit?: number | null;
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
          trial_duration?: number;
          daily_like_limit?: number | null;
        };
      };
      user_daily_usage: {
        Row: {
          id: string;
          user_id: string | null;
          date: string;
          swipe_count: number | null;
          match_count: number | null;
          message_count: number | null;
          direct_intro_count: number | null;
          groups_joined_count: number | null;
          groups_created_count: number | null;
          events_created_count: number | null;
          featured_portfolio_count: number | null;
          virtual_meetings_hosted: number | null;
          boost_minutes_used: number | null;
          boost_uses_count: number | null;
          last_updated: string | null;
          created_at: string | null;
          monthly_reset_at: string | null;
          daily_reset_at: string | null;
          like_count: number;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          date?: string;
          swipe_count?: number | null;
          match_count?: number | null;
          message_count?: number | null;
          direct_intro_count?: number | null;
          groups_joined_count?: number | null;
          groups_created_count?: number | null;
          events_created_count?: number | null;
          featured_portfolio_count?: number | null;
          virtual_meetings_hosted?: number | null;
          boost_minutes_used?: number | null;
          boost_uses_count?: number | null;
          last_updated?: string | null;
          created_at?: string | null;
          monthly_reset_at?: string | null;
          daily_reset_at?: string | null;
          like_count?: number;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          date?: string;
          swipe_count?: number | null;
          match_count?: number | null;
          message_count?: number | null;
          direct_intro_count?: number | null;
          groups_joined_count?: number | null;
          groups_created_count?: number | null;
          events_created_count?: number | null;
          featured_portfolio_count?: number | null;
          virtual_meetings_hosted?: number | null;
          boost_minutes_used?: number | null;
          boost_uses_count?: number | null;
          last_updated?: string | null;
          created_at?: string | null;
          monthly_reset_at?: string | null;
          daily_reset_at?: string | null;
          like_count?: number;
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

// Enhanced connection state tracking
interface ConnectionState {
  isOnline: boolean;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  lastCheck: number;
  consecutiveFailures: number;
  adaptiveTimeout: number;
}

// Initialize supabase client with proper typing
let supabase: ReturnType<typeof createClient<Database>> | null = null;

// Enhanced connection state
let connectionState: ConnectionState = {
  isOnline: true,
  quality: 'good',
  lastCheck: 0,
  consecutiveFailures: 0,
  adaptiveTimeout: 15000
};

const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3;
const MIN_TIMEOUT = 5000;
const MAX_TIMEOUT = 30000;

// Enhanced retry configuration with adaptive strategies
interface EnhancedRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
  adaptiveTimeout?: boolean;
}

/**
 * Enhanced network status checking with quality assessment
 */
export const checkNetworkStatus = async (): Promise<{
  isConnected: boolean | null;
  type?: string | null;
  isInternetReachable?: boolean | null;
  quality?: 'excellent' | 'good' | 'poor' | 'offline';
}> => {
  try {
    const now = Date.now();
    
    // Only check network status periodically to avoid excessive checks
    if (now - connectionState.lastCheck < CONNECTION_CHECK_INTERVAL) {
      return { 
        isConnected: connectionState.isOnline,
        quality: connectionState.quality
      };
    }
    
    connectionState.lastCheck = now;
    
    // Platform-specific network checking
    if (Platform.OS === 'web') {
      // For web, use navigator.onLine
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const quality: 'excellent' | 'good' | 'poor' | 'offline' = isOnline ? 'excellent' : 'offline';
      
      connectionState.isOnline = isOnline;
      connectionState.quality = quality;
      
      console.log('[Enhanced Supabase] Network status check (web):', {
        isConnected: isOnline,
        type: 'web',
        quality,
        consecutiveFailures: connectionState.consecutiveFailures,
        adaptiveTimeout: connectionState.adaptiveTimeout
      });
      
      return {
        isConnected: isOnline,
        type: 'web',
        isInternetReachable: isOnline,
        quality
      };
    } else {
      // For native platforms, try to use NetInfo
      try {
        const NetInfo = await import('@react-native-community/netinfo');
        const netInfo = await NetInfo.default.fetch();
        
        // Assess connection quality
        let quality: 'excellent' | 'good' | 'poor' | 'offline' = 'offline';
        
        if (netInfo.isConnected) {
          if (netInfo.type === 'wifi') {
            quality = 'excellent';
          } else if (netInfo.type === 'cellular') {
            // Could add more sophisticated cellular quality detection here
            quality = 'good';
          } else {
            quality = 'poor';
          }
          
          connectionState.consecutiveFailures = 0;
          connectionState.adaptiveTimeout = Math.max(
            connectionState.adaptiveTimeout * 0.9,
            MIN_TIMEOUT
          );
        } else {
          quality = 'offline';
          connectionState.consecutiveFailures++;
          connectionState.adaptiveTimeout = Math.min(
            connectionState.adaptiveTimeout * 1.5,
            MAX_TIMEOUT
          );
        }
        
        connectionState.isOnline = !!netInfo.isConnected;
        connectionState.quality = quality;
        
        console.log('[Enhanced Supabase] Network status check (native):', {
          isConnected: netInfo.isConnected,
          type: netInfo.type,
          quality,
          consecutiveFailures: connectionState.consecutiveFailures,
          adaptiveTimeout: connectionState.adaptiveTimeout
        });
        
        return {
          isConnected: netInfo.isConnected,
          type: netInfo.type,
          isInternetReachable: netInfo.isInternetReachable,
          quality
        };
      } catch (netInfoError) {
        console.warn('[Enhanced Supabase] NetInfo not available, assuming connection:', netInfoError);
        // Fallback: assume we're connected
        connectionState.isOnline = true;
        connectionState.quality = 'good';
        
        return {
          isConnected: true,
          type: 'unknown',
          isInternetReachable: true,
          quality: 'good'
        };
      }
    }
  } catch (error) {
    console.error('[Enhanced Supabase] Error checking network status:', error);
    connectionState.consecutiveFailures++;
    return { isConnected: null, quality: 'offline' };
  }
};

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

  console.log('[Enhanced Supabase] Config check:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseAnonKey,
    connectionQuality: connectionState.quality
  });

  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Enhanced custom fetch implementation with adaptive timeout and intelligent retry
 */
const enhancedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const timeout = connectionState.adaptiveTimeout;
  
  const fetchWithAdaptiveTimeout = async (attempt = 0): Promise<Response> => {
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
      
      // Update connection state on success
      if (response.ok) {
        connectionState.consecutiveFailures = 0;
      }
      
      return response;
  } catch (error) {
      const isTimeoutError = error instanceof Error && error.name === 'AbortError';
      const isNetworkError = error instanceof Error && 
        (error.message.includes('Network') || 
         error.message.includes('Failed to fetch') ||
         error.message.includes('offline'));
      
      connectionState.consecutiveFailures++;
      
      // Adaptive retry logic based on connection quality and failure count
      const maxRetries = connectionState.quality === 'excellent' ? 2 : 
                        connectionState.quality === 'good' ? 3 : 4;
      
      if ((isTimeoutError || isNetworkError) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(1.5, attempt), 5000);
        
        console.warn(`[Enhanced Supabase] Fetch attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithAdaptiveTimeout(attempt + 1);
      }
      
      throw error;
  }
  };
  
  return fetchWithAdaptiveTimeout();
};

/**
 * Enhanced Supabase initialization with adaptive configuration
 */
export const initSupabase = async (): Promise<boolean> => {
  try {
    // Check network connectivity first
    const networkStatus = await checkNetworkStatus();
    if (networkStatus.isConnected === false) {
      console.warn('[Enhanced Supabase] Network appears to be offline. Initialization may fail.');
    }
    
    if (!isSupabaseConfigured()) {
      console.warn('[Enhanced Supabase] Not configured. Please set environment variables.');
      
      // Check AsyncStorage for saved values
      const savedUrl = await AsyncStorage.getItem('SUPABASE_URL');
      const savedKey = await AsyncStorage.getItem('SUPABASE_KEY');
      if (savedUrl && savedKey) {
        console.log('[Enhanced Supabase] Using saved configuration from AsyncStorage');
        return await initWithEnhancedRetry(savedUrl, savedKey);
      }
      throw new Error('Supabase is not configured and no saved configuration found.');
    }

    const supabaseUrl = 
      process.env.EXPO_PUBLIC_SUPABASE_URL || 
      Constants.expoConfig?.extra?.supabaseUrl;
    
    const supabaseAnonKey = 
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
      Constants.expoConfig?.extra?.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase URL or Anon Key is missing.');
    }

    return await initWithEnhancedRetry(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('[Enhanced Supabase] Initialization failed:', error instanceof Error ? error.message : String(error));
    
    // Enhanced error details
    const details = {
      networkStatus: await checkNetworkStatus(),
      connectionState,
      hasUrl: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl),
      hasKey: Boolean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey),
      hasSavedUrl: Boolean(await AsyncStorage.getItem('SUPABASE_URL')),
      hasSavedKey: Boolean(await AsyncStorage.getItem('SUPABASE_KEY'))
    };
    console.error('[Enhanced Supabase] Initialization details:', details);
    
    throw error;
  }
};

/**
 * Enhanced initialization with adaptive retry strategy
 */
const initWithEnhancedRetry = async (url: string, key: string, retryCount = 0): Promise<boolean> => {
  const maxRetries = connectionState.quality === 'excellent' ? 2 : 
                    connectionState.quality === 'good' ? 3 : 4;
  
  try {
    console.log(`[Enhanced Supabase] Initializing with URL: ${url.substring(0, 15)}... (Attempt ${retryCount + 1}/${maxRetries + 1})`);
    
    supabase = createClient<Database>(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: {
        fetch: enhancedFetch
      }
    });
    
    // Enhanced connection test with timeout
    const { data, error } = await Promise.race([
      supabase.from('app_settings').select('id').limit(1).maybeSingle(),
      new Promise<{ data: null; error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), connectionState.adaptiveTimeout)
      )
    ]);
    
    if (error) {
      console.error('[Enhanced Supabase] Connection test failed:', error);
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
        console.warn(`[Enhanced Supabase] Initialization attempt ${retryCount + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return initWithEnhancedRetry(url, key, retryCount + 1);
      } else {
        throw error;
      }
    }
    
    console.log('[Enhanced Supabase] Client initialized successfully.');
    connectionState.consecutiveFailures = 0;
    return true;
  } catch (error) {
    if (retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
      console.warn(`[Enhanced Supabase] Initialization attempt ${retryCount + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initWithEnhancedRetry(url, key, retryCount + 1);
    }
    
    console.error('[Enhanced Supabase] All initialization attempts failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
};

/**
 * Enhanced connection test with comprehensive diagnostics
 */
export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  try {
    // Check network connectivity first
    const networkStatus = await checkNetworkStatus();
    
    if (networkStatus.isConnected === false) {
      console.warn('[Enhanced Supabase] Network appears to be offline. Connection test will likely fail.');
      return { 
        success: false, 
        error: 'Network appears to be offline', 
        networkStatus 
      };
    }
    
    if (!supabase) {
      console.error('[Enhanced Supabase] Client not initialized during connection test.');
      return { 
        success: false, 
        error: 'Supabase client not initialized',
        networkStatus
      };
    }

    console.log('[Enhanced Supabase] Testing connection with app_settings query...');
    
    // Enhanced test with adaptive retry
    const maxRetries = connectionState.quality === 'excellent' ? 2 : 3;
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error } = await Promise.race([
          supabase.from('app_settings').select('id').limit(1),
          new Promise<{ data: null; error: Error }>((_, reject) => 
            setTimeout(() => reject(new Error('Connection test timeout')), connectionState.adaptiveTimeout)
          )
        ]);
        
        if (error) {
          lastError = error;
          console.warn(`[Enhanced Supabase] Connection test attempt ${attempt + 1} failed: ${error.message}`);
          if (attempt < maxRetries - 1) {
            const delay = Math.min(1000 * Math.pow(1.5, attempt), 3000);
            await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        } else {
          console.log('[Enhanced Supabase] Connection test successful. app_settings query returned data:', data);
          connectionState.consecutiveFailures = 0;
        return { success: true, networkStatus };
        }
      } catch (error) {
        lastError = error;
        console.warn(`[Enhanced Supabase] Connection test attempt ${attempt + 1} failed with exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(1.5, attempt), 3000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('[Enhanced Supabase] All connection test attempts failed:', lastError);
    connectionState.consecutiveFailures++;
    return { 
      success: false, 
      error: lastError instanceof Error ? lastError.message : String(lastError),
      networkStatus
    };
  } catch (error) {
    console.error('[Enhanced Supabase] Error testing connection:', error instanceof Error ? error.message : String(error));
    
    const networkStatus = await checkNetworkStatus();
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      networkStatus
    };
  }
};

/**
 * Enhanced operation wrapper with adaptive retry and circuit breaker
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  options: EnhancedRetryOptions = {}
): Promise<T> => {
  const { 
    maxRetries = connectionState.quality === 'excellent' ? 2 : 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 1.5,
    shouldRetry = () => true,
    adaptiveTimeout = true
  } = options;
  
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Apply adaptive timeout if enabled
      if (adaptiveTimeout) {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), connectionState.adaptiveTimeout)
          )
        ]);
      } else {
        return await operation();
      }
    } catch (error) {
      lastError = error;
      
      // Enhanced error logging
      console.log(`[Enhanced Supabase] Retry attempt ${attempt}/${maxRetries} failed:`, {
        error,
        type: typeof error,
        message: error && typeof error === 'object' && 'message' in error ? error.message : 'No message',
        details: error && typeof error === 'object' && 'details' in error ? error.details : 'No details',
        connectionQuality: connectionState.quality,
        consecutiveFailures: connectionState.consecutiveFailures
      });

      if (attempt === maxRetries || !shouldRetry(error)) {
        console.error('[Enhanced Supabase] All operation attempts failed:', {
          error: lastError,
          attempts: attempt,
          connectionState
        });
        throw lastError;
      }

      // Adaptive delay based on connection quality and failure count
      const baseDelayAdjusted = connectionState.quality === 'poor' ? baseDelay * 2 : baseDelay;
      const waitTime = Math.min(baseDelayAdjusted * Math.pow(backoffFactor, attempt - 1), maxDelay);
      
      console.log(`[Enhanced Supabase] Waiting ${waitTime}ms before retry ${attempt + 1}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
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
    
    // Reset connection state
    connectionState = {
      isOnline: true,
      quality: 'good',
      lastCheck: 0,
      consecutiveFailures: 0,
      adaptiveTimeout: 15000
    };
    
    // Clear saved configuration
    await AsyncStorage.removeItem('SUPABASE_URL');
    await AsyncStorage.removeItem('SUPABASE_KEY');
    
    console.log('[Enhanced Supabase] Configuration cleared and state reset');
  } catch (error) {
    console.error('[Enhanced Supabase] Error clearing configuration:', error);
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
 * Enhanced error message extraction
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
 * Enhanced app settings operations
 */
export const getAppSettings = async () => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const client = supabase as SupabaseClient<Database>;
  
  return retryOperation(async () => {
    const { data, error } = await client
      .from('app_settings')
      .select('*')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    return data?.[0] || null;
  }, {
    shouldRetry: (error) => {
      const errorMsg = String(error).toLowerCase();
      return errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('connection');
    }
  });
};

/**
 * Enhanced tier settings operations
 */
export const getUserTierSettings = async (tier: string) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const client = supabase as SupabaseClient<Database>;
  
  return retryOperation(async () => {
    const { data, error } = await client
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
 * Enhanced batch usage updates
 */
export const batchUpdateUsage = async (userId: string, updates: Array<{ action_type: string; count_change: number; timestamp: number }>) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const client = supabase as SupabaseClient<Database>;
  
  return retryOperation(async () => {
    const { data, error } = await client.rpc('handle_user_usage', {
      p_user_id: userId,
      p_action_type: 'batch',
      p_batch_updates: updates,
    });
    
    if (error) {
      console.error('[Enhanced Supabase] Error in batchUpdateUsage:', error);
      throw error;
    }
    
    return data;
  });
};

/**
 * Enhanced swipe batch processing
 */
export const processSwipeBatch = async (swipeActions: SwipeAction[]): Promise<SwipeBatchResult | null> => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const client = supabase as SupabaseClient<Database>;
  
  return retryOperation(async () => {
    const { data, error } = await client.rpc('process_swipe_batch', {
      p_swipe_actions: swipeActions,
    });
    
    if (error) {
      console.error('[Enhanced Supabase] Error processing swipe batch:', error);
      throw error;
    }
    
    return data as SwipeBatchResult;
  }, {
    maxRetries: connectionState.quality === 'poor' ? 4 : 3,
    shouldRetry: (error) => {
      const errorMsg = String(error).toLowerCase();
      return errorMsg.includes('network') || 
             errorMsg.includes('timeout') || 
             errorMsg.includes('connection') ||
             errorMsg.includes('rate limit');
    }
  });
};

/**
 * Enhanced potential matches fetching with better debugging
 */
export const fetchPotentialMatches = async (
  userId: string, 
  limit: number = 10, // Fixed to 10 matches per request
  maxDistance: number | null = 50, // Default 50km radius, null for global
  isGlobalDiscovery: boolean = false // Local discovery by default
): Promise<PotentialMatchesResult | null> => {
  console.log('🚨 [Enhanced Supabase] fetchPotentialMatches function called!');
  
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const client = supabase as SupabaseClient<Database>;
  
  console.log('[Enhanced Supabase] fetchPotentialMatches called with:', {
    userId,
    limit,
    maxDistance,
    isGlobalDiscovery,
    connectionQuality: connectionState.quality
  });
  
  return retryOperation(async () => {
    console.log('[Enhanced Supabase] Making RPC call to fetch_potential_matches');
    
    // Simplified parameters - no max_distance needed for global discovery
    const params: any = {
      p_user_id: userId,
      p_is_global_discovery: isGlobalDiscovery,
      p_limit: limit,
      p_offset: 0
    };
    
    // Only add max_distance if doing local discovery
    if (!isGlobalDiscovery && maxDistance !== null) {
      params.p_max_distance = maxDistance;
    }
    
    const { data, error } = await client.rpc('fetch_potential_matches', params);
    
    console.log('[Enhanced Supabase] RPC response:', {
      hasData: !!data,
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : [],
      matchesCount: data?.matches?.length || 0,
      hasError: !!error,
      connectionState
    });
    
    if (error) {
      console.error('[Enhanced Supabase] RPC error details:', {
        error,
        connectionQuality: connectionState.quality,
        consecutiveFailures: connectionState.consecutiveFailures
      });
      throw error;
    }
    
    // Enhanced debugging for the matches
    if (data?.matches) {
      console.log('[Enhanced Supabase] Matches details:', {
        totalMatches: data.matches.length,
        firstMatch: data.matches[0] ? {
          id: data.matches[0].id,
          name: data.matches[0].name,
          hasRequiredFields: !!(data.matches[0].id && data.matches[0].name)
        } : null,
        allMatchesValid: data.matches.every((match: any) => match && match.id && match.name)
      });
    }
    
    console.log('[Enhanced Supabase] RPC successful, returning data');
    return data as PotentialMatchesResult;
  }, {
    maxRetries: connectionState.quality === 'poor' ? 4 : 3,
    shouldRetry: (error) => {
      const errorMsg = String(error).toLowerCase();
      return errorMsg.includes('network') || 
             errorMsg.includes('timeout') || 
             errorMsg.includes('connection');
    }
  });
};

/**
 * Enhanced user matches fetching
 */
export const fetchUserMatches = async (userId: string): Promise<MatchWithProfile[] | null> => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const client = supabase as SupabaseClient<Database>;
  
  return retryOperation(async () => {
    const { data, error } = await client.rpc('fetch_user_matches', {
      p_user_id: userId,
    });
    
    if (error) {
      console.error('[Enhanced Supabase] Error fetching user matches:', error);
      throw error;
    }
    
    return data as MatchWithProfile[];
  });
};

/**
 * Get enhanced connection statistics
 */
export const getConnectionStats = () => {
  return {
    ...connectionState,
    isConfigured: isSupabaseConfigured(),
    hasClient: !!supabase
  };
};

// Export the supabase client
export { supabase };
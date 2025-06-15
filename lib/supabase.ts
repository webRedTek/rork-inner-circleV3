import AsyncStorage from '@react-native-async-storage/async-storage';
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
};

// Define swipe action type for batch processing
export type SwipeAction = {
  swiper_id: string;
  swipee_id: string;
  direction: 'left' | 'right';
  swipe_timestamp: number;
};

// Supabase configuration
let supabaseUrl: string = '';
let supabaseAnonKey: string = '';
let initialized = false;

/**
 * Checks if Supabase is configured in the environment
 */
export const isSupabaseConfigured = (): boolean => {
  supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
  supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

  console.log('Supabase config check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
  });

  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Initializes the Supabase configuration
 * @returns boolean indicating if initialization was successful
 */
export const initSupabase = async (): Promise<boolean> => {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.');
      // Check AsyncStorage for saved values
      const savedUrl = await AsyncStorage.getItem('SUPABASE_URL');
      const savedKey = await AsyncStorage.getItem('SUPABASE_KEY');
      if (savedUrl && savedKey) {
        console.log('Using saved Supabase configuration from AsyncStorage');
        supabaseUrl = savedUrl;
        supabaseAnonKey = savedKey;
        initialized = true;
        return true;
      }
      console.error('No saved configuration found in AsyncStorage.');
      return false;
    }

    console.log('Initializing Supabase with URL:', supabaseUrl.substring(0, 15) + '...');
    initialized = true;
    return true;
  } catch (error) {
    console.error('Error initializing Supabase:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    return false;
  }
};

/**
 * Tests the Supabase connection with a simple query to app_settings table
 * @returns Object with success status and optional error
 */
export const testSupabaseConnection = async (): Promise<ConnectionTestResult> => {
  try {
    if (!initialized) {
      console.error('Supabase client not initialized during connection test.');
      return { success: false, error: 'Supabase client not initialized' };
    }

    console.log('Testing Supabase connection with app_settings query...');
    const response = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase connection test failed:', errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log('Supabase connection test successful. app_settings query returned data:', data);
    return { success: true };
  } catch (error) {
    console.error('Error testing Supabase connection:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Clears Supabase configuration and resets the client
 */
export const clearSupabaseConfig = async (): Promise<void> => {
  try {
    // Clear saved configuration
    await AsyncStorage.removeItem('SUPABASE_URL');
    await AsyncStorage.removeItem('SUPABASE_KEY');
    initialized = false;
    supabaseUrl = '';
    supabaseAnonKey = '';
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
 * Generic fetch wrapper for Supabase REST API
 */
const fetchSupabase = async (endpoint: string, method: string, body?: any, token?: string) => {
  if (!initialized) {
    throw new Error('Supabase not initialized');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error(`Error in fetchSupabase (${method} ${endpoint}):`, error);
    throw error;
  }
};

/**
 * Auth functions
 */
export const signInWithPassword = async (email: string, password: string) => {
  if (!initialized) {
    throw new Error('Supabase not initialized');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const data = await response.json();
  // Store token in AsyncStorage
  await AsyncStorage.setItem('supabase_access_token', data.access_token);
  await AsyncStorage.setItem('supabase_refresh_token', data.refresh_token);
  return data;
};

export const signUp = async (email: string, password: string, options?: { data?: { name?: string } }) => {
  if (!initialized) {
    throw new Error('Supabase not initialized');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      email,
      password,
      options: options || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const data = await response.json();
  // Store token in AsyncStorage
  if (data.access_token) {
    await AsyncStorage.setItem('supabase_access_token', data.access_token);
    await AsyncStorage.setItem('supabase_refresh_token', data.refresh_token);
  }
  return data;
};

export const signOut = async () => {
  if (!initialized) {
    throw new Error('Supabase not initialized');
  }

  const token = await AsyncStorage.getItem('supabase_access_token');
  if (!token) return;

  const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${token}`,
    },
  });

  // Clear tokens from AsyncStorage regardless of response
  await AsyncStorage.removeItem('supabase_access_token');
  await AsyncStorage.removeItem('supabase_refresh_token');

  if (!response.ok) {
    const errorText = await response.text();
    console.warn('Error during sign out:', errorText);
  }
};

export const getSession = async () => {
  const token = await AsyncStorage.getItem('supabase_access_token');
  const refreshToken = await AsyncStorage.getItem('supabase_refresh_token');

  if (!token || !refreshToken) {
    return { session: null };
  }

  // Check if token is still valid or refresh it
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const user = await response.json();
      return { session: { access_token: token, refresh_token: refreshToken, user } };
    } else {
      // Attempt to refresh token
      const refreshResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!refreshResponse.ok) {
        await AsyncStorage.removeItem('supabase_access_token');
        await AsyncStorage.removeItem('supabase_refresh_token');
        return { session: null };
      }

      const refreshedData = await refreshResponse.json();
      await AsyncStorage.setItem('supabase_access_token', refreshedData.access_token);
      await AsyncStorage.setItem('supabase_refresh_token', refreshedData.refresh_token);
      return { session: refreshedData };
    }
  } catch (error) {
    console.error('Error getting session:', error);
    await AsyncStorage.removeItem('supabase_access_token');
    await AsyncStorage.removeItem('supabase_refresh_token');
    return { session: null };
  }
};

/**
 * Database operations
 */
export const from = (table: string) => {
  return {
    select: (columns: string) => ({
      eq: async (column: string, value: any) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?${column}=eq.${encodeURIComponent(value)}&select=${columns}`, 'GET', undefined, token);
      },
      neq: async (column: string, value: any) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?${column}=neq.${encodeURIComponent(value)}&select=${columns}`, 'GET', undefined, token);
      },
      gte: async (column: string, value: any) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?${column}=gte.${encodeURIComponent(value)}&select=${columns}`, 'GET', undefined, token);
      },
      or: async (conditions: string) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?or=(${conditions})&select=${columns}`, 'GET', undefined, token);
      },
      order: async (column: string, options: { ascending: boolean }) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?order=${column}.${options.ascending ? 'asc' : 'desc'}&select=${columns}`, 'GET', undefined, token);
      },
      limit: async (count: number) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?limit=${count}&select=${columns}`, 'GET', undefined, token);
      },
      single: async () => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        const data = await fetchSupabase(`${table}?limit=1&select=${columns}`, 'GET', undefined, token);
        return data?.[0] || null;
      },
      then: async () => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?select=${columns}`, 'GET', undefined, token);
      },
    }),
    insert: async (data: any) => {
      const token = await AsyncStorage.getItem('supabase_access_token');
      return fetchSupabase(table, 'POST', data, token);
    },
    update: async (data: any) => ({
      eq: async (column: string, value: any) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        return fetchSupabase(`${table}?${column}=eq.${encodeURIComponent(value)}`, 'PATCH', data, token);
      },
      in: async (column: string, values: any[]) => {
        const token = await AsyncStorage.getItem('supabase_access_token');
        const valueList = values.map(v => encodeURIComponent(v)).join(',');
        return fetchSupabase(`${table}?${column}=in.(${valueList})`, 'PATCH', data, token);
      },
    }),
  };
};

/**
 * RPC (Remote Procedure Call) function
 */
export const rpc = async (functionName: string, params: Record<string, any>) => {
  if (!initialized) {
    throw new Error('Supabase not initialized');
  }

  const token = await AsyncStorage.getItem('supabase_access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error(`Error in RPC (${functionName}):`, error);
    throw error;
  }
};

/**
 * Fetches app settings from Supabase
 * @returns Promise with app settings data or error
 */
export const getAppSettings = async () => {
  if (!initialized) {
    throw new Error('Supabase client not initialized');
  }
  const data = await from('app_settings').select('*').limit(1);
  return data?.[0] || null;
};

/**
 * Updates app settings in Supabase
 * @param settings - The settings object to update
 * @returns Promise with updated data or error
 */
export const updateAppSettings = async (settings: Record<string, any>) => {
  if (!initialized) {
    throw new Error('Supabase client not initialized');
  }
  return await from('app_settings').update(settings).eq('id', settings.id);
};

/**
 * Fetches tier settings for a specific membership tier
 * @param tier - The membership tier to fetch settings for
 * @returns Promise with tier settings data or error
 */
export const getUserTierSettings = async (tier: string) => {
  if (!initialized) {
    throw new Error('Supabase client not initialized');
  }
  const data = await from('app_settings').select('*').eq('tier', tier).limit(1);
  return data?.[0] || null;
};

/**
 * Batch updates usage tracking data in Supabase
 * @param userId - The user ID for whom to update usage data
 * @param updates - Array of updates with action type, count change, and timestamp
 * @returns Promise with result or error
 */
export const batchUpdateUsage = async (userId: string, updates: Array<{ action_type: string; count_change: number; timestamp: number }>) => {
  if (!initialized) {
    throw new Error('Supabase client not initialized');
  }
  
  try {
    const data = await rpc('batch_update_usage', {
      p_user_id: userId,
      p_updates: updates,
    });
    return data;
  } catch (error) {
    console.error('Error in batchUpdateUsage:', error);
    throw error;
  }
};

/**
 * Logs a user action to Supabase for analytics
 * @param userId - The user ID performing the action
 * @param action - The action type being performed
 * @param details - Additional details about the action
 * @returns Promise with result or error
 */
export const logUserAction = async (userId: string, action: string, details: Record<string, any> = {}) => {
  if (!initialized) {
    throw new Error('Supabase client not initialized');
  }
  
  try {
    await rpc('log_user_action', {
      user_id: userId,
      action,
      details,
    });
  } catch (error) {
    console.warn('Exception while logging user action:', error);
  }
};

// Dummy supabase object for compatibility
export const supabase = {
  auth: {
    signInWithPassword,
    signUp,
    signOut,
    getSession,
  },
  from,
  rpc,
};
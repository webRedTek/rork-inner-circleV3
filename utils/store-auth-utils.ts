/**
 * Centralized Store Authentication Utilities
 * Eliminates duplicate auth checks across stores
 */

import { useAuthStore } from '@/store/auth-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface AuthValidationResult {
  isValid: boolean;
  user?: any;
  error?: string;
}

/**
 * Single source of truth for user authentication validation
 * Use this instead of individual `if (!user)` checks in stores
 */
export const validateUserAuth = (): AuthValidationResult => {
  const { user, isAuthenticated } = useAuthStore.getState();
  
  if (!isAuthenticated || !user?.id) {
    return {
      isValid: false,
      error: 'User not authenticated'
    };
  }
  
  return {
    isValid: true,
    user
  };
};

/**
 * Single source of truth for Supabase configuration validation
 * Use this instead of individual `isSupabaseConfigured()` checks in stores
 */
export const validateSupabaseConfig = (): { isValid: boolean; error?: string } => {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      isValid: false,
      error: 'Supabase not configured'
    };
  }
  
  return { isValid: true };
};

/**
 * Combined auth and Supabase validation
 * Use this for operations that require both user auth and database access
 */
export const validateStoreOperation = (): AuthValidationResult & { supabaseValid: boolean } => {
  const authResult = validateUserAuth();
  const supabaseResult = validateSupabaseConfig();
  
  return {
    ...authResult,
    supabaseValid: supabaseResult.isValid,
    error: authResult.error || supabaseResult.error
  };
};

/**
 * Guard function for store operations
 * Returns early if validation fails, prevents duplicate validation code
 */
export const guardStoreOperation = (operation: string): { user: any } | null => {
  const validation = validateStoreOperation();
  
  if (!validation.isValid || !validation.supabaseValid) {
    console.warn(`[StoreAuth] ${operation} blocked: ${validation.error}`);
    return null;
  }
  
  return { user: validation.user };
};

/**
 * Enhanced error stringification utility
 * Moved from usage-store to be reusable across stores
 */
export const safeStringifyError = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try {
      // Handle structured error objects with priority order
      if (error.userMessage) return error.userMessage;
      if (error.message) return error.message;
      if (error.error?.message) return error.error.message;
      if (error.details) return String(error.details);
      if (error.hint) return String(error.hint);
      if (error.description) return String(error.description);
      if (error.code) return `Error code: ${error.code}`;
      
      // Try to extract meaningful properties
      const meaningfulProps = ['reason', 'cause', 'statusText', 'data'];
      for (const prop of meaningfulProps) {
        if (error[prop]) return String(error[prop]);
      }
      
      // Last resort: try to stringify safely
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch (e) {
      try {
        return JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e2) {
        return 'Error occurred but could not be parsed';
      }
    }
  }
  return String(error);
}; 
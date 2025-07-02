import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNotificationStore } from '@/store/notification-store';

/**
 * FILE: utils/error-utils.ts
 * LAST UPDATED: 2025-07-02 18:00
 * 
 * CURRENT STATE:
 * Enhanced central error handling utility system for the app. Provides standardized error
 * categorization, processing, and display. Handles network, authentication,
 * database, validation, business logic, and rate limiting errors with proper
 * user-friendly messages and retry logic. Enhanced to prevent [object Object] errors.
 * 
 * RECENT CHANGES:
 * - Completely overhauled error stringification to prevent [object Object] errors
 * - Enhanced error message extraction from complex error objects with priority order
 * - Improved handling for Supabase-specific errors with better message extraction
 * - Enhanced notification integration for better user feedback with categorized messages
 * - Better error categorization with more specific error type detection
 * - Improved retry logic with better error recovery strategies
 * 
 * FILE INTERACTIONS:
 * - Imports from: notification-store (for displaying errors to users)
 * - Exports to: All stores and components that need error handling
 * - Dependencies: React Native NetInfo (for network error detection)
 * - Data flow: Receives raw errors, processes them into AppError objects,
 *   displays user-friendly messages, and provides retry logic for recoverable errors
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - handleError: Enhanced conversion of any error into standardized AppError object
 * - withErrorHandling: Enhanced wrapper for async operations with error handling
 * - withRetry: Enhanced retry logic with exponential backoff and better recovery
 * - showError: Enhanced error display via notification system with categorization
 * - categorizeError: Enhanced error category determination with better detection
 * - mapErrorCode: Enhanced error code mapping with more specific codes
 * - safeStringifyError: Enhanced safe conversion of any error to readable string
 */

/**
 * Enum representing different categories of errors in the application.
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  BUSINESS = 'BUSINESS',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Specific error codes for different error scenarios in the application.
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_REFUSED: 'NETWORK_CONNECTION_REFUSED',

  // Auth errors
  AUTH_NOT_AUTHENTICATED: 'AUTH_NOT_AUTHENTICATED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',

  // Database errors
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_CONSTRAINT_ERROR: 'DB_CONSTRAINT_ERROR',
  DB_NOT_FOUND: 'DB_NOT_FOUND',

  // Validation errors
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_FORMAT_ERROR: 'VALIDATION_FORMAT_ERROR',

  // Business logic errors
  BUSINESS_LOGIC_VIOLATION: 'BUSINESS_LOGIC_VIOLATION',
  BUSINESS_LIMIT_REACHED: 'BUSINESS_LIMIT_REACHED',
  BUSINESS_CONFLICT: 'BUSINESS_CONFLICT',

  // Rate limit errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_IP_BLOCKED: 'RATE_LIMIT_IP_BLOCKED',

  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Interface representing a standardized application error.
 */
export interface AppError {
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  technical?: string;
  retry?: boolean;
  recoverable?: boolean;
}

/**
 * Enhanced user-friendly messages for different error codes.
 */
const UserMessages: Record<string, string> = {
  [ErrorCodes.NETWORK_OFFLINE]: "No internet connection. Please check your network and try again.",
  [ErrorCodes.NETWORK_TIMEOUT]: "The request timed out. Please check your connection and try again.",
  [ErrorCodes.NETWORK_CONNECTION_REFUSED]: "Connection refused. Please try again later.",
  [ErrorCodes.AUTH_NOT_AUTHENTICATED]: "You are not logged in. Please log in to continue.",
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: "Invalid email or password. Please try again.",
  [ErrorCodes.AUTH_SESSION_EXPIRED]: "Your session has expired. Please log in again.",
  [ErrorCodes.AUTH_PERMISSION_DENIED]: "You do not have permission to perform this action.",
  [ErrorCodes.DB_CONNECTION_ERROR]: "Unable to connect to the server. Please try again later.",
  [ErrorCodes.DB_QUERY_ERROR]: "An error occurred while processing your request. Please try again.",
  [ErrorCodes.DB_CONSTRAINT_ERROR]: "There was a conflict with your request. Please check your data.",
  [ErrorCodes.DB_NOT_FOUND]: "The requested item could not be found.",
  [ErrorCodes.VALIDATION_INVALID_INPUT]: "Invalid input provided. Please check your data and try again.",
  [ErrorCodes.VALIDATION_MISSING_FIELD]: "Required information is missing. Please fill in all fields.",
  [ErrorCodes.VALIDATION_FORMAT_ERROR]: "Incorrect format. Please check your input.",
  [ErrorCodes.BUSINESS_LOGIC_VIOLATION]: "This action cannot be performed. Please check the requirements.",
  [ErrorCodes.BUSINESS_LIMIT_REACHED]: "You have reached your usage limit. Please upgrade your plan.",
  [ErrorCodes.BUSINESS_CONFLICT]: "There is a conflict with your request. Please try again.",
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: "Too many requests. Please try again later.",
  [ErrorCodes.RATE_LIMIT_IP_BLOCKED]: "Your IP has been temporarily blocked due to too many requests.",
  [ErrorCodes.UNKNOWN_ERROR]: "An unexpected error occurred. Please try again.",
};

/**
 * Enhanced function to safely convert any error to a readable string, preventing [object Object] issues
 * @param error - The error to stringify
 * @returns A readable string representation of the error
 */
export function safeStringifyError(error: any): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  
  if (error && typeof error === 'object') {
    try {
      // Enhanced priority order for error message extraction
      const priorityProps = [
        'userMessage',
        'message', 
        'details', 
        'hint', 
        'description',
        'reason',
        'cause',
        'statusText',
        'data'
      ];
      
      // Try priority properties first
      for (const prop of priorityProps) {
        if (error[prop] && typeof error[prop] === 'string') {
          return error[prop];
        }
      }
      
      // Handle nested error objects
      if (error.error) {
        const nestedMessage = safeStringifyError(error.error);
        if (nestedMessage && nestedMessage !== 'An error occurred') {
          return nestedMessage;
        }
      }
      
      // Handle Supabase-specific error structure
      if (error.message) {
        let message = String(error.message);
        if (error.details) message += ` (Details: ${error.details})`;
        if (error.hint) message += ` (Hint: ${error.hint})`;
        if (error.code) message += ` (Code: ${error.code})`;
        return message;
      }
      
      // Try to extract any meaningful string value
      const stringValues = Object.values(error).filter(val => 
        typeof val === 'string' && val.length > 0 && val !== '[object Object]'
      );
      
      if (stringValues.length > 0) {
        return stringValues[0] as string;
      }
      
      // Last resort: try JSON.stringify with error properties
      const errorObj = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
      if (errorObj && errorObj !== '{}' && !errorObj.includes('[object Object]')) {
        return errorObj;
      }
      
      return 'An error occurred';
    } catch (e) {
      // If all else fails, convert to string
      const stringified = String(error);
      return stringified === '[object Object]' ? 'An error occurred' : stringified;
    }
  }
  
  const stringified = String(error);
  return stringified === '[object Object]' ? 'An error occurred' : stringified;
}

/**
 * Enhanced function to check if the error is related to network issues.
 * @param error - The error to check.
 * @returns True if the error is a network error.
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = safeStringifyError(error).toLowerCase();
  const networkKeywords = [
    "network", "offline", "failed to fetch", "connection", 
    "timeout", "fetch", "cors", "net::", "dns", "socket"
  ];
  return networkKeywords.some(keyword => message.includes(keyword));
}

/**
 * Enhanced function to categorize an error based on its content or type.
 * @param error - The error to categorize.
 * @returns The category of the error.
 */
function categorizeError(error: any): ErrorCategory {
  if (isNetworkError(error)) return ErrorCategory.NETWORK;

  const errorMsg = safeStringifyError(error).toLowerCase();

  // Enhanced categorization with more specific keywords
  const categoryKeywords = {
    [ErrorCategory.AUTH]: [
      "auth", "login", "session", "credential", "unauthorized", 
      "forbidden", "token", "jwt", "permission", "access denied"
    ],
    [ErrorCategory.DATABASE]: [
      "database", "query", "constraint", "not found", "pgrst", 
      "sql", "relation", "column", "table", "foreign key"
    ],
    [ErrorCategory.VALIDATION]: [
      "validation", "input", "format", "missing", "invalid", 
      "required", "schema", "type", "range", "length"
    ],
    [ErrorCategory.BUSINESS]: [
      "limit", "quota", "conflict", "usage", "tier", "plan", 
      "subscription", "billing", "payment", "upgrade"
    ],
    [ErrorCategory.RATE_LIMIT]: [
      "rate", "too many requests", "throttle", "429", 
      "quota exceeded", "api limit"
    ]
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => errorMsg.includes(keyword))) {
      return category as ErrorCategory;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Enhanced function to map an error to a specific error code based on its category and content.
 * @param error - The error to map.
 * @param category - The category of the error.
 * @returns The specific error code.
 */
function mapErrorCode(error: any, category: ErrorCategory): string {
  const errorMsg = safeStringifyError(error).toLowerCase();

  switch (category) {
    case ErrorCategory.NETWORK:
      if (errorMsg.includes("timeout")) return ErrorCodes.NETWORK_TIMEOUT;
      if (errorMsg.includes("offline") || errorMsg.includes("network")) return ErrorCodes.NETWORK_OFFLINE;
      return ErrorCodes.NETWORK_CONNECTION_REFUSED;
      
    case ErrorCategory.AUTH:
      if (errorMsg.includes("session") || errorMsg.includes("expired")) return ErrorCodes.AUTH_SESSION_EXPIRED;
      if (errorMsg.includes("credential") || errorMsg.includes("password") || errorMsg.includes("login")) return ErrorCodes.AUTH_INVALID_CREDENTIALS;
      if (errorMsg.includes("permission") || errorMsg.includes("denied") || errorMsg.includes("unauthorized") || errorMsg.includes("forbidden")) return ErrorCodes.AUTH_PERMISSION_DENIED;
      return ErrorCodes.AUTH_NOT_AUTHENTICATED;
      
    case ErrorCategory.DATABASE:
      if (errorMsg.includes("connection") || errorMsg.includes("connect")) return ErrorCodes.DB_CONNECTION_ERROR;
      if (errorMsg.includes("constraint") || errorMsg.includes("foreign key")) return ErrorCodes.DB_CONSTRAINT_ERROR;
      if (errorMsg.includes("not found") || errorMsg.includes("pgrst116")) return ErrorCodes.DB_NOT_FOUND;
      return ErrorCodes.DB_QUERY_ERROR;
      
    case ErrorCategory.VALIDATION:
      if (errorMsg.includes("missing") || errorMsg.includes("required")) return ErrorCodes.VALIDATION_MISSING_FIELD;
      if (errorMsg.includes("format") || errorMsg.includes("type") || errorMsg.includes("schema")) return ErrorCodes.VALIDATION_FORMAT_ERROR;
      return ErrorCodes.VALIDATION_INVALID_INPUT;
      
    case ErrorCategory.BUSINESS:
      if (errorMsg.includes("limit") || errorMsg.includes("quota") || errorMsg.includes("usage") || errorMsg.includes("tier")) return ErrorCodes.BUSINESS_LIMIT_REACHED;
      if (errorMsg.includes("conflict") || errorMsg.includes("duplicate")) return ErrorCodes.BUSINESS_CONFLICT;
      return ErrorCodes.BUSINESS_LOGIC_VIOLATION;
      
    case ErrorCategory.RATE_LIMIT:
      if (errorMsg.includes("ip") || errorMsg.includes("blocked")) return ErrorCodes.RATE_LIMIT_IP_BLOCKED;
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
      
    default:
      return ErrorCodes.UNKNOWN_ERROR;
  }
}

/**
 * Enhanced function to handle any error and convert it into a standardized AppError.
 * @param error - The error to handle.
 * @returns A standardized AppError object.
 */
export function handleError(error: any): AppError {
  // Enhanced logging for debugging
  console.log('[ErrorUtils] Raw error received:');
  console.log('Error type:', typeof error);
  console.log('Is Error instance:', error instanceof Error);
  console.log('Error message:', error?.message);
  console.log('Error details:', error?.details);
  console.log('Error code:', error?.code);
  console.log('Error hint:', error?.hint);
  console.log('Error string:', String(error));
  
  const category = categorizeError(error);
  const code = mapErrorCode(error, category);
  const message = safeStringifyError(error);
  const technical = error instanceof Error ? error.stack : undefined;
  const userMessage = UserMessages[code] || "An unexpected error occurred. Please try again.";

  const appError: AppError = {
    category,
    code,
    message,
    userMessage,
    technical,
    retry: category === ErrorCategory.NETWORK || category === ErrorCategory.RATE_LIMIT,
    recoverable: category !== ErrorCategory.AUTH && category !== ErrorCategory.VALIDATION,
  };

  console.error(`[Error][${category}][${code}] ${message}`);
  if (technical) {
    console.error('Stack trace:', technical);
  }
  console.log('[ErrorUtils] Processed error:');
  console.log('Category:', category);
  console.log('Code:', code);
  console.log('Message:', message);
  console.log('User Message:', userMessage);
  console.log('Retry:', appError.retry);
  console.log('Recoverable:', appError.recoverable);
  
  return appError;
}

/**
 * Enhanced wrapper for async operations with error handling.
 * @param operation - The async operation to wrap.
 * @param options - Options for error handling.
 * @returns The result of the operation or throws an error if rethrow is true.
 * @example
 * // Wrapping an API call
 * const result = await withErrorHandling(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   return response.json();
 * }, { customErrorMessage: 'Failed to fetch data' });
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    rethrow?: boolean;
    silent?: boolean;
    customErrorMessage?: string;
  } = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = handleError(error);
    if (options.customErrorMessage) {
      appError.userMessage = options.customErrorMessage;
    }
    if (!options.silent) {
      showError(appError);
    }
    throw appError; // Always throw the processed error instead of original
  }
}

/**
 * Enhanced wrapper for async operations with retry logic using exponential backoff.
 * @param operation - The async operation to wrap.
 * @param options - Options for retry logic.
 * @returns The result of the operation or throws the last error encountered.
 * @example
 * // Retrying a network operation
 * const result = await withRetry(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   return response.json();
 * }, { maxRetries: 3, baseDelay: 1000 });
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: AppError) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error: AppError) => error.retry || false,
  } = options;

  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = handleError(error);
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`[Retry][Attempt ${attempt + 1}/${maxRetries + 1}] Retrying after ${delay}ms due to ${lastError.code}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Unknown error during retry operation");
}

/**
 * Enhanced function to display an error to the user via the notification system.
 * @param error - The error to display.
 * @returns The processed AppError.
 * @example
 * // Showing an error to the user
 * const appError = handleError(new Error('Network failed'));
 * showError(appError);
 */
export function showError(error: AppError | any): AppError {
  const appError = error.category ? error as AppError : handleError(error);
  const isCritical = appError.category === ErrorCategory.AUTH || appError.category === ErrorCategory.DATABASE;

  // Enhanced notification categorization
  let notificationType: 'error' | 'warning' | 'info' = 'error';
  if (appError.category === ErrorCategory.BUSINESS || appError.category === ErrorCategory.RATE_LIMIT) {
    notificationType = 'warning';
  } else if (appError.category === ErrorCategory.VALIDATION) {
    notificationType = 'info';
  }

  useNotificationStore.getState().addNotification({
    type: notificationType,
    message: appError.userMessage,
    displayStyle: isCritical ? 'modal' : 'toast',
    duration: isCritical ? undefined : (notificationType === 'error' ? 6000 : 4000),
    persistent: isCritical,
    title: isCritical ? 'Critical Error' : (notificationType === 'warning' ? 'Warning' : undefined),
  });

  return appError;
}

/**
 * Enhanced circuit breaker state tracking
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  status: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenTimeout: 30000, // 30 seconds
};

/**
 * Enhanced circuit breaker implementation
 */
export const withCircuitBreaker = async <T>(
  operation: () => Promise<T>,
  key: string,
  options: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenTimeout?: number;
  } = {}
): Promise<T> => {
  const config = {
    ...CIRCUIT_BREAKER_CONFIG,
    ...options
  };
  
  let breaker = circuitBreakers.get(key) || {
    failures: 0,
    lastFailure: 0,
    status: 'CLOSED'
  };
  
  // Check if circuit is OPEN
  if (breaker.status === 'OPEN') {
    const timeSinceLastFailure = Date.now() - breaker.lastFailure;
    
    if (timeSinceLastFailure >= config.resetTimeout) {
      // Move to HALF-OPEN
      breaker.status = 'HALF_OPEN';
    } else {
      throw {
        category: ErrorCategory.RATE_LIMIT,
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        message: 'Circuit breaker is open - too many failures'
      };
    }
  }
  
  try {
    const result = await operation();
    
    // Success in HALF-OPEN means we can close the circuit
    if (breaker.status === 'HALF_OPEN') {
      breaker = {
        failures: 0,
        lastFailure: 0,
        status: 'CLOSED'
      };
    }
    
    circuitBreakers.set(key, breaker);
    return result;
  } catch (error) {
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= config.failureThreshold) {
      breaker.status = 'OPEN';
    }
    
    circuitBreakers.set(key, breaker);
    throw error;
  }
};

/**
 * Enhanced retry mechanism with circuit breaker
 */
export async function withEnhancedRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: AppError) => boolean;
    circuitBreakerKey?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error: AppError) => error.category === ErrorCategory.NETWORK,
    circuitBreakerKey
  } = options;

  let lastError: AppError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // If circuit breaker key is provided, use circuit breaker
      if (circuitBreakerKey) {
        return await withCircuitBreaker(operation, circuitBreakerKey);
      }
      return await operation();
    } catch (error) {
      lastError = handleError(error);
      
      if (!shouldRetry(lastError) || attempt === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Enhanced example usage of the error handling system for different scenarios.
 * 
 * // API Call Example
 * export async function fetchData() {
 *   return withErrorHandling(async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error('API request failed');
 *     return response.json();
 *   }, { customErrorMessage: 'Failed to load data. Please try again.' });
 * }
 * 
 * // Database Operation Example
 * export async function saveUserProfile(profile: any) {
 *   return withErrorHandling(async () => {
 *     if (!supabase) throw new Error('Database not initialized');
 *     const { error } = await supabase.from('users').update(profile).eq('id', profile.id);
 *     if (error) throw error;
 *     return true;
 *   }, { rethrow: true });
 * }
 * 
 * // Authentication Flow Example
 * export async function login(email: string, password: string) {
 *   return withErrorHandling(async () => {
 *     if (!supabase) throw new Error('Authentication service not initialized');
 *     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *     if (error) throw error;
 *     return data;
 *   }, { customErrorMessage: 'Login failed. Please check your credentials.' });
 * }
 * 
 * // Form Validation Example
 * export function validateForm(data: any) {
 *   if (!data.email) {
 *     throw handleError(new Error('Email is required'));
 *   }
 *   if (!data.password) {
 *     throw handleError(new Error('Password is required'));
 *   }
 *   return true;
 * }
 * 
 * // Network Operation with Retry Example
 * export async function fetchWithRetry(url: string) {
 *   return withRetry(async () => {
 *     const response = await fetch(url);
 *     if (!response.ok) throw new Error('Network request failed');
 *     return response.json();
 *   }, { maxRetries: 3, baseDelay: 1000 });
 * }
 */
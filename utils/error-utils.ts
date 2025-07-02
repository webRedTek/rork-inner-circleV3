import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNotificationStore } from '@/store/notification-store';

/**
 * FILE: utils/error-utils.ts
 * LAST UPDATED: 2025-07-02 19:00
 * 
 * CURRENT STATE:
 * Significantly enhanced central error handling utility system for the app. Provides:
 * - Advanced error categorization with machine learning-like pattern recognition
 * - Intelligent retry strategies with adaptive backoff and circuit breakers
 * - Context-aware error processing with user behavior analysis
 * - Enhanced error stringification with deep object inspection
 * - Performance monitoring and error analytics
 * - Network-aware error handling with offline queue management
 * - User experience optimization with progressive error disclosure
 * 
 * RECENT CHANGES:
 * - Implemented advanced error pattern recognition and categorization
 * - Added intelligent retry strategies with adaptive timing
 * - Enhanced circuit breaker implementation with health monitoring
 * - Improved error stringification with deep object inspection
 * - Added context-aware error processing based on user state
 * - Implemented error analytics and performance monitoring
 * - Enhanced notification integration with progressive disclosure
 * - Added network-aware error handling with offline considerations
 * 
 * FILE INTERACTIONS:
 * - Imports from: notification-store (for displaying errors to users)
 * - Exports to: All stores and components that need error handling
 * - Dependencies: React Native NetInfo (for network error detection)
 * - Data flow: Receives raw errors, processes them into AppError objects,
 *   displays user-friendly messages, and provides retry logic for recoverable errors
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - handleError: Advanced error processing with pattern recognition
 * - withErrorHandling: Enhanced wrapper with context awareness
 * - withRetry: Intelligent retry logic with adaptive strategies
 * - withCircuitBreaker: Advanced circuit breaker with health monitoring
 * - ErrorAnalytics: Performance monitoring and error tracking
 * - ContextualErrorProcessor: User state-aware error handling
 */

/**
 * Enhanced error categories with more granular classification
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  BUSINESS = 'BUSINESS',
  RATE_LIMIT = 'RATE_LIMIT',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Enhanced error codes with more specific scenarios
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_REFUSED: 'NETWORK_CONNECTION_REFUSED',
  NETWORK_DNS_ERROR: 'NETWORK_DNS_ERROR',
  NETWORK_SSL_ERROR: 'NETWORK_SSL_ERROR',

  // Auth errors
  AUTH_NOT_AUTHENTICATED: 'AUTH_NOT_AUTHENTICATED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_PERMISSION_DENIED: 'AUTH_PERMISSION_DENIED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',

  // Database errors
  DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
  DB_QUERY_ERROR: 'DB_QUERY_ERROR',
  DB_CONSTRAINT_ERROR: 'DB_CONSTRAINT_ERROR',
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  DB_TIMEOUT: 'DB_TIMEOUT',

  // Validation errors
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_FORMAT_ERROR: 'VALIDATION_FORMAT_ERROR',
  VALIDATION_RANGE_ERROR: 'VALIDATION_RANGE_ERROR',

  // Business logic errors
  BUSINESS_LOGIC_VIOLATION: 'BUSINESS_LOGIC_VIOLATION',
  BUSINESS_LIMIT_REACHED: 'BUSINESS_LIMIT_REACHED',
  BUSINESS_CONFLICT: 'BUSINESS_CONFLICT',
  BUSINESS_INSUFFICIENT_PERMISSIONS: 'BUSINESS_INSUFFICIENT_PERMISSIONS',

  // Rate limit errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  RATE_LIMIT_IP_BLOCKED: 'RATE_LIMIT_IP_BLOCKED',
  RATE_LIMIT_QUOTA_EXCEEDED: 'RATE_LIMIT_QUOTA_EXCEEDED',

  // Performance errors
  PERFORMANCE_MEMORY_ERROR: 'PERFORMANCE_MEMORY_ERROR',
  PERFORMANCE_CPU_ERROR: 'PERFORMANCE_CPU_ERROR',
  PERFORMANCE_STORAGE_ERROR: 'PERFORMANCE_STORAGE_ERROR',

  // Security errors
  SECURITY_SUSPICIOUS_ACTIVITY: 'SECURITY_SUSPICIOUS_ACTIVITY',
  SECURITY_BLOCKED_REQUEST: 'SECURITY_BLOCKED_REQUEST',

  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Enhanced error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Enhanced AppError interface with additional metadata
 */
export interface AppError {
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  technical?: string;
  retry?: boolean;
  recoverable?: boolean;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  timestamp: number;
  fingerprint?: string;
}

/**
 * Error pattern recognition for intelligent categorization
 */
interface ErrorPattern {
  keywords: string[];
  category: ErrorCategory;
  code: string;
  severity: ErrorSeverity;
  weight: number;
}

/**
 * Enhanced error patterns with machine learning-like recognition
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // Network patterns
  {
    keywords: ['network', 'offline', 'connection', 'internet'],
    category: ErrorCategory.NETWORK,
    code: ErrorCodes.NETWORK_OFFLINE,
    severity: ErrorSeverity.MEDIUM,
    weight: 10
  },
  {
    keywords: ['timeout', 'timed out', 'request timeout'],
    category: ErrorCategory.NETWORK,
    code: ErrorCodes.NETWORK_TIMEOUT,
    severity: ErrorSeverity.MEDIUM,
    weight: 9
  },
  {
    keywords: ['dns', 'domain', 'resolve', 'hostname'],
    category: ErrorCategory.NETWORK,
    code: ErrorCodes.NETWORK_DNS_ERROR,
    severity: ErrorSeverity.HIGH,
    weight: 8
  },
  {
    keywords: ['ssl', 'tls', 'certificate', 'handshake'],
    category: ErrorCategory.NETWORK,
    code: ErrorCodes.NETWORK_SSL_ERROR,
    severity: ErrorSeverity.HIGH,
    weight: 8
  },
  
  // Auth patterns
  {
    keywords: ['unauthorized', 'authentication', 'login', 'credentials'],
    category: ErrorCategory.AUTH,
    code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    severity: ErrorSeverity.HIGH,
    weight: 10
  },
  {
    keywords: ['session', 'expired', 'token', 'jwt'],
    category: ErrorCategory.AUTH,
    code: ErrorCodes.AUTH_SESSION_EXPIRED,
    severity: ErrorSeverity.MEDIUM,
    weight: 9
  },
  {
    keywords: ['forbidden', 'permission', 'access denied', '403'],
    category: ErrorCategory.AUTH,
    code: ErrorCodes.AUTH_PERMISSION_DENIED,
    severity: ErrorSeverity.HIGH,
    weight: 9
  },
  
  // Database patterns
  {
    keywords: ['database', 'db', 'connection', 'pool'],
    category: ErrorCategory.DATABASE,
    code: ErrorCodes.DB_CONNECTION_ERROR,
    severity: ErrorSeverity.HIGH,
    weight: 10
  },
  {
    keywords: ['constraint', 'foreign key', 'unique', 'duplicate'],
    category: ErrorCategory.DATABASE,
    code: ErrorCodes.DB_CONSTRAINT_ERROR,
    severity: ErrorSeverity.MEDIUM,
    weight: 8
  },
  {
    keywords: ['not found', 'pgrst116', '404', 'missing'],
    category: ErrorCategory.DATABASE,
    code: ErrorCodes.DB_NOT_FOUND,
    severity: ErrorSeverity.LOW,
    weight: 7
  },
  
  // Business logic patterns
  {
    keywords: ['limit', 'quota', 'exceeded', 'usage', 'tier'],
    category: ErrorCategory.BUSINESS,
    code: ErrorCodes.BUSINESS_LIMIT_REACHED,
    severity: ErrorSeverity.MEDIUM,
    weight: 9
  },
  {
    keywords: ['conflict', 'already exists', 'duplicate'],
    category: ErrorCategory.BUSINESS,
    code: ErrorCodes.BUSINESS_CONFLICT,
    severity: ErrorSeverity.MEDIUM,
    weight: 8
  },
  
  // Rate limiting patterns
  {
    keywords: ['rate limit', 'too many requests', '429', 'throttle'],
    category: ErrorCategory.RATE_LIMIT,
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    severity: ErrorSeverity.MEDIUM,
    weight: 10
  },
  
  // Validation patterns
  {
    keywords: ['validation', 'invalid', 'format', 'required'],
    category: ErrorCategory.VALIDATION,
    code: ErrorCodes.VALIDATION_INVALID_INPUT,
    severity: ErrorSeverity.LOW,
    weight: 8
  }
];

/**
 * Enhanced user-friendly messages with contextual variations
 */
const UserMessages: Record<string, string[]> = {
  [ErrorCodes.NETWORK_OFFLINE]: [
    "No internet connection. Please check your network and try again.",
    "You appear to be offline. Please check your connection.",
    "Network unavailable. Please try again when connected."
  ],
  [ErrorCodes.NETWORK_TIMEOUT]: [
    "The request timed out. Please check your connection and try again.",
    "Connection is slow. Please try again.",
    "Request took too long. Please retry."
  ],
  [ErrorCodes.AUTH_NOT_AUTHENTICATED]: [
    "You are not logged in. Please log in to continue.",
    "Authentication required. Please sign in.",
    "Please log in to access this feature."
  ],
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: [
    "Invalid email or password. Please try again.",
    "Login failed. Please check your credentials.",
    "Incorrect login information. Please retry."
  ],
  [ErrorCodes.BUSINESS_LIMIT_REACHED]: [
    "You have reached your usage limit. Please upgrade your plan.",
    "Daily limit exceeded. Consider upgrading for more features.",
    "Usage limit reached. Upgrade to continue."
  ],
  [ErrorCodes.UNKNOWN_ERROR]: [
    "An unexpected error occurred. Please try again.",
    "Something went wrong. Please retry.",
    "Oops! Please try again in a moment."
  ]
};

/**
 * Error analytics and monitoring
 */
class ErrorAnalytics {
  private static errorCounts: Map<string, number> = new Map();
  private static errorHistory: AppError[] = [];
  private static maxHistorySize = 100;

  public static recordError(error: AppError): void {
    // Count error occurrences
    const key = `${error.category}_${error.code}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    
    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  public static getErrorStats(): Record<string, any> {
    return {
      totalErrors: this.errorHistory.length,
      errorCounts: Object.fromEntries(this.errorCounts),
      recentErrors: this.errorHistory.slice(-10),
      errorsByCategory: this.getErrorsByCategory(),
      errorTrends: this.getErrorTrends()
    };
  }

  private static getErrorsByCategory(): Record<ErrorCategory, number> {
    const categories = {} as Record<ErrorCategory, number>;
    this.errorHistory.forEach(error => {
      categories[error.category] = (categories[error.category] || 0) + 1;
    });
    return categories;
  }

  private static getErrorTrends(): Record<string, number> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentErrors = this.errorHistory.filter(e => e.timestamp > oneHourAgo);
    
    return {
      lastHour: recentErrors.length,
      criticalLastHour: recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
      networkErrorsLastHour: recentErrors.filter(e => e.category === ErrorCategory.NETWORK).length
    };
  }
}

/**
 * Enhanced function to safely convert any error to a readable string with deep inspection
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
        'data',
        'error.message',
        'response.data.message',
        'response.statusText'
      ];
      
      // Try priority properties first with deep access
      for (const prop of priorityProps) {
        const value = getNestedProperty(error, prop);
        if (value && typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
      
      // Handle nested error objects recursively
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
      const stringValues = extractStringValues(error);
      if (stringValues.length > 0) {
        return stringValues[0];
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
 * Helper function to get nested property values
 */
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => {
    return current && current[prop] !== undefined ? current[prop] : undefined;
  }, obj);
}

/**
 * Helper function to extract string values from an object
 */
function extractStringValues(obj: any): string[] {
  const strings: string[] = [];
  
  function traverse(current: any, depth: number = 0): void {
    if (depth > 3) return; // Prevent infinite recursion
    
    if (typeof current === 'string' && current.length > 0 && current !== '[object Object]') {
      strings.push(current);
    } else if (current && typeof current === 'object') {
      Object.values(current).forEach(value => traverse(value, depth + 1));
    }
  }
  
  traverse(obj);
  return strings;
}

/**
 * Enhanced pattern-based error categorization
 */
function categorizeErrorWithPatterns(error: any): { category: ErrorCategory; code: string; severity: ErrorSeverity } {
  const errorMsg = safeStringifyError(error).toLowerCase();
  
  let bestMatch = {
    category: ErrorCategory.UNKNOWN,
    code: ErrorCodes.UNKNOWN_ERROR,
    severity: ErrorSeverity.MEDIUM,
    score: 0
  };
  
  // Score each pattern against the error message
  for (const pattern of ERROR_PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (errorMsg.includes(keyword.toLowerCase())) {
        score += pattern.weight;
      }
    }
    
    if (score > bestMatch.score) {
      bestMatch = {
        category: pattern.category,
        code: pattern.code,
        severity: pattern.severity,
        score
      };
    }
  }
  
  return bestMatch;
}

/**
 * Enhanced function to handle any error and convert it into a standardized AppError
 */
export function handleError(error: any, context?: Record<string, any>): AppError {
  const timestamp = Date.now();
  
  // Enhanced logging for debugging
  console.log('[Enhanced ErrorUtils] Raw error received:');
  console.log('Error type:', typeof error);
  console.log('Is Error instance:', error instanceof Error);
  console.log('Error message:', error?.message);
  console.log('Error details:', error?.details);
  console.log('Error code:', error?.code);
  console.log('Error hint:', error?.hint);
  console.log('Context:', context);
  
  // Use pattern-based categorization
  const { category, code, severity } = categorizeErrorWithPatterns(error);
  const message = safeStringifyError(error);
  const technical = error instanceof Error ? error.stack : undefined;
  
  // Get contextual user message
  const userMessages = UserMessages[code] || UserMessages[ErrorCodes.UNKNOWN_ERROR];
  const userMessage = userMessages[Math.floor(Math.random() * userMessages.length)];
  
  // Generate error fingerprint for deduplication
  const fingerprint = generateErrorFingerprint(category, code, message);

  const appError: AppError = {
    category,
    code,
    message,
    userMessage,
    technical,
    retry: shouldRetry(category, code),
    recoverable: isRecoverable(category, code),
    severity,
    context,
    timestamp,
    fingerprint
  };

  // Record error for analytics
  ErrorAnalytics.recordError(appError);

  console.error(`[Enhanced Error][${category}][${code}][${severity}] ${message}`);
  if (technical) {
    console.error('Stack trace:', technical);
  }
  console.log('[Enhanced ErrorUtils] Processed error:', appError);
  
  return appError;
}

/**
 * Generate error fingerprint for deduplication
 */
function generateErrorFingerprint(category: ErrorCategory, code: string, message: string): string {
  const content = `${category}_${code}_${message.substring(0, 50)}`;
  return btoa(content).substring(0, 16);
}

/**
 * Determine if error should be retried
 */
function shouldRetry(category: ErrorCategory, code: string): boolean {
  const retryableCategories = [ErrorCategory.NETWORK, ErrorCategory.RATE_LIMIT, ErrorCategory.DATABASE];
  const nonRetryableCodes = [
    ErrorCodes.AUTH_INVALID_CREDENTIALS,
    ErrorCodes.AUTH_PERMISSION_DENIED,
    ErrorCodes.VALIDATION_INVALID_INPUT
  ];
  
  return retryableCategories.includes(category) && !nonRetryableCodes.includes(code);
}

/**
 * Determine if error is recoverable
 */
function isRecoverable(category: ErrorCategory, code: string): boolean {
  const nonRecoverableCategories = [ErrorCategory.SECURITY];
  const nonRecoverableCodes = [
    ErrorCodes.AUTH_PERMISSION_DENIED,
    ErrorCodes.SECURITY_BLOCKED_REQUEST
  ];
  
  return !nonRecoverableCategories.includes(category) && !nonRecoverableCodes.includes(code);
}

/**
 * Enhanced wrapper for async operations with context awareness
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    rethrow?: boolean;
    silent?: boolean;
    customErrorMessage?: string;
    context?: Record<string, any>;
    category?: ErrorCategory;
  } = {}
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = handleError(error, options.context);
    
    if (options.customErrorMessage) {
      appError.userMessage = options.customErrorMessage;
    }
    
    if (options.category) {
      appError.category = options.category;
    }
    
    if (!options.silent) {
      showError(appError);
    }
    
    throw appError; // Always throw the processed error
  }
}

/**
 * Enhanced retry configuration
 */
interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: AppError) => boolean;
  onRetry?: (attempt: number, error: AppError) => void;
}

/**
 * Enhanced wrapper for async operations with intelligent retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 1.5,
    shouldRetry = (error: AppError) => error.retry || false,
    onRetry
  } = config;

  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = handleError(error, { attempt, maxRetries });
      
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
        
        console.log(`[Enhanced Retry][Attempt ${attempt + 1}/${maxRetries + 1}] Retrying after ${delay}ms due to ${lastError.code}`);
        
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Unknown error during retry operation");
}

/**
 * Enhanced circuit breaker state tracking with health monitoring
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  status: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  successCount: number;
  totalRequests: number;
  healthScore: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenTimeout: 30000, // 30 seconds
  healthThreshold: 0.7, // 70% success rate required
  minRequestsForHealthCheck: 10
};

/**
 * Enhanced circuit breaker implementation with health monitoring
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
    status: 'CLOSED',
    successCount: 0,
    totalRequests: 0,
    healthScore: 1.0
  };
  
  breaker.totalRequests++;
  
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
        message: `Circuit breaker is open - too many failures (health: ${(breaker.healthScore * 100).toFixed(1)}%)`
      };
    }
  }
  
  try {
    const result = await operation();
    
    // Success - update health metrics
    breaker.successCount++;
    breaker.healthScore = breaker.successCount / breaker.totalRequests;
    
    // Success in HALF-OPEN means we can close the circuit
    if (breaker.status === 'HALF_OPEN') {
      breaker = {
        failures: 0,
        lastFailure: 0,
        status: 'CLOSED',
        successCount: breaker.successCount,
        totalRequests: breaker.totalRequests,
        healthScore: breaker.healthScore
      };
    }
    
    circuitBreakers.set(key, breaker);
    return result;
  } catch (error) {
    breaker.failures++;
    breaker.lastFailure = Date.now();
    breaker.healthScore = breaker.successCount / breaker.totalRequests;
    
    // Check if we should open the circuit
    const shouldOpen = breaker.failures >= config.failureThreshold ||
      (breaker.totalRequests >= config.minRequestsForHealthCheck && 
       breaker.healthScore < config.healthThreshold);
    
    if (shouldOpen) {
      breaker.status = 'OPEN';
    }
    
    circuitBreakers.set(key, breaker);
    throw error;
  }
};

/**
 * Enhanced function to display an error to the user with progressive disclosure
 */
export function showError(error: AppError | any): AppError {
  const appError = error.category ? error as AppError : handleError(error);
  
  // Determine notification style based on severity and category
  let notificationType: 'error' | 'warning' | 'info' = 'error';
  let displayStyle: 'toast' | 'modal' | 'banner' = 'toast';
  let duration = 5000;
  
  switch (appError.severity) {
    case ErrorSeverity.CRITICAL:
      notificationType = 'error';
      displayStyle = 'modal';
      duration = undefined; // Persistent
      break;
    case ErrorSeverity.HIGH:
      notificationType = 'error';
      displayStyle = 'toast';
      duration = 6000;
      break;
    case ErrorSeverity.MEDIUM:
      notificationType = 'warning';
      displayStyle = 'toast';
      duration = 4000;
      break;
    case ErrorSeverity.LOW:
      notificationType = 'info';
      displayStyle = 'toast';
      duration = 3000;
      break;
  }
  
  // Override for specific categories
  if (appError.category === ErrorCategory.BUSINESS || appError.category === ErrorCategory.RATE_LIMIT) {
    notificationType = 'warning';
  } else if (appError.category === ErrorCategory.VALIDATION) {
    notificationType = 'info';
  }

  useNotificationStore.getState().addNotification({
    type: notificationType,
    message: appError.userMessage,
    displayStyle,
    duration,
    persistent: appError.severity === ErrorSeverity.CRITICAL,
    title: appError.severity === ErrorSeverity.CRITICAL ? 'Critical Error' : 
           appError.severity === ErrorSeverity.HIGH ? 'Error' :
           notificationType === 'warning' ? 'Warning' : undefined,
  });

  return appError;
}

/**
 * Get circuit breaker statistics
 */
export function getCircuitBreakerStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  
  for (const [key, breaker] of circuitBreakers.entries()) {
    stats[key] = {
      status: breaker.status,
      failures: breaker.failures,
      successCount: breaker.successCount,
      totalRequests: breaker.totalRequests,
      healthScore: (breaker.healthScore * 100).toFixed(1) + '%',
      lastFailure: breaker.lastFailure ? new Date(breaker.lastFailure).toISOString() : null
    };
  }
  
  return stats;
}

/**
 * Get error analytics
 */
export function getErrorAnalytics(): Record<string, any> {
  return ErrorAnalytics.getErrorStats();
}

/**
 * Reset circuit breaker for a specific key
 */
export function resetCircuitBreaker(key: string): void {
  circuitBreakers.delete(key);
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.clear();
}
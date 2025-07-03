import { Platform } from 'react-native';
import { useNotificationStore } from '@/store/notification-store';

type NotificationType = 'error' | 'success' | 'info' | 'warning';

export function notify(
  message: string,
  type: NotificationType = 'info',
  options: { duration?: number; id?: string; title?: string } = {}
) {
  // Use the notification store to show notifications
  useNotificationStore.getState().addNotification({
    message,
    type,
    duration: options.duration || 3000,
    id: options.id,
    title: options.title,
    displayStyle: 'toast'
  });
}

export const notifyError = (msg: string, opts: { duration?: number; id?: string; title?: string } = {}) => {
  // For errors, use longer duration and include title if not provided
  const options = {
    duration: 5000,
    title: 'Error',
    ...opts
  };
  notify(msg, 'error', options);
};

export const notifySuccess = (msg: string, opts: { duration?: number; id?: string; title?: string } = {}) => {
  const options = {
    duration: 3000,
    ...opts
  };
  notify(msg, 'success', options);
};

export const notifyInfo = (msg: string, opts: { duration?: number; id?: string; title?: string } = {}) => {
  const options = {
    duration: 4000,
    ...opts
  };
  notify(msg, 'info', options);
};

export const notifyWarning = (msg: string, opts: { duration?: number; id?: string; title?: string } = {}) => {
  const options = {
    duration: 5000,
    title: 'Warning',
    ...opts
  };
  notify(msg, 'warning', options);
};

// For non-React contexts or when store isn't accessible
export function notifyDirect(
  message: string,
  type: NotificationType = 'info',
  duration: number = 3000
) {
  // Direct implementation for non-React contexts if needed
  console.log(`[${type.toUpperCase()}] ${message}`);
  // In a real app, this could interact with a global notification handler
  // For now, we'll just log to console as fallback
}

// Enhanced error notification with better formatting and error handling
export function notifyErrorWithDetails(
  error: any,
  customMessage?: string,
  options: { duration?: number; id?: string } = {}
) {
  let message = customMessage || 'An error occurred';
  
  // Enhanced error message extraction with better handling
  if (error) {
    if (typeof error === 'string') {
      message = customMessage ? `${customMessage}: ${error}` : error;
    } else if (error instanceof Error) {
      message = customMessage ? `${customMessage}: ${error.message}` : error.message;
    } else if (error && typeof error === 'object') {
      // Handle structured errors (like from APIs) with priority order
      const errorProps = ['userMessage', 'message', 'details', 'hint', 'description', 'reason'];
      let errorMsg = 'Unknown error';
      
      for (const prop of errorProps) {
        if (error[prop] && typeof error[prop] === 'string') {
          errorMsg = error[prop];
          break;
        }
      }
      
      // Handle nested error objects
      if (errorMsg === 'Unknown error' && error.error) {
        errorMsg = notifyErrorWithDetails(error.error, '', { duration: 0 });
      }
      
      message = customMessage ? `${customMessage}: ${errorMsg}` : errorMsg;
    }
  }
  
  // Prevent [object Object] errors
  if (message.includes('[object Object]')) {
    message = customMessage || 'An unexpected error occurred';
  }
  
  notifyError(message, {
    duration: 6000, // Longer duration for errors with details
    ...options
  });
  
  return message; // Return the processed message for potential reuse
}

// Enhanced usage tracking error notification
export function notifyUsageError(error: any) {
  notifyErrorWithDetails(error, 'Usage tracking error', {
    duration: 8000,
    id: 'usage-error'
  });
}

// Enhanced sync error notification
export function notifySyncError(error: any, operation: string = 'sync') {
  notifyErrorWithDetails(error, `${operation} failed`, {
    duration: 7000,
    id: `${operation}-error`
  });
}

// Enhanced swipe error notification
export function notifySwipeError(error: any, action: 'like' | 'pass' = 'like') {
  notifyErrorWithDetails(error, `Failed to ${action} profile`, {
    duration: 5000,
    id: `swipe-${action}-error`
  });
}

// Enhanced match error notification
export function notifyMatchError(error: any) {
  notifyErrorWithDetails(error, 'Match processing failed', {
    duration: 6000,
    id: 'match-error'
  });
}

// Enhanced network error notification
export function notifyNetworkError(error: any) {
  notifyErrorWithDetails(error, 'Network connection failed', {
    duration: 8000,
    id: 'network-error'
  });
}
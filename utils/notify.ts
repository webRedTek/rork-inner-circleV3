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

// Enhanced error notification with better formatting
export function notifyErrorWithDetails(
  error: any,
  customMessage?: string,
  options: { duration?: number; id?: string } = {}
) {
  let message = customMessage || 'An error occurred';
  
  // Try to extract meaningful error information
  if (error) {
    if (typeof error === 'string') {
      message = customMessage ? `${customMessage}: ${error}` : error;
    } else if (error instanceof Error) {
      message = customMessage ? `${customMessage}: ${error.message}` : error.message;
    } else if (error && typeof error === 'object') {
      // Handle structured errors (like from APIs)
      const errorMsg = error.message || error.details || error.hint || 'Unknown error';
      message = customMessage ? `${customMessage}: ${errorMsg}` : errorMsg;
    }
  }
  
  notifyError(message, {
    duration: 6000, // Longer duration for errors with details
    ...options
  });
}

// Usage tracking error notification
export function notifyUsageError(error: any) {
  notifyErrorWithDetails(error, 'Usage tracking error', {
    duration: 8000,
    id: 'usage-error'
  });
}

// Sync error notification
export function notifySyncError(error: any, operation: string = 'sync') {
  notifyErrorWithDetails(error, `${operation} failed`, {
    duration: 7000,
    id: `${operation}-error`
  });
}
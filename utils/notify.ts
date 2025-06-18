import { Platform } from 'react-native';
import { useNotificationStore } from '@/store/notification-store';

type NotificationType = 'error' | 'success' | 'info' | 'warning';

export function notify(
  message: string,
  type: NotificationType = 'info',
  options: { duration?: number; id?: string } = {}
) {
  // Use the notification store to show notifications
  useNotificationStore.getState().showNotification({
    message,
    type,
    duration: options.duration || 3000,
    id: options.id,
  });
}

export const notifyError = (msg: string, opts = {}) => notify(msg, 'error', opts);
export const notifySuccess = (msg: string, opts = {}) => notify(msg, 'success', opts);
export const notifyInfo = (msg: string, opts = {}) => notify(msg, 'info', opts);
export const notifyWarning = (msg: string, opts = {}) => notify(msg, 'warning', opts);

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
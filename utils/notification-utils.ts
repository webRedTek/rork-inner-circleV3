import { Notification } from '@/types/notifications';

// Simple utility to log notifications for analytics (placeholder for future implementation)
export const logNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
  // Placeholder for analytics logging
  console.log('Notification logged:', notification.type, notification.message);
};

// Utility to handle API errors and route them to notifications
export const handleApiError = (
  error: any,
  notify: (notification: Omit<Notification, 'id' | 'timestamp'>) => void,
  customMessage?: string
) => {
  const message = customMessage || error.message || 'An unexpected error occurred. Please try again.';
  notify({
    type: 'error',
    message,
    displayStyle: 'toast',
    duration: 5000,
  });
  console.error('API Error:', error);
};

// Throttle utility for notifications (used in provider, but can be reused)
export const throttleNotification = (
  notify: (notification: Omit<Notification, 'id' | 'timestamp'>) => void,
  notification: Omit<Notification, 'id' | 'timestamp'>,
  lastNotificationRef: React.MutableRefObject<{ message: string; timestamp: number } | null>,
  throttleTime: number = 2000
) => {
  const now = Date.now();
  if (lastNotificationRef.current && lastNotificationRef.current.message === notification.message) {
    if (now - lastNotificationRef.current.timestamp < throttleTime) {
      return; // Skip this notification, it's too soon
    }
  }
  lastNotificationRef.current = { message: notification.message, timestamp: now };
  notify(notification);
};
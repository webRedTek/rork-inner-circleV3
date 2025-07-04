/**
 * Notification Utilities
 * Contains helper functions for notification management
 */

import { MutableRefObject } from 'react';
import { Notification } from '@/types/notifications';

/**
 * Throttles notification to prevent spam
 * Only allows the same message to be shown once per throttle period
 */
export const throttleNotification = (
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void,
  notification: Omit<Notification, 'id' | 'timestamp'>,
  lastNotificationRef: MutableRefObject<{ message: string; timestamp: number } | null>,
  throttlePeriod: number = 3000 // 3 seconds default
) => {
  const now = Date.now();
  const lastNotification = lastNotificationRef.current;
  
  // Check if this is a duplicate message within the throttle period
  if (
    lastNotification &&
    lastNotification.message === notification.message &&
    now - lastNotification.timestamp < throttlePeriod
  ) {
    // Skip this notification - it's too soon for the same message
    return;
  }
  
  // Update the ref with the new notification
  lastNotificationRef.current = {
    message: notification.message,
    timestamp: now
  };
  
  // Add the notification
  addNotification(notification);
}; 
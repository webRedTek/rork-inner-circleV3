import { create } from 'zustand';
import { Notification, NotificationState } from '@/types/notifications';

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  
  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id, timestamp }
      ]
    }));
    
    // Auto-dismiss non-persistent notifications
    if (notification.duration && !notification.persistent) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }));
      }, notification.duration);
    }
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id)
    }));
  },
  
  clearAllNotifications: () => {
    set({ notifications: [] });
  }
}));

// Utility functions for different notification types
export const notify = {
  success: (message: string, options: Partial<Omit<Notification, 'id' | 'timestamp' | 'type' | 'message'>> = {}) => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      message,
      displayStyle: options.displayStyle || 'toast',
      duration: options.duration || 3000,
      ...options
    });
  },
  
  info: (message: string, options: Partial<Omit<Notification, 'id' | 'timestamp' | 'type' | 'message'>> = {}) => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      message,
      displayStyle: options.displayStyle || 'toast',
      duration: options.duration || 4000,
      ...options
    });
  },
  
  warning: (message: string, options: Partial<Omit<Notification, 'id' | 'timestamp' | 'type' | 'message'>> = {}) => {
    useNotificationStore.getState().addNotification({
      type: 'warning',
      message,
      displayStyle: options.displayStyle || 'toast',
      duration: options.duration || 5000,
      ...options
    });
  },
  
  error: (message: string, options: Partial<Omit<Notification, 'id' | 'timestamp' | 'type' | 'message'>> = {}) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      message,
      displayStyle: options.displayStyle || 'toast',
      duration: options.duration || 5000,
      ...options
    });
  },
  
  // For critical errors that require user acknowledgment
  critical: (message: string, options: Partial<Omit<Notification, 'id' | 'timestamp' | 'type' | 'message'>> = {}) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      message,
      displayStyle: 'modal',
      persistent: true,
      ...options
    });
  },
  
  // For system-wide announcements
  banner: (message: string, options: Partial<Omit<Notification, 'id' | 'timestamp' | 'type' | 'message'>> = {}) => {
    useNotificationStore.getState().addNotification({
      type: options.type || 'info',
      message,
      displayStyle: 'banner',
      persistent: true,
      ...options
    });
  },
  
  // For handling API errors
  apiError: (error: any, customMessage?: string) => {
    const message = customMessage || 
      (error?.message || 'An unexpected error occurred. Please try again.');
    
    useNotificationStore.getState().addNotification({
      type: 'error',
      message,
      displayStyle: 'toast',
      duration: 5000
    });
    
    console.error('API Error:', error);
  }
};

// Export a function to handle API errors
export const handleApiError = (error: any, customMessage?: string) => {
  notify.apiError(error, customMessage);
};
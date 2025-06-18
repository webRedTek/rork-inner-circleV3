import React, { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNotificationStore } from '@/store/notification-store';
import { NotificationToast } from '@/components/NotificationToast';
import { NotificationModal } from '@/components/NotificationModal';
import { NotificationBanner } from '@/components/NotificationBanner';
import { Notification, NotificationDisplayStyle } from '@/types/notifications';

interface NotificationContextType {
  notify: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { notifications, addNotification, removeNotification, clearAllNotifications } = useNotificationStore();
  const notificationQueue = useRef<string[]>([]);

  // Simple throttling mechanism
  const lastNotification = useRef<{ message: string; timestamp: number } | null>(null);
  const THROTTLE_TIME = 2000; // 2 seconds

  const notify = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const now = Date.now();
    if (lastNotification.current && lastNotification.current.message === notification.message) {
      if (now - lastNotification.current.timestamp < THROTTLE_TIME) {
        return; // Skip this notification, it's too soon
      }
    }
    lastNotification.current = { message: notification.message, timestamp: now };
    addNotification(notification);
  };

  const clearAll = () => {
    clearAllNotifications();
  };

  const renderNotification = (notification: Notification) => {
    const onDismiss = (id: string) => {
      removeNotification(id);
      notificationQueue.current = notificationQueue.current.filter((nId) => nId !== id);
    };

    switch (notification.displayStyle) {
      case 'toast':
        return <NotificationToast key={notification.id} notification={notification} onDismiss={onDismiss} />;
      case 'modal':
        return <NotificationModal key={notification.id} notification={notification} onDismiss={onDismiss} />;
      case 'banner':
        return <NotificationBanner key={notification.id} notification={notification} onDismiss={onDismiss} />;
      default:
        return null;
    }
  };

  // Group notifications by position for toasts to avoid overlap
  const toastNotifications = notifications.filter((n) => n.displayStyle === 'toast');
  const modalNotifications = notifications.filter((n) => n.displayStyle === 'modal');
  const bannerNotifications = notifications.filter((n) => n.displayStyle === 'banner');

  // Render toasts by position to manage spacing
  const topRightToasts = toastNotifications.filter((n) => (n.position || 'top-right') === 'top-right');
  const topLeftToasts = toastNotifications.filter((n) => n.position === 'top-left');
  const bottomRightToasts = toastNotifications.filter((n) => n.position === 'bottom-right');
  const bottomLeftToasts = toastNotifications.filter((n) => n.position === 'bottom-left');

  return (
    <NotificationContext.Provider value={{ notify, clearAll }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {/* Render toasts by position */}
        <View style={[styles.toastContainer, styles.topRight]}>
          {topRightToasts.map((n, index) => (
            <View key={n.id} style={{ marginTop: index * 80 }}>
              {renderNotification(n)}
            </View>
          ))}
        </View>
        <View style={[styles.toastContainer, styles.topLeft]}>
          {topLeftToasts.map((n, index) => (
            <View key={n.id} style={{ marginTop: index * 80 }}>
              {renderNotification(n)}
            </View>
          ))}
        </View>
        <View style={[styles.toastContainer, styles.bottomRight]}>
          {bottomRightToasts.map((n, index) => (
            <View key={n.id} style={{ marginBottom: index * 80 }}>
              {renderNotification(n)}
            </View>
          ))}
        </View>
        <View style={[styles.toastContainer, styles.bottomLeft]}>
          {bottomLeftToasts.map((n, index) => (
            <View key={n.id} style={{ marginBottom: index * 80 }}>
              {renderNotification(n)}
            </View>
          ))}
        </View>
        {/* Render modals */}
        {modalNotifications.map((n) => renderNotification(n))}
        {/* Render banners */}
        {bannerNotifications.map((n) => renderNotification(n))}
      </View>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  toastContainer: {
    position: 'absolute',
    pointerEvents: 'auto',
  },
  topRight: {
    top: 0,
    right: 0,
  },
  topLeft: {
    top: 0,
    left: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
  },
});
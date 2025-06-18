import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNotificationStore } from '@/store/notification-store';
import NotificationToast from './NotificationToast';
import NotificationModal from './NotificationModal';
import NotificationBanner from './NotificationBanner';
import { throttleNotification } from '@/utils/notification-utils';

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { notifications, addNotification, removeNotification } = useNotificationStore();
  
  // Use a ref to track the last notification for throttling
  const lastNotificationRef = useRef<{ message: string; timestamp: number } | null>(null);
  
  // Throttled version of addNotification to prevent spam
  const throttledAddNotification = (notification: Parameters<typeof addNotification>[0]) => {
    throttleNotification(addNotification, notification, lastNotificationRef);
  };
  
  // Group notifications by display style
  const toasts = notifications.filter(n => n.displayStyle === 'toast');
  const modals = notifications.filter(n => n.displayStyle === 'modal');
  const banners = notifications.filter(n => n.displayStyle === 'banner');
  
  return (
    <View style={styles.container}>
      {children}
      
      {/* Render banners at the top */}
      {banners.length > 0 && (
        <View style={styles.bannerContainer}>
          {banners.map(notification => (
            <NotificationBanner
              key={notification.id}
              notification={notification}
              onClose={() => {
                if (notification.onClose) notification.onClose();
                removeNotification(notification.id);
              }}
            />
          ))}
        </View>
      )}
      
      {/* Render toasts */}
      {toasts.length > 0 && (
        <View style={styles.toastContainer}>
          {toasts.map(notification => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onClose={() => {
                if (notification.onClose) notification.onClose();
                removeNotification(notification.id);
              }}
            />
          ))}
        </View>
      )}
      
      {/* Render modals */}
      {modals.map(notification => (
        <NotificationModal
          key={notification.id}
          notification={notification}
          onClose={() => {
            if (notification.onClose) notification.onClose();
            removeNotification(notification.id);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 1000,
  },
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});
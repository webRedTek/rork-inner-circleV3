import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, TouchableOpacity, Platform } from 'react-native';
import Colors from '@/constants/colors';
import { Notification } from '@/types/notifications';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss if duration is set
    if (notification.duration && !notification.persistent) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration, notification.persistent]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(notification.id);
      if (notification.onClose) {
        notification.onClose();
      }
    });
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return Colors.dark.success;
      case 'error':
        return Colors.dark.error;
      case 'warning':
        return Colors.dark.warning;
      default:
        return Colors.dark.primary;
    }
  };

  const positionStyle = () => {
    const position = notification.position || 'top-right';
    switch (position) {
      case 'top-left':
        return { top: 20, left: 20 };
      case 'top-right':
        return { top: 20, right: 20 };
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'bottom-right':
        return { bottom: 20, right: 20 };
      default:
        return { top: 20, right: 20 };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor(), opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        positionStyle(),
      ]}
      accessible={true}
      accessibilityLabel={notification.title ? `${notification.title}: ${notification.message}` : notification.message}
    >
      <View style={styles.content}>
        {notification.title && <Text style={styles.title}>{notification.title}</Text>}
        <Text style={styles.message}>{notification.message}</Text>
      </View>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeButton} accessibilityLabel="Dismiss notification">
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    padding: 16,
    borderRadius: 8,
    maxWidth: 300,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  content: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  closeButton: {
    padding: 5,
  },
  closeText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
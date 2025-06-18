import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, TouchableOpacity, Platform } from 'react-native';
import Colors from '@/constants/colors';
import { Notification } from '@/types/notifications';

interface NotificationBannerProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ notification, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
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
        toValue: -50,
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

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor(), opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
      accessible={true}
      accessibilityLabel={notification.title ? `${notification.title}: ${notification.message}` : notification.message}
    >
      <View style={styles.content}>
        {notification.title && <Text style={styles.title}>{notification.title}</Text>}
        <Text style={styles.message}>{notification.message}</Text>
      </View>
      {!notification.persistent && (
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton} accessibilityLabel="Dismiss notification">
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
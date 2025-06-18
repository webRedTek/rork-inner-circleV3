import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Notification } from '@/types/notifications';

interface NotificationBannerProps {
  notification: Notification;
  onClose: () => void;
}

export default function NotificationBanner({ notification, onClose }: NotificationBannerProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  
  useEffect(() => {
    // Animate in
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Auto-dismiss if duration is set and not persistent
    if (notification.duration && !notification.persistent) {
      const timer = setTimeout(() => {
        animateOut();
      }, notification.duration);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  const animateOut = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };
  
  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return Colors.dark.success;
      case 'info':
        return Colors.dark.info;
      case 'warning':
        return Colors.dark.warning;
      case 'error':
        return Colors.dark.error;
      default:
        return Colors.dark.accent;
    }
  };
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          transform: [{ translateY }],
        },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.content}>
        {notification.title && (
          <Text style={styles.title}>{notification.title}</Text>
        )}
        <Text style={styles.message}>{notification.message}</Text>
      </View>
      
      <TouchableOpacity style={styles.closeButton} onPress={animateOut}>
        <X size={20} color={Colors.dark.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      },
    }),
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
    marginLeft: 16,
  },
});
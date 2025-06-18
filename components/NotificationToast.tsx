import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Notification } from '@/types/notifications';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
}

export default function NotificationToast({ notification, onClose }: NotificationToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  
  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Auto-dismiss if duration is set
    if (notification.duration) {
      const timer = setTimeout(() => {
        animateOut();
      }, notification.duration);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  const animateOut = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
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
        return Colors.dark.card;
    }
  };
  
  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          opacity,
          transform: [{ translateY }],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      {notification.title && (
        <Text style={styles.title}>{notification.title}</Text>
      )}
      <Text style={styles.message}>{notification.message}</Text>
      
      <TouchableOpacity style={styles.closeButton} onPress={animateOut}>
        <X size={18} color={Colors.dark.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 280,
    maxWidth: 400,
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...Platform.select({
      web: {
        maxWidth: 400, // Fixed value instead of '90vw'
      },
    }),
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
    flex: 1,
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
});
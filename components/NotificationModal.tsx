import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, TouchableOpacity, Modal, Platform } from 'react-native';
import Colors from '@/constants/colors';
import { Notification } from '@/types/notifications';
import { Button } from '@/components/Button';

interface NotificationModalProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ notification, onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (notification.duration && !notification.persistent) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration, notification.persistent]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
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
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: getBackgroundColor(), opacity: fadeAnim },
          ]}
          accessible={true}
          accessibilityLabel={notification.title ? `${notification.title}: ${notification.message}` : notification.message}
        >
          <View style={styles.content}>
            {notification.title && <Text style={styles.title}>{notification.title}</Text>}
            <Text style={styles.message}>{notification.message}</Text>
          </View>
          <Button
            title="Dismiss"
            onPress={handleDismiss}
            variant="secondary"
            size="medium"
            style={styles.dismissButton}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.overlay,
  },
  container: {
    padding: 20,
    borderRadius: 12,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: Colors.dark.text,
    fontSize: 16,
    textAlign: 'center',
  },
  dismissButton: {
    width: '100%',
    maxWidth: 200,
  },
});
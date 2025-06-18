import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Notification } from '@/types/notifications';
import { Button } from '@/components/Button';

interface NotificationModalProps {
  notification: Notification;
  onClose: () => void;
}

export default function NotificationModal({ notification, onClose }: NotificationModalProps) {
  const getIconColor = () => {
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
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container} accessibilityRole="alert">
          <View style={styles.header}>
            <Text style={[styles.title, { color: getIconColor() }]}>
              {notification.title || getDefaultTitle(notification.type)}
            </Text>
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.message}>{notification.message}</Text>
          
          <View style={styles.buttonContainer}>
            <Button
              title="OK"
              onPress={onClose}
              variant="primary"
              size="medium"
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getDefaultTitle(type: Notification['type']): string {
  switch (type) {
    case 'success':
      return 'Success';
    case 'info':
      return 'Information';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
    default:
      return 'Notification';
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        maxWidth: '90vw',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  message: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    minWidth: 100,
  },
});
import { create } from 'zustand';
import { NotificationState, Notification } from '@/types/notifications';

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now();
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id, timestamp }],
    }));
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAllNotifications: () => {
    set({ notifications: [] });
  },
}));
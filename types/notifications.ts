export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export type NotificationDisplayStyle = 'toast' | 'modal' | 'banner';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  displayStyle: NotificationDisplayStyle;
  duration?: number; // in milliseconds, for auto-dismiss
  persistent?: boolean; // for banners or critical alerts
  timestamp: number;
  onClose?: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'; // for toasts
}

export interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}
import { Platform } from 'react-native';
import { Edge } from 'react-native-safe-area-context';

// Universal safe area configuration
export const UNIVERSAL_SAFE_AREA_EDGES: Edge[] = Platform.select({
  ios: ['top', 'bottom'],
  android: ['top'],
  default: ['top']
});

// Tab-specific safe area configuration
export const TAB_SAFE_AREA_EDGES: Edge[] = Platform.select({
  ios: ['bottom'],
  android: [],
  default: []
});

// Modal safe area configuration
export const MODAL_SAFE_AREA_EDGES: Edge[] = Platform.select({
  ios: ['top', 'bottom'],
  android: ['top'],
  default: ['top']
});

// Auth screen safe area configuration
export const AUTH_SAFE_AREA_EDGES: Edge[] = Platform.select({
  ios: ['top', 'bottom'],
  android: ['top'],
  default: ['top']
}); 
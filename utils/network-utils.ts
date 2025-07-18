import { Platform } from 'react-native';

/**
 * Checks the current network status.
 * @returns Promise with network status information.
 */
export async function checkNetworkStatus(): Promise<{
  isConnected: boolean | null;
  type?: string | null;
  isInternetReachable?: boolean | null;
}> {
  try {
    // Platform-specific network checking
    if (Platform.OS === 'web') {
      // Web environment - use browser API
      const isConnected = typeof navigator !== 'undefined' ? navigator.onLine : true;
      return {
        isConnected,
        type: 'wifi', // Assume wifi for web
        isInternetReachable: isConnected,
      };
    } else {
      // Native environment - try to use NetInfo
      try {
        const NetInfo = await import('@react-native-community/netinfo');
        const netInfo = await NetInfo.default.fetch();
    return {
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      isInternetReachable: netInfo.isInternetReachable,
    };
      } catch (netInfoError) {
        console.warn('NetInfo not available, assuming connected:', netInfoError);
        return {
          isConnected: true,
          type: 'wifi',
          isInternetReachable: true,
        };
      }
    }
  } catch (error) {
    console.error('Error checking network status:', error);
    return { isConnected: null };
  }
}

/**
 * Determines if an error is related to network issues.
 * @param error - The error to check.
 * @returns True if the error is network-related.
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("failed to fetch") ||
    message.includes("connection") ||
    message.includes("timeout")
  );
}

/**
 * Wrapper function to handle operations that require network connectivity.
 * Checks network status before operation and handles network-related errors.
 * @param operation - The async operation to execute.
 * @returns Promise with the operation result.
 */
export async function withNetworkCheck<T>(operation: () => Promise<T>): Promise<T> {
  const status = await checkNetworkStatus();
  if (!status.isConnected) {
    throw new Error('No network connection available');
  }
  try {
    return await operation();
  } catch (error) {
    if (isNetworkError(error)) {
      // Re-check network status on network errors
      await checkNetworkStatus();
    }
    throw error;
  }
}
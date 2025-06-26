import NetInfo from '@react-native-community/netinfo';

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
    const netInfo = await NetInfo.fetch();
    return {
      isConnected: netInfo.isConnected,
      type: netInfo.type,
      isInternetReachable: netInfo.isInternetReachable,
    };
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
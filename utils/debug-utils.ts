/**
 * Centralized Debug Logging Utility
 * Used across all stores to eliminate duplicate debug logging systems
 */

interface DebugLogData {
  [key: string]: any;
}

export const createStoreLogger = (storeName: string) => {
  const DEBUG_PREFIX = `[${storeName}]`;
  
  const logDebug = (message: string, data?: DebugLogData) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} ${DEBUG_PREFIX} ${message}`;
    if (data) {
      console.log(logMessage, JSON.stringify(data, null, 2));
    } else {
      console.log(logMessage);
    }
  };

  const logStateChange = (action: string, prevState: any, nextState: any) => {
    logDebug(`State Change - ${action}`, {
      prev: prevState,
      next: nextState,
      changes: Object.keys(nextState).filter(key => prevState[key] !== nextState[key])
    });
  };

  const logFunctionCall = (name: string, args?: DebugLogData) => {
    logDebug(`Function Call - ${name}`, args);
  };

  const logDataFlow = (operation: string, data: any) => {
    logDebug(`Data Flow - ${operation}`, data);
  };

  const logCacheOperation = (operation: string, data: any) => {
    logDebug(`Cache Operation - ${operation}`, data);
  };

  return {
    logDebug,
    logStateChange,
    logFunctionCall,
    logDataFlow,
    logCacheOperation
  };
};

export type StoreLogger = ReturnType<typeof createStoreLogger>; 
/**
 * FILE: store/debug-store.ts
 * LAST UPDATED: 2025-07-08 15:30
 * 
 * CURRENT STATE:
 * Debug state management store using Zustand. Debug mode is always ON for monitoring.
 * Debug screen is accessible via admin section in profile (hidden for non-admins).
 * 
 * RELEASE STRATEGY:
 * - Debug mode ALWAYS ON for comprehensive monitoring
 * - Debug screen accessible only to admin users via profile
 * - No debug tab in bottom navigation (cleaner UI)
 * - Debug logging always active for troubleshooting
 * 
 * RECENT CHANGES:
 * - Removed debug tab from bottom navigation
 * - Added debug link to admin section in profile
 * - Simplified debug store - removed isDebugEnabled switch
 * - Debug mode always ON for monitoring
 * - Debug screen accessible via /debug route for admins
 * 
 * FILE INTERACTIONS:
 * - Imports from: AsyncStorage (persistence), Zustand (state management)
 * - Exports to: All stores and screens that need debug functionality
 * - Dependencies: AsyncStorage (persistence), Zustand (state management)
 * - Data flow: Provides debug state to components, debug screen accessible via profile
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - isDebugMode: Boolean state indicating if debug mode is enabled (always true)
 * - toggleDebugMode: Function to toggle debug mode on/off (for testing)
 * - toggleSimpleProfileView: Function to toggle simple profile view for testing
 * - addDebugLog: Function to add debug events to the log
 * - clearDebugLog: Function to clear the debug log
 * - debugLog: Array of debug events with timestamps
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  event: string;
  status: 'success' | 'error' | 'info' | 'warning';
  details: string;
  data?: any;
  source: string;
}

interface DebugStore {
  isDebugMode: boolean;
  debugLog: DebugLogEntry[];
  useSimpleProfileView: boolean;
  toggleDebugMode: () => void;
  toggleSimpleProfileView: () => void;
  addDebugLog: (entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) => void;
  clearDebugLog: () => void;
  getRecentLogs: (count?: number) => DebugLogEntry[];
  getLogsBySource: (source: string) => DebugLogEntry[];
}

export const useDebugStore = create<DebugStore>()(
  persist(
    (set, get) => ({
      isDebugMode: true, // ALWAYS ON for monitoring
      debugLog: [],
      useSimpleProfileView: false,
      
      toggleDebugMode: () => {
        set((state) => ({ isDebugMode: !state.isDebugMode }));
      },
      
      toggleSimpleProfileView: () => {
        set((state) => ({ useSimpleProfileView: !state.useSimpleProfileView }));
      },
      
      addDebugLog: (entry) => {
        const newEntry: DebugLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          ...entry
        };
        
        set((state) => ({
          debugLog: [...state.debugLog, newEntry].slice(-100) // Keep last 100 entries
        }));
      },

      clearDebugLog: () => {
        set({ debugLog: [] });
      },

      getRecentLogs: (count = 10) => {
        return get().debugLog.slice(-count);
      },

      getLogsBySource: (source: string) => {
        return get().debugLog.filter(log => log.source === source);
      },
    }),
    {
      name: 'debug-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

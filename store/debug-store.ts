/**
 * FILE: store/debug-store.ts
 * LAST UPDATED: 2024-12-19 16:25
 * 
 * CURRENT STATE:
 * Debug state management store using Zustand. Controls debug mode across the app
 * to enable/disable debug logging and UI elements. Can be toggled from admin settings.
 * 
 * RECENT CHANGES:
 * - Created new debug store for centralized debug state management
 * - Provides isDebugMode state and toggleDebugMode function
 * - Persists debug state across app sessions
 * - Used by matches-store and discover screen for conditional debug output
 * - Added debug log functionality for tier settings tracking
 * 
 * FILE INTERACTIONS:
 * - Imports from: AsyncStorage (persistence), Zustand (state management)
 * - Exports to: All stores and screens that need debug functionality
 * - Dependencies: AsyncStorage (persistence), Zustand (state management)
 * - Data flow: Provides debug state to components, can be toggled from admin settings
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - isDebugMode: Boolean state indicating if debug mode is enabled
 * - toggleDebugMode: Function to toggle debug mode on/off
 * - resetDebugMode: Function to reset debug mode to false
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
      isDebugMode: false,
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

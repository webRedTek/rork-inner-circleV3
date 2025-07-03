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

interface DebugState {
  isDebugMode: boolean;
  debugLog: DebugLogEntry[];
  toggleDebugMode: () => void;
  setDebugMode: (enabled: boolean) => void;
  resetDebugMode: () => void;
  addDebugLog: (entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) => void;
  clearDebugLog: () => void;
  getDebugLog: () => DebugLogEntry[];
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      isDebugMode: false,
      debugLog: [],
      
      toggleDebugMode: () => {
        set((state) => ({ isDebugMode: !state.isDebugMode }));
      },
      
      setDebugMode: (enabled: boolean) => {
        set({ isDebugMode: enabled });
      },
      
      resetDebugMode: () => {
        set({ isDebugMode: false });
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

      getDebugLog: () => {
        return get().debugLog;
      },
    }),
    {
      name: 'debug-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

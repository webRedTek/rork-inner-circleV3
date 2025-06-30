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
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface DebugState {
  isDebugMode: boolean;
  toggleDebugMode: () => void;
  setDebugMode: (enabled: boolean) => void;
  resetDebugMode: () => void;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      isDebugMode: false,
      
      toggleDebugMode: () => {
        set((state) => ({ isDebugMode: !state.isDebugMode }));
      },
      
      setDebugMode: (enabled: boolean) => {
        set({ isDebugMode: enabled });
      },
      
      resetDebugMode: () => {
        set({ isDebugMode: false });
      },
    }),
    {
      name: 'debug-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);

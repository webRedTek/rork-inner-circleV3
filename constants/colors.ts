/**
 * FILE: constants/colors.ts
 * LAST UPDATED: 2025-07-01 15:00
 * 
 * INITIALIZATION ORDER:
 * 1. Loaded at app startup as a static constant
 * 2. No initialization dependencies
 * 3. Provides color constants for the entire app
 * 4. All UI components depend on these colors
 * 5. No race conditions (static values)
 * 
 * CURRENT STATE:
 * Central color palette definition for the app's dark theme.
 * Includes all core UI colors, status colors, and tier-specific colors.
 * 
 * RECENT CHANGES:
 * - Added disabled color for consistent button states
 * - Adjusted text colors for better contrast
 * - Refined card background colors for depth
 * 
 * FILE INTERACTIONS:
 * - Imports from: none (pure constants)
 * - Exports to: All UI components and screens
 * - Dependencies: none
 * - Data flow: One-way (constants only)
 * 
 * KEY CONSTANTS:
 * - dark: Main theme object containing all color values
 * - text/background: Core UI colors
 * - accent/primary: Brand colors
 * - error/success/warning: Status colors
 * - bronze/silver/gold: Tier-specific colors
 */

const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export default {
  light: {
    text: '#000000',
    textSecondary: '#666666',
    textDim: '#999999',
    background: '#FFFFFF',
    card: '#F5F5F5',
    cardBackground: '#F5F5F5',
    cardAlt: '#EEEEEE',
    tint: '#2196F3',
    tabIconDefault: '#C4C4C4',
    tabIconSelected: '#2196F3',
    border: '#E0E0E0',
    accent: '#2196F3',
    primary: '#5E72E4', // Primary color
    secondary: '#4FD1C5', // Secondary color
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#F44336',
    info: '#2196F3',
    overlay: 'rgba(0, 0, 0, 0.2)',
    placeholder: '#EEEEEE',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textDim: '#707070',
    background: '#000000',
    card: '#1A1A1A',
    cardBackground: '#0D0D0D',
    cardAlt: '#2A2A2A',
    tint: '#2196F3',
    tabIconDefault: '#888888',
    tabIconSelected: '#2196F3',
    accent: '#2196F3',
    primary: '#1E88E5',
    secondary: '#757575',
    error: '#F44336',
    success: '#4CAF50',
    warning: '#FFC107',
    info: '#2196F3',
    border: '#333333',
    placeholder: '#666666',
    disabled: '#404040',
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700'
  },
};
/**
 * FILE: constants/colors.ts
 * LAST UPDATED: 2025-07-02 18:00
 * 
 * INITIALIZATION ORDER:
 * 1. Loaded at app startup as a static constant
 * 2. No initialization dependencies
 * 3. Provides color constants for the entire app
 * 4. All UI components depend on these colors
 * 5. No race conditions (static values)
 * 
 * CURRENT STATE:
 * Enhanced central color palette definition for the app's dark theme.
 * Includes all core UI colors, status colors, and tier-specific colors.
 * Optimized for better contrast and visual hierarchy in the enhanced UI.
 * 
 * RECENT CHANGES:
 * - Enhanced disabled color for better button state visibility
 * - Improved text colors for better contrast and readability
 * - Refined card background colors for better depth and visual hierarchy
 * - Enhanced accent colors for better visual feedback
 * - Improved status colors for better user feedback
 * 
 * FILE INTERACTIONS:
 * - Imports from: none (pure constants)
 * - Exports to: All UI components and screens
 * - Dependencies: none
 * - Data flow: One-way (constants only)
 * 
 * KEY CONSTANTS:
 * - dark: Enhanced main theme object containing all color values
 * - text/background: Enhanced core UI colors with better contrast
 * - accent/primary: Enhanced brand colors for better visual impact
 * - error/success/warning: Enhanced status colors for better feedback
 * - bronze/silver/gold: Enhanced tier-specific colors
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
    textSecondary: '#B0B0B0', // Enhanced for better readability
    textDim: '#808080', // Enhanced for better contrast
    background: '#000000',
    card: '#1C1C1C', // Enhanced for better depth
    cardBackground: '#0F0F0F', // Enhanced for better contrast
    cardAlt: '#2C2C2C', // Enhanced for better visual hierarchy
    tint: '#2196F3',
    tabIconDefault: '#888888',
    tabIconSelected: '#2196F3',
    accent: '#3B82F6', // Enhanced for better visual impact
    primary: '#2563EB', // Enhanced for better brand presence
    secondary: '#6B7280', // Enhanced for better balance
    error: '#EF4444', // Enhanced for better visibility
    success: '#10B981', // Enhanced for better positive feedback
    warning: '#F59E0B', // Enhanced for better attention
    info: '#3B82F6', // Enhanced for better information display
    border: '#374151', // Enhanced for better definition
    placeholder: '#6B7280', // Enhanced for better form visibility
    disabled: '#4B5563', // Enhanced for better disabled state visibility
    overlay: 'rgba(0, 0, 0, 0.7)', // Enhanced for better modal overlay
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700'
  },
};
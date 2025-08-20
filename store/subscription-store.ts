/**
 * FILE: store/subscription-store.ts
 * CREATED: 2025-07-10
 * 
 * RevenueCat subscription management store for Inner Circle Connect.
 * Handles subscription purchases, restoration, and status management.
 * 
 * FEATURES:
 * - RevenueCat SDK integration
 * - Subscription purchase flow
 * - Purchase restoration
 * - Subscription status tracking
 * - Cross-platform support (iOS/Android/Web)
 * - Error handling and retry logic
 * 
 * DEPENDENCIES:
 * - react-native-purchases (RevenueCat SDK)
 * - auth-store (user authentication)
 * - notification-store (user feedback)
 * - error-utils (error handling)
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import Purchases, { 
  PurchasesOffering, 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesError,
  PURCHASES_ERROR_CODE
} from 'react-native-purchases';
import { useAuthStore } from './auth-store';
import { useNotificationStore } from './notification-store';
import { handleError, withErrorHandling, ErrorCategory, ErrorCodes } from '@/utils/error-utils';
import { MembershipTier } from '@/types/user';

interface SubscriptionState {
  // RevenueCat state
  isConfigured: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  
  // UI state
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  error: string | null;
  
  // Actions
  initialize: (userId: string) => Promise<void>;
  loadOfferings: () => Promise<void>;
  purchasePackage: (packageToPurchase: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  getActiveSubscriptions: () => string[];
  hasActiveSubscription: (tier: MembershipTier) => boolean;
  syncSubscriptionStatus: () => Promise<void>;
  clearError: () => void;
}

// RevenueCat configuration
const REVENUECAT_CONFIG = {
  // RevenueCat API keys
  ios: 'appl_KnjmhQaRSNxvFNVzzVkIxqlRAXU',
  android: 'goog_YOUR_ANDROID_API_KEY_HERE', // Replace with actual Android API key from RevenueCat dashboard
  // Web doesn't support RevenueCat, so we'll handle it differently
};

// Mapping between RevenueCat product IDs and membership tiers
const PRODUCT_TIER_MAPPING: Record<string, MembershipTier> = {
  'silver_monthly': 'silver',
  'gold_monthly': 'gold',
  'silver_annual': 'silver',
  'gold_annual': 'gold',
};

export const useSubscriptionStore = create<SubscriptionState>()((set, get) => ({
  isConfigured: false,
  customerInfo: null,
  offerings: null,
  isLoading: false,
  isPurchasing: false,
  isRestoring: false,
  error: null,

  initialize: async (userId: string) => {
    if (Platform.OS === 'web') {
      // Web doesn't support RevenueCat, mark as configured but don't initialize
      set({ isConfigured: true });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await withErrorHandling(
        async () => {
          // Configure RevenueCat
          const apiKey = Platform.OS === 'ios' ? REVENUECAT_CONFIG.ios : REVENUECAT_CONFIG.android;
          
          if (!apiKey || apiKey.includes('YOUR_')) {
            throw new Error('RevenueCat API key not configured. Please add your API keys to the subscription store.');
          }

          await Purchases.configure({ apiKey });
          
          // Set user ID
          await Purchases.logIn(userId);
          
          // Get initial customer info
          const customerInfo = await Purchases.getCustomerInfo();
          
          set({ 
            isConfigured: true, 
            customerInfo,
            isLoading: false 
          });

          // Load offerings
          await get().loadOfferings();

          // Sync subscription status with auth store
          await get().syncSubscriptionStatus();
        },
        {
          customErrorMessage: 'Failed to initialize subscription service'
        }
      );
    } catch (error) {
      const appError = handleError(error);
      set({ 
        error: appError.userMessage,
        isLoading: false 
      });
      
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: appError.userMessage,
        displayStyle: 'toast',
        duration: 5000
      });
    }
  },

  loadOfferings: async () => {
    if (Platform.OS === 'web') {
      return; // Web doesn't support RevenueCat
    }

    try {
      await withErrorHandling(
        async () => {
          const offerings = await Purchases.getOfferings();
          
          if (offerings.current) {
            set({ offerings: offerings.current });
          } else {
            throw new Error('No subscription offerings available');
          }
        },
        {
          customErrorMessage: 'Failed to load subscription plans'
        }
      );
    } catch (error) {
      const appError = handleError(error);
      set({ error: appError.userMessage });
    }
  },

  purchasePackage: async (packageToPurchase: PurchasesPackage) => {
    if (Platform.OS === 'web') {
      useNotificationStore.getState().addNotification({
        type: 'info',
        message: 'Subscriptions are not available on web. Please use the mobile app.',
        displayStyle: 'toast',
        duration: 5000
      });
      return false;
    }

    set({ isPurchasing: true, error: null });

    try {
      const result = await withErrorHandling(
        async () => {
          const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
          
          set({ 
            customerInfo,
            isPurchasing: false 
          });

          // Sync subscription status with auth store
          await get().syncSubscriptionStatus();

          useNotificationStore.getState().addNotification({
            type: 'success',
            message: 'Subscription activated successfully!',
            displayStyle: 'toast',
            duration: 5000
          });

          return true;
        },
        {
          customErrorMessage: 'Failed to complete purchase'
        }
      );

      return result;
    } catch (error) {
      set({ isPurchasing: false });
      
      // Handle specific RevenueCat errors
      if (error && typeof error === 'object' && 'code' in error) {
        const purchasesError = error as PurchasesError;
        
        switch (purchasesError.code) {
          case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED:
            // User cancelled, don't show error
            return false;
          case PURCHASES_ERROR_CODE.PAYMENT_PENDING:
            useNotificationStore.getState().addNotification({
              type: 'info',
              message: 'Payment is pending. You will be notified when it completes.',
              displayStyle: 'toast',
              duration: 5000
            });
            return false;
          case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE:
            useNotificationStore.getState().addNotification({
              type: 'error',
              message: 'This subscription is not available for purchase.',
              displayStyle: 'toast',
              duration: 5000
            });
            return false;
          default:
            break;
        }
      }

      const appError = handleError(error);
      set({ error: appError.userMessage });
      
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: appError.userMessage,
        displayStyle: 'toast',
        duration: 5000
      });

      return false;
    }
  },

  restorePurchases: async () => {
    if (Platform.OS === 'web') {
      useNotificationStore.getState().addNotification({
        type: 'info',
        message: 'Purchase restoration is not available on web.',
        displayStyle: 'toast',
        duration: 5000
      });
      return false;
    }

    set({ isRestoring: true, error: null });

    try {
      const result = await withErrorHandling(
        async () => {
          const customerInfo = await Purchases.restorePurchases();
          
          set({ 
            customerInfo,
            isRestoring: false 
          });

          // Sync subscription status with auth store
          await get().syncSubscriptionStatus();

          const hasActiveSubscriptions = Object.keys(customerInfo.entitlements.active).length > 0;
          
          useNotificationStore.getState().addNotification({
            type: hasActiveSubscriptions ? 'success' : 'info',
            message: hasActiveSubscriptions 
              ? 'Purchases restored successfully!' 
              : 'No previous purchases found.',
            displayStyle: 'toast',
            duration: 5000
          });

          return hasActiveSubscriptions;
        },
        {
          customErrorMessage: 'Failed to restore purchases'
        }
      );

      return result;
    } catch (error) {
      set({ isRestoring: false });
      
      const appError = handleError(error);
      set({ error: appError.userMessage });
      
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: appError.userMessage,
        displayStyle: 'toast',
        duration: 5000
      });

      return false;
    }
  },

  getActiveSubscriptions: () => {
    const { customerInfo } = get();
    if (!customerInfo) return [];
    
    return Object.keys(customerInfo.entitlements.active);
  },

  hasActiveSubscription: (tier: MembershipTier) => {
    const { customerInfo } = get();
    if (!customerInfo) return false;
    
    // Check if user has any active entitlement that corresponds to the tier
    const activeEntitlements = Object.keys(customerInfo.entitlements.active);
    
    return activeEntitlements.some(entitlement => {
      // Map entitlement to tier (you may need to adjust this based on your RevenueCat setup)
      return entitlement.toLowerCase().includes(tier.toLowerCase());
    });
  },

  syncSubscriptionStatus: async () => {
    const { customerInfo } = get();
    if (!customerInfo) return;

    try {
      // Determine the highest tier the user has access to
      let highestTier: MembershipTier = 'bronze';
      
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      
      if (activeEntitlements.some(e => e.toLowerCase().includes('gold'))) {
        highestTier = 'gold';
      } else if (activeEntitlements.some(e => e.toLowerCase().includes('silver'))) {
        highestTier = 'silver';
      }

      // Update user's membership tier in auth store if it's different
      const { user, updateMembership } = useAuthStore.getState();
      if (user && user.membershipTier !== highestTier) {
        await updateMembership(highestTier);
      }
    } catch (error) {
      console.warn('Failed to sync subscription status:', error);
    }
  },

  clearError: () => set({ error: null }),
}));

// Helper function to get package by tier
export const getPackageByTier = (offerings: PurchasesOffering | null, tier: MembershipTier, isAnnual: boolean = false): PurchasesPackage | null => {
  if (!offerings) return null;
  
  const suffix = isAnnual ? '_annual' : '_monthly';
  const productId = `${tier}${suffix}`;
  
  return offerings.availablePackages.find((pkg: PurchasesPackage) => 
    pkg.product.identifier === productId
  ) || null;
};

// Helper function to format price
export const formatPrice = (packageItem: PurchasesPackage): string => {
  return packageItem.product.priceString;
};

// Helper function to get subscription period
export const getSubscriptionPeriod = (packageItem: PurchasesPackage): string => {
  const identifier = packageItem.product.identifier;
  if (identifier.includes('annual')) {
    return 'year';
  } else if (identifier.includes('monthly')) {
    return 'month';
  }
  return 'month'; // default
};
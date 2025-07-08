import { create } from 'zustand';
import { AffiliateStats, ReferralHistory } from '@/types/user';
import { isSupabaseConfigured, supabase, getReadableError } from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useNotificationStore } from './notification-store';

interface AffiliateState {
  stats: AffiliateStats | null;
  referralHistory: ReferralHistory[];
  isLoading: boolean;
  error: string | null;
  fetchAffiliateData: () => Promise<void>;
  generateReferralLink: () => Promise<string>;
  checkReferralCode: (code: string) => Promise<boolean>;
  clearError: () => void;
  resetAffiliateCache: () => Promise<void>;
}

// Helper function to generate a simple referral code (max 7 characters)
const generateSimpleReferralCode = (username: string): string => {
  // Clean username: remove spaces, special chars, convert to lowercase
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Take first 3-4 characters of username
  const userPart = cleanUsername.substring(0, Math.min(4, cleanUsername.length));
  
  // Generate random alphanumeric characters for the rest
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const remainingLength = 7 - userPart.length;
  let randomPart = '';
  
  for (let i = 0; i < remainingLength; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const code = userPart + randomPart;
  
  // Ensure the code is exactly 7 characters
  return code.substring(0, 7);
};

export const useAffiliateStore = create<AffiliateState>((set, get) => ({
  stats: null,
  referralHistory: [],
  isLoading: false,
  error: null,

  fetchAffiliateData: async () => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) return;
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        // Check if affiliate_stats table exists
        const { error: tableCheckError } = await supabase
          .from('affiliate_stats')
          .select('id')
          .limit(1);
          
        if (tableCheckError?.message?.includes('does not exist')) {
          set({
            stats: {
              totalReferrals: 0,
              activeReferrals: 0,
              totalEarnings: 0,
              pendingPayouts: 0,
              lastPayout: { amount: 0, date: "N/A" },
            },
            referralHistory: [],
            isLoading: false
          });
          return;
        }
        
        // Fetch stats
        const { data: statsData, error: statsError } = await supabase
          .from('affiliate_stats')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (statsError) throw statsError;
        
        const stats: AffiliateStats = {
          totalReferrals: statsData?.total_referrals || 0,
          activeReferrals: statsData?.active_referrals || 0,
          totalEarnings: statsData?.total_earnings || 0,
          pendingPayouts: statsData?.pending_payouts || 0,
          lastPayout: statsData?.last_payout || { amount: 0, date: "N/A" },
        };
        
        // Fetch referral history
        const { data: historyData, error: historyError } = await supabase
          .from('affiliate_referrals')
          .select('*')
          .eq('referrer_id', user.id);
          
        if (historyError) throw historyError;
        
        const referralHistory: ReferralHistory[] = (historyData || []).map(item => ({
          id: item.id,
          referredUser: {
            name: item.referred_user_name || 'Anonymous',
            signupDate: item.initial_subscription_date || 'Unknown',
          },
          status: item.status || 'inactive',
          subscriptionType: item.subscription_status || 'N/A',
          earnings: item.lifetime_value || 0,
        }));
        
        set({ stats, referralHistory, isLoading: false });
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error fetching affiliate data:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
      });
    }
  },

  generateReferralLink: async () => {
    const { user, isReady } = useAuthStore.getState();
    if (!isReady || !user) {
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: 'User not authenticated',
        displayStyle: 'toast',
        duration: 5000
      });
      return '';
    }
    
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: linkData, error: linkError } = await supabase
          .from('affiliate_links')
          .select('referral_code')
          .eq('user_id', user.id)
          .single();
          
        if (linkError) {
          // If no link exists, create one
          if (linkError.code === 'PGRST116') {
            // Generate simple referral code using username
            const newCode = generateSimpleReferralCode(user.name || user.email || 'user');
            
            // Check if code already exists and generate a new one if needed
            let finalCode = newCode;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
              const { data: existingCode } = await supabase
                .from('affiliate_links')
                .select('id')
                .eq('referral_code', finalCode)
                .single();
                
              if (!existingCode) {
                // Code is unique, we can use it
                break;
              }
              
              // Code exists, generate a new one
              attempts++;
              finalCode = generateSimpleReferralCode(user.name || user.email || 'user');
            }
            
            if (attempts >= maxAttempts) {
              // Fallback to timestamp-based code if we can't find a unique one
              const baseCode = generateSimpleReferralCode(user.name || user.email || 'user').substring(0, 4);
              const timestamp = Date.now().toString().slice(-3);
              finalCode = (baseCode + timestamp).substring(0, 7);
            }
            
            const { error: insertError } = await supabase
              .from('affiliate_links')
              .insert({ 
                user_id: user.id, 
                referral_code: finalCode,
                tier_id: '00000000-0000-0000-0000-000000000000' // Placeholder UUID, should be updated based on actual tier
              });
              
            if (insertError) {
              console.error('Error creating referral link:', getReadableError(insertError));
              useNotificationStore.getState().addNotification({
                type: 'error',
                message: `Failed to create referral link: ${getReadableError(insertError)}`,
                displayStyle: 'toast',
                duration: 5000
              });
              throw insertError;
            }
            
            set({ isLoading: false });
            useNotificationStore.getState().addNotification({
              type: 'success',
              message: `Referral code created: ${finalCode}`,
              displayStyle: 'toast',
              duration: 5000
            });
            return `https://app.example.com/referral/${finalCode}`;
          }
          console.error('Error fetching referral link:', getReadableError(linkError));
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: `Failed to fetch referral link: ${getReadableError(linkError)}`,
            displayStyle: 'toast',
            duration: 5000
          });
          throw linkError;
        }
        
        // Check if existing code is longer than 7 characters and regenerate if needed
        const existingCode = linkData?.referral_code || '';
        if (existingCode.length > 7) {
          console.log('Existing referral code is too long, regenerating...');
          
          // Generate new 7-character code
          const newCode = generateSimpleReferralCode(user.name || user.email || 'user');
          
          // Check if new code already exists
          let finalCode = newCode;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            const { data: existingCodeCheck } = await supabase
              .from('affiliate_links')
              .select('id')
              .eq('referral_code', finalCode)
              .single();
              
            if (!existingCodeCheck) {
              // Code is unique, we can use it
              break;
            }
            
            // Code exists, generate a new one
            attempts++;
            finalCode = generateSimpleReferralCode(user.name || user.email || 'user');
          }
          
          if (attempts >= maxAttempts) {
            // Fallback to timestamp-based code
            const baseCode = generateSimpleReferralCode(user.name || user.email || 'user').substring(0, 4);
            const timestamp = Date.now().toString().slice(-3);
            finalCode = (baseCode + timestamp).substring(0, 7);
          }
          
          // Update the existing record with the new 7-character code
          const { error: updateError } = await supabase
            .from('affiliate_links')
            .update({ referral_code: finalCode })
            .eq('user_id', user.id);
            
          if (updateError) {
            console.error('Error updating referral code:', getReadableError(updateError));
            useNotificationStore.getState().addNotification({
              type: 'error',
              message: `Failed to update referral code: ${getReadableError(updateError)}`,
              displayStyle: 'toast',
              duration: 5000
            });
            throw updateError;
          }
          
          set({ isLoading: false });
          useNotificationStore.getState().addNotification({
            type: 'success',
            message: `Referral code updated: ${finalCode}`,
            displayStyle: 'toast',
            duration: 5000
          });
          return `https://app.example.com/referral/${finalCode}`;
        }
        
        set({ isLoading: false });
        useNotificationStore.getState().addNotification({
          type: 'success',
          message: `Your referral code: ${existingCode}`,
          displayStyle: 'toast',
          duration: 5000
        });
        return `https://app.example.com/referral/${existingCode}`;
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error generating referral link:', getReadableError(error));
      const errorMessage = getReadableError(error);
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: `Referral link generation failed: ${errorMessage}`,
        displayStyle: 'toast',
        duration: 5000
      });
      return '';
    }
  },

  checkReferralCode: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data: codeData, error: codeError } = await supabase
          .from('affiliate_links')
          .select('id')
          .eq('referral_code', code)
          .single();
          
        if (codeError) {
          console.error('Error checking referral code:', getReadableError(codeError));
          useNotificationStore.getState().addNotification({
            type: 'error',
            message: `Failed to check referral code: ${getReadableError(codeError)}`,
            displayStyle: 'toast',
            duration: 5000
          });
          throw codeError;
        }
        
        set({ isLoading: false });
        const isValid = !!codeData;
        
        if (isValid) {
          useNotificationStore.getState().addNotification({
            type: 'success',
            message: 'Referral code is valid',
            displayStyle: 'toast',
            duration: 3000
          });
        } else {
          useNotificationStore.getState().addNotification({
            type: 'warning',
            message: 'Referral code not found',
            displayStyle: 'toast',
            duration: 3000
          });
        }
        
        return isValid;
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error checking referral code:', getReadableError(error));
      const errorMessage = getReadableError(error);
      set({ 
        error: errorMessage, 
        isLoading: false 
      });
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: `Referral code check failed: ${errorMessage}`,
        displayStyle: 'toast',
        duration: 5000
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  resetAffiliateCache: async () => {
    try {
      console.log('[AffiliateStore] Resetting affiliate cache');
      set({
        stats: null,
        referralHistory: [],
        error: null,
        isLoading: false
      });
      console.log('[AffiliateStore] Affiliate cache reset successfully');
      useNotificationStore.getState().addNotification({
        type: 'success',
        message: 'Affiliate data cleared',
        displayStyle: 'toast',
        duration: 3000
      });
    } catch (error) {
      console.error('[AffiliateStore] Error resetting affiliate cache:', getReadableError(error));
      useNotificationStore.getState().addNotification({
        type: 'error',
        message: 'Failed to reset affiliate data',
        displayStyle: 'toast',
        duration: 5000
      });
      set({ error: getReadableError(error) });
    }
  }
}));
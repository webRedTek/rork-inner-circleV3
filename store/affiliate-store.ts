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
    if (!isReady || !user) return '';
    
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
            const newCode = `ref-${user.id.substring(0, 8)}-${Date.now()}`;
            const { error: insertError } = await supabase
              .from('affiliate_links')
              .insert({ 
                user_id: user.id, 
                referral_code: newCode,
                tier_id: '00000000-0000-0000-0000-000000000000' // Placeholder UUID, should be updated based on actual tier
              });
              
            if (insertError) throw insertError;
            set({ isLoading: false });
            return `https://app.example.com/referral/${newCode}`;
          }
          throw linkError;
        }
        
        set({ isLoading: false });
        return `https://app.example.com/referral/${linkData?.referral_code || ''}`;
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error generating referral link:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
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
          
        if (codeError) throw codeError;
        
        set({ isLoading: false });
        return !!codeData;
      } else {
        throw new Error('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error checking referral code:', getReadableError(error));
      set({ 
        error: getReadableError(error), 
        isLoading: false 
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
        id: `affiliate-reset-${Date.now()}`,
        type: 'success',
        message: 'Affiliate data cleared',
        displayStyle: 'toast',
        duration: 3000,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[AffiliateStore] Error resetting affiliate cache:', getReadableError(error));
      useNotificationStore.getState().addNotification({
        id: `affiliate-reset-error-${Date.now()}`,
        type: 'error',
        message: 'Failed to reset affiliate data',
        displayStyle: 'toast',
        duration: 5000,
        timestamp: Date.now()
      });
      set({ error: getReadableError(error) });
    }
  }
}));
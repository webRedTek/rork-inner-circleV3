import { create } from 'zustand';
import { AffiliateStats, ReferralHistory } from '@/types/user';
import { isSupabaseConfigured, supabase, getReadableError } from '@/lib/supabase';
import { useAuthStore } from './auth-store';

interface AffiliateState {
  stats: AffiliateStats | null;
  referralHistory: ReferralHistory[];
  isLoading: boolean;
  error: string | null;
  fetchAffiliateData: () => Promise<void>;
  generateReferralLink: () => Promise<string>;
  checkReferralCode: (code: string) => Promise<boolean>;
  clearError: () => void;
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
          lastPayout: statsData?.last_payout || { amount: 0, date: 'N/A' },
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
            signupDate: item.signup_date || 'Unknown',
          },
          status: item.status || 'inactive',
          subscriptionType: item.subscription_type || 'N/A',
          earnings: item.earnings || 0,
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
          .select('link')
          .eq('user_id', user.id)
          .single();
          
        if (linkError) {
          // If no link exists, create one
          if (linkError.code === 'PGRST116') {
            const newLink = `https://app.example.com/referral/${user.referralCode || 'ref-' + Date.now()}`;
            const { error: insertError } = await supabase
              .from('affiliate_links')
              .insert({ user_id: user.id, link: newLink });
              
            if (insertError) throw insertError;
            set({ isLoading: false });
            return newLink;
          }
          throw linkError;
        }
        
        set({ isLoading: false });
        return linkData?.link || '';
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
          .from('users')
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

  clearError: () => set({ error: null })
}));
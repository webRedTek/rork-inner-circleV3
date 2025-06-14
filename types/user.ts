export type EntrepreneurStatus = 'current' | 'upcoming' | 'Founder';

export type BusinessStage = 
  | 'Idea Phase'
  | 'Pre-Seed/Startup'
  | 'Growth Stage'
  | 'Established/Scaling'
  | 'Exited';

export type BusinessField = 
  | 'Technology' 
  | 'Finance' 
  | 'Marketing' 
  | 'E-commerce' 
  | 'Health' 
  | 'Education' 
  | 'Food & Beverage'
  | 'Real Estate'
  | 'Creative'
  | 'Consulting'
  | 'Manufacturing'
  | 'SaaS'
  | 'FinTech'
  | 'Other';

export type LookingFor = 
  | 'Partners'
  | 'Mentor'
  | 'Bounce Ideas'
  | 'Peers'
  | 'Mentoring others'
  | 'Meetups'
  | 'Funding';

export type Skill = 
  | 'Marketing'
  | 'Sales'
  | 'Development'
  | 'UI/UX'
  | 'Fundraising'
  | 'Product Management'
  | 'Operations'
  | 'Finance'
  | 'Legal'
  | 'HR'
  | 'Customer Service'
  | 'Content Creation'
  | 'Data Analysis'
  | 'Strategy';

export type AvailabilityLevel = 
  | 'Quick chats'
  | 'Regular virtual coffee'
  | 'Local meetups'
  | 'Long-term mentorship/partnership';

export type MembershipTier = 'basic' | 'bronze' | 'silver' | 'gold';

export type LocationPrivacy = 'public' | 'matches_only' | 'hidden';
export type UserRole = 'member' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  businessField: BusinessField;
  entrepreneurStatus: EntrepreneurStatus;
  bio: string;
  location?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  preferredDistance?: number;
  locationPrivacy?: LocationPrivacy;
  
  // Enhanced profile fields
  lookingFor?: LookingFor[];
  businessStage?: BusinessStage;
  skillsOffered?: Skill[];
  skillsSeeking?: Skill[];
  keyChallenge?: string;
  industryFocus?: string;
  availabilityLevel?: AvailabilityLevel[];
  timezone?: string;
  successHighlight?: string;
  
  goals?: string[];
  analytics?: {
    revenue?: string;
    growth?: string;
    customers?: string;
    [key: string]: string | undefined;
  };
  portfolio?: {
    items: PortfolioItem[];
  };
  membershipTier: MembershipTier;
  businessVerified: boolean;
  joinedGroups: string[];
  createdAt: number;
  referralCode?: string;
  [key: string]: any; // Add index signature to allow any string key
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  link?: string;
}

export interface Match {
  id: string;
  userId: string;
  matchedUserId: string;
  createdAt: number;
  lastMessageAt?: number;
  [key: string]: any; // Add index signature to allow any string key
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  voiceUrl?: string;
  voiceDuration?: number;
  imageUrl?: string;
  createdAt: number;
  read: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  memberIds: string[];
  createdBy: string;
  createdAt: number;
  category: string;
  industry?: string;
  [key: string]: any; // Add index signature to allow any string key
}

export interface AppSettings {
  id: string;
  tier: MembershipTier;
  dailySwipeLimit: number;
  dailyMatchLimit: number;
  messageSendingLimit: number;
  canSeeWhoLikedYou: boolean;
  canRewindLastSwipe: boolean;
  boostDuration: number;
  boostFrequency: number;
  profileVisibilityControl: boolean;
  priorityListing: boolean;
  premiumFiltersAccess: boolean;
  globalDiscovery: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TierSettings {
  daily_swipe_limit: number;
  daily_match_limit: number;
  message_sending_limit: number;
  can_see_who_liked_you: boolean;
  can_rewind_last_swipe: boolean;
  boost_duration: number;
  boost_frequency: number;
  profile_visibility_control: boolean;
  priority_listing: boolean;
  premium_filters_access: boolean;
  global_discovery: boolean;
  groups_limit: number;
  groups_creation_limit: number;
  featured_portfolio_limit: number;
  events_per_month: number;
  can_create_groups: boolean;
  has_business_verification: boolean;
  has_advanced_analytics: boolean;
  has_priority_inbox: boolean;
  can_send_direct_intro: boolean;
  has_virtual_meeting_room: boolean;
  has_custom_branding: boolean;
  has_dedicated_support: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface SwipeAction {
  swiper_id: string;
  swipee_id: string;
  direction: 'left' | 'right';
  swipe_timestamp: number;
}

export interface UsageCache {
  lastSyncTimestamp: number;
  usageData: {
    [actionType: string]: {
      currentCount: number;
      firstActionTimestamp: number;
      lastActionTimestamp: number;
      resetTimestamp: number;
    };
  };
  premiumFeatures: {
    boostMinutesRemaining: number;
    boostUsesRemaining: number;
  };
  analytics: {
    profileViews: number;
    searchAppearances: number;
  };
}

export interface BatchUpdate {
  user_id: string;
  updates: {
    action_type: string;
    count_change: number;
    timestamp: number;
  }[];
}

export interface SyncStrategy {
  critical: {
    interval: number;
    features: string[];
  };
  standard: {
    interval: number;
    features: string[];
  };
  analytics: {
    interval: number;
    features: string[];
  };
}

export interface RateLimits {
  reads: { perSecond: number; perMinute: number };
  writes: { perSecond: number; perMinute: number };
}

export interface CacheConfig {
  standardTTL: number;
  criticalTTL: number;
  maxCacheAge: number;
}

export interface RetryStrategy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  criticalActions: string[];
}

export interface ConnectionPool {
  maxConnections: number;
  minConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingPayouts: number;
  lastPayout: {
    amount: number;
    date: string;
  };
}

export interface ReferralHistory {
  id: string;
  referredUser: {
    name: string;
    signupDate: string;
  };
  status: 'active' | 'inactive';
  subscriptionType: string;
  earnings: number;
}
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

export type MembershipTier = 'bronze' | 'silver' | 'gold';

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

export interface MatchWithProfile {
  match_id: string;
  matched_user_id: string;
  matched_user_profile: UserProfile;
  created_at: number;
  last_message_at: number | null;
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

export interface MessageWithSender {
  id: string;
  sender_id: string;
  sender_profile: UserProfile;
  receiver_id: string;
  content: string;
  type: 'text' | 'voice' | 'image';
  voice_url?: string;
  voice_duration?: number;
  image_url?: string;
  created_at: number;
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

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image';
  imageUrl?: string;
  createdAt: number;
}

export interface GroupEvent {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  description: string;
  location?: string;
  imageUrl?: string;
  startTime: number;
  endTime?: number;
  reminder?: number;
  createdAt: number;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  recurrenceEnd?: number;
}

export interface GroupEventRSVP {
  id: string;
  eventId: string;
  userId: string;
  response: 'yes' | 'no' | 'maybe';
  createdAt: number;
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
  id?: string;
  tier: MembershipTier;
  daily_swipe_limit: number;
  daily_match_limit: number;
  daily_like_limit: number;
  message_sending_limit: number;
  can_see_who_liked_you: boolean;
  can_rewind_last_swipe: boolean;
  profile_visibility_control: boolean;
  priority_listing: boolean;
  premium_filters_access: boolean;
  global_discovery: boolean;
  boost_duration: number;
  boost_frequency: number;
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
  
  // Additional limit fields
  direct_intro_limit: number;
  virtual_meetings_limit: number;
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
  counts: DatabaseTotals;
  timestamp: number;
  lastSyncTimestamp: number;
}

export interface BatchUpdate {
  userId: string;
  actionType: string;
  countChange: number;
  timestamp: number;
}

/**
 * Rate limits for usage tracking
 */
export interface RateLimits {
  dailySwipeLimit: number;
  dailyMatchLimit: number;
  dailyLikeLimit: number;
  dailyMessageLimit: number;
}

/**
 * Sync strategy for usage data
 */
export type SyncStrategy = 'IMMEDIATE' | 'BATCH' | 'DELAYED';

/**
 * Cache configuration for usage data
 */
export interface CacheConfig {
  maxAge: number;
  syncInterval: number;
  batchSize: number;
}

/**
 * Retry strategy for failed operations
 */
export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
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

/**
 * Options for tracking usage actions
 */
export interface UsageTrackingOptions {
  actionType: string;
  count?: number;
  batchProcess?: boolean;
  forceSync?: boolean;
}

/**
 * Result of a usage tracking operation
 */
export interface UsageResult {
  success: boolean;
  error?: string;
}

/**
 * Comprehensive usage stats for a user
 */
export interface UsageStats {
  dailyStats: DatabaseTotals;
  limits: {
    dailySwipeLimit: number;
    dailyMatchLimit: number;
    dailyLikeLimit: number;
    dailyMessageLimit: number;
  };
}

export interface DatabaseTotals {
  swipe_count: number;
  match_count: number;
  message_count: number;
  like_count: number;
  direct_intro_count: number;
  groups_joined_count: number;
  groups_created_count: number;
  events_created_count: number;
  featured_portfolio_count: number;
  virtual_meetings_hosted: number;
  boost_minutes_used: number;
  boost_uses_count: number;
  daily_reset_at?: string;
}

export interface UsageStore {
  usageCache: UsageCache | null;
  batchUpdates: BatchUpdate[];
  isSyncing: boolean;
  lastSyncError: string | null;
  databaseTotals: DatabaseTotals | null;
  saveStrategy: SyncStrategy;
  rateLimits: RateLimits;
  cacheConfig: CacheConfig;
  retryStrategy: RetryStrategy;
  swipeCache: {
    pendingSwipes: any[];
    lastSyncTimestamp: number;
  };
  
  // Unified limit checking functions
  checkAllLimits: () => any; // Returns AllLimitsStatus
  checkSpecificLimit: (limitType: string) => any; // Returns LimitStatus
  checkSwipeLimit: () => boolean;
  checkMatchLimit: () => boolean;
  checkLikeLimit: () => boolean;
  checkMessageLimit: () => boolean;
  
  // Authority methods - these are the "source of truth" for usage data
  getDatabaseTotals: () => DatabaseTotals | null;
  getUsageCache: () => UsageCache | null;
  getCurrentUsage: (type: string) => number;
  
  // Core functions
  initializeUsage: (userId: string) => Promise<void>;
  fetchDatabaseTotals: (userId: string) => Promise<void>;
  syncUsageData: (userId: string, force?: boolean) => Promise<void>;
  getUsageStats: (userId: string) => Promise<UsageStats | null>;
  queueBatchUpdate: (update: BatchUpdate) => void;
  resetUsage: () => void;
  clearError: () => void;
  updateUsage: (action: string, count?: number, force?: boolean) => Promise<void>;
  trackUsage: (actionType: string, count?: number) => Promise<UsageResult>;
  resetUsageCache: () => void;
  
  // Swipe caching functions
  cacheSwipe: (swipeAction: any) => void;
  syncSwipeData: () => Promise<void>;
  getPendingSwipeCount: () => number;
}

// Store interfaces for consistency
export interface AuthStoreState {
  user: UserProfile | null;
  allTierSettings: Record<MembershipTier, TierSettings> | null;
  tierSettingsTimestamp: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  networkStatus: { isConnected: boolean | null; type?: string | null; } | null;
}

export interface UsageStoreState {
  usageCache: UsageCache | null;
  batchUpdates: BatchUpdate[];
  isSyncing: boolean;
  lastSyncError: string | null;
  databaseTotals: DatabaseTotals | null;
  saveStrategy: SyncStrategy;
  rateLimits: RateLimits;
  cacheConfig: CacheConfig;
  retryStrategy: RetryStrategy;
  swipeCache: {
    pendingSwipes: any[];
    lastSyncTimestamp: number;
  };
}

// Store authorities interfaces - these are the "source of truth" methods
export interface AuthStoreAuthority {
  getTierSettings: () => TierSettings | null;
  fetchAllTierSettings: () => Promise<void>;
  getUserProfile: () => UserProfile | null;
  isUserAuthenticated: () => boolean;
  getUserRole: () => UserRole;
  getUserMembershipTier: () => MembershipTier;
}

export interface UsageStoreAuthority {
  checkAllLimits: () => any; // Returns AllLimitsStatus
  checkSpecificLimit: (limitType: string) => any; // Returns LimitStatus
  checkSwipeLimit: () => boolean;
  checkMatchLimit: () => boolean;
  checkLikeLimit: () => boolean;
  checkMessageLimit: () => boolean;
  getDatabaseTotals: () => DatabaseTotals | null;
  getUsageCache: () => UsageCache | null;
  getCurrentUsage: (type: string) => number;
}
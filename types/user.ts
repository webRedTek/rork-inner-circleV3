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

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  details?: Record<string, any>;
  timestamp: string;
}
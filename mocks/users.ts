import { UserProfile, BusinessStage, LookingFor, Skill, AvailabilityLevel } from '@/types/user';

export const mockUsers: UserProfile[] = [
  {
    id: 'user1',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=2787&auto=format&fit=crop',
    businessField: 'Technology',
    entrepreneurStatus: 'current',
    bio: 'Founder of TechSolutions, a software development company specializing in AI solutions for small businesses.',
    lookingFor: ['Partners', 'Mentoring others'],
    businessStage: 'Growth Stage',
    skillsOffered: ['Development', 'Product Management'],
    skillsSeeking: ['Marketing', 'Sales'],
    keyChallenge: 'Scaling operations while maintaining quality',
    industryFocus: 'SaaS',
    availabilityLevel: 'Regular virtual coffee',
    location: 'San Francisco, CA',
    timezone: 'PST',
    successHighlight: 'Secured $1.5M in seed funding last quarter',
    goals: [
      'Expand to international markets',
      'Launch new AI product line',
      'Grow team by 50% this year'
    ],
    analytics: {
      revenue: '$1.2M annually',
      growth: '35% YoY',
      customers: '120+ businesses'
    },
    portfolio: {
      items: [
        {
          id: 'port1',
          title: 'AI Customer Service Platform',
          description: 'An AI-powered platform that handles customer inquiries 24/7, reducing response time by 80%.',
          imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2940&auto=format&fit=crop'
        },
        {
          id: 'port2',
          title: 'Data Analytics Dashboard',
          description: 'A comprehensive dashboard for businesses to visualize and analyze their data in real-time.',
          imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop'
        }
      ]
    },
    membershipTier: 'gold',
    businessVerified: true,
    joinedGroups: ['group1', 'group2'],
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000 // 30 days ago
  },
  {
    id: 'user2',
    name: 'Samantha Lee',
    email: 'samantha@example.com',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=2888&auto=format&fit=crop',
    businessField: 'E-commerce',
    entrepreneurStatus: 'current',
    bio: 'Founder of EcoStyle, a sustainable fashion e-commerce platform connecting eco-conscious consumers with ethical brands.',
    lookingFor: ['Peers', 'Bounce Ideas'],
    businessStage: 'Established/Scaling',
    skillsOffered: ['Marketing', 'Operations'],
    skillsSeeking: ['Development', 'Finance'],
    keyChallenge: 'Optimizing supply chain for sustainability',
    industryFocus: 'Fashion Tech',
    availabilityLevel: 'Local meetups',
    location: 'Portland, OR',
    timezone: 'PST',
    successHighlight: 'Featured in Vogue as a top sustainable fashion platform',
    goals: [
      'Reach $5M in annual sales',
      'Partner with 50 new sustainable brands',
      'Launch mobile app'
    ],
    analytics: {
      revenue: '$2.8M annually',
      growth: '42% YoY',
      customers: '15,000+ active users'
    },
    portfolio: {
      items: [
        {
          id: 'port3',
          title: 'EcoStyle Marketplace',
          description: 'A curated marketplace featuring over 100 sustainable fashion brands from around the world.',
          imageUrl: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=2940&auto=format&fit=crop'
        }
      ]
    },
    membershipTier: 'gold',
    businessVerified: true,
    joinedGroups: ['group2'],
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000 // 45 days ago
  },
  {
    id: 'user3',
    name: 'Marcus Williams',
    email: 'marcus@example.com',
    photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=2787&auto=format&fit=crop',
    businessField: 'Finance',
    entrepreneurStatus: 'upcoming',
    bio: 'Developing FinEase, a financial literacy platform aimed at helping young adults manage their finances and build wealth.',
    lookingFor: ['Mentor', 'Partners', 'Funding'],
    businessStage: 'Idea Phase',
    skillsOffered: ['Finance', 'Content Creation'],
    skillsSeeking: ['Development', 'UI/UX', 'Marketing'],
    keyChallenge: 'Finding technical co-founder',
    industryFocus: 'FinTech',
    availabilityLevel: 'Long-term mentorship/partnership',
    location: 'Chicago, IL',
    timezone: 'CST',
    successHighlight: 'Won first place at local startup pitch competition',
    goals: [
      'Secure seed funding',
      'Launch beta version',
      'Acquire 1,000 users in first quarter'
    ],
    membershipTier: 'bronze',
    businessVerified: false,
    joinedGroups: ['group1'],
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000 // 15 days ago
  },
  {
    id: 'user4',
    name: 'Olivia Chen',
    email: 'olivia@example.com',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=2961&auto=format&fit=crop',
    businessField: 'Health',
    entrepreneurStatus: 'current',
    bio: 'Founder of WellnessTrack, a health tech startup creating personalized wellness plans based on biometric data.',
    lookingFor: ['Bounce Ideas', 'Peers'],
    businessStage: 'Growth Stage',
    skillsOffered: ['Product Management', 'Strategy'],
    skillsSeeking: ['Sales', 'Fundraising'],
    keyChallenge: 'Scaling customer acquisition',
    industryFocus: 'Health Tech',
    availabilityLevel: 'Regular virtual coffee',
    location: 'Boston, MA',
    timezone: 'EST',
    successHighlight: 'Partnered with 3 major health insurance providers',
    analytics: {
      revenue: '$800K annually',
      growth: '28% YoY',
      customers: '8,500+ subscribers'
    },
    membershipTier: 'silver',
    businessVerified: true,
    joinedGroups: [],
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000 // 60 days ago
  },
  {
    id: 'user5',
    name: 'David Rodriguez',
    email: 'david@example.com',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2940&auto=format&fit=crop',
    businessField: 'Food & Beverage',
    entrepreneurStatus: 'upcoming',
    bio: 'Launching UrbanHarvest, a network of urban farms using vertical farming technology to provide fresh produce to city restaurants.',
    lookingFor: ['Mentor', 'Funding'],
    businessStage: 'Pre-Seed/Startup',
    skillsOffered: ['Operations', 'Strategy'],
    skillsSeeking: ['Marketing', 'Sales', 'Finance'],
    keyChallenge: 'Securing initial funding',
    industryFocus: 'AgTech',
    availabilityLevel: 'Quick chats',
    location: 'Austin, TX',
    timezone: 'CST',
    successHighlight: 'Completed successful pilot with two local restaurants',
    goals: [
      'Establish first urban farm location',
      'Partner with 10 local restaurants',
      'Develop proprietary growing technology'
    ],
    membershipTier: 'bronze',
    businessVerified: false,
    joinedGroups: [],
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
  },
  {
    id: 'user6',
    name: 'Emma Wilson',
    email: 'emma@example.com',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2787&auto=format&fit=crop',
    businessField: 'Education',
    entrepreneurStatus: 'current',
    bio: 'Founder of SkillBridge, an online platform connecting professionals with students for mentorship and skill development.',
    lookingFor: ['Partners', 'Mentoring others', 'Peers'],
    businessStage: 'Established/Scaling',
    skillsOffered: ['Product Management', 'Marketing', 'Strategy'],
    skillsSeeking: ['Development', 'Data Analysis'],
    keyChallenge: 'International expansion',
    industryFocus: 'EdTech',
    availabilityLevel: 'Long-term mentorship/partnership',
    location: 'Toronto, Canada',
    timezone: 'EST',
    successHighlight: 'Reached 30,000 active users milestone',
    analytics: {
      revenue: '$1.5M annually',
      growth: '45% YoY',
      customers: '30,000+ users'
    },
    portfolio: {
      items: [
        {
          id: 'port4',
          title: 'SkillBridge Platform',
          description: 'A mentorship platform that has facilitated over 15,000 successful mentorship relationships.',
          imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2942&auto=format&fit=crop'
        }
      ]
    },
    membershipTier: 'gold',
    businessVerified: true,
    joinedGroups: ['group1', 'group3'],
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000 // 90 days ago
  }
];

export const mockGroups = [
  {
    id: 'group1',
    name: 'Tech Founders Circle',
    description: 'A community for tech startup founders to share experiences, challenges, and opportunities.',
    imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2940&auto=format&fit=crop',
    memberIds: ['user1', 'user3', 'user6'],
    createdBy: 'user1',
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    category: 'Industry',
    industry: 'Technology'
  },
  {
    id: 'group2',
    name: 'Sustainable Business Alliance',
    description: 'Entrepreneurs focused on building sustainable and environmentally conscious businesses.',
    imageUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=2940&auto=format&fit=crop',
    memberIds: ['user1', 'user2'],
    createdBy: 'user2',
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    category: 'Interest',
    industry: 'Sustainability'
  },
  {
    id: 'group3',
    name: 'Women in Business',
    description: 'A supportive community for women entrepreneurs to connect, share resources, and collaborate.',
    imageUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=2940&auto=format&fit=crop',
    memberIds: ['user6'],
    createdBy: 'user6',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    category: 'Community',
    industry: 'All Industries'
  }
];
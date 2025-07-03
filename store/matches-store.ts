/**
 * FILE: store/matches-store.ts
 * LAST UPDATED: 2025-07-02 19:30
 * 
 * INITIALIZATION ORDER:
 * 1. Requires auth-store to be initialized first (for user session)
 * 2. Initializes after auth-store confirms user session
 * 3. Sets up simplified batch processing and persistent cache management
 * 4. Race condition: Must wait for user location before fetching matches
 * 
 * CURRENT STATE:
 * Simplified central store for match functionality using Zustand. Features:
 * - Persistent ProfileCache with intelligent eviction and warming strategies
 * - Manual-only fetching (no automatic prefetching)
 * - Optimistic UI updates with rollback capability for better UX
 * - Intelligent batch processing with deduplication and priority queuing
 * - Enhanced error recovery with exponential backoff and circuit breakers
 * - Network-aware operations with offline queue management
 * - Performance optimizations with memory management and cleanup
 * - Fixed 10-match batch size for consistent loading
 * 
 * RECENT CHANGES:
 * - Removed automatic prefetching and adaptive behavior
 * - Set fixed batch size to 10 matches
 * - Removed AdaptivePrefetcher class
 * - Simplified fetching to manual-only (initial load + refresh button)
 * - Removed automatic batch processing intervals
 * - Kept optimistic UI updates and error handling
 * - Maintained cache functionality for performance
 * 
 * FILE INTERACTIONS:
 * - Uses supabase.ts for: database queries, match functions, batch processing
 * - Uses auth-store for: user data, authentication state
 * - Uses usage-store for: swipe/match limits, usage tracking
 * - Uses notification-store for: match notifications, error alerts
 * - Used by: discover screen, profile screens, chat screens, messages screen
 * 
 * KEY FUNCTIONS:
 * - fetchPotentialMatches: Simplified manual fetching with 10-match limit
 * - likeUser/passUser: Optimistic updates with rollback capability
 * - processSwipeBatch: Intelligent batching with deduplication
 * - EnhancedProfileCache: Persistent cache with warming and cleanup
 * 
 * STORE DEPENDENCIES:
 * 1. auth-store -> User data and authentication (required first)
 * 2. usage-store -> Action limits and tracking
 * 3. notification-store -> Match and error notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { UserProfile, MembershipTier, MatchWithProfile } from '@/types/user';
import { 
  isSupabaseConfigured, 
  supabase, 
  convertToCamelCase, 
  SwipeAction, 
  fetchPotentialMatches as fetchPotentialMatchesFromSupabase, 
  processSwipeBatch as processSwipeBatchFromSupabase, 
  fetchUserMatches as fetchUserMatchesFromSupabase,
  PotentialMatchesResult
} from '@/lib/supabase';
import { useAuthStore } from './auth-store';
import { useDebugStore } from './debug-store';
import { useNotificationStore } from './notification-store';
import { useUsageStore } from './usage-store';
import { handleError, withErrorHandling, withRetry, withCircuitBreaker, ErrorCodes, ErrorCategory } from '@/utils/error-utils';
import { withNetworkCheck, checkNetworkStatus } from '@/utils/network-utils';
import type { StoreApi, StateCreator } from 'zustand';

// Enhanced PassedUser interface with expiration
interface PassedUser {
  id: string;
  timestamp: number;
  reason?: 'manual' | 'auto' | 'filter';
  expiresAt: number;
}

// Enhanced SwipeAction with priority and retry info
interface EnhancedSwipeAction extends SwipeAction {
  id: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  optimisticUpdate: boolean;
  timestamp: number;
}

// Enhanced cache configuration
interface EnhancedCacheConfig {
  maxAge: number;
  maxSize: number;
  version: number;
  persistenceKey: string;
  warmupSize: number;
  cleanupInterval: number;
  compressionEnabled: boolean;
}

// Cache entry with enhanced metadata
interface EnhancedCacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  hits: number;
  lastAccess: number;
  priority: number;
  size: number;
  compressed?: boolean;
}

// Cache statistics for monitoring
interface CacheStats {
  size: number;
  hitRate: number;
  averageAge: number;
  memoryUsage: number;
  compressionRatio: number;
  evictionCount: number;
}

// Network state tracking
interface NetworkState {
  isOnline: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  lastOnlineTime: number;
  offlineQueueSize: number;
}

/**
 * Enhanced ProfileCache with persistence, compression, and intelligent management
 */
class EnhancedProfileCache {
  private cache: Map<string, EnhancedCacheEntry<UserProfile>>;
  private config: EnhancedCacheConfig;
  private stats: CacheStats;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private persistenceTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor() {
    this.cache = new Map();
    this.config = {
      maxAge: 1000 * 60 * 45, // 45 minutes
      maxSize: 100, // Reduced cache size for simpler management
      version: 2,
      persistenceKey: 'enhanced_profile_cache',
      warmupSize: 10, // Match the batch size
      cleanupInterval: 1000 * 60 * 5, // 5 minutes
      compressionEnabled: true
    };
    this.stats = {
      size: 0,
      hitRate: 0,
      averageAge: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      evictionCount: 0
    };
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadFromPersistence();
      this.startCleanupTimer();
      this.startPersistenceTimer();
      this.isInitialized = true;
    } catch (error) {
      console.error('[EnhancedProfileCache] Initialization failed:', error);
    }
  }

  private async loadFromPersistence(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.config.persistenceKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === this.config.version) {
          // Restore cache entries
          Object.entries(data.entries).forEach(([key, entry]: [string, any]) => {
            if (this.isEntryValid(entry)) {
              this.cache.set(key, entry);
            }
          });
          console.log(`[EnhancedProfileCache] Loaded ${this.cache.size} profiles from persistence`);
        } else {
          console.log('[EnhancedProfileCache] Cache version mismatch, starting fresh');
          await AsyncStorage.removeItem(this.config.persistenceKey);
        }
      }
    } catch (error) {
      console.error('[EnhancedProfileCache] Failed to load from persistence:', error);
    }
  }

  private async saveToPersistence(): Promise<void> {
    try {
      const data = {
        version: this.config.version,
        timestamp: Date.now(),
        entries: Object.fromEntries(this.cache.entries())
      };
      await AsyncStorage.setItem(this.config.persistenceKey, JSON.stringify(data));
    } catch (error) {
      console.error('[EnhancedProfileCache] Failed to save to persistence:', error);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private startPersistenceTimer(): void {
    // Save to persistence every 5 minutes
    this.persistenceTimer = setInterval(() => {
      this.saveToPersistence();
    }, 1000 * 60 * 5);
  }

  public get(id: string): UserProfile | null {
    const entry = this.cache.get(id);
    if (!entry) {
      return null;
    }

    if (this.isEntryValid(entry)) {
      entry.hits++;
      entry.lastAccess = Date.now();
      entry.priority = Math.min(entry.priority + 1, 10);
      this.updateStats();
      return entry.data;
    }

    // Entry is invalid, remove it
    this.cache.delete(id);
    this.updateStats();
    return null;
  }

  public set(id: string, profile: UserProfile, priority: number = 5): void {
    if (!this.validateProfile(profile)) {
      console.warn('[EnhancedProfileCache] Attempted to cache invalid profile:', { id });
      return;
    }

    // Ensure cache doesn't exceed max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUsed();
    }

    const size = this.calculateProfileSize(profile);
    const entry: EnhancedCacheEntry<UserProfile> = {
      data: profile,
      timestamp: Date.now(),
      version: this.config.version,
      hits: 1,
      lastAccess: Date.now(),
      priority,
      size
    };

    this.cache.set(id, entry);
    this.updateStats();
  }

  public warmup(profiles: UserProfile[]): void {
    profiles.slice(0, this.config.warmupSize).forEach(profile => {
      this.set(profile.id, profile, 8); // High priority for warmup
    });
  }

  private calculateProfileSize(profile: UserProfile): number {
    return JSON.stringify(profile).length;
  }

  private validateProfile(profile: UserProfile | null): boolean {
    return !!(
      profile &&
      typeof profile === 'object' &&
      'id' in profile &&
      'email' in profile &&
      'name' in profile &&
      profile.id &&
      profile.email &&
      profile.name
    );
  }

  private isEntryValid(entry: EnhancedCacheEntry<UserProfile>): boolean {
    const now = Date.now();
    return (
      entry.version === this.config.version &&
      now - entry.timestamp < this.config.maxAge &&
      this.validateProfile(entry.data)
    );
  }

  private evictLeastUsed(): void {
    let leastUsedId: string | null = null;
    let lowestScore = Infinity;

    for (const [id, entry] of this.cache.entries()) {
      // Score based on hits, recency, and priority
      const ageScore = (Date.now() - entry.lastAccess) / 1000;
      const hitScore = Math.max(1, entry.hits);
      const priorityScore = entry.priority;
      const score = ageScore / (hitScore * priorityScore);

      if (score < lowestScore) {
        lowestScore = score;
        leastUsedId = id;
      }
    }

    if (leastUsedId) {
      this.cache.delete(leastUsedId);
      this.stats.evictionCount++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.cache.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[EnhancedProfileCache] Cleaned up ${cleanedCount} expired entries`);
      this.updateStats();
    }
  }

  private updateStats(): void {
    const now = Date.now();
    let totalHits = 0;
    let totalAge = 0;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalAge += now - entry.timestamp;
      totalSize += entry.size;
    }

    this.stats = {
      size: this.cache.size,
      hitRate: totalHits / Math.max(this.cache.size, 1),
      averageAge: totalAge / Math.max(this.cache.size, 1),
      memoryUsage: totalSize,
      compressionRatio: 1,
      evictionCount: this.stats.evictionCount
    };
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  public clear(): void {
    this.cache.clear();
    this.stats.evictionCount = 0;
    this.updateStats();
    AsyncStorage.removeItem(this.config.persistenceKey);
  }

  public invalidate(id: string): void {
    this.cache.delete(id);
    this.updateStats();
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    this.saveToPersistence(); // Final save
  }
}

/**
 * Enhanced Swipe Queue with persistence and deduplication
 */
class EnhancedSwipeQueue {
  private queue: Map<string, EnhancedSwipeAction> = new Map();
  private persistenceKey = 'enhanced_swipe_queue';
  private maxRetries = 3;

  constructor() {
    this.loadFromPersistence();
  }

  private async loadFromPersistence(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.persistenceKey);
      if (stored) {
        const actions = JSON.parse(stored);
        actions.forEach((action: EnhancedSwipeAction) => {
          this.queue.set(action.id, action);
        });
        console.log(`[EnhancedSwipeQueue] Loaded ${this.queue.size} pending swipes`);
      }
    } catch (error) {
      console.error('[EnhancedSwipeQueue] Failed to load from persistence:', error);
    }
  }

  private async saveToPersistence(): Promise<void> {
    try {
      const actions = Array.from(this.queue.values());
      await AsyncStorage.setItem(this.persistenceKey, JSON.stringify(actions));
    } catch (error) {
      console.error('[EnhancedSwipeQueue] Failed to save to persistence:', error);
    }
  }

  public add(action: Omit<EnhancedSwipeAction, 'id' | 'retryCount'>): void {
    const id = `${action.swiper_id}_${action.swipee_id}_${action.timestamp}`;
    
    // Deduplicate - if same user/target exists, update with latest
    const existingKey = Array.from(this.queue.keys()).find(key => {
      const existing = this.queue.get(key)!;
      return existing.swiper_id === action.swiper_id && 
             existing.swipee_id === action.swipee_id;
    });

    if (existingKey) {
      this.queue.delete(existingKey);
    }

    const enhancedAction: EnhancedSwipeAction = {
      ...action,
      id,
      retryCount: 0
    };

    this.queue.set(id, enhancedAction);
    this.saveToPersistence();
  }

  public getBatch(size: number): EnhancedSwipeAction[] {
    const actions = Array.from(this.queue.values())
      .sort((a, b) => {
        // Sort by priority first, then by timestamp
        if (a.priority !== b.priority) {
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.timestamp - b.timestamp;
      })
      .slice(0, size);

    return actions;
  }

  public remove(ids: string[]): void {
    ids.forEach(id => this.queue.delete(id));
    this.saveToPersistence();
  }

  public markRetry(id: string): boolean {
    const action = this.queue.get(id);
    if (action) {
      action.retryCount++;
      if (action.retryCount >= this.maxRetries) {
        this.queue.delete(id);
        this.saveToPersistence();
        return false;
      }
      this.saveToPersistence();
      return true;
    }
    return false;
  }

  public size(): number {
    return this.queue.size;
  }

  public clear(): void {
    this.queue.clear();
    AsyncStorage.removeItem(this.persistenceKey);
  }

  public getHighPriorityCount(): number {
    return Array.from(this.queue.values()).filter(a => a.priority === 'high').length;
  }
}

// Enhanced helper function to safely stringify errors
const getReadableError = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    
    // Handle structured error objects with priority order
    if (err.userMessage) return err.userMessage;
    if (err.message) return err.message;
    if (err.error?.message) return err.error.message;
    if (err.details) return String(err.details);
    if (err.hint) return String(err.hint);
    if (err.description) return String(err.description);
    if (err.code) return `Error code: ${err.code}`;
    
    // Try to extract meaningful properties
    const meaningfulProps = ['reason', 'cause', 'statusText', 'data'];
    for (const prop of meaningfulProps) {
      if (err[prop]) return String(err[prop]);
    }
    
    // Last resort: try to stringify safely
    try {
      return JSON.stringify(err, Object.getOwnPropertyNames(err));
    } catch (e) {
      return 'An error occurred';
    }
  }
  
  return String(error);
};

// Initialize enhanced components
const enhancedProfileCache = new EnhancedProfileCache();
const enhancedSwipeQueue = new EnhancedSwipeQueue();

// Network state tracking
let networkState: NetworkState = {
  isOnline: true,
  connectionQuality: 'good',
  lastOnlineTime: Date.now(),
  offlineQueueSize: 0
};

// Update network state
const updateNetworkState = async () => {
  try {
    const status = await checkNetworkStatus();
    const wasOffline = !networkState.isOnline;
    
    networkState.isOnline = status.isConnected ?? false;
    
    if (networkState.isOnline) {
      networkState.lastOnlineTime = Date.now();
      if (status.type === 'wifi') {
        networkState.connectionQuality = 'excellent';
      } else if (status.type === 'cellular') {
        networkState.connectionQuality = 'good';
      } else {
        networkState.connectionQuality = 'poor';
      }
      
      // If we just came back online, process offline queue
      if (wasOffline && enhancedSwipeQueue.size() > 0) {
        console.log('[MatchesStore] Back online, processing offline queue');
        setTimeout(() => {
          useMatchesStore.getState().processSwipeBatch();
        }, 1000);
      }
    } else {
      networkState.connectionQuality = 'offline';
    }
    
    networkState.offlineQueueSize = enhancedSwipeQueue.size();
  } catch (error) {
    console.error('[MatchesStore] Failed to update network state:', error);
  }
};

// Update network state every 30 seconds
setInterval(updateNetworkState, 30000);
updateNetworkState(); // Initial check

// Convert Supabase response to UserProfile with enhanced caching
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const id = String(data.id || '');
  
  // Check cache first
  const cached = enhancedProfileCache.get(id);
  if (cached) return cached;
  
  // Convert the data
  const profile: UserProfile = {
    id,
    email: String(data.email || ''),
    name: String(data.name || ''),
    bio: String(data.bio || ''),
    location: String(data.location || ''),
    zipCode: String(data.zipCode || ''),
    latitude: Number(data.latitude || 0),
    longitude: Number(data.longitude || 0),
    preferredDistance: Number(data.preferredDistance || 50),
    locationPrivacy: String(data.locationPrivacy || 'public') as UserProfile["locationPrivacy"],
    businessField: String(data.businessField || 'Technology') as UserProfile["businessField"],
    entrepreneurStatus: String(data.entrepreneurStatus || 'upcoming') as UserProfile["entrepreneurStatus"],
    photoUrl: data.photoUrl,
    membershipTier: String(data.membershipTier || 'bronze') as MembershipTier,
    businessVerified: Boolean(data.businessVerified || false),
    joinedGroups: Array.isArray(data.joinedGroups) ? data.joinedGroups : [],
    createdAt: Number(data.createdAt || Date.now()),
    lookingFor: Array.isArray(data.lookingFor) ? data.lookingFor : [],
    businessStage: data.businessStage,
    skillsOffered: Array.isArray(data.skillsOffered) ? data.skillsOffered : [],
    skillsSeeking: Array.isArray(data.skillsSeeking) ? data.skillsSeeking : [],
    keyChallenge: data.keyChallenge,
    industryFocus: data.industryFocus,
    availabilityLevel: Array.isArray(data.availabilityLevel) ? data.availabilityLevel : [],
    timezone: data.timezone,
    successHighlight: data.successHighlight,
  };
  
  // Cache the converted profile with normal priority
  enhancedProfileCache.set(id, profile, 5);
  
  return profile;
};

// Rate limiting with adaptive backoff
const RATE_LIMIT = 800;
let lastQueryTime = 0;

const rateLimitedQuery = async () => {
  const now = Date.now();
  const timeSinceLastQuery = now - lastQueryTime;
  
  if (timeSinceLastQuery < RATE_LIMIT) {
    const delay = RATE_LIMIT - timeSinceLastQuery;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastQueryTime = Date.now();
};

// Enhanced retry with network awareness
const withRateLimitAndRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  await rateLimitedQuery();
  
  return await withRetry(operation, {
    maxRetries: networkState.connectionQuality === 'excellent' ? 2 : 3,
    shouldRetry: (error) => {
      const isNetworkError = error.category === ErrorCategory.NETWORK;
      const isRateLimit = error.category === ErrorCategory.RATE_LIMIT;
      return isNetworkError || isRateLimit;
    }
  });
};

interface SerializedMatchesState {
  potentialMatches: UserProfile[];
  cachedMatches: UserProfile[];
  matches: MatchWithProfile[];
  batchSize: number;
  isLoading: boolean;
  error: string | null;
  newMatch: MatchWithProfile | null;
  swipeLimitReached: boolean;
  matchLimitReached: boolean;
  noMoreProfiles: boolean;
  passedUsers: PassedUser[];
  pendingLikes: string[];
  matchesLoading: boolean;
  pendingMatches: MatchWithProfile[];
  networkState: NetworkState;
  cacheStats: CacheStats;
  optimisticUpdates: Array<[string, 'like' | 'pass']>;
  lastSwipeTime: number;
}

interface MatchesStateData {
  potentialMatches: UserProfile[];
  cachedMatches: UserProfile[];
  matches: MatchWithProfile[];
  batchSize: number;
  isLoading: boolean;
  error: string | null;
  newMatch: MatchWithProfile | null;
  swipeLimitReached: boolean;
  matchLimitReached: boolean;
  noMoreProfiles: boolean;
  passedUsers: PassedUser[];
  pendingLikes: Set<string>;
  matchesLoading: boolean;
  pendingMatches: MatchWithProfile[];
  // Enhanced state
  networkState: NetworkState;
  cacheStats: CacheStats;
  optimisticUpdates: Map<string, 'like' | 'pass'>;
  lastSwipeTime: number;
}

interface MatchesStateMethods {
  fetchPotentialMatches: () => Promise<void>;
  fetchMatches: () => Promise<void>;
  likeUser: (userId: string) => Promise<MatchWithProfile | null>;
  passUser: (userId: string) => Promise<void>;
  queueSwipe: (userId: string, direction: 'left' | 'right') => Promise<void>;
  processSwipeBatch: () => Promise<void>;
  clearError: () => void;
  clearNewMatch: () => void;
  resetCacheAndState: () => Promise<void>;
  cleanupExpiredPasses: () => Promise<void>;
  // Enhanced methods
  getNetworkState: () => NetworkState;
  getCacheStats: () => CacheStats;
  warmupCache: (profiles: UserProfile[]) => void;
  rollbackOptimisticUpdate: (userId: string) => void;
}

type MatchesState = MatchesStateData & MatchesStateMethods;

// Constants
const PASS_EXPIRY_DAYS = 7;
const PASSED_USERS_KEY = 'passed_users';

// Initial state with simplified properties
const initialState: MatchesStateData & { version: number } = {
  version: 3, // Incremented for simplified version
  potentialMatches: [],
  cachedMatches: [],
  matches: [],
  batchSize: 10, // Fixed to 10 matches
  isLoading: false,
  error: null,
  newMatch: null,
  swipeLimitReached: false,
  matchLimitReached: false,
  noMoreProfiles: false,
  passedUsers: [],
  pendingLikes: new Set(),
  matchesLoading: false,
  pendingMatches: [],
  networkState,
  cacheStats: enhancedProfileCache.getStats(),
  optimisticUpdates: new Map(),
  lastSwipeTime: 0
};

type SetState = (
  partial: MatchesState | Partial<MatchesState> | ((state: MatchesState) => MatchesState | Partial<MatchesState>),
  replace?: boolean
) => void;

type GetState = () => MatchesState;

const createMatchesStore = (set: SetState, get: GetState) => ({
  // Initial state
  ...initialState,

  // Methods
  fetchPotentialMatches: async () => {
    const debugStore = useDebugStore.getState();
    const notificationStore = useNotificationStore.getState();
    const callId = `fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (debugStore.isDebugMode) {
      console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] fetchPotentialMatches CALLED`, {
        networkState: get().networkState,
        cacheStats: get().cacheStats,
        timestamp: new Date().toISOString()
      });
    }
    
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      
      if (!isReady || !user) {
        const authError = {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: 'User not ready or authenticated'
        };
        
        notificationStore.addNotification({
          type: 'error',
          message: 'Please log in to view matches',
          displayStyle: 'toast',
          duration: 4000
        });
        
        throw authError;
      }

      set({ isLoading: true, error: null });
      
      try {
        const { 
          passedUsers, 
          pendingLikes, 
          potentialMatches, 
          batchSize,
          networkState: currentNetworkState
        } = get();
        
        const seenIds = new Set([
          ...passedUsers.map(p => p.id),
          ...Array.from(pendingLikes)
        ]);

        if (debugStore.isDebugMode) {
          console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] Current state`, {
            currentMatches: potentialMatches.length,
            passedUsers: passedUsers.length,
            pendingLikes: pendingLikes.size,
            seenIds: seenIds.size,
            batchSize,
            networkQuality: currentNetworkState.connectionQuality
          });
        }

        // Check network state before making request
        if (!currentNetworkState.isOnline) {
          throw {
            category: ErrorCategory.NETWORK,
            code: ErrorCodes.NETWORK_OFFLINE,
            message: 'No internet connection available'
          };
        }

        if (debugStore.isDebugMode) {
          console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] Calling Supabase fetchPotentialMatches`, {
            userId: user.id,
            limit: batchSize,
            networkQuality: currentNetworkState.connectionQuality
          });
        }

        // Fetch exactly 10 new potential matches
        const result = await withCircuitBreaker(
          () => fetchPotentialMatchesFromSupabase(
            user.id,
            undefined,
            undefined,
            batchSize // Always 10
          ),
          'fetch_potential_matches'
        );

        if (debugStore.isDebugMode) {
          console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] Supabase response`, {
            hasResult: !!result,
            matchesLength: result?.matches?.length || 0,
            count: result?.count
          });
        }

        // Handle case where no matches are returned
        if (!result || !result.matches || result.matches.length === 0) {
          if (debugStore.isDebugMode) {
            console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] No matches found - setting noMoreProfiles`);
          }
          
          set({
            isLoading: false,
            error: null,
            noMoreProfiles: true
          });
          
          notificationStore.addNotification({
            type: 'info',
            message: 'No more profiles available at this time.',
            displayStyle: 'toast',
            duration: 4000
          });
          
          return;
        }

        // Process profiles with caching
        const validMatches = result.matches
          .filter((match: any): match is UserProfile => {
            const isValid = match && 
              typeof match === 'object' && 
              match.id &&
              match.name;

            const isNotSeen = !seenIds.has(match.id);
            
            return isValid && isNotSeen;
          })
          .map((match: any) => supabaseToUserProfile(match));

        if (debugStore.isDebugMode) {
          console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] Match processing complete`, {
            rawMatches: result.matches.length,
            validMatches: validMatches.length,
            cached: validMatches.length
          });
        }

        // Warmup cache with new profiles
        enhancedProfileCache.warmup(validMatches);

        // Update state with new matches (replace on refresh, append otherwise)
        const newPotentialMatches = validMatches;
        
        set(state => ({
          potentialMatches: newPotentialMatches,
          isLoading: false,
          error: null,
          noMoreProfiles: validMatches.length === 0,
          cacheStats: enhancedProfileCache.getStats()
        }));
        
        if (debugStore.isDebugMode) {
          console.log(`🔍 [SIMPLIFIED-MATCHES][${callId}] SUCCESS - State updated`, {
            totalMatches: newPotentialMatches.length,
            newMatches: validMatches.length,
            cacheSize: enhancedProfileCache.getStats().size
          });
        }
        
        // Show success notification for manual refreshes
        if (validMatches.length > 0) {
          notificationStore.addNotification({
            type: 'success',
            message: `Found ${validMatches.length} new profiles`,
            displayStyle: 'toast',
            duration: 3000
          });
        }
        
      } catch (error) {
        const errorDetails = {
          originalError: error,
          networkState: get().networkState,
          cacheStats: get().cacheStats
        };
        
        if (debugStore.isDebugMode) {
          console.error(`🔍 [SIMPLIFIED-MATCHES][${callId}] ERROR CAUGHT`, errorDetails);
        }
        
        const appError = handleError(error);
        const readableError = getReadableError(error);

        set({
          error: appError.userMessage,
          isLoading: false,
          noMoreProfiles: true
        });
        
        notificationStore.addNotification({
          type: 'error',
          message: `Failed to load matches: ${appError.userMessage}`,
          displayStyle: 'toast',
          duration: 6000
        });
        
        throw appError;
      }
    });
  },

  fetchMatches: async () => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      const notificationStore = useNotificationStore.getState();
      
      if (!isReady || !user) {
        const errorMessage = 'User not ready or authenticated for fetching matches';
        notificationStore.addNotification({
          type: 'error',
          message: 'Please log in to view your matches',
          displayStyle: 'toast',
          duration: 4000
        });
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: errorMessage
        };
      }
      
      set({ matchesLoading: true, error: null });
      
      try {
        await withNetworkCheck(async () => {
          if (!isSupabaseConfigured() || !supabase) {
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_CONNECTION_ERROR,
              message: 'Database is not configured'
            };
          }
          
          // Fetch matches with enhanced retry logic
          const { data: matchesData, error: matchesError } = await withRateLimitAndRetry(
            async () => {
              if (!supabase) throw new Error('Supabase client is not initialized');
              return await supabase
                .from('matches')
                .select(`
                  *,
                  matched_user:users!matches_matched_user_id_fkey(*)
                `)
                .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`)
                .order('created_at', { ascending: false });
            }
          );
          
          if (matchesError) {
            const readableError = getReadableError(matchesError);
            notificationStore.addNotification({
              type: 'error',
              message: `Failed to load matches: ${readableError}`,
              displayStyle: 'toast',
              duration: 5000
            });
            throw {
              category: ErrorCategory.DATABASE,
              code: ErrorCodes.DB_QUERY_ERROR,
              message: readableError
            };
          }
          
          // Convert to MatchWithProfile format with enhanced caching
          const typedMatches: MatchWithProfile[] = (matchesData || []).map((match: any) => {
            const isCurrentUserFirst = match.user_id === user.id;
            const matchedUserId = isCurrentUserFirst ? match.matched_user_id : match.user_id;
            
            // Cache the matched user profile
            const matchedUserProfile = match.matched_user ? supabaseToUserProfile(match.matched_user) : null;
            
            return {
              match_id: String(match.id || ''),
              user_id: String(match.user_id || ''),
              matched_user_id: String(match.matched_user_id || ''),
              matched_user_profile: matchedUserProfile,
              created_at: Number(match.created_at || Date.now()),
              last_message_at: match.last_message_at ? Number(match.last_message_at) : undefined,
              is_active: Boolean(match.is_active !== false)
            } as MatchWithProfile;
          }).filter((match: MatchWithProfile) => {
            return match.matched_user_profile && 
                   match.matched_user_profile.id && 
                   match.matched_user_profile.name;
          });
          
          set({ 
            matches: typedMatches, 
            matchesLoading: false,
            cacheStats: enhancedProfileCache.getStats()
          });
          
          if (typedMatches.length > 0) {
            notificationStore.addNotification({
              type: 'success',
              message: `Loaded ${typedMatches.length} matches`,
              displayStyle: 'toast',
              duration: 2000
            });
          }
        });
      } catch (error) {
        const appError = handleError(error);
        const readableError = getReadableError(error);
        
        set({
          error: appError.userMessage,
          matchesLoading: false
        });
        
        notificationStore.addNotification({
          type: 'error',
          message: `Failed to load matches: ${readableError}`,
          displayStyle: 'toast',
          duration: 5000
        });
        
        throw appError;
      }
    });
  },

  likeUser: async (userId: string) => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      const notificationStore = useNotificationStore.getState();
      const swipeStartTime = Date.now();
      
      if (!isReady || !user) {
        const errorMessage = 'User not ready or authenticated for liking user';
        notificationStore.addNotification({
          type: 'error',
          message: 'Please log in to like profiles',
          displayStyle: 'toast',
          duration: 4000
        });
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: errorMessage
        };
      }
      
      set({ isLoading: true, error: null });
      
      try {
        // Check usage limits
        const swipeResult = await useUsageStore.getState().updateUsage(user.id, 'swipe');
        if (!swipeResult.isAllowed) {
          set({ swipeLimitReached: true, isLoading: false });
          notificationStore.addNotification({
            type: 'warning',
            message: 'Daily swipe limit reached. Upgrade for more swipes.',
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily swipe limit reached'
          };
        }

        const likeResult = await useUsageStore.getState().updateUsage(user.id, 'like');
        if (!likeResult.isAllowed) {
          set({ swipeLimitReached: true, isLoading: false });
          notificationStore.addNotification({
            type: 'warning',
            message: 'Daily like limit reached. Upgrade for more likes.',
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily like limit reached'
          };
        }

        // Optimistic update - immediately update UI
        set(state => ({
          pendingLikes: new Set([...state.pendingLikes, userId]),
          optimisticUpdates: new Map([...state.optimisticUpdates, [userId, 'like']]),
          potentialMatches: state.potentialMatches.filter(u => u.id !== userId),
          lastSwipeTime: swipeStartTime
        }));

        // Queue the swipe action with high priority
        enhancedSwipeQueue.add({
          swiper_id: user.id,
          swipee_id: userId,
          direction: 'right',
          swipe_timestamp: swipeStartTime,
          priority: 'high',
          optimisticUpdate: true,
          timestamp: swipeStartTime
        });

        set({ isLoading: false });

        // Process batch if we have enough high priority items or if offline
        if (enhancedSwipeQueue.getHighPriorityCount() >= 3 || !networkState.isOnline) {
          setTimeout(() => get().processSwipeBatch(), 500);
        }
        
        return null; // Match will be processed in batch
      } catch (error) {
        // Rollback optimistic update on error
        get().rollbackOptimisticUpdate(userId);
        
        const appError = handleError(error);
        const readableError = getReadableError(error);
        
        set({
          error: appError.userMessage,
          isLoading: false
        });
        
        notificationStore.addNotification({
          type: 'error',
          message: `Failed to like profile: ${readableError}`,
          displayStyle: 'toast',
          duration: 4000
        });
        
        throw appError;
      }
    });
  },

  passUser: async (userId: string) => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      const notificationStore = useNotificationStore.getState();
      const swipeStartTime = Date.now();
      
      if (!isReady || !user) {
        const errorMessage = 'User not ready or authenticated for passing user';
        notificationStore.addNotification({
          type: 'error',
          message: 'Please log in to pass on profiles',
          displayStyle: 'toast',
          duration: 4000
        });
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: errorMessage
        };
      }
      
      set({ isLoading: true, error: null });
      
      try {
        // Check swipe limits
        const result = await useUsageStore.getState().updateUsage(user.id, 'swipe');
        if (!result.isAllowed) {
          set({ swipeLimitReached: true, isLoading: false });
          notificationStore.addNotification({
            type: 'warning',
            message: 'Daily swipe limit reached. Upgrade for more swipes.',
            displayStyle: 'toast',
            duration: 5000
          });
          throw {
            category: ErrorCategory.BUSINESS,
            code: ErrorCodes.BUSINESS_LIMIT_REACHED,
            message: 'Daily swipe limit reached'
          };
        }
        
        // Enhanced passed user with expiration
        const passedUser: PassedUser = {
          id: userId,
          timestamp: swipeStartTime,
          reason: 'manual',
          expiresAt: swipeStartTime + (PASS_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        };
        
        // Optimistic update
        set(state => ({
          passedUsers: [...state.passedUsers, passedUser],
          optimisticUpdates: new Map([...state.optimisticUpdates, [userId, 'pass']]),
          potentialMatches: state.potentialMatches.filter(u => u.id !== userId),
          lastSwipeTime: swipeStartTime
        }));

        // Queue the swipe action with normal priority
        enhancedSwipeQueue.add({
          swiper_id: user.id,
          swipee_id: userId,
          direction: 'left',
          swipe_timestamp: swipeStartTime,
          priority: 'normal',
          optimisticUpdate: true,
          timestamp: swipeStartTime
        });
        
        set({ isLoading: false });

        // Process batch if queue is getting full
        if (enhancedSwipeQueue.size() >= 5) {
          setTimeout(() => get().processSwipeBatch(), 1000);
        }
      } catch (error) {
        // Rollback optimistic update on error
        get().rollbackOptimisticUpdate(userId);
        
        const appError = handleError(error);
        const readableError = getReadableError(error);
        
        set({
          error: appError.userMessage,
          isLoading: false
        });
        
        notificationStore.addNotification({
          type: 'error',
          message: `Failed to pass on profile: ${readableError}`,
          displayStyle: 'toast',
          duration: 4000
        });
        
        throw appError;
      }
    });
  },

  queueSwipe: async (userId: string, direction: 'left' | 'right') => {
    return await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      const notificationStore = useNotificationStore.getState();
      
      if (!isReady || !user) {
        const errorMessage = 'User not ready or authenticated for queuing swipe';
        notificationStore.addNotification({
          type: 'error',
          message: 'Please log in to swipe on profiles',
          displayStyle: 'toast',
          duration: 4000
        });
        throw {
          category: ErrorCategory.AUTH,
          code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
          message: errorMessage
        };
      }
      
      enhancedSwipeQueue.add({
        swiper_id: user.id,
        swipee_id: userId,
        direction,
        swipe_timestamp: Date.now(),
        priority: direction === 'right' ? 'high' : 'normal',
        optimisticUpdate: false,
        timestamp: Date.now()
      });
      
      // Process batch if we have enough items
      if (enhancedSwipeQueue.size() >= 3) {
        await get().processSwipeBatch();
      }
    });
  },

  processSwipeBatch: async () => {
    await withErrorHandling(async () => {
      const { user, isReady } = useAuthStore.getState();
      const notificationStore = useNotificationStore.getState();
      
      if (!isReady || !user) {
        return; // Silent fail for batch processing
      }

      const batchSize = get().batchSize;
      const currentBatch = enhancedSwipeQueue.getBatch(batchSize);
      
      if (currentBatch.length === 0) return;
      
      console.log(`[SimplifiedMatchesStore] Processing batch of ${currentBatch.length} swipes`);
      
      try {
        // Convert to legacy format for API
        const legacyBatch: SwipeAction[] = currentBatch.map(action => ({
          swiper_id: action.swiper_id,
          swipee_id: action.swipee_id,
          direction: action.direction,
          swipe_timestamp: action.swipe_timestamp
        }));

        // Process the batch with circuit breaker
        const result = await withCircuitBreaker(
          () => processSwipeBatchFromSupabase(legacyBatch),
          'batch_processing'
        );
        
        if (!result) throw new Error('No result from batch processing');
        
        // Remove successfully processed swipes
        const processedIds = currentBatch.map(action => action.id);
        enhancedSwipeQueue.remove(processedIds);
        
        // Clear optimistic updates for processed swipes
        set(state => {
          const newOptimisticUpdates = new Map(state.optimisticUpdates);
          currentBatch.forEach(action => {
            newOptimisticUpdates.delete(action.swipee_id);
          });
          return { optimisticUpdates: newOptimisticUpdates };
        });
        
        // Process any new matches from the batch
        if (result.new_matches && result.new_matches.length > 0) {
          const newMatch = result.new_matches[0];
          set({ newMatch });
          
          notificationStore.addNotification({
            type: 'success',
            message: `New match! You matched with ${newMatch.matched_user_profile?.name || 'someone'}`,
            displayStyle: 'toast',
            duration: 4000
          });
        }

        // Update network state
        set({ networkState: { ...networkState, offlineQueueSize: enhancedSwipeQueue.size() } });
        
        console.log(`[SimplifiedMatchesStore] Successfully processed ${currentBatch.length} swipes`);
      } catch (error) {
        const readableError = getReadableError(error);
        console.error('[SimplifiedMatchesStore] Batch processing error:', readableError);
        
        // Mark failed swipes for retry
        currentBatch.forEach(action => {
          const canRetry = enhancedSwipeQueue.markRetry(action.id);
          if (!canRetry) {
            // Rollback optimistic update for failed swipes that can't be retried
            get().rollbackOptimisticUpdate(action.swipee_id);
          }
        });
        
        notificationStore.addNotification({
          type: 'error',
          message: `Failed to process swipes: ${readableError}`,
          displayStyle: 'toast',
          duration: 5000
        });
        
        throw error;
      }
    }, {
      rethrow: true,
      silent: false,
      customErrorMessage: 'Failed to process swipe batch'
    });
  },

  clearError: () => set({ error: null }),
  
  clearNewMatch: () => set({ newMatch: null }),

  resetCacheAndState: async () => {
    return await withErrorHandling(async () => {
      // Clear enhanced cache
      enhancedProfileCache.clear();
      enhancedSwipeQueue.clear();
      
      set((state: MatchesState) => ({
        potentialMatches: [],
        cachedMatches: [],
        matches: [],
        isLoading: false,
        error: null,
        newMatch: null,
        swipeLimitReached: false,
        matchLimitReached: false,
        noMoreProfiles: false,
        optimisticUpdates: new Map(),
        cacheStats: enhancedProfileCache.getStats()
      }));
    });
  },

  cleanupExpiredPasses: async () => {
    return await withErrorHandling(async () => {
      const state = get();
      const now = Date.now();
      const updatedPasses = state.passedUsers.filter((pass: PassedUser) => {
        return now < pass.expiresAt;
      });
      
      if (updatedPasses.length !== state.passedUsers.length) {
        set((state: MatchesState) => ({ passedUsers: updatedPasses }));
        console.log(`[SimplifiedMatchesStore] Cleaned up ${state.passedUsers.length - updatedPasses.length} expired passes`);
      }
    });
  },

  // Enhanced methods
  getNetworkState: () => get().networkState,
  
  getCacheStats: () => enhancedProfileCache.getStats(),
  
  warmupCache: (profiles: UserProfile[]) => {
    enhancedProfileCache.warmup(profiles);
    set({ cacheStats: enhancedProfileCache.getStats() });
  },
  
  rollbackOptimisticUpdate: (userId: string) => {
    set(state => {
      const newOptimisticUpdates = new Map(state.optimisticUpdates);
      const updateType = newOptimisticUpdates.get(userId);
      newOptimisticUpdates.delete(userId);
      
      // Find the profile to restore
      const cachedProfile = enhancedProfileCache.get(userId);
      if (cachedProfile && updateType) {
        return {
          optimisticUpdates: newOptimisticUpdates,
          potentialMatches: [cachedProfile, ...state.potentialMatches],
          pendingLikes: updateType === 'like' 
            ? new Set([...state.pendingLikes].filter(id => id !== userId))
            : state.pendingLikes,
          passedUsers: updateType === 'pass'
            ? state.passedUsers.filter(p => p.id !== userId)
            : state.passedUsers
        };
      }
      
      return { optimisticUpdates: newOptimisticUpdates };
    });
  }
});

export const useMatchesStore = create<MatchesState>()(
  persist(createMatchesStore, {
    name: 'matches-store',
    storage: createJSONStorage(() => AsyncStorage)
  })
);

// Simplified batch processing - only manual processing
let batchProcessingInterval: ReturnType<typeof setInterval> | null = null;

export const startBatchProcessing = () => {
  return withErrorHandling(async () => {
    if (batchProcessingInterval) {
      clearInterval(batchProcessingInterval);
    }

    // Only process when there are pending swipes and we're online
    batchProcessingInterval = setInterval(async () => {
      const store = useMatchesStore.getState();
      const queueSize = enhancedSwipeQueue.size();
      
      // Only process if we have pending swipes and are online
      const shouldProcess = queueSize > 0 && 
        !store.isLoading && 
        networkState.isOnline;
      
      if (shouldProcess) {
        try {
          await store.processSwipeBatch();
        } catch (error) {
          const readableError = getReadableError(error);
          console.error('[SimplifiedMatchesStore] Batch processing interval error:', readableError);
          
          // Only show notification for critical errors
          if (queueSize > 10) {
            useNotificationStore.getState().addNotification({
              type: 'warning',
              message: `Background sync delayed (${queueSize} pending)`,
              displayStyle: 'toast',
              duration: 3000
            });
          }
        }
      }
    }, 10000); // Check every 10 seconds
  });
};

export const stopBatchProcessing = () => {
  return withErrorHandling(async () => {
    if (batchProcessingInterval) {
      clearInterval(batchProcessingInterval);
      batchProcessingInterval = null;
    }
    
    // Save any pending state
    enhancedProfileCache.destroy();
  });
};

// Cleanup on app termination
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    enhancedProfileCache.destroy();
  });
}
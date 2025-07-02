/**
 * FILE: components/SwipeCards.tsx
 * LAST UPDATED: 2025-07-01 20:30
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes when rendered in discover screen
 * 2. Requires matches-store and user profiles to be loaded
 * 3. Sets up gesture handlers and card animations
 * 4. Parent components depend on swipe events
 * 5. Race condition: Must wait for profile data before rendering
 * 
 * CURRENT STATE:
 * Swipeable card interface for user discovery with:
 * - Smooth gesture animations
 * - Loading and error states
 * - Profile preview and interaction
 * - Stack view with current and next cards
 * 
 * RECENT CHANGES:
 * - Removed automatic prefetching on low profile count
 * - Simplified card stack management to prevent duplicates
 * - Now relies on parent component for profile fetching
 * - Fixed key duplication issues in card rendering
 * 
 * FILE INTERACTIONS:
 * - Imports from: react-native, matches-store, types/user
 * - Exports to: discover screen
 * - Dependencies: react-native-reanimated for animations
 * - Data flow: Bidirectional with matches-store
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - SwipeCards: Main component for card interface
 * - handleSwipe: Processes swipe gestures
 * - renderCard: Renders individual profile cards
 * - handlePrefetch: Manages profile prefetching
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { UserProfile } from '@/types/user';
import { EntrepreneurCard } from './EntrepreneurCard';
import Colors from '@/constants/colors';
import { X, Heart, Star, MessageCircle } from 'lucide-react-native';
import { useMatchesStore } from '@/store/matches-store';
import { useDebugStore } from '@/store/debug-store';
import { useUsageStore } from '@/store/usage-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from './Button';
import * as Haptics from 'expo-haptics';
import { withErrorHandling, ErrorCodes, ErrorCategory } from '@/utils/error-utils';

interface SwipeCardsProps {
  profiles: UserProfile[];
  onSwipeLeft: (profile: UserProfile) => Promise<void>;
  onSwipeRight: (profile: UserProfile) => Promise<void>;
  onEmpty?: () => void;
  onProfilePress: (profile: UserProfile) => void;
  isLoading?: boolean;
  isPrefetching?: boolean;
  error?: string | null;
  onRetry?: () => Promise<void>;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_OUT_DURATION = 250;

export const SwipeCards: React.FC<SwipeCardsProps> = ({
  profiles,
  onSwipeLeft,
  onSwipeRight,
  onEmpty,
  onProfilePress,
  isLoading = false,
  isPrefetching = false,
  error: propError = null,
  onRetry
}) => {
  const { isDebugMode } = useDebugStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderedProfiles, setRenderedProfiles] = useState<Set<string>>(new Set());
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { prefetchNextBatch } = useMatchesStore();
  const { user } = useAuthStore();
  const { getUsageStats, trackUsage } = useUsageStore();

  const position = new Animated.ValueXY();
  const scale = useRef(new Animated.Value(1));
  const opacity = useRef(new Animated.Value(1));
  const rotation = useRef(new Animated.Value(0));

  const prefetchThreshold = 3; // Start prefetching when 3 or fewer profiles remain

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp'
  });
  
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });
  
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.25, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });
  
  const nextCardOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: [1, 0.5, 1],
    extrapolate: 'clamp'
  });
  
  const nextCardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: [1, 0.9, 1],
    extrapolate: 'clamp'
  });
  
  // Reset currentIndex when profiles change
  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      if (isDebugMode) {
        console.log('[SwipeCards] No profiles available');
      }
      return;
    }

    if (currentIndex >= profiles.length) {
      if (isDebugMode) {
        console.log('[SwipeCards] Resetting currentIndex due to profiles change', { 
          oldIndex: currentIndex, 
          profilesCount: profiles.length 
        });
      }
      setCurrentIndex(0);
      setRenderedProfiles(new Set());
    }

    // Validate current profile
    const currentProfile = profiles[currentIndex];
    if (!currentProfile || !currentProfile.id || !currentProfile.name) {
      if (isDebugMode) {
        console.error('[SwipeCards] Invalid profile data:', {
          index: currentIndex,
          hasProfile: !!currentProfile,
          profileData: currentProfile ? {
            id: currentProfile.id,
            name: currentProfile.name,
            keys: Object.keys(currentProfile)
          } : null
        });
      }
      setError('Invalid profile data');
      return;
    }

    // Clear error if we have valid data
    setError(null);
  }, [profiles, currentIndex, isDebugMode]);

  // Debug effect
  useEffect(() => {
    if (isDebugMode) {
      console.log('[SwipeCards] Profiles or index updated', { currentIndex, profilesCount: profiles.length });
    }
  }, [currentIndex, profiles.length, isDebugMode]);
  
  const panResponderHandler = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Only handle horizontal movements greater than 10 units
        return Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < Math.abs(gesture.dx);
      },
      onPanResponderMove: (_, gesture) => {
        // Only allow horizontal movement for swiping
        position.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (error || !profiles[currentIndex]) {
          resetPosition();
          return;
        }

        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      }
    })
  ).current;
  
  const forceSwipe = useCallback((direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: false
    }).start(() => onSwipeComplete(direction));
  }, [position]);
  
  const onSwipeComplete = useCallback((direction: 'left' | 'right') => {
    const item = profiles[currentIndex];
    if (!item) return;

    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      
      // Process the swipe action
      if (direction === 'right') {
        onSwipeRight(item).catch(error => {
          console.error('[SwipeCards] Error on right swipe:', error);
        });
      } else {
        onSwipeLeft(item).catch(error => {
          console.error('[SwipeCards] Error on left swipe:', error);
        });
      }

      // Check if we've reached the end
      if (nextIndex >= profiles.length && onEmpty) {
        if (isDebugMode) {
          console.log('[SwipeCards] Reached end of profiles, triggering onEmpty', { nextIndex, profilesCount: profiles.length });
        }
        onEmpty();
      }

      return nextIndex;
    });
  }, [currentIndex, profiles, onSwipeRight, onSwipeLeft, onEmpty, isDebugMode]);
  
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 4,
      useNativeDriver: false
    }).start();
  };
  
  const handleProfilePress = () => {
    if (currentIndex < profiles.length && onProfilePress) {
      onProfilePress(profiles[currentIndex]);
    }
  };
  
  const renderCards = () => {
    if (isDebugMode) {
      console.log('[SwipeCards] Rendering cards', { currentIndex, profilesCount: profiles.length });
    }
    
    if (currentIndex >= profiles.length) {
      if (isDebugMode) {
        console.log('[SwipeCards] Showing empty state');
      }
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No more entrepreneurs to show</Text>
          <Text style={styles.emptySubtext}>Check back later for new connections</Text>
        </View>
      );
    }
    
    return profiles.map((item, index) => {
      if (index < currentIndex) {
        if (isDebugMode) {
          console.log('[SwipeCards] Skipping rendered profile', { index, id: item.id });
        }
        return null;
      }
      
      if (index === currentIndex) {
        if (isDebugMode) {
          console.log('[SwipeCards] Rendering current card', { index, id: item.id, name: item.name });
        }
        return (
          <Animated.View
            key={item.id}
            style={[
              styles.cardStyle,
              {
                transform: [
                  { translateX: position.x },
                  { rotate }
                ]
              }
            ]}
            {...panResponderHandler}
          >
            <Animated.View style={[styles.likeContainer, { opacity: likeOpacity }]}>
              <Heart size={80} color={Colors.dark.success} />
            </Animated.View>
            
            <Animated.View style={[styles.nopeContainer, { opacity: nopeOpacity }]}>
              <X size={80} color={Colors.dark.error} />
            </Animated.View>
            
            <EntrepreneurCard 
              profile={item} 
              onProfilePress={handleProfilePress}
            />
          </Animated.View>
        );
      }
      
      // Next card in stack
      if (index === currentIndex + 1) {
        if (isDebugMode) {
          console.log('[SwipeCards] Rendering next card', { index, id: item.id, name: item.name });
        }
        return (
          <Animated.View
            key={item.id}
            style={[
              styles.cardStyle,
              {
                opacity: nextCardOpacity,
                transform: [{ scale: nextCardScale }],
                zIndex: -index
              }
            ]}
          >
            <EntrepreneurCard profile={item} />
          </Animated.View>
        );
      }
      
      // Other cards in stack (show max 3)
      if (index < currentIndex + 3) {
        if (isDebugMode) {
          console.log('[SwipeCards] Rendering background card', { index, id: item.id, name: item.name });
        }
        return (
          <Animated.View
            key={item.id}
            style={[
              styles.cardStyle,
              {
                opacity: 0.3,
                transform: [{ scale: 0.8 }],
                zIndex: -index
              }
            ]}
          >
            <EntrepreneurCard profile={item} />
          </Animated.View>
        );
      }
      
      if (isDebugMode) {
        console.log('[SwipeCards] Skipping non-visible card', { index, id: item.id });
      }
      return null;
    }).reverse();
  };
  
  return (
    <View style={styles.container}>
      {renderCards()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStyle: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9 * 1.5,
  },
  likeContainer: {
    position: 'absolute',
    top: 50,
    right: 40,
    zIndex: 1000,
    transform: [{ rotate: '30deg' }]
  },
  nopeContainer: {
    position: 'absolute',
    top: 50,
    left: 40,
    zIndex: 1000,
    transform: [{ rotate: '-30deg' }]
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  }
});
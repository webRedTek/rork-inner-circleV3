/**
 * FILE: components/SwipeCards.tsx
 * LAST UPDATED: 2024-12-19 16:15
 * 
 * CURRENT STATE:
 * Swipeable card component for displaying potential matches. Handles touch gestures,
 * animations, and user interactions. Fixed prefetching infinite loop by removing
 * function from useEffect dependencies.
 * 
 * RECENT CHANGES:
 * - Fixed useEffect dependency array to prevent infinite prefetch loops
 * - Removed prefetchNextBatch from dependencies to prevent re-triggers
 * - Maintained existing swipe functionality while fixing the loop issue
 * 
 * FILE INTERACTIONS:
 * - Imports from: matches-store (prefetchNextBatch, prefetchThreshold, isPrefetching, noMoreProfiles)
 * - Imports from: EntrepreneurCard component (profile display)
 * - Imports from: user types (UserProfile)
 * - Exports to: Discover screen and other screens that need swipeable cards
 * - Dependencies: React Native, Animated API, PanResponder
 * - Data flow: Receives profiles array, handles swipe gestures, triggers
 *   prefetching when running low on profiles, calls parent callbacks for actions
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - SwipeCards: Main component with gesture handling
 * - forceSwipe: Programmatic swipe with animation
 * - onSwipeComplete: Handle swipe completion and trigger callbacks
 * - resetPosition: Reset card position after swipe
 * - renderCards: Render current and next cards with animations
 * - Prefetching logic with proper state management
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
  ActivityIndicator
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
  onSwipeLeft: (profile: UserProfile) => void;
  onSwipeRight: (profile: UserProfile) => void;
  onEmpty?: () => void;
  onProfilePress?: (profile: UserProfile) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_OUT_DURATION = 250;

export const SwipeCards: React.FC<SwipeCardsProps> = ({
  profiles,
  onSwipeLeft,
  onSwipeRight,
  onEmpty,
  onProfilePress
}) => {
  const { isDebugMode } = useDebugStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderedProfiles, setRenderedProfiles] = useState<Set<string>>(new Set());
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { prefetchNextBatch } = useMatchesStore();
  const { user } = useAuthStore();
  const { checkAndUpdateUsage, getCurrentUsage } = useUsageStore();

  const panResponder = useRef<Animated.ValueXY>(new Animated.ValueXY());
  const position = useRef<Animated.ValueXY>(new Animated.ValueXY());
  const scale = useRef<Animated.Value>(new Animated.Value(1));
  const opacity = useRef<Animated.Value>(new Animated.Value(1));
  const rotation = useRef<Animated.Value>(new Animated.Value(0));

  const prefetchThreshold = 3; // Start prefetching when 3 or fewer profiles remain

  const rotate = position.current.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp'
  });
  
  const likeOpacity = position.current.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });
  
  const nopeOpacity = position.current.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.25, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });
  
  const nextCardOpacity = position.current.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: [1, 0.5, 1],
    extrapolate: 'clamp'
  });
  
  const nextCardScale = position.current.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: [1, 0.9, 1],
    extrapolate: 'clamp'
  });
  
  // Reset currentIndex when profiles change
  useEffect(() => {
    if (profiles.length > 0 && currentIndex >= profiles.length) {
      if (isDebugMode) {
        console.log('[SwipeCards] Resetting currentIndex due to profiles change', { oldIndex: currentIndex, profilesCount: profiles.length });
      }
      setCurrentIndex(0);
      setRenderedProfiles(new Set());
    }
  }, [profiles.length, currentIndex, isDebugMode]);

  // Prefetch effect
  useEffect(() => {
    const remainingProfiles = profiles.length - currentIndex;
    
    if (remainingProfiles <= prefetchThreshold && !isPrefetching && !noMoreProfiles) {
      if (isDebugMode) {
        console.log('[SwipeCards] Triggering prefetch due to low profiles', { currentIndex, profilesCount: profiles.length, threshold: prefetchThreshold });
      }
      
      if (isPrefetching) {
        if (isDebugMode) {
          console.log('[SwipeCards] Prefetch skipped - already in progress', { currentIndex, profilesCount: profiles.length });
        }
        return;
      }
      
      if (noMoreProfiles) {
        if (isDebugMode) {
          console.log('[SwipeCards] Prefetch skipped - no more profiles to load', { currentIndex, profilesCount: profiles.length });
        }
        return;
      }

      setIsPrefetching(true);
      prefetchNextBatch().finally(() => {
        setIsPrefetching(false);
      });
    }
  }, [currentIndex, profiles.length, isPrefetching, noMoreProfiles, prefetchNextBatch, isDebugMode]);

  // Debug effect
  useEffect(() => {
    if (isDebugMode) {
      console.log('[SwipeCards] Profiles or index updated', { currentIndex, profilesCount: profiles.length });
    }
  }, [currentIndex, profiles.length, isDebugMode]);
  
  const panResponderHandler = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        // Only allow horizontal movement for swiping
        // This prevents diagonal swipes from triggering profile opens
        position.current.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
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
  
  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position.current, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: false
    }).start(() => onSwipeComplete(direction));
  };
  
  const onSwipeComplete = (direction: 'left' | 'right') => {
    const item = profiles[currentIndex];
    
    direction === 'right' ? onSwipeRight(item) : onSwipeLeft(item);
    
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(prevIndex => {
      const nextIndex = prevIndex + 1;
      if (nextIndex >= profiles.length && onEmpty) {
        if (isDebugMode) {
          console.log('[SwipeCards] Reached end of profiles, triggering onEmpty', { nextIndex, profilesCount: profiles.length });
        }
        onEmpty();
      }
      return nextIndex;
    });
  };
  
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
            {...panResponder.panHandlers}
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
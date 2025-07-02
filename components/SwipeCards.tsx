/**
 * FILE: components/SwipeCards.tsx
 * LAST UPDATED: 2025-07-02 12:00
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
 * - Smooth native-driven animations
 * - Optimized gesture handling with velocity support
 * - Improved performance and responsiveness
 * - Enhanced haptic feedback timing
 * - Fixed error handling for swipe actions
 * 
 * RECENT CHANGES:
 * - Fixed error handling in onSwipeComplete to properly stringify error objects
 * - Improved error logging and user feedback
 * - Maintained all existing animation and gesture functionality
 * 
 * FILE INTERACTIONS:
 * - Imports from: react-native, matches-store, types/user
 * - Exports to: discover screen
 * - Dependencies: react-native-reanimated for animations
 * - Data flow: Bidirectional with matches-store
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - SwipeCards: Main component for card interface
 * - onSwipeComplete: Processes swipe gestures and updates state
 * - forceSwipe: Handles swipe animations with native driver
 * - renderCards: Renders individual profile cards with optimized animations
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  PanResponder, 
  Dimensions,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform
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
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const SWIPE_OUT_DURATION = 300;
const SPRING_CONFIG = {
  tension: 100,
  friction: 8,
  useNativeDriver: true
};
const RESET_SPRING_CONFIG = {
  tension: 120,
  friction: 7,
  useNativeDriver: true
};

// Helper function to safely stringify errors
const getErrorMessage = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object') {
    // Try to extract meaningful error information
    if (error.message) return error.message;
    if (error.error && error.error.message) return error.error.message;
    if (error.details) return String(error.details);
    if (error.code) return `Error code: ${error.code}`;
    
    // Last resort: try to stringify
    try {
      return JSON.stringify(error);
    } catch (e) {
      return 'An error occurred during swipe action';
    }
  }
  
  return String(error);
};

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
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthStore();

  // Optimized animated values with better initial values
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;
  const nextCardOpacity = useRef(new Animated.Value(0.8)).current;

  // Memoized interpolations for better performance
  const animatedStyles = useMemo(() => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      outputRange: ['-15deg', '0deg', '15deg'],
      extrapolate: 'clamp'
    });
    
    const likeOpacity = position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp'
    });
    
    const nopeOpacity = position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp'
    });

    const cardOpacity = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp'
    });

    return {
      rotate,
      likeOpacity,
      nopeOpacity,
      cardOpacity
    };
  }, [position.x]);

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
        // More responsive gesture detection
        const shouldHandle = Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
        return shouldHandle;
      },
      onPanResponderGrant: () => {
        // Add slight haptic feedback when gesture starts
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (_, gesture) => {
        // Smooth gesture tracking with slight Y dampening for more natural feel
        position.setValue({ 
          x: gesture.dx, 
          y: gesture.dy * 0.1 // Dampen vertical movement
        });
      },
      onPanResponderRelease: (_, gesture) => {
        const { dx, vx } = gesture;
        
        if (isDebugMode) {
          console.log('[SwipeCards] Pan gesture released', { 
            dx, 
            vx, 
            threshold: SWIPE_THRESHOLD,
            velocityThreshold: SWIPE_VELOCITY_THRESHOLD 
          });
        }
        
        if (error || !profiles[currentIndex]) {
          if (isDebugMode) {
            console.log('[SwipeCards] Cannot swipe - error or no profile', { error, hasProfile: !!profiles[currentIndex] });
          }
          resetPosition();
          return;
        }

        // Enhanced swipe detection with velocity consideration
        const shouldSwipeRight = dx > SWIPE_THRESHOLD || (dx > 50 && vx > SWIPE_VELOCITY_THRESHOLD);
        const shouldSwipeLeft = dx < -SWIPE_THRESHOLD || (dx < -50 && vx < -SWIPE_VELOCITY_THRESHOLD);

        if (shouldSwipeRight) {
          if (isDebugMode) {
            console.log('[SwipeCards] Swiping right', { dx, vx });
          }
          forceSwipe('right');
        } else if (shouldSwipeLeft) {
          if (isDebugMode) {
            console.log('[SwipeCards] Swiping left', { dx, vx });
          }
          forceSwipe('left');
        } else {
          if (isDebugMode) {
            console.log('[SwipeCards] Gesture below threshold, resetting', { dx, vx });
          }
          resetPosition();
        }
      }
    })
  ).current;
  
  const onSwipeComplete = useCallback((direction: 'left' | 'right') => {
    const item = profiles[currentIndex];
    if (!item) {
      if (isDebugMode) {
        console.log('[SwipeCards] No item to swipe', { currentIndex, profilesCount: profiles.length });
      }
      return;
    }

    if (isDebugMode) {
      console.log('[SwipeCards] Processing swipe', { direction, profileId: item.id, profileName: item.name });
    }

    // Add haptic feedback for successful swipe
    if (Platform.OS !== 'web') {
      const feedbackType = direction === 'right' 
        ? Haptics.ImpactFeedbackStyle.Medium 
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(feedbackType);
    }

    // Process the swipe action first
    const swipePromise = direction === 'right' ? 
      onSwipeRight(item) : 
      onSwipeLeft(item);

    swipePromise
      .then(() => {
        if (isDebugMode) {
          console.log('[SwipeCards] Swipe processed successfully');
        }
        // After swipe is processed, update the index
        setCurrentIndex(prevIndex => {
          const nextIndex = prevIndex + 1;

          // Check if we've reached the end
          if (nextIndex >= profiles.length && onEmpty) {
            if (isDebugMode) {
              console.log('[SwipeCards] Reached end of profiles, triggering onEmpty', { nextIndex, profilesCount: profiles.length });
            }
            onEmpty();
          }

          return nextIndex;
        });

        // Reset position and animate next card
        resetToInitialPosition();
        animateNextCard();
      })
      .catch(error => {
        const errorMessage = getErrorMessage(error);
        console.error(`[SwipeCards] Error on ${direction} swipe:`, errorMessage);
        
        if (isDebugMode) {
          console.error('[SwipeCards] Full error details:', {
            error,
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            direction,
            profileId: item.id,
            profileName: item.name
          });
        }
        
        // Reset position on error
        resetToInitialPosition();
        
        // Set user-friendly error message
        setError(`Failed to ${direction === 'right' ? 'like' : 'pass'} profile. Please try again.`);
      });

  }, [currentIndex, profiles, onSwipeRight, onSwipeLeft, onEmpty, isDebugMode]);
  
  const forceSwipe = useCallback((direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2;
    
    // Animate card out with native driver
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true
    }).start(() => {
      onSwipeComplete(direction);
    });
  }, [position, onSwipeComplete]);
  
  const resetPosition = useCallback(() => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      ...RESET_SPRING_CONFIG
    }).start();
  }, [position]);

  const resetToInitialPosition = useCallback(() => {
    position.setValue({ x: 0, y: 0 });
  }, [position]);

  const animateNextCard = useCallback(() => {
    // Animate the next card into position
    Animated.parallel([
      Animated.spring(nextCardScale, {
        toValue: 1,
        ...SPRING_CONFIG
      }),
      Animated.spring(nextCardOpacity, {
        toValue: 1,
        ...SPRING_CONFIG
      })
    ]).start(() => {
      // Reset next card values for the next animation
      nextCardScale.setValue(0.95);
      nextCardOpacity.setValue(0.8);
    });
  }, [nextCardScale, nextCardOpacity]);
  
  const handleProfilePress = useCallback(() => {
    if (currentIndex < profiles.length && onProfilePress) {
      onProfilePress(profiles[currentIndex]);
    }
  }, [currentIndex, profiles, onProfilePress]);
  
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
                  { translateY: position.y },
                  { rotate: animatedStyles.rotate }
                ],
                opacity: animatedStyles.cardOpacity
              }
            ]}
            {...panResponderHandler.panHandlers}
          >
            <Animated.View style={[styles.likeContainer, { opacity: animatedStyles.likeOpacity }]}>
              <View style={styles.likeLabel}>
                <Heart size={60} color={Colors.dark.success} fill={Colors.dark.success} />
                <Text style={styles.likeText}>LIKE</Text>
              </View>
            </Animated.View>
            
            <Animated.View style={[styles.nopeContainer, { opacity: animatedStyles.nopeOpacity }]}>
              <View style={styles.nopeLabel}>
                <X size={60} color={Colors.dark.error} />
                <Text style={styles.nopeText}>PASS</Text>
              </View>
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
              styles.nextCard,
              {
                transform: [
                  { scale: nextCardScale }
                ],
                opacity: nextCardOpacity
              }
            ]}
          >
            <EntrepreneurCard profile={item} />
          </Animated.View>
        );
      }
      
      // Background cards (show max 2 more)
      if (index < currentIndex + 3) {
        if (isDebugMode) {
          console.log('[SwipeCards] Rendering background card', { index, id: item.id, name: item.name });
        }
        const scaleValue = 0.9 - (index - currentIndex - 1) * 0.05;
        const opacityValue = 0.6 - (index - currentIndex - 1) * 0.2;
        
        return (
          <View
            key={item.id}
            style={[
              styles.cardStyle,
              styles.backgroundCard,
              {
                transform: [{ scale: scaleValue }],
                opacity: opacityValue,
                zIndex: -(index - currentIndex)
              }
            ]}
          >
            <EntrepreneurCard profile={item} />
          </View>
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
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setError(null)}
          >
            <Text style={styles.retryText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
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
  nextCard: {
    zIndex: -1,
  },
  backgroundCard: {
    zIndex: -2,
  },
  likeContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    zIndex: 1000,
    transform: [{ rotate: '15deg' }]
  },
  nopeContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    zIndex: 1000,
    transform: [{ rotate: '-15deg' }]
  },
  likeLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.dark.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  nopeLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.dark.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  likeText: {
    color: Colors.dark.success,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  nopeText: {
    color: Colors.dark.error,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
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
  },
  errorContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.dark.error,
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  errorText: {
    color: Colors.dark.text,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  retryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: 'bold',
  }
});
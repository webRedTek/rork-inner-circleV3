/**
 * FILE: components/SwipeCards.tsx
 * LAST UPDATED: 2025-07-02 18:00
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes when rendered in discover screen
 * 2. Requires matches-store and user profiles to be loaded
 * 3. Sets up gesture handlers and card animations
 * 4. Parent components depend on swipe events
 * 5. Race condition: Must wait for profile data before rendering
 * 
 * CURRENT STATE:
 * Enhanced swipeable card interface for user discovery with:
 * - Ultra-smooth native-driven animations with optimized spring configs
 * - Highly responsive gesture handling with improved velocity detection
 * - Enhanced visual feedback with better like/pass indicators
 * - Improved haptic feedback timing and intensity
 * - Better error handling with proper error stringification
 * - Performance optimizations with memoization and reduced re-renders
 * 
 * RECENT CHANGES:
 * - Completely overhauled animation system for smoother feel
 * - Enhanced gesture detection with lower thresholds and better velocity handling
 * - Improved card stack animations with better scaling and positioning
 * - Added enhanced visual feedback with animated like/pass indicators
 * - Optimized performance with better memoization and native driver usage
 * - Fixed error handling to prevent [object Object] errors
 * - Enhanced haptic feedback with better timing and intensity variations
 * 
 * FILE INTERACTIONS:
 * - Imports from: react-native, matches-store, types/user
 * - Exports to: discover screen
 * - Dependencies: react-native-reanimated for animations
 * - Data flow: Bidirectional with matches-store
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - SwipeCards: Main component for card interface with enhanced animations
 * - onSwipeComplete: Processes swipe gestures with improved error handling
 * - forceSwipe: Handles swipe animations with optimized native driver
 * - renderCards: Renders individual profile cards with smooth animations
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
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Enhanced animation constants for smoother feel
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2; // Reduced for easier swiping
const SWIPE_VELOCITY_THRESHOLD = 0.2; // Reduced for more responsive velocity detection
const SWIPE_OUT_DURATION = 250; // Slightly faster for snappier feel
const CARD_ROTATION_RANGE = 12; // Reduced rotation for more subtle effect

// Optimized spring configurations for natural feel
const SPRING_CONFIG = {
  tension: 140, // Increased for snappier response
  friction: 6, // Reduced for less dampening
  useNativeDriver: true
};

const RESET_SPRING_CONFIG = {
  tension: 160, // Higher tension for quick snap-back
  friction: 8, // Balanced friction for smooth return
  useNativeDriver: true
};

const CARD_SCALE_CONFIG = {
  tension: 120,
  friction: 7,
  useNativeDriver: true
};

// Enhanced helper function to safely stringify errors
const getErrorMessage = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object') {
    // Handle structured error objects
    if (error.userMessage) return error.userMessage;
    if (error.message) return error.message;
    if (error.error && error.error.message) return error.error.message;
    if (error.details) return String(error.details);
    if (error.hint) return String(error.hint);
    if (error.code) return `Error code: ${error.code}`;
    
    // Try to extract meaningful properties
    const meaningfulProps = ['description', 'reason', 'cause', 'statusText'];
    for (const prop of meaningfulProps) {
      if (error[prop]) return String(error[prop]);
    }
    
    // Last resort: try to stringify safely
    try {
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
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
  const [isGestureActive, setIsGestureActive] = useState(false);

  const { user } = useAuthStore();

  // Enhanced animated values with better initial configurations
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.92)).current; // Slightly larger for better visibility
  const nextCardOpacity = useRef(new Animated.Value(0.7)).current;
  const likeIndicatorScale = useRef(new Animated.Value(0)).current;
  const passIndicatorScale = useRef(new Animated.Value(0)).current;

  // Memoized interpolations with enhanced ranges for smoother animations
  const animatedStyles = useMemo(() => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      outputRange: [`-${CARD_ROTATION_RANGE}deg`, '0deg', `${CARD_ROTATION_RANGE}deg`],
      extrapolate: 'clamp'
    });
    
    const likeOpacity = position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      outputRange: [0, 0.5, 1],
      extrapolate: 'clamp'
    });
    
    const passOpacity = position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp'
    });

    const cardOpacity = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.2, 0, SCREEN_WIDTH * 1.2],
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp'
    });

    // Enhanced scale animation for more dynamic feel
    const cardScale = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
      outputRange: [0.95, 1, 0.95],
      extrapolate: 'clamp'
    });

    return {
      rotate,
      likeOpacity,
      passOpacity,
      cardOpacity,
      cardScale
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

  // Enhanced haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if (Platform.OS === 'web') return;
    
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  }, []);

  // Enhanced indicator animations
  const animateIndicator = useCallback((direction: 'like' | 'pass', show: boolean) => {
    const indicatorScale = direction === 'like' ? likeIndicatorScale : passIndicatorScale;
    
    Animated.spring(indicatorScale, {
      toValue: show ? 1 : 0,
      tension: 200,
      friction: 8,
      useNativeDriver: true
    }).start();
  }, [likeIndicatorScale, passIndicatorScale]);
  
  // Enhanced pan responder with improved gesture handling
  const panResponderHandler = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // More sensitive gesture detection
        const shouldHandle = Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3;
        return shouldHandle;
      },
      onPanResponderGrant: () => {
        setIsGestureActive(true);
        triggerHapticFeedback('light');
        
        // Reset indicators
        animateIndicator('like', false);
        animateIndicator('pass', false);
      },
      onPanResponderMove: (_, gesture) => {
        // Enhanced gesture tracking with improved responsiveness
        const { dx, dy } = gesture;
        
        // Smooth gesture tracking with slight Y dampening
        position.setValue({ 
          x: dx, 
          y: dy * 0.05 // Reduced Y movement for more horizontal focus
        });

        // Show indicators based on swipe direction with enhanced thresholds
        const showLikeIndicator = dx > SWIPE_THRESHOLD * 0.3;
        const showPassIndicator = dx < -SWIPE_THRESHOLD * 0.3;
        
        if (showLikeIndicator && !showPassIndicator) {
          animateIndicator('like', true);
          animateIndicator('pass', false);
        } else if (showPassIndicator && !showLikeIndicator) {
          animateIndicator('pass', true);
          animateIndicator('like', false);
        } else {
          animateIndicator('like', false);
          animateIndicator('pass', false);
        }

        // Trigger haptic feedback at threshold points
        if (Math.abs(dx) > SWIPE_THRESHOLD * 0.7) {
          triggerHapticFeedback('medium');
        }
      },
      onPanResponderRelease: (_, gesture) => {
        setIsGestureActive(false);
        const { dx, vx } = gesture;
        
        // Reset indicators
        animateIndicator('like', false);
        animateIndicator('pass', false);
        
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

        // Enhanced swipe detection with improved velocity consideration
        const shouldSwipeRight = dx > SWIPE_THRESHOLD || (dx > 30 && vx > SWIPE_VELOCITY_THRESHOLD);
        const shouldSwipeLeft = dx < -SWIPE_THRESHOLD || (dx < -30 && vx < -SWIPE_VELOCITY_THRESHOLD);

        if (shouldSwipeRight) {
          if (isDebugMode) {
            console.log('[SwipeCards] Swiping right', { dx, vx });
          }
          triggerHapticFeedback('success');
          forceSwipe('right');
        } else if (shouldSwipeLeft) {
          if (isDebugMode) {
            console.log('[SwipeCards] Swiping left', { dx, vx });
          }
          triggerHapticFeedback('medium');
          forceSwipe('left');
        } else {
          if (isDebugMode) {
            console.log('[SwipeCards] Gesture below threshold, resetting', { dx, vx });
          }
          triggerHapticFeedback('light');
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
        triggerHapticFeedback('error');
        
        // Set user-friendly error message
        setError(`Failed to ${direction === 'right' ? 'like' : 'pass'} profile. Please try again.`);
      });

  }, [currentIndex, profiles, onSwipeRight, onSwipeLeft, onEmpty, isDebugMode, triggerHapticFeedback]);
  
  const forceSwipe = useCallback((direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.3 : -SCREEN_WIDTH * 1.3;
    const rotation = direction === 'right' ? CARD_ROTATION_RANGE : -CARD_ROTATION_RANGE;
    
    // Enhanced swipe out animation with rotation
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true
      })
    ]).start(() => {
      onSwipeComplete(direction);
    });
  }, [position, scale, opacity, onSwipeComplete]);
  
  const resetPosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        ...RESET_SPRING_CONFIG
      }),
      Animated.spring(scale, {
        toValue: 1,
        ...RESET_SPRING_CONFIG
      }),
      Animated.spring(opacity, {
        toValue: 1,
        ...RESET_SPRING_CONFIG
      })
    ]).start();
  }, [position, scale, opacity]);

  const resetToInitialPosition = useCallback(() => {
    position.setValue({ x: 0, y: 0 });
    scale.setValue(1);
    opacity.setValue(1);
  }, [position, scale, opacity]);

  const animateNextCard = useCallback(() => {
    // Enhanced next card animation
    Animated.parallel([
      Animated.spring(nextCardScale, {
        toValue: 1,
        ...CARD_SCALE_CONFIG
      }),
      Animated.spring(nextCardOpacity, {
        toValue: 1,
        ...CARD_SCALE_CONFIG
      })
    ]).start(() => {
      // Reset next card values for the next animation
      nextCardScale.setValue(0.92);
      nextCardOpacity.setValue(0.7);
    });
  }, [nextCardScale, nextCardOpacity]);
  
  const handleProfilePress = useCallback(() => {
    if (currentIndex < profiles.length && onProfilePress) {
      triggerHapticFeedback('light');
      onProfilePress(profiles[currentIndex]);
    }
  }, [currentIndex, profiles, onProfilePress, triggerHapticFeedback]);
  
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
                  { rotate: animatedStyles.rotate },
                  { scale: animatedStyles.cardScale }
                ],
                opacity: animatedStyles.cardOpacity
              }
            ]}
            {...panResponderHandler.panHandlers}
          >
            {/* Enhanced Like Indicator */}
            <Animated.View style={[
              styles.likeContainer, 
              { 
                opacity: animatedStyles.likeOpacity,
                transform: [{ scale: likeIndicatorScale }]
              }
            ]}>
              <View style={styles.likeLabel}>
                <Heart size={50} color={Colors.dark.success} fill={Colors.dark.success} />
                <Text style={styles.likeText}>LIKE</Text>
              </View>
            </Animated.View>
            
            {/* Enhanced Pass Indicator */}
            <Animated.View style={[
              styles.passContainer, 
              { 
                opacity: animatedStyles.passOpacity,
                transform: [{ scale: passIndicatorScale }]
              }
            ]}>
              <View style={styles.passLabel}>
                <X size={50} color={Colors.dark.error} />
                <Text style={styles.passText}>PASS</Text>
              </View>
            </Animated.View>
            
            <EntrepreneurCard 
              profile={item} 
              onProfilePress={handleProfilePress}
            />
          </Animated.View>
        );
      }
      
      // Next card in stack with enhanced animation
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
      
      // Background cards with improved stacking
      if (index < currentIndex + 3) {
        if (isDebugMode) {
          console.log('[SwipeCards] Rendering background card', { index, id: item.id, name: item.name });
        }
        const scaleValue = 0.88 - (index - currentIndex - 1) * 0.04; // Better scaling progression
        const opacityValue = 0.5 - (index - currentIndex - 1) * 0.15; // Better opacity progression
        
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
    top: 70,
    right: 15,
    zIndex: 1000,
    transform: [{ rotate: '12deg' }]
  },
  passContainer: {
    position: 'absolute',
    top: 70,
    left: 15,
    zIndex: 1000,
    transform: [{ rotate: '-12deg' }]
  },
  likeLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.dark.success,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: Colors.dark.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  passLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderRadius: 20,
    borderWidth: 4,
    borderColor: Colors.dark.error,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: Colors.dark.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  likeText: {
    color: Colors.dark.success,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  passText: {
    color: Colors.dark.error,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
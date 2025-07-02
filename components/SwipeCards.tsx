/**
 * FILE: components/SwipeCards.tsx
 * LAST UPDATED: 2025-07-02 19:30
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes when rendered in discover screen
 * 2. Requires matches-store and user profiles to be loaded
 * 3. Sets up enhanced gesture handlers and optimized animations
 * 4. Parent components depend on swipe events
 * 5. Race condition: Must wait for profile data before rendering
 * 
 * CURRENT STATE:
 * Simplified swipeable card interface for user discovery with:
 * - Ultra-smooth native-driven animations with optimized spring physics
 * - Highly responsive gesture handling with predictive motion
 * - Enhanced visual feedback with dynamic indicators and micro-interactions
 * - Optimistic UI updates with rollback capability for better UX
 * - Performance optimizations with intelligent memoization and native driver usage
 * - Enhanced haptic feedback with contextual intensity and timing
 * - Removed automatic fetching - only manual refresh
 * 
 * RECENT CHANGES:
 * - Removed all automatic fetching and prefetching logic
 * - Simplified to manual-only operations
 * - Enhanced gesture prediction and velocity-based animations
 * - Improved card stack management with better depth perception
 * - Enhanced visual feedback with dynamic scaling and rotation
 * - Optimized performance with better memoization and reduced re-renders
 * - Added contextual haptic feedback with variable intensity
 * - Implemented gesture momentum and natural physics
 * 
 * FILE INTERACTIONS:
 * - Imports from: react-native, simplified matches-store, types/user
 * - Exports to: discover screen
 * - Dependencies: react-native-reanimated for animations
 * - Data flow: Bidirectional with simplified matches-store
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - SwipeCards: Main component with optimistic updates and enhanced animations
 * - onSwipeComplete: Enhanced swipe processing with rollback capability
 * - forceSwipe: Optimized swipe animations with velocity-based timing
 * - renderCards: Enhanced card rendering with improved stack management
 * - Enhanced gesture handling with predictive motion and momentum
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
  error?: string | null;
  onRetry?: () => Promise<void>;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Enhanced animation constants for ultra-smooth feel
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.15; // Reduced for easier swiping
const SWIPE_VELOCITY_THRESHOLD = 0.15; // More sensitive velocity detection
const SWIPE_OUT_DURATION = 200; // Faster for snappier feel
const CARD_ROTATION_RANGE = 8; // Reduced for more subtle effect

// Optimized spring configurations for natural physics
const SPRING_CONFIG = {
  tension: 180, // Increased for more responsive feel
  friction: 7, // Balanced for smooth motion
  useNativeDriver: true
};

const RESET_SPRING_CONFIG = {
  tension: 200, // Higher tension for quick snap-back
  friction: 9, // Slightly more friction for controlled return
  useNativeDriver: true
};

const CARD_SCALE_CONFIG = {
  tension: 150,
  friction: 8,
  useNativeDriver: true
};

// Velocity-based animation timing
const getVelocityBasedDuration = (velocity: number): number => {
  const baseTime = 200;
  const velocityFactor = Math.min(Math.abs(velocity) * 100, 150);
  return Math.max(baseTime - velocityFactor, 100);
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
  error: propError = null,
  onRetry
}) => {
  const { isDebugMode } = useDebugStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [gestureVelocity, setGestureVelocity] = useState({ x: 0, y: 0 });
  const [lastGestureTime, setLastGestureTime] = useState(0);

  const { user } = useAuthStore();
  const { optimisticUpdates, rollbackOptimisticUpdate } = useMatchesStore();

  // Enhanced animated values with better initial configurations
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.94)).current; // Slightly larger for better visibility
  const nextCardOpacity = useRef(new Animated.Value(0.8)).current;
  const likeIndicatorScale = useRef(new Animated.Value(0)).current;
  const passIndicatorScale = useRef(new Animated.Value(0)).current;
  const cardRotation = useRef(new Animated.Value(0)).current;

  // Gesture momentum tracking
  const gestureHistory = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const maxHistoryLength = 5;

  // Memoized interpolations with enhanced ranges for smoother animations
  const animatedStyles = useMemo(() => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      outputRange: [`-${CARD_ROTATION_RANGE}deg`, '0deg', `${CARD_ROTATION_RANGE}deg`],
      extrapolate: 'clamp'
    });
    
    const likeOpacity = position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD * 0.3, SWIPE_THRESHOLD],
      outputRange: [0, 0.3, 1],
      extrapolate: 'clamp'
    });
    
    const passOpacity = position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.3, 0],
      outputRange: [1, 0.3, 0],
      extrapolate: 'clamp'
    });

    const cardOpacity = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.2, 0, SCREEN_WIDTH * 1.2],
      outputRange: [0.2, 1, 0.2],
      extrapolate: 'clamp'
    });

    // Enhanced scale animation for more dynamic feel
    const cardScale = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 0.4, 0, SCREEN_WIDTH * 0.4],
      outputRange: [0.96, 1, 0.96],
      extrapolate: 'clamp'
    });

    // Dynamic indicator scaling based on swipe distance
    const likeIndicatorDynamicScale = position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD * 1.5],
      outputRange: [0.8, 1, 1.2],
      extrapolate: 'clamp'
    });

    const passIndicatorDynamicScale = position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD * 1.5, -SWIPE_THRESHOLD * 0.5, 0],
      outputRange: [1.2, 1, 0.8],
      extrapolate: 'clamp'
    });

    return {
      rotate,
      likeOpacity,
      passOpacity,
      cardOpacity,
      cardScale,
      likeIndicatorDynamicScale,
      passIndicatorDynamicScale
    };
  }, [position.x]);

  // Reset currentIndex when profiles change
  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      if (isDebugMode) {
        console.log('[SimplifiedSwipeCards] No profiles available');
      }
      return;
    }

    if (currentIndex >= profiles.length) {
      if (isDebugMode) {
        console.log('[SimplifiedSwipeCards] Resetting currentIndex due to profiles change', { 
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
        console.error('[SimplifiedSwipeCards] Invalid profile data:', {
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

  // Enhanced haptic feedback function with contextual intensity
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection') => {
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
      case 'selection':
        Haptics.selectionAsync();
        break;
    }
  }, []);

  // Enhanced indicator animations with dynamic scaling
  const animateIndicator = useCallback((direction: 'like' | 'pass', show: boolean, intensity: number = 1) => {
    const indicatorScale = direction === 'like' ? likeIndicatorScale : passIndicatorScale;
    const targetScale = show ? intensity : 0;
    
    Animated.spring(indicatorScale, {
      toValue: targetScale,
      tension: 250,
      friction: 8,
      useNativeDriver: true
    }).start();
  }, [likeIndicatorScale, passIndicatorScale]);

  // Calculate gesture momentum
  const calculateMomentum = useCallback((currentX: number, currentY: number): { x: number; y: number } => {
    const now = Date.now();
    gestureHistory.current.push({ x: currentX, y: currentY, time: now });
    
    // Keep only recent history
    if (gestureHistory.current.length > maxHistoryLength) {
      gestureHistory.current.shift();
    }
    
    if (gestureHistory.current.length < 2) {
      return { x: 0, y: 0 };
    }
    
    const recent = gestureHistory.current.slice(-3);
    const timeSpan = recent[recent.length - 1].time - recent[0].time;
    
    if (timeSpan === 0) return { x: 0, y: 0 };
    
    const deltaX = recent[recent.length - 1].x - recent[0].x;
    const deltaY = recent[recent.length - 1].y - recent[0].y;
    
    return {
      x: deltaX / timeSpan * 1000, // pixels per second
      y: deltaY / timeSpan * 1000
    };
  }, []);
  
  // Enhanced pan responder with improved gesture handling and momentum
  const panResponderHandler = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // More sensitive gesture detection with momentum consideration
        const shouldHandle = Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2;
        return shouldHandle;
      },
      onPanResponderGrant: () => {
        setIsGestureActive(true);
        setLastGestureTime(Date.now());
        gestureHistory.current = [];
        triggerHapticFeedback('selection');
        
        // Reset indicators
        animateIndicator('like', false);
        animateIndicator('pass', false);
      },
      onPanResponderMove: (_, gesture) => {
        // Enhanced gesture tracking with momentum calculation
        const { dx, dy } = gesture;
        const momentum = calculateMomentum(dx, dy);
        setGestureVelocity(momentum);
        
        // Smooth gesture tracking with enhanced Y dampening
        position.setValue({ 
          x: dx, 
          y: dy * 0.03 // Further reduced Y movement for more horizontal focus
        });

        // Enhanced indicator logic with dynamic intensity
        const swipeIntensity = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1.5);
        const showLikeIndicator = dx > SWIPE_THRESHOLD * 0.2;
        const showPassIndicator = dx < -SWIPE_THRESHOLD * 0.2;
        
        if (showLikeIndicator && !showPassIndicator) {
          animateIndicator('like', true, 0.8 + swipeIntensity * 0.4);
          animateIndicator('pass', false);
          
          // Progressive haptic feedback
          if (dx > SWIPE_THRESHOLD * 0.6 && Date.now() - lastGestureTime > 100) {
            triggerHapticFeedback('light');
            setLastGestureTime(Date.now());
          }
        } else if (showPassIndicator && !showLikeIndicator) {
          animateIndicator('pass', true, 0.8 + swipeIntensity * 0.4);
          animateIndicator('like', false);
          
          // Progressive haptic feedback
          if (dx < -SWIPE_THRESHOLD * 0.6 && Date.now() - lastGestureTime > 100) {
            triggerHapticFeedback('light');
            setLastGestureTime(Date.now());
          }
        } else {
          animateIndicator('like', false);
          animateIndicator('pass', false);
        }

        // Threshold haptic feedback
        if (Math.abs(dx) > SWIPE_THRESHOLD * 0.8 && Date.now() - lastGestureTime > 200) {
          triggerHapticFeedback('medium');
          setLastGestureTime(Date.now());
        }
      },
      onPanResponderRelease: (_, gesture) => {
        setIsGestureActive(false);
        const { dx, vx } = gesture;
        const momentum = gestureVelocity;
        
        // Reset indicators
        animateIndicator('like', false);
        animateIndicator('pass', false);
        
        if (isDebugMode) {
          console.log('[SimplifiedSwipeCards] Pan gesture released', { 
            dx, 
            vx, 
            momentum,
            threshold: SWIPE_THRESHOLD,
            velocityThreshold: SWIPE_VELOCITY_THRESHOLD 
          });
        }
        
        if (error || !profiles[currentIndex]) {
          if (isDebugMode) {
            console.log('[SimplifiedSwipeCards] Cannot swipe - error or no profile', { error, hasProfile: !!profiles[currentIndex] });
          }
          resetPosition();
          return;
        }

        // Enhanced swipe detection with momentum consideration
        const velocityBoost = Math.abs(momentum.x) > 300 ? 1.5 : 1;
        const effectiveThreshold = SWIPE_THRESHOLD / velocityBoost;
        
        const shouldSwipeRight = dx > effectiveThreshold || 
          (dx > 20 && (vx > SWIPE_VELOCITY_THRESHOLD || momentum.x > 200));
        const shouldSwipeLeft = dx < -effectiveThreshold || 
          (dx < -20 && (vx < -SWIPE_VELOCITY_THRESHOLD || momentum.x < -200));

        if (shouldSwipeRight) {
          if (isDebugMode) {
            console.log('[SimplifiedSwipeCards] Swiping right', { dx, vx, momentum });
          }
          triggerHapticFeedback('success');
          forceSwipe('right', Math.abs(vx));
        } else if (shouldSwipeLeft) {
          if (isDebugMode) {
            console.log('[SimplifiedSwipeCards] Swiping left', { dx, vx, momentum });
          }
          triggerHapticFeedback('medium');
          forceSwipe('left', Math.abs(vx));
        } else {
          if (isDebugMode) {
            console.log('[SimplifiedSwipeCards] Gesture below threshold, resetting', { dx, vx, momentum });
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
        console.log('[SimplifiedSwipeCards] No item to swipe', { currentIndex, profilesCount: profiles.length });
      }
      return;
    }

    if (isDebugMode) {
      console.log('[SimplifiedSwipeCards] Processing swipe', { direction, profileId: item.id, profileName: item.name });
    }

    // Check if this is an optimistic update that failed
    const optimisticUpdate = optimisticUpdates.get(item.id);
    if (optimisticUpdate) {
      // This was an optimistic update, just update the index
      setCurrentIndex(prevIndex => {
        const nextIndex = prevIndex + 1;

        if (nextIndex >= profiles.length && onEmpty) {
          if (isDebugMode) {
            console.log('[SimplifiedSwipeCards] Reached end of profiles, triggering onEmpty', { nextIndex, profilesCount: profiles.length });
          }
          onEmpty();
        }

        return nextIndex;
      });

      resetToInitialPosition();
      animateNextCard();
      return;
    }

    // Process the swipe action
    const swipePromise = direction === 'right' ? 
      onSwipeRight(item) : 
      onSwipeLeft(item);

    swipePromise
      .then(() => {
        if (isDebugMode) {
          console.log('[SimplifiedSwipeCards] Swipe processed successfully');
        }
        
        setCurrentIndex(prevIndex => {
          const nextIndex = prevIndex + 1;

          if (nextIndex >= profiles.length && onEmpty) {
            if (isDebugMode) {
              console.log('[SimplifiedSwipeCards] Reached end of profiles, triggering onEmpty', { nextIndex, profilesCount: profiles.length });
            }
            onEmpty();
          }

          return nextIndex;
        });

        resetToInitialPosition();
        animateNextCard();
      })
      .catch(error => {
        const errorMessage = getErrorMessage(error);
        console.error(`[SimplifiedSwipeCards] Error on ${direction} swipe:`, errorMessage);
        
        if (isDebugMode) {
          console.error('[SimplifiedSwipeCards] Full error details:', {
            error,
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
            direction,
            profileId: item.id,
            profileName: item.name
          });
        }
        
        // Rollback optimistic update if it exists
        rollbackOptimisticUpdate(item.id);
        
        // Reset position on error
        resetToInitialPosition();
        triggerHapticFeedback('error');
        
        // Set user-friendly error message
        setError(`Failed to ${direction === 'right' ? 'like' : 'pass'} profile. Please try again.`);
      });

  }, [currentIndex, profiles, onSwipeRight, onSwipeLeft, onEmpty, isDebugMode, triggerHapticFeedback, optimisticUpdates, rollbackOptimisticUpdate]);
  
  const forceSwipe = useCallback((direction: 'left' | 'right', velocity: number = 0) => {
    const x = direction === 'right' ? SCREEN_WIDTH * 1.3 : -SCREEN_WIDTH * 1.3;
    const duration = getVelocityBasedDuration(velocity);
    
    // Enhanced swipe out animation with velocity-based timing
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x, y: 0 },
        duration,
        useNativeDriver: true
      }),
      Animated.timing(scale, {
        toValue: 0.85,
        duration,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: duration * 0.8, // Fade out slightly faster
        useNativeDriver: true
      }),
      Animated.timing(cardRotation, {
        toValue: direction === 'right' ? 1 : -1,
        duration,
        useNativeDriver: true
      })
    ]).start(() => {
      onSwipeComplete(direction);
    });
  }, [position, scale, opacity, cardRotation, onSwipeComplete]);
  
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
      }),
      Animated.spring(cardRotation, {
        toValue: 0,
        ...RESET_SPRING_CONFIG
      })
    ]).start();
  }, [position, scale, opacity, cardRotation]);

  const resetToInitialPosition = useCallback(() => {
    position.setValue({ x: 0, y: 0 });
    scale.setValue(1);
    opacity.setValue(1);
    cardRotation.setValue(0);
  }, [position, scale, opacity, cardRotation]);

  const animateNextCard = useCallback(() => {
    // Enhanced next card animation with better timing
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
      nextCardScale.setValue(0.94);
      nextCardOpacity.setValue(0.8);
    });
  }, [nextCardScale, nextCardOpacity]);
  
  const handleProfilePress = useCallback(() => {
    if (currentIndex < profiles.length && onProfilePress) {
      triggerHapticFeedback('selection');
      onProfilePress(profiles[currentIndex]);
    }
  }, [currentIndex, profiles, onProfilePress, triggerHapticFeedback]);
  
  const renderCards = () => {
    if (isDebugMode) {
      console.log('[SimplifiedSwipeCards] Rendering cards', { currentIndex, profilesCount: profiles.length });
    }
    
    if (currentIndex >= profiles.length) {
      if (isDebugMode) {
        console.log('[SimplifiedSwipeCards] Showing empty state');
      }
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No more entrepreneurs to show</Text>
          <Text style={styles.emptySubtext}>Press refresh to load more profiles</Text>
          {onRetry && (
            <Button
              title="Refresh"
              onPress={onRetry}
              variant="primary"
              style={styles.retryButton}
            />
          )}
        </View>
      );
    }
    
    return profiles.map((item, index) => {
      if (index < currentIndex) {
        if (isDebugMode) {
          console.log('[SimplifiedSwipeCards] Skipping rendered profile', { index, id: item.id });
        }
        return null;
      }
      
      // Check if this profile has an optimistic update
      const hasOptimisticUpdate = optimisticUpdates.has(item.id);
      
      if (index === currentIndex) {
        if (isDebugMode) {
          console.log('[SimplifiedSwipeCards] Rendering current card', { 
            index, 
            id: item.id, 
            name: item.name,
            hasOptimisticUpdate 
          });
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
              },
              hasOptimisticUpdate && styles.optimisticCard
            ]}
            {...panResponderHandler.panHandlers}
          >
            {/* Enhanced Like Indicator */}
            <Animated.View style={[
              styles.likeContainer, 
              { 
                opacity: animatedStyles.likeOpacity,
                transform: [
                  { scale: Animated.multiply(likeIndicatorScale, animatedStyles.likeIndicatorDynamicScale) }
                ]
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
                transform: [
                  { scale: Animated.multiply(passIndicatorScale, animatedStyles.passIndicatorDynamicScale) }
                ]
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
          console.log('[SimplifiedSwipeCards] Rendering next card', { index, id: item.id, name: item.name });
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
      
      // Background cards with improved stacking and depth
      if (index < currentIndex + 4) { // Show more background cards
        if (isDebugMode) {
          console.log('[SimplifiedSwipeCards] Rendering background card', { index, id: item.id, name: item.name });
        }
        const cardDepth = index - currentIndex - 1;
        const scaleValue = 0.90 - cardDepth * 0.03; // Better scaling progression
        const opacityValue = 0.6 - cardDepth * 0.15; // Better opacity progression
        const translateY = cardDepth * 4; // Slight vertical offset for depth
        
        return (
          <View
            key={item.id}
            style={[
              styles.cardStyle,
              styles.backgroundCard,
              {
                transform: [
                  { scale: scaleValue },
                  { translateY }
                ],
                opacity: opacityValue,
                zIndex: -(cardDepth + 1)
              }
            ]}
          >
            <EntrepreneurCard profile={item} />
          </View>
        );
      }
      
      if (isDebugMode) {
        console.log('[SimplifiedSwipeCards] Skipping non-visible card', { index, id: item.id });
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
  optimisticCard: {
    opacity: 0.8, // Slightly transparent for optimistic updates
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
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: Colors.dark.success,
    paddingVertical: 18,
    paddingHorizontal: 22,
    shadowColor: Colors.dark.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  passLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: Colors.dark.error,
    paddingVertical: 18,
    paddingHorizontal: 22,
    shadowColor: Colors.dark.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  likeText: {
    color: Colors.dark.success,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  passText: {
    color: Colors.dark.error,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    marginBottom: 20,
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
    marginTop: 8,
  },
  retryText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: 'bold',
  }
});
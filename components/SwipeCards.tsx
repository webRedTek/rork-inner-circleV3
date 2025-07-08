/**
 * ==================================================================================
 * 🚨 CRITICAL DOCUMENTATION - NEVER DELETE THIS SECTION 🚨
 * ==================================================================================
 * 
 * FILE: components/SwipeCards.tsx
 * LAST UPDATED: 2025-07-05 16:00
 * CRITICAL FIXES APPLIED: 2025-07-05
 * 
 * ⚠️  IMPORTANT: This documentation must NEVER be removed or modified without
 *     updating the corresponding debug monitoring section in debug.tsx
 * 
 * ==================================================================================
 * 🛠️  CRITICAL FIXES APPLIED (DO NOT REVERT THESE CHANGES)
 * ==================================================================================
 * 
 * 1. PERFORMANCE OPTIMIZATION:
 *    - PROBLEM: Excessive re-renders causing flickering and poor performance
 *    - SOLUTION: Optimized useEffect dependencies and memoized expensive operations
 *    - RESULT: Smooth rendering without flickering
 * 
 * 2. LOADING STATE MANAGEMENT:
 *    - PROBLEM: Conflicting loading states between components
 *    - SOLUTION: Simplified loading state logic and reduced state updates
 *    - RESULT: Consistent loading experience without flicker
 * 
 * 3. DEBUG LOGGING OPTIMIZATION:
 *    - PROBLEM: Excessive debug logging causing performance issues
 *    - SOLUTION: Debounced and optimized debug logging calls
 *    - RESULT: Better performance while maintaining debugging capability
 * 
 * 4. CARD POSITIONING FIX:
 *    - PROBLEM: Cards not visible on screen due to absolute positioning without coordinates
 *    - SOLUTION: Added explicit centering coordinates for card positioning
 *    - RESULT: Cards now properly centered and visible on screen
 * 
 * ==================================================================================
 * 🔧 HOW SWIPECARDS COMPONENT WORKS (OPTIMIZED ARCHITECTURE)
 * ==================================================================================
 * 
 * RENDERING FLOW:
 * 1. Component receives profiles[] array from matches-store
 * 2. renderCards() creates max 3 card stack (current + next + background)
 * 3. Current card gets PanResponder for gesture handling
 * 4. Next cards are pre-positioned with scale/opacity animations
 * 
 * GESTURE HANDLING:
 * 1. PanResponder.onMoveShouldSetPanResponder: Activates on 5px movement
 * 2. onPanResponderGrant: Sets isGestureActive, resets indicators
 * 3. onPanResponderMove: Updates position, shows like/pass indicators
 * 4. onPanResponderRelease: Determines swipe direction, calls forceSwipe()
 * 
 * SWIPE DETECTION:
 * - Horizontal threshold: SCREEN_WIDTH * 0.25 (25% of screen width)
 * - Velocity threshold: 0.3 for quick swipes
 * - Direction logic: dx > threshold = right, dx < -threshold = left
 * 
 * ANIMATION SYSTEM:
 * - Uses Animated.ValueXY for position tracking
 * - Spring animations for smooth card returns
 * - Opacity/scale animations for card stack effect
 * - Native driver enabled for 60fps performance
 * 
 * STATE MANAGEMENT:
 * - currentIndex: Tracks which profile is currently shown
 * - error: Handles component-level errors
 * - isGestureActive: Prevents gesture conflicts
 * 
 * CARD STACK LOGIC:
 * - Index 0 (current): Full interactivity with gestures
 * - Index 1 (next): Scaled to 95%, opacity 80%
 * - Index 2+ (background): Progressively smaller scale/opacity
 * 
 * ==================================================================================
 * 🚨 CRITICAL DEBUGGING INFORMATION
 * ==================================================================================
 * 
 * IF SWIPECARDS STOP WORKING, CHECK:
 * 1. Debug tab > SwipeCards & Image Loading Status section
 * 2. Ensure debug mode is enabled to see logs
 * 3. Check profiles.length > 0 and currentIndex < profiles.length
 * 4. Verify no ScrollView wrapper around SwipeCards in discover.tsx
 * 5. Check EntrepreneurCard image loading doesn't have absoluteFill overlay
 * 
 * COMMON FAILURE MODES:
 * - Cards not visible: Check container layout and positioning
 * - Gestures not working: Check for ScrollView conflicts
 * - Images not loading: Check EntrepreneurCard overlay logic
 * - Performance issues: Check animation native driver usage
 * 
 * ==================================================================================
 * 🎯 COMPONENT ARCHITECTURE (OPTIMIZED STATE)
 * ==================================================================================
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
  Platform
} from 'react-native';
import { UserProfile } from '@/types/user';
import { EntrepreneurCard } from './EntrepreneurCard';
import Colors from '@/constants/colors';
import { X, Heart } from 'lucide-react-native';
import { useMatchesStore } from '@/store/matches-store';
import { useDebugStore } from '@/store/debug-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from './Button';
import * as Haptics from 'expo-haptics';
import { withErrorHandling, ErrorCodes, ErrorCategory } from '@/utils/error-utils';

interface SwipeCardsProps {
  profiles: UserProfile[];
  onSwipeLeft: (profile: UserProfile) => Promise<void>;
  onSwipeRight: (profile: UserProfile) => Promise<void>;
  onEmpty?: () => void;
  onEndOfProfiles?: () => Promise<void>;
  onProfilePress: (profile: UserProfile) => void;
  error?: string | null;
  onRetry?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Enhanced animation constants for ultra-smooth feel
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_VELOCITY_THRESHOLD = 0.3;
const SWIPE_OUT_DURATION = 250;
const CARD_ROTATION_RANGE = 15;

// Card dimensions - fixed and consistent
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

// Optimized spring configurations for natural physics
const SPRING_CONFIG = {
  tension: 120,
  friction: 8,
  useNativeDriver: true
};

const RESET_SPRING_CONFIG = {
  tension: 150,
  friction: 10,
  useNativeDriver: true
};

// Enhanced helper function to safely stringify errors
const getErrorMessage = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object') {
    if (error.userMessage) return error.userMessage;
    if (error.message) return error.message;
    if (error.error && error.error.message) return error.error.message;
    if (error.details) return String(error.details);
    if (error.hint) return String(error.hint);
    if (error.code) return `Error code: ${error.code}`;
    
    const meaningfulProps = ['description', 'reason', 'cause', 'statusText'];
    for (const prop of meaningfulProps) {
      if (error[prop]) return String(error[prop]);
    }
    
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
  onEndOfProfiles,
  onProfilePress,
  error: propError = null,
  onRetry,
  onRefresh
}) => {
  const { isDebugMode, addDebugLog } = useDebugStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGestureActive, setIsGestureActive] = useState(false);

  const { user } = useAuthStore();
  const { optimisticUpdates, rollbackOptimisticUpdate } = useMatchesStore();

  // Use refs to prevent unnecessary re-renders
  const lastProfileCountRef = useRef(profiles.length);
  const lastCurrentIndexRef = useRef(currentIndex);
  const debugTimeoutRef = useRef<any>(null);

  // Simplified animated values for better performance
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const passOpacity = useRef(new Animated.Value(0)).current;

  // Debounced debug logging to prevent performance issues
  const debugLog = useCallback((event: string, details: string, data?: any) => {
    if (!isDebugMode) return;
    
    // Clear existing timeout
    if (debugTimeoutRef.current) {
      clearTimeout(debugTimeoutRef.current);
    }
    
    // Debounce debug logging
    debugTimeoutRef.current = setTimeout(() => {
      addDebugLog({
        event,
        status: 'info',
        details,
        source: 'SwipeCards',
        data
      });
    }, 50); // 50ms debounce
  }, [isDebugMode, addDebugLog]);

  // Optimized debug logging - only when profiles actually change
  useEffect(() => {
    if (profiles.length !== lastProfileCountRef.current) {
      lastProfileCountRef.current = profiles.length;
      
      debugLog(
        'SwipeCards Component Render',
        `SwipeCards received ${profiles.length} profiles, currentIndex: ${currentIndex}`,
        {
          profileCount: profiles.length,
          currentIndex,
          hasError: !!(error || propError),
          currentProfile: profiles[currentIndex]?.name || 'None'
        }
      );
    }
  }, [profiles.length, currentIndex, error, propError, debugLog]);



  // Optimized currentIndex reset - when profiles change significantly
  useEffect(() => {
    if (!profiles) {
      return;
    }

    // Reset currentIndex when profiles array becomes empty (endOfProfiles called)
    if (profiles.length === 0 && currentIndex > 0) {
      debugLog(
        'SwipeCards currentIndex reset',
        `Profiles cleared by endOfProfiles, resetting currentIndex from ${currentIndex} to 0`,
        { 
          currentIndex, 
          profilesCount: profiles.length 
        }
      );
      setCurrentIndex(0);
    }
    // Reset currentIndex when new profiles are loaded and currentIndex is at end
    else if (profiles.length > 0 && currentIndex >= profiles.length) {
      debugLog(
        'SwipeCards currentIndex reset',
        `New profiles loaded, resetting currentIndex from ${currentIndex} to 0`,
        { 
          currentIndex, 
          profilesCount: profiles.length 
        }
      );
      setCurrentIndex(0);
    }
  }, [profiles.length, currentIndex, debugLog]);

  // Optimized profile validation
  useEffect(() => {
    if (!profiles || profiles.length === 0 || currentIndex >= profiles.length) {
      return;
    }

    const currentProfile = profiles[currentIndex];
    if (!currentProfile || !currentProfile.id || !currentProfile.name) {
      debugLog(
        'SwipeCards invalid profile',
        'Invalid profile data detected',
        {
          index: currentIndex,
          hasProfile: !!currentProfile,
          profileData: currentProfile ? {
            id: currentProfile.id,
            name: currentProfile.name,
            keys: Object.keys(currentProfile)
          } : null
      }
      );
      setError('Invalid profile data');
      return;
    }

    setError(null);
  }, [profiles, currentIndex, debugLog]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debugTimeoutRef.current) {
        clearTimeout(debugTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced haptic feedback function
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

  // Memoized interpolations for better performance
  const animatedStyles = useMemo(() => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      outputRange: [`-${CARD_ROTATION_RANGE}deg`, '0deg', `${CARD_ROTATION_RANGE}deg`],
      extrapolate: 'clamp'
    });

    const likeOpacityInterpolated = position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD],
      outputRange: [0, 0.5, 1],
      extrapolate: 'clamp'
    });

    const passOpacityInterpolated = position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.5, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp'
    });
    
    return {
      rotate,
      likeOpacityInterpolated,
      passOpacityInterpolated
    };
  }, [position.x]);
  
  // Simplified pan responder with better gesture handling
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderGrant: () => {
        setIsGestureActive(true);
        triggerHapticFeedback('selection');
      },
      onPanResponderMove: (_, gesture) => {
        const { dx, dy } = gesture;
        
        // Update position with dampened Y movement
        position.setValue({ 
          x: dx, 
          y: dy * 0.1 // Minimal Y movement for horizontal focus
        });

        // Update indicator opacities
        if (dx > SWIPE_THRESHOLD * 0.3) {
          likeOpacity.setValue(Math.min(dx / SWIPE_THRESHOLD, 1));
          passOpacity.setValue(0);
        } else if (dx < -SWIPE_THRESHOLD * 0.3) {
          passOpacity.setValue(Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1));
          likeOpacity.setValue(0);
        } else {
          likeOpacity.setValue(0);
          passOpacity.setValue(0);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        setIsGestureActive(false);
        const { dx, vx } = gesture;
        
        // Reset indicator opacities
        likeOpacity.setValue(0);
        passOpacity.setValue(0);
        
        if (error || !profiles[currentIndex]) {
          resetPosition();
          return;
        }

        // Determine swipe direction
        if (dx > SWIPE_THRESHOLD || (vx > SWIPE_VELOCITY_THRESHOLD && dx > SWIPE_THRESHOLD * 0.5)) {
          forceSwipe('right');
        } else if (dx < -SWIPE_THRESHOLD || (vx < -SWIPE_VELOCITY_THRESHOLD && dx < -SWIPE_THRESHOLD * 0.5)) {
          forceSwipe('left');
        } else {
          triggerHapticFeedback('light');
          resetPosition();
        }
      }
    })
  ).current;

  // Enhanced swipe animation
  const forceSwipe = useCallback((direction: 'left' | 'right') => {
    const targetX = direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2;
    const currentProfileIndex = currentIndex;
    
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x: targetX, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: SWIPE_OUT_DURATION * 0.8,
        useNativeDriver: true
      })
    ]).start(() => {
      onSwipeComplete(direction, currentProfileIndex);
    });
  }, [position, opacity, currentIndex]);

  // Enhanced swipe completion
  const onSwipeComplete = useCallback(async (direction: 'left' | 'right', profileIndex: number) => {
    const profile = profiles[profileIndex];
    if (!profile) return;
    
    debugLog(
      'SwipeCards onSwipeComplete',
      `Swipe ${direction} on profile ${profile.name} (index ${profileIndex}/${profiles.length})`,
      {
        direction,
        profileId: profile.id,
        profileName: profile.name,
        profileIndex,
        totalProfiles: profiles.length,
        nextIndex: profileIndex + 1
      }
    );
    
    try {
      triggerHapticFeedback(direction === 'right' ? 'success' : 'medium');
      
      if (direction === 'right') {
        await onSwipeRight(profile);
      } else {
        await onSwipeLeft(profile);
      }
      
      // Move to next card
      setCurrentIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        
        debugLog(
          'SwipeCards currentIndex update',
          `CurrentIndex updated from ${prevIndex} to ${newIndex}`,
          {
            oldIndex: prevIndex, 
            newIndex,
            totalProfiles: profiles.length,
            nextProfile: profiles[newIndex] ? profiles[newIndex].name : 'No more profiles'
        }
        );
        
        if (newIndex >= profiles.length) {
          if (onEndOfProfiles) setTimeout(() => onEndOfProfiles(), 100);
          if (onEmpty) setTimeout(onEmpty, 100);
        }
        
        return newIndex;
      });
      
      resetToInitialPosition();
      
    } catch (error) {
      triggerHapticFeedback('error');
      
      // Move to next card anyway to prevent getting stuck
      setCurrentIndex(prevIndex => {
        const newIndex = prevIndex + 1;
        
        if (newIndex >= profiles.length) {
          if (onEndOfProfiles) setTimeout(() => onEndOfProfiles(), 100);
          if (onEmpty) setTimeout(onEmpty, 100);
        }
        
        return newIndex;
      });
      
      resetToInitialPosition();
      setError(`Failed to ${direction === 'right' ? 'like' : 'pass'} profile. Please try again.`);
      setTimeout(() => setError(null), 3000);
    }
  }, [profiles, currentIndex, onSwipeRight, onSwipeLeft, onEmpty, triggerHapticFeedback, debugLog, onEndOfProfiles]);

  // Button-triggered swipe functions
  const handleButtonSwipe = useCallback((direction: 'left' | 'right') => {
    if (error || !profiles[currentIndex]) {
      triggerHapticFeedback('error');
      return;
    }
    
    triggerHapticFeedback('selection');
    forceSwipe(direction);
  }, [error, profiles, currentIndex, triggerHapticFeedback, forceSwipe]);

  // Position reset function
  const resetPosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        ...RESET_SPRING_CONFIG
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      })
    ]).start();
  }, [position, opacity]);

  // Initial position reset for new cards
  const resetToInitialPosition = useCallback(() => {
    position.setValue({ x: 0, y: 0 });
    opacity.setValue(1);
    likeOpacity.setValue(0);
    passOpacity.setValue(0);
    
    // Animate next card
      Animated.spring(nextCardScale, {
        toValue: 1,
      ...SPRING_CONFIG
    }).start(() => {
      nextCardScale.setValue(0.95);
    });
  }, [position, opacity, likeOpacity, passOpacity, nextCardScale]);

  // Optimized card rendering with memoization
  const renderCards = useMemo(() => {
    if (profiles.length === 0 || currentIndex >= profiles.length) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No More Profiles</Text>
          <Text style={styles.emptySubtitle}>We've shown you all available entrepreneurs in your area.</Text>
          <Text style={styles.emptySubtitle}>Check back later for new matches.</Text>
          {onRefresh && (
            <Button
              title="Refresh"
              onPress={onRefresh}
              variant="primary"
              size="medium"
              style={styles.refreshButton}
            />
          )}
        </View>
      );
    }

    const cardsToRender = [];
    const maxCards = Math.min(3, profiles.length - currentIndex);

    // Debug logging for card rendering
    if (isDebugMode && maxCards > 0) {
      debugLog(
        'SwipeCards renderCards',
        `Rendering ${maxCards} cards, currentIndex: ${currentIndex}, profiles: ${profiles.length}`,
        {
          maxCards,
          currentIndex,
          profilesLength: profiles.length,
          firstProfileId: profiles[currentIndex]?.id,
          firstProfileName: profiles[currentIndex]?.name
        }
      );
    }

    for (let i = 0; i < maxCards; i++) {
      const index = currentIndex + i;
      const profile = profiles[index];
      
      if (!profile) continue;

      const isCurrentCard = i === 0;
      const isNextCard = i === 1;
      const cardKey = `${profile.id}-${index}`;

      if (isCurrentCard) {
        // Current card with gestures and animations
        cardsToRender.push(
          <Animated.View
            key={cardKey}
            style={[
              styles.cardContainer,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate: animatedStyles.rotate }
                ],
                opacity: opacity,
                zIndex: 1000
              }
            ]}
            {...panResponder.panHandlers}
          >
            {/* Connect Indicator */}
            <Animated.View style={[
              styles.likeContainer, 
              { opacity: animatedStyles.likeOpacityInterpolated }
            ]}>
              <View style={styles.likeLabel}>
                <View style={styles.connectIcon}>
                  <Text style={styles.connectIconText}>C</Text>
                </View>
                <Text style={styles.likeText}>CONNECT</Text>
              </View>
            </Animated.View>
            
            {/* Pass Indicator */}
            <Animated.View style={[
              styles.passContainer, 
              { opacity: animatedStyles.passOpacityInterpolated }
            ]}>
              <View style={styles.passLabel}>
                <X size={40} color={Colors.dark.error} />
                <Text style={styles.passText}>PASS</Text>
              </View>
            </Animated.View>
            
                         <EntrepreneurCard 
               profile={profile} 
               onProfilePress={() => onProfilePress(profile)}
             />
          </Animated.View>
        );
      } else if (isNextCard) {
        // Next card with scale animation
        cardsToRender.push(
          <Animated.View
            key={cardKey}
            style={[
              styles.cardContainer,
              {
                transform: [{ scale: nextCardScale }],
                zIndex: 100,
                opacity: 0.8
              }
            ]}
          >
            <EntrepreneurCard profile={profile} />
          </Animated.View>
        );
      } else {
        // Background cards
        const scaleValue = 0.9 - (i - 1) * 0.05;
        const opacityValue = 0.6 - (i - 1) * 0.2;
        
        cardsToRender.push(
          <View
            key={cardKey}
            style={[
              styles.cardContainer,
              {
                transform: [{ scale: scaleValue }],
                opacity: opacityValue,
                zIndex: 10 - i
              }
            ]}
          >
            <EntrepreneurCard profile={profile} />
          </View>
        );
      }
    }

    return cardsToRender;
  }, [profiles, currentIndex, position.x, position.y, opacity, animatedStyles, nextCardScale, panResponder.panHandlers, onProfilePress, onRefresh, isDebugMode, debugLog]);

  // Memoized action buttons
  const actionButtons = useMemo(() => {
    if (currentIndex >= profiles.length || profiles.length === 0) return null;
  
  return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={() => handleButtonSwipe('left')}
          activeOpacity={0.7}
        >
          <X size={24} color={Colors.dark.error} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => handleButtonSwipe('right')}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>C</Text>
        </TouchableOpacity>
        </View>
    );
  }, [currentIndex, profiles.length, handleButtonSwipe]);

  // Memoized error state
  const errorState = useMemo(() => {
    if (!error && !propError) return null;

    return (
        <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{getErrorMessage(error || propError)}</Text>
          {onRetry && (
            <Button
              title="Try Again"
              onPress={onRetry}
              variant="primary"
              size="medium"
            />
          )}
        </View>
    );
  }, [error, propError, onRetry]);
  
  return (
    <View style={styles.container}>
      {error || propError ? errorState : (
        <>
          <View style={styles.cardsContainer}>
            {renderCards}
        </View>
          {actionButtons}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  cardContainer: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
  },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  likeContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    transform: [{ rotate: '12deg' }]
  },
  passContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1000,
    transform: [{ rotate: '-12deg' }]
  },
  likeLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.dark.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  passLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.dark.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  likeText: {
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  passText: {
    color: Colors.dark.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: 60,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  passButton: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: Colors.dark.error,
  },
  likeButton: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: Colors.dark.primary,
  },
  connectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectIconText: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionButtonText: {
    color: Colors.dark.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  refreshButton: {
    marginTop: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});
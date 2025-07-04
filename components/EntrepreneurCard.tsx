/**
 * FILE: components/EntrepreneurCard.tsx
 * LAST UPDATED: 2025-07-02 18:00
 * 
 * CURRENT STATE:
 * Enhanced reusable card component for displaying entrepreneur profiles in the discovery interface.
 * Handles loading states, error states, and image loading with fallbacks.
 * Supports profile detail expansion and retry functionality for failed loads.
 * Optimized for smooth animations and better user experience.
 * 
 * RECENT CHANGES:
 * - Enhanced loading state handling for profile data with better animations
 * - Improved error state with better retry functionality and user feedback
 * - Enhanced image loading states and fallbacks with smoother transitions
 * - Better accessibility with proper hit slops and touch feedback
 * - Improved visual design with better shadows and spacing
 * - Enhanced integration with SwipeCards component for smoother animations
 * 
 * FILE INTERACTIONS:
 * - Imports from: types (UserProfile interface)
 * - Imports from: constants (Colors)
 * - Imports from: utils (error handling)
 * - Exports to: discover.tsx and other profile display screens
 * - Dependencies: React Native, Expo LinearGradient
 * - Data flow: Receives profile data and callbacks from parent,
 *   manages internal loading states, triggers parent callbacks
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - Enhanced profile image display with loading states
 * - Improved business information display
 * - Better error state handling with retry
 * - Enhanced loading state display
 * - Optimized profile expansion trigger
 */

import React, { useState, useEffect } from 'react';
import type { FC } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { ChevronDown, AlertCircle, MapPin, User } from 'lucide-react-native';
import { withErrorHandling } from '@/utils/error-utils';
import * as Haptics from 'expo-haptics';

interface EntrepreneurCardProps {
  profile: UserProfile;
  onProfilePress?: () => void;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;

export const EntrepreneurCard: FC<EntrepreneurCardProps> = ({
  profile,
  onProfilePress,
  isLoading = false,
  error,
  onRetry
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Enhanced haptic feedback function
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy') => {
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
    }
  };
  
  // Reset states when profile changes
  useEffect(() => {
    if (profile?.id) {
      setImageLoading(true);
      setImageError(false);
      
      // Fallback timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        setImageLoading(false);
      }, 10000); // 10 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [profile?.id]);
  
  // Enhanced error state with better styling
  if (error) {
    return (
      <View style={[styles.cardContainer, styles.errorContainer]}>
        <AlertCircle size={56} color={Colors.dark.error} />
        <Text style={styles.errorTitle}>Unable to Load Profile</Text>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              triggerHapticFeedback('light');
              onRetry();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  // Enhanced loading state with better animations
  if (isLoading) {
    return (
      <View style={[styles.cardContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
        <View style={styles.loadingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.cardContainer}>
      {/* Enhanced image with fallback */}
      {imageError ? (
        <View style={[styles.image, styles.imageFallback]}>
          <User size={80} color={Colors.dark.textSecondary} />
          <Text style={styles.fallbackText}>No Photo</Text>
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: profile.photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop'
            }}
            style={styles.image}
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
          {/* Simplified loading indicator */}
          {imageLoading && (
            <View style={styles.imageLoadingOverlay}>
              <ActivityIndicator size="large" color={Colors.dark.accent} />
            </View>
          )}
        </View>
      )}
      
      {/* Enhanced gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <View style={styles.infoContainer}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.field} numberOfLines={1}>{profile.businessField}</Text>
          </View>
          
          {/* Enhanced location display */}
          {profile.location && (
            <View style={styles.locationContainer}>
              <MapPin size={14} color={Colors.dark.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {profile.location}
              </Text>
            </View>
          )}
          
          {/* Enhanced tags section */}
          <View style={styles.tags}>
            {profile.lookingFor && profile.lookingFor.length > 0 && (
              <View style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  Looking for: {profile.lookingFor[0]}{profile.lookingFor.length > 1 ? '...' : ''}
                </Text>
              </View>
            )}
            
            {profile.businessStage && (
              <View style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>{profile.businessStage}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
      
      {/* Enhanced profile detail button */}
      <TouchableOpacity
        style={[
          styles.profileDetailButton,
          isLoading && styles.buttonDisabled
        ]}
        onPress={() => {
          if (!isLoading && onProfilePress) {
            triggerHapticFeedback('light');
            onProfilePress();
          }
        }}
        disabled={isLoading}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <ChevronDown 
          size={24} 
          color={isLoading ? Colors.dark.disabled : Colors.dark.text} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '500',
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.accent,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    color: Colors.dark.error,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    color: Colors.dark.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent,
    shadowColor: Colors.dark.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  retryText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageFallback: {
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    marginTop: 8,
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    padding: 20,
    justifyContent: 'flex-end',
  },
  infoContainer: {
    gap: 12,
  },
  header: {
    gap: 4,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 26,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  field: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  profileDetailButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
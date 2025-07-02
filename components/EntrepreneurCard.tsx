/**
 * FILE: components/EntrepreneurCard.tsx
 * LAST UPDATED: 2024-12-20 11:45
 * 
 * CURRENT STATE:
 * Reusable card component for displaying entrepreneur profiles in the discovery interface.
 * Handles loading states, error states, and image loading with fallbacks.
 * Supports profile detail expansion and retry functionality for failed loads.
 * 
 * RECENT CHANGES:
 * - Added loading state handling for profile data
 * - Added error state with retry functionality
 * - Improved image loading states and fallbacks
 * - Enhanced accessibility with proper hit slops
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
 * - Profile image display with loading states
 * - Business information display
 * - Error state handling with retry
 * - Loading state display
 * - Profile expansion trigger
 */

import React, { useState, useEffect } from 'react';
import type { FC } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { ChevronDown, AlertCircle, MapPin } from 'lucide-react-native';
import { withErrorHandling } from '@/utils/error-utils';

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
  
  // Reset states when profile changes
  useEffect(() => {
    if (profile?.id) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [profile?.id]);
  
  if (error) {
    return (
      <View style={[styles.cardContainer, styles.errorContainer]}>
        <AlertCircle size={48} color={Colors.dark.error} />
        <Text style={styles.errorText}>{error}</Text>
        {onRetry && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  if (isLoading) {
    return (
      <View style={[styles.cardContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.cardContainer}>
      {imageLoading && !imageError && (
        <View style={[styles.imageLoadingContainer, styles.absoluteFill]}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
        </View>
      )}
      
      <Image
        source={{
          uri: profile.photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop'
        }}
        style={[
          styles.image,
          imageError && styles.imagePlaceholder
        ]}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        onError={() => {
          setImageLoading(false);
          setImageError(true);
        }}
      />
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <View style={styles.infoContainer}>
          <View style={styles.header}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.field}>{profile.businessField}</Text>
          </View>
          
          <View style={styles.tags}>
            {profile.lookingFor && profile.lookingFor.length > 0 && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  Looking for: {profile.lookingFor[0]}{profile.lookingFor.length > 1 ? '...' : ''}
                </Text>
              </View>
            )}
            
            {profile.businessStage && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{profile.businessStage}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
      
      <TouchableOpacity
        style={[
          styles.profileDetailButton,
          isLoading && styles.buttonDisabled
        ]}
        onPress={onProfilePress}
        disabled={isLoading}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronDown size={24} color={isLoading ? Colors.dark.disabled : Colors.dark.text} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: Colors.dark.text,
    fontSize: 16,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    color: Colors.dark.error,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.accent,
  },
  retryText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: Colors.dark.card,
  },
  imageLoadingContainer: {
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    padding: 16,
    justifyContent: 'flex-end',
  },
  infoContainer: {
    gap: 8,
  },
  header: {
    gap: 4,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '600',
  },
  field: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.dark.card,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  profileDetailButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
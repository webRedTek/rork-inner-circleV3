import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { ChevronDown, AlertCircle } from 'lucide-react-native';
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

export const EntrepreneurCard: React.FC<EntrepreneurCardProps> = ({
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
    setImageLoading(true);
    setImageError(false);
  }, [profile.id]);
  
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
      {imageLoading && (
        <View style={styles.imageLoadingContainer}>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.dark.accent,
    borderRadius: 8,
  },
  retryText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  imagePlaceholder: {
    backgroundColor: Colors.dark.card,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%',
    justifyContent: 'flex-end',
  },
  infoContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  field: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(157, 78, 221, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '600',
  },
  profileDetailButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { Shield } from 'lucide-react-native';
import { handleError, ErrorCategory, ErrorCodes } from '@/utils/error-utils';

export const ProfileHeader: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  
  if (!user) {
    throw {
      category: ErrorCategory.AUTH,
      code: ErrorCodes.AUTH_NOT_AUTHENTICATED,
      message: 'User not authenticated'
    };
  }

  const tierColor = user.membershipTier === 'gold' 
    ? Colors.dark.gold 
    : user.membershipTier === 'silver' 
      ? Colors.dark.silver 
      : Colors.dark.bronze;

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.imageContainer}
        onPress={() => router.push('/edit-profile')}
      >
        {user.photoUrl ? (
          <Image 
            source={{ uri: user.photoUrl }} 
            style={styles.profileImage} 
          />
        ) : (
          <View style={[styles.profileImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>
              {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{user.name || 'Anonymous'}</Text>
        <Text style={styles.email}>{user.email}</Text>
        
        <TouchableOpacity 
          style={[styles.tierBadge, { backgroundColor: tierColor }]}
          onPress={() => router.push('/membership')}
        >
          <Shield size={16} color={Colors.dark.text} />
          <Text style={styles.tierText}>
            {user.membershipTier.charAt(0).toUpperCase() + user.membershipTier.slice(1)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginBottom: 16,
  },
  imageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  placeholderImage: {
    backgroundColor: Colors.dark.placeholder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
    color: Colors.dark.text,
    textTransform: 'uppercase',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierText: {
    color: Colors.dark.text,
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
});
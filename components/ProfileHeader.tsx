import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { Shield, Award } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth-store';

interface ProfileHeaderProps {
  profile: UserProfile;
  onPress?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, onPress }) => {
  const { tierSettings } = useAuthStore();
  
  const getTierColor = () => {
    switch (profile.membershipTier) {
      case 'gold':
        return '#FFD700';
      case 'silver':
        return '#C0C0C0';
      default:
        return '#CD7F32'; // Bronze
    }
  };
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      <Image
        source={{ 
          uri: profile.photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop' 
        }}
        style={styles.avatar}
      />
      
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.businessVerified && (
            <Shield size={16} color={Colors.dark.success} style={styles.verifiedIcon} />
          )}
        </View>
        
        <Text style={styles.field}>{profile.businessField}</Text>
        
        <View style={styles.statusRow}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: profile.entrepreneurStatus === 'current' ? Colors.dark.success : Colors.dark.accent }
          ]}>
            <Text style={styles.statusText}>
              {profile.entrepreneurStatus === 'current' ? 'Current' : 'Upcoming'}
            </Text>
          </View>
          
          <View style={[styles.tierBadge, { borderColor: getTierColor() }]}>
            <Award size={12} color={getTierColor()} style={styles.tierIcon} />
            <Text style={[styles.tierText, { color: getTierColor() }]}>
              {profile.membershipTier.charAt(0).toUpperCase() + profile.membershipTier.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginRight: 4,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  field: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '500',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  tierIcon: {
    marginRight: 4,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserProfile } from '@/types/user';
import Colors from '@/constants/colors';
import { ChevronDown } from 'lucide-react-native';

interface EntrepreneurCardProps {
  profile: UserProfile;
  onProfilePress?: () => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;

export const EntrepreneurCard: React.FC<EntrepreneurCardProps> = ({ profile, onProfilePress }) => {
  console.log('[EntrepreneurCard] Rendering card for', { id: profile.id, name: profile.name });
  
  return (
    <View style={styles.cardContainer}>
      <Image
        source={{ 
          uri: profile.photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop' 
        }}
        style={styles.image}
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
      
      {/* Profile detail button */}
      <TouchableOpacity 
        style={styles.profileDetailButton}
        onPress={onProfilePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ChevronDown size={24} color={Colors.dark.text} />
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
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
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
    backgroundColor: 'rgba(157, 78, 221, 0.6)', // Semi-transparent accent color
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
});
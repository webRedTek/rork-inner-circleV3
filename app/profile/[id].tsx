import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { ProfileHeader } from '@/components/ProfileHeader';
import { ProfileDetailCard } from '@/components/ProfileDetailCard';
import { Button } from '@/components/Button';
import { UserProfile } from '@/types/user';
import { useAuthStore } from '@/store/auth-store';
import { useMatchesStore } from '@/store/matches-store';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { isSupabaseConfigured, supabase, convertToCamelCase } from '@/lib/supabase';

export default function ProfileDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isReady } = useAuthStore();
  const { likeUser, passUser } = useMatchesStore();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMatch, setIsMatch] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  useEffect(() => {
    if (isReady && user && id) {
      fetchProfile();
      setInitialLoad(false);
    }
  }, [isReady, user, id]);
  
  const fetchProfile = async () => {
    if (!user || !id) return; // Silent fail if no user or id
    
    try {
      setLoading(true);
      
      if (isSupabaseConfigured() && supabase) {
        // Get user profile from Supabase
        const { data: foundUser, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();
        
        if (userError || !foundUser) {
          setError('User not found');
          return;
        }
        
        const userProfile = supabaseToUserProfile(foundUser);
        setProfile(userProfile);
        
        // Check if there's a match
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`)
          .or(`user_id.eq.${id},matched_user_id.eq.${id}`);
        
        if (matchesError) {
          console.error('Error checking matches:', matchesError);
          setIsMatch(false);
          return;
        }
        
        const match = matchesData.find(
          m => (m.user_id === user.id && m.matched_user_id === id) || 
               (m.user_id === id && m.matched_user_id === user.id)
        );
        
        setIsMatch(!!match);
      } else {
        setError('Supabase not configured');
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleConnect = async () => {
    if (!profile || !user) return;
    
    try {
      const match = await likeUser(profile.id);
      
      if (match) {
        setIsMatch(true);
        Alert.alert(
          "It's a Match!",
          `You and ${profile.name} have liked each other.`,
          [
            {
              text: 'Send Message',
              onPress: () => router.push(`/chat/${profile.id}`),
            },
            {
              text: 'Continue Browsing',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert('Connection Request Sent', `You've liked ${profile.name}'s profile.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect with this user');
    }
  };
  
  const handlePass = async () => {
    if (!profile || !user) return;
    
    try {
      await passUser(profile.id);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to pass on this user');
    }
  };
  
  const handleMessage = () => {
    if (!profile) return;
    router.push(`/chat/${profile.id}`);
  };
  
  if (loading || initialLoad || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }
  
  if (error || !profile || !user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Something went wrong'}</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          style={styles.errorButton}
        />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{
          title: profile.name,
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.headerBackButton}
            >
              <ArrowLeft size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ProfileHeader profile={profile} />
      
      {isMatch ? (
        <View style={styles.matchContainer}>
          <View style={styles.matchBadge}>
            <Text style={styles.matchText}>Connected</Text>
          </View>
          
          <Button
            title="Message"
            onPress={handleMessage}
            variant="primary"
            style={styles.messageButton}
            icon={<MessageCircle size={18} color={Colors.dark.text} />}
          />
        </View>
      ) : (
        <View style={styles.actionsContainer}>
          <Button 
            title="Connect" 
            onPress={handleConnect} 
            variant="primary"
            style={styles.actionButton}
          />
          <Button 
            title="Pass" 
            onPress={handlePass} 
            variant="outline"
            style={styles.actionButton}
          />
        </View>
      )}
      
      <View style={styles.detailsContainer}>
        <ProfileDetailCard 
          title="Bio" 
          content={profile.bio || 'No bio added yet'} 
        />
        
        <ProfileDetailCard 
          title="Location" 
          content={`${profile.location || 'Not specified'}${profile.zipCode ? ` (${profile.zipCode})` : ''}`} 
        />
        
        <ProfileDetailCard 
          title="Industry" 
          content={profile.industryFocus || profile.businessField || 'Not specified'} 
        />
        
        <ProfileDetailCard 
          title="Business Stage" 
          content={profile.businessStage || 'Not specified'} 
        />
        
        <ProfileDetailCard 
          title="Skills Offered" 
          content={
            profile.skillsOffered && profile.skillsOffered.length > 0 
              ? profile.skillsOffered 
              : 'No skills added yet'
          } 
        />
        
        {profile.skillsSeeking && profile.skillsSeeking.length > 0 && (
          <ProfileDetailCard 
            title="Skills Seeking" 
            content={profile.skillsSeeking} 
          />
        )}
        
        {profile.lookingFor && profile.lookingFor.length > 0 && (
          <ProfileDetailCard 
            title="Looking For" 
            content={profile.lookingFor} 
          />
        )}
        
        {profile.availabilityLevel && profile.availabilityLevel.length > 0 && (
          <ProfileDetailCard 
            title="Availability" 
            content={profile.availabilityLevel} 
          />
        )}
        
        {profile.keyChallenge && (
          <ProfileDetailCard 
            title="Current Challenge" 
            content={profile.keyChallenge} 
          />
        )}
        
        {profile.successHighlight && (
          <ProfileDetailCard 
            title="Success Highlight" 
            content={profile.successHighlight} 
          />
        )}
      </View>
    </ScrollView>
  );
}

// Helper function to convert Supabase response to UserProfile type
const supabaseToUserProfile = (data: Record<string, any>): UserProfile => {
  const camelCaseData = convertToCamelCase(data);
  
  return {
    id: String(camelCaseData.id || ''),
    email: String(camelCaseData.email || ''),
    name: String(camelCaseData.name || ''),
    bio: String(camelCaseData.bio || ''),
    location: String(camelCaseData.location || ''),
    zipCode: String(camelCaseData.zipCode || ''),
    businessField: (String(camelCaseData.businessField || 'Technology')) as UserProfile["businessField"],
    entrepreneurStatus: (String(camelCaseData.entrepreneurStatus || 'upcoming')) as UserProfile["entrepreneurStatus"],
    photoUrl: String(camelCaseData.photoUrl || ''),
    membershipTier: (String(camelCaseData.membershipTier || 'basic')) as UserProfile["membershipTier"],
    businessVerified: Boolean(camelCaseData.businessVerified || false),
    joinedGroups: Array.isArray(camelCaseData.joinedGroups) ? camelCaseData.joinedGroups : [],
    createdAt: Number(camelCaseData.createdAt || Date.now()),
    lookingFor: Array.isArray(camelCaseData.lookingFor) ? camelCaseData.lookingFor as UserProfile["lookingFor"] : [],
    businessStage: camelCaseData.businessStage as UserProfile["businessStage"] || 'Idea Phase',
    skillsOffered: Array.isArray(camelCaseData.skillsOffered) ? camelCaseData.skillsOffered as UserProfile["skillsOffered"] : [],
    skillsSeeking: Array.isArray(camelCaseData.skillsSeeking) ? camelCaseData.skillsSeeking as UserProfile["skillsSeeking"] : [],
    keyChallenge: String(camelCaseData.keyChallenge || ''),
    industryFocus: String(camelCaseData.industryFocus || ''),
    availabilityLevel: Array.isArray(camelCaseData.availabilityLevel) ? camelCaseData.availabilityLevel as UserProfile["availabilityLevel"] : [],
    timezone: String(camelCaseData.timezone || ''),
    successHighlight: String(camelCaseData.successHighlight || ''),
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerBackButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.dark.background,
  },
  errorText: {
    fontSize: 18,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorButton: {
    minWidth: 120,
  },
  matchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  matchBadge: {
    backgroundColor: Colors.dark.success,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  matchText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  messageButton: {
    minWidth: 120,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  detailsContainer: {
    padding: 16,
    gap: 16,
    marginBottom: 32,
  },
});
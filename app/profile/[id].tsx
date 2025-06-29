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
import { handleError, ErrorCategory, ErrorCodes } from '@/utils/error-utils';
import { withNetworkCheck } from '@/utils/network-utils';

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
      setError(null);
      
      await withNetworkCheck(async () => {
        if (!isSupabaseConfigured() || !supabase) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_CONNECTION_ERROR,
            message: 'Database is not configured'
          };
        }

        // Get user profile from Supabase
        const { data: foundUser, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();
        
        if (userError) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_QUERY_ERROR,
            message: 'Failed to fetch user profile'
          };
        }
        
        if (!foundUser) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_NOT_FOUND,
            message: 'User not found'
          };
        }
        
        const userProfile = convertToCamelCase(foundUser) as UserProfile;
        setProfile(userProfile);
        
        // Check if there's a match
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .or(`user_id.eq.${user.id},matched_user_id.eq.${user.id}`)
          .or(`user_id.eq.${id},matched_user_id.eq.${id}`);
        
        if (matchesError) {
          throw {
            category: ErrorCategory.DATABASE,
            code: ErrorCodes.DB_QUERY_ERROR,
            message: 'Failed to check match status'
          };
        }
        
        const match = matchesData.find(
          m => (m.user_id === user.id && m.matched_user_id === id) || 
               (m.user_id === id && m.matched_user_id === user.id)
        );
        
        setIsMatch(!!match);
      });
    } catch (err) {
      const appError = handleError(err);
      setError(appError.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      await likeUser(id);
      router.back();
    } catch (err) {
      const appError = handleError(err);
      Alert.alert('Error', appError.userMessage);
    }
  };

  const handlePass = async () => {
    try {
      await passUser(id);
      router.back();
    } catch (err) {
      const appError = handleError(err);
      Alert.alert('Error', appError.userMessage);
    }
  };

  const handleMessage = () => {
    router.push(`/chat/${id}`);
  };

  if (loading || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Try Again"
          onPress={fetchProfile}
          variant="primary"
          size="medium"
          style={styles.retryButton}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <ArrowLeft size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          ),
          headerRight: isMatch ? () => (
            <TouchableOpacity 
              onPress={handleMessage}
              style={styles.headerButton}
            >
              <MessageCircle size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      
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

      {!isMatch && (
        <View style={styles.actionButtons}>
          <Button
            title="Pass"
            onPress={handlePass}
            variant="outline"
            size="large"
            style={styles.actionButton}
          />
          <Button
            title="Like"
            onPress={handleLike}
            variant="primary"
            size="large"
            style={styles.actionButton}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    padding: 16,
  },
  errorText: {
    color: Colors.dark.error,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 16,
  },
  retryButton: {
    width: 200,
  },
  headerButton: {
    padding: 8,
  },
  detailsContainer: {
    paddingVertical: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 16,
  },
  actionButton: {
    flex: 1,
  },
});
/**
 * FILE: app/edit-profile.tsx
 * LAST UPDATED: 2025-07-01 14:45
 * 
 * INITIALIZATION ORDER:
 * 1. Initializes after auth-store is ready and user data is available
 * 2. Requires auth-store, location services, and image picker to be initialized
 * 3. Initializes user profile form and location services
 * 4. Updates user profile in auth-store when saved
 * 5. Race condition: Location services must be enabled before getting device location
 * 
 * CURRENT STATE:
 * Profile editing screen with enhanced location functionality. Allows users to:
 * - Set location via device GPS or ZIP code
 * - Update profile information
 * - Manage location privacy settings
 * 
 * RECENT CHANGES:
 * - Added device location detection with permissions handling
 * - Implemented ZIP code geocoding
 * - Added location privacy controls
 * - Fixed input validation and error handling
 * 
 * FILE INTERACTIONS:
 * - Imports from: auth-store, components/, constants/colors, types/user
 * - Exports to: Used by app router for profile editing
 * - Dependencies: expo-location, expo-image-picker for core functionality
 * - Data flow: Reads/writes user data through auth-store
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - EditProfileScreen: Main component for profile editing
 * - getDeviceLocation: Handles device GPS location detection
 * - getCoordinatesFromZip: Converts ZIP codes to coordinates
 * - handleUpdateProfile: Validates and saves profile changes
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/auth-store';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { MultiSelect } from '@/components/MultiSelect';
import { SingleSelect } from '@/components/SingleSelect';
import { BusinessField, EntrepreneurStatus, BusinessStage, LookingFor, Skill, AvailabilityLevel, LocationPrivacy } from '@/types/user';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { ArrowLeft, Camera, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { handleError, ErrorCategory, ErrorCodes } from '@/utils/error-utils';

// Add maxLength to InputProps interface
interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  maxLength?: number;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

// Helper function to extract readable error message
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  // If it's a string, return it directly
  if (typeof error === 'string') return error;
  
  // If it has a message property, return that
  if (error.message) return error.message;
  
  // If it has an error property with a message (nested error)
  if (error.error && error.error.message) return error.error.message;
  
  // If it has a details property
  if (error.details) return String(error.details);
  
  // If it has a code property
  if (error.code) return `Error code: ${error.code}`;
  
  // Last resort: stringify the object
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

// Convert string arrays to Option arrays
const businessFieldOptions = [
  { label: 'Technology', value: 'Technology' },
  { label: 'Finance', value: 'Finance' },
  { label: 'Marketing', value: 'Marketing' },
  { label: 'E-commerce', value: 'E-commerce' },
  { label: 'Health', value: 'Health' },
  { label: 'Education', value: 'Education' },
  { label: 'Food & Beverage', value: 'Food & Beverage' },
  { label: 'Real Estate', value: 'Real Estate' },
  { label: 'Creative', value: 'Creative' },
  { label: 'Consulting', value: 'Consulting' },
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'SaaS', value: 'SaaS' },
  { label: 'FinTech', value: 'FinTech' },
  { label: 'Other', value: 'Other' }
];

const businessStageOptions = [
  { label: 'Idea Phase', value: 'Idea Phase' },
  { label: 'Pre-Seed/Startup', value: 'Pre-Seed/Startup' },
  { label: 'Growth Stage', value: 'Growth Stage' },
  { label: 'Established/Scaling', value: 'Established/Scaling' },
  { label: 'Exited', value: 'Exited' }
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, isLoading, error, clearError } = useAuthStore();
  
  // Basic info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessField, setBusinessField] = useState<BusinessField>('Technology');
  const [entrepreneurStatus, setEntrepreneurStatus] = useState<EntrepreneurStatus>('upcoming');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>('');
  
  // Enhanced profile fields
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const [businessStage, setBusinessStage] = useState<BusinessStage>('Idea Phase');
  const [skillsOffered, setSkillsOffered] = useState<Skill[]>([]);
  const [skillsSeeking, setSkillsSeeking] = useState<Skill[]>([]);
  const [keyChallenge, setKeyChallenge] = useState('');
  const [industryFocus, setIndustryFocus] = useState('');
  const [availabilityLevel, setAvailabilityLevel] = useState<AvailabilityLevel[]>([]);
  const [location, setLocation] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [preferredDistance, setPreferredDistance] = useState('50');
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>('public');
  const [timezone, setTimezone] = useState('');
  const [successHighlight, setSuccessHighlight] = useState('');
  
  // Validation errors
  const [nameError, setNameError] = useState('');
  const [bioError, setBioError] = useState('');
  const [zipCodeError, setZipCodeError] = useState('');
  const [distanceError, setDistanceError] = useState('');
  
  // Options for select fields
  const lookingForOptions: LookingFor[] = [
    'Partners', 'Mentor', 'Bounce Ideas', 'Peers', 
    'Mentoring others', 'Meetups', 'Funding'
  ];
  const skillOptions: Skill[] = [
    'Marketing', 'Sales', 'Development', 'UI/UX', 'Fundraising', 
    'Product Management', 'Operations', 'Finance', 'Legal', 'HR', 
    'Customer Service', 'Content Creation', 'Data Analysis', 'Strategy'
  ];
  const availabilityOptions: AvailabilityLevel[] = [
    'Quick chats', 'Regular virtual coffee', 
    'Local meetups', 'Long-term mentorship/partnership'
  ];
  const locationPrivacyOptions = [
    { label: 'Public', value: 'public' },
    { label: 'Matches Only', value: 'matches_only' },
    { label: 'Hidden', value: 'hidden' }
  ];
  
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  useEffect(() => {
    if (user) {
      // Initialize form with user data
      setName(user.name);
      setEmail(user.email);
      setBusinessField(user.businessField);
      setEntrepreneurStatus(user.entrepreneurStatus);
      setBio(user.bio);
      setPhotoUrl(user.photoUrl);
      
      if (user.lookingFor) setLookingFor(user.lookingFor);
      if (user.businessStage) setBusinessStage(user.businessStage);
      if (user.skillsOffered) setSkillsOffered(user.skillsOffered);
      if (user.skillsSeeking) setSkillsSeeking(user.skillsSeeking);
      if (user.keyChallenge) setKeyChallenge(user.keyChallenge);
      if (user.industryFocus) setIndustryFocus(user.industryFocus);
      if (user.availabilityLevel) setAvailabilityLevel(user.availabilityLevel);
      if (user.location) setLocation(user.location);
      if (user.zipCode) setZipCode(user.zipCode);
      if (user.preferredDistance) setPreferredDistance(user.preferredDistance.toString());
      if (user.locationPrivacy) setLocationPrivacy(user.locationPrivacy);
      if (user.timezone) setTimezone(user.timezone);
      if (user.successHighlight) setSuccessHighlight(user.successHighlight);
    }
  }, [user]);
  
  useEffect(() => {
    if (error) {
      Alert.alert('Update Failed', getReadableError(error));
      clearError();
    }
  }, [error, clearError]);
  
  // Function to get device location
  const getDeviceLocation = async () => {
    try {
      setIsGettingLocation(true);
      
      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Platform.OS === 'ios' 
                ? Linking.openURL('app-settings:')
                : Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
            }
          ]
        );
        return;
      }
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please grant location permission to use this feature.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      // Get address from coordinates
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (address) {
        setLocation(address.city || '');
        setZipCode(address.postalCode || '');
        // Update coordinates
        await updateProfile({
          ...user,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          location: address.city || '',
          zipCode: address.postalCode || ''
        });
      }
      
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again or enter it manually.');
    } finally {
      setIsGettingLocation(false);
    }
  };
  
  // Function to get coordinates from ZIP code
  const getCoordinatesFromZip = async (zipCode: string) => {
    try {
      const results = await Location.geocodeAsync(zipCode);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        // Get address details
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
          setLocation(address.city || '');
          // Update coordinates
          await updateProfile({
            ...user,
            latitude,
            longitude,
            location: address.city || '',
            zipCode
          });
        }
      } else {
        setZipCodeError('Could not find location for this ZIP code');
      }
    } catch (error) {
      console.error('Error geocoding ZIP:', error);
      setZipCodeError('Invalid ZIP code');
    }
  };
  
  const validateForm = () => {
    let isValid = true;
    
    // Name validation
    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // Bio validation
    if (!bio.trim()) {
      setBioError('Please provide a brief introduction');
      isValid = false;
    } else {
      setBioError('');
    }
    
    // Enhanced ZIP code validation
    if (zipCode) {
      if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
        setZipCodeError('Please enter a valid ZIP code (e.g., 12345 or 12345-6789)');
        isValid = false;
      } else {
        setZipCodeError('');
        // Get coordinates when ZIP is valid
        getCoordinatesFromZip(zipCode);
      }
    }
    
    // Preferred distance validation
    const distanceNum = parseInt(preferredDistance);
    if (isNaN(distanceNum) || distanceNum < 1 || distanceNum > 500) {
      setDistanceError('Distance must be between 1 and 500 km');
      isValid = false;
    } else {
      setDistanceError('');
    }
    
    return isValid;
  };
  
  const handleUpdateProfile = async () => {
    if (validateForm()) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      try {
        await updateProfile({
          name,
          businessField,
          entrepreneurStatus,
          bio,
          photoUrl,
          lookingFor,
          businessStage,
          skillsOffered,
          skillsSeeking,
          keyChallenge,
          industryFocus,
          availabilityLevel,
          location,
          zipCode,
          preferredDistance: parseInt(preferredDistance),
          locationPrivacy,
          timezone,
          successHighlight
        });
        
        if (!error) {
          Alert.alert('Success', 'Profile updated successfully', [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }
      } catch (err) {
        Alert.alert('Update Failed', getReadableError(err));
      }
    }
  };
  
  const handleChangePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to grant permission to access your photos.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', `An error occurred while selecting an image: ${getReadableError(error)}`);
    }
  };
  
  if (!user) return null;
  
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: "Edit Profile",
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
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            <Image
              source={{ 
                uri: photoUrl || 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2787&auto=format&fit=crop' 
              }}
              style={styles.profileImage}
            />
            <TouchableOpacity 
              style={styles.changePhotoButton}
              onPress={handleChangePhoto}
            >
              <Camera size={20} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </View>
        
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            error={nameError}
            autoCapitalize="words"
          />
          
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            inputStyle={styles.disabledInput}
            editable={false}
          />
          
          <SingleSelect
            label="Business Field"
            value={businessField}
            onValueChange={(value: string) => setBusinessField(value as BusinessField)}
            options={businessFieldOptions}
          />
          
          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Entrepreneur Status</Text>
            <View style={styles.statusOptions}>
              <Button
                title="Current"
                onPress={() => setEntrepreneurStatus('current')}
                variant={entrepreneurStatus === 'current' ? 'primary' : 'outline'}
                size="small"
                style={styles.statusButton}
              />
              <Button
                title="Upcoming"
                onPress={() => setEntrepreneurStatus('upcoming')}
                variant={entrepreneurStatus === 'upcoming' ? 'primary' : 'outline'}
                size="small"
                style={styles.statusButton}
              />
            </View>
          </View>
          
          <Input
            label="Brief Introduction"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself or your business"
            multiline
            numberOfLines={4}
            error={bioError}
            autoCapitalize="sentences"
          />
          
          <Text style={styles.sectionTitle}>Enhanced Profile</Text>
          
          <MultiSelect
            label="Looking For"
            options={lookingForOptions}
            selectedValues={lookingFor}
            onSelectionChange={setLookingFor}
            placeholder="Select what you're looking for"
          />
          
          <SingleSelect
            label="Business Stage"
            value={businessStage}
            onValueChange={(value: string) => setBusinessStage(value as BusinessStage)}
            options={businessStageOptions}
          />
          
          <MultiSelect
            label="Skills Offered"
            options={skillOptions}
            selectedValues={skillsOffered}
            onSelectionChange={setSkillsOffered}
            placeholder="Select skills you can offer"
          />
          
          <MultiSelect
            label="Skills Seeking"
            options={skillOptions}
            selectedValues={skillsSeeking}
            onSelectionChange={setSkillsSeeking}
            placeholder="Select skills you're looking for"
          />
          
          <Input
            label="Current Key Challenge"
            value={keyChallenge}
            onChangeText={setKeyChallenge}
            placeholder="What's your biggest business challenge right now?"
            autoCapitalize="sentences"
          />
          
          <Input
            label="Industry Focus"
            value={industryFocus}
            onChangeText={setIndustryFocus}
            placeholder="e.g. SaaS, E-commerce, FinTech"
            autoCapitalize="words"
          />
          
          <MultiSelect
            label="Availability/Commitment Level"
            options={availabilityOptions}
            selectedValues={availabilityLevel}
            onSelectionChange={setAvailabilityLevel}
            placeholder="Select your availability"
          />
          
          <Text style={styles.sectionTitle}>Location</Text>
          
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={getDeviceLocation}
            disabled={isGettingLocation}
          >
            <MapPin size={20} color={Colors.dark.accent} />
            <Text style={styles.locationButtonText}>
              {isGettingLocation ? 'Getting location...' : 'Use my current location'}
            </Text>
            {isGettingLocation && <ActivityIndicator size="small" color={Colors.dark.accent} />}
          </TouchableOpacity>
          
          <Text style={styles.orText}>- OR -</Text>
          
          <Input
            label="ZIP Code"
            value={zipCode}
            onChangeText={setZipCode}
            placeholder="Enter your ZIP code"
            error={zipCodeError}
            keyboardType="numeric"
            maxLength={10}
          />
          
          <Text style={styles.sectionTitle}>Location Privacy</Text>
          
          <SingleSelect
            label="Location Privacy"
            value={locationPrivacy}
            onValueChange={(value) => setLocationPrivacy(value as LocationPrivacy)}
            options={locationPrivacyOptions}
          />
          
          <Input
            label="Preferred Distance (km)"
            value={preferredDistance}
            onChangeText={setPreferredDistance}
            placeholder="Maximum distance for matches"
            error={distanceError}
            keyboardType="numeric"
          />
          
          <Input
            label="Timezone"
            value={timezone}
            onChangeText={setTimezone}
            placeholder="e.g. PST, EST, GMT"
            autoCapitalize="characters"
          />
          
          <Input
            label="Success Highlight/Milestone"
            value={successHighlight}
            onChangeText={setSuccessHighlight}
            placeholder="Share a recent accomplishment"
            autoCapitalize="sentences"
          />
          
          <View style={styles.buttonContainer}>
            <Button
              title="Save Changes"
              onPress={handleUpdateProfile}
              variant="primary"
              size="large"
              loading={isLoading}
              style={styles.saveButton}
            />
            
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="outline"
              size="large"
              style={styles.cancelButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerBackButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.dark.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 16,
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
  },
  disabledInput: {
    opacity: 0.7,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.textDim,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  locationButtonText: {
    color: Colors.dark.text,
    marginLeft: 8,
    fontSize: 16
  },
  orText: {
    textAlign: 'center',
    color: Colors.dark.textDim,
    marginVertical: 12
  },
  buttonContainer: {
    marginTop: 24,
  },
  saveButton: {
    marginBottom: 12,
  },
  cancelButton: {
    marginBottom: 12,
  },
});
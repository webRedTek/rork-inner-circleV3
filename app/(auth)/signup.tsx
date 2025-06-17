import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useAuthStore } from '@/store/auth-store';
import { BusinessField, EntrepreneurStatus, BusinessStage, LookingFor, Skill, AvailabilityLevel } from '@/types/user';
import { MultiSelect } from '@/components/MultiSelect';
import { SingleSelect } from '@/components/SingleSelect';
import { isSupabaseConfigured, testSupabaseConnection } from '@/lib/supabase';
import { useAffiliateStore } from '@/store/affiliate-store';

export default function SignupScreen() {
  const router = useRouter();
  const { signup, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const { checkReferralCode } = useAffiliateStore();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessField, setBusinessField] = useState<BusinessField>('Technology');
  const [entrepreneurStatus, setEntrepreneurStatus] = useState<EntrepreneurStatus>('upcoming');
  const [bio, setBio] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  const [lookingFor, setLookingFor] = useState<LookingFor[]>([]);
  const [businessStage, setBusinessStage] = useState<BusinessStage>('Idea Phase');
  const [skillsOffered, setSkillsOffered] = useState<Skill[]>([]);
  const [skillsSeeking, setSkillsSeeking] = useState<Skill[]>([]);
  const [keyChallenge, setKeyChallenge] = useState('');
  const [industryFocus, setIndustryFocus] = useState('');
  const [availabilityLevel, setAvailabilityLevel] = useState<AvailabilityLevel[]>([]);
  const [location, setLocation] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [timezone, setTimezone] = useState('');
  const [successHighlight, setSuccessHighlight] = useState('');
  
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [bioError, setBioError] = useState('');
  const [zipCodeError, setZipCodeError] = useState('');
  const [referralCodeError, setReferralCodeError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(false);
  
  const [isSupabaseReady, setIsSupabaseReady] = useState<boolean | null>(null);
  const [checkingSupabase, setCheckingSupabase] = useState(true);
  
  const lookingForOptions: LookingFor[] = ['Partners', 'Mentor', 'Bounce Ideas', 'Peers', 'Mentoring others', 'Meetups', 'Funding'];
  const businessStageOptions: BusinessStage[] = ['Idea Phase', 'Pre-Seed/Startup', 'Growth Stage', 'Established/Scaling', 'Exited'];
  const skillOptions: Skill[] = ['Marketing', 'Sales', 'Development', 'UI/UX', 'Fundraising', 'Product Management', 'Operations', 'Finance', 'Legal', 'HR', 'Customer Service', 'Content Creation', 'Data Analysis', 'Strategy'];
  const availabilityOptions: AvailabilityLevel[] = ['Quick chats', 'Regular virtual coffee', 'Local meetups', 'Long-term mentorship/partnership'];
  const scrollViewRef = useRef<ScrollView>(null);
	const scrollViewRef = useRef<ScrollView>(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const bioInputRef = useRef(null);
  const zipCodeInputRef = useRef(null);
	
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);
  
  useEffect(() => {
    checkSupabaseStatus();
  }, []);
  
  const checkSupabaseStatus = async () => {
    setCheckingSupabase(true);
    try {
      const configured = isSupabaseConfigured();
      setIsSupabaseReady(configured);
      
      if (configured) {
        const testResult = await testSupabaseConnection();
        setIsSupabaseReady(testResult.success);
        
        if (!testResult.success) {
          console.warn('Supabase connection test failed:', testResult.error);
        }
      } else {
        console.log('Supabase is not configured');
      }
    } catch (error) {
      console.error('Error checking Supabase status:', 
        error instanceof Error ? error.message : 'Unknown error');
      setIsSupabaseReady(false);
    } finally {
      setCheckingSupabase(false);
    }
  };
  
  useEffect(() => {
    if (error) {
      if (error.includes('security purposes') || error.includes('rate limit')) {
        setSignupError('For security purposes, please wait a minute before trying again.');
        setRateLimitCooldown(true);
        
        const timer = setTimeout(() => {
          setRateLimitCooldown(false);
          setSignupError('');
        }, 60000);
        
        return () => clearTimeout(timer);
      } else {
        setSignupError(error);
      }
      clearError();
    }
  }, [error, clearError]);

	const scrollToError = () => {
  if (nameError) {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  } else if (emailError) {
    scrollViewRef.current?.scrollTo({ y: 100, animated: true });
  } else if (passwordError || confirmPasswordError) {
    scrollViewRef.current?.scrollTo({ y: 200, animated: true });
  } else if (bioError) {
    scrollViewRef.current?.scrollTo({ y: 300, animated: true });
  } else if (zipCodeError) {
    scrollViewRef.current?.scrollTo({ y: 400, animated: true });
  } else if (referralCodeError) {
    scrollViewRef.current?.scrollTo({ y: 500, animated: true });
  }
};
	
  const validateForm = () => {
  let isValid = true;
  setSignupError('');
  setReferralCodeError('');
  
  if (!name.trim()) {
    setNameError('Name is required');
    isValid = false;
  } else {
    setNameError('');
  }
  
  if (!email.trim()) {
    setEmailError('Email is required');
    isValid = false;
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    setEmailError('Please enter a valid email');
    isValid = false;
  } else {
    setEmailError('');
  }
  
  if (!password) {
    setPasswordError('Password is required');
    isValid = false;
  } else if (password.length < 6) {
    setPasswordError('Password must be at least 6 characters');
    isValid = false;
  } else {
    setPasswordError('');
  }
  
  if (password !== confirmPassword) {
    setConfirmPasswordError('Passwords do not match');
    isValid = false;
  } else {
    setConfirmPasswordError('');
  }
  
  if (!bio.trim()) {
    setBioError('Please provide a brief introduction');
    isValid = false;
  } else {
    setBioError('');
  }
  
  if (!zipCode.trim()) {
    setZipCodeError('ZIP code is required for location-based matching');
    isValid = false;
  } else if (!/^\d{5}(-\d{4})?$/.test(zipCode)) {
    setZipCodeError('Please enter a valid ZIP code (e.g., 12345 or 12345-6789)');
    isValid = false;
  } else {
    setZipCodeError('');
  }
  
  if (referralCode.trim()) {
    // We'll validate referral code asynchronously in handleSignup
  }

  if (!isValid) {
    // Use setTimeout to ensure state updates have completed
    setTimeout(() => {
      if (nameError) {
        nameInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
        });
      } else if (emailError) {
        emailInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
        });
      } else if (passwordError || confirmPasswordError) {
        passwordInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
        });
      } else if (bioError) {
        bioInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
        });
      } else if (zipCodeError) {
        zipCodeInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
        });
      } else if (referralCodeError) {
        referralCodeInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
          scrollViewRef.current?.scrollTo({ y: pageY, animated: true });
        });
      }
    }, 100);
  }
  
  return isValid;
};
  
  const handleSupabaseSetup = () => {
    router.push('/supabase-setup');
  };
  
  const handleSignup = async () => {
    if (rateLimitCooldown) {
      Alert.alert(
        'Rate Limit Active',
        'Please wait a minute before trying again due to security measures.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (validateForm()) {
      try {
        setLocalLoading(true);
        setSignupError('');
        
        // Validate referral code if provided
        if (referralCode.trim()) {
          const isValidCode = await checkReferralCode(referralCode);
          if (!isValidCode) {
            setReferralCodeError('Invalid referral code. Please check and try again.');
            setLocalLoading(false);
            return;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await signup(
          {
            name,
            email,
            businessField,
            entrepreneurStatus,
            bio,
            lookingFor,
            businessStage,
            skillsOffered,
            skillsSeeking,
            keyChallenge,
            industryFocus,
            availabilityLevel,
            location,
            zipCode,
            timezone,
            successHighlight,
            membershipTier: 'basic',
            businessVerified: false,
            joinedGroups: [],
            createdAt: Date.now()
          },
          password
        );
      } catch (err) {
        console.error('Signup error in component:', 
          err instanceof Error ? err.message : 'Unknown error');
        
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('security purposes') || errorMessage.includes('rate limit')) {
          setSignupError('For security purposes, please wait a minute before trying again.');
          setRateLimitCooldown(true);
          
          setTimeout(() => {
            setRateLimitCooldown(false);
            setSignupError('');
          }, 60000);
        } else {
          setSignupError(errorMessage || 'Signup failed. Please check your network connection and try again.');
        }
      } finally {
        setLocalLoading(false);
      }
    }
  };
  
  if (isLoading || localLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Creating your account...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the Inner Circle network</Text>
        </View>
        
        {checkingSupabase ? (
          <View style={styles.supabaseCheckingContainer}>
            <ActivityIndicator size="small" color={Colors.dark.primary} />
            <Text style={styles.supabaseCheckingText}>Checking Supabase connection...</Text>
          </View>
        ) : (
          !isSupabaseReady && (
            <View style={styles.supabaseWarningContainer}>
              <Text style={styles.supabaseWarningText}>
                Supabase is not connected. Some features may not work properly.
              </Text>
              <Button
                title="Configure Supabase"
                onPress={handleSupabaseSetup}
                variant="outline"
                size="small"
                style={styles.supabaseButton}
              />
            </View>
          )
        )}
        
        <View style={styles.form}>
          {signupError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{signupError}</Text>
            </View>
          ) : null}
          
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Input
            label="Referral Code (Optional)"
            value={referralCode}
            onChangeText={(text) => {
              setReferralCode(text);
              setReferralCodeError('');
            }}
            placeholder="Enter referral code"
            autoCapitalize="none"
            error={referralCodeError}
            editable={!isLoading && !localLoading && !rateLimitCooldown}
            helperText="Enter a referral code if someone invited you"
          />
          
          <Input
  ref={nameInputRef}
  label="Full Name"
  value={name}
  onChangeText={(text) => {
    setName(text);
    setNameError('');
  }}
  placeholder="Enter your full name"
  error={nameError}
  autoCapitalize="words"
  editable={!isLoading && !localLoading && !rateLimitCooldown}
/>

<Input
  ref={emailInputRef}
  label="Email"
  value={email}
  onChangeText={(text) => {
    setEmail(text);
    setEmailError('');
  }}
  placeholder="Enter your email"
  keyboardType="email-address"
  error={emailError}
  autoCapitalize="none"
  editable={!isLoading && !localLoading && !rateLimitCooldown}
/>

<Input
  ref={passwordInputRef}
  label="Password"
  value={password}
  onChangeText={(text) => {
    setPassword(text);
    setPasswordError('');
  }}
  placeholder="Create a password"
  secureTextEntry
  error={passwordError}
  editable={!isLoading && !localLoading && !rateLimitCooldown}
/>

<Input
  ref={confirmPasswordInputRef}
  label="Confirm Password"
  value={confirmPassword}
  onChangeText={(text) => {
    setConfirmPassword(text);
    setConfirmPasswordError('');
  }}
  placeholder="Confirm your password"
  secureTextEntry
  error={confirmPasswordError}
  editable={!isLoading && !localLoading && !rateLimitCooldown}
/>
          
          <Input
            label="Business Field"
            value={businessField}
            onChangeText={(text) => setBusinessField(text as BusinessField)}
            placeholder="e.g. Technology, Finance, Marketing"
            editable={!isLoading && !localLoading && !rateLimitCooldown}
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
                disabled={isLoading || localLoading || rateLimitCooldown}
              />
              <Button
                title="Upcoming"
                onPress={() => setEntrepreneurStatus('upcoming')}
                variant={entrepreneurStatus === 'upcoming' ? 'primary' : 'outline'}
                size="small"
                style={styles.statusButton}
                disabled={isLoading || localLoading || rateLimitCooldown}
              />
            </View>
          </View>
          
          <Input
  ref={bioInputRef}
  label="Brief Introduction"
  value={bio}
  onChangeText={(text) => {
    setBio(text);
    setBioError('');
  }}
  placeholder="Tell us about yourself or your business"
  multiline
  numberOfLines={4}
  error={bioError}
  autoCapitalize="sentences"
  editable={!isLoading && !localLoading && !rateLimitCooldown}
/>
          
          <Text style={styles.sectionTitle}>Enhanced Profile</Text>
          
          <MultiSelect
            label="Looking For"
            options={lookingForOptions}
            selectedValues={lookingFor}
            onSelectionChange={setLookingFor}
            placeholder="Select what you're looking for"
            disabled={isLoading || localLoading || rateLimitCooldown}
          />
          
          <SingleSelect
            label="Stage of Business"
            options={businessStageOptions}
            selectedValue={businessStage}
            onSelectionChange={(value) => setBusinessStage(value as BusinessStage)}
            placeholder="Select your business stage"
            disabled={isLoading || localLoading || rateLimitCooldown}
          />
          
          <MultiSelect
            label="Skills Offered"
            options={skillOptions}
            selectedValues={skillsOffered}
            onSelectionChange={setSkillsOffered}
            placeholder="Select skills you can offer"
            disabled={isLoading || localLoading || rateLimitCooldown}
          />
          
          <MultiSelect
            label="Skills Seeking"
            options={skillOptions}
            selectedValues={skillsSeeking}
            onSelectionChange={setSkillsSeeking}
            placeholder="Select skills you're looking for"
            disabled={isLoading || localLoading || rateLimitCooldown}
          />
          
          <Input
            label="Current Key Challenge"
            value={keyChallenge}
            onChangeText={setKeyChallenge}
            placeholder="What's your biggest business challenge right now?"
            autoCapitalize="sentences"
            editable={!isLoading && !localLoading && !rateLimitCooldown}
          />
          
          <Input
            label="Industry Focus"
            value={industryFocus}
            onChangeText={setIndustryFocus}
            placeholder="e.g. SaaS, E-commerce, FinTech"
            autoCapitalize="words"
            editable={!isLoading && !localLoading && !rateLimitCooldown}
          />
          
          <MultiSelect
            label="Availability/Commitment Level"
            options={availabilityOptions}
            selectedValues={availabilityLevel}
            onSelectionChange={setAvailabilityLevel}
            placeholder="Select your availability"
            disabled={isLoading || localLoading || rateLimitCooldown}
          />
          
          <Input
            label="City/State"
            value={location}
            onChangeText={setLocation}
            placeholder="City, State"
            autoCapitalize="words"
            editable={!isLoading && !localLoading && !rateLimitCooldown}
          />
          
          <Input
						ref={zipCodeInputRef}
            label="ZIP Code"
            value={zipCode}
            onChangeText={(text) => {
              setZipCode(text);
              setZipCodeError('');
            }}
            placeholder="e.g. 12345"
            keyboardType="numeric"
            error={zipCodeError}
            editable={!isLoading && !localLoading && !rateLimitCooldown}
          />
          
          <Input
            label="Timezone"
            value={timezone}
            onChangeText={setTimezone}
            placeholder="e.g. PST, EST, GMT"
            autoCapitalize="characters"
            editable={!isLoading && !localLoading && !rateLimitCooldown}
          />
          
          <Input
            label="Success Highlight/Milestone"
            value={successHighlight}
            onChangeText={setSuccessHighlight}
            placeholder="Share a recent accomplishment"
            autoCapitalize="sentences"
            editable={!isLoading && !localLoading && !rateLimitCooldown}
          />
          
          <Button
            title={rateLimitCooldown ? "Please wait..." : "Create Account"}
            onPress={handleSignup}
            variant="primary"
            size="large"
            loading={isLoading || localLoading}
            disabled={rateLimitCooldown}
            style={styles.button}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text 
              style={styles.loginLink}
              onPress={() => router.push('/login')}
            >
              Log In
            </Text>
          </Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  form: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 24,
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
  button: {
    marginTop: 24,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  loginLink: {
    color: Colors.dark.accent,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  supabaseWarningContainer: {
    backgroundColor: Colors.dark.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.warning,
  },
  supabaseWarningText: {
    color: Colors.dark.warning,
    fontSize: 14,
    marginBottom: 8,
  },
  supabaseButton: {
    marginTop: 8,
  },
  supabaseCheckingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    marginBottom: 16,
  },
  supabaseCheckingText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginLeft: 8,
  },
});
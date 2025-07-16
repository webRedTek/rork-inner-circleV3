import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { Button } from '@/components/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=2940&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      />
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)', Colors.dark.background]}
        style={styles.gradient}
      />
      
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Inner Circle</Text>
          <Text style={styles.subtitle}>Connect. Collaborate. Grow.</Text>
        </View>
        
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>🔍</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Find Your Match</Text>
              <Text style={styles.featureDescription}>
                Connect with entrepreneurs who share your vision and goals
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>💼</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Showcase Your Business</Text>
              <Text style={styles.featureDescription}>
                Display your portfolio, analytics, and achievements
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureEmoji}>🚀</Text>
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Grow Together</Text>
              <Text style={styles.featureDescription}>
                Join groups and collaborate with like-minded entrepreneurs
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.actions}>
          <Button
            title="Login / Signup"
            onPress={() => router.push('/login')}
            variant="primary"
            size="large"
            style={styles.button}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '60%',
    top: 0,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '60%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.dark.accent,
    marginBottom: 24,
  },
  features: {
    marginTop: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  actions: {
    marginTop: 40,
  },
  button: {
    width: '100%',
    marginBottom: 16,
  }
});
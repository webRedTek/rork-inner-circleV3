import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import NotificationProvider from '@/components/NotificationProvider';
import { useAuthStore } from '@/store/auth-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import Colors from '@/constants/colors';
import { trpc, trpcClient } from '@/lib/trpc';
import { ErrorBoundary } from './error-boundary';

// Enable react-native-screens
enableScreens();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// Custom dark theme for React Navigation
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.accent,
  },
};

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.accent,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { checkSession, isReady, user } = useAuthStore();
  const { initialize: initializeSubscriptions } = useSubscriptionStore();
  
  const [fontsLoaded] = useFonts({});
  
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await checkSession();
      } catch (error) {
        console.error('Failed to check session:', error);
        // Don't block the app if session check fails
      }
    };
    
    initializeAuth();
  }, [checkSession]);

  // Initialize RevenueCat when user is authenticated
  useEffect(() => {
    const initSubs = async () => {
      if (isReady && user?.id && Platform.OS !== 'web') {
        try {
          await initializeSubscriptions(user.id);
        } catch (error) {
          console.error('Failed to initialize subscriptions:', error);
          // Don't block the app if subscription initialization fails
        }
      }
    };
    
    initSubs();
  }, [isReady, user?.id, initializeSubscriptions]);
  
  // Hide splash screen when ready
  useEffect(() => {
    const hideSplash = async () => {
      if (fontsLoaded && isReady) {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.error('Failed to hide splash screen:', error);
          // Continue anyway
        }
      }
    };
    
    hideSplash();
  }, [fontsLoaded, isReady]);
  
  // Show loading while checking authentication or loading fonts
  if (!isReady || !fontsLoaded) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={loadingStyles.text}>Loading...</Text>
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <SafeAreaProvider>
                <NotificationProvider>
                  <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
              },
              statusBarBackgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
            }}
          >
            <Stack.Screen 
              name="(auth)" 
              options={{ 
                headerShown: false,
              }} 
            />
            <Stack.Screen 
              name="(tabs)" 
              options={{ 
                headerShown: false,
              }} 
            />
            <Stack.Screen 
              name="membership" 
              options={{ 
                headerShown: true,
                title: 'Membership Plans',
                headerBackTitle: 'Profile',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
            <Stack.Screen 
              name="edit-profile" 
              options={{ 
                headerShown: true,
                title: 'Edit Profile',
                headerBackTitle: 'Profile',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
            <Stack.Screen 
              name="affiliate-dashboard" 
              options={{ 
                headerShown: true,
                title: 'Affiliate Dashboard',
                headerBackTitle: 'Profile',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
            <Stack.Screen 
              name="admin-settings" 
              options={{ 
                headerShown: true,
                title: 'Admin Settings',
                headerBackTitle: 'Profile',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
            <Stack.Screen 
              name="supabase-setup" 
              options={{ 
                headerShown: true,
                title: 'Supabase Setup',
                headerBackTitle: 'Profile',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
            <Stack.Screen 
              name="debug" 
              options={{ 
                headerShown: true,
                title: 'Debug',
                headerBackTitle: 'Profile',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
            <Stack.Screen 
              name="profile/[id]" 
              options={{ 
                headerShown: true,
                title: 'Profile',
                headerBackTitle: 'Discover',
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                },
                headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
              },
            }}
          />
                  </Stack>
                </NotificationProvider>
              </SafeAreaProvider>
            </GestureHandlerRootView>
          </ThemeProvider>
        </trpc.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.text,
  },
});
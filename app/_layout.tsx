import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from 'expo-router';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';

import NotificationProvider from '@/components/NotificationProvider';
import { useAuthStore } from '@/store/auth-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import Colors from '@/constants/colors';
import { trpc, trpcClient } from '@/lib/trpc';
import { ErrorBoundary } from './error-boundary';

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



export function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
        },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="membership"
        options={{
          headerShown: true,
          title: 'Membership Plans',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: true,
          title: 'Edit Profile',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="affiliate-dashboard"
        options={{
          headerShown: true,
          title: 'Affiliate Dashboard',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="admin-settings"
        options={{
          headerShown: true,
          title: 'Admin Settings',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="supabase-setup"
        options={{
          headerShown: true,
          title: 'Supabase Setup',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="debug"
        options={{
          headerShown: true,
          title: 'Debug',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="profile/[id]"
        options={{
          headerShown: true,
          title: 'Profile',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: true,
          title: 'Chat',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
      <Stack.Screen
        name="group/[id]"
        options={{
          headerShown: true,
          title: 'Group',
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
          headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        }}
      />
    </Stack>
  );
}

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
      }
    };

    initializeAuth();
  }, [checkSession]);

  useEffect(() => {
    const initSubs = async () => {
      if (isReady && user?.id && Platform.OS !== 'web') {
        try {
          await initializeSubscriptions(user.id);
        } catch (error) {
          console.error('Failed to initialize subscriptions:', error);
        }
      }
    };

    initSubs();
  }, [isReady, user?.id, initializeSubscriptions]);

  useEffect(() => {
    const hideSplash = async () => {
      if (fontsLoaded && isReady) {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.error('Failed to hide splash screen:', error);
        }
      }
    };

    hideSplash();
  }, [fontsLoaded, isReady]);

  if (!isReady || !fontsLoaded) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={loadingStyles.text}>Loading...</Text>
      </View>
    );
  }

  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <trpc.Provider client={trpcClient} queryClient={queryClient}>
              <NotificationProvider>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                <ThemeProvider value={navigationTheme}>
                  <RootLayoutNav />
                </ThemeProvider>
              </NotificationProvider>
            </trpc.Provider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
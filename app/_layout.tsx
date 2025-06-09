import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, StatusBar, View, Text, Alert } from "react-native";
import { ErrorBoundary } from "./error-boundary";
import Colors from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mockUsers } from "@/mocks/users";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { isSupabaseConfigured, initSupabase, testSupabaseConnection } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: Platform.OS === 'android' ? 3 : 1,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<boolean | null>(null);
  const router = useRouter();
  const { user, isAuthenticated, clearCache } = useAuthStore();

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    // Initialize Supabase and mock data
    const initApp = async () => {
      try {
        console.log('Initializing app...');
        
        // Check for environment variables
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        
        console.log('Environment check:', { 
          hasSupabaseUrl: !!supabaseUrl, 
          hasSupabaseKey: !!supabaseKey,
          nodeEnv: process.env.NODE_ENV
        });
        
        // Clear any existing caches if there were previous errors
        const hasPreviousError = await AsyncStorage.getItem('app_had_error');
        if (hasPreviousError === 'true') {
          console.log('Previous error detected, clearing caches...');
          await AsyncStorage.removeItem('app_had_error');
          await clearCaches();
        }
        
        // Initialize mock data regardless of Supabase status
        console.log('Initializing mock data...');
        const existingUsers = await AsyncStorage.getItem('mockUsers');
        if (!existingUsers) {
          console.log('Creating mock users...');
          const usersWithPasswords = mockUsers.map(user => ({
            ...user,
            password: 'password123'
          }));
          await AsyncStorage.setItem('mockUsers', JSON.stringify(usersWithPasswords));
          console.log('Mock users created');
        } else {
          console.log('Mock users already exist');
        }

        // Create empty audit log if it doesn't exist
        const existingAuditLog = await AsyncStorage.getItem('mockAuditLog');
        if (!existingAuditLog) {
          await AsyncStorage.setItem('mockAuditLog', JSON.stringify([]));
          console.log('Mock audit log created');
        }
        
        // Initialize Supabase with retry
        console.log('Initializing Supabase...');
        const maxRetries = 2;
        let retryCount = 0;
        let supabaseInitialized = false;
        
        while (retryCount <= maxRetries && !supabaseInitialized) {
          try {
            supabaseInitialized = await initSupabase();
            if (supabaseInitialized) {
              console.log("Supabase configured successfully");
              
              const testResult = await testSupabaseConnection();
              if (testResult.success) {
                console.log("Supabase connection test successful");
              } else {
                console.warn("Supabase connection test failed:", testResult.error);
              }
              
              break;
            } else {
              console.warn(`Supabase initialization attempt ${retryCount + 1}/${maxRetries + 1} failed`);
              retryCount++;
              if (retryCount <= maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          } catch (err) {
            console.error(`Supabase initialization error (attempt ${retryCount + 1}/${maxRetries + 1}):`, err);
            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        setSupabaseStatus(supabaseInitialized);
        setIsInitialized(true);
        console.log('App initialization complete');
      } catch (err) {
        console.error("Failed to initialize data:", err);
        await AsyncStorage.setItem('app_had_error', 'true');
        setSupabaseStatus(false);
        setIsInitialized(true);
      }
    };

    const clearCaches = async () => {
      try {
        console.log('Clearing caches...');
        await clearCache();
        console.log('Caches cleared successfully');
      } catch (error) {
        console.error('Error clearing caches:', error);
      }
    };

    if (loaded) {
      initApp();
      SplashScreen.hideAsync().catch(console.error);
    }
  }, [loaded, clearCache]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated && !user) {
      router.replace('/(auth)');
    }
  }, [isInitialized, isAuthenticated, user, router]);

  if (!loaded || !isInitialized) {
    return null;
  }

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />
          <RootLayoutNav supabaseStatus={supabaseStatus} />
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}

function RootLayoutNav({ supabaseStatus }: { supabaseStatus: boolean | null }) {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: Colors.dark.background,
        },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="profile/[id]" 
        options={{ 
          title: "Entrepreneur Profile",
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="chat/[id]" 
        options={{ 
          title: "Chat",
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="membership" 
        options={{ 
          title: "Membership Plans",
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen
        name="supabase-setup"
        options={{
          title: "Supabase Setup",
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          title: "Edit Profile",
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
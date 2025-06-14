import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, StatusBar, View, Text } from "react-native";
import { ErrorBoundary } from "./error-boundary";
import Colors from "@/constants/colors";
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
  const { user, isAuthenticated, isReady, checkSession, clearCache } = useAuthStore();

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
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
        
        // Initialize Supabase with retry
        console.log('Initializing Supabase...');
        const maxRetries = 2;
        let retryCount = 0;
        let supabaseInitialized = false;
        
        while (retryCount <= maxRetries && !supabaseInitialized) {
          try {
            console.log(`Supabase initialization attempt ${retryCount + 1}/${maxRetries + 1}`);
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
        console.log('App initialization complete', { supabaseInitialized });
        
        // Check session only once during app initialization
        await checkSession();
      } catch (err) {
        console.error("Failed to initialize data:", err);
        setSupabaseStatus(false);
        setIsInitialized(true);
      }
    };

    if (loaded) {
      initApp();
      SplashScreen.hideAsync().catch(console.error);
    }
  }, [loaded, clearCache, checkSession]);

  useEffect(() => {
    // Only redirect or handle navigation after initialization and session check are complete
    if (isInitialized && isReady && !isAuthenticated && !user) {
      router.replace('/(auth)');
    }
  }, [isInitialized, isReady, isAuthenticated, user, router]);

  if (!loaded || !isInitialized || !isReady) {
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
      <Stack.Screen
        name="admin-settings"
        options={{
          title: "Admin Settings",
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
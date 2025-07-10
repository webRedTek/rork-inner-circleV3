import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NotificationProvider from '@/components/NotificationProvider';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';
import { Platform } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { checkSession, isReady } = useAuthStore();
  
  useEffect(() => {
    checkSession();
  }, []);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NotificationProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: Colors.dark.background,
              },
              // Global safe area configuration
              statusBarBackgroundColor: Colors.dark.background,
              statusBarStyle: 'light',
            }}
          >
            <Stack.Screen 
              name="membership" 
              options={{ 
                headerShown: true,
                title: 'Membership Plans',
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
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
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
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
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
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
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
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
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
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
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }} 
            />
          </Stack>
        </NotificationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
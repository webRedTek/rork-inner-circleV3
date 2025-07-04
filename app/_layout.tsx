import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NotificationProvider from '@/components/NotificationProvider';
import { useAuthStore } from '@/store/auth-store';
import Colors from '@/constants/colors';

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
              headerStyle: {
                backgroundColor: '#1A1A1A',
              },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              contentStyle: {
                backgroundColor: Colors.dark.background,
              },
            }}
          />
        </NotificationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
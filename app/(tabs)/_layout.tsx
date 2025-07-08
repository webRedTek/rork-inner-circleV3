import React from 'react';
import { Tabs } from 'expo-router';
import Colors from '@/constants/colors';
import { Home, Users, MessageCircle, User, UsersRound, Bug } from 'lucide-react-native';
import { useDebugStore } from '@/store/debug-store';

export default function TabsLayout() {
  const { isDebugEnabled } = useDebugStore();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.dark.card,
          borderTopColor: Colors.dark.border,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
        headerStyle: {
          backgroundColor: Colors.dark.card,
        },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <UsersRound size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* Debug tab - only show when debug mode is enabled */}
      {isDebugEnabled && (
        <Tabs.Screen
          name="debug"
          options={{
            title: 'Debug',
            tabBarIcon: ({ color, size }) => <Bug size={size} color={color} />,
          }}
        />
      )}
    </Tabs>
  );
}
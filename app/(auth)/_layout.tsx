import { Stack } from "expo-router";
import { useColorScheme } from 'react-native';
import Colors from "@/constants/colors";

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen 
        name="login" 
        options={{ 
          title: "Login",
          headerShown: true,
        }} 
      />
      <Stack.Screen 
        name="signup" 
        options={{ 
          title: "Create Account",
          headerShown: true,
        }} 
      />
    </Stack>
  );
}
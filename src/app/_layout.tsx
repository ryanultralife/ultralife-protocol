/**
 * UltraLife App Layout
 * 
 * Expo Router root layout. The "invisible interface" starts here.
 * Minimal chrome. The app should feel like it barely exists.
 */

import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0F14' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="enroll" />
        <Stack.Screen name="home" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

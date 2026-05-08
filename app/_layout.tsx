import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform } from 'react-native';
import 'react-native-reanimated';

LogBox.ignoreLogs([
  'props.pointerEvents is deprecated',
  'aria-hidden',
]);

if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('pointerEvents') || msg.includes('aria-hidden')) return;
    _warn(...args);
  };
}
import {
  useFonts,
  Oswald_400Regular,
  Oswald_500Medium,
  Oswald_600SemiBold,
  Oswald_700Bold,
} from '@expo-google-fonts/oswald';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { StickersProvider } from '@/context/StickersContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Oswald_400Regular,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <StickersProvider>
      <StatusBar style="light" backgroundColor="#0B1120" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B1120' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="seleccion/[code]" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </StickersProvider>
  );
}

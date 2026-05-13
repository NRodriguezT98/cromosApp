import { useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  HouseIcon,
  BookOpenIcon,
  ClockIcon,
  Camera,
  ArrowsLeftRight,
} from 'phosphor-react-native';
import { Colors, Typography } from '@/constants/theme';
import { ScannerModal } from '@/components/ui/ScannerModal';

function TabIcon({ icon, label, focused, accentColor }: { icon: React.ReactNode; label: string; focused: boolean; accentColor?: string }) {
  const accent = accentColor ?? Colors.red;
  return (
    <View style={[styles.tabItem, focused && { backgroundColor: accent + '20' }]}>
      {icon}
      <Text style={[styles.tabLabel, focused && { color: accent }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarBackground: () =>
            Platform.OS === 'ios' ? (
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bgCard }]} />
            ),
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={<HouseIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />} label="Inicio" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="album"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={<BookOpenIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />} label="Álbum" focused={focused} />
            ),
          }}
        />

        {/* Botón central del Scanner */}
        <Tabs.Screen
          name="scan"
          options={{
            tabBarIcon: () => (
              <View style={styles.scanTabBtn}>
                <Camera size={24} color={Colors.white} weight="fill" />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault(); // Evita navegar a una ruta "scan" inexistente
              setScannerOpen(true);
            },
          }}
        />

        <Tabs.Screen
          name="intercambios"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={<ArrowsLeftRight size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.trade : Colors.textMuted} />} label="Cambios" focused={focused} accentColor={Colors.trade} />
            ),
          }}
        />
        <Tabs.Screen
          name="historial"
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={<ClockIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />} label="Historial" focused={focused} />
            ),
          }}
        />

        {/* Pantallas ocultas — accesibles por ruta pero sin tab */}
        <Tabs.Screen name="faltan"    options={{ href: null }} />
        <Tabs.Screen name="repetidos" options={{ href: null }} />
        <Tabs.Screen name="tengo"     options={{ href: null }} />
        <Tabs.Screen name="buscar"    options={{ href: null }} />
        <Tabs.Screen name="two"       options={{ href: null }} />
      </Tabs>

      <ScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: Platform.OS === 'ios' ? 85 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 60,
  },
  tabLabel: {
    ...Typography.labelS,
    color: Colors.textMuted,
  },
  scanTabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'ios' ? -15 : -10,
    borderWidth: 4,
    borderColor: Colors.bgCard,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});

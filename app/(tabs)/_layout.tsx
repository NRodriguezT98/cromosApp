import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  HouseIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  ClockIcon,
} from 'phosphor-react-native';
import { Colors, Typography } from '@/constants/theme';

function TabIcon({ icon, label, focused }: { icon: React.ReactNode; label: string; focused: boolean }) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemFocused]}>
      {icon}
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
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
            <TabIcon
              icon={<HouseIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />}
              label="Inicio"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="album"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<BookOpenIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />}
              label="Álbum"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<MagnifyingGlassIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />}
              label="Buscar"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<ClockIcon size={22} weight={focused ? 'fill' : 'regular'} color={focused ? Colors.red : Colors.textMuted} />}
              label="Historial"
              focused={focused}
            />
          ),
        }}
      />

      {/* Pantallas ocultas — accesibles por ruta pero sin tab */}
      <Tabs.Screen name="faltan"    options={{ href: null }} />
      <Tabs.Screen name="repetidos" options={{ href: null }} />
      <Tabs.Screen name="tengo"     options={{ href: null }} />
      <Tabs.Screen name="two"       options={{ href: null }} />
    </Tabs>
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
  tabItemFocused: {
    backgroundColor: Colors.redSoft,
  },
  tabLabel: {
    ...Typography.labelS,
    color: Colors.textMuted,
  },
  tabLabelFocused: {
    color: Colors.red,
  },
});

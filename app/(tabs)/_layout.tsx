import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BookOpen, ChefHat, Home, NotebookPen } from 'lucide-react-native';


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.tabBarActive,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarStyle: {
          backgroundColor: COLORS.tabBarBackground,
          borderTopColor: COLORS.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...Platform.select({
            ios: {
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.1,
              shadowRadius: 16,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="(home)/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, size }) => (
            <Home
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-home-icon"
            />
          ),
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="learn/index"
        options={{
          title: 'Learn',
          tabBarIcon: ({ focused, size }) => (
            <BookOpen
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-learn-icon"
            />
          ),
          tabBarLabel: 'Learn',
        }}
      />
      <Tabs.Screen
        name="cook/index"
        options={{
          title: 'Cook',
          tabBarIcon: ({ focused, size }) => (
            <ChefHat
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-cook-icon"
            />
          ),
          tabBarLabel: 'Cook',
        }}
      />

      <Tabs.Screen
        name="cook/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="journal/index"
        options={{
          title: 'Journal',
          tabBarIcon: ({ focused, size }) => (
            <NotebookPen
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-journal-icon"
            />
          ),
          tabBarLabel: 'Journal',
        }}
      />
    </Tabs>
  );
}



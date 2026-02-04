import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BookOpen, ChefHat, Home, NotebookPen, UserCircle2 } from 'lucide-react-native';


export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="learn"
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
        name="(home)"
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
        name="journal"
        options={{
          title: 'Collection',
          tabBarIcon: ({ focused, size }) => (
            <NotebookPen
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-collection-icon"
            />
          ),
          tabBarLabel: 'Collection',
        }}
      />
      <Tabs.Screen
        name="cook"
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
        name="learn"
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, size }) => (
            <UserCircle2
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-profile-icon"
            />
          ),
          tabBarLabel: 'Profile',
        }}
      />
    </Tabs>
  );
}



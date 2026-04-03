import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BookOpen, ChefHat, Camera, NotebookPen, Users } from 'lucide-react-native';


export default function TabLayout() {
  const initialRouteName: 'journal' | 'learn' = Platform.OS === 'web' ? 'journal' : 'learn';

  return (
    <View style={tabStyles.root}>
    <Tabs
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.tabBarActive,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarStyle: {
          backgroundColor: COLORS.overlay,
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
          title: 'Capture',
          tabBarIcon: ({ focused, size }) => (
            <Camera
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-home-icon"
            />
          ),
          tabBarLabel: 'Capture',
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
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ focused, size }) => (
            <Users
              color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive}
              size={typeof size === 'number' && Number.isFinite(size) ? Math.round(size) : 24}
              testID="tab-community-icon"
            />
          ),
          tabBarLabel: 'Community',
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
          href: null,
        }}
      />
    </Tabs>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});



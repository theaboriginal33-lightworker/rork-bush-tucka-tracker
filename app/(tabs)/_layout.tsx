import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Home, NotebookPen, Soup } from 'lucide-react-native';

type TabGlyphProps = {
  label: string;
  size: number;
  focused: boolean;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  testID: string;
};

function TabGlyph({ label, size, focused, icon: Icon, testID }: TabGlyphProps) {
  const strokeColor = focused ? COLORS.tabBarActive : COLORS.tabBarInactive;
  const opacity = focused ? 1 : 0.7;
  const iconSize = useMemo(() => Math.round(size * 1.05), [size]);

  return (
    <View style={styles.glyphWrap} testID={testID}>
      <View style={[styles.glyphIconWrap, focused ? styles.glyphIconWrapFocused : null]}>
        <Icon size={iconSize} color={strokeColor} />
      </View>
      <Text style={[styles.glyphLabel, { color: strokeColor, opacity }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

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
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, focused }) => (
            <TabGlyph label="Home" size={size} focused={focused} icon={Home} testID="tab-home" />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ size, focused }) => (
            <TabGlyph label="Learn" size={size} focused={focused} icon={BookOpen} testID="tab-learn" />
          ),
        }}
      />
      <Tabs.Screen
        name="cook"
        options={{
          title: 'Cook',
          tabBarIcon: ({ size, focused }) => (
            <TabGlyph label="Cook" size={size} focused={focused} icon={Soup} testID="tab-cook" />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ size, focused }) => (
            <TabGlyph label="Journal" size={size} focused={focused} icon={NotebookPen} testID="tab-journal" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 2,
    width: 78,
  },
  glyphIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphIconWrapFocused: {
    backgroundColor: 'rgba(56, 217, 137, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56, 217, 137, 0.35)',
  },
  glyphLabel: {
    marginTop: 2,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

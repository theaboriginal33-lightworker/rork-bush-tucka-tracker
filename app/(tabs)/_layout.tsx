import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BookOpen, ChefHat, Home, NotebookPen } from 'lucide-react-native';

type TabGlyphProps = {
  label: string;
  size?: number;
  focused: boolean;
  Icon: React.ComponentType<{ color?: string; size?: number }>;
  testID?: string;
};

function TabGlyph({ label, size, focused, Icon, testID }: TabGlyphProps) {
  const strokeColor = focused ? COLORS.tabBarActive : COLORS.tabBarInactive;
  const opacity = focused ? 1 : 0.8;

  const iconSize = useMemo(() => {
    const safeSize = Number.isFinite(size) && (size ?? 0) > 0 ? (size as number) : 24;
    return Math.round(safeSize);
  }, [size]);

  React.useEffect(() => {
    console.log('[TabGlyph] render', { label, focused, size, iconSize });
  }, [focused, iconSize, label, size]);

  return (
    <View style={styles.glyphWrap} testID={testID}>
      <View
        style={[styles.glyphIconWrap, focused ? styles.glyphIconWrapFocused : null]}
        pointerEvents="none">
        <View style={styles.iconCenter}>
          <Icon color={strokeColor} size={iconSize} />
        </View>
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
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 2,
        },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, size }) => (
            <TabGlyph label="Home" size={size} focused={focused} Icon={Home} testID="tab-home" />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ focused, size }) => (
            <TabGlyph label="Learn" size={size} focused={focused} Icon={BookOpen} testID="tab-learn" />
          ),
        }}
      />
      <Tabs.Screen
        name="cook"
        options={{
          title: 'Cook',
          tabBarIcon: ({ focused, size }) => (
            <TabGlyph label="Cook" size={size} focused={focused} Icon={ChefHat} testID="tab-cook" />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ focused, size }) => (
            <TabGlyph label="Journal" size={size} focused={focused} Icon={NotebookPen} testID="tab-journal" />
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
    paddingTop: 2,
    paddingBottom: 2,
    paddingHorizontal: 4,
    minWidth: 56,
  },
  glyphIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphIconWrapFocused: {
    backgroundColor: 'rgba(56, 217, 137, 0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56, 217, 137, 0.35)',
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphLabel: {
    marginTop: 3,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

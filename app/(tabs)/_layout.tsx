import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BookOpen, Home, NotebookPen, Soup } from 'lucide-react-native';

type TabGlyphProps = {
  label: string;
  size: number;
  focused: boolean;
  icon: React.ComponentType<{ size?: number; color?: string }>;
};

type TabGlyphButtonProps = TabGlyphProps & {
  testID: string;
  onPress?: PressableProps['onPress'];
};

function TabGlyph({ label, size, focused, icon: Icon }: TabGlyphProps) {
  const strokeColor = focused ? COLORS.tabBarActive : COLORS.tabBarInactive;
  const opacity = focused ? 1 : 0.75;

  const iconSize = useMemo(() => {
    const safeSize = Number.isFinite(size) && size > 0 ? size : 24;
    return Math.round(safeSize * 1.05);
  }, [size]);

  return (
    <View style={styles.glyphWrap}>
      <View style={[styles.glyphIconWrap, focused ? styles.glyphIconWrapFocused : null]}>
        <Icon size={iconSize} color={strokeColor} />
      </View>
      <Text style={[styles.glyphLabel, { color: strokeColor, opacity }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const TabGlyphButton = React.memo(function TabGlyphButton({
  label,
  size,
  focused,
  icon,
  testID,
  onPress,
}: TabGlyphButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={(e) => {
        console.log('[TabBar] press', { label });
        void Haptics.selectionAsync();
        onPress?.(e);
      }}
      style={({ pressed }) => [styles.glyphButton, pressed ? styles.glyphButtonPressed : null]}>
      <TabGlyph label={label} size={size} focused={focused} icon={icon} />
    </Pressable>
  );
});

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
          paddingVertical: 4,
        },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarButton: (props) => (
            <TabGlyphButton
              label="Home"
              size={24}
              focused={!!props.accessibilityState?.selected}
              icon={Home}
              testID="tab-home"
              onPress={props.onPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarButton: (props) => (
            <TabGlyphButton
              label="Learn"
              size={24}
              focused={!!props.accessibilityState?.selected}
              icon={BookOpen}
              testID="tab-learn"
              onPress={props.onPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cook"
        options={{
          title: 'Cook',
          tabBarButton: (props) => (
            <TabGlyphButton
              label="Cook"
              size={24}
              focused={!!props.accessibilityState?.selected}
              icon={Soup}
              testID="tab-cook"
              onPress={props.onPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarButton: (props) => (
            <TabGlyphButton
              label="Journal"
              size={24}
              focused={!!props.accessibilityState?.selected}
              icon={NotebookPen}
              testID="tab-journal"
              onPress={props.onPress}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyphButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphButtonPressed: {
    opacity: 0.7,
  },
  glyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 2,
    width: 86,
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

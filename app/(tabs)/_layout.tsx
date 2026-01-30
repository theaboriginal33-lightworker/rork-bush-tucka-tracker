import { Tabs } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BookOpen, NotebookPen, Scan, Soup } from 'lucide-react-native';

type TabIconProps = {
  uri: string;
  size: number;
  focused: boolean;
  fallback: React.ComponentType<{ size?: number; color?: string }>;
};

function TabIcon({ uri, size, focused, fallback: FallbackIcon }: TabIconProps) {
  const [failed, setFailed] = useState<boolean>(false);

  const onError = useCallback(() => {
    console.log('[TabIcon] image failed to load', { uri });
    setFailed(true);
  }, [uri]);

  const iconSize = useMemo(() => size + 6, [size]);
  const opacity = focused ? 1 : 0.55;

  if (failed) {
    return (
      <View style={styles.fallbackIconWrap} testID="tab-icon-fallback">
        <FallbackIcon size={size + 2} color={focused ? COLORS.tabBarActive : COLORS.tabBarInactive} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.icon, { width: iconSize, height: iconSize, opacity }]}
      contentFit="contain"
      onError={onError}
      testID="tab-icon-image"
    />
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
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 10,
          marginBottom: 4,
          letterSpacing: 0.2,
        },
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Scan',
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              uri="https://r2-pub.rork.com/generated-images/7f530dd0-60dd-4a50-b702-9690b973a15c.png"
              size={size}
              focused={focused}
              fallback={Scan}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              uri="https://r2-pub.rork.com/generated-images/f88ee39a-ac6d-47ce-b519-180b4c41710f.png"
              size={size}
              focused={focused}
              fallback={BookOpen}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cook"
        options={{
          title: 'Cook',
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              uri="https://r2-pub.rork.com/generated-images/16b4b4cc-fc89-4794-86b2-3efae9d89d58.png"
              size={size}
              focused={focused}
              fallback={Soup}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ size, focused }) => (
            <TabIcon
              uri="https://r2-pub.rork.com/generated-images/225c99f9-6b3d-43e4-8dfa-dce7ae89bbf0.png"
              size={size}
              focused={focused}
              fallback={NotebookPen}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    marginTop: 4,
  },
  fallbackIconWrap: {
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

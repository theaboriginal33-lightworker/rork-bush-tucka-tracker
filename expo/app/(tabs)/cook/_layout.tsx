import { Stack } from 'expo-router';
import React from 'react';

export default function CookLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="guide/[id]" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

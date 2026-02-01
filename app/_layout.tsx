// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CookbookProvider } from "@/app/providers/CookbookProvider";
import { ScanJournalProvider } from "@/app/providers/ScanJournalProvider";

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync().catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.log('[SplashScreen] preventAutoHideAsync failed', { message });
});

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="scan/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [splashHidden, setSplashHidden] = useState<boolean>(false);

  useEffect(() => {
    console.log('[RootLayout] mounted');

    let cancelled = false;
    void SplashScreen.hideAsync()
      .then(() => {
        console.log('[SplashScreen] hideAsync ok');
        if (!cancelled) setSplashHidden(true);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[SplashScreen] hideAsync failed', { message });
        if (!cancelled) setSplashHidden(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!splashHidden) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#07110B',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        testID="app-starting-container">
        <Text style={{ color: '#EAF6EE', fontSize: 16, fontWeight: '700', textAlign: 'center' }} testID="app-starting-title">
          Starting…
        </Text>
        <Text style={{ color: '#9BB3A4', marginTop: 10, textAlign: 'center' }} testID="app-starting-subtitle">
          Loading the app UI
        </Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ScanJournalProvider>
        <CookbookProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </CookbookProvider>
      </ScanJournalProvider>
    </QueryClientProvider>
  );
}

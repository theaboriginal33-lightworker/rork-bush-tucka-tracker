// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
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
  useEffect(() => {
    console.log('[RootLayout] mounted');
    void SplashScreen.hideAsync()
      .then(() => {
        console.log('[SplashScreen] hideAsync ok');
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[SplashScreen] hideAsync failed', { message });
      });
  }, []);

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

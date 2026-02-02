import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CookbookProvider } from "@/app/providers/CookbookProvider";
import { ScanJournalProvider } from "@/app/providers/ScanJournalProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

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
  console.log('[RootLayout] render');

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ScanJournalProvider>
            <CookbookProvider>
              <RootLayoutNav />
            </CookbookProvider>
          </ScanJournalProvider>
        </GestureHandlerRootView>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

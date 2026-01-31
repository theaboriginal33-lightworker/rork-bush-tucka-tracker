// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
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
  const [fontsLoaded, fontError] = useFonts({});

  useEffect(() => {
    console.log('[RootLayout] mounted', { fontsLoaded, hasFontError: !!fontError });
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    console.log('[RootLayout] ready to hide splash', {
      fontsLoaded,
      hasFontError: !!fontError,
      fontErrorMessage: fontError instanceof Error ? fontError.message : String(fontError ?? ''),
    });

    void SplashScreen.hideAsync()
      .then(() => {
        console.log('[SplashScreen] hideAsync ok');
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[SplashScreen] hideAsync failed', { message });
      });
  }, [fontError, fontsLoaded]);

  if (fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07110B', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#EAF6EE', fontSize: 16, fontWeight: '700', textAlign: 'center' }} testID="font-load-error-title">
          Failed to load icon fonts
        </Text>
        <Text style={{ color: '#9BB3A4', marginTop: 10, textAlign: 'center' }} testID="font-load-error-message">
          {fontError instanceof Error ? fontError.message : String(fontError)}
        </Text>
      </View>
    );
  }

  if (!fontsLoaded) {
    return null;
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

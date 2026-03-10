import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CookbookProvider } from "@/app/providers/CookbookProvider";
import { LearnImageProvider } from "@/app/providers/LearnImageProvider";
import { ScanJournalProvider } from "@/app/providers/ScanJournalProvider";
import { CommunityProvider } from "@/app/providers/CommunityProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";


function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, isReady, hasConfig } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => {
    const inAuthGroup = segments?.[0] === 'auth';
    console.log('[AuthGate] check', {
      isReady,
      hasConfig,
      hasSession: Boolean(session),
      inAuthGroup,
      pathname,
      segments,
    });

    if (!isReady) return;
    if (!hasConfig) return;

    if (!session && !inAuthGroup) {
      console.log('[AuthGate] redirect -> /auth');
      try {
        router.replace('/auth');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[AuthGate] router.replace failed', { message });
      }
      return;
    }

    if (session && inAuthGroup) {
      console.log('[AuthGate] redirect -> /(tabs)');
      try {
        router.replace('/');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[AuthGate] router.replace failed', { message });
      }
    }
  }, [isReady, hasConfig, session, segments, pathname]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="scan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="pocket-guides/cultural-respect-on-country" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="pocket-guides/animal-care-and-share" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="pocket-guides/foraging-with-kids" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="pocket-guides/if-something-goes-wrong" options={{ headerShown: false, presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  console.log('[RootLayout] render');

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthProvider>
            <ScanJournalProvider>
              <CookbookProvider>
                <LearnImageProvider>
                  <CommunityProvider>
                    <AuthGate>
                      <RootLayoutNav />
                    </AuthGate>
                  </CommunityProvider>
                </LearnImageProvider>
              </CookbookProvider>
            </ScanJournalProvider>
          </AuthProvider>
        </GestureHandlerRootView>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

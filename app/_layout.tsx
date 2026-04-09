import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, usePathname, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CookbookProvider } from "@/app/providers/CookbookProvider";
import { LearnImageProvider } from "@/app/providers/LearnImageProvider";
import { ScanJournalProvider } from "@/app/providers/ScanJournalProvider";
import { CommunityProvider } from "@/app/providers/CommunityProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";
import { supabase } from '@/constants/supabase';



function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, isReady, hasConfig, onboardingCompleted, subscriptionActive } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => {
    const inAuthGroup = segments?.[0] === 'auth';
    const inOnboarding = segments?.[0] === 'onboarding';
    const inPaywall = segments?.[0] === 'paywall';
    // Allow revisiting intro video from Settings after onboarding is done (expo-video test / preview).
    const isPlayVideoScreen = segments?.[1] === 'playvideo';

    if (!isReady) return; 
    if (!hasConfig) return;

    // Allow onboarding without a session so phone OTP can create the auth session on verify.
    if (!session) {
      if (!inAuthGroup && !inOnboarding) router.replace('/auth');
      return;
    }

   if (onboardingCompleted === null && !inOnboarding) {
  router.replace('/onboarding');
  return;
}

if (onboardingCompleted === false && !inOnboarding) {
  router.replace('/onboarding');
  return;
}

    // After login (and after onboarding is completed), route based on subscription.
    // Active subscription -> main app. Inactive/unknown -> paywall.
    if (onboardingCompleted === true && inAuthGroup) {
      if (subscriptionActive === true) {
        router.replace('/');
      } else {
        router.replace('/paywall/paywall');
      }
      return;
    }

    // After onboarding is completed, require an active subscription to use the app.
    // If subscription is NOT confirmed active (false or null), force the paywall and block all other routes.
    if (onboardingCompleted === true && subscriptionActive !== true) {
      if (!inPaywall) {
        router.replace('/paywall/paywall');
      }
      return;
    }

    // IMPORTANT: Allow opening the paywall from Settings even if subscribed
    // (users may want to change plans / restore / manage).

    if (onboardingCompleted && (inAuthGroup || (inOnboarding && !isPlayVideoScreen))) {
      router.replace('/');
    }

  }, [isReady, hasConfig, session, onboardingCompleted, subscriptionActive, segments, pathname]);

  return <>{children}</>;
}

  
function GestureWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="scan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false }} />
      <Stack.Screen name="map" options={{ headerShown: false }} />
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

  useEffect(() => {
    if (Platform.OS === 'web') return;

    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

   const iosApiKey = 'appl_QpqHbDZfeZExbXsXsPYUXlpPGOZ';
    const androidApiKey = 'test_MMHuIjBwrJjpTreIYTwyLbBWXfW';

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: androidApiKey });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <GestureWrapper>
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
        </GestureWrapper>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

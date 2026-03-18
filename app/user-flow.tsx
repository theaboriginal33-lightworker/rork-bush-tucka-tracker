import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

const SECTION_ACCENT = '#38D989';
const FLOW_LINE = 'rgba(56,217,137,0.25)';

type FlowStep = {
  step: string;
  screen: string;
  action: string;
  result: string;
  notes?: string;
};

type FlowSection = {
  id: string;
  title: string;
  description: string;
  steps: FlowStep[];
};

const USER_FLOWS: FlowSection[] = [
  {
    id: 'auth',
    title: '1. Authentication Flow',
    description: 'New and returning users sign in or create an account to sync data across devices.',
    steps: [
      {
        step: '1.1',
        screen: 'Splash Screen',
        action: 'App launches',
        result: 'App displays splash screen while checking authentication state and Supabase configuration.',
      },
      {
        step: '1.2',
        screen: 'Auth Screen (/auth)',
        action: 'User is not signed in',
        result: 'AuthGate redirects to Auth screen. User sees Welcome message, email and password fields, and Log in / Sign up toggle.',
      },
      {
        step: '1.3a',
        screen: 'Auth Screen — Sign Up',
        action: 'User taps "Sign up" tab, enters email + password (6+ chars), taps "Create account"',
        result: 'Account is created via Supabase. If email confirmation is enabled, user sees alert to check inbox. On success, redirected to main app.',
      },
      {
        step: '1.3b',
        screen: 'Auth Screen — Log In',
        action: 'User taps "Log in" tab, enters email + password, taps "Log in"',
        result: 'Session is established. AuthGate detects session and redirects to /(tabs) — the main app.',
      },
      {
        step: '1.4',
        screen: 'Auth Screen — Reset Password',
        action: 'User enters email, taps "Reset password"',
        result: 'Password reset email sent via Supabase. User sees confirmation alert.',
        notes: 'Email must be valid format. Error shown if Supabase is not configured.',
      },
      {
        step: '1.5',
        screen: 'Auth Screen — Error States',
        action: 'Invalid credentials or network error',
        result: 'Inline error banner appears below password field with descriptive message. Debug banner shown in __DEV__ mode if API key issues detected.',
      },
    ],
  },
  {
    id: 'capture',
    title: '2. Capture & Scan Flow',
    description: 'Core feature — users photograph native Australian plants and get AI-powered identification using Google Gemini.',
    steps: [
      {
        step: '2.1',
        screen: 'Capture Tab (/(tabs)/(home))',
        action: 'User navigates to Capture tab',
        result: 'Camera/scan interface loads with dark themed UI. User sees scan button, gallery picker, mode toggle (Identify / 360 Identify), and settings access.',
      },
      {
        step: '2.2a',
        screen: 'Capture — Take Photo',
        action: 'User taps camera/scan button',
        result: 'Device camera launches. User takes photo of a plant. Photo is captured and displayed as preview.',
      },
      {
        step: '2.2b',
        screen: 'Capture — Pick from Gallery',
        action: 'User taps gallery icon',
        result: 'Image picker opens. User selects existing photo from device library. Selected image displays as preview.',
      },
      {
        step: '2.3',
        screen: 'Capture — Mode Selection',
        action: 'User toggles between "Identify" and "360 Identify"',
        result: 'Identify mode: 1 photo required. 360 Identify mode: 3 photos required (front, side, close-up) for higher accuracy.',
        notes: '360 mode requires all 3 angles before scan can proceed.',
      },
      {
        step: '2.4',
        screen: 'Capture — AI Analysis',
        action: 'User taps scan/analyse button',
        result: 'Progress phases display: Preparing → Sending to AI → Processing. Gemini API analyses the image(s) and returns structured plant data.',
      },
      {
        step: '2.5',
        screen: 'Capture — Results',
        action: 'Scan completes successfully',
        result: 'Result includes: common name, scientific name, confidence score, safety status, edible parts, bush tucker classification, preparation notes, warnings, and cultural notes.',
      },
      {
        step: '2.6',
        screen: 'Capture — Save to Collection',
        action: 'Result auto-saved to journal',
        result: 'Scan entry created with unique ID, image URI, scan data, and timestamp. Entry appears in Collection tab.',
      },
      {
        step: '2.7',
        screen: 'Capture — View Details',
        action: 'User taps to view full scan details',
        result: 'Navigates to /scan/[id] — the full scan details screen.',
      },
    ],
  },
  {
    id: 'scan-details',
    title: '3. Scan Details Flow',
    description: 'Deep dive into a scanned plant with AI-powered chat, sharing, and export options.',
    steps: [
      {
        step: '3.1',
        screen: 'Scan Details (/scan/[id])',
        action: 'User opens a scan entry',
        result: 'Full detail view loads with hero image, plant name, scientific name, confidence badge, safety status, and all identification data.',
      },
      {
        step: '3.2',
        screen: 'Scan Details — Tucka Guide AI Chat',
        action: 'User scrolls to chat section and types a question',
        result: 'AI-powered chat (via Rork Agent) provides contextual answers about the scanned plant — preparation methods, safety details, cultural significance, seasonal info.',
        notes: 'Chat messages are persisted per scan entry.',
      },
      {
        step: '3.3',
        screen: 'Scan Details — Save to Cookbook',
        action: 'User taps "Save to Cook" button',
        result: 'Plant data is saved to the Cookbook provider. Entry appears in the Cook tab as a saved ingredient.',
      },
      {
        step: '3.4',
        screen: 'Scan Details — Location',
        action: 'User taps map/location button',
        result: 'If location permission granted, coordinates are attached to the scan. Opens in device maps app.',
      },
      {
        step: '3.5',
        screen: 'Scan Details — Share',
        action: 'User taps share button',
        result: 'Native share sheet opens with a share URL for the scan entry.',
      },
      {
        step: '3.6',
        screen: 'Scan Details — Export PDF',
        action: 'User taps PDF/download button',
        result: 'HTML report generated with all scan data and image. expo-print creates PDF. On native, file is saved and share sheet opens. On web, print dialog appears.',
      },
      {
        step: '3.7',
        screen: 'Scan Details — Delete',
        action: 'User taps delete/trash button',
        result: 'Confirmation alert appears. On confirm, entry is removed from journal. User is navigated back.',
      },
    ],
  },
  {
    id: 'collection',
    title: '4. Collection (Journal) Flow',
    description: 'Users browse, manage, and revisit their saved plant scans.',
    steps: [
      {
        step: '4.1',
        screen: 'Collection Tab (/(tabs)/journal)',
        action: 'User navigates to Collection tab',
        result: 'FlatList displays all saved scan entries with thumbnail image, plant name, date (month/day), safety tags, and bush tucker badge.',
      },
      {
        step: '4.2',
        screen: 'Collection — Browse Entries',
        action: 'User scrolls through collection',
        result: 'Each card shows: plant image, common name, scan date, safety status tag, confidence indicator, and "Observe only" warning if confidence < 75% or unsafe.',
      },
      {
        step: '4.3',
        screen: 'Collection — Open Entry',
        action: 'User taps a collection card',
        result: 'Navigates to /scan/[id] with full plant details (see Flow 3).',
      },
      {
        step: '4.4',
        screen: 'Collection — Delete Entry',
        action: 'User taps delete icon on a card',
        result: 'Confirmation alert. On confirm, entry removed from AsyncStorage and list updates.',
      },
      {
        step: '4.5',
        screen: 'Collection — Clear All',
        action: 'User taps "Clear collection" in header',
        result: 'Destructive confirmation alert. On confirm, all entries removed from device storage.',
      },
      {
        step: '4.6',
        screen: 'Collection — Empty State',
        action: 'No scans saved yet',
        result: 'Empty state message: "Cook pulls from Collection + saved Tucka Guide answers." Encourages user to scan first plant.',
      },
    ],
  },
  {
    id: 'cook',
    title: '5. Cook (Cookbook) Flow',
    description: 'Users manage saved ingredients and access AI-generated cooking guides for native plants.',
    steps: [
      {
        step: '5.1',
        screen: 'Cook Tab (/(tabs)/cook)',
        action: 'User navigates to Cook tab',
        result: 'Displays saved ingredients from scans and Tucka Guide answers. Search bar at top. Each ingredient card shows image, name, scientific name, and source.',
      },
      {
        step: '5.2',
        screen: 'Cook — Search',
        action: 'User types in search bar',
        result: 'Real-time filtering by common name, scientific name, or title. List updates as user types.',
      },
      {
        step: '5.3',
        screen: 'Cook — Ingredient Card',
        action: 'User taps an ingredient',
        result: 'Navigates to /cook/guide/[id] — the full cooking guide for that ingredient.',
      },
      {
        step: '5.4',
        screen: 'Cook — Add Image',
        action: 'User taps image upload icon on ingredient card',
        result: 'Image picker opens. Selected photo is attached to the ingredient entry and displayed on the card.',
      },
      {
        step: '5.5',
        screen: 'Cook Guide (/cook/guide/[id])',
        action: 'User opens a cooking guide',
        result: 'Full recipe/preparation view with hero image, ingredient details, preparation steps, cultural notes, warnings, and suggested uses.',
      },
      {
        step: '5.6',
        screen: 'Cook Guide — Edit Notes',
        action: 'User taps edit icon',
        result: 'Inline text editor opens for personal notes on the recipe.',
      },
      {
        step: '5.7',
        screen: 'Cook Guide — Share & Export',
        action: 'User taps share or PDF button',
        result: 'Share: native share sheet with share URL. PDF: generates printable recipe card with all details and image.',
      },
      {
        step: '5.8',
        screen: 'Cook Guide — Delete',
        action: 'User taps delete button',
        result: 'Confirmation alert. On confirm, recipe removed from cookbook. User navigated back to Cook list.',
      },
    ],
  },
  {
    id: 'community',
    title: '6. Community Map Flow',
    description: 'Location-based community features for sharing findings, spots, and recipes.',
    steps: [
      {
        step: '6.1',
        screen: 'Community Tab (/(tabs)/community)',
        action: 'User navigates to Community tab',
        result: 'Map/list view of community pins. Category filter bar at top: All, Findings, Spots, Recipes.',
      },
      {
        step: '6.2',
        screen: 'Community — Request Location',
        action: 'App requests location permission',
        result: 'On grant: user location detected, nearby pins sorted by distance. On deny: pins shown without distance calculation.',
        notes: 'Uses expo-location on native, web geolocation API on web.',
      },
      {
        step: '6.3',
        screen: 'Community — Browse Pins',
        action: 'User scrolls through pins',
        result: 'Each pin card shows: category emoji, title, description, distance (if location available), timestamp, and "Open in Maps" button.',
      },
      {
        step: '6.4',
        screen: 'Community — Filter by Category',
        action: 'User taps a category filter chip',
        result: 'Pin list filters to show only selected category. "All" shows everything.',
      },
      {
        step: '6.5',
        screen: 'Community — Add Pin',
        action: 'User taps "+" button',
        result: 'Modal form opens. User enters: title, description, selects category (Finding/Spot/Recipe), and optionally attaches coordinates.',
      },
      {
        step: '6.6',
        screen: 'Community — Pin Location',
        action: 'User taps location/navigation icon in add form',
        result: 'Current GPS coordinates attached to the pin. Pin will show distance to other users.',
      },
      {
        step: '6.7',
        screen: 'Community — Open in Maps',
        action: 'User taps "Open in Maps" on a pin',
        result: 'Opens device maps app (Apple Maps on iOS, Google Maps on Android, Google Maps web on browser) centered on pin coordinates.',
      },
      {
        step: '6.8',
        screen: 'Community — Delete Pin',
        action: 'User taps trash icon on own pin',
        result: 'Confirmation alert. On confirm, pin removed from community.',
      },
    ],
  },
  {
    id: 'learn',
    title: '7. Learn (Plant Database) Flow',
    description: 'Educational plant encyclopedia with detailed profiles fetched from Supabase.',
    steps: [
      {
        step: '7.1',
        screen: 'Learn Tab (/(tabs)/learn)',
        action: 'User navigates to Learn tab',
        result: 'Grid/list of native Australian plants with hero images, common names, scientific names, and category badges. Search bar and filter options at top.',
      },
      {
        step: '7.2',
        screen: 'Learn — Search',
        action: 'User types in search bar',
        result: 'Real-time filtering by common name, scientific name, or category. Results update as user types.',
      },
      {
        step: '7.3',
        screen: 'Learn — Filter',
        action: 'User taps filter icon',
        result: 'Filter options appear: by category (Fruit, Seed, Leaf, Root, etc.), bush tucker status, medicinal status, safety level.',
      },
      {
        step: '7.4',
        screen: 'Learn — Plant Card',
        action: 'User taps a plant card',
        result: 'Navigates to /learn/[id] — the full plant profile.',
      },
      {
        step: '7.5',
        screen: 'Plant Profile (/learn/[id])',
        action: 'User views plant details',
        result: 'Comprehensive profile: hero image, common name, scientific name, category, overview, edible parts, preparation basics, seasonality, warnings, lookalikes, cultural notes, and suggested uses.',
      },
      {
        step: '7.6',
        screen: 'Plant Profile — Custom Image',
        action: 'User taps image upload icon on plant',
        result: 'Image picker opens. User can set custom hero image for any plant in the database.',
      },
      {
        step: '7.7',
        screen: 'Learn — Fallback Data',
        action: 'Supabase unavailable or not configured',
        result: 'App displays built-in fallback plant data (Finger Lime, Lemon Aspen, Lemon Myrtle, etc.) so the Learn tab always has content.',
      },
      {
        step: '7.8',
        screen: 'Learn — Pull to Refresh',
        action: 'User pulls down on the list',
        result: 'Data re-fetched from Supabase. New or updated plants appear in the list.',
      },
    ],
  },
  {
    id: 'pocket-guides',
    title: '8. Pocket Guides Flow',
    description: 'Educational modal guides covering cultural respect, safety, and foraging practices.',
    steps: [
      {
        step: '8.1',
        screen: 'Pocket Guide Access',
        action: 'User taps a pocket guide link (from scan details or settings)',
        result: 'Modal slides up from bottom covering the screen. Beautifully designed guide with Aboriginal dot art imagery and ochre-toned design.',
      },
      {
        step: '8.2',
        screen: 'Cultural Respect on Country',
        action: 'User opens cultural respect guide',
        result: 'Sections cover: Walking on Country, Seasonal Awareness, Reciprocity & Sharing, Flora & Fauna Respect, Gratitude & Care, and Cultural Notes. Each section has icon, title, subtitle, and detailed body text.',
      },
      {
        step: '8.3',
        screen: 'Animal Care & Share',
        action: 'User opens animal care guide',
        result: 'Guide covers respectful interaction with native wildlife, sharing practices, and animal welfare in bush settings.',
      },
      {
        step: '8.4',
        screen: 'Foraging with Kids',
        action: 'User opens kids foraging guide',
        result: 'Family-friendly guide with safety tips, age-appropriate activities, supervision guidance, and educational foraging practices.',
      },
      {
        step: '8.5',
        screen: 'If Something Goes Wrong',
        action: 'User opens emergency guide',
        result: 'Emergency procedures: what to do if a plant is ingested, first aid steps, poison information contacts, and when to seek medical help.',
      },
      {
        step: '8.6',
        screen: 'Pocket Guide — Share',
        action: 'User taps share button within a guide',
        result: 'Native share sheet opens with guide content or link.',
      },
      {
        step: '8.7',
        screen: 'Pocket Guide — Close',
        action: 'User taps X or swipes down',
        result: 'Modal dismisses. User returns to previous screen.',
      },
    ],
  },
  {
    id: 'settings',
    title: '9. Settings & Profile Flow',
    description: 'Account management, app configuration, and support resources.',
    steps: [
      {
        step: '9.1',
        screen: 'Settings (/settings)',
        action: 'User taps settings icon from Capture tab header',
        result: 'Settings screen loads with dark themed UI, gradient header, and account status section.',
      },
      {
        step: '9.2',
        screen: 'Settings — Account Status',
        action: 'User views account section',
        result: 'Shows authentication state: signed in (masked email displayed), not signed in, or auth disabled. Shield icon with status indicator.',
      },
      {
        step: '9.3',
        screen: 'Settings — Sign In',
        action: 'User taps "Log in" button (when signed out)',
        result: 'Navigates to /auth screen for login/signup.',
      },
      {
        step: '9.4',
        screen: 'Settings — Sign Out',
        action: 'User taps "Sign out" button (when signed in)',
        result: 'Confirmation alert appears. On confirm: session cleared, user redirected to auth screen.',
      },
      {
        step: '9.5',
        screen: 'Settings — External Links',
        action: 'User taps support/resource links',
        result: 'Opens external URLs in device browser — support organizations, cultural resources, etc.',
      },
      {
        step: '9.6',
        screen: 'Settings — Back to App',
        action: 'User taps back arrow',
        result: 'Returns to previous screen (Capture tab).',
      },
    ],
  },
  {
    id: 'error-states',
    title: '10. Error & Edge Case Flows',
    description: 'How the app handles errors, missing data, and connectivity issues.',
    steps: [
      {
        step: '10.1',
        screen: 'App Error Boundary',
        action: 'Unhandled JavaScript error occurs',
        result: 'AppErrorBoundary catches error and displays fallback UI with error message and recovery options instead of crashing.',
      },
      {
        step: '10.2',
        screen: 'No Gemini API Key',
        action: 'User tries to scan without EXPO_PUBLIC_GEMINI_API_KEY configured',
        result: 'Scan button disabled or error message: "Gemini API key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY."',
      },
      {
        step: '10.3',
        screen: 'No Supabase Config',
        action: 'Supabase URL or anon key missing',
        result: 'Auth screen shows "Supabase not connected yet" banner. Learn tab falls back to local plant data. Debug info shown in dev mode.',
      },
      {
        step: '10.4',
        screen: 'Network Error During Scan',
        action: 'API call fails during plant identification',
        result: 'Error message displayed inline. User can retry the scan with the same image.',
      },
      {
        step: '10.5',
        screen: 'Location Permission Denied',
        action: 'User denies location access in Community tab',
        result: 'Community pins still display but without distance information. "Open in Maps" still works with pin coordinates.',
      },
      {
        step: '10.6',
        screen: 'Not Found',
        action: 'User navigates to invalid route',
        result: '+not-found.tsx renders a "Page not found" screen with navigation back to home.',
      },
    ],
  },
];

function FlowStepCard({ flowStep, isLast }: { flowStep: FlowStep; isLast: boolean }) {
  return (
    <View style={cardStyles.row}>
      <View style={cardStyles.timeline}>
        <View style={cardStyles.dot} />
        {!isLast && <View style={cardStyles.line} />}
      </View>
      <View style={[cardStyles.card, isLast && { marginBottom: 0 }]}>
        <View style={cardStyles.stepBadge}>
          <Text style={cardStyles.stepBadgeText}>{flowStep.step}</Text>
        </View>
        <Text style={cardStyles.screenLabel}>{flowStep.screen}</Text>
        <View style={cardStyles.actionRow}>
          <Text style={cardStyles.actionLabel}>Action:</Text>
          <Text style={cardStyles.actionText}>{flowStep.action}</Text>
        </View>
        <View style={cardStyles.resultRow}>
          <Text style={cardStyles.resultLabel}>Result:</Text>
          <Text style={cardStyles.resultText}>{flowStep.result}</Text>
        </View>
        {flowStep.notes ? (
          <View style={cardStyles.notesRow}>
            <Text style={cardStyles.notesLabel}>Note:</Text>
            <Text style={cardStyles.notesText}>{flowStep.notes}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function FlowSectionBlock({ section }: { section: FlowSection }) {
  return (
    <View style={sectionStyles.container}>
      <View style={sectionStyles.header}>
        <Text style={sectionStyles.title}>{section.title}</Text>
        <Text style={sectionStyles.description}>{section.description}</Text>
      </View>
      {section.steps.map((step, idx) => (
        <FlowStepCard key={step.step} flowStep={step} isLast={idx === section.steps.length - 1} />
      ))}
    </View>
  );
}

export default function UserFlowScreen() {
  const onShare = useCallback(async () => {
    try {
      await Share.share({
        message: 'Bush Tucka Tracker — User Flow Document',
        title: 'Bush Tucka Tracker User Flow',
      });
    } catch {
      console.log('[UserFlow] share failed');
    }
  }, []);

  return (
    <View style={pageStyles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={pageStyles.safe} edges={['top']}>
        <View style={pageStyles.topBar}>
          <Pressable onPress={() => router.back()} style={pageStyles.backBtn} testID="user-flow-back">
            <ChevronLeft color={COLORS.text} size={22} />
          </Pressable>
          <Text style={pageStyles.topTitle}>User Flow Document</Text>
          <Pressable onPress={onShare} style={pageStyles.shareBtn} testID="user-flow-share">
            <Share2 color={COLORS.text} size={20} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={pageStyles.scroll}
        contentContainerStyle={pageStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={pageStyles.heroSection}>
          <Text style={pageStyles.heroTitle}>Bush Tucka Tracker</Text>
          <Text style={pageStyles.heroSubtitle}>Complete User Flow & Screen Transcript</Text>
          <View style={pageStyles.metaRow}>
            <View style={pageStyles.metaBadge}>
              <Text style={pageStyles.metaText}>v1.0.0</Text>
            </View>
            <View style={pageStyles.metaBadge}>
              <Text style={pageStyles.metaText}>10 Flow Sections</Text>
            </View>
            <View style={pageStyles.metaBadge}>
              <Text style={pageStyles.metaText}>{USER_FLOWS.reduce((sum, s) => sum + s.steps.length, 0)} Steps</Text>
            </View>
          </View>
          <Text style={pageStyles.heroBody}>
            This document outlines every user-facing screen, interaction, and expected outcome in the Bush Tucka Tracker mobile application. It covers authentication, plant scanning with AI, collection management, cookbook features, community mapping, the plant learning database, pocket safety guides, settings, and error handling.
          </Text>
        </View>

        <View style={pageStyles.tocSection}>
          <Text style={pageStyles.tocTitle}>Table of Contents</Text>
          {USER_FLOWS.map((section) => (
            <View key={section.id} style={pageStyles.tocRow}>
              <View style={pageStyles.tocDot} />
              <Text style={pageStyles.tocText}>{section.title}</Text>
              <Text style={pageStyles.tocCount}>{section.steps.length} steps</Text>
            </View>
          ))}
        </View>

        {USER_FLOWS.map((section) => (
          <FlowSectionBlock key={section.id} section={section} />
        ))}

        <View style={pageStyles.footer}>
          <Text style={pageStyles.footerTitle}>Navigation Architecture</Text>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>Root Stack:</Text>
            <Text style={pageStyles.archValue}>(tabs), auth, settings, scan/[id], pocket-guides/*</Text>
          </View>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>Tab Bar:</Text>
            <Text style={pageStyles.archValue}>Capture | Collection | Cook | Community | Learn</Text>
          </View>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>Modals:</Text>
            <Text style={pageStyles.archValue}>Pocket Guides (4 guides, slide-up presentation)</Text>
          </View>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>Auth Guard:</Text>
            <Text style={pageStyles.archValue}>Unauthenticated users redirected to /auth. Authenticated users redirected from /auth to /.</Text>
          </View>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>State:</Text>
            <Text style={pageStyles.archValue}>React Query + Context Providers (Auth, ScanJournal, Cookbook, Community, LearnImages) + AsyncStorage persistence</Text>
          </View>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>AI Services:</Text>
            <Text style={pageStyles.archValue}>Google Gemini (plant identification), Rork Agent (Tucka Guide chat)</Text>
          </View>
          <View style={pageStyles.archRow}>
            <Text style={pageStyles.archLabel}>Backend:</Text>
            <Text style={pageStyles.archValue}>Supabase (auth, plant database, image storage)</Text>
          </View>
        </View>

        <View style={pageStyles.endSection}>
          <Text style={pageStyles.endText}>End of User Flow Document</Text>
          <Text style={pageStyles.endDate}>Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const pageStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07110B',
  },
  safe: {
    backgroundColor: '#07110B',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(56,217,137,0.15)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(56,217,137,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#EAF6EE',
    letterSpacing: -0.3,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(56,217,137,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  heroSection: {
    padding: 20,
    paddingTop: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(56,217,137,0.12)',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#EAF6EE',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: SECTION_ACCENT,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  metaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(56,217,137,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(234,246,238,0.8)',
  },
  heroBody: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: 'rgba(234,246,238,0.65)',
  },
  tocSection: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(56,217,137,0.12)',
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EAF6EE',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  tocDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SECTION_ACCENT,
  },
  tocText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(234,246,238,0.85)',
  },
  tocCount: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(234,246,238,0.45)',
  },
  footer: {
    margin: 20,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(56,217,137,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#EAF6EE',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  archRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    gap: 8,
  },
  archLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: SECTION_ACCENT,
    minWidth: 90,
  },
  archValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    color: 'rgba(234,246,238,0.7)',
  },
  endSection: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  endText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(234,246,238,0.35)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  endDate: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(234,246,238,0.25)',
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(56,217,137,0.12)',
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#EAF6EE',
    letterSpacing: -0.5,
  },
  description: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: 'rgba(234,246,238,0.6)',
  },
});

const cardStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: 80,
  },
  timeline: {
    width: 24,
    alignItems: 'center',
    paddingTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SECTION_ACCENT,
    borderWidth: 2,
    borderColor: 'rgba(56,217,137,0.4)',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: FLOW_LINE,
    marginTop: 4,
  },
  card: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(11,25,17,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,48,34,0.7)',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(56,217,137,0.12)',
    marginBottom: 6,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: SECTION_ACCENT,
    letterSpacing: 0.3,
  },
  screenLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EAF6EE',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(56,217,137,0.8)',
    minWidth: 50,
  },
  actionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: 'rgba(234,246,238,0.8)',
  },
  resultRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(88,166,255,0.8)',
    minWidth: 50,
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: 'rgba(234,246,238,0.65)',
  },
  notesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(234,246,238,0.08)',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(246,196,69,0.75)',
    minWidth: 50,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    color: 'rgba(234,246,238,0.5)',
    fontStyle: 'italic',
  },
});

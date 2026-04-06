
import React, { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShieldCheck,
  LogIn,
  LogOut,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  FileText,
  Scale,
  Trash2,
  Crown
} from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/constants/supabase';

const PRIVACY_POLICY_URL = 'https://bushtuckatracka.com.au/privacy-policy';
const TERMS_URL = 'https://bushtuckatracka.com.au/terms';

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email;
  const left = email.slice(0, at);
  const right = email.slice(at);
  const maskedLeft = `${left.slice(0, 1)}${'•'.repeat(Math.max(0, left.length - 2))}${left.slice(-1)}`;
  return `${maskedLeft}${right}`;
}

export default function SettingsScreen() {
  const { user, hasConfig, isReady, signOut } = useAuth();

  const headerGlow = useRef<Animated.Value>(new Animated.Value(0)).current;

  const authState = useMemo(() => {
    if (!hasConfig) return { title: 'Auth disabled', subtitle: 'Connect Supabase to enable login & sync.' };
    if (!isReady) return { title: 'Checking session…', subtitle: 'Hang tight — verifying your login.' };
    if (!user) return { title: 'Not signed in', subtitle: 'Log in to sync your collections across devices.' };

    const email = typeof user.email === 'string' ? user.email : null;
if (!email) return { title: 'Signed in', subtitle: 'Your account is active.' };
return { title: 'Signed in', subtitle: email };
  }, [hasConfig, isReady, user]);

  const runHeaderPulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(headerGlow, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(headerGlow, {
        toValue: 0,
        duration: 520,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [headerGlow]);

  const onPressLogin = useCallback(() => {
    console.log('[Settings] navigate -> /auth');
    runHeaderPulse();
    try {
      router.push('/auth');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Settings] router.push(/auth) failed', { message });
      Alert.alert('Navigation failed', message);
    }
  }, [runHeaderPulse]);

  const onPressSignOut = useCallback(() => {
    runHeaderPulse();

    Alert.alert('Sign out?', 'You will need to log in again to sync your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut().catch((e) => {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Settings] signOut failed', { message });
            Alert.alert('Could not sign out', message);
          });
        },
      },
    ]);
  }, [runHeaderPulse, signOut]);

  const onPressSupabase = useCallback(async () => {
    runHeaderPulse();
    const url = 'https://supabase.com/dashboard';
    try {
      const canOpen = await Linking.canOpenURL(url);
      console.log('[Settings] open link', { url, canOpen });
      if (!canOpen) {
        Alert.alert('Cannot open link', url);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Settings] openURL failed', { message });
      Alert.alert('Could not open link', message);
    }
  }, [runHeaderPulse]);



  const openLegalUrl = useCallback(
    async (url: string) => {
      runHeaderPulse();
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert('Cannot open link', url);
          return;
        }
        await Linking.openURL(url);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        Alert.alert('Could not open link', message);
      }
    },
    [runHeaderPulse]
  );

  const onPressDeleteAccount = useCallback(() => {
    if (!user) return;
    runHeaderPulse();
    Alert.alert(
      'Request Account Deletion',
      'We will send a deletion request to our support team. Your account will be removed within 7 business days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          style: 'destructive',
          onPress: () => {
            const email = typeof user.email === 'string' ? user.email : '';
            const subject = encodeURIComponent('Account Deletion Request');
            const body = encodeURIComponent(
              `Hello,\n\nI would like to request the deletion of my account.\n\nAccount Email: ${email}\n\nPlease confirm once my account has been removed.\n\nThank you.`
            );
            const mailtoUrl = `mailto:support@bushtuckatracka.com.au?subject=${subject}&body=${body}`;
  
            Linking.openURL(mailtoUrl).catch(() => {
              Alert.alert(
                'Could not open email',
                'Please contact us directly at support@bushtuckatracka.com.au to request account deletion.'
              );
            });
          },
        },
      ]
    );
  }, [user, runHeaderPulse]);

  const headerGlowOpacity = headerGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const headerGlowScale = headerGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const showBusy = hasConfig && !isReady;

  return (
    <View style={styles.root} testID="settings-root">
      <LinearGradient
        colors={["rgba(56,217,137,0.18)", "rgba(88,166,255,0.10)", COLORS.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topNav}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
            testID="settings-back"
          >
            <ChevronLeft size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.navTitle}>Settings</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header} testID="settings-header">
          <Animated.View
            pointerEvents="none"
            style={[
              styles.headerGlow,
              {
                opacity: headerGlowOpacity,
                transform: [{ scale: headerGlowScale }],
              },
            ]}
          />

          <View style={styles.headerTopRow}>
            <View style={styles.badge} testID="settings-badge">
              <ShieldCheck size={18} color={COLORS.primary} />
            </View>
            {showBusy ? (
              <View style={styles.busy} testID="settings-busy">
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : null}
          </View>

          <Text style={styles.subtitle} testID="settings-subtitle" numberOfLines={2}>
            {authState.subtitle}
          </Text>
        </View>

      

        <View style={styles.card} testID="settings-card">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} testID="settings-section-title">
              Account
            </Text>
          </View>

          {!hasConfig ? (
            <View style={styles.notice} testID="settings-notice-no-config">
              <Text style={styles.noticeTitle}>Supabase not connected</Text>
              <Text style={styles.noticeBody}>
                Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then reload.
              </Text>

              <Pressable
                onPress={onPressSupabase}
                style={({ pressed }) => [styles.rowButton, pressed ? styles.rowButtonPressed : null]}
                testID="settings-open-supabase"
              >
                <View style={styles.rowLeft}>
                  <ExternalLink size={18} color={COLORS.textSecondary} />
                  <Text style={styles.rowText}>Open Supabase dashboard</Text>
                </View>
                <ChevronRight size={18} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {hasConfig && user ? (
            <View style={styles.kv} testID="settings-kv">
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Status</Text>
                <Text style={styles.kvValue}>{authState.title}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Email</Text>
              <Text style={styles.kvValue}>{typeof user.email === 'string' ? user.email : '—'}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actions} testID="settings-actions">
            {hasConfig && !user ? (
              <Pressable
                onPress={onPressLogin}
                style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}
                testID="settings-login"
              >
                <View style={styles.primaryButtonInner}>
                  <LogIn size={18} color={'#06210F'} />
                  <Text style={styles.primaryButtonText}>Log in / Sign up</Text>
                </View>
              </Pressable>
            ) : null}

            {hasConfig && user ? (
              <Pressable
                onPress={onPressSignOut}
                style={({ pressed }) => [styles.dangerButton, pressed ? styles.dangerButtonPressed : null]}
                testID="settings-signout"
              >
                <View style={styles.primaryButtonInner}>
                  <LogOut size={18} color={COLORS.error} />
                  <Text style={styles.dangerButtonText}>Sign out</Text>
                </View>
              </Pressable>
            ) : null}

{hasConfig && user ? (
  <Pressable
    onPress={onPressDeleteAccount}
    style={({ pressed }) => [styles.dangerButton, pressed ? styles.dangerButtonPressed : null]}
    testID="settings-delete-account"
  >
    <View style={styles.primaryButtonInner}>
      <Trash2 size={18} color={COLORS.error} />
      <Text style={styles.dangerButtonText}>Request Account Deletion</Text>
    </View>
  </Pressable>
) : null}

            {hasConfig && !isReady ? (
              <Text style={styles.hint} testID="settings-hint">
                Checking your session…
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card} testID="settings-legal-card">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} testID="settings-legal-section-title">
              Legal
            </Text>
          </View>

          <View style={styles.card}>
  <Pressable
    onPress={() => router.push('/paywall/paywall')}
    style={({ pressed }) => [
      styles.primaryButton,
      pressed ? styles.primaryButtonPressed : null,
      { backgroundColor: '#4ade80' }
    ]}
  >
    <View style={styles.primaryButtonInner}>
      <Crown size={18} color="#051a05" />
      <Text style={[styles.primaryButtonText, { color: '#051a05' }]}>
        Upgrade to Premium
      </Text>
    </View>
  </Pressable>
  <Text style={[styles.hint, { marginTop: 8 }]}>
    Unlimited identifications · Tucka Guide · Offline maps
  </Text>
</View>

          <Pressable
            onPress={() => void openLegalUrl(PRIVACY_POLICY_URL)}
            style={({ pressed }) => [styles.legalRow, pressed ? styles.legalRowPressed : null]}
            testID="settings-privacy-policy"
          >
            <View style={styles.rowLeft}>
              <FileText size={18} color={COLORS.textSecondary} />
              <Text style={styles.rowText}>Privacy policy</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => void openLegalUrl(TERMS_URL)}
            style={({ pressed }) => [styles.legalRow, pressed ? styles.legalRowPressed : null]}
            testID="settings-terms"
          >
            <View style={styles.rowLeft}>
              <Scale size={18} color={COLORS.textSecondary} />
              <Text style={styles.rowText}>Terms of use</Text>
            </View>
            <ChevronRight size={18} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        {/* Upgrade card */}


        <View style={{ flex: 1 }} />
        <Image
          source={require('../assets/images/kangaroo.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  playVideoBanner: {
    marginHorizontal: 18,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(56,217,137,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playVideoBannerPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  playVideoBannerText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,217,137,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,217,137,0.18)',
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(11,25,17,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
  },
  busy: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,25,17,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(88,166,255,0.26)',
  },
  headerGlow: {
    position: 'absolute',
    top: 4,
    right: 18,
    width: 160,
    height: 110,
    borderRadius: 32,
    backgroundColor: 'rgba(56,217,137,0.10)',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    color: 'rgba(234,246,238,0.72)',
    maxWidth: 360,
  },
  card: {
    marginTop: 6,
    marginHorizontal: 18,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 7,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
  },
  notice: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(246,196,69,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,196,69,0.26)',
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.warning,
  },
  noticeBody: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: 'rgba(234,246,238,0.80)',
  },
  rowButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(7,17,11,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,196,69,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  legalRow: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(7,17,11,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legalRowPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  kv: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(15,36,24,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    marginBottom: 14,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  kvKey: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(234,246,238,0.55)',
  },
  kvValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    maxWidth: 220,
    textAlign: 'right',
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: '#06210F',
  },
  dangerButton: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,92,92,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.28)',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  dangerButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: COLORS.error,
  },
  hint: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
   heroImage: {
    
    right:"10%",
  width: 230,
  height: 200,
  bottom:"5%"
},
});

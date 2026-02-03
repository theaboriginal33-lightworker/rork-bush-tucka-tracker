import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Mail, ShieldCheck } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabasePublicDebugInfo } from '@/constants/supabase';

type AuthMode = 'login' | 'signup';

function isValidEmail(email: string): boolean {
  const value = email.trim();
  return value.includes('@') && value.includes('.') && value.length >= 6;
}

export default function AuthScreen() {
  const { signInWithPassword, signUpWithPassword, sendPasswordReset, authError, clearAuthError, hasConfig } = useAuth();

  const showKeyDebug = useMemo(() => {
    const err = authError?.toLowerCase() ?? '';
    return err.includes('invalid api key') || err.includes('api key') || err.includes('jwt') || err.includes('unauthorized');
  }, [authError]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    if (!hasConfig) return false;
    if (!isValidEmail(email)) return false;
    if (password.length < 6) return false;
    return true;
  }, [email, password, hasConfig]);

  const onToggleMode = useCallback(() => {
    clearAuthError();
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
  }, [clearAuthError]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) {
      Alert.alert('Check your details', 'Please enter a valid email and a password (6+ characters).');
      return;
    }

    setIsBusy(true);
    try {
      if (mode === 'login') {
        await signInWithPassword({ email, password });
      } else {
        await signUpWithPassword({ email, password });
        Alert.alert('Almost there', 'If email confirmation is enabled, check your inbox to confirm your account.');
      }
    } catch (e) {
      console.log('[auth-screen] submit error caught', {
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsBusy(false);
    }
  }, [canSubmit, email, mode, password, signInWithPassword, signUpWithPassword]);

  const onForgotPassword = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!hasConfig) {
      Alert.alert('Supabase not configured', 'Add your Supabase URL and anon key to enable auth.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Email required', 'Type your email first, then tap “Reset password”.');
      return;
    }

    setIsBusy(true);
    try {
      await sendPasswordReset({ email: trimmedEmail });
      Alert.alert('Check your email', 'If an account exists, we sent a password reset email.');
    } finally {
      setIsBusy(false);
    }
  }, [email, hasConfig, sendPasswordReset]);

  return (
    <View style={styles.root} testID="auth-root">
      <LinearGradient
        colors={["rgba(56,217,137,0.22)", "rgba(88,166,255,0.12)", "rgba(7,17,11,1)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.kb}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
        testID="auth-kb"
      >
        <View style={styles.hero} testID="auth-hero">
          <View style={styles.logo} testID="auth-logo">
            <ShieldCheck color={COLORS.primary} size={22} />
          </View>
          <Text style={styles.title} testID="auth-title">Welcome</Text>
          <Text style={styles.subtitle} testID="auth-subtitle">
            Sign in to sync your collections, guides, and recipes across devices.
          </Text>

          {!hasConfig ? (
            <View style={styles.configBanner} testID="auth-config-banner">
              <Text style={styles.configTitle}>Supabase not connected yet</Text>
              <Text style={styles.configBody}>
                Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then reload.
                {supabasePublicDebugInfo.reason ? `\n\nDetected issue: ${supabasePublicDebugInfo.reason}` : ''}
              </Text>
            </View>
          ) : null}

          {(!hasConfig || showKeyDebug) ? (
            <View style={styles.debugBanner} testID="auth-debug-banner">
              <Text style={styles.debugTitle} testID="auth-debug-title">Supabase config debug</Text>
              <Text style={styles.debugBody} testID="auth-debug-body">
                Has config: {String(supabasePublicDebugInfo.hasConfig)}
                {'\n'}URL: {supabasePublicDebugInfo.url || '(missing)'}
                {'\n'}URL ref: {supabasePublicDebugInfo.urlRef || '(unknown)'}
                {'\n'}Key source: {supabasePublicDebugInfo.keySource}
                {'\n'}Anon key prefix: {supabasePublicDebugInfo.anonKeyPrefix || '(missing)'}
                {'\n'}Anon key length: {supabasePublicDebugInfo.anonKeyLen}
                {'\n'}Key ref: {supabasePublicDebugInfo.keyRef || '(unknown)'}
                {'\n'}Key role: {supabasePublicDebugInfo.keyRole || '(unknown)'}
                {supabasePublicDebugInfo.reason ? `\nReason: ${supabasePublicDebugInfo.reason}` : ''}
              </Text>
              <Text style={styles.debugHint} testID="auth-debug-hint">
                Use Supabase → Project Settings → API → “anon public”. Then restart the dev server (reload isn’t always enough for env vars).
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card} testID="auth-card">
          <View style={styles.segment} testID="auth-segment">
            <Pressable
              onPress={() => {
                clearAuthError();
                setMode('login');
              }}
              style={[styles.segmentButton, mode === 'login' ? styles.segmentButtonActive : null]}
              testID="auth-mode-login"
            >
              <Text style={[styles.segmentText, mode === 'login' ? styles.segmentTextActive : null]}>Log in</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                clearAuthError();
                setMode('signup');
              }}
              style={[styles.segmentButton, mode === 'signup' ? styles.segmentButtonActive : null]}
              testID="auth-mode-signup"
            >
              <Text style={[styles.segmentText, mode === 'signup' ? styles.segmentTextActive : null]}>Sign up</Text>
            </Pressable>
          </View>

          <View style={styles.field} testID="auth-email-field">
            <View style={styles.fieldIcon}>
              <Mail color={COLORS.textSecondary} size={18} />
            </View>
            <TextInput
              value={email}
              onChangeText={(t) => {
                clearAuthError();
                setEmail(t);
              }}
              placeholder="Email"
              placeholderTextColor={"rgba(234,246,238,0.35)"}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={styles.input}
              testID="auth-email"
            />
          </View>

          <View style={styles.field} testID="auth-password-field">
            <View style={styles.fieldIcon}>
              <Lock color={COLORS.textSecondary} size={18} />
            </View>
            <TextInput
              value={password}
              onChangeText={(t) => {
                clearAuthError();
                setPassword(t);
              }}
              placeholder="Password"
              placeholderTextColor={"rgba(234,246,238,0.35)"}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              style={styles.input}
              testID="auth-password"
            />
          </View>

          {authError ? (
            <View style={styles.error} testID="auth-error">
              <Text style={styles.errorText} testID="auth-error-text">{authError}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit || isBusy}
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSubmit || isBusy) ? styles.primaryButtonDisabled : null,
              pressed && canSubmit && !isBusy ? styles.primaryButtonPressed : null,
            ]}
            testID="auth-submit"
          >
            {isBusy ? (
              <ActivityIndicator color={"#06210F"} />
            ) : (
              <Text style={styles.primaryButtonText} testID="auth-submit-text">
                {mode === 'login' ? 'Log in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <View style={styles.links} testID="auth-links">
            <Pressable onPress={onForgotPassword} disabled={isBusy} testID="auth-forgot">
              <Text style={styles.linkText}>Reset password</Text>
            </Pressable>
            <Pressable onPress={onToggleMode} disabled={isBusy} testID="auth-toggle">
              <Text style={styles.linkText}>Switch to {mode === 'login' ? 'Sign up' : 'Log in'}</Text>
            </Pressable>
          </View>

          <Text style={styles.footnote} testID="auth-footnote">
            By continuing you agree to keep your login details private.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  kb: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 18,
  },
  hero: {
    paddingHorizontal: 6,
    paddingBottom: 18,
  },
  logo: {
    width: 44,
    height: 44,
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
  title: {
    marginTop: 14,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    color: 'rgba(234,246,238,0.74)',
    maxWidth: 360,
  },
  configBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(246,196,69,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,196,69,0.34)',
  },
  configTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#F6C445',
  },
  configBody: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: 'rgba(234,246,238,0.78)',
  },
  debugBanner: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(88,166,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(88,166,255,0.30)',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#58A6FF',
  },
  debugBody: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: 'rgba(234,246,238,0.82)',
  },
  debugHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    color: 'rgba(234,246,238,0.70)',
  },
  card: {
    flex: 1,
    minHeight: 380,
    borderRadius: 28,
    padding: 16,
    backgroundColor: 'rgba(11,25,17,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,48,34,0.85)',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(7,17,11,0.7)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,48,34,0.9)',
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(56,217,137,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.45)',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: 'rgba(234,246,238,0.62)',
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  field: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(7,17,11,0.8)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,48,34,0.9)',
    paddingHorizontal: 12,
    height: 52,
  },
  fieldIcon: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  error: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,92,92,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.30)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: 'rgba(255,220,220,0.95)',
  },
  primaryButton: {
    marginTop: 14,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: '#06210F',
  },
  links: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(234,246,238,0.78)',
  },
  footnote: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: 'rgba(234,246,238,0.45)',
    textAlign: 'center',
  },
});

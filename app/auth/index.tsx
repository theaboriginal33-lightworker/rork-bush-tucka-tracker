import React, { useCallback, useMemo, useRef, useState } from 'react';
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
type ScreenMode = 'auth' | 'otp';

function isValidEmail(email: string): boolean {
  const value = email.trim();
  return value.includes('@') && value.includes('.') && value.length >= 6;
}

// ─── OTP Input: 6 boxes ──────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(6, ' ').split('');

  return (
    <Pressable style={styles.otpWrapper} onPress={() => inputRef.current?.focus()}>
      {digits.map((d, i) => (
        <View
          key={i}
          style={[
            styles.otpBox,
            i === value.length && styles.otpBoxActive,
          ]}
        >
          <Text style={styles.otpDigit}>{d.trim()}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.otpHidden}
        autoFocus
      />
    </Pressable>
  );
}

export default function AuthScreen() {
  const { signInWithPassword, signUpWithPassword, verifyOtp, sendPasswordReset, authError, clearAuthError, hasConfig } = useAuth();

  const showKeyDebug = useMemo(() => {
    const err = authError?.toLowerCase() ?? '';
    return err.includes('invalid api key') || err.includes('api key') || err.includes('jwt') || err.includes('unauthorized');
  }, [authError]);

  const shouldShowDebugBanner = useMemo(() => {
    return __DEV__ && (!hasConfig || showKeyDebug);
  }, [hasConfig, showKeyDebug]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [screenMode, setScreenMode] = useState<ScreenMode>('auth');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    if (!hasConfig) return false;
    if (!isValidEmail(email)) return false;
    if (password.length < 6) return false;
    return true;
  }, [email, password, hasConfig]);

  const canVerify = otp.length === 6;

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
        // Move to OTP screen only if no error
        if (!authError) {
          setScreenMode('otp');
          setOtp('');
        }
      }
    } catch (e) {
      console.log('[auth-screen] submit error caught', {
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsBusy(false);
    }
  }, [canSubmit, email, mode, password, signInWithPassword, signUpWithPassword]);

  const onVerifyOtp = useCallback(async () => {
    if (!canVerify) return;
    setIsBusy(true);
    try {
      await verifyOtp({ email, token: otp });
    } catch (e) {
      console.log('[auth-screen] verifyOtp error', {
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsBusy(false);
    }
  }, [canVerify, email, otp, verifyOtp]);

  const onForgotPassword = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!hasConfig) {
      Alert.alert('Supabase not configured', 'Add your Supabase URL and anon key to enable auth.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Email required', 'Type your email first, then tap "Reset password".');
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

  // ── OTP Verification Screen ──
  if (screenMode === 'otp') {
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
        >
          <View style={styles.hero}>
            <View style={styles.logo}>
              <ShieldCheck color={COLORS.primary} size={22} />
            </View>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{"\n"}
              <Text style={{ color: COLORS.primary }}>{email}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.otpLabel}>Enter verification code</Text>
            <OtpInput value={otp} onChange={(v) => { clearAuthError(); setOtp(v); }} />

            {authError ? (
              <View style={styles.error}>
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={onVerifyOtp}
              disabled={!canVerify || isBusy}
              style={({ pressed }) => [
                styles.primaryButton,
                (!canVerify || isBusy) ? styles.primaryButtonDisabled : null,
                pressed && canVerify && !isBusy ? styles.primaryButtonPressed : null,
              ]}
            >
              {isBusy ? (
                <ActivityIndicator color={'#FFFFFF'} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Code</Text>
              )}
            </Pressable>

            <View style={styles.links}>
              <Pressable onPress={() => { clearAuthError(); setScreenMode('auth'); setOtp(''); }} disabled={isBusy}>
                <Text style={styles.linkText}>← Back</Text>
              </Pressable>
              <Pressable onPress={onSubmit} disabled={isBusy}>
                <Text style={styles.linkText}>Resend code</Text>
              </Pressable>
            </View>

            <Text style={styles.footnote}>Code expires in 10 minutes.</Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Auth Screen ──
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

          {shouldShowDebugBanner ? (
            <View style={styles.debugBanner} testID="auth-debug-banner">
              <Text style={styles.debugTitle} testID="auth-debug-title">Supabase config debug</Text>
              <Text style={styles.debugBody} testID="auth-debug-body">
                Has config: {String(supabasePublicDebugInfo.hasConfig)}
                {'\n'}URL: {supabasePublicDebugInfo.url || '(missing)'}
                {'\n'}Key source: {supabasePublicDebugInfo.keySource}
                {'\n'}Anon key prefix: {supabasePublicDebugInfo.anonKeyPrefix || '(missing)'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card} testID="auth-card">
          <View style={styles.segment} testID="auth-segment">
            <Pressable
              onPress={() => { clearAuthError(); setMode('login'); }}
              style={[styles.segmentButton, mode === 'login' ? styles.segmentButtonActive : null]}
              testID="auth-mode-login"
            >
              <Text style={[styles.segmentText, mode === 'login' ? styles.segmentTextActive : null]}>Log in</Text>
            </Pressable>
            <Pressable
              onPress={() => { clearAuthError(); setMode('signup'); }}
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
              onChangeText={(t) => { clearAuthError(); setEmail(t); }}
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
              onChangeText={(t) => { clearAuthError(); setPassword(t); }}
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
              <ActivityIndicator color={'#FFFFFF'} />
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

  // OTP styles
  otpLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  otpWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(7,17,11,0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,48,34,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(56,217,137,0.08)',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  otpHidden: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});

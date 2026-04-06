
import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform, Alert,ImageBackground,
  Image
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { supabase } from '@/constants/supabase';
import { COLORS } from '@/constants/colors';

// ── Palette ───────────────────────────────────────────────────
const BG_DEEP = COLORS.background;
const CARD_BG = COLORS.card;
const INPUT_BG = COLORS.surface;
const GREEN = COLORS.primary;
const GREEN_BTN = COLORS.secondary;
const TEXT_WHITE = COLORS.white;
const TEXT_MUTED = COLORS.textSecondary;
const TEXT_HINT = COLORS.textHint;
const BORDER = COLORS.border;

type Step = 'phone' | 'otp' | 'name' | 'discovery';
const STEPS: Step[] = ['phone', 'otp', 'name', 'discovery'];

/** `true` = no SMS, accept STATIC_OTP only (needs existing login for profile save). `false` = Supabase SMS OTP. */
const USE_STATIC_OTP = false;

type OtpVerifyType = 'sms' | 'phone_change';

const DISCOVERY_OPTIONS = [
  'Searching the App Store',
  'TikTok',
  'Facebook Ad',
  'Searching Google',
  'Referral from a friend',
  'Instagram Ad',
  'Other',
];

// ── Supabase helpers ──────────────────────────────────────────
/** Australian mobile without leading 0 (9 digits), e.g. 412345678 → +61412345678 */
function toE164(digits: string) {
  return `+61${digits}`;
}

function mapAuthError(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return msg;
}

const OTP_SEND_TIMEOUT_MS = 60_000;
const OTP_VERIFY_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

async function requestPhoneOtp(phoneDigits: string): Promise<{ e164: string; verifyType: OtpVerifyType }> {
  const e164 = toE164(phoneDigits);
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    // Link phone to existing email session — keeps same user ID
    const { error } = await withTimeout(
      supabase.auth.updateUser({ phone: e164 }),
      OTP_SEND_TIMEOUT_MS,
      'Request timed out. Check your connection and try again.'
    );
    if (error) throw new Error(mapAuthError(error));
    return { e164, verifyType: 'phone_change' };
  }

  const { error } = await withTimeout(
    supabase.auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: true },
    }),
    OTP_SEND_TIMEOUT_MS,
    'Request timed out while sending the code. Check your connection, VPN, or try again.'
  );
  if (error) throw new Error(mapAuthError(error));
  return { e164, verifyType: 'sms' };
}

async function verifyPhoneOtp(phone: string, token: string, verifyType: OtpVerifyType) {
  const { error } = await withTimeout(
    supabase.auth.verifyOtp({
      phone,
      token,
      type: verifyType,
    }),
    OTP_VERIFY_TIMEOUT_MS,
    'Verification timed out. Check your connection and try again.'
  );
  if (error) throw new Error(mapAuthError(error));
}

const PHONE_TAKEN_MESSAGE =
  'This phone number is already on another account. Log in with that account, or use a different number.';

function isPhoneUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const msg = typeof e?.message === 'string' ? e.message : '';
  return (
    e?.code === '23505' ||
    msg.includes('profiles_phone_unique') ||
    msg.includes('duplicate key') ||
    msg.includes('unique constraint')
  );
}

async function upsertProfile(payload: {
  phone?: string;
  verified?: boolean;
  first_name?: string;
  discovery?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  if (payload.phone) {
    const { data: rowWithPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', payload.phone)
      .maybeSingle();

    if (rowWithPhone && rowWithPhone.id !== user.id) {
      throw new Error(PHONE_TAKEN_MESSAGE);
    }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        ...payload,
      },
      { onConflict: 'id' }
    );

  if (error) {
    if (isPhoneUniqueViolation(error)) {
      throw new Error(PHONE_TAKEN_MESSAGE);
    }
    throw error;
  }
}

// ── Progress dots ─────────────────────────────────────────────
function ProgressDots({ current }: { current: number }) {
  return (
    <View style={p.wrap}>
      {STEPS.map((_, i) => (
        <View key={i} style={[p.dot, i === current && p.dotActive, i < current && p.dotDone]} />
      ))}
    </View>
  );
}
const p = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BORDER },
  dotActive: { width: 20, backgroundColor: GREEN },
  dotDone: { backgroundColor: GREEN, opacity: 0.45 },
});

// ── Icons ─────────────────────────────────────────────────────
function PhoneIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={2} width={14} height={20} rx={3} stroke={TEXT_HINT} strokeWidth={1.5} />
      <Circle cx={12} cy={18} r={1} fill={TEXT_HINT} />
    </Svg>
  );
}
function LockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={10} rx={2} stroke={TEXT_HINT} strokeWidth={1.5} />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={TEXT_HINT} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={12} cy={16} r={1.5} fill={TEXT_HINT} />
    </Svg>
  );
}
function PersonIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={TEXT_HINT} strokeWidth={1.5} />
      <Path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke={TEXT_HINT} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={TEXT_HINT} strokeWidth={1.5} />
      <Path d="M16.5 16.5L21 21" stroke={TEXT_HINT} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
function CheckIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke={COLORS.black} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CollectScreen() {
  const [step, setStep]           = useState<Step>('phone');
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [name, setName]           = useState('');
  const [discovery, setDiscovery] = useState('');
  const [loading, setLoading]     = useState(false);
  const [pendingE164, setPendingE164] = useState('');
  const [otpVerifyType, setOtpVerifyType] = useState<OtpVerifyType>('sms');

  const phoneRef = useRef<TextInput>(null);
  const otpRef   = useRef<TextInput>(null);
  const nameRef  = useRef<TextInput>(null);

  const stepIndex   = STEPS.indexOf(step);
  const phoneDigits = phone.replace(/\D/g, '');

  function goBack() {
    if (stepIndex === 0) { router.back(); return; }
    setStep(STEPS[stepIndex - 1]);
  }

  async function goNext() {
    setLoading(true);
    // One frame so "Please wait…" can paint before the network call.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      await handleStepSubmit();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStepSubmit() {
    switch (step) {

      // PHONE → Supabase sends real SMS OTP
      case 'phone': {
        const e164 = toE164(phoneDigits);
        setPendingE164(e164);
        setOtp('');
        const { e164: sentE164, verifyType } = await requestPhoneOtp(phoneDigits);
        setPendingE164(sentE164);
        setOtpVerifyType(verifyType);
        setStep('otp');
        break;
      }

      // OTP → Supabase verifyOtp, then profile
      case 'otp': {
        if (!pendingE164) {
          throw new Error('Missing phone. Go back and request a code again.');
        }
        await verifyPhoneOtp(pendingE164, otp, otpVerifyType);
        await upsertProfile({
          phone: pendingE164,
          verified: true,
        });
        // For phone_change type, onAuthStateChange fires USER_UPDATED not SIGNED_IN
        // so we manually advance the step regardless of auth event
        setStep('name');
        break;
      }

      // NAME → first_name save → discovery
      case 'name':
        await upsertProfile({
          phone: pendingE164 || toE164(phoneDigits),
          first_name: name.trim(),
        });
        setStep('discovery');
        break;

      // DISCOVERY → save → next screen
      case 'discovery':
        await upsertProfile({
          phone: pendingE164 || toE164(phoneDigits),
          discovery: discovery,
        });
        router.push('/onboarding/goals');
        break;
    }
  }

  async function resendCode() {
    if (phoneDigits.length < 9) return;
    setLoading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      const { e164, verifyType } = await requestPhoneOtp(phoneDigits);
      setPendingE164(e164);
      setOtpVerifyType(verifyType);
      setOtp('');
      Alert.alert('Code sent', 'A new verification code has been sent to your phone.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.slice(0, 3) + ' ' + digits.slice(3);
    return digits.slice(0, 3) + ' ' + digits.slice(3, 7) + ' ' + digits.slice(7);
  }

  return (
     <ImageBackground
          source={require('../../assets/images/dark2.png')}
          style={s.container}
          resizeMode="cover"
        >

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <ProgressDots current={stepIndex} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── PHONE ── */}
          {step === 'phone' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Phone number</Text>
              <Text style={s.subheading}>We'll send you a verification code to confirm your number.</Text>
              <View style={s.card}>
                <TouchableOpacity style={s.inputRow} activeOpacity={0.8} onPress={() => phoneRef.current?.focus()}>
                  <PhoneIcon />
                  <View style={s.countryPill}>
                    <Text style={s.flag}>🇦🇺</Text>
                    <Text style={s.countryCode}>+61</Text>
                  </View>
                  <TextInput
                    ref={phoneRef}
                    style={[s.input, { flex: 1, fontSize: 20, letterSpacing: 3, fontWeight: '300' }]}
                    value={phone}
                    onChangeText={(t) => setPhone(formatPhone(t))}
                    keyboardType="phone-pad"
                    placeholder="412 345 678"
                    placeholderTextColor={TEXT_HINT}
                    maxLength={11}
                    autoFocus
                  />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }} />

              <Image
                source={require('../../assets/images/kangaroo.png')}
                style={s.heroImage}
                resizeMode="contain"
              />

              <TouchableOpacity
                style={[s.btn, (phoneDigits.length < 9 || loading) && s.btnDisabled]}
                disabled={phoneDigits.length < 9 || loading}
                onPress={goNext}
              >
                <Text style={[s.btnText, phoneDigits.length < 9 && s.btnTextDisabled]}>
                  {loading ? 'Sending code…' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── OTP ── */}
          {step === 'otp' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Confirmation code</Text>
              <Text style={s.subheading}>Sent to +61 {phone}</Text>
              <Text style={s.smsHint}>Enter the 6-digit code sent to your phone.</Text>
              <View style={s.card}>
                <View style={s.inputRow}>
                  <LockIcon />
                  <TextInput
                    ref={otpRef}
                    style={[s.input, { flex: 1, fontSize: 28, letterSpacing: 14, color: GREEN, fontWeight: '300', textAlign: 'center' }]}
                    value={otp}
                    onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    placeholder="· · · · · ·"
                    placeholderTextColor={TEXT_HINT}
                    maxLength={6}
                    autoFocus
                  />
                </View>
              </View>
              <TouchableOpacity style={s.linkRow} onPress={resendCode} disabled={loading}>
                <Text style={s.linkMuted}>Didn't get it? </Text>
                <Text style={s.linkGreen}>{loading ? 'Sending…' : 'Resend code'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <Image
                source={require('../../assets/images/possum.png')}
                style={s.heroImage}
                resizeMode="contain"
              />

              <TouchableOpacity
                style={[s.btn, (otp.length < 6 || loading) && s.btnDisabled]}
                disabled={otp.length < 6 || loading}
                onPress={goNext}
              >
                <Text style={[s.btnText, otp.length < 6 && s.btnTextDisabled]}>
                  {loading ? 'Verifying…' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── NAME ── */}
          {step === 'name' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>What's your first name?</Text>
              <Text style={s.subheading}>So we know what to call you :)</Text>
              <View style={s.card}>
                <View style={s.inputRow}>
                  <PersonIcon />
                  <TextInput
                    ref={nameRef}
                    style={[s.input, { flex: 1 }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="First name"
                    placeholderTextColor={TEXT_HINT}
                    autoCapitalize="words"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={name.trim() ? goNext : undefined}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <Image
                source={require('../../assets/images/koala.png')}
                style={s.heroImage3}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={[s.btn, (!name.trim() || loading) && s.btnDisabled]}
                disabled={!name.trim() || loading}
                onPress={goNext}
              >
                <Text style={[s.btnText, !name.trim() && s.btnTextDisabled]}>
                  {loading ? 'Saving…' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── DISCOVERY ── */}
          {step === 'discovery' && (
            <View style={s.stepWrap}>

              {/* Heading row with parrot in top-right corner */}
              <View style={{ position: 'relative' }}>
                <Text style={s.heading}>
                  How did you find{'\n'}
                  <Text style={{ color: GREEN }}>Bush Tucka Tracka?</Text>
                </Text>
                <Image
                  source={require('../../assets/images/cockatoo.png')}
                  style={s.parrotImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={s.subheading}>Help us understand how you found us.</Text>

              <View style={s.card}>
                {DISCOVERY_OPTIONS.map((opt, i) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      s.optionRow,
                      i < DISCOVERY_OPTIONS.length - 1 && s.optionRowBorder,
                      discovery === opt && s.optionRowActive,
                    ]}
                    onPress={() => setDiscovery(opt)}
                    activeOpacity={0.7}
                  >
                    <SearchIcon />
                    <Text style={[s.optionText, discovery === opt && s.optionTextActive]}>{opt}</Text>
                    {discovery === opt && (
                      <View style={s.checkCircle}><CheckIcon /></View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={[s.btn, (!discovery || loading) && s.btnDisabled]}
                disabled={!discovery || loading}
                onPress={goNext}
              >
                <Text style={[s.btnText, !discovery && s.btnTextDisabled]}>
                  {loading ? 'Finishing…' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    height: 64,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backBtn: { position: 'absolute', left: 16, justifyContent: 'center', padding: 4 },
  backArrow: { fontSize: 28, color: TEXT_WHITE, fontWeight: '300' },

  scroll: { flexGrow: 1, paddingBottom: 40 },
  stepWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16, minHeight: 500 },
  stepWrap1: { flex: 1, paddingHorizontal: 24, paddingTop: 16, minHeight: 500 },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderWidth: 1,
    borderColor: COLORS.statusBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },

  heading: {
    fontSize: 26,
    fontWeight: '600',
    marginTop: 14,
    color: TEXT_WHITE,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    color: COLORS.textMutedStrong,
    lineHeight: 21,
    marginBottom: 28,
    textAlign: 'center',
  },
  smsHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: -20,
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    marginBottom: 8,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  input: { fontSize: 16, color: TEXT_WHITE, padding: 0 },

  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  flag: { fontSize: 16 },
  countryCode: { fontSize: 13, color: TEXT_WHITE, fontWeight: '500' },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: INPUT_BG,
  },
  optionRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  optionRowActive: { backgroundColor: 'rgba(56,217,137,0.08)' },
  optionText: { flex: 1, fontSize: 14, color: TEXT_MUTED },
  optionTextActive: { color: TEXT_WHITE, fontWeight: '500' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },

  linkRow: { flexDirection: 'row', alignSelf: 'center', marginTop: 14 },
  linkMuted: { fontSize: 13, color: TEXT_MUTED },
  linkGreen: { fontSize: 13, color: GREEN, fontWeight: '600' },

  btn: {
    backgroundColor: GREEN_BTN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
    width: '100%',
  },
  btnDisabled: {
    backgroundColor: COLORS.statusSoft,
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: TEXT_WHITE, letterSpacing: 0.2 },
  btnTextDisabled: { color: TEXT_HINT },
  heroImage: {
    right: "10%",
    width: 230,
    height: 200,
  },
  heroImage3: {
    right: "5%",
    width: 230,
    height: 200,
  },
  parrotImage: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
  },
});
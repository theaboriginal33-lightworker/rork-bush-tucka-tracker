import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform, Alert,ImageBackground,
  Image
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { supabase } from '@/constants/supabase';



// ── Palette ───────────────────────────────────────────────────
const BG_DEEP    = '#041a14';
const CARD_BG    = '#0d1f18';
const INPUT_BG   = '#0a1a13';
const GREEN      = '#3aad7e';
const GREEN_BTN  = '#3db87f';
const TEXT_WHITE = '#ffffff';
const TEXT_MUTED = '#5a8a72';
const TEXT_HINT  = '#3a6650';
const BORDER     = '#163326';

type Step = 'phone' | 'otp' | 'name' | 'email' | 'discovery';
const STEPS: Step[] = ['phone', 'otp', 'name', 'email', 'discovery'];

const STATIC_OTP = '111111'; // 🔒 Dev-only

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
function toE164(digits: string) {
  return `+61${digits}`;
}

async function upsertProfile(payload: {
  phone?: string;
  verified?: boolean;
  first_name?: string;
  email?: string;
  discovery?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,   
        ...payload,
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
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
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#163326' },
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
function EmailIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={TEXT_HINT} strokeWidth={1.5} />
      <Path d="M3 7l9 6 9-6" stroke={TEXT_HINT} strokeWidth={1.5} strokeLinecap="round" />
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
      <Path d="M5 13l4 4L19 7" stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CollectScreen() {
  const [step, setStep]           = useState<Step>('phone');
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [discovery, setDiscovery] = useState('');
  const [loading, setLoading]     = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const otpRef   = useRef<TextInput>(null);
  const nameRef  = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const stepIndex   = STEPS.indexOf(step);
  const phoneDigits = phone.replace(/\D/g, '');

  function goBack() {
    if (stepIndex === 0) { router.back(); return; }
    setStep(STEPS[stepIndex - 1]);
  }

  async function goNext() {
    setLoading(true);
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

      // PHONE → sirf agle step pe jao, koi DB call nahi
      case 'phone':
        setStep('otp');
        break;

      // OTP → 111111 check → profiles mein insert
      case 'otp':
        if (otp !== STATIC_OTP) {
          throw new Error('Wrong code. Enter 111111 to continue.');
        }
        await upsertProfile({
          phone:    toE164(phoneDigits),
          verified: true,
        });
        setStep('name');
        break;

      // NAME → first_name save
      case 'name':
        await upsertProfile({
          phone:      toE164(phoneDigits),
          first_name: name.trim(),
        });
        setStep('email');
        break;

      // EMAIL → email save (skip = undefined)
      case 'email':
        await upsertProfile({
          phone: toE164(phoneDigits),
          email: email.trim() || undefined,
        });
        setStep('discovery');
        break;

      // DISCOVERY → save → agle screen
      case 'discovery':
        await upsertProfile({
          phone:     toE164(phoneDigits),
          discovery: discovery,
        });
        router.push('/onboarding/goals');
        break;
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
    {/* <View style={s.root}> */}
    

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
          placeholder="8123 4567"
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
        {loading ? 'Please wait…' : 'Continue'}
      </Text>
    </TouchableOpacity>
  </View>
)}

          {/* ── OTP ── */}
          {step === 'otp' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>Confirmation code</Text>
              <Text style={s.subheading}>Sent to +61 {phone}</Text>
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
              <TouchableOpacity style={s.linkRow} onPress={() => setOtp('')}>
                <Text style={s.linkMuted}>Didn't get it? </Text>
                <Text style={s.linkGreen}>Resend code</Text>
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

          {/* ── EMAIL ── */}
          {step === 'email' && (
            <View style={s.stepWrap}>
              <Text style={s.heading}>What's your email?</Text>
              <Text style={s.subheading}>For tips & plant updates 🌿</Text>
              <View style={s.card}>
                <View style={s.inputRow}>
                  <EmailIcon />
                  <TextInput
                    ref={emailRef}
                    style={[s.input, { flex: 1 }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="example@email.com"
                    placeholderTextColor={TEXT_HINT}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                    returnKeyType="done"
                  />
                </View>
              </View>
              <TouchableOpacity style={s.linkRow} onPress={goNext}>
                <Text style={s.linkMuted}>Skip for now</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />

                <Image
      source={require('../../assets/images/kangaroo.png')}
      style={s.heroImage}
      resizeMode="contain"
    />

              <TouchableOpacity
                style={[s.btn, (!email.includes('@') || loading) && s.btnDisabled]}
                disabled={!email.includes('@') || loading}
                onPress={goNext}
              >
                <Text style={[s.btnText, !email.includes('@') && s.btnTextDisabled]}>
                  {loading ? 'Saving…' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── DISCOVERY ── */}
         {step === 'discovery' && (
  <View style={s.stepWrap}>

    {/* ✅ Heading row with parrot in top-right corner */}
    <View style={{ position: 'relative' }}>
      <Text style={s.heading}>
        How did you find{'\n'}
        <Text style={{ color: GREEN }}>Bush Tucka Tracka?</Text>
      </Text>
      <Image
        source={require('../../assets/images/cockatoo.png')} // replace with parrot image
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
    {/* </View> */}
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
    backgroundColor: 'rgba(58,173,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,173,126,0.2)',
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
    color: 'rgba(234,246,238,0.74)',
    lineHeight: 21,
    marginBottom: 28,
    textAlign: 'center',
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
  optionRowActive: { backgroundColor: 'rgba(58,173,126,0.08)' },
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
    backgroundColor: 'rgba(58,173,126,0.1)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: TEXT_WHITE, letterSpacing: 0.2 },
  btnTextDisabled: { color: TEXT_HINT },
  heroImage: {
    
    right:"10%",
  width: 230,
  height: 200,
},
heroImage3: {
    
    right:"5%",
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

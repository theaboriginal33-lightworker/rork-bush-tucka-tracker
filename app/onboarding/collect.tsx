import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, StatusBar, ScrollView, Dimensions,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Ellipse, Line, Circle, Path } from 'react-native-svg';

const { width } = Dimensions.get('window');
const BRAND_GREEN = '#3AE081';
const BG = '#ffffff';
const TEXT_DARK = '#111111';
const TEXT_MUTED = '#888888';

type Step = 'phone' | 'otp' | 'name' | 'email' | 'discovery';
const STEPS: Step[] = ['phone', 'otp', 'name', 'email', 'discovery'];

const DISCOVERY_OPTIONS = [
  'Searching the App Store',
  'Plant retailer',
  'Facebook Ad',
  'Searching Google',
  'Referral from a friend',
  'Instagram Ad',
  'Other',
];

function DecoHeader() {
  return (
    <View style={deco.wrap} pointerEvents="none">
      <Svg width={120} height={50} viewBox="0 0 120 50" style={deco.clouds}>
        <Ellipse cx={50} cy={38} rx={44} ry={14} fill="#c8d8f0" opacity={0.7} />
        <Ellipse cx={32} cy={30} rx={22} ry={15} fill="#d4e4f8" opacity={0.8} />
        <Ellipse cx={70} cy={26} rx={20} ry={14} fill="#d4e4f8" opacity={0.8} />
      </Svg>
      <Svg width={54} height={54} viewBox="0 0 54 54" style={deco.sun}>
        <Circle cx={27} cy={27} r={18} fill="#F5A623" />
        <Circle cx={21} cy={23} r={2.5} fill="#e8921a" />
        <Circle cx={31} cy={21} r={1.8} fill="#e8921a" />
        <Path d="M22 32 Q27 36 32 32" stroke="#e8921a" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {[[27,4,27,0],[27,54,27,50],[4,27,0,27],[54,27,50,27],[10,10,7,7],[44,44,47,47],[44,10,47,7],[10,44,7,47]].map(([x1,y1,x2,y2], i) => (
          <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F5A623" strokeWidth={2} strokeLinecap="round" />
        ))}
      </Svg>
    </View>
  );
}

const deco = StyleSheet.create({
  wrap: { height: 60, position: 'relative' },
  clouds: { position: 'absolute', top: 4, left: 45 },
  sun: { position: 'absolute', top: 0, right: 16 },
});

export default function CollectScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [discovery, setDiscovery] = useState('');

  const phoneRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const stepIndex = STEPS.indexOf(step);

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
    else router.push('/onboarding/goals');
  }

  function goBack() {
    if (stepIndex === 0) { router.back(); return; }
    setStep(STEPS[stepIndex - 1]);
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.slice(0, 3) + ' ' + digits.slice(3);
    return digits.slice(0, 3) + ' ' + digits.slice(3, 7) + ' ' + digits.slice(7);
  }

  const phoneDigits = phone.replace(/\D/g, '');

  return (
    <View style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* ── Top row: back button + deco ── */}
      <View style={s.topRow}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={goBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <DecoHeader />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── PHONE ── */}
          {step === 'phone' && (
            <View style={s.stepWrap}>
              <Text style={s.title}>Enter your phone number</Text>
              <Text style={s.subtitle}>We'll text you a verification code.</Text>

              <TouchableOpacity
                style={s.phoneRow}
                activeOpacity={0.8}
                onPress={() => phoneRef.current?.focus()}
              >
                <Text style={s.flag}>🇦🇺</Text>
                <TextInput
                  ref={phoneRef}
                  style={s.phoneInput}
                  value={phone}
                  onChangeText={(t) => setPhone(formatPhone(t))}
                  keyboardType="phone-pad"
                  placeholder="8123 4567"
                  placeholderTextColor="#ccc"
                  maxLength={11}
                  autoFocus
                />
              </TouchableOpacity>

              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[s.btn, phoneDigits.length < 9 && s.btnDisabled]}
                disabled={phoneDigits.length < 9}
                onPress={goNext}
              >
                <Text style={[s.btnText, phoneDigits.length < 9 && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── OTP ── */}
          {step === 'otp' && (
            <View style={s.stepWrap}>
              <Text style={s.title}>Enter confirmation code</Text>
              <Text style={s.subtitle}>Sent to +61 {phone}</Text>
              <TextInput
                ref={otpRef}
                style={s.otpInput}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="------"
                placeholderTextColor="#ccc"
                maxLength={6}
                autoFocus
                textAlign="center"
              />
              <TouchableOpacity style={s.resendBtn} onPress={() => {}}>
                <Text style={s.resendText}>Resend code</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[s.btn, otp.length < 6 && s.btnDisabled]}
                disabled={otp.length < 6}
                onPress={goNext}
              >
                <Text style={[s.btnText, otp.length < 6 && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── NAME ── */}
          {step === 'name' && (
            <View style={s.stepWrap}>
              <Text style={s.title}>What's your first name?</Text>
              <Text style={s.subtitle}>So we know what to call you :)</Text>
              <TextInput
                ref={nameRef}
                style={s.textInput}
                value={name}
                onChangeText={setName}
                placeholder="First name"
                placeholderTextColor="#ccc"
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={name.trim() ? goNext : undefined}
              />
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[s.btn, !name.trim() && s.btnDisabled]}
                disabled={!name.trim()}
                onPress={goNext}
              >
                <Text style={[s.btnText, !name.trim() && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── EMAIL ── */}
          {step === 'email' && (
            <View style={s.stepWrap}>
              <Text style={s.title}>What's your email?</Text>
              <Text style={s.subtitle}>For tips & updates 🌿</Text>
              <TextInput
                ref={emailRef}
                style={s.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor="#ccc"
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                returnKeyType="done"
              />
              <TouchableOpacity style={s.skipBtn} onPress={goNext}>
                <Text style={s.skipText}>Skip</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[s.btn, !email.includes('@') && s.btnDisabled]}
                disabled={!email.includes('@')}
                onPress={goNext}
              >
                <Text style={[s.btnText, !email.includes('@') && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── DISCOVERY ── */}
          {step === 'discovery' && (
            <View style={s.stepWrap}>
              <Text style={s.title}>How did you find {name || 'Bush Tucka Tracka'}?</Text>
              <View style={s.optionList}>
                {DISCOVERY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.optionBtn, discovery === opt && s.optionBtnActive]}
                    onPress={() => setDiscovery(opt)}
                  >
                    <Text style={[s.optionText, discovery === opt && s.optionTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[s.btn, !discovery && s.btnDisabled]}
                disabled={!discovery}
                onPress={goNext}
              >
                <Text style={[s.btnText, !discovery && s.btnTextDisabled]}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Top row ──
  topRow: {
    position: 'relative',
    height: 64,
    marginTop:24,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 10,
    padding: 4,
  },
  backArrow: {
    fontSize: 30,
    color: TEXT_DARK,
fontWeight: '700',
  },

  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  stepWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    minHeight: 500,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    marginBottom: 40,
    textAlign: 'center',
  },

  // ── Phone ──
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // borderBottomWidth: 2,
    // borderBottomColor: BRAND_GREEN,
    paddingBottom: 10,
    marginBottom: 16,
    alignSelf: 'center',
    width: '80%',
  },
  flag: { fontSize: 24 },
  phoneInput: {
    flex: 1,
    fontSize: 26,
    color: TEXT_DARK,
    fontWeight: '300',
    letterSpacing: 3,
    padding: 0,
  },

  // ── OTP ──
  otpInput: {
    fontSize: 34,
    color: TEXT_DARK,
    letterSpacing: 14,
    fontWeight: '300',
    // borderBottomWidth: 2,
    // borderBottomColor: BRAND_GREEN,
    paddingBottom: 10,
    width: '80%',
    alignSelf: 'center',
    marginBottom: 16,
  },
  resendBtn: { alignSelf: 'center', marginTop: 16 },
  resendText: { fontSize: 13, color: BRAND_GREEN, fontWeight: '500' },

  // ── Name / Email ──
  textInput: {
    fontSize: 22,
    color: TEXT_DARK,
    fontWeight: '300',
    // borderBottomWidth: 2,
    // borderBottomColor: BRAND_GREEN,
    paddingBottom: 10,
    marginBottom: 16,
    width: '80%',
    alignSelf: 'center',
    textAlign: 'center',
  },
  skipBtn: { alignSelf: 'center', marginTop: 8 },
  skipText: { fontSize: 13, color: TEXT_MUTED },

  // ── Discovery ──
  optionList: { gap: 10, marginBottom: 16 },
  optionBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  optionBtnActive: {
    borderColor: BRAND_GREEN,
    backgroundColor: 'rgba(58,224,129,0.08)',
  },
  optionText: { fontSize: 14, color: TEXT_DARK },
  optionTextActive: { color: BRAND_GREEN, fontWeight: '500' },

  // ── Buttons ──
  btn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  btnDisabled: { backgroundColor: '#e8e8e8' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  btnTextDisabled: { color: '#aaa' },
});

import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Image, Dimensions,
} from 'react-native';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');
const BRAND_GREEN = '#3AE081';
const BG_DARK = '#000000';

export default function SafetyIntroScreen() {
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

      {/* Back */}
      <TouchableOpacity
        style={s.backBtn}
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={s.backArrow}>←</Text>
      </TouchableOpacity>

      {/* ── Title ── */}
      <View style={s.titleSection}>
        <Text style={s.title}>
          <Text style={s.titleGreen}>Walk </Text>
          Lightly{'\n'}On Country
        </Text>
      </View>

      {/* ── Hero Image ──
      <View style={s.imageWrap}>
        <Image
          source={require('../../assets/images/safety-hero.png')}
          style={s.image}
          resizeMode="cover"
        />
      </View> */}

      <View style={{ flex: 1 }} />

      {/* ── Terms checkbox ── */}
      <View style={s.bottom}>
        <TouchableOpacity
          style={s.checkRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[s.checkbox, agreed && s.checkboxActive]}>
            {agreed && <Text style={s.checkmark}>✓</Text>}
          </View>
          <Text style={s.termsText}>
            I have read and agree to the{' '}
            <Text style={s.termsLink}>Terms & Conditions</Text>
            {' '}and{' '}
            <Text style={s.termsLink}>Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>

        {/* ── Button — active only when agreed ── */}
        <TouchableOpacity
          style={[s.btn, !agreed && s.btnDisabled]}
          activeOpacity={0.85}
          disabled={!agreed}
          onPress={() => router.push('/onboarding/goals')}
        >
          <Text style={[s.btnText, !agreed && s.btnTextDisabled]}>
            {agreed ? "Let's Go 🌱" : '🔒 Agree to Continue'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  backBtn: {
    position: 'absolute',
    top: 52, left: 16,
    zIndex: 10, padding: 8,
  },
  backArrow: {
    fontSize: 22,
    color: '#ffffff',
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 48,
  },
  titleGreen: {
    color: BRAND_GREEN,
  },
  imageWrap: {
    width: width,
    height: height * 0.48,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
    gap: 14,
  },

  // ── Checkbox row ──
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22, height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: BRAND_GREEN,
    borderColor: BRAND_GREEN,
  },
  checkmark: {
    color: '#050f05',
    fontSize: 13,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },
  termsLink: {
    color: BRAND_GREEN,
    fontWeight: '500',
  },

  // ── Button ──
  btn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#050f05',
  },
  btnTextDisabled: {
    color: '#333333',
  },
});

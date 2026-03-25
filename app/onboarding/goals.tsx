import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';

// ── Palette (same as SignIn + Collect screens) ────────────────
const BG_DEEP    = '#041a14';
const CARD_BG    = '#0d1f18';
const INPUT_BG   = '#0a1a13';
const GREEN      = '#3aad7e';
const GREEN_BTN  = '#3db87f';
const GREEN_HIGHLIGHT = '#3AE081';
const TEXT_WHITE = '#ffffff';
const TEXT_MUTED = '#5a8a72';
const TEXT_HINT  = '#3a6650';
const BORDER     = '#163326';

const GOALS = [
  {
    id: 'reconnect',
    label: 'Trying To Reconnect Back To My Indigenous Heritage',
    icon: '🌀',
  },
  {
    id: 'gather',
    label: 'Gather Some Tucka Ingredients',
    icon: '🌿',
  },
  {
    id: 'walking',
    label: 'Enhance My Bush Walking on Country',
    icon: '🥾',
  },
  {
    id: 'curious',
    label: 'Generally Curious About local knowledge',
    icon: '🔍',
  },
];

// ── Shield icon (same as other screens) ──────────────────────
function ShieldIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 6v6c0 4.418 3.358 8.55 8 9.93C16.642 20.55 20 16.418 20 12V6L12 2z"
        fill={GREEN}
        opacity={0.2}
      />
      <Path
        d="M12 2L4 6v6c0 4.418 3.358 8.55 8 9.93C16.642 20.55 20 16.418 20 12V6L12 2z"
        stroke={GREEN}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke={GREEN}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke="#000"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function GoalsScreen() {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DEEP} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
         
          {/* ── Heading ── */}
          <Text style={s.heading}>
            <Text style={{ color: GREEN_HIGHLIGHT }}>What</Text> Bring You{'\n'}To Bush Tucka{'\n'}Tracka Today?
          </Text>
          <Text style={s.subheading}>
            Select all that apply — we'll personalise your experience.
          </Text>

          {/* ── Options ── */}
          <View style={s.optionList}>
            {GOALS.map((goal) => {
              const active = selected.includes(goal.id);
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[s.optionBtn, active && s.optionBtnActive]}
                  onPress={() => toggle(goal.id)}
                  activeOpacity={0.75}
                >
                  <Text style={s.optionIcon}>{goal.icon}</Text>
                  <Text style={[s.optionText, active && s.optionTextActive]}>
                    {goal.label}
                  </Text>
                  <View style={[s.checkCircle, active && s.checkCircleActive]}>
                    {active && <CheckIcon />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[s.btn, selected.length === 0 && s.btnDisabled]}
            disabled={selected.length === 0}
            onPress={() => router.push('/onboarding/safety')}
            activeOpacity={0.85}
          >
            <Text style={[s.btnText, selected.length === 0 && s.btnTextDisabled]}>
              Continue
            </Text>
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            style={s.skipBtn}
            onPress={() => router.push('/onboarding/safety')}
          >
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DEEP,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
    minHeight: 600,
  },

  // Logo — same as all other screens
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

  // Headings — same as SignIn + Collect
  heading: {
    fontSize: 34,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 10,
    lineHeight: 42,
    textAlign:"center",
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 21,
    marginBottom: 32,
      textAlign:"center",
  },

  // Option buttons — brand green highlight on active
  optionList: {
    gap: 12,
    marginBottom: 32,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  optionBtnActive: {
    borderColor: GREEN_HIGHLIGHT,
    backgroundColor: 'rgba(58,224,129,0.06)',
  },
  optionIcon: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 20,
    fontWeight: '500',
  },
  optionTextActive: {
    color: TEXT_WHITE,
    fontWeight: '600',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleActive: {
    backgroundColor: GREEN_HIGHLIGHT,
    borderColor: GREEN_HIGHLIGHT,
  },

  // CTA — same as SignIn + Collect
  btn: {
    backgroundColor: GREEN_BTN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  btnDisabled: {
    backgroundColor: 'rgba(58,173,126,0.1)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    letterSpacing: 0.2,
  },
  btnTextDisabled: {
    color: TEXT_HINT,
  },

  // Skip
  skipBtn: {
    alignSelf: 'center',
    padding: 8,
  },
  skipText: {
    fontSize: 13,
    color: TEXT_HINT,
    textDecorationLine: 'underline',
  },
});
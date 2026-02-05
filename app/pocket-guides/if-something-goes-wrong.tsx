import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Ban, Brain, Droplet, Eye, PhoneCall, ShieldCheck, Share2, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { buildShareUrl } from '@/constants/shareLinks';

type GuideSection = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  icon: 'first' | 'stop' | 'rinse' | 'observe' | 'help' | 'dont' | 'reminder';
};

const ART_URI = 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/o2kx7bu87e3fxjx2tc9zg';

const OCHRE = '#F6C445' as const;
const OCHRE_DEEP = '#FF8C3C' as const;

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 22,
      bounciness: 6,
    }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [scale]);

  return { scale, onPressIn, onPressOut };
}

function GuideIcon({ type }: { type: GuideSection['icon'] }) {
  const size = 20;
  const strokeWidth = 2.4;

  if (type === 'first') return <Brain size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'stop') return <Ban size={size} color={OCHRE} strokeWidth={strokeWidth} />;
  if (type === 'rinse') return <Droplet size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  if (type === 'observe') return <Eye size={size} color={OCHRE_DEEP} strokeWidth={strokeWidth} />;
  if (type === 'help') return <PhoneCall size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'dont') return <AlertTriangle size={size} color={OCHRE_DEEP} strokeWidth={strokeWidth} />;
  return <ShieldCheck size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
}

const SECTIONS: GuideSection[] = [
  {
    key: 'first-rule',
    title: 'First rule',
    subtitle: 'Stay calm. Panic makes things worse.',
    body:
      'Most bush-tucker issues are manageable if you act early and clearly.',
    icon: 'first',
  },
  {
    key: 'stop',
    title: 'Stop eating immediately',
    subtitle: 'Goanna awareness — pause and assess.',
    body:
      'Do this first:\n• Stop eating straight away\n• Keep the plant/food for identification\n• Do not “test” more to be sure',
    icon: 'stop',
  },
  {
    key: 'rinse',
    title: 'Rinse & rehydrate',
    subtitle: 'Kangaroo cooling — regulate and recover.',
    body:
      'If safe to do so:\n• Rinse mouth with clean water\n• Sip water slowly (don’t force)\n• Avoid alcohol or home remedies',
    icon: 'rinse',
  },
  {
    key: 'observe',
    title: 'Observe the symptoms',
    subtitle: 'Koala stillness — notice small changes.',
    body:
      'Watch for:\n• Nausea or vomiting\n• Dizziness or confusion\n• Burning, tingling, swelling\n• Difficulty breathing (urgent)\n\nNote when symptoms started and what was eaten.',
    icon: 'observe',
  },
  {
    key: 'help',
    title: 'Get help early',
    subtitle: 'Emu direction — move toward safety.',
    body:
      'If symptoms worsen or you’re unsure:\n• Call Poison Information (AU): 13 11 26\n• Seek medical help immediately if severe\n• In an emergency: 000\n\nNever “wait it out” if something feels wrong.',
    icon: 'help',
  },
  {
    key: 'dont-guess',
    title: 'Don’t guess your way through',
    subtitle: 'Dingo smarts — confidence without knowledge can be dangerous.',
    body:
      'Avoid:\n• Online “cures”\n• Bush remedies unless taught by trusted local knowledge\n• Assuming “natural = safe”',
    icon: 'dont',
  },
  {
    key: 'reminder',
    title: 'Pocket safety rule',
    subtitle: 'Country teaches patience — listen.',
    body:
      'If in doubt, don’t eat it.\nIf it feels wrong, act early.',
    icon: 'reminder',
  },
];

export default function IfSomethingGoesWrongPocketGuideScreen() {
  const headerPress = usePressScale();

  const onClose = useCallback(() => {
    console.log('[PocketGuide] close pressed', { slug: 'if-something-goes-wrong' });
    router.back();
  }, []);

  const onShare = useCallback(async () => {
    console.log('[PocketGuide] share pressed', { slug: 'if-something-goes-wrong' });

    try {
      await Haptics.selectionAsync();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[PocketGuide] haptics selection failed', { message, platform: Platform.OS });
    }

    try {
      const message =
        'Handy Pocket Guide — If Something Goes Wrong\n\nStay calm. Stop eating. Observe symptoms. Get help early.';
      const url = buildShareUrl({ path: '/pocket-guides/if-something-goes-wrong' });

      await Share.share(
        Platform.OS === 'web'
          ? { message: `${message}\n\n${url}` }
          : {
              title: 'If Something Goes Wrong',
              message,
              url,
            },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[PocketGuide] Share failed', { msg });
    }
  }, []);

  const pocketReminder = useMemo(() => {
    return 'If in doubt, don’t eat it.\nIf it feels wrong, act early.\nCountry teaches patience — listen.';
  }, []);

  return (
    <View style={styles.root} testID="pocket-guide-if-something-wrong-screen">
      <LinearGradient colors={['#07110B', '#07110B', 'rgba(255,140,60,0.10)']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.topIconBtn, pressed && styles.topIconBtnPressed]}
            testID="pocket-guide-close"
          >
            <X size={18} color={COLORS.text} />
          </Pressable>

          <Animated.View style={{ transform: [{ scale: headerPress.scale }] }}>
            <Pressable
              onPressIn={headerPress.onPressIn}
              onPressOut={headerPress.onPressOut}
              onPress={() => {
                console.log('[PocketGuide] header art pressed');
                void Haptics.selectionAsync().catch(() => null);
              }}
              style={styles.brandPill}
              testID="pocket-guide-brand-pill"
            >
              <View style={styles.brandPillRow}>
                <View style={styles.brandDot} />
                <Text style={styles.brandPillText}>Handy Pocket Guide</Text>
              </View>
            </Pressable>
          </Animated.View>

          <Pressable
            onPress={onShare}
            hitSlop={10}
            style={({ pressed }) => [styles.topIconBtn, pressed && styles.topIconBtnPressed]}
            testID="pocket-guide-share"
          >
            <Share2 size={18} color={COLORS.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="pocket-guide-scroll">
          <View style={styles.heroCard} testID="pocket-guide-hero-card">
            <LinearGradient
              colors={['rgba(56,217,137,0.14)', 'rgba(246,196,69,0.16)', 'rgba(255,140,60,0.12)']}
              start={{ x: 0.05, y: 0.0 }}
              end={{ x: 0.95, y: 1.0 }}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.heroTopRow}>
              <View style={styles.heroIconShell} testID="pocket-guide-hero-icon-shell">
                <Image
                  source={{ uri: ART_URI }}
                  style={styles.heroIcon}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={160}
                  testID="pocket-guide-hero-icon"
                  onLoad={() => console.log('[PocketGuide] hero art loaded', { uri: ART_URI })}
                  onError={(e) =>
                    console.log('[PocketGuide] hero art load error', {
                      uri: ART_URI,
                      error: (e as unknown as { error?: string })?.error,
                    })
                  }
                />
              </View>

              <View style={styles.heroTitleWrap}>
                <Text style={styles.heroTitle} testID="pocket-guide-title">
                  If Something
                </Text>
                <Text style={styles.heroTitle2} testID="pocket-guide-title-2">
                  Goes Wrong
                </Text>
                <Text style={styles.heroSubtitle} testID="pocket-guide-subtitle">
                  Calm actions first — identify, hydrate, observe, get help.
                </Text>
              </View>
            </View>

            <View style={styles.reminderCard} testID="pocket-guide-reminder">
              <View style={styles.reminderTopRow}>
                <View style={styles.reminderIconWrap}>
                  <ShieldCheck size={18} color={OCHRE} />
                </View>
                <Text style={styles.reminderTitle}>Pocket reminder</Text>
              </View>
              <Text style={styles.reminderText}>{pocketReminder}</Text>
            </View>
          </View>

          <View style={styles.sectionsWrap} testID="pocket-guide-sections">
            {SECTIONS.map((s, idx) => (
              <PocketSectionCard key={s.key} section={s} index={idx} />
            ))}
          </View>

          <View style={styles.footer} testID="pocket-guide-footer">
            <View style={styles.footerRow}>
              <AlertTriangle size={18} color={COLORS.textSecondary} />
              <Text style={styles.footerText}>
                This guide is general information only. If symptoms are severe or you’re unsure, get medical help early.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const PocketSectionCard = React.memo(function PocketSectionCard({
  section,
  index,
}: {
  section: GuideSection;
  index: number;
}) {
  const press = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          console.log('[PocketGuide] section pressed', { key: section.key, index });
          void Haptics.selectionAsync().catch(() => null);
        }}
        style={styles.sectionCard}
        testID={`pocket-guide-section-${section.key}`}
      >
        <View style={styles.sectionCardTopRow}>
          <View style={styles.sectionIconWrap} testID={`pocket-guide-section-icon-${section.key}`}>
            <GuideIcon type={section.icon} />
          </View>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitleText}>{section.title}</Text>
            <Text style={styles.sectionSubtitleText}>{section.subtitle}</Text>
          </View>
        </View>

        <Text style={styles.sectionBodyText}>{section.body}</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  brandPill: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,60,0.22)',
    justifyContent: 'center',
  },
  brandPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height:  8,
    borderRadius: 99,
    backgroundColor: OCHRE_DEEP,
    shadowColor: OCHRE_DEEP,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  brandPillText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  heroIconShell: {
    width: 86,
    height: 86,
    borderRadius: 28,
    backgroundColor: 'rgba(7,17,11,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 66,
    height: 66,
  },
  heroTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroTitle2: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 1,
  },
  heroSubtitle: {
    marginTop: 6,
    color: 'rgba(234,246,238,0.76)',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  reminderCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(7,17,11,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,60,0.22)',
  },
  reminderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(246,196,69,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  reminderText: {
    marginTop: 8,
    color: 'rgba(242,245,242,0.86)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  sectionsWrap: {
    marginTop: 16,
    gap: 12,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sectionCardTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(7,17,11,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitleText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sectionSubtitleText: {
    marginTop: 2,
    color: 'rgba(242,245,242,0.68)',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  sectionBodyText: {
    marginTop: 10,
    color: 'rgba(242,245,242,0.84)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  footer: {
    marginTop: 18,
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(7,17,11,0.44)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  footerText: {
    flex: 1,
    color: 'rgba(242,245,242,0.66)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
});

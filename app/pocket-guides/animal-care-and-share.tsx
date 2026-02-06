import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Bird, Feather, Globe, HandHeart, Leaf, RefreshCcw, ShieldAlert, Share2, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { buildShareUrl } from '@/constants/shareLinks';

type GuideSection = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  icon: 'core' | 'guest' | 'homes' | 'food' | 'space' | 'snake' | 'teaching' | 'reminder';
};

const ART_URI = 'https://r2-pub.rork.com/generated-images/d1bfa1a5-0352-4383-b92c-f9582ffff272.png';

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

  if (type === 'core') return <Globe size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'guest') return <Feather size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  if (type === 'homes') return <ShieldAlert size={size} color={OCHRE} strokeWidth={strokeWidth} />;
  if (type === 'food') return <Leaf size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'space') return <AlertTriangle size={size} color={OCHRE_DEEP} strokeWidth={strokeWidth} />;
  if (type === 'snake') return <ShieldAlert size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  if (type === 'teaching') return <RefreshCcw size={size} color={OCHRE} strokeWidth={strokeWidth} />;
  return <HandHeart size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
}

const SECTIONS: GuideSection[] = [
  {
    key: 'core',
    title: 'Core understanding',
    subtitle: 'We share Country with furred, feathered & scaly kin.',
    body:
      'You’re never alone on Country. Every place is home to animals who rely on the same food, water, and shelter.\n\nWhen you care for them, Country cares for you.',
    icon: 'core',
  },
  {
    key: 'guest',
    title: 'Move like a guest',
    subtitle: 'Kangaroo awareness',
    body:
      'Kangaroos move gently and only take what they need.\n\nRemember:\n• Walk softly and observe before entering an area\n• Avoid trampling nests, burrows, or feeding grounds\n• Stay on clear paths where possible',
    icon: 'guest',
  },
  {
    key: 'homes',
    title: 'Respect homes & hiding places',
    subtitle: 'Goanna respect',
    body:
      'Goannas use logs, rocks, and hollows as shelter.\n\nNever:\n• Lift rocks or logs unnecessarily\n• Disturb hollow trees or fallen timber\n• Chase or corner wildlife\n\nIf you uncover a habitat, restore it exactly as found.',
    icon: 'homes',
  },
  {
    key: 'food',
    title: 'Leave food for others',
    subtitle: 'Echidna sharing',
    body:
      'Echidnas depend on native plants and insects to survive.\n\nWhen harvesting:\n• Take only a small portion\n• Leave the healthiest plants untouched\n• Avoid harvesting during drought or stress periods\n\nCountry works on reciprocity, not excess.',
    icon: 'food',
  },
  {
    key: 'space',
    title: 'Give space, not snacks',
    subtitle: 'Emu distance',
    body:
      'Emus keep their distance for good reason.\n\nDo not:\n• Feed wild animals\n• Approach for photos\n• Try to “help” unless injured\n\nHuman food harms wildlife and changes natural behaviour.',
    icon: 'space',
  },
  {
    key: 'snake',
    title: 'Be snake smart',
    subtitle: 'Snake wisdom',
    body:
      'Snakes are not aggressive — they protect themselves.\n\nIf you see a snake:\n• Stay still or slowly move away\n• Do not provoke or try to handle\n• Alert others calmly\n\nSnakes play a vital role in keeping ecosystems balanced.',
    icon: 'snake',
  },
  {
    key: 'teaching',
    title: 'Cultural teaching',
    subtitle: 'Animals are teachers, not obstacles.',
    body:
      'They show us when to slow down, move on, or leave a place alone.\n\nRespect for animals is respect for future generations.',
    icon: 'teaching',
  },
];

export default function AnimalCareAndSharePocketGuideScreen() {
  const headerPress = usePressScale();

  const onClose = useCallback(() => {
    console.log('[PocketGuide] close pressed', { slug: 'animal-care-and-share' });
    router.back();
  }, []);

  const onShare = useCallback(async () => {
    console.log('[PocketGuide] share pressed', { slug: 'animal-care-and-share' });
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[PocketGuide] haptics selection failed', { message, platform: Platform.OS });
    }

    try {
      const message =
        'Handy Pocket Guide — Animal Care & Share\n\nWe don’t own Country — we belong to it. Care for animals as kin, not content. Take care, share care, move with respect.';
      const url = buildShareUrl({ path: '/pocket-guides/animal-care-and-share' });

      await Share.share(
        Platform.OS === 'web'
          ? { message: `${message}\n\n${url}` }
          : {
              title: 'Animal Care & Share',
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
    return 'We don’t own Country — we belong to it.\nCare for animals as kin, not content.\nTake care, share care, move with respect.';
  }, []);

  return (
    <View style={styles.root} testID="pocket-guide-animal-care-screen">
      <LinearGradient colors={['#07110B', '#07110B', 'rgba(246,196,69,0.10)']} style={StyleSheet.absoluteFillObject} />
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
              colors={['rgba(56,217,137,0.16)', 'rgba(246,196,69,0.18)', 'rgba(255,140,60,0.10)']}
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
                  Animal Care
                </Text>
                <Text style={styles.heroTitle2} testID="pocket-guide-title-2">
                  & Share
                </Text>
                <Text style={styles.heroSubtitle} testID="pocket-guide-subtitle">
                  Respecting Country critters — with calm, distance, and care.
                </Text>
              </View>
            </View>

            <View style={styles.reminderCard} testID="pocket-guide-reminder">
              <View style={styles.reminderTopRow}>
                <View style={styles.reminderIconWrap}>
                  <HandHeart size={18} color={OCHRE} />
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
              <Bird size={18} color={COLORS.textSecondary} />
              <Text style={styles.footerText}>
                This guide is general and non-restricted. Always follow local protocols and seek guidance from local knowledge
                holders where possible.
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
    borderColor: 'rgba(56,217,137,0.20)',
    justifyContent: 'center',
  },
  brandPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
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
    borderColor: 'rgba(246,196,69,0.20)',
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
    marginTop: 10,
    color: 'rgba(234,246,238,0.86)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sectionsWrap: {
    marginTop: 14,
    gap: 12,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  sectionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: 'rgba(7,17,11,0.60)',
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
    color: 'rgba(234,246,238,0.70)',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  sectionBodyText: {
    marginTop: 10,
    color: 'rgba(234,246,238,0.86)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  footer: {
    marginTop: 16,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(7,17,11,0.46)',
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
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});

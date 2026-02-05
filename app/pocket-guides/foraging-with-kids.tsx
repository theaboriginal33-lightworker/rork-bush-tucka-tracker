import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Bird,
  BookmarkPlus,
  Feather,
  Globe,
  HandHeart,
  Leaf,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Share2,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { buildShareUrl } from '@/constants/shareLinks';

type GuideSection = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  icon: 'core' | 'observe' | 'safety' | 'wildlife' | 'less' | 'play' | 'teaching' | 'promise' | 'why';
};

const ART_URI = 'https://r2-pub.rork.com/generated-images/aabd01af-554f-4bb0-a96b-3f80b1bdf21e.png';

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
  if (type === 'observe') return <Search size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  if (type === 'safety') return <ShieldCheck size={size} color={OCHRE} strokeWidth={strokeWidth} />;
  if (type === 'wildlife') return <ShieldAlert size={size} color={OCHRE_DEEP} strokeWidth={strokeWidth} />;
  if (type === 'less') return <Leaf size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'play') return <BookmarkPlus size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  if (type === 'teaching') return <Feather size={size} color={OCHRE} strokeWidth={strokeWidth} />;
  if (type === 'promise') return <HandHeart size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  return <RefreshCcw size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
}

const SECTIONS: GuideSection[] = [
  {
    key: 'rule',
    title: 'Start with this rule',
    subtitle: 'Country comes first. Kids learn by watching.',
    body:
      'Before picking anything, teach children to:\n• Stop\n• Look\n• Listen\n• Ask\n\nForaging is not collecting — it’s relationship building.',
    icon: 'core',
  },
  {
    key: 'observe',
    title: 'Look before you touch',
    subtitle: 'Kangaroo rule — pause and scan.',
    body:
      'Teach kids to:\n• Observe plants and animals from a distance\n• Notice insects, tracks, nests, and webs\n• Ask: “Who else uses this?”\n\nIf animals rely on it — leave it.',
    icon: 'observe',
  },
  {
    key: 'safety',
    title: 'Plant safety first',
    subtitle: 'Echidna wisdom — instincts take time.',
    body:
      'Golden rule:\nIf you don’t know it 100%, you don’t touch it.\n\nTeach kids:\n• Only harvest plants you’ve already identified\n• Never taste raw plants\n• Wash hands after touching leaves, berries, or soil',
    icon: 'safety',
  },
  {
    key: 'wildlife',
    title: 'Hands off wildlife',
    subtitle: 'Goanna respect — give space.',
    body:
      'Kids should know:\n• Never chase, pick up, or poke animals\n• Watch quietly and give space\n• Injured animals = tell an adult, don’t intervene\n\nWildlife is not a toy — it’s family.',
    icon: 'wildlife',
  },
  {
    key: 'less',
    title: 'Take less than you think',
    subtitle: 'Emu sharing — move on so others can eat.',
    body:
      'When foraging with kids:\n• Take one for learning, not many for collecting\n• Leave flowers and seeds to regenerate\n• Avoid harvesting in dry or stressed areas\n\nThis teaches restraint, not scarcity.',
    icon: 'less',
  },
  {
    key: 'play',
    title: 'Make it a game (not a grab)',
    subtitle: 'Playful challenges that keep respect first.',
    body:
      'Try kid-friendly missions:\n• Spot 5 different leaf shapes\n• Find animal tracks (no touching)\n• Smell plants, don’t taste\n• Take photos instead of picking\n\nLearning sticks when it’s playful and respectful.',
    icon: 'play',
  },
  {
    key: 'teaching',
    title: 'Cultural teaching (kid-friendly)',
    subtitle: '“Country looks after us when we look after her.”',
    body:
      'Explain simply:\n• Plants grow back when we’re kind\n• Animals stay safe when we give space\n• Sharing keeps Country strong\n\nKids understand fairness — this is where it begins.',
    icon: 'teaching',
  },
  {
    key: 'promise',
    title: 'Pocket promise',
    subtitle: 'A short mantra kids can repeat.',
    body:
      'I walk gently.\nI take only what I need.\nI look after plants and animals.\nCountry looks after me.',
    icon: 'promise',
  },
  {
    key: 'why',
    title: 'Why this guide matters',
    subtitle: 'Safety + raising Country-aware humans.',
    body:
      'This isn’t just about safety. It’s about raising Country-aware, confident, respectful humans.',
    icon: 'why',
  },
];

export default function ForagingWithKidsPocketGuideScreen() {
  const headerPress = usePressScale();

  const onClose = useCallback(() => {
    console.log('[PocketGuide] close pressed', { slug: 'foraging-with-kids' });
    router.back();
  }, []);

  const onShare = useCallback(async () => {
    console.log('[PocketGuide] share pressed', { slug: 'foraging-with-kids' });
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[PocketGuide] haptics selection failed', { message, platform: Platform.OS });
    }

    try {
      const message =
        'Handy Pocket Guide — Foraging With Kids\n\nStop. Look. Listen. Ask. Foraging isn’t collecting — it’s relationship building.';
      const url = buildShareUrl({ path: '/pocket-guides/foraging-with-kids' });

      await Share.share(
        Platform.OS === 'web'
          ? { message: `${message}\n\n${url}` }
          : {
              title: 'Foraging With Kids',
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
    return 'I walk gently.\nI take only what I need.\nI look after plants and animals.\nCountry looks after me.';
  }, []);

  return (
    <View style={styles.root} testID="pocket-guide-foraging-kids-screen">
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
                  Foraging
                </Text>
                <Text style={styles.heroTitle2} testID="pocket-guide-title-2">
                  With Kids
                </Text>
                <Text style={styles.heroSubtitle} testID="pocket-guide-subtitle">
                  Stop • Look • Listen • Ask — safety + respect in every step.
                </Text>
              </View>
            </View>

            <View style={styles.reminderCard} testID="pocket-guide-reminder">
              <View style={styles.reminderTopRow}>
                <View style={styles.reminderIconWrap}>
                  <HandHeart size={18} color={OCHRE} />
                </View>
                <Text style={styles.reminderTitle}>Pocket promise</Text>
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
                This guide is general and non-restricted. Always follow local protocols and seek guidance from local knowledge holders where possible.
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

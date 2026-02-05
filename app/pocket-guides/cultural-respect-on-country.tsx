import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Feather,
  HandHeart,
  Leaf,
  RefreshCcw,
  Sprout,
  Squirrel,
  Bird,
  ShieldCheck,
  Globe,
  X,
  Share2,
} from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

type GuideSection = {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  icon:
    | 'feather'
    | 'sprout'
    | 'reciprocity'
    | 'flora-fauna'
    | 'gratitude'
    | 'all-of-us'
    | 'cultural-note';
};

const ART_URI =
  'https://r2-pub.rork.com/generated-images/5d6196cf-6797-44a6-a08c-43f48ad17307.png';

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

  if (type === 'feather') return <Feather size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'sprout') return <Sprout size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  if (type === 'reciprocity') return <RefreshCcw size={size} color={OCHRE} strokeWidth={strokeWidth} />;
  if (type === 'flora-fauna') return <Leaf size={size} color={COLORS.primary} strokeWidth={strokeWidth} />;
  if (type === 'gratitude') return <HandHeart size={size} color={OCHRE_DEEP} strokeWidth={strokeWidth} />;
  if (type === 'all-of-us') return <ShieldCheck size={size} color={COLORS.secondary} strokeWidth={strokeWidth} />;
  return <Globe size={size} color={OCHRE} strokeWidth={strokeWidth} />;
}

const SECTIONS: GuideSection[] = [
  {
    key: 'core',
    title: 'Core principle',
    subtitle: 'Country is not a resource. Country is a relationship.',
    body:
      'When you walk on Country, you are entering a living system — land, water, plants, animals, and people — all connected.',
    icon: 'feather',
  },
  {
    key: 'only-take',
    title: 'Only take what you need',
    subtitle: 'Kangaroo wisdom',
    body:
      'Kangaroos graze lightly and move on, allowing the land to recover.\n\nGuide:\n• Harvest small amounts\n• Leave plenty behind\n• Never strip a plant bare\n\nIf it feels excessive, it probably is.',
    icon: 'sprout',
  },
  {
    key: 'reciprocity',
    title: 'Country works with reciprocity',
    subtitle: 'Emu teaching',
    body:
      'Emus move with the seasons, not against them.\n\nAsk yourself:\n• What am I giving back?\n• Am I learning, caring, or protecting?\n\nReciprocity can be respect, care, learning, or sharing — not just taking.',
    icon: 'reciprocity',
  },
  {
    key: 'flora-fauna',
    title: 'Care for flora & fauna',
    subtitle: 'Wombat logic (future generations)',
    body:
      'Wombats protect their homes for the long haul.\n\nRemember:\n• Today’s harvest affects tomorrow’s growth\n• Leave strong plants to seed\n• Avoid disturbing animal habitats\n\nThink seven generations ahead.',
    icon: 'flora-fauna',
  },
  {
    key: 'gratitude',
    title: 'Show gratitude',
    subtitle: 'Kookaburra spirit',
    body:
      'The bush provides — acknowledge it.\n\nSimple ways to show respect:\n• Pause before harvesting\n• Offer thanks (silently or spoken)\n• Teach others with care, not ego\n\nGratitude keeps knowledge alive.',
    icon: 'gratitude',
  },
  {
    key: 'all-of-us',
    title: 'Country is for all of us',
    subtitle: 'Echidna lesson — care for her',
    body:
      'Quiet, gentle, and protective.\n\nRespect looks like:\n• Asking permission on private or protected land\n• Leaving no trace\n• Sharing knowledge responsibly\n\nCountry gives to all — when all care for her.',
    icon: 'all-of-us',
  },
  {
    key: 'note',
    title: 'Cultural note',
    subtitle: 'Knowledge and practices vary by region, Nation, and community.',
    body:
      'This guide shares general, non-restricted principles — always seek local knowledge where possible.',
    icon: 'cultural-note',
  },
];

export default function CulturalRespectOnCountryPocketGuideScreen() {
  const headerPress = usePressScale();

  const onClose = useCallback(() => {
    console.log('[PocketGuide] close pressed', { slug: 'cultural-respect-on-country' });
    router.back();
  }, []);

  const onShare = useCallback(async () => {
    console.log('[PocketGuide] share pressed', { slug: 'cultural-respect-on-country' });
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[PocketGuide] haptics selection failed', { message, platform: Platform.OS });
    }

    try {
      const message =
        'Handy Pocket Guide — Cultural respect On Country\n\nWalk gently. Take little. Give back. Leave Country stronger than you found her.';
      const url = 'https://bush-tucka-tracka.rork.app';

      await Share.share(
        Platform.OS === 'web'
          ? { message: `${message}\n\n${url}` }
          : {
              title: 'Cultural respect On Country',
              message,
              url,
            }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[PocketGuide] Share failed', { msg });
    }
  }, []);

  const pocketReminder = useMemo(() => {
    return 'Walk gently. Take little. Give back.\nLeave Country stronger than you found her.';
  }, []);

  return (
    <View style={styles.root} testID="pocket-guide-cultural-respect-screen">
      <LinearGradient colors={['#07110B', '#07110B', 'rgba(56,217,137,0.10)']} style={StyleSheet.absoluteFillObject} />
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

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          testID="pocket-guide-scroll"
        >
          <View style={styles.heroCard} testID="pocket-guide-hero-card">
            <LinearGradient
              colors={['rgba(56,217,137,0.18)', 'rgba(246,196,69,0.16)', 'rgba(255,140,60,0.10)']}
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
                  Cultural respect
                </Text>
                <Text style={styles.heroTitle2} testID="pocket-guide-title-2">
                  On Country
                </Text>
                <Text style={styles.heroSubtitle} testID="pocket-guide-subtitle">
                  A gentle, practical guide for walking with respect.
                </Text>
              </View>
            </View>

            <View style={styles.reminderCard} testID="pocket-guide-reminder">
              <View style={styles.reminderTopRow}>
                <View style={styles.reminderIconWrap}>
                  <Squirrel size={18} color={OCHRE} />
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
    marginBottom: 8,
  },
  reminderIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: 'rgba(246,196,69,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  reminderText: {
    color: 'rgba(234,246,238,0.86)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  sectionsWrap: {
    marginTop: 14,
    gap: 12,
  },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  sectionCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,217,137,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitleText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  sectionSubtitleText: {
    marginTop: 2,
    color: 'rgba(234,246,238,0.72)',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  sectionBodyText: {
    color: 'rgba(234,246,238,0.78)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  footerText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});

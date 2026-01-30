import React, { useCallback, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ChevronLeft, CookingPot, ExternalLink, Sparkles, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useCookbook } from '@/app/providers/CookbookProvider';

function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

type RecipeIdea = {
  id: string;
  title: string;
  time: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  whyItFits: string;
  steps: string[];
  imageUri: string;
};

function hashToSig(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 1000;
}

function buildUnsplashQueryUrl(query: string, stableKey: string): string {
  const q = encodeURIComponent(query.trim().replace(/\s+/g, ' '));
  const sig = hashToSig(stableKey);
  return `https://source.unsplash.com/featured/1200x800?${q}&sig=${sig}`;
}

function buildRecipeIdeas(commonName: string, suggestedUses: string[]): RecipeIdea[] {
  const useHint = suggestedUses[0] ?? 'a versatile ingredient';

  const baseTerms = `${commonName} native australian bush tucker ingredient`;

  return [
    {
      id: 'idea-1',
      title: `${commonName} Bush Spice Rub`,
      time: '20 min',
      difficulty: 'Easy',
      whyItFits: `Leans into “${useHint}” and works well as a finishing dust or rub.`,
      steps: [
        'Toast crushed pepperberries/seeds lightly (optional).',
        `Combine dried ${commonName} (or substitute) with salt, citrus zest, and oil.`,
        'Rub onto fish/meat/veg and rest 10 minutes.',
        'Cook as usual, then finish with a pinch of the rub.',
      ],
      imageUri: buildUnsplashQueryUrl(`${baseTerms}, spice rub, grilled fish, rustic plating, moody food photography`, 'idea-1'),
    },
    {
      id: 'idea-2',
      title: `${commonName} Infused Syrup`,
      time: '25 min',
      difficulty: 'Easy',
      whyItFits: 'Great for drinks + desserts, and it’s forgiving if your ingredient is subtle.',
      steps: [
        'Simmer sugar + water 1:1.',
        `Add ${commonName} and keep at a gentle simmer for 8–10 minutes.`,
        'Cool completely, strain, and store chilled.',
        'Use in soda water, cocktails, or drizzle over fruit.',
      ],
      imageUri: buildUnsplashQueryUrl(`${baseTerms}, cocktail syrup, glass bottle, citrus, bar, bokeh`, 'idea-2'),
    },
    {
      id: 'idea-3',
      title: `${commonName} Quick Chutney`,
      time: '40 min',
      difficulty: 'Medium',
      whyItFits: 'A classic bush-tucker friendly format: sweet/acid/salt highlights aromatics.',
      steps: [
        'Sauté onion/garlic (optional) in a little oil.',
        `Add chopped ${commonName} (or folded in near the end if delicate).`,
        'Add vinegar + sugar + pinch of salt and simmer until glossy.',
        'Cool and serve with grilled meats or cheese.',
      ],
      imageUri: buildUnsplashQueryUrl(`${baseTerms}, chutney, jar, wooden board, artisan food, natural light`, 'idea-3'),
    },
  ];
}

export default function CookDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const cookId = typeof id === 'string' ? id : '';

  const { getEntryById, removeEntry } = useCookbook();
  const entry = getEntryById(cookId);

  const ideas = useMemo(() => {
    if (!entry) return [] as RecipeIdea[];
    return buildRecipeIdeas(entry.commonName, entry.suggestedUses);
  }, [entry]);

  const onRemove = useCallback(() => {
    if (!entry) return;
    Alert.alert('Remove from Cook?', 'This will remove it from your Cook list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeEntry(entry.id)
            .then(() => {
              router.back();
            })
            .catch((e) => {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[CookDetails] removeEntry failed', { message });
              Alert.alert('Could not remove', 'Please try again.');
            });
        },
      },
    ]);
  }, [entry, removeEntry]);

  if (!entry) {
    return (
      <View style={styles.container} testID="cook-details-missing">
        <Stack.Screen options={{ title: 'Cook', headerShown: false }} />
        <View style={styles.heroBg} />
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} testID="cook-details-back">
            <ChevronLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Cook</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.missingCard}>
          <Text style={styles.missingTitle}>Not found</Text>
          <Text style={styles.missingText}>This Cook item might have been removed or is still loading.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()} testID="cook-details-go-back">
            <Text style={styles.primaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const safetyLabel = entry.safetyStatus.toUpperCase();
  const safetyColor =
    entry.safetyStatus === 'safe' ? COLORS.success : entry.safetyStatus === 'unsafe' ? COLORS.error : COLORS.warning;

  return (
    <View style={styles.container} testID="cook-details">
      <Stack.Screen options={{ title: entry.title, headerShown: false }} />
      <View style={styles.heroBg} />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} testID="cook-details-back">
          <ChevronLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {entry.title}
        </Text>
        <TouchableOpacity style={styles.trashButton} onPress={onRemove} testID="cook-details-remove">
          <Trash2 size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="cook-details-scroll">
        <View style={styles.heroCard}>
          <Image
            source={{
              uri:
                entry.imageUri ??
                'https://images.unsplash.com/photo-1541544181051-e46601a43f2b?q=80&w=1600&auto=format&fit=crop',
            }}
            style={styles.heroImage}
            contentFit="cover"
            testID="cook-details-image"
          />
          <View style={styles.heroOverlay}>
            <View style={styles.badgeRow}>
              <View style={[styles.safetyBadge, { borderColor: `${safetyColor}55` }]}
              >
                <View style={[styles.safetyDot, { backgroundColor: safetyColor }]} />
                <Text style={styles.safetyText}>{safetyLabel}</Text>
              </View>
              <Pill text={`${Math.round(entry.confidence * 100)}% confidence`} />
            </View>

            <View style={styles.heroTitleRow}>
              <View style={styles.heroTitleStack}>
                <Text style={styles.heroTitle}>{entry.commonName}</Text>
                {entry.scientificName ? <Text style={styles.heroSubtitle}>{entry.scientificName}</Text> : null}
              </View>
              <View style={styles.heroIcon}>
                <CookingPot size={22} color={COLORS.primary} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section} testID="cook-details-section-ideas">
          <Text style={styles.sectionTitle}>Recipe ideas</Text>
          <Text style={styles.bodyText}>These are quick, safe-style suggestions. Always cross-check your plant ID and safety before eating.</Text>
        </View>

        {ideas.map((idea) => (
          <View key={idea.id} style={styles.ideaCard} testID={`cook-idea-${idea.id}`}>
            <View style={styles.ideaMedia}>
              <Image
                source={{ uri: idea.imageUri }}
                style={styles.ideaImage}
                contentFit="cover"
                transition={220}
                cachePolicy="memory-disk"
                testID={`cook-idea-image-${idea.id}`}
              />
              <View style={styles.ideaImageOverlay} />

              <View style={styles.ideaHeaderOnImage}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ideaTitle}>{idea.title}</Text>
                  <Text style={styles.ideaMeta}>{idea.time} • {idea.difficulty}</Text>
                </View>
                <View style={styles.ideaIcon}>
                  <Sparkles size={18} color={COLORS.secondary} />
                </View>
              </View>
            </View>

            <Text style={styles.ideaWhy}>{idea.whyItFits}</Text>

            <View style={styles.stepsList}>
              {idea.steps.map((s, idx) => (
                <View key={`${idea.id}-step-${idx}`} style={styles.stepRow}>
                  <Text style={styles.stepIndex}>{idx + 1}</Text>
                  <Text style={styles.stepText}>{s}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                console.log('[CookDetails] open learn for idea', { cookId: entry.id, ideaId: idea.id });
                router.push('/learn');
              }}
              testID={`cook-idea-open-learn-${idea.id}`}
            >
              <ExternalLink size={16} color={COLORS.text} />
              <Text style={styles.secondaryButtonText}>Learn more ingredients</Text>
            </TouchableOpacity>
          </View>
        ))}

        {entry.suggestedUses.length > 0 ? (
          <View style={styles.section} testID="cook-details-section-suggested-uses">
            <Text style={styles.sectionTitle}>Suggested uses from scan</Text>
            <View style={styles.pillRow}>
              {entry.suggestedUses.slice(0, 12).map((u) => (
                <Pill key={u} text={u} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  topTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  heroCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 18,
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  heroOverlay: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7,17,11,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  safetyDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  safetyText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  pill: {
    backgroundColor: 'rgba(56,217,137,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: 0.2,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleStack: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(7,17,11,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  ideaCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
  },
  ideaMedia: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.14)',
  },
  ideaImage: {
    width: '100%',
    height: 150,
  },
  ideaImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,17,11,0.25)',
  },
  ideaHeaderOnImage: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  ideaTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  ideaMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  ideaIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaWhy: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  stepsList: {
    gap: 10,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(56,217,137,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.28)',
    color: COLORS.secondary,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  secondaryButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  missingCard: {
    marginTop: 40,
    marginHorizontal: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 6,
  },
  missingText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginBottom: 14,
  },
  primaryButton: {
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(56,217,137,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});

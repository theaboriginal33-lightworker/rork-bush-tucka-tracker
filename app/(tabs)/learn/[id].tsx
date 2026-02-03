import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { COLORS } from '@/constants/colors';
import { hasSupabaseConfig, supabase, supabasePublicDebugInfo } from '@/constants/supabase';

type LearnPlant = {
  id: string;
  slug: string;
  commonName: string;
  scientificName?: string;
  category?: string;
  heroImageUrl?: string;
  summary?: string;
  tags?: string[];
};

type SupabasePlantRow = {
  id: string | number;
  slug?: string | null;
  common_name?: string | null;
  scientific_name?: string | null;
  category?: string | null;
  hero_image_url?: string | null;
  summary?: string | null;
  tags?: string[] | null;
};

const FALLBACK_PLANTS: LearnPlant[] = [
  {
    id: 'fallback-1',
    slug: 'finger-lime',
    commonName: 'Finger Lime',
    scientificName: 'Citrus australasica',
    category: 'Fruit',
    heroImageUrl:
      'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop',
    summary: 'A citrus with caviar-like pearls used in both sweet and savoury dishes.',
    tags: ['citrus', 'garnish'],
  },
  {
    id: 'fallback-2',
    slug: 'wattleseed',
    commonName: 'Wattleseed',
    scientificName: 'Acacia spp.',
    category: 'Seed',
    heroImageUrl:
      'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop',
    summary: 'Nutty, coffee-like roasted seed often used in baking and spice blends.',
    tags: ['roasted', 'flour'],
  },
  {
    id: 'fallback-3',
    slug: 'davidson-plum',
    commonName: 'Davidson Plum',
    scientificName: 'Davidsonia spp.',
    category: 'Fruit',
    heroImageUrl:
      'https://images.unsplash.com/photo-1678165842817-062e21245781?q=80&w=2574&auto=format&fit=crop',
    summary: 'Tart rainforest fruit great for jams, sauces and syrups.',
    tags: ['jam', 'syrup'],
  },
  {
    id: 'fallback-4',
    slug: 'saltbush',
    commonName: 'Saltbush',
    scientificName: 'Atriplex nummularia',
    category: 'Leaf',
    heroImageUrl:
      'https://images.unsplash.com/photo-1596726540679-0df8e8e7a61d?q=80&w=2787&auto=format&fit=crop',
    summary: 'A native leaf with a clean saline finish—excellent with roasted meats.',
    tags: ['leafy', 'salty'],
  },
  {
    id: 'fallback-5',
    slug: 'macadamia',
    commonName: 'Macadamia',
    scientificName: 'Macadamia integrifolia',
    category: 'Nut',
    heroImageUrl:
      'https://images.unsplash.com/photo-1523498877546-6c8469c4505c?q=80&w=2670&auto=format&fit=crop',
    summary: 'Creamy native nut used for pralines, oils, pestos and crusts.',
    tags: ['nut', 'oil'],
  },
];

function toLearnPlant(row: SupabasePlantRow, index: number): LearnPlant {
  const rawId = row.id;
  const id = typeof rawId === 'number' ? String(rawId) : String(rawId ?? `row-${index}`);
  const slug = String(row.slug ?? row.common_name ?? id)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

  return {
    id,
    slug: slug.length > 0 ? slug : id,
    commonName: String(row.common_name ?? 'Unknown plant'),
    scientificName: row.scientific_name ? String(row.scientific_name) : undefined,
    category: row.category ? String(row.category) : undefined,
    heroImageUrl: row.hero_image_url ? String(row.hero_image_url) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    tags: Array.isArray(row.tags) ? row.tags.map((t) => String(t)) : undefined,
  };
}

async function fetchPlantByIdOrSlug(idOrSlug: string): Promise<LearnPlant | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  if (!hasSupabaseConfig) {
    console.log('[learn-detail] supabase not configured; using fallback', supabasePublicDebugInfo);
    const local = FALLBACK_PLANTS.find((p) => p.slug === trimmed || p.id === trimmed) ?? null;
    return local;
  }

  try {
    console.log('[learn-detail] fetching plant', { idOrSlug: trimmed });

    const { data, error } = await supabase
      .from('learn_plants')
      .select('id, slug, common_name, scientific_name, category, hero_image_url, summary, tags')
      .or(`id.eq.${trimmed},slug.eq.${trimmed}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('[learn-detail] supabase error; fallback', { message: error.message });
      return FALLBACK_PLANTS.find((p) => p.slug === trimmed || p.id === trimmed) ?? null;
    }

    if (!data) {
      console.log('[learn-detail] not found');
      return null;
    }

    return toLearnPlant(data as SupabasePlantRow, 0);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[learn-detail] unexpected error', { message });
    return FALLBACK_PLANTS.find((p) => p.slug === trimmed || p.id === trimmed) ?? null;
  }
}

export default function LearnPlantDetailScreen() {
  const params = useLocalSearchParams();
  const idParam = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const plantQuery = useQuery({
    queryKey: ['learn', 'plant', idParam],
    queryFn: () => fetchPlantByIdOrSlug(idParam),
    enabled: idParam.trim().length > 0,
  });

  const plant = plantQuery.data ?? null;

  const hero = plant?.heroImageUrl ?? FALLBACK_PLANTS[0]?.heroImageUrl;
  const tags = useMemo<string[]>(() => {
    if (!plant?.tags) return [];
    return plant.tags.map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.tags]);

  const renderTag = useCallback((t: string) => {
    return (
      <View key={t} style={styles.tag} testID={`learn-tag-${t}`}>
        <Text style={styles.tagText}>{t}</Text>
      </View>
    );
  }, []);

  if (plantQuery.isLoading) {
    return (
      <View style={styles.loadingContainer} testID="learn-detail-loading">
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={styles.loadingContainer} testID="learn-detail-not-found">
        <Text style={styles.notFoundTitle}>Not found</Text>
        <Text style={styles.loadingText}>This plant resource isn’t available yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="learn-detail-scroll">
      <View style={styles.heroWrap}>
        {hero ? <Image source={{ uri: hero }} style={styles.hero} /> : <View style={styles.heroFallback} />}
        <View style={styles.heroOverlay} />
        <View style={styles.heroTextWrap}>
          <Text style={styles.title} testID="learn-detail-title">
            {plant.commonName}
          </Text>
          <Text style={styles.subtitle} testID="learn-detail-subtitle">
            {plant.scientificName ?? '—'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.metaRow}>
          <View style={styles.metaChip} testID="learn-detail-category">
            <Text style={styles.metaChipText}>{plant.category ?? 'Plant'}</Text>
          </View>
          <View style={styles.metaChipMuted} testID="learn-detail-source">
            <Text style={styles.metaChipTextMuted}>{hasSupabaseConfig ? 'Supabase' : 'Offline'}</Text>
          </View>
        </View>

        {plant.summary ? (
          <Text style={styles.summary} testID="learn-detail-summary">
            {plant.summary}
          </Text>
        ) : (
          <Text style={styles.summaryMuted} testID="learn-detail-summary-empty">
            No summary yet.
          </Text>
        )}

        {tags.length > 0 ? (
          <View style={styles.tagsRow} testID="learn-detail-tags">
            {tags.map(renderTag)}
          </View>
        ) : null}

        <View style={styles.nextBox} testID="learn-detail-next">
          <Text style={styles.nextTitle}>Next</Text>
          <Text style={styles.nextText}>
            When you share your Supabase schema, we’ll add: edible uses, seasons, safety notes, and linked recipes.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  notFoundTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  heroWrap: {
    height: 340,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroFallback: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  heroTextWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaChip: {
    backgroundColor: 'rgba(46, 125, 50, 0.16)',
    borderColor: 'rgba(46, 125, 50, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  metaChipText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  metaChipMuted: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  metaChipTextMuted: {
    color: COLORS.textSecondary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  summary: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  summaryMuted: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  tagText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 12,
  },
  nextBox: {
    marginTop: 6,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  nextTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  nextText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 19,
  },
});

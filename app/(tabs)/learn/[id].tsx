import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LearnRemoteImage } from '@/components/LearnRemoteImage';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { hasSupabaseConfig, supabase, supabasePublicDebugInfo } from '@/constants/supabase';
import { useLearnImages } from '@/app/providers/LearnImageProvider';

type LearnPlant = {
  id: string;
  slug: string;
  commonName: string;
  scientificName?: string;
  category?: string;
  heroImageUrl?: string;
  overview?: string;
  isBushTucker?: boolean;
  isMedicinal?: boolean;
  safetyLevel?: string;
  confidenceHint?: string;
  edibleParts?: string[];
  preparation?: string;
  seasonality?: string;
  warnings?: string;
  lookalikes?: string;
  culturalNotes?: string;
  suggestedUses?: string;
  prepBasics?: string[];
  seasonalityNote?: string;
  sourceRefs?: string[];
  edibilityStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SupabasePlantRow = {
  id: string;
  slug?: string | null;
  common_name?: string | null;
  scientific_name?: string | null;
  category?: string | null;
  overview?: string | null;
  edible_parts?: string[] | null;
  preparation?: string | null;
  seasonality?: string | null;
  warnings?: string | null;
  lookalikes?: string | null;
  cultural_notes?: string | null;
  suggested_uses?: string | null;
  is_bush_tucker?: boolean | null;
  is_medicinal?: boolean | null;
  safety_level?: string | null;
  confidence_hint?: string | null;
  prep_basics?: string[] | null;
  seasonality_note?: string | null;
  source_refs?: string[] | null;
  edibility_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const FALLBACK_PLANTS: LearnPlant[] = [
  {
    id: 'fallback-1',
    slug: 'finger-lime',
    commonName: 'Finger Lime',
    scientificName: 'Citrus australasica',
    category: 'Fruit',
    overview: 'A citrus with caviar-like pearls used in both sweet and savoury dishes.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'unknown',
    confidenceHint: 'Foraging identification can be tricky — double-check key features in multiple sources.',
    edibleParts: ['fruit'],
    preparation: 'Use the pearls fresh as a garnish; store whole fruit refrigerated.',
    seasonality: 'Varies by region',
    warnings: 'Confirm ID before eating; avoid roadside/treated plants.',
    lookalikes: 'Other small citrus; check peel texture and finger-like shape.',
    culturalNotes: 'Respect local knowledge and permissions when foraging.',
    suggestedUses: 'Seafood garnish, desserts, cocktails.',
    prepBasics: ['rinse gently', 'slice lengthwise', 'squeeze pearls'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop',
  },
  {
    id: 'fallback-2',
    slug: 'wattleseed',
    commonName: 'Wattleseed',
    scientificName: 'Acacia spp.',
    category: 'Seed',
    overview: 'Nutty, coffee-like roasted seed often used in baking and spice blends.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'unknown',
    confidenceHint: 'Use only known edible species and properly prepared seeds.',
    edibleParts: ['seed'],
    preparation: 'Dry roast then grind; use sparingly as a flavour booster.',
    seasonality: 'Varies by region',
    warnings: 'Some Acacia are not used as food — confirm species.',
    lookalikes: 'Other Acacia seeds; verify pod and leaf form.',
    culturalNotes: 'Many preparations are regional and cultural.',
    suggestedUses: 'Baking, spice rubs, ice cream, coffee-style infusions.',
    prepBasics: ['dry roast', 'cool', 'grind'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 'fallback-3',
    slug: 'davidson-plum',
    commonName: 'Davidson Plum',
    scientificName: 'Davidsonia spp.',
    category: 'Fruit',
    overview: 'Tart rainforest fruit great for jams, sauces and syrups.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'unknown',
    confidenceHint: 'Taste is very sour—use cooked or sweetened preparations.',
    edibleParts: ['fruit'],
    preparation: 'Cook into jams/syrups or blend into sauces; remove seeds.',
    seasonality: 'Varies by region',
    warnings: 'Confirm ID; avoid unripe fruit if very astringent.',
    lookalikes: 'Other rainforest fruits; check leaf and fruit shape.',
    culturalNotes: 'Harvest sustainably; avoid stripping trees.',
    suggestedUses: 'Jam, chutney, syrup, sauces.',
    prepBasics: ['wash', 'pit/seed', 'cook down'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1678165842817-062e21245781?q=80&w=2574&auto=format&fit=crop',
  },
  {
    id: 'fallback-4',
    slug: 'saltbush',
    commonName: 'Saltbush',
    scientificName: 'Atriplex nummularia',
    category: 'Leaf',
    overview: 'A native leaf with a clean saline finish—excellent with roasted meats.',
    isBushTucker: true,
    isMedicinal: true,
    safetyLevel: 'unknown',
    confidenceHint: 'Avoid plants exposed to salt spray/contamination; rinse well.',
    edibleParts: ['leaves'],
    preparation: 'Use young leaves fresh or dried; balance the salty flavour.',
    seasonality: 'Year-round in many areas',
    warnings: 'High salt content—use in moderation.',
    lookalikes: 'Other Atriplex species; check leaf shape and habitat.',
    culturalNotes: 'Traditional uses vary by Nation and region.',
    suggestedUses: 'Roast meats, breads, veggie dishes.',
    prepBasics: ['rinse', 'pat dry', 'use fresh or dehydrate'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1596726540679-0df8e8e7a61d?q=80&w=2787&auto=format&fit=crop',
  },
  {
    id: 'fallback-5',
    slug: 'macadamia',
    commonName: 'Macadamia',
    scientificName: 'Macadamia integrifolia',
    category: 'Nut',
    overview: 'Creamy native nut used for pralines, oils, pestos and crusts.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'unknown',
    confidenceHint: 'Only eat properly cured/processed nuts; avoid mouldy kernels.',
    edibleParts: ['nut'],
    preparation: 'Crack, dry, roast lightly; store airtight to protect oils.',
    seasonality: 'Varies by region',
    warnings: 'Keep away from dogs (toxic to dogs).',
    lookalikes: 'Other hard-shelled nuts; check tree and husk.',
    culturalNotes: 'Harvest responsibly and avoid damaged nuts.',
    suggestedUses: 'Pestos, desserts, oils, nut butters.',
    prepBasics: ['crack', 'dry', 'roast'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1523498877546-6c8469c4505c?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 'bush-plum',
    slug: 'bush-plum',
    commonName: 'Bush Plum',
    scientificName: undefined,
    category: 'Fruit',
    heroImageUrl: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/5jlxv3srevkvmlnhqj5ij',
    overview:
      'Bush Plum refers to several native Australian plum species traditionally harvested by Aboriginal communities as a nutrient-dense seasonal food. Flavour ranges from tart to mildly sweet, often enjoyed fresh or dried, and sometimes preserved for later use.\n\nKnowledge and use vary by Country, language group, and season.',
    safetyLevel: 'caution',
    confidenceHint: 'Only consume positively identified bush plums. Some lookalike species may be inedible or unsafe. Never eat if unsure — consult local knowledge holders.',
    seasonality: 'Late Summer → Autumn',
    seasonalityNote:
      'Timing varies by region, rainfall, and species. Bush plums often appear after seasonal rains and are an important indicator of changing Country.',
    preparation:
      'Harvest ripe fruit only. Wash gently in clean water. Eat fresh or sun-dry for storage. Can be lightly cooked or preserved. Drying was traditionally used to extend availability beyond the harvest season.',
    suggestedUses:
      'Fresh snack • Dried fruit • Infused in water or teas • Jams & preserves • Modern bush-inspired desserts.\n\nRecipes should always respect safety, season, and cultural context.',
    culturalNotes:
      'Traditionally gathered by women and families in many regions. Shared during seasonal movement across Country. Harvesting followed principles of respect, timing, and regeneration.\n\nAlways seek permission before harvesting on Country that is not your own. Cultural knowledge shared here is general and non-restricted.\n\nRespect & sustainability: Take only what is needed, leave fruit to regenerate, respect land access laws, and learn from local Indigenous voices.',
    warnings:
      'Status: Caution. Only consume positively identified bush plums. Some lookalike species may be inedible or unsafe. Never eat if unsure — consult local knowledge holders.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit only', 'wash gently', 'eat fresh or sun-dry', 'lightly cook or preserve'],
    sourceRefs: ['Local Indigenous voices', 'Community knowledge', 'Field guides (species varies by region)'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
];

function toLearnPlant(row: SupabasePlantRow, index: number): LearnPlant {
  const id = String(row.id ?? `row-${index}`);
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
    overview: row.overview ? String(row.overview) : undefined,
    isBushTucker: typeof row.is_bush_tucker === 'boolean' ? row.is_bush_tucker : undefined,
    isMedicinal: typeof row.is_medicinal === 'boolean' ? row.is_medicinal : undefined,
    safetyLevel: row.safety_level ? String(row.safety_level) : undefined,
    confidenceHint: row.confidence_hint ? String(row.confidence_hint) : undefined,
    edibleParts: Array.isArray(row.edible_parts) ? row.edible_parts.map((p) => String(p)) : undefined,
    preparation: row.preparation ? String(row.preparation) : undefined,
    seasonality: row.seasonality ? String(row.seasonality) : undefined,
    warnings: row.warnings ? String(row.warnings) : undefined,
    lookalikes: row.lookalikes ? String(row.lookalikes) : undefined,
    culturalNotes: row.cultural_notes ? String(row.cultural_notes) : undefined,
    suggestedUses: row.suggested_uses ? String(row.suggested_uses) : undefined,
    prepBasics: Array.isArray(row.prep_basics) ? row.prep_basics.map((p) => String(p)) : undefined,
    seasonalityNote: row.seasonality_note ? String(row.seasonality_note) : undefined,
    sourceRefs: Array.isArray(row.source_refs) ? row.source_refs.map((p) => String(p)) : undefined,
    edibilityStatus: row.edibility_status ? String(row.edibility_status) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
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
      .from('plants')
      .select(
        'id, slug, common_name, scientific_name, category, is_bush_tucker, is_medicinal, safety_level, confidence_hint, overview, edible_parts, preparation, seasonality, warnings, lookalikes, cultural_notes, suggested_uses, prep_basics, seasonality_note, source_refs, edibility_status, created_at, updated_at'
      )
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

  const { getPlantImageUrl, setPlantImageUrl, clearPlantImageUrl } = useLearnImages();

  const plantQuery = useQuery({
    queryKey: ['learn', 'plant', idParam],
    queryFn: () => fetchPlantByIdOrSlug(idParam),
    enabled: idParam.trim().length > 0,
  });

  const plant = plantQuery.data ?? null;

  const hero = getPlantImageUrl(plant?.slug ?? idParam) ?? plant?.heroImageUrl ?? FALLBACK_PLANTS[0]?.heroImageUrl;

  const pickImageMutation = useMutation({
    mutationFn: async () => {
      if (!plant) throw new Error('Plant not loaded');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
      });

      if (result.canceled) {
        console.log('[learn-detail] image pick canceled');
        return { canceled: true as const };
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) throw new Error('Could not read selected image');

      await setPlantImageUrl(plant.slug, uri);
      console.log('[learn-detail] image override saved', { slug: plant.slug });
      return { canceled: false as const, uri };
    },
  });

  const clearImageMutation = useMutation({
    mutationFn: async () => {
      if (!plant) throw new Error('Plant not loaded');
      await clearPlantImageUrl(plant.slug);
      console.log('[learn-detail] image override cleared', { slug: plant.slug });
    },
  });

  const chips = useMemo<string[]>(() => {
    const out: string[] = [];
    if (plant?.category) out.push(plant.category);
    if (plant?.isBushTucker) out.push('Bush tucker');
    if (plant?.isMedicinal) out.push('Medicinal');
    if (plant?.safetyLevel) out.push(`Safety: ${plant.safetyLevel}`);
    if (plant?.edibilityStatus) out.push(`Edibility: ${plant.edibilityStatus}`);
    return out;
  }, [plant?.category, plant?.edibilityStatus, plant?.isBushTucker, plant?.isMedicinal, plant?.safetyLevel]);

  const edibleParts = useMemo<string[]>(() => {
    return (plant?.edibleParts ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.edibleParts]);

  const prepBasics = useMemo<string[]>(() => {
    return (plant?.prepBasics ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.prepBasics]);

  const sourceRefs = useMemo<string[]>(() => {
    return (plant?.sourceRefs ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.sourceRefs]);

  const renderChip = useCallback((t: string, prefix: string) => {
    const slug = `${prefix}-${t}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    return (
      <View key={`${prefix}-${t}`} style={styles.tag} testID={`learn-${prefix}-${slug}`}>
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
        {hero ? (
          <LearnRemoteImage
            uri={hero}
            style={styles.hero}
            contentFit="cover"
            transition={180}
            cachePolicy="disk"
            onLoad={() => {
              console.log('[learn-detail] hero loaded', { idParam, uri: hero });
            }}
            onError={(error) => {
              console.log('[learn-detail] hero load failed', { idParam, uri: hero, error });
            }}
            testID="learn-detail-hero-image"
          />
        ) : (
          <View style={styles.heroFallback} />
        )}
        <View style={styles.heroOverlay} />

        <View style={styles.heroActions} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [styles.heroActionButton, pressed && styles.heroActionButtonPressed]}
            onPress={() => pickImageMutation.mutate()}
            disabled={pickImageMutation.isPending}
            testID="learn-detail-change-image"
          >
            <ImagePlus size={16} color="rgba(255,255,255,0.92)" />
            <Text style={styles.heroActionText}>{pickImageMutation.isPending ? 'Opening…' : 'Change'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.heroActionButton, pressed && styles.heroActionButtonPressed]}
            onPress={() => clearImageMutation.mutate()}
            disabled={clearImageMutation.isPending}
            testID="learn-detail-clear-image"
          >
            <Trash2 size={16} color="rgba(255,255,255,0.92)" />
            <Text style={styles.heroActionText}>{clearImageMutation.isPending ? 'Removing…' : 'Remove'}</Text>
          </Pressable>
        </View>

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

        {chips.length > 0 ? (
          <View style={styles.tagsRow} testID="learn-detail-chips">
            {chips.map((c) => renderChip(c, 'chip'))}
          </View>
        ) : null}

        {plant.overview ? (
          <Text style={styles.summary} testID="learn-detail-overview">
            {plant.overview}
          </Text>
        ) : (
          <Text style={styles.summaryMuted} testID="learn-detail-overview-empty">
            No overview yet.
          </Text>
        )}

        {plant.confidenceHint ? (
          <View style={styles.callout} testID="learn-detail-confidence">
            <Text style={styles.calloutTitle}>Confidence hint</Text>
            <Text style={styles.calloutText}>{plant.confidenceHint}</Text>
          </View>
        ) : null}

        {edibleParts.length > 0 ? (
          <View style={styles.block} testID="learn-detail-edible-parts">
            <Text style={styles.blockTitle}>Edible parts</Text>
            <View style={styles.tagsRow}>{edibleParts.map((t) => renderChip(t, 'edible'))}</View>
          </View>
        ) : null}

        {plant.preparation ? (
          <View style={styles.block} testID="learn-detail-preparation">
            <Text style={styles.blockTitle}>Preparation</Text>
            <Text style={styles.blockText}>{plant.preparation}</Text>
          </View>
        ) : null}

        {prepBasics.length > 0 ? (
          <View style={styles.block} testID="learn-detail-prep-basics">
            <Text style={styles.blockTitle}>Prep basics</Text>
            <View style={styles.tagsRow}>{prepBasics.map((t) => renderChip(t, 'prep'))}</View>
          </View>
        ) : null}

        {plant.seasonality || plant.seasonalityNote ? (
          <View style={styles.block} testID="learn-detail-seasonality">
            <Text style={styles.blockTitle}>Seasonality</Text>
            {plant.seasonality ? <Text style={styles.blockText}>{plant.seasonality}</Text> : null}
            {plant.seasonalityNote ? <Text style={styles.blockTextMuted}>{plant.seasonalityNote}</Text> : null}
          </View>
        ) : null}

        {plant.warnings ? (
          <View style={styles.warningBox} testID="learn-detail-warnings">
            <Text style={styles.warningTitle}>Warnings</Text>
            <Text style={styles.warningText}>{plant.warnings}</Text>
          </View>
        ) : null}

        {plant.lookalikes ? (
          <View style={styles.block} testID="learn-detail-lookalikes">
            <Text style={styles.blockTitle}>Lookalikes</Text>
            <Text style={styles.blockText}>{plant.lookalikes}</Text>
          </View>
        ) : null}

        {plant.culturalNotes ? (
          <View style={styles.block} testID="learn-detail-cultural">
            <Text style={styles.blockTitle}>Cultural notes</Text>
            <Text style={styles.blockText}>{plant.culturalNotes}</Text>
          </View>
        ) : null}

        {plant.suggestedUses ? (
          <View style={styles.block} testID="learn-detail-suggested-uses">
            <Text style={styles.blockTitle}>Suggested uses</Text>
            <Text style={styles.blockText}>{plant.suggestedUses}</Text>
          </View>
        ) : null}

        {sourceRefs.length > 0 ? (
          <View style={styles.block} testID="learn-detail-sources">
            <Text style={styles.blockTitle}>Sources</Text>
            <View style={styles.tagsRow}>{sourceRefs.map((t) => renderChip(t, 'source'))}</View>
          </View>
        ) : null}
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
  heroActions: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 10,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  heroActionButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  heroActionText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
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
  callout: {
    backgroundColor: 'rgba(46, 125, 50, 0.10)',
    borderColor: 'rgba(46, 125, 50, 0.20)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  calloutTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  calloutText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 138, 101, 0.14)',
    borderColor: 'rgba(255, 138, 101, 0.26)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  warningTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  warningText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  block: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  blockTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  blockText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  blockTextMuted: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
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

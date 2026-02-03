import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Filter, Search, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { hasSupabaseConfig, supabase, supabasePublicDebugInfo } from '@/constants/supabase';

type LearnPlant = {
  id: string;
  slug: string;
  commonName: string;
  scientificName?: string;
  category?: string;
  overview?: string;
  isBushTucker?: boolean;
  isMedicinal?: boolean;
  safetyLevel?: string;
  edibleParts?: string[];
  heroImageUrl?: string;
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
    edibleParts: ['fruit'],
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
    edibleParts: ['seed'],
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
    edibleParts: ['fruit'],
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
    edibleParts: ['leaves'],
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
    edibleParts: ['nut'],
    heroImageUrl:
      'https://images.unsplash.com/photo-1523498877546-6c8469c4505c?q=80&w=2670&auto=format&fit=crop',
  },
];

type SupabasePlantRow = {
  id: string;
  slug?: string | null;
  common_name?: string | null;
  scientific_name?: string | null;
  category?: string | null;
  overview?: string | null;
  edible_parts?: string[] | null;
  is_bush_tucker?: boolean | null;
  is_medicinal?: boolean | null;
  safety_level?: string | null;
};

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
    edibleParts: Array.isArray(row.edible_parts) ? row.edible_parts.map((p) => String(p)) : undefined,
  };
}

async function fetchPlantsFromSupabase(): Promise<LearnPlant[]> {
  if (!hasSupabaseConfig) {
    console.log('[learn] supabase not configured; using fallback', supabasePublicDebugInfo);
    return FALLBACK_PLANTS;
  }

  try {
    console.log('[learn] fetching plants from supabase');

    const { data, error } = await supabase
      .from('plants')
      .select('id, slug, common_name, scientific_name, category, overview, edible_parts, is_bush_tucker, is_medicinal, safety_level')
      .order('common_name', { ascending: true, nullsFirst: false });

    if (error) {
      console.log('[learn] supabase error; using fallback', { message: error.message });
      return FALLBACK_PLANTS;
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.log('[learn] supabase returned empty; using fallback');
      return FALLBACK_PLANTS;
    }

    const normalized = (data as SupabasePlantRow[]).map((row, index) => toLearnPlant(row, index));
    console.log('[learn] supabase plants fetched', { count: normalized.length });
    return normalized;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[learn] unexpected error; using fallback', { message });
    return FALLBACK_PLANTS;
  }
}

export default function LearnScreen() {
  const [query, setQuery] = useState<string>('');

  const plantsQuery = useQuery({
    queryKey: ['learn', 'plants'],
    queryFn: fetchPlantsFromSupabase,
  });

  const plants = useMemo<LearnPlant[]>(() => {
    const data = plantsQuery.data ?? FALLBACK_PLANTS;
    const q = query.trim().toLowerCase();
    if (!q) return data;

    return data.filter((p) => {
      const haystack = `${p.commonName} ${p.scientificName ?? ''} ${p.category ?? ''} ${(p.edibleParts ?? []).join(' ')} ${p.isBushTucker ? 'bush tucker' : ''} ${p.isMedicinal ? 'medicinal' : ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [plantsQuery.data, query]);

  const onOpenPlant = useCallback((plant: LearnPlant) => {
    const idOrSlug = plant.slug || plant.id;
    console.log('[learn] open plant', { idOrSlug });
    router.push({ pathname: '/learn/[id]', params: { id: idOrSlug } });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: LearnPlant }) => {
      const hero = item.heroImageUrl ?? FALLBACK_PLANTS[0]?.heroImageUrl;
      const category = item.category ?? 'Plant';
      const safety = (item.safetyLevel ?? 'unknown').toUpperCase();

      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => onOpenPlant(item)}
          testID={`learn-card-${item.slug}`}
        >
          <View style={styles.imageContainer}>
            {hero ? <Image source={{ uri: hero }} style={styles.cardImage} /> : <View style={styles.imageFallback} />}
            <View style={styles.typeTag}>
              <Text style={styles.typeText} numberOfLines={1}>
                {category}
              </Text>
            </View>
            <View style={styles.safetyTag}>
              <Text style={styles.safetyText} numberOfLines={1}>
                {safety}
              </Text>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.commonName}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.scientificName ?? '—'}
            </Text>
            {item.overview ? (
              <Text style={styles.cardSummary} numberOfLines={2}>
                {item.overview}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [onOpenPlant]
  );

  const keyExtractor = useCallback((item: LearnPlant) => item.id, []);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Learn</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1} testID="learn-header-subtitle">
              Knowledge resources for native plants.
            </Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.searchPill} testID="learn-search-pill">
              <Search size={18} color={COLORS.textSecondary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search plants"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                testID="learn-search-input"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={10} testID="learn-search-clear">
                  <X size={16} color={COLORS.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <Pressable style={styles.iconButton} onPress={() => {}} testID="learn-filter">
              <Filter size={22} color={COLORS.text} />
            </Pressable>
          </View>
        </View>

        {plantsQuery.isLoading ? (
          <View style={styles.stateContainer} testID="learn-loading">
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.stateText}>Loading plants…</Text>
          </View>
        ) : plantsQuery.isError ? (
          <View style={styles.stateContainer} testID="learn-error">
            <Text style={styles.stateTitle}>Couldn’t load resources</Text>
            <Text style={styles.stateText}>Showing offline sample content for now.</Text>
          </View>
        ) : null}

        <FlatList
          data={plants}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={plantsQuery.isFetching}
              onRefresh={() => {
                console.log('[learn] manual refresh');
                plantsQuery.refetch();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.stateContainer} testID="learn-empty">
              <Text style={styles.stateTitle}>No matches</Text>
              <Text style={styles.stateText}>Try a different search.</Text>
            </View>
          }
        />

        {Platform.OS === 'web' && !hasSupabaseConfig ? (
          <View style={styles.webHint} pointerEvents="none">
            <Text style={styles.webHintText} numberOfLines={2}>
              Supabase not configured yet — showing demo content.
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 8,
    gap: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  searchPill: {
    flex: 1,
    minWidth: 170,
    maxWidth: 320,
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 13,
    paddingVertical: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  listContent: {
    padding: 24,
    paddingTop: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 7,
    padding: 10,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  typeTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  safetyTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  safetyText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.94)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.94)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardContent: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  cardSummary: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  stateContainer: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  stateTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  webHint: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  webHintText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
});

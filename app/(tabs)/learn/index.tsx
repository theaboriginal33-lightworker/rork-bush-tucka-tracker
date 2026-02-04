import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LearnRemoteImage } from '@/components/LearnRemoteImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Filter, ImagePlus, Search, Trash2, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { hasSupabaseConfig, supabase, supabasePublicDebugInfo } from '@/constants/supabase';
import { useLearnImages } from '@/app/providers/LearnImageProvider';
import * as ImagePicker from 'expo-image-picker';

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
    id: 'finger-lime',
    slug: 'finger-lime',
    commonName: 'Finger Lime',
    scientificName: 'Native Citrus • Citrus Caviar',
    category: 'Fruit / Citrus',
    overview:
      'Finger Lime is a native Australian citrus traditionally found in subtropical rainforest regions of eastern Australia. Known for its elongated shape and unique caviar-like pearls, it delivers a sharp, refreshing citrus burst unlike any other fruit.\n\nHighly valued today in contemporary cuisine, Finger Lime bridges traditional knowledge and modern food innovation.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/n7m5z15iiqrv0xjj2jfby',
  },
  {
    id: 'lemon-aspen',
    slug: 'lemon-aspen',
    commonName: 'Lemon Aspen',
    scientificName: 'Rainforest Native Fruit • Citrus-Flavoured Berry',
    category: 'Fruit',
    overview:
      'Lemon Aspen is a native rainforest fruit traditionally found in eastern Australia, particularly in subtropical and tropical rainforest regions. Small in size but intense in flavour, it delivers a bright, lemony tang with floral notes.\n\nIt is highly regarded in modern native cuisine for its fresh acidity and aromatic profile.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/sg7y96jpf74eyg7kql43u',
  },
  {
    id: 'lemon-myrtle',
    slug: 'lemon-myrtle',
    commonName: 'Lemon Myrtle',
    scientificName: 'Native Leaf • Aromatic Herb',
    category: 'Leaf / Herb',
    overview:
      'Lemon Myrtle is a native Australian rainforest tree celebrated for its intense lemon aroma, often stronger than conventional citrus. Traditionally valued by Aboriginal communities, its leaves have been used for flavouring, cleansing, and wellbeing.\n\nToday, Lemon Myrtle is one of the most widely recognised native herbs in modern Australian cuisine.',
    isBushTucker: true,
    isMedicinal: true,
    safetyLevel: 'safe',
    edibleParts: ['leaves'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9aps3g2u5gb9wfop6gmjy',
  },
  {
    id: 'kurrajong',
    slug: 'kurrajong',
    commonName: 'Kurrajong',
    scientificName: 'Native Tree • Seed & Fibre Plant',
    category: 'Seed / Tree',
    overview:
      'Kurrajong is a hardy native Australian tree traditionally valued for its seeds, inner bark fibre, and water-holding roots. Found across many regions, it has long supported Aboriginal communities as a reliable survival resource during dry periods.\n\nIts broad canopy and resilience make it a strong symbol of adaptability and endurance on Country.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'caution',
    edibleParts: ['seeds'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/btyrnxjhwk5xvf16buiiv',
  },
  {
    id: 'mountain-pepper',
    slug: 'mountain-pepper',
    commonName: 'Mountain Pepper',
    scientificName: 'Native Pepperberry • Potent Bush Spice',
    category: 'Spice / Leaf / Berry',
    overview:
      "Mountain Pepper is a native Australian plant traditionally found in cool, highland and temperate rainforest regions, particularly in south-eastern Australia and Tasmania. Both the leaves and berries are valued for their strong, peppery heat and aromatic complexity.\n\nIt is one of Australia’s most potent native spices and is used sparingly with respect.",
    isBushTucker: true,
    isMedicinal: true,
    safetyLevel: 'caution',
    edibleParts: ['leaves', 'berries'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/q8ou304h1cawpspih96i3',
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
  {
    id: 'bush-tomato',
    slug: 'bush-tomato',
    commonName: 'Bush Tomato',
    scientificName: 'Bush Tomato (Desert Raisin)',
    category: 'Fruit / Seed',
    overview:
      'Bush Tomato, often known as Desert Raisin, is a highly valued native food traditionally harvested across arid and semi-arid regions of Australia. When properly prepared, it has a rich, savoury flavour and is widely used in both traditional and contemporary bush foods.\n\nImportant: only the fully ripe fruit is safe to consume.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'high caution',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 'bush-plum',
    slug: 'bush-plum',
    commonName: 'Bush Plum',
    scientificName: 'Traditional Native Food • Seasonal Fruit',
    category: 'Fruit',
    overview:
      'Bush Plum refers to several native Australian plum species traditionally harvested by Aboriginal communities as a nutrient-dense seasonal food.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'caution',
    edibleParts: ['fruit'],
    heroImageUrl: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/97s78gf8aoub5c285davi',
  },
  {
    id: 'desert-lime',
    slug: 'desert-lime',
    commonName: 'Desert Lime',
    scientificName: 'Arid Native Citrus • Wild Lime',
    category: 'Fruit',
    overview:
      'Desert Lime is a hardy native citrus traditionally found in arid and semi-arid regions of Australia. Small in size but powerful in flavour, it delivers a sharp, tangy citrus punch prized in both traditional use and modern bush-food cuisine.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://images.unsplash.com/photo-1580915411954-282cb1c96b3b?q=80&w=2787&auto=format&fit=crop',
  },
  {
    id: 'emu-apple',
    slug: 'emu-apple',
    commonName: 'Emu Apple',
    scientificName: 'Native Shrub Fruit • Seasonal Berry',
    category: 'Fruit',
    overview:
      'Emu Apple is a native fruit traditionally found in southern and south-eastern Australia, growing on low shrubs and ground-hugging plants. Its name comes from the way emus feed on the fruit and disperse the seeds, playing an important role in regeneration.\n\nFlavour is mild, fresh, and lightly sweet, with a crisp texture.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/mnjeackl074xi8muhu5k9',
  },
  {
    id: 'illawarra-plum',
    slug: 'illawarra-plum',
    commonName: 'Illawarra Plum',
    scientificName: 'Rainforest Native Fruit • Dark Plum',
    category: 'Fruit',
    overview:
      'Illawarra Plum is a native rainforest fruit found along the east coast of Australia, growing on tall canopy trees. Recognisable by its deep purple to black flesh and large seed, it has a rich, mild sweetness with earthy undertones.\n\nTraditionally harvested seasonally, it is now valued in both bush food knowledge and modern native cuisine.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'caution',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/wniclm256l583hw566ce1',
  },
  {
    id: 'kakadu-plum',
    slug: 'kakadu-plum',
    commonName: 'Kakadu Plum',
    scientificName: 'Northern Native Fruit • Superfruit',
    category: 'Fruit',
    overview:
      'Kakadu Plum is a native fruit traditionally found across Northern Australia, growing on small to medium-sized trees in open woodland and savanna Country. It is renowned globally for having one of the highest natural Vitamin C contents of any fruit.\n\nFor Aboriginal communities, Kakadu Plum has long been valued as a seasonal food and wellbeing plant, harvested with care and deep environmental knowledge.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/844nkttl25k3vrhrq4v8x',
  },
  {
    id: 'lilly-pilly',
    slug: 'lilly-pilly',
    commonName: 'Lilly Pilly',
    scientificName: 'Native Berry • Rainforest & Coastal Fruit',
    category: 'Berry',
    overview:
      'Lilly Pilly refers to several native Syzygium species traditionally found along Australia’s east coast, from rainforest margins to coastal woodlands. The berries range in colour from pink to deep purple and vary in flavour from mildly sweet to tart.\n\nLong valued as a seasonal bush food, Lilly Pilly is now also common in urban landscapes — though not all varieties are palatable.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'caution',
    edibleParts: ['berry', 'fruit'],
    heroImageUrl:
      'https://images.unsplash.com/photo-1705360156521-40c178a4fa92?fm=jpg&q=60&w=2000&auto=format&fit=crop',
  },
  {
    id: 'midyim-berry',
    slug: 'midyim-berry',
    commonName: 'Midyim Berry',
    scientificName: 'Native Berry • Sweet Myrtle Fruit',
    category: 'Berry',
    overview:
      'Midyim Berry is a small native berry traditionally found along Australia’s east coast, growing on low shrubs in coastal and woodland environments. The berries are white to pale pink, softly speckled, and known for their gentle sweetness and subtle spice.\n\nIt has long been valued as a fresh seasonal food, particularly enjoyed straight from the plant.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['berry', 'fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9t5m36gwnpzgw20tb1rte',
  },
  {
    id: 'muntries',
    slug: 'muntries',
    commonName: 'Muntries',
    scientificName: 'Native Berry • Crisp Groundcover Fruit',
    category: 'Berry',
    overview:
      'Muntries are a native Australian berry traditionally found across southern Australia, growing close to the ground on creeping shrubs. The berries range from green to red and are known for their crisp texture and apple-like flavour with gentle sweetness.\n\nThey have long been enjoyed as a fresh, seasonal food, particularly valued for their refreshing quality.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'safe',
    edibleParts: ['berry', 'fruit'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4wyowwuva5315m2h56ip3',
  },
  {
    id: 'native-pepperberry',
    slug: 'native-pepperberry',
    commonName: 'Native Pepperberry',
    scientificName: 'Native Spice • Mountain Pepper (Tasmannia lanceolata)',
    category: 'Spice / Leaf / Berry',
    overview:
      'Mountain Pepper (Native Pepperberry) is a native Australian plant traditionally found in cool, highland and temperate rainforest regions, particularly in south-eastern Australia and Tasmania. Both the leaves and berries are valued for their strong, peppery heat and aromatic complexity.\n\nIt is one of Australia’s most potent native spices and is used sparingly with respect.',
    isBushTucker: true,
    isMedicinal: true,
    safetyLevel: 'caution',
    edibleParts: ['leaves', 'berries'],
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/x3he40ggds7lj65cyxhgm',
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
  const { getPlantImageUrl, setPlantImageUrl, clearPlantImageUrl } = useLearnImages();

  const pickImageMutation = useMutation({
    mutationFn: async (vars: { slug: string }) => {
      const slug = String(vars.slug ?? '').trim();
      if (!slug) throw new Error('Missing plant id');

      if (Platform.OS !== 'web') {
        const existingPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (!existingPerm.granted) {
          const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!requested.granted) {
            console.log('[learn] media library permission denied');
            throw new Error('Photos permission is required to change the image.');
          }
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
      });

      if (result.canceled) {
        console.log('[learn] image pick canceled', { slug });
        return { canceled: true as const };
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) throw new Error('Could not read selected image');

      await setPlantImageUrl(slug, uri);
      console.log('[learn] image override saved', { slug });
      return { canceled: false as const, uri };
    },
  });

  const clearImageMutation = useMutation({
    mutationFn: async (vars: { slug: string }) => {
      const slug = String(vars.slug ?? '').trim();
      if (!slug) throw new Error('Missing plant id');
      await clearPlantImageUrl(slug);
      console.log('[learn] image override cleared', { slug });
    },
  });

  const { mutate: pickImageMutate, isPending: isPickingImage } = pickImageMutation;
  const { mutate: clearImageMutate, isPending: isClearingImage } = clearImageMutation;

  const plantsQuery = useQuery({
    queryKey: ['learn', 'plants'],
    queryFn: fetchPlantsFromSupabase,
  });

  const plants = useMemo<LearnPlant[]>(() => {
    const dataRaw = plantsQuery.data ?? FALLBACK_PLANTS;
    const hasBushPlum = dataRaw.some((p) => p.slug === 'bush-plum' || p.id === 'bush-plum');
    const hasBushTomato = dataRaw.some((p) => p.slug === 'bush-tomato' || p.id === 'bush-tomato');
    const hasDesertLime = dataRaw.some((p) => p.slug === 'desert-lime' || p.id === 'desert-lime');
    const hasDorrigoPepper = dataRaw.some((p) => p.slug === 'dorrigo-pepper' || p.id === 'dorrigo-pepper');
    const hasEmuApple = dataRaw.some((p) => p.slug === 'emu-apple' || p.id === 'emu-apple');
    const hasKurrajong = dataRaw.some((p) => p.slug === 'kurrajong' || p.id === 'kurrajong');
    const hasNativePepperberry = dataRaw.some(
      (p) =>
        p.slug === 'native-pepperberry' ||
        p.id === 'native-pepperberry' ||
        p.slug === 'mountain-pepper' ||
        p.id === 'mountain-pepper'
    );

    let data = dataRaw;
    if (!hasBushTomato) {
      const fallback = FALLBACK_PLANTS.find((p) => p.slug === 'bush-tomato');
      data = fallback ? [...data, fallback] : data;
    }
    if (!hasBushPlum) {
      const fallback = FALLBACK_PLANTS.find((p) => p.slug === 'bush-plum');
      data = fallback ? [...data, fallback] : data;
    }
    if (!hasDesertLime) {
      const fallback = FALLBACK_PLANTS.find((p) => p.slug === 'desert-lime');
      data = fallback ? [...data, fallback] : data;
    }
    if (!hasDorrigoPepper) {
      const fallback = FALLBACK_PLANTS.find((p) => p.slug === 'dorrigo-pepper');
      data = fallback ? [...data, fallback] : data;
    }
    if (!hasEmuApple) {
      const fallback = FALLBACK_PLANTS.find((p) => p.slug === 'emu-apple');
      data = fallback ? [...data, fallback] : data;
    }
    if (!hasKurrajong) {
      const fallback = FALLBACK_PLANTS.find((p) => p.slug === 'kurrajong');
      data = fallback ? [...data, fallback] : data;
    }
    if (!hasNativePepperberry) {
      const fallback =
        FALLBACK_PLANTS.find((p) => p.slug === 'mountain-pepper') ??
        FALLBACK_PLANTS.find((p) => p.slug === 'native-pepperberry');
      data = fallback ? [...data, fallback] : data;
    }

    const q = query.trim().toLowerCase();
    if (!q) return data;

    return data.filter((p) => {
      const haystack = `${p.commonName} ${p.scientificName ?? ''} ${p.category ?? ''} ${(p.edibleParts ?? []).join(' ')} ${p.isBushTucker ? 'bush tucker' : ''} ${p.isMedicinal ? 'medicinal' : ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [plantsQuery.data, query]);

  const onOpenPlant = useCallback((plant: LearnPlant) => {
    const idRaw = String(plant.id ?? '').trim();
    const slugRaw = String(plant.slug ?? '').trim();

    const idForRoute = slugRaw.length > 0 ? slugRaw : idRaw;
    console.log('[learn] open plant', { idForRoute, id: plant.id, slug: plant.slug, hasSupabaseConfig });

    router.push({ pathname: '/(tabs)/learn/[id]', params: { id: idForRoute } });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: LearnPlant }) => {
      const slug = item.slug;
      const override = getPlantImageUrl(slug);
      const hero = override ?? item.heroImageUrl ?? FALLBACK_PLANTS[0]?.heroImageUrl;
      const category = item.category ?? 'Plant';
      const safety = (item.safetyLevel ?? 'unknown').toUpperCase();

      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => onOpenPlant(item)}
          testID={`learn-card-${item.slug}`}
        >
          <View style={styles.imageContainer}>
            {hero ? (
              <LearnRemoteImage
                uri={hero}
                style={styles.cardImage}
                contentFit="cover"
                cachePolicy="disk"
                transition={140}
                onLoad={() => {
                  console.log('[learn] card image loaded', { slug: item.slug, uri: hero });
                }}
                onError={(error) => {
                  console.log('[learn] card image load failed', { slug: item.slug, uri: hero, error });
                }}
                testID={`learn-card-image-${item.slug}`}
              />
            ) : (
              <View style={styles.imageFallback} />
            )}

            <View style={styles.cardImageActions} pointerEvents="box-none">
              <Pressable
                style={({ pressed }) => [styles.cardImageButton, pressed && styles.cardImageButtonPressed]}
                onPress={(e) => {
                  e.stopPropagation();
                  pickImageMutate(
                    { slug },
                    {
                      onError: (err) => {
                        const message = err instanceof Error ? err.message : String(err);
                        Alert.alert('Could not change photo', message);
                      },
                    }
                  );
                }}
                disabled={isPickingImage}
                testID={`learn-card-change-image-${slug}`}
              >
                <ImagePlus size={16} color={'rgba(255,255,255,0.92)'} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.cardImageButton,
                  override ? null : styles.cardImageButtonDisabled,
                  pressed && override ? styles.cardImageButtonPressed : null,
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!override) return;

                  Alert.alert('Remove photo?', 'This will restore the default image for this plant.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        clearImageMutate(
                          { slug },
                          {
                            onError: (err) => {
                              const message = err instanceof Error ? err.message : String(err);
                              Alert.alert('Could not remove photo', message);
                            },
                          }
                        );
                      },
                    },
                  ]);
                }}
                disabled={!override || isClearingImage}
                testID={`learn-card-remove-image-${slug}`}
              >
                <Trash2 size={16} color={'rgba(255,255,255,0.92)'} />
              </Pressable>
            </View>

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
    [clearImageMutate, getPlantImageUrl, isClearingImage, isPickingImage, onOpenPlant, pickImageMutate]
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
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardImageActions: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    gap: 8,
  },
  cardImageButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardImageButtonDisabled: {
    opacity: 0.45,
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

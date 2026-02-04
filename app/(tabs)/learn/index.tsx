import React, { useMemo } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useQuery } from '@tanstack/react-query';
import { hasSupabaseConfig, supabase } from '@/constants/supabase';

type PlantRow = {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string | null;
  primary_category: string | null;
  edibility_status: string | null;
  seasonality_note: string | null;
  ui_accent: string | null;
};

const CATEGORY_IMAGES: Record<string, string> = {
  fruit: 'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop',
  seed: 'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop',
  leaf: 'https://images.unsplash.com/photo-1596726540679-0df8e8e7a61d?q=80&w=2787&auto=format&fit=crop',
  nut: 'https://images.unsplash.com/photo-1523498877546-6c8469c4505c?q=80&w=2670&auto=format&fit=crop',
  root: 'https://images.unsplash.com/photo-1587049352846-4a222e784b5d?q=80&w=2670&auto=format&fit=crop',
  spice: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?q=80&w=2670&auto=format&fit=crop',
  other: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=2670&auto=format&fit=crop',
};

const ACCENT_COLORS: Record<string, string> = {
  green: '#E8F5E9',
  teal: '#E0F7FA',
  amber: '#FFF3E0',
  purple: '#F3E5F5',
  yellow: '#FFF8E1',
  blue: '#E0F2FE',
  red: '#FDE8E8',
};

const titleCase = (value: string): string => {
  return value
    .replace(/[_-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function LearnScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'plants'],
    enabled: hasSupabaseConfig,
    queryFn: async (): Promise<PlantRow[]> => {
      const { data: rows, error: queryError } = await supabase
        .from('plants')
        .select('id,slug,common_name,scientific_name,primary_category,edibility_status,seasonality_note,ui_accent')
        .order('common_name', { ascending: true });

      if (queryError) {
        throw new Error(queryError.message);
      }

      return (rows ?? []) as PlantRow[];
    },
  });

  const plants = data ?? [];

  const listData = useMemo(() => {
    return plants.map((plant) => {
      const category = (plant.primary_category ?? 'other').toLowerCase();
      const image = CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.other;
      const accentKey = (plant.ui_accent ?? '').toLowerCase();
      const accent = ACCENT_COLORS[accentKey] ?? 'rgba(7,17,11,0.78)';
      return {
        id: plant.id || plant.slug,
        name: plant.common_name,
        scientific: plant.scientific_name ?? 'Unknown',
        type: titleCase(category),
        color: accent,
        image,
      };
    });
  }, [plants]);

  const statusMessage = useMemo(() => {
    if (!hasSupabaseConfig) {
      return 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
    }
    if (isLoading) return 'Loading plants…';
    if (error) {
      return 'Could not load plants. Check Supabase connection and RLS policies.';
    }
    if (listData.length === 0) return 'No plants found yet.';
    return '';
  }, [error, isLoading, listData.length]);

  const renderItem = ({ item }: { item: (typeof listData)[0] }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={[styles.typeTag, { backgroundColor: item.color }]}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>{item.scientific}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Encyclopedia</Text>
            {statusMessage ? <Text style={styles.headerSubtitle}>{statusMessage}</Text> : null}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} testID="learn-search">
              <Search size={22} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} testID="learn-filter">
              <Filter size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingRow} testID="learn-loading">
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}

        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState} testID="learn-empty">
                <Text style={styles.emptyTitle}>No Learn entries yet</Text>
                <Text style={styles.emptyText}>Add plants to Supabase to populate this list.</Text>
              </View>
            ) : null
          }
        />
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
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
  loadingRow: {
    paddingHorizontal: 24,
    paddingBottom: 12,
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
  typeTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text,
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
  emptyState: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

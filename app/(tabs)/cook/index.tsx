import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useCookbook, type CookRecipeEntry } from '@/app/providers/CookbookProvider';

type Chip = {
  id: string;
  label: string;
};

const CHIPS: Chip[] = [
  { id: 'all', label: 'All' },
  { id: 'safe', label: 'Safe' },
  { id: 'uncertain', label: 'Uncertain' },
  { id: 'unsafe', label: 'Unsafe' },
];

function safeImageUri(uri: string | undefined): string | null {
  const raw0 = typeof uri === 'string' ? uri.trim() : '';
  if (raw0.length === 0 || raw0 === 'null' || raw0 === 'undefined') return null;

  let raw = raw0;
  const scheme = raw.split(':')[0] ?? '';

  if (scheme === 'ph' || scheme === 'assets-library') return null;

  if (raw.startsWith('/')) {
    raw = `file://${raw}`;
  }

  if (raw.startsWith('file:/') && !raw.startsWith('file://')) {
    raw = `file:///${raw.replace(/^file:\/*/i, '')}`;
  }

  if (raw.includes(' ')) {
    raw = raw.replace(/ /g, '%20');
  }

  try {
    return encodeURI(raw);
  } catch {
    return raw;
  }
}

export default function CookScreen() {
  const { entries, isLoading, errorMessage, removeEntry } = useCookbook();

  const [query, setQuery] = useState<string>('');
  const [chipId, setChipId] = useState<Chip['id']>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (chipId === 'all') return true;
        return e.safetyStatus === chipId;
      })
      .filter((e) => {
        if (q.length === 0) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.commonName.toLowerCase().includes(q) ||
          (e.scientificName ?? '').toLowerCase().includes(q)
        );
      });
  }, [chipId, entries, query]);

  const headerSubtitle = useMemo(() => {
    if (isLoading) return 'Loading…';
    if (errorMessage) return errorMessage;
    if (entries.length === 0) return 'Add a scan to Cook from Scan Details.';
    return `${entries.length} saved ${entries.length === 1 ? 'ingredient' : 'ingredients'}`;
  }, [entries.length, errorMessage, isLoading]);

  const renderItem = useCallback(
    ({ item }: { item: CookRecipeEntry }) => {
      const safetyDot =
        item.safetyStatus === 'safe'
          ? COLORS.success
          : item.safetyStatus === 'unsafe'
            ? COLORS.error
            : COLORS.warning;

      const resolvedUri = safeImageUri(item.imageUri);
      const resolvedScheme = (resolvedUri ?? '').split(':')[0] || 'none';
      const rawScheme = (item.imageUri ?? '').split(':')[0] || 'none';
      const isLocal = resolvedScheme === 'file' || resolvedScheme === 'data';

      return (
        <TouchableOpacity
          style={styles.itemCard}
          onPress={() => {
            router.push(`/cook/${encodeURIComponent(item.id)}`);
          }}
          testID={`cook-item-${item.id}`}
        >
          <View style={styles.itemImageWrap}>
            <Image
              source={{
                uri:
                  resolvedUri ??
                  'https://images.unsplash.com/photo-1541544181051-e46601a43f2b?q=80&w=1600&auto=format&fit=crop',
              }}
              style={styles.itemImage}
              contentFit="cover"
              cachePolicy={isLocal ? 'none' : 'memory-disk'}
              transition={120}
              {...(!isLocal ? { recyclingKey: `${item.id}:${resolvedUri ?? 'fallback'}` } : {})}
              testID={`cook-item-image-${item.id}`}
              onLoadStart={() => {
                console.log('[Cook] image load start', {
                  id: item.id,
                  resolvedUriScheme: resolvedScheme,
                  rawUriScheme: rawScheme,
                  isLocal,
                });
              }}
              onLoad={() => {
                console.log('[Cook] image loaded', {
                  id: item.id,
                  resolvedUriScheme: resolvedScheme,
                  rawUriScheme: rawScheme,
                  isLocal,
                });
              }}
              onError={(e) => {
                console.log('[Cook] image load error', {
                  id: item.id,
                  uri: item.imageUri,
                  resolvedUri,
                  resolvedUriScheme: resolvedScheme,
                  rawUriScheme: rawScheme,
                  isLocal,
                  error: (e as unknown as { error?: string })?.error,
                });
              }}
            />
            <View style={styles.itemTopRow}>
              <View style={styles.safetyPill}>
                <View style={[styles.safetyDot, { backgroundColor: safetyDot }]} />
                <Text style={styles.safetyPillText}>{item.safetyStatus.toUpperCase()}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  Alert.alert('Remove from Cook?', 'This will remove it from your Cook list.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        removeEntry(item.id).catch((e) => {
                          const message = e instanceof Error ? e.message : String(e);
                          console.log('[Cook] removeEntry failed', { message });
                        });
                      },
                    },
                  ]);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID={`cook-item-remove-${item.id}`}
              >
                <X size={16} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.itemBody}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {item.scientificName ? `${item.commonName} • ${item.scientificName}` : item.commonName}
            </Text>

            <View style={styles.itemMetaRow}>
              <View style={styles.confidencePill}>
                <Text style={styles.confidenceText}>{Math.round(item.confidence * 100)}% confidence</Text>
              </View>
              {item.suggestedUses.length > 0 ? (
                <Text style={styles.usesText} numberOfLines={1}>
                  {item.suggestedUses[0]}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [removeEntry],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Cook</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>

          <View style={styles.searchPill} testID="cook-search">
            <Search size={18} color={COLORS.textSecondary} />
            <View style={styles.searchDivider} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search your saved ingredients…"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              testID="cook-search-input"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} testID="cook-chips">
          {CHIPS.map((c) => {
            const active = c.id === chipId;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setChipId(c.id)}
                testID={`cook-chip-${c.id}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState} testID="cook-empty">
              <View style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyText}>Open a scan in Collection → Scan Details → tap the pot icon to add it to Cook.</Text>
            </View>
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
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 14,
  },
  headerLeft: {
    gap: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.22)',
  },
  searchDivider: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.border,
    marginHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 0,
  },
  chipsRow: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: 'rgba(56,217,137,0.14)',
    borderColor: 'rgba(56,217,137,0.46)',
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextActive: {
    color: COLORS.secondary,
  },

  listContent: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 7,
  },
  itemImageWrap: {
    height: 160,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  safetyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7,17,11,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.22)',
  },
  safetyDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  safetyPillText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,17,11,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.35)',
  },
  itemBody: {
    padding: 16,
    gap: 6,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  itemSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  confidencePill: {
    backgroundColor: 'rgba(56,217,137,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: 0.2,
  },
  usesText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 30,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.28)',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
});

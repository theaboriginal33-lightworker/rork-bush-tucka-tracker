import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, MapPin, MoreHorizontal } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useScanJournal, type ScanJournalEntry } from '@/app/providers/ScanJournalProvider';

function safeImageUri(uri: string | undefined): string | null {
  const raw0 = typeof uri === 'string' ? uri.trim() : '';
  if (raw0.length === 0 || raw0 === 'null' || raw0 === 'undefined') return null;

  let raw = raw0;
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

export default function JournalScreen() {
  const { entries, isLoading, errorMessage, refresh } = useScanJournal();

  const emptyCopy = useMemo(() => {
    if (isLoading) return 'Loading your scans…';
    if (errorMessage) return errorMessage;
    return 'Your scanned plants will appear here. Scan something from the Home tab to start building your collection.';
  }, [errorMessage, isLoading]);

  const renderItem = useCallback(
    ({ item }: { item: ScanJournalEntry }) => {
      const date = new Date(item.createdAt);
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
      const month = monthNames[date.getMonth()] ?? '---';
      const day = String(date.getDate()).padStart(2, '0');

      const resolvedUri = safeImageUri(item.imagePreviewUri ?? item.imageUri);
      const tags = [
        item.scan?.safety?.status ? `Safety: ${item.scan.safety.status}` : null,
        ...(Array.isArray(item.scan?.categories) ? item.scan.categories.slice(0, 2) : []),
      ].filter(Boolean) as string[];

      return (
        <TouchableOpacity style={styles.entryCard} testID={`journal-entry-${item.id}`}>
          <View style={styles.cardHeader}>
            <Image
              source={{
                uri:
                  resolvedUri ??
                  'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop',
              }}
              style={styles.entryImage}
            />
            <View style={styles.metaOverlay}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{day} {month}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.entryTitle}>{item.title}</Text>
              <MoreHorizontal size={20} color={COLORS.textSecondary} />
            </View>

            {item.locationName ? (
              <View style={styles.locationRow}>
                <MapPin size={14} color={COLORS.primary} />
                <Text style={styles.locationText}>{item.locationName}</Text>
              </View>
            ) : null}

            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Collection</Text>
          <TouchableOpacity
            style={styles.addButton}
            testID="journal-refresh"
            onPress={() => {
              refresh().catch(() => {
                return;
              });
            }}
          >
            <Plus size={24} color={COLORS.background} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState} testID="journal-empty">
              <View style={styles.emptyIcon}>
                <Plus size={20} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No scans yet</Text>
              <Text style={styles.emptyText}>{emptyCopy}</Text>
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
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listContent: {
    padding: 24,
    paddingTop: 8,
  },
  entryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 7,
    overflow: 'hidden',
  },
  cardHeader: {
    height: 180,
    position: 'relative',
  },
  entryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  metaOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateBadge: {
    backgroundColor: 'rgba(7,17,11,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.4,
  },
  cardBody: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
  },
  tagText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
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

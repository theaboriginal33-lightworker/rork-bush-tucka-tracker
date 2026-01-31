import React, { useCallback, useMemo } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brush, MapPin, MoreHorizontal, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useScanJournal, type ScanJournalEntry } from '@/app/providers/ScanJournalProvider';

export default function JournalScreen() {
  const { entries, isLoading, errorMessage, clearAll, removeEntry, refresh } = useScanJournal();

  const onPressClearAll = useCallback(() => {
    Alert.alert('Clear collection?', 'This will remove all saved scans from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          clearAll().catch((e) => {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Journal] clearAll failed', { message });
          });
        },
      },
    ]);
  }, [clearAll]);

  const renderItem = useCallback(
    ({ item }: { item: ScanJournalEntry }) => {
      const date = new Date(item.createdAt);
      const month = date.toLocaleString('en-AU', { month: 'short' }).toUpperCase();
      const day = String(date.getDate()).padStart(2, '0');

      const tags = [
        item.scan?.safety?.status ? `Safety: ${item.scan.safety.status}` : null,
        item.scan?.bushTuckerLikely ? 'Bush tucker' : null,
      ].filter(Boolean) as string[];

      return (
        <TouchableOpacity
          style={styles.entryCard}
          onPress={() => {
            router.push(`/scan/${encodeURIComponent(item.id)}`);
          }}
          testID={`journal-entry-${item.id}`}
        >
          <View style={styles.cardHeader}>
            <Image
              source={{ uri: item.imageUri ?? 'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=1200&auto=format&fit=crop' }}
              style={styles.entryImage}
            />
            <View style={styles.metaOverlay}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{day} {month}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBadge}
                onPress={() => {
                  Alert.alert('Remove scan?', 'This will remove it from your collection.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => {
                        removeEntry(item.id).catch((e) => {
                          const message = e instanceof Error ? e.message : String(e);
                          console.log('[Journal] removeEntry failed', { message });
                        });
                      },
                    },
                  ]);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID={`journal-entry-delete-${item.id}`}
              >
                <Trash2 size={16} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <MoreHorizontal size={20} color={COLORS.textSecondary} />
            </View>

            {item.locationName ? (
              <View style={styles.locationRow}>
                <MapPin size={14} color={COLORS.textSecondary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.locationName}
                </Text>
              </View>
            ) : null}

            <View style={styles.tagsRow}>
              {tags.length > 0
                ? tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))
                : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [removeEntry],
  );

  const emptyCopy = useMemo(() => {
    if (isLoading) return 'Loading your scans…';
    if (errorMessage) return errorMessage;
    return 'Your scanned plants will appear here. Scan something from the Scan tab to start building your collection.';
  }, [errorMessage, isLoading]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Collection</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                refresh().catch((e) => {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Journal] refresh failed', { message });
                });
              }}
              testID="journal-refresh"
            >
              <Brush size={20} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, styles.iconButtonDanger]} onPress={onPressClearAll} testID="journal-clear">
              <Trash2 size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, entries.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState} testID="journal-empty">
              <View style={styles.emptyIcon}>
                <Brush size={22} color={COLORS.status} />
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  iconButtonDanger: {
    borderColor: 'rgba(255,92,92,0.35)',
  },
  listContent: {
    padding: 24,
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
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
    alignItems: 'center',
  },
  deleteBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(7,17,11,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadge: {
    backgroundColor: 'rgba(7,17,11,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.22)',
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
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.22)',
  },
  emptyState: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 30,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.statusSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.statusBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tagText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
});

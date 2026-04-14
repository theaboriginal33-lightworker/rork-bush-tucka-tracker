import React, { memo, useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookmarkPlus, ImageUp, Search } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useCookbook, type CookRecipeEntry } from '@/app/providers/CookbookProvider';
import { useResolvedScanImageUri } from '@/hooks/useResolvedScanImageUri';
import { pickerAllowsEditing, prepareMediaLibraryPicker } from '@/utils/iosImagePicker';

const COOK_LIST_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1541544181051-e46601a43f2b?q=80&w=1600&auto=format&fit=crop';

type CookbookListRowProps = {
  item: CookRecipeEntry;
  busyImageId: string | null;
  canEditImageForEntry: (entry: CookRecipeEntry | undefined) => boolean;
  openImageActions: (item: CookRecipeEntry, hasPhoto: boolean) => void;
};

const CookbookListRow = memo(function CookbookListRow({
  item,
  busyImageId,
  canEditImageForEntry,
  openImageActions,
}: CookbookListRowProps) {
  const resolvedUri = useResolvedScanImageUri({
    storagePath: item.storagePath,
    imagePreviewUri: item.imagePreviewUri,
    imageUri: item.imageUri,
  });
  const displayUri = resolvedUri ?? COOK_LIST_IMAGE_FALLBACK;
  const resolvedScheme = displayUri.split(':')[0] || 'none';
  const isLocal = resolvedScheme === 'file' || resolvedScheme === 'data';
  const hasPhoto = Boolean(resolvedUri);
  const isBusy = busyImageId === item.id;
  const isGuide = item.source === 'tucka-guide';
  const safetyDot = item.safetyStatus === 'safe' ? COLORS.success : COLORS.warning;
  const rawScheme = (item.imageUri ?? '').split(':')[0] || 'none';

  return (
    <TouchableOpacity
      style={[styles.itemCard, isBusy && styles.itemCardBusy]}
      onPress={() => {
        if (item.source === 'collection' && item.scanEntryId) {
          router.push(`/scan/${encodeURIComponent(item.scanEntryId)}`);
          return;
        }
        router.push(`/cook/guide/${encodeURIComponent(item.id)}`);
      }}
      onLongPress={() => {
        if (!canEditImageForEntry(item)) return;
        openImageActions(item, hasPhoto);
      }}
      delayLongPress={280}
      disabled={isBusy}
      testID={`cook-item-${item.id}`}
    >
      <View style={styles.itemImageWrap}>
        <Image
          source={{ uri: displayUri }}
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
          {canEditImageForEntry(item) ? (
            <TouchableOpacity
              style={[styles.imageQuickAction, isBusy && styles.imageQuickActionDisabled]}
              onPress={() => openImageActions(item, hasPhoto)}
              disabled={isBusy}
              testID={`cook-item-image-action-${item.id}`}
            >
              <ImageUp size={16} color={COLORS.text} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.itemTopRowInner}>
            <View style={styles.safetyPill}>
              <View style={[styles.safetyDot, { backgroundColor: safetyDot }]} />
              <Text style={styles.safetyPillText}>{item.safetyStatus.toUpperCase()}</Text>
            </View>

            {isGuide ? (
              <View style={styles.guidePill} testID={`cook-item-guide-pill-${item.id}`}>
                <BookmarkPlus size={14} color={COLORS.primary} />
                <Text style={styles.guidePillText}>Guide</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {canEditImageForEntry(item) ? (
        <Text style={styles.holdHint} testID={`cook-item-hold-hint-${item.id}`}>
          Tap photo icon to change / remove
        </Text>
      ) : null}

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
});

export default function CookScreen() {
  const { entries, isLoading, errorMessage, setEntryImage, clearEntryImage, canEditImageForEntry } = useCookbook();

  const [query, setQuery] = useState<string>('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q.length === 0) return true;
      return e.title.toLowerCase().includes(q) || e.commonName.toLowerCase().includes(q) || (e.scientificName ?? '').toLowerCase().includes(q);
    });
  }, [entries, query]);

  const headerSubtitle = useMemo(() => {
    if (isLoading) return 'Loading…';
    if (errorMessage) return errorMessage;
    if (entries.length === 0) return 'Cook pulls from Collection + saved Tucka Guide answers.';
    const guideCount = entries.filter((e) => e.source === 'tucka-guide').length;
    if (guideCount > 0) {
      return `${entries.length} saved • ${guideCount} from Tucka Guide`;
    }
    return `${entries.length} saved ${entries.length === 1 ? 'ingredient' : 'ingredients'}`;
  }, [entries, errorMessage, isLoading]);

  const [busyImageId, setBusyImageId] = useState<string | null>(null);

  const pickImageForEntry = useCallback(
    async (entryId: string) => {
      try {
        setBusyImageId(entryId);
        console.log('[Cook] pickImageForEntry start', { entryId });

        if (Platform.OS !== 'web') {
          const ok = await prepareMediaLibraryPicker();
          if (!ok) {
            Alert.alert('Permission needed', 'Photo library access is required to set a recipe photo.');
            return;
          }
        }

        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: pickerAllowsEditing(),
          quality: 0.9,
          base64: Platform.OS === 'web',
        });

        if (res.canceled) {
          console.log('[Cook] pickImageForEntry canceled', { entryId });
          return;
        }

        const asset = res.assets?.[0];
        if (!asset?.uri) {
          console.log('[Cook] pickImageForEntry missing uri', { entryId, assets: res.assets?.length ?? 0 });
          return;
        }

        await setEntryImage(entryId, {
          uri: asset.uri,
          base64: asset.base64 ?? undefined,
          mimeType: (asset as unknown as { mimeType?: string })?.mimeType,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[Cook] pickImageForEntry failed', { message });
        Alert.alert('Could not update photo', 'Please try again.');
      } finally {
        setBusyImageId(null);
      }
    },
    [setEntryImage],
  );

  const confirmRemoveImageForEntry = useCallback(
    (entryId: string) => {
      Alert.alert('Remove photo?', 'This will remove the custom photo for this recipe.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setBusyImageId(entryId);
            clearEntryImage(entryId)
              .catch((e) => {
                const message = e instanceof Error ? e.message : String(e);
                console.log('[Cook] clearEntryImage failed', { message });
                Alert.alert('Could not remove photo', 'Please try again.');
              })
              .finally(() => setBusyImageId(null));
          },
        },
      ]);
    },
    [clearEntryImage],
  );

  const openImageActions = useCallback(
    (item: CookRecipeEntry, hasPhoto: boolean) => {
      if (!canEditImageForEntry(item)) return;

      const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
        {
          text: hasPhoto ? 'Change photo' : 'Add photo',
          onPress: () => void pickImageForEntry(item.id),
        },
      ];

      if (hasPhoto) {
        buttons.push({ text: 'Remove photo', style: 'destructive', onPress: () => confirmRemoveImageForEntry(item.id) });
      }

      buttons.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert('Recipe photo', 'Choose an action', buttons);
    },
    [canEditImageForEntry, confirmRemoveImageForEntry, pickImageForEntry],
  );

  const renderItem = useCallback(
    ({ item }: { item: CookRecipeEntry }) => (
      <CookbookListRow
        item={item}
        busyImageId={busyImageId}
        canEditImageForEntry={canEditImageForEntry}
        openImageActions={openImageActions}
      />
    ),
    [busyImageId, canEditImageForEntry, openImageActions],
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
              <Text style={styles.emptyText}>Scan plants in Home. Safe + 75%+ confidence appears here automatically — and you can also save Tucka Guide answers from the chat.</Text>
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
  itemCardBusy: {
    opacity: 0.75,
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
  },
  itemTopRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageQuickAction: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: 'rgba(7,17,11,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  imageQuickActionDisabled: {
    opacity: 0.6,
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

  holdHint: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 2,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: 'rgba(255,255,255,0.55)',
  },
  itemBody: {
    padding: 16,
    gap: 6,
    paddingTop: 10,
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
  guidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
  },
  guidePillText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.2,
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

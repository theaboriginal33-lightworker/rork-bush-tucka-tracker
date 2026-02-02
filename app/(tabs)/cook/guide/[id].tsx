import React, { useCallback, useMemo } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, Download, Share2, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useCookbook } from '@/app/providers/CookbookProvider';

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

export default function CookGuideDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const entryId = typeof id === 'string' ? id : '';

  const { getEntryById, removeEntry } = useCookbook();
  const entry = getEntryById(entryId);

  const imageUri = useMemo(() => {
    return safeImageUri(entry?.imageUri) ?? null;
  }, [entry?.imageUri]);

  const exportText = useMemo(() => {
    const lines: string[] = [];
    lines.push('Tucka Guide');
    if (entry?.commonName) lines.push(`Plant: ${entry.commonName}`);
    if (entry?.scientificName) lines.push(`Scientific: ${entry.scientificName}`);
    if (typeof entry?.confidence === 'number') lines.push(`Confidence: ${Math.round(entry.confidence * 100)}%`);
    if (entry?.safetyStatus) lines.push(`Safety: ${String(entry.safetyStatus).toUpperCase()}`);
    if (typeof entry?.createdAt === 'number') lines.push(`Saved: ${new Date(entry.createdAt).toLocaleString()}`);
    lines.push('');
    const body = String(entry?.guideText ?? '').trim();
    lines.push(body.length > 0 ? body : '(No text saved)');
    lines.push('');
    lines.push('—');
    lines.push('Always verify locally before consuming.');
    return lines.join('\n');
  }, [entry?.commonName, entry?.confidence, entry?.createdAt, entry?.guideText, entry?.safetyStatus, entry?.scientificName]);

  const onExport = useCallback(async () => {
    if (!entry) return;

    const safeName = `tucka-guide-${entry.id}.txt`;

    if (Platform.OS === 'web') {
      try {
        if (typeof document === 'undefined') {
          await Share.share({ message: exportText });
          return;
        }
        const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[CookGuide] web download failed', { message });
        await Share.share({ message: exportText });
        return;
      }
    }

    try {
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        console.log('[CookGuide] no writable directory available');
        await Share.share({ message: exportText });
        return;
      }

      const fileUri = `${baseDir}${safeName}`;
      console.log('[CookGuide] writing export file', { fileUri });

      await FileSystem.writeAsStringAsync(fileUri, exportText, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share / Save' });
        return;
      }

      await Share.share({ message: exportText });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[CookGuide] export failed', { message });
      Alert.alert('Could not export', message.length > 140 ? 'Please try again.' : message);
    }
  }, [entry, exportText]);

  const onDelete = useCallback(() => {
    if (!entry) return;

    Alert.alert('Delete saved guide?', 'This will remove it from Cook.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeEntry(entry.id).catch((e) => {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[CookGuide] removeEntry failed', { message });
            Alert.alert('Could not delete', 'Please try again.');
          });
          router.back();
        },
      },
    ]);
  }, [entry, removeEntry]);

  if (!entry) {
    return (
      <View style={styles.container} testID="cook-guide-missing">
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} testID="cook-guide-back">
              <ChevronLeft size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Saved guide</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Not found</Text>
            <Text style={styles.emptyText}>This saved guide may have been deleted.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={`cook-guide-${entry.id}`}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} testID="cook-guide-back">
            <ChevronLeft size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {entry.title}
          </Text>
          <TouchableOpacity style={styles.iconButton} onPress={onDelete} testID="cook-guide-delete">
            <Trash2 size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="cook-guide-scroll">
          <View style={styles.hero}>
            <View style={styles.heroImageWrap}>
              <Image
                source={{
                  uri:
                    imageUri ??
                    'https://images.unsplash.com/photo-1541989458574-2bb5d1e4d05e?q=80&w=1800&auto=format&fit=crop',
                }}
                style={styles.heroImage}
                contentFit="cover"
                testID="cook-guide-image"
              />
              <View style={styles.heroOverlay} />
            </View>

            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>{entry.commonName}</Text>
              {entry.scientificName ? <Text style={styles.heroSubtitle}>{entry.scientificName}</Text> : null}
              <View style={styles.pillRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{String(entry.safetyStatus).toUpperCase()}</Text>
                </View>
                <View style={[styles.pill, styles.pillSecondary]}>
                  <Text style={styles.pillText}>{Math.round(entry.confidence * 100)}% confidence</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.primaryAction} onPress={onExport} testID="cook-guide-export">
              <Share2 size={18} color={COLORS.background} />
              <Text style={styles.primaryActionText}>Share / Export</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={onExport} testID="cook-guide-download">
              <Download size={18} color={COLORS.text} />
              <Text style={styles.secondaryActionText}>Download</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card} testID="cook-guide-text-card">
            <Text style={styles.cardTitle}>Saved answer</Text>
            <Text style={styles.cardBody}>{String(entry.guideText ?? '').trim() || 'No text saved.'}</Text>
          </View>

          {entry.suggestedUses.length > 0 ? (
            <View style={styles.card} testID="cook-guide-uses-card">
              <Text style={styles.cardTitle}>Suggested uses</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {entry.suggestedUses.slice(0, 12).map((u, idx) => (
                  <View key={`${u}-${idx}`} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{u}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ height: 24 }} />
        </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  hero: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  heroImageWrap: {
    height: 190,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,17,11,0.25)',
  },
  heroText: {
    padding: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  pill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(246,196,69,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(246,196,69,0.32)',
    justifyContent: 'center',
  },
  pillSecondary: {
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderColor: 'rgba(56,217,137,0.32)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.primary,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.background,
    letterSpacing: 0.3,
  },
  secondaryAction: {
    width: 150,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  card: {
    marginTop: 14,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  cardBody: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(234,246,238,0.88)',
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 18,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

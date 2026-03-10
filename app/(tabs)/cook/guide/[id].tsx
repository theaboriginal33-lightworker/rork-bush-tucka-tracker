import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, Edit3, FileDown, ImageUp, Share2, Trash2, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { buildShareUrl } from '@/constants/shareLinks';
import { useCookbook } from '@/app/providers/CookbookProvider';
import { useScanJournal } from '@/app/providers/ScanJournalProvider';

type LegacyFileSystemModule = typeof import('expo-file-system/legacy');
type ExpoPrintModule = typeof import('expo-print');

let legacyFsPromise: Promise<LegacyFileSystemModule | null> | null = null;
let printPromise: Promise<ExpoPrintModule | null> | null = null;

async function getLegacyFileSystem(): Promise<LegacyFileSystemModule | null> {
  try {
    if (!legacyFsPromise) {
      legacyFsPromise = import('expo-file-system/legacy')
        .then((m) => m as LegacyFileSystemModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[CookGuide] failed to load expo-file-system/legacy', { message });
          return null;
        });
    }
    return await legacyFsPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[CookGuide] getLegacyFileSystem unexpected error', { message });
    return null;
  }
}

async function loadExpoPrint(): Promise<ExpoPrintModule | null> {
  try {
    if (!printPromise) {
      printPromise = import('expo-print')
        .then((m) => m as ExpoPrintModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[CookGuide] failed to load expo-print', { message });
          return null;
        });
    }
    return await printPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[CookGuide] loadExpoPrint unexpected error', { message });
    return null;
  }
}

type MaybePaths = {
  Paths?: {
    cache?: { uri?: string };
    document?: { uri?: string };
  };
  cacheDirectory?: string;
  documentDirectory?: string;
};

async function imageToBase64DataUri(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  try {
    if (Platform.OS === 'web') return null;
    const fs = await getLegacyFileSystem();
    if (!fs) return null;

    let localUri = uri;
    const scheme = uri.split(':')[0] ?? '';

    if (scheme === 'content' || scheme === 'ph' || scheme === 'assets-library') {
      const fsAny = fs as unknown as MaybePaths;
      const cacheDir =
        (typeof fsAny.cacheDirectory === 'string' ? fsAny.cacheDirectory : '') ||
        (typeof fsAny.documentDirectory === 'string' ? fsAny.documentDirectory : '');
      if (!cacheDir) return null;
      const tmpDest = cacheDir.endsWith('/') ? `${cacheDir}pdf_img_${Date.now()}.jpg` : `${cacheDir}/pdf_img_${Date.now()}.jpg`;
      try {
        await fs.copyAsync({ from: uri, to: tmpDest });
        localUri = tmpDest;
      } catch (copyErr) {
        console.log('[CookGuide:imageToBase64] copyAsync failed', copyErr instanceof Error ? copyErr.message : String(copyErr));
        return null;
      }
    }

    if (scheme === 'http' || scheme === 'https') return uri;

    const base64 = await fs.readAsStringAsync(localUri, { encoding: 'base64' as const });
    if (!base64 || base64.length === 0) return null;
    console.log('[CookGuide:imageToBase64] converted', { uriLen: uri.length, base64Len: base64.length });
    return `data:image/jpeg;base64,${base64}`;
  } catch (e) {
    console.log('[CookGuide:imageToBase64] failed', e instanceof Error ? e.message : String(e));
    return null;
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(raw: string): string {
  let text = escHtml(raw);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:800;margin:12px 0 6px;">$1</h3>');
  text = text.replace(/^# (.+)$/gm, '<h2 style="font-size:17px;font-weight:800;margin:14px 0 6px;">$1</h2>');
  text = text.replace(/^[-\u2022] (.+)$/gm, '<div style="padding-left:12px;margin:3px 0;">\u2022 $1</div>');
  text = text.replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:12px;margin:3px 0;">$1. $2</div>');
  text = text.replace(/\n/g, '<br/>');
  return text;
}

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

  const { getEntryById, removeEntry, setEntryImage, clearEntryImage, canEditImageForEntry, updateEntryTitle, canEditTitleForEntry } =
    useCookbook();
  const { getEntryById: getScanEntryById } = useScanJournal();
  const entry = getEntryById(entryId);

  const scanEntry = useMemo(() => {
    if (!entry?.scanEntryId) return undefined;
    return getScanEntryById(entry.scanEntryId);
  }, [entry?.scanEntryId, getScanEntryById]);

  const imageUri = useMemo(() => {
    return safeImageUri(entry?.imageUri) ?? null;
  }, [entry?.imageUri]);

  const [isImageBusy, setIsImageBusy] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>(entry?.title ?? '');

  useEffect(() => {
    setTitleDraft(entry?.title ?? '');
    setIsEditingTitle(false);
  }, [entry?.title]);

  const onStartEditTitle = useCallback(() => {
    if (!entry || !canEditTitleForEntry(entry)) return;
    setTitleDraft(entry.title);
    setIsEditingTitle(true);
  }, [canEditTitleForEntry, entry]);

  const onCancelEditTitle = useCallback(() => {
    setTitleDraft(entry?.title ?? '');
    setIsEditingTitle(false);
  }, [entry?.title]);

  const onSaveTitle = useCallback(async () => {
    if (!entry) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }
    try {
      await updateEntryTitle(entry.id, trimmed);
      setIsEditingTitle(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not update title', message.length > 140 ? 'Please try again.' : message);
    }
  }, [entry, titleDraft, updateEntryTitle]);

  const onPickImage = useCallback(async () => {
    if (!entry) return;
    if (!canEditImageForEntry(entry)) return;

    try {
      setIsImageBusy(true);
      console.log('[CookGuide] onPickImage start', { id: entry.id });

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
        base64: Platform.OS === 'web',
      });

      if (res.canceled) {
        console.log('[CookGuide] image pick canceled', { id: entry.id });
        return;
      }

      const asset = res.assets?.[0];
      if (!asset?.uri) {
        console.log('[CookGuide] image pick missing asset uri', { id: entry.id, assets: res.assets?.length ?? 0 });
        return;
      }

      await setEntryImage(entry.id, {
        uri: asset.uri,
        base64: asset.base64 ?? undefined,
        mimeType: (asset as unknown as { mimeType?: string })?.mimeType,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[CookGuide] onPickImage failed', { message });
      Alert.alert('Could not update photo', 'Please try again.');
    } finally {
      setIsImageBusy(false);
    }
  }, [canEditImageForEntry, entry, setEntryImage]);

  const onRemoveImage = useCallback(async () => {
    if (!entry) return;
    if (!canEditImageForEntry(entry)) return;

    Alert.alert('Remove photo?', 'This will remove the custom photo for this recipe.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setIsImageBusy(true);
          clearEntryImage(entry.id)
            .catch((e) => {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[CookGuide] clearEntryImage failed', { message });
              Alert.alert('Could not remove photo', 'Please try again.');
            })
            .finally(() => setIsImageBusy(false));
        },
      },
    ]);
  }, [canEditImageForEntry, clearEntryImage, entry]);

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
    if (Array.isArray(entry?.suggestedUses) && entry.suggestedUses.length > 0) {
      lines.push('Suggested uses:');
      entry.suggestedUses.slice(0, 12).forEach((u) => lines.push(`• ${u}`));
      lines.push('');
    }
    const url = entry?.id ? buildShareUrl({ path: `/cook/guide/${entry.id}` }) : '';
    if (url) {
      lines.push('');
      lines.push(`Open: ${url}`);
    }

    lines.push('—');
    lines.push('Always verify locally before consuming.');
    return lines.join('\n');
  }, [entry?.commonName, entry?.confidence, entry?.createdAt, entry?.guideText, entry?.id, entry?.safetyStatus, entry?.scientificName, entry?.suggestedUses]);

  const buildPdfHtml = useCallback(async (): Promise<string> => {
    if (!entry) return '';

    const rawEntryImageUri = safeImageUri(entry.imageUri);
    const entryImageScheme = (rawEntryImageUri ?? '').split(':')[0] ?? '';
    let entryImageUri = rawEntryImageUri;
    if (rawEntryImageUri && (entryImageScheme === 'file' || entryImageScheme === 'content')) {
      entryImageUri = await imageToBase64DataUri(rawEntryImageUri);
    }
    const canEmbedImage = Boolean(entryImageUri) && (entryImageUri?.startsWith('data:') || (entryImageScheme !== 'file' && entryImageScheme !== 'content' && entryImageScheme !== 'ph'));

    const scanImageRaw = scanEntry?.imagePreviewUri ?? scanEntry?.imageUri;
    const rawScanImageUri = safeImageUri(scanImageRaw);
    const scanImageScheme = (rawScanImageUri ?? '').split(':')[0] ?? '';
    let scanImageUri = rawScanImageUri;
    if (rawScanImageUri && (scanImageScheme === 'file' || scanImageScheme === 'content')) {
      scanImageUri = await imageToBase64DataUri(rawScanImageUri);
    }
    const canEmbedScanImage = Boolean(scanImageUri) && (scanImageUri?.startsWith('data:') || (scanImageScheme !== 'file' && scanImageScheme !== 'content' && scanImageScheme !== 'ph'));

    const title = escHtml(entry.title);
    const common = escHtml(entry.commonName);
    const scientific = entry.scientificName ? escHtml(entry.scientificName) : '';

    const safety = escHtml(String(entry.safetyStatus).toUpperCase());
    const confidence = escHtml(`${Math.round(entry.confidence * 100)}%`);
    const createdAtLabel = (() => {
      try {
        return typeof entry.createdAt === 'number' ? escHtml(new Date(entry.createdAt).toLocaleString('en-AU')) : '';
      } catch {
        return '';
      }
    })();

    const rawBody = String(entry.guideText ?? '').trim() || 'No text saved.';
    const body = markdownToHtml(rawBody);
    const suggestedUses = Array.isArray(entry.suggestedUses) ? entry.suggestedUses.map((u) => escHtml(String(u))).slice(0, 16) : [];

    const scanBannerHtml = canEmbedScanImage
      ? `<div class="scan-banner"><img src="${scanImageUri}" alt="Original Scan" /><div class="scan-banner-label">Original Scan</div></div>`
      : '';

    const imageHtml = canEmbedImage
      ? `<div class="hero"><img src="${entryImageUri}" alt="Photo" /></div>`
      : !canEmbedScanImage
        ? `<div class="hero hero-empty"><div class="hero-empty-inner">Photo not available for PDF export</div></div>`
        : '';

    const usesHtml = suggestedUses.length
      ? `<ul>${suggestedUses.map((u) => `<li>${u}</li>`).join('')}</ul>`
      : '<div class="muted">—</div>';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; color: #0c1411; background: #f5f6f4; }
  .page { padding: 22px 18px 28px; }
  .card { background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid rgba(15, 36, 24, 0.10); box-shadow: 0 14px 30px rgba(12, 20, 17, 0.10); }
  .scan-banner { position: relative; height: 280px; background: #0a1a10; }
  .scan-banner img { width: 100%; height: 280px; object-fit: cover; display: block; }
  .scan-banner-label { position: absolute; top: 12px; left: 12px; padding: 5px 12px; border-radius: 8px; background: rgba(7,17,11,0.72); color: rgba(255,255,255,0.92); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; backdrop-filter: blur(6px); }
  .hero { height: 240px; background: #0f2418; }
  .hero img { width: 100%; height: 240px; object-fit: cover; display: block; }
  .hero-empty { display: flex; align-items: center; justify-content: center; }
  .hero-empty-inner { color: rgba(255,255,255,0.86); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .content { padding: 18px 16px 16px; }
  .title { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
  .subtitle { font-size: 14px; color: rgba(12, 20, 17, 0.70); margin: 0 0 14px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 999px; background: rgba(15,36,24,0.06); border: 1px solid rgba(15,36,24,0.12); font-size: 12px; color: rgba(12,20,17,0.86); }
  .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .section { padding: 12px 12px; border-radius: 14px; border: 1px solid rgba(15,36,24,0.10); background: rgba(245, 246, 244, 0.70); }
  .section h3 { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 8px; color: rgba(12, 20, 17, 0.55); }
  .section .muted { color: rgba(12, 20, 17, 0.55); font-size: 13px; }
  .section p { margin: 0; font-size: 14px; line-height: 1.45; }
  ul { margin: 0; padding: 0 0 0 18px; }
  li { margin: 0 0 6px; font-size: 14px; line-height: 1.4; }
  .footer { margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(15,36,24,0.18); font-size: 12px; color: rgba(12, 20, 17, 0.55); }
</style>
</head>
<body>
  <div class="page">
    <div class="card">
      ${scanBannerHtml}
      ${imageHtml}
      <div class="content">
        <h1 class="title">${title}</h1>
        <p class="subtitle">${scientific ? `${common} (${scientific})` : common}</p>
        <div class="meta">
          <div class="pill">Safety: <strong>${safety}</strong></div>
          <div class="pill">Confidence: <strong>${confidence}</strong></div>
          ${createdAtLabel ? `<div class="pill">Saved: <strong>${createdAtLabel}</strong></div>` : ''}
        </div>

        <div class="grid">
          <div class="section">
            <h3>Saved answer</h3>
            <div style="font-size:14px;line-height:1.45;">${body}</div>
          </div>
          <div class="section">
            <h3>Suggested uses</h3>
            ${usesHtml}
          </div>
        </div>

        <div class="footer">Generated from your saved Tucka Guide entry.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }, [entry, scanEntry]);

  const exportPdf = useCallback(async () => {
    if (!entry) return;

    const html = await buildPdfHtml();
    if (!html) return;

    try {
      console.log('[CookGuide] exportPdf start', { entryId: entry.id, platform: Platform.OS, htmlLen: html.length });

      const print = await loadExpoPrint();
      if (!print) {
        console.log('[CookGuide] expo-print not available, falling back to share text');
        await Share.share({ message: exportText, title: entry.title });
        return;
      }

      console.log('[CookGuide] calling printAsync to open native print dialog');
      await print.printAsync({ html });
      console.log('[CookGuide] printAsync completed');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[CookGuide] exportPdf failed', { message });
      try {
        await Share.share({ message: exportText, title: entry.title });
      } catch {
        Alert.alert('Could not export', message || 'Please try again.');
      }
    }
  }, [buildPdfHtml, entry, exportText]);

  const onExportText = useCallback(async () => {
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
      const fs = await getLegacyFileSystem();
      const baseDir = fs?.cacheDirectory ?? fs?.documentDirectory;
      if (!baseDir || !fs) {
        console.log('[CookGuide] no writable directory available', { hasFs: Boolean(fs), baseDir });
        await Share.share({ message: exportText });
        return;
      }

      const fileUri = `${baseDir}${safeName}`;
      console.log('[CookGuide] writing export file', { fileUri });

      await fs.writeAsStringAsync(fileUri, exportText, { encoding: fs.EncodingType.UTF8 });

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
          <View style={styles.topActions}>
            {canEditTitleForEntry(entry) ? (
              <TouchableOpacity style={styles.iconButton} onPress={onStartEditTitle} testID="cook-guide-edit-title">
                <Edit3 size={18} color={COLORS.text} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconButton} onPress={onDelete} testID="cook-guide-delete">
              <Trash2 size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
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

              {canEditImageForEntry(entry) ? (
                <View style={styles.imageActions} testID="cook-guide-image-actions">
                  <TouchableOpacity
                    style={[styles.imageActionButton, isImageBusy && styles.imageActionButtonDisabled]}
                    onPress={onPickImage}
                    disabled={isImageBusy}
                    testID="cook-guide-image-upload"
                  >
                    <ImageUp size={18} color={COLORS.text} />
                  </TouchableOpacity>

                  {imageUri ? (
                    <TouchableOpacity
                      style={[styles.imageActionButton, styles.imageActionDanger, isImageBusy && styles.imageActionButtonDisabled]}
                      onPress={onRemoveImage}
                      disabled={isImageBusy}
                      testID="cook-guide-image-remove"
                    >
                      <X size={18} color={COLORS.text} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.heroText}>
              {isEditingTitle ? (
                <View style={styles.titleEditWrap} testID="cook-guide-title-edit">
                  <TextInput
                    value={titleDraft}
                    onChangeText={setTitleDraft}
                    placeholder="Recipe title"
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.titleInput}
                  />
                  <View style={styles.titleEditActions}>
                    <TouchableOpacity style={styles.titleButton} onPress={onSaveTitle} testID="cook-guide-title-save">
                      <Text style={styles.titleButtonText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.titleButtonGhost} onPress={onCancelEditTitle} testID="cook-guide-title-cancel">
                      <Text style={styles.titleButtonGhostText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.heroTitle}>{entry.title}</Text>
              )}
              <Text style={styles.heroSubtitle}>{entry.commonName}</Text>
              {entry.scientificName ? <Text style={styles.heroSubtitle}>{entry.scientificName}</Text> : null}

              {canEditImageForEntry(entry) ? (
                <Text style={styles.holdHint} testID="cook-guide-hold-hint">
                  HOLD TO CHANGE IMAGE
                </Text>
              ) : null}
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
            <TouchableOpacity style={styles.primaryAction} onPress={exportPdf} testID="cook-guide-export-pdf">
              <FileDown size={18} color={COLORS.background} />
              <Text style={styles.primaryActionText}>Print / Save PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={onExportText} testID="cook-guide-export-text">
              <Share2 size={18} color={COLORS.text} />
              <Text style={styles.secondaryActionText}>Share text</Text>
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
  topActions: {
    flexDirection: 'row',
    gap: 8,
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
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,17,11,0.25)',
  },
  imageActions: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    gap: 10,
  },
  imageActionButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(7,17,11,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActionButtonDisabled: {
    opacity: 0.6,
  },
  imageActionDanger: {
    backgroundColor: 'rgba(255,92,92,0.20)',
    borderColor: 'rgba(255,92,92,0.35)',
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
  titleEditWrap: {
    gap: 10,
    marginBottom: 6,
  },
  titleInput: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  titleEditActions: {
    flexDirection: 'row',
    gap: 10,
  },
  titleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  titleButtonText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  titleButtonGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  titleButtonGhostText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  holdHint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.58)',
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

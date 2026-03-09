import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRorkAgent } from '@rork-ai/toolkit-sdk';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import type * as LocationType from 'expo-location';
import { BookmarkPlus, Check, ChevronLeft, CookingPot, Download, FileDown, MapPin, MessageCircle, Navigation, Send, Share2, ShieldAlert, Sparkles, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { buildShareUrl } from '@/constants/shareLinks';
import { useScanJournal, type ScanJournalChatMessage } from '@/app/providers/ScanJournalProvider';
import { useCookbook } from '@/app/providers/CookbookProvider';

type ExpoSharingModule = typeof import('expo-sharing');
type ExpoPrintModule = typeof import('expo-print');

let sharingPromise: Promise<ExpoSharingModule | null> | null = null;
let printPromise: Promise<ExpoPrintModule | null> | null = null;

async function loadExpoSharing(): Promise<ExpoSharingModule | null> {
  try {
    if (!sharingPromise) {
      sharingPromise = import('expo-sharing')
        .then((m) => m as ExpoSharingModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[ScanDetails] failed to load expo-sharing', { message });
          return null;
        });
    }
    return await sharingPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ScanDetails] loadExpoSharing unexpected error', { message });
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
          console.log('[ScanDetails] failed to load expo-print', { message });
          return null;
        });
    }
    return await printPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ScanDetails] loadExpoPrint unexpected error', { message });
    return null;
  }
}

type ExpoFileSystemModule = typeof import('expo-file-system');

type MaybePaths = {
  Paths?: {
    cache?: {
      uri?: string;
    };
    document?: {
      uri?: string;
    };
  };
  cacheDirectory?: string;
  documentDirectory?: string;
};

let fileSystemPromise: Promise<ExpoFileSystemModule | null> | null = null;

async function loadExpoFileSystem(): Promise<ExpoFileSystemModule | null> {
  if (Platform.OS === 'web') return null;

  try {
    if (!fileSystemPromise) {
      fileSystemPromise = import('expo-file-system')
        .then((m) => m as ExpoFileSystemModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[ScanDetails] failed to load expo-file-system', { message });
          return null;
        });
    }

    return await fileSystemPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ScanDetails] loadExpoFileSystem unexpected error', { message });
    return null;
  }
}

const CULTURAL_FOOTER = 'Cultural knowledge shared here is general and non-restricted.';

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
  text = text.replace(/^[-•] (.+)$/gm, '<div style="padding-left:12px;margin:3px 0;">• $1</div>');
  text = text.replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:12px;margin:3px 0;">$1. $2</div>');
  text = text.replace(/\n/g, '<br/>');
  return text;
}

type LocationModule = typeof LocationType;

async function loadExpoLocation(): Promise<LocationModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    const mod = (await import('expo-location')) as unknown as LocationModule;
    return mod;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[ScanDetails] failed to load expo-location', { message });
    return null;
  }
}

function refineCulturalNotes(raw: string): string {
  const note = String(raw ?? '').trim();
  if (note.length === 0) return '';

  const normalized = note.replace(/\s+/g, ' ').trim();
  const oldPhrase = /has been used by Indigenous Australians for food and medicine\.?/i;
  if (oldPhrase.test(normalized)) {
    return 'Some Lilly Pilly species have been traditionally used as food. Knowledge and use vary by region and community.';
  }

  return note;
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionGroup} testID={`scan-details-section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        <View style={styles.sectionBody}>{children}</View>
      </View>
    </View>
  );
}

function Pill({ text, tone }: { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const bg =
    tone === 'good'
      ? COLORS.statusSoft
      : tone === 'warn'
        ? 'rgba(246,196,69,0.14)'
        : tone === 'bad'
          ? 'rgba(255,92,92,0.14)'
          : 'rgba(155,179,164,0.10)';

  const border =
    tone === 'good'
      ? COLORS.statusBorder
      : tone === 'warn'
        ? 'rgba(246,196,69,0.35)'
        : tone === 'bad'
          ? 'rgba(255,92,92,0.35)'
          : 'rgba(155,179,164,0.22)';

  const color = tone === 'good' ? COLORS.status : tone === 'warn' ? COLORS.warning : tone === 'bad' ? COLORS.error : COLORS.textSecondary;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
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

export default function ScanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const entryId = typeof id === 'string' ? id : '';

  const { getEntryById, updateEntry, removeEntry } = useScanJournal();
  const { saveGuideEntry } = useCookbook();
  const entry = getEntryById(entryId);
  const entryDisplayImageUri = useMemo(() => {
    if (!entry) return null;
    return safeImageUri(entry.imageUri) ?? safeImageUri(entry.imagePreviewUri);
  }, [entry]);

  const [titleDraft, setTitleDraft] = useState<string>(entry?.title ?? '');
  const [notesDraft, setNotesDraft] = useState<string>(entry?.notes ?? '');
  const [locationNameDraft, setLocationNameDraft] = useState<string>(entry?.locationName ?? '');
  const [latDraft, setLatDraft] = useState<string>(entry?.location ? String(entry.location.latitude) : '');
  const [lngDraft, setLngDraft] = useState<string>(entry?.location ? String(entry.location.longitude) : '');

  const [activeTab, setActiveTab] = useState<'guide' | 'details'>('guide');
  const bottomInsets = useSafeAreaInsets();

  useEffect(() => {
    if (!entry) return;
    setTitleDraft(entry.title ?? '');
    setNotesDraft(entry.notes ?? '');
    setLocationNameDraft(entry.locationName ?? '');
    setLatDraft(entry.location ? String(entry.location.latitude) : '');
    setLngDraft(entry.location ? String(entry.location.longitude) : '');
  }, [entry]);

  type ConfidenceGate = {
    level: 'confident' | 'likely' | 'observe';
    title: string;
    blurb: string;
    tone: 'good' | 'warn' | 'bad';
  };

  const confidenceGate = useMemo((): ConfidenceGate => {
    const c = entry?.scan?.confidence;
    const confidence = Number.isFinite(c) ? (c as number) : 0;

    if (confidence >= 0.8) {
      return {
        level: 'confident',
        title: 'Confident ID',
        blurb: 'High confidence identification. Still verify locally before consuming.',
        tone: 'good',
      };
    }

    if (confidence >= 0.6) {
      return {
        level: 'likely',
        title: 'Likely match – verify locally',
        blurb: 'Likely identification. Confirm with local knowledge before consuming.',
        tone: 'warn',
      };
    }

    return {
      level: 'observe',
      title: 'Observe only',
      blurb: 'Low confidence. Observe only — do not rely on this ID for safety or preparation.',
      tone: 'bad',
    };
  }, [entry?.scan?.confidence]);

  const displaySafetyStatus = useMemo((): 'safe' | 'caution' | 'unknown' => {
    if (confidenceGate.level === 'confident') return (entry?.scan?.safety?.status as 'safe' | 'caution' | 'unknown' | undefined) ?? 'unknown';
    return 'unknown';
  }, [confidenceGate.level, entry?.scan?.safety?.status]);

  const safetyTone = useMemo((): 'good' | 'warn' | 'bad' => {
    const status = displaySafetyStatus;
    if (status === 'safe') return 'good';
    return 'warn';
  }, [displaySafetyStatus]);

  const createdLabel = useMemo(() => {
    if (!entry?.createdAt) return '';
    try {
      return new Date(entry.createdAt).toLocaleString('en-AU', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [entry?.createdAt]);


  const onSaveTitle = useCallback(async () => {
    if (!entry) return;

    const nextTitle = titleDraft.trim();
    if (nextTitle.length === 0) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }

    try {
      await updateEntry(entry.id, { title: nextTitle });
      Alert.alert('Saved', 'Title updated.');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] saveTitle failed', { message });
      Alert.alert('Could not save', 'Please try again.');
    }
  }, [entry, titleDraft, updateEntry]);

  const buildShareText = useCallback(() => {
    if (!entry) return '';

    const lines: string[] = [];
    lines.push(entry.title);
    lines.push(entry.scan.scientificName ? `${entry.scan.commonName} (${entry.scan.scientificName})` : entry.scan.commonName);
    lines.push(`Safety: ${entry.scan.safety.status.toUpperCase()}`);
    lines.push(`Confidence: ${Math.round(entry.scan.confidence * 100)}%`);
    if (entry.locationName) lines.push(`Location: ${entry.locationName}`);
    if (entry.notes) lines.push(`Notes: ${entry.notes}`);

    const url = buildShareUrl({ path: `/scan/${entry.id}` });
    if (url) lines.push(`\nOpen: ${url}`);

    return lines.filter((l) => l.trim().length > 0).join('\n');
  }, [entry]);

  const buildPdfHtml = useCallback((): string => {
    if (!entry) return '';

    const imageUri = safeImageUri(entry.imageUri) ?? safeImageUri(entry.imagePreviewUri);
    const imageScheme = (imageUri ?? '').split(':')[0] ?? '';
    const canEmbedImage = Boolean(imageUri) && imageScheme !== 'file' && imageScheme !== 'content' && imageScheme !== 'ph';

    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const title = esc(entry.title);
    const common = esc(entry.scan.commonName);
    const scientific = entry.scan.scientificName ? esc(entry.scan.scientificName) : '';

    const safety = esc(String(entry.scan.safety.status).toUpperCase());
    const safetySummary = esc(String(entry.scan.safety.summary ?? ''));
    const confidence = esc(`${Math.round(entry.scan.confidence * 100)}%`);

    const categories = Array.isArray(entry.scan.categories) ? entry.scan.categories.map((c) => esc(String(c))).slice(0, 12) : [];
    const suggestedUses = Array.isArray(entry.scan.suggestedUses) ? entry.scan.suggestedUses.map((u) => esc(String(u))).slice(0, 16) : [];
    const warnings = Array.isArray(entry.scan.warnings) ? entry.scan.warnings.map((w) => esc(String(w))).slice(0, 16) : [];

    const location = entry.locationName ? esc(entry.locationName) : '';
    const notes = entry.notes ? esc(entry.notes) : '';

    const createdAtLabel = (() => {
      try {
        return esc(new Date(entry.createdAt).toLocaleString('en-AU'));
      } catch {
        return '';
      }
    })();

    const keyRisks = Array.isArray(entry.scan.safety.keyRisks) ? entry.scan.safety.keyRisks.map((r) => esc(String(r))).slice(0, 12) : [];
    const preparationSteps = Array.isArray(entry.scan.preparation?.steps) ? entry.scan.preparation.steps.map((s) => esc(String(s))).slice(0, 16) : [];
    const seasonalityMonths = Array.isArray(entry.scan.seasonality?.bestMonths) ? entry.scan.seasonality.bestMonths.map((m) => esc(String(m))).slice(0, 12) : [];
    const seasonalityNotes = esc(String(entry.scan.seasonality?.notes ?? ''));
    const culturalNotes = esc(refineCulturalNotes(entry.scan.culturalKnowledge?.notes ?? ''));
    const culturalRespect = Array.isArray(entry.scan.culturalKnowledge?.respect) ? entry.scan.culturalKnowledge.respect.map((r) => esc(String(r))).slice(0, 12) : [];

    const imageHtml = canEmbedImage
      ? `<div class="hero"><img src="${imageUri}" alt="Photo" /></div>`
      : `<div class="hero hero-empty"><div class="hero-empty-inner">Photo not available for PDF export</div></div>`;

    const list = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<div class="muted">—</div>');

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
      ${imageHtml}
      <div class="content">
        <h1 class="title">${title}</h1>
        <p class="subtitle">${scientific ? `${common} (${scientific})` : common}</p>
        <div class="meta">
          <div class="pill">Safety: <strong>${safety}</strong></div>
          <div class="pill">Confidence: <strong>${confidence}</strong></div>
          ${location ? `<div class="pill">Location: <strong>${location}</strong></div>` : ''}
          ${createdAtLabel ? `<div class="pill">Saved: <strong>${createdAtLabel}</strong></div>` : ''}
        </div>

        <div class="grid">
          <div class="section">
            <h3>Safety summary</h3>
            <p>${safetySummary || '<span class="muted">—</span>'}</p>
            ${keyRisks.length ? `<div style="height:10px"></div><h3>Key risks</h3>${list(keyRisks)}` : ''}
          </div>

          ${categories.length ? `<div class="section"><h3>Categories</h3>${list(categories)}</div>` : ''}

          ${suggestedUses.length ? `<div class="section"><h3>Suggested uses</h3>${list(suggestedUses)}</div>` : ''}

          ${preparationSteps.length ? `<div class="section"><h3>Preparation</h3>${list(preparationSteps)}</div>` : ''}

          ${seasonalityMonths.length || seasonalityNotes ? `<div class="section"><h3>Seasonality</h3>${seasonalityMonths.length ? list(seasonalityMonths) : '<div class="muted">—</div>'}${seasonalityNotes ? `<div style="height:10px"></div><p>${seasonalityNotes}</p>` : ''}</div>` : ''}

          ${culturalNotes || culturalRespect.length ? `<div class="section"><h3>Cultural notes</h3><p>${culturalNotes || '<span class="muted">—</span>'}</p>${culturalRespect.length ? `<div style="height:10px"></div><h3>Respect</h3>${list(culturalRespect)}` : ''}<div class="footer">${esc(CULTURAL_FOOTER)}</div></div>` : ''}

          ${warnings.length ? `<div class="section"><h3>Warnings</h3>${list(warnings)}</div>` : ''}

          ${notes ? `<div class="section"><h3>Your notes</h3><p>${notes}</p></div>` : ''}
        </div>

        <div class="footer">Generated from your Bush Tucka Collection.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }, [entry]);

  const exportPdf = useCallback(async () => {
    if (!entry) return;

    const html = buildPdfHtml();
    if (!html) return;

    const safeName = `collection-${entry.id}.pdf`;

    try {
      console.log('[ScanDetails] exportPdf start', { entryId: entry.id, platform: Platform.OS, htmlLen: html.length });

      const print = await loadExpoPrint();
      if (!print) {
        console.log('[ScanDetails] expo-print not available, falling back to share text');
        await Share.share({ message: buildShareText(), title: entry.title });
        return;
      }

      if (Platform.OS === 'web') {
        try {
          const result = await print.printToFileAsync({ html });
          console.log('[ScanDetails] exportPdf web printToFileAsync result', { uri: result.uri });
          if (typeof document !== 'undefined') {
            const resp = await fetch(result.uri);
            const blob = await resp.blob();
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
          }
        } catch (webErr) {
          console.log('[ScanDetails] exportPdf web printToFileAsync failed', webErr instanceof Error ? webErr.message : String(webErr));
        }
        try {
          await print.printAsync({ html });
        } catch (printErr) {
          console.log('[ScanDetails] exportPdf web printAsync failed', printErr instanceof Error ? printErr.message : String(printErr));
          await Share.share({ message: buildShareText(), title: entry.title });
        }
        return;
      }

      let fileUri: string | null = null;
      try {
        const result = await print.printToFileAsync({ html });
        fileUri = result.uri;
        console.log('[ScanDetails] exportPdf file ready', { uri: fileUri });
      } catch (fileErr) {
        console.log('[ScanDetails] printToFileAsync failed, trying printAsync fallback', fileErr instanceof Error ? fileErr.message : String(fileErr));
        try {
          await print.printAsync({ html });
          return;
        } catch (printErr) {
          console.log('[ScanDetails] printAsync also failed', printErr instanceof Error ? printErr.message : String(printErr));
          await Share.share({ message: buildShareText(), title: entry.title });
          return;
        }
      }

      if (fileUri) {
        const sharing = await loadExpoSharing();
        const canShare = (await sharing?.isAvailableAsync()) ?? false;
        if (canShare) {
          await sharing?.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save / Share PDF', UTI: 'com.adobe.pdf' });
          return;
        }
      }

      await Share.share({ message: buildShareText(), title: entry.title });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] exportPdf failed completely', { message });
      try {
        await Share.share({ message: buildShareText(), title: entry.title });
      } catch {
        Alert.alert('Could not export', message || 'Please try again.');
      }
    }
  }, [buildPdfHtml, buildShareText, entry]);

  const shareSummary = useCallback(async () => {
    if (!entry) return;

    const message = buildShareText();

    try {
      console.log('[ScanDetails] shareSummary', { entryId: entry.id });
      await Share.share({ message, title: entry.title });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] shareSummary failed', { errMsg });
      Alert.alert('Share not available', message);
    }
  }, [buildShareText, entry]);

  const sharePhoto = useCallback(async () => {
    if (!entry) return;

    const imageUri = entry.imageUri ?? entry.imagePreviewUri;
    if (!imageUri) {
      Alert.alert('No photo saved', 'This scan does not have an attached photo to share.');
      return;
    }

    if (Platform.OS === 'web') {
      const message = buildShareText();
      try {
        console.log('[ScanDetails] sharePhoto(web): opening image', { imageUri });
        void Linking.openURL(imageUri);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.log('[ScanDetails] sharePhoto(web) failed', { errMsg });
      }
      try {
        await Share.share({ message, title: entry.title });
      } catch {
        Alert.alert('Photo link', imageUri);
      }
      return;
    }

    try {
      const sharing = await loadExpoSharing();
      const available = (await sharing?.isAvailableAsync()) ?? false;
      if (!available) {
        Alert.alert('Sharing not available', 'Your device does not support sharing files.');
        return;
      }

      const fs = await loadExpoFileSystem();
      if (!fs) {
        Alert.alert('Sharing unavailable', 'File sharing is not available on this device.');
        return;
      }

      const fileName = `scan-${entry.id}.jpg`;
      const fsAny = fs as unknown as MaybePaths;
      const cacheDirUri =
        (typeof fsAny.Paths?.cache?.uri === 'string' ? fsAny.Paths.cache.uri : '') ||
        (typeof fsAny.cacheDirectory === 'string' ? fsAny.cacheDirectory : '') ||
        (typeof fsAny.documentDirectory === 'string' ? fsAny.documentDirectory : '') ||
        (typeof fsAny.Paths?.document?.uri === 'string' ? fsAny.Paths.document.uri : '');
      if (cacheDirUri.length === 0) {
        throw new Error('No cache directory available');
      }
      const dest = cacheDirUri.endsWith('/') ? `${cacheDirUri}${fileName}` : `${cacheDirUri}/${fileName}`;

      if (imageUri.startsWith('file://')) {
        console.log('[ScanDetails] sharePhoto: shareAsync(local file)', { uri: imageUri, platform: Platform.OS });
        await sharing?.shareAsync(imageUri, {
          dialogTitle: `Share ${entry.title}`,
          mimeType: 'image/jpeg',
          UTI: 'public.jpeg',
        });
        return;
      }

      if (imageUri.startsWith('content://')) {
        console.log('[ScanDetails] sharePhoto: copyAsync(content uri)', { from: imageUri, to: dest, platform: Platform.OS });
        await fs.copyAsync({ from: imageUri, to: dest });

        console.log('[ScanDetails] sharePhoto: shareAsync(copied content uri)', { uri: dest });
        await sharing?.shareAsync(dest, {
          dialogTitle: `Share ${entry.title}`,
          mimeType: 'image/jpeg',
          UTI: 'public.jpeg',
        });
        return;
      }

      console.log('[ScanDetails] sharePhoto: downloadAsync(remote)', { from: imageUri, to: dest, platform: Platform.OS });
      const download = await fs.downloadAsync(imageUri, dest);

      console.log('[ScanDetails] sharePhoto: shareAsync(downloaded)', { uri: download.uri });
      await sharing?.shareAsync(download.uri, {
        dialogTitle: `Share ${entry.title}`,
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] sharePhoto failed', { errMsg });
      Alert.alert('Could not share photo', errMsg || 'Please try again.');
    }
  }, [buildShareText, entry]);

  const onShare = useCallback(() => {
    if (!entry) return;

    Alert.alert('Share / Save', 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save as PDF', onPress: () => void exportPdf() },
      { text: 'Scan summary', onPress: () => void shareSummary() },
      { text: 'Photo', onPress: () => void sharePhoto() },
    ]);
  }, [entry, exportPdf, sharePhoto, shareSummary]);


  const onSave = useCallback(async () => {
    if (!entry) return;

    const lat = latDraft.trim().length > 0 ? Number(latDraft) : null;
    const lng = lngDraft.trim().length > 0 ? Number(lngDraft) : null;

    const location =
      lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : undefined;

    const trimmedName = locationNameDraft.trim();

    let nextLocationName: string | undefined = trimmedName.length > 0 ? trimmedName : undefined;

    if (!nextLocationName && location && Platform.OS !== 'web') {
      try {
        const Location = await loadExpoLocation();
        if (!Location) return;
        const addresses = await Location.reverseGeocodeAsync({ latitude: location.latitude, longitude: location.longitude });
        const a = Array.isArray(addresses) ? addresses[0] : undefined;
        const parts = [a?.name, a?.street, a?.city ?? a?.district, a?.region].filter((p) => typeof p === 'string' && p.trim().length > 0) as string[];
        const label = parts.join(', ').trim();
        if (label.length > 0) {
          nextLocationName = label;
          setLocationNameDraft(label);
          console.log('[ScanDetails] reverseGeocode (manual coords) success', { label });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[ScanDetails] reverseGeocode (manual coords) failed', { message });
      }
    }

    try {
      await updateEntry(entry.id, {
        notes: notesDraft,
        locationName: nextLocationName,
        location,
      });
      Alert.alert('Saved', 'Your notes were saved to this scan.');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] save failed', { message });
      Alert.alert('Could not save', 'Please try again.');
    }
  }, [entry, latDraft, lngDraft, locationNameDraft, notesDraft, updateEntry]);

  const onUseCurrentLocation = useCallback(async () => {
    if (!entry) return;

    if (Platform.OS === 'web') {
      Alert.alert('Not supported on web', 'Please enter coordinates manually when using the web preview.');
      return;
    }

    const buildLocationLabel = (address: LocationType.LocationGeocodedAddress | null | undefined) => {
      const parts: string[] = [];

      const name = typeof address?.name === 'string' ? address.name : '';
      const street = typeof address?.street === 'string' ? address.street : '';
      const city = typeof address?.city === 'string' ? address.city : '';
      const district = typeof address?.district === 'string' ? address.district : '';
      const region = typeof address?.region === 'string' ? address.region : '';
      const country = typeof address?.country === 'string' ? address.country : '';

      const firstLine = name || street;
      const locality = city || district;

      if (firstLine) parts.push(firstLine);
      if (locality) parts.push(locality);
      if (region) parts.push(region);

      const label = parts.filter((p) => p.trim().length > 0).join(', ').trim();
      if (label.length > 0) return label;

      if (country) return country;

      return '';
    };

    try {
      const Location = await loadExpoLocation();
      if (!Location) {
        Alert.alert('Location unavailable', 'Location services are not available in this environment.');
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to fetch your current location.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setLatDraft(String(lat));
      setLngDraft(String(lng));

      let nextLocationName: string | undefined = undefined;
      try {
        const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const label = buildLocationLabel(Array.isArray(addresses) ? addresses[0] : undefined);
        if (label.length > 0) {
          nextLocationName = label;
          setLocationNameDraft(label);
        }
        console.log('[ScanDetails] reverseGeocode success', { label });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[ScanDetails] reverseGeocode failed', { message });
      }

      updateEntry(entry.id, {
        location: {
          latitude: lat,
          longitude: lng,
        },
        locationName: nextLocationName,
      }).catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[ScanDetails] updateEntry(location) failed', { message });
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] getCurrentPosition failed', { message });
      Alert.alert('Could not fetch location', 'Please try again or enter it manually.');
    }
  }, [entry, updateEntry]);

  const onDelete = useCallback(() => {
    if (!entry) return;
    Alert.alert('Remove scan?', 'This will remove it from your collection.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeEntry(entry.id)
            .then(() => {
              router.back();
            })
            .catch((e) => {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[ScanDetails] removeEntry failed', { message });
              Alert.alert('Could not remove', 'Please try again.');
            });
        },
      },
    ]);
  }, [entry, removeEntry]);

  const chatHistory = useMemo((): ScanJournalChatMessage[] => {
    const ch = entry?.chatHistory;
    return Array.isArray(ch) ? ch : [];
  }, [entry?.chatHistory]);

  const systemPrompt = useMemo(() => {
    if (!entry) return '';
    const s = entry.scan;
    const lines: string[] = [
      `You are "Tucka Guide", a friendly and knowledgeable Australian bush food companion.`,
      `The user has scanned a plant/item. Here is everything known about it:`,
      `Common Name: ${s.commonName}`,
      s.scientificName ? `Scientific Name: ${s.scientificName}` : '',
      `Confidence: ${Math.round(s.confidence * 100)}%`,
      `Safety Status: ${s.safety.status}`,
      `Safety Summary: ${s.safety.summary}`,
      s.safety.keyRisks.length > 0 ? `Key Risks: ${s.safety.keyRisks.join('; ')}` : '',
      s.categories.length > 0 ? `Categories: ${s.categories.join(', ')}` : '',
      `Bush Tucker Likely: ${s.bushTuckerLikely ? 'Yes' : 'No'}`,
      `Preparation Ease: ${s.preparation.ease}`,
      s.preparation.steps.length > 0 ? `Preparation Steps: ${s.preparation.steps.join('; ')}` : '',
      s.seasonality.bestMonths.length > 0 ? `Best Months: ${s.seasonality.bestMonths.join(', ')}` : '',
      s.seasonality.notes ? `Seasonality Notes: ${s.seasonality.notes}` : '',
      s.culturalKnowledge.notes ? `Cultural Notes: ${s.culturalKnowledge.notes}` : '',
      s.culturalKnowledge.respect.length > 0 ? `Cultural Respect: ${s.culturalKnowledge.respect.join('; ')}` : '',
      s.warnings.length > 0 ? `Warnings: ${s.warnings.join('; ')}` : '',
      s.suggestedUses.length > 0 ? `Suggested Uses: ${s.suggestedUses.join('; ')}` : '',
      '',
      'Answer the user\'s questions about this item using the information above and your general knowledge.',
      'Be helpful, specific, and safety-conscious. If you are unsure, say so.',
      'Keep answers concise but thorough. Use plain language.',
    ];
    return lines.filter(l => l.length > 0).join('\n');
  }, [entry]);

  const { messages: agentMessages, sendMessage, error: agentError } = useRorkAgent({ tools: {} });

  const [chatInput, setChatInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [savedConvoToCook, setSavedConvoToCook] = useState<boolean>(false);

  const visibleMessages = useMemo(() => {
    return agentMessages.filter(m => m.role !== 'system');
  }, [agentMessages]);

  const messageCountRef = useRef<number>(0);

  const handleSendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (text.length === 0 || isSending) return;
    console.log('[TuckaGuide] sending message', { text });
    setChatInput('');
    setIsSending(true);
    try {
      const isFirstMessage = messageCountRef.current === 0;
      let fullMessage: string;
      if (isFirstMessage && systemPrompt) {
        fullMessage = `[SYS_CTX_START]You are "Tucka Guide", a friendly Australian bush food AI companion. The user scanned a plant. Reference info is below. USE it to answer, but NEVER restate or summarize the identification back to the user. CRITICAL RULES: 1. DIRECTLY answer the user's question. Do NOT repeat plant name, confidence, safety status, or identification details. 2. If the user asks for a recipe, give them an actual recipe with ingredients and steps. 3. If the user asks about seasonality, give specific seasonal info. 4. Be conversational, helpful, and specific. Treat this like a knowledgeable friend answering a question. 5. NEVER start your response with the plant identification or safety summary. REFERENCE DATA (use but do not repeat): ${systemPrompt}[SYS_CTX_END] ${text}`;
      } else {
        fullMessage = text;
      }
      messageCountRef.current += 1;
      console.log('[TuckaGuide] sending with context, user text:', text);
      sendMessage(fullMessage);
      console.log('[TuckaGuide] message sent successfully');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[TuckaGuide] sendMessage failed', { message });
    } finally {
      setIsSending(false);
    }
  }, [chatInput, isSending, sendMessage, systemPrompt]);

  const buildConversationText = useCallback((): string => {
    if (!entry) return '';
    const filtered = visibleMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    const lines: string[] = [
      `Tucka Guide — ${entry.scan.commonName}`,
      entry.scan.scientificName ? `(${entry.scan.scientificName})` : '',
      '',
    ].filter(l => l !== undefined);
    filtered.forEach(m => {
      const textParts = m.parts?.filter((p: { type: string }) => p.type === 'text') ?? [];
      let text = textParts.map((p: { type: string; text?: string }) => p.text ?? '').join('');
      if (m.role === 'user') {
        const sysCtxEndMarker = '[SYS_CTX_END]';
        const sysCtxEndIdx = text.indexOf(sysCtxEndMarker);
        if (sysCtxEndIdx !== -1) text = text.substring(sysCtxEndIdx + sysCtxEndMarker.length).trim();
        const sysCtxStart = text.indexOf('[SYS_CTX_START]');
        if (sysCtxStart !== -1) {
          const sysCtxEnd2 = text.indexOf(sysCtxEndMarker, sysCtxStart);
          if (sysCtxEnd2 !== -1) text = text.substring(sysCtxEnd2 + sysCtxEndMarker.length).trim();
          else text = text.substring(0, sysCtxStart).trim();
        }
      }
      lines.push(`${m.role === 'user' ? 'You' : 'Tucka Guide'}:`);
      lines.push(text);
      lines.push('');
    });
    lines.push('—');
    lines.push('Always verify locally before consuming.');
    return lines.join('\n');
  }, [entry, visibleMessages]);

  const buildConversationPdfHtml = useCallback((): string => {
    if (!entry) return '';
    const filtered = visibleMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (filtered.length === 0) return '';
    const common = escHtml(entry.scan.commonName);
    const scientific = entry.scan.scientificName ? escHtml(entry.scan.scientificName) : '';
    const messagesHtml = filtered.map(m => {
      const textParts = m.parts?.filter((p: { type: string }) => p.type === 'text') ?? [];
      let text = textParts.map((p: { type: string; text?: string }) => p.text ?? '').join('');
      if (m.role === 'user') {
        const sysCtxEndMarker = '[SYS_CTX_END]';
        const sysCtxEndIdx = text.indexOf(sysCtxEndMarker);
        if (sysCtxEndIdx !== -1) text = text.substring(sysCtxEndIdx + sysCtxEndMarker.length).trim();
        const sysCtxStart = text.indexOf('[SYS_CTX_START]');
        if (sysCtxStart !== -1) {
          const sysCtxEnd2 = text.indexOf(sysCtxEndMarker, sysCtxStart);
          if (sysCtxEnd2 !== -1) text = text.substring(sysCtxEnd2 + sysCtxEndMarker.length).trim();
          else text = text.substring(0, sysCtxStart).trim();
        }
      }
      const isUser = m.role === 'user';
      const bgColor = isUser ? 'rgba(127,227,168,0.12)' : 'rgba(245,246,244,0.70)';
      const borderColor = isUser ? 'rgba(127,227,168,0.28)' : 'rgba(15,36,24,0.10)';
      const roleLabel = isUser ? 'You' : 'Tucka Guide';
      const roleColor = isUser ? '#38D989' : '#0c1411';
      const htmlText = isUser ? escHtml(text) : markdownToHtml(text);
      return `<div class="msg" style="background:${bgColor};border-color:${borderColor}">
        <div class="role" style="color:${roleColor}">${roleLabel}</div>
        <div class="text">${htmlText}</div>
      </div>`;
    }).join('');
    return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Tucka Guide</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;margin:0;color:#0c1411;background:#f5f6f4}
.page{padding:22px 18px 28px}.card{background:#fff;border-radius:18px;overflow:hidden;border:1px solid rgba(15,36,24,0.10);box-shadow:0 14px 30px rgba(12,20,17,0.10)}
.header{padding:18px 16px;border-bottom:1px solid rgba(15,36,24,0.10)}
.header h1{font-size:20px;font-weight:800;margin:0 0 4px}.header p{font-size:13px;color:rgba(12,20,17,0.60);margin:0}
.messages{padding:16px}
.msg{padding:12px;border-radius:14px;border:1px solid;margin-bottom:12px}
.role{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px}
.text{font-size:14px;line-height:1.5}
.footer{padding:14px 16px;border-top:1px dashed rgba(15,36,24,0.18);font-size:12px;color:rgba(12,20,17,0.55)}
</style></head><body>
<div class="page"><div class="card">
<div class="header"><h1>Tucka Guide</h1><p>${scientific ? `${common} (${scientific})` : common}</p></div>
<div class="messages">${messagesHtml}</div>
<div class="footer">Always verify locally before consuming.</div>
</div></div></body></html>`;
  }, [entry, visibleMessages]);

  const exportConversationPdf = useCallback(async () => {
    if (!entry) return;
    const html = buildConversationPdfHtml();
    if (!html) {
      console.log('[TuckaGuide] exportConversationPdf: empty html, nothing to export');
      Alert.alert('Nothing to export', 'Start a conversation first.');
      return;
    }
    try {
      console.log('[TuckaGuide] exportConversationPdf start', { entryId: entry.id, platform: Platform.OS, htmlLen: html.length });
      const print = await loadExpoPrint();
      if (!print) {
        console.log('[TuckaGuide] expo-print module not available, falling back to share text');
        await Share.share({ message: buildConversationText(), title: `Tucka Guide — ${entry.scan.commonName}` });
        return;
      }
      if (Platform.OS === 'web') {
        try {
          const result = await print.printToFileAsync({ html });
          if (typeof document !== 'undefined') {
            const resp = await fetch(result.uri);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `tucka-guide-chat-${entry.id}.pdf`; a.rel = 'noopener'; a.target = '_blank';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            return;
          }
        } catch (webErr) {
          console.log('[TuckaGuide] exportConversationPdf web printToFile failed, trying printAsync', webErr instanceof Error ? webErr.message : String(webErr));
        }
        try {
          await print.printAsync({ html });
        } catch (printErr) {
          console.log('[TuckaGuide] exportConversationPdf web printAsync also failed', printErr instanceof Error ? printErr.message : String(printErr));
          await Share.share({ message: buildConversationText(), title: `Tucka Guide — ${entry.scan.commonName}` });
        }
        return;
      }
      let fileUri: string | null = null;
      try {
        const result = await print.printToFileAsync({ html });
        fileUri = result.uri;
        console.log('[TuckaGuide] exportConversationPdf file created', { uri: fileUri });
      } catch (fileErr) {
        console.log('[TuckaGuide] printToFileAsync failed, trying printAsync fallback', fileErr instanceof Error ? fileErr.message : String(fileErr));
        try {
          await print.printAsync({ html });
          return;
        } catch (printErr) {
          console.log('[TuckaGuide] printAsync also failed', printErr instanceof Error ? printErr.message : String(printErr));
          await Share.share({ message: buildConversationText(), title: `Tucka Guide — ${entry.scan.commonName}` });
          return;
        }
      }
      if (fileUri) {
        const sharing = await loadExpoSharing();
        const canShare = (await sharing?.isAvailableAsync()) ?? false;
        if (canShare) {
          await sharing?.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save / Share Conversation PDF', UTI: 'com.adobe.pdf' });
          return;
        }
      }
      await Share.share({ message: buildConversationText(), title: `Tucka Guide — ${entry.scan.commonName}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[TuckaGuide] exportConversationPdf failed completely', { msg });
      try {
        await Share.share({ message: buildConversationText(), title: `Tucka Guide — ${entry.scan.commonName}` });
      } catch {
        Alert.alert('Could not export', msg || 'Please try again.');
      }
    }
  }, [buildConversationPdfHtml, buildConversationText, entry]);

  const shareConversationText = useCallback(async () => {
    if (!entry) return;
    const text = buildConversationText();
    if (!text) return;
    try {
      console.log('[TuckaGuide] shareConversationText', { entryId: entry.id });
      await Share.share({ message: text, title: `Tucka Guide — ${entry.scan.commonName}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[TuckaGuide] shareConversationText failed', { msg });
      Alert.alert('Share not available', text);
    }
  }, [buildConversationText, entry]);

  const persistedCountRef = useRef<number>(0);
  useEffect(() => {
    if (!entry) return;
    const filtered = visibleMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (filtered.length === 0 || filtered.length === persistedCountRef.current) return;
    persistedCountRef.current = filtered.length;
    const newHistory: ScanJournalChatMessage[] = filtered
      .map((m) => {
        const textParts = m.parts?.filter((p: { type: string }) => p.type === 'text') ?? [];
        let text = textParts.map((p: { type: string; text?: string }) => p.text ?? '').join('');
        if (m.role === 'user') {
          const sysCtxEndMarker = '[SYS_CTX_END]';
          const sysCtxEndIdx = text.indexOf(sysCtxEndMarker);
          if (sysCtxEndIdx !== -1) {
            text = text.substring(sysCtxEndIdx + sysCtxEndMarker.length).trim();
          }
          const endMarker = '[END OF SYSTEM INSTRUCTIONS]';
          const endIdx = text.indexOf(endMarker);
          if (endIdx !== -1) {
            text = text.substring(endIdx + endMarker.length).trim();
          }
          const sysMarker = '[SYSTEM INSTRUCTIONS';
          const sysStart = text.indexOf(sysMarker);
          if (sysStart !== -1) {
            const endSys = text.indexOf(endMarker, sysStart);
            if (endSys !== -1) {
              text = text.substring(endSys + endMarker.length).trim();
            } else {
              text = text.substring(0, sysStart).trim();
            }
          }
          const sysCtxStart = text.indexOf('[SYS_CTX_START]');
          if (sysCtxStart !== -1) {
            const sysCtxEnd2 = text.indexOf(sysCtxEndMarker, sysCtxStart);
            if (sysCtxEnd2 !== -1) {
              text = text.substring(sysCtxEnd2 + sysCtxEndMarker.length).trim();
            } else {
              text = text.substring(0, sysCtxStart).trim();
            }
          }
          const markers = ['USER QUESTION: ', 'User question: '];
          for (const marker of markers) {
            const idx = text.lastIndexOf(marker);
            if (idx !== -1) {
              text = text.substring(idx + marker.length);
              break;
            }
          }
        }
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          text,
          createdAt: Date.now(),
        };
      })
      .filter(m => m.text.trim().length > 0);
    if (newHistory.length > 0) {
      updateEntry(entry.id, { chatHistory: newHistory }).catch((e) => {
        console.log('[TuckaGuide] persist chat failed', e instanceof Error ? e.message : String(e));
      });
    }
  }, [entry, visibleMessages, updateEntry]);

  if (!entry) {
    return (
      <View style={styles.container} testID="scan-details-missing">
        <Stack.Screen options={{ title: 'Scan Details', headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              testID="scan-details-back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Scan Details</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>Scan not found</Text>
            <Text style={styles.missingText}>This scan might have been deleted or is still loading.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()} testID="scan-details-go-back">
              <Text style={styles.primaryButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="scan-details">
      <Stack.Screen options={{ title: 'Scan Details', headerShown: false }} />
      <View style={styles.heroBg} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="scan-details-back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {entry.title}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => void exportPdf()} testID="scan-details-export-pdf">
              <Download size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onShare} testID="scan-details-share">
              <Share2 size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.trashButton} onPress={onDelete} testID="scan-details-delete">
              <Trash2 size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="scan-details-scroll">
          <View style={styles.heroCard}>
            <Image
              source={{
                uri:
                  entryDisplayImageUri ??
                  'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=1200&auto=format&fit=crop',
              }}
              style={styles.heroImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={180}
              testID="scan-details-image"
              onError={(e) => {
                console.log('[ScanDetails] hero image load error', {
                  entryId: entry.id,
                  uri: entryDisplayImageUri,
                  error: (e as unknown as { error?: string })?.error,
                });
              }}
            />
            <View style={styles.heroOverlay}>
              <View style={styles.badgeRow}>
                <Pill text={`Safety: ${displaySafetyStatus.toUpperCase()}`} tone={safetyTone} />
                <Pill text={confidenceGate.title} tone={confidenceGate.tone} />
              </View>
              <View style={styles.heroTitleRow}>
                <View style={styles.heroTitleStack}>
                  <Text style={styles.heroTitle}>{entry.scan.commonName}</Text>
                  {entry.scan.scientificName ? <Text style={styles.heroSubtitle}>{entry.scan.scientificName}</Text> : null}
                </View>
                <View style={styles.heroIcon}>
                  {entry.scan.safety.status === 'caution' ? (
                    <ShieldAlert size={22} color={COLORS.warning} />
                  ) : (
                    <Sparkles size={22} color={COLORS.primary} />
                  )}
                </View>
              </View>
              {createdLabel ? <Text style={styles.heroMeta}>{createdLabel}</Text> : null}
            </View>
          </View>



          <View style={styles.tabsWrap} testID="scan-details-tabs">
            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'guide' ? styles.tabPillActive : null]}
              onPress={() => setActiveTab('guide')}
              testID="scan-details-tab-guide"
            >
              <Text style={[styles.tabPillText, activeTab === 'guide' ? styles.tabPillTextActive : null]}>Tucka Guide</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'details' ? styles.tabPillActive : null]}
              onPress={() => setActiveTab('details')}
              testID="scan-details-tab-details"
            >
              <Text style={[styles.tabPillText, activeTab === 'details' ? styles.tabPillTextActive : null]}>Details</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'guide' ? (
            <>
              <View style={styles.guideHeaderCard} testID="scan-details-guide-header">
                <View style={styles.guideHeaderTop}>
                  <View style={styles.guideHeaderLeft}>
                    <Text style={styles.guideKicker}>Overview</Text>
                    <Text style={styles.guideHeadline} numberOfLines={2}>
                      {confidenceGate.level === 'confident' ? entry.scan.safety.summary || 'No safety summary available.' : confidenceGate.blurb}
                    </Text>
                  </View>
                  <View style={styles.guideHeaderRight}>
                    <Text style={styles.guideConfidenceLabel}>Confidence</Text>
                    <Text style={styles.guideConfidenceValue}>{Math.round((entry?.scan?.confidence ?? 0) * 100)}%</Text>
                    <Text style={styles.guideConfidenceHint}>{confidenceGate.title}</Text>
                  </View>
                </View>

                <View style={styles.guideChipRow}>
                  <View style={styles.guideChip}>
                    <Text style={styles.guideChipLabel}>Safety</Text>
                    <Text style={[styles.guideChipValue, { color: safetyTone === 'good' ? COLORS.status : COLORS.warning }]}>
                      {displaySafetyStatus.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.guideChip}>
                    <Text style={styles.guideChipLabel}>Category</Text>
                    <Text style={styles.guideChipValue} numberOfLines={1}>
                      {(entry.scan.categories[0] ?? 'Unknown').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.guideChip}>
                    <Text style={styles.guideChipLabel}>Season</Text>
                    <Text style={styles.guideChipValue} numberOfLines={1}>
                      {entry.scan.seasonality.bestMonths.length > 0 ? entry.scan.seasonality.bestMonths[0].toUpperCase() : 'ALL'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.guideStatsRow} testID="scan-details-guide-stats">
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Easy to prepare</Text>
                  <Text style={styles.statValue}>
                    {(confidenceGate.level === 'confident' ? entry.scan.preparation.ease : 'unknown').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Seasonality</Text>
                  <Text style={styles.statValue}>
                    {entry.scan.seasonality.bestMonths.length > 0 ? 'SEASONAL' : 'ALL YEAR'}
                  </Text>
                </View>
              </View>

              <View style={styles.insightsHeader}>
                <Text style={styles.insightsTitle}>Insights</Text>
              </View>

              <View style={styles.insightCard} testID="scan-details-guide-prep">
                <View style={styles.insightHeaderRow}>
                  <CookingPot size={18} color={COLORS.secondary} />
                  <Text style={styles.insightHeaderText}>Preparation</Text>
                </View>
                {confidenceGate.level === 'confident' ? (
                  entry.scan.preparation.steps.length > 0 ? (
                    <View style={styles.bullets}>
                      {entry.scan.preparation.steps.map((step, idx) => (
                        <View key={`${step}-${idx}`} style={styles.bulletRow}>
                          <Text style={styles.stepIndex}>{idx + 1}</Text>
                          <Text style={styles.bulletText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.bodyText}>No preparation steps provided.</Text>
                  )
                ) : (
                  <Text style={styles.bodyText}>Available when confidence is 80%+.</Text>
                )}
              </View>

              <View style={styles.insightCard} testID="scan-details-guide-seasonality">
                <View style={styles.insightHeaderRow}>
                  <Sparkles size={18} color={COLORS.primary} />
                  <Text style={styles.insightHeaderText}>Seasonality</Text>
                </View>
                {entry.scan.seasonality.bestMonths.length > 0 ? (
                  <View style={styles.pillRow}>
                    {entry.scan.seasonality.bestMonths.map((m) => (
                      <Pill key={m} text={m} tone="neutral" />
                    ))}
                  </View>
                ) : null}
                {entry.scan.seasonality.notes ? <Text style={[styles.bodyText, { marginTop: 10 }]}>{entry.scan.seasonality.notes}</Text> : null}
                {!entry.scan.seasonality.notes && entry.scan.seasonality.bestMonths.length === 0 ? (
                  <Text style={styles.bodyText}>No seasonality info provided.</Text>
                ) : null}
              </View>

              {entry.scan.warnings.length > 0 ? (
                <View style={styles.insightCard} testID="scan-details-guide-warnings">
                  <View style={styles.insightHeaderRow}>
                    <ShieldAlert size={18} color={COLORS.warning} />
                    <Text style={styles.insightHeaderText}>Warnings / lookalikes</Text>
                  </View>
                  <View style={styles.bullets}>
                    {entry.scan.warnings.map((w, idx) => (
                      <View key={`${w}-${idx}`} style={styles.bulletRow}>
                        <AlertIcon />
                        <Text style={styles.bulletText}>{w}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.insightCard} testID="scan-details-guide-uses">
                <View style={styles.insightHeaderRow}>
                  <Sparkles size={18} color={COLORS.secondary} />
                  <Text style={styles.insightHeaderText}>Suggested uses</Text>
                </View>
                {confidenceGate.level === 'confident' && entry.scan.suggestedUses.length > 0 ? (
                  <View style={styles.bullets}>
                    {entry.scan.suggestedUses.map((u, idx) => (
                      <View key={`${u}-${idx}`} style={styles.bulletRow}>
                        <Sparkles size={16} color={COLORS.secondary} />
                        <Text style={styles.bulletText}>{u}</Text>
                      </View>
                    ))}
                  </View>
                ) : confidenceGate.level === 'confident' ? (
                  <Text style={styles.bodyText}>No suggested uses provided.</Text>
                ) : (
                  <View style={styles.lockedCard} testID="scan-details-suggested-uses-locked">
                    <View style={styles.lockedHeader}>
                      <CookingPot size={16} color={COLORS.textSecondary} />
                      <Text style={styles.lockedTitle}>Learning mode only</Text>
                    </View>
                    <Text style={styles.lockedText}>Cooking suggestions unlock with higher confidence.</Text>
                  </View>
                )}
              </View>

              <View style={styles.insightCard} testID="scan-details-guide-culture">
                <View style={styles.insightHeaderRow}>
                  <Sparkles size={18} color={COLORS.primary} />
                  <Text style={styles.insightHeaderText}>Cultural knowledge</Text>
                </View>
                <Text style={styles.bodyText} testID="scan-details-cultural-notes">
                  {refineCulturalNotes(entry.scan.culturalKnowledge.notes) || 'No cultural notes provided.'}
                </Text>
                {entry.scan.culturalKnowledge.respect.length > 0 ? (
                  <View style={[styles.bullets, { marginTop: 10 }]}>
                    {entry.scan.culturalKnowledge.respect.map((r, idx) => (
                      <View key={`${r}-${idx}`} style={styles.bulletRow}>
                        <Sparkles size={16} color={COLORS.primary} />
                        <Text style={styles.bulletText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.culturalFooter} testID="cultural-footer">
                  {CULTURAL_FOOTER}
                </Text>
              </View>

              <View style={styles.chatSection} testID="tucka-guide-chat">
                <View style={styles.insightHeaderRow}>
                  <MessageCircle size={18} color={COLORS.action} />
                  <Text style={styles.insightHeaderText}>Ask Tucka Guide</Text>
                </View>

                {visibleMessages.length > 0 ? (
                  <View style={styles.chatMessagesWrap}>
                    {visibleMessages.map((m) => {
                      const textParts = m.parts?.filter((p: { type: string }) => p.type === 'text') ?? [];
                      let text = textParts.map((p: { type: string; text?: string }) => p.text ?? '').join('');
                      if (!text.trim()) return null;
                      const isUser = m.role === 'user';
                      if (isUser) {
                        const sysCtxEndMarker = '[SYS_CTX_END]';
                        const sysCtxEndIdx = text.indexOf(sysCtxEndMarker);
                        if (sysCtxEndIdx !== -1) {
                          text = text.substring(sysCtxEndIdx + sysCtxEndMarker.length).trim();
                        }
                        const endMarker = '[END OF SYSTEM INSTRUCTIONS]';
                        const endIdx = text.indexOf(endMarker);
                        if (endIdx !== -1) {
                          text = text.substring(endIdx + endMarker.length).trim();
                        }
                        const sysMarker = '[SYSTEM INSTRUCTIONS';
                        const sysStart = text.indexOf(sysMarker);
                        if (sysStart !== -1) {
                          const endSys = text.indexOf(endMarker, sysStart);
                          if (endSys !== -1) {
                            text = text.substring(endSys + endMarker.length).trim();
                          } else {
                            text = text.substring(0, sysStart).trim();
                          }
                        }
                        const sysCtxStart = text.indexOf('[SYS_CTX_START]');
                        if (sysCtxStart !== -1) {
                          const sysCtxEnd2 = text.indexOf(sysCtxEndMarker, sysCtxStart);
                          if (sysCtxEnd2 !== -1) {
                            text = text.substring(sysCtxEnd2 + sysCtxEndMarker.length).trim();
                          } else {
                            text = text.substring(0, sysCtxStart).trim();
                          }
                        }
                        const markers = ['USER QUESTION: ', 'User question: '];
                        for (const marker of markers) {
                          const idx = text.lastIndexOf(marker);
                          if (idx !== -1) {
                            text = text.substring(idx + marker.length);
                            break;
                          }
                        }
                      }
                      return (
                        <View
                          key={m.id}
                          style={[styles.chatMsg, isUser ? styles.chatMsgUser : styles.chatMsgAssistant]}
                        >
                          <Text style={styles.chatMsgRole}>{isUser ? 'You' : 'Tucka Guide'}</Text>
                          <Text style={styles.chatMsgText}>{text}</Text>
                        </View>
                      );
                    })}
                    {isSending ? (
                      <View style={[styles.chatMsg, styles.chatMsgAssistant]}>
                        <Text style={styles.chatMsgRole}>Tucka Guide</Text>
                        <Text style={[styles.chatMsgText, { opacity: 0.5 }]}>Thinking...</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={[styles.bodyText, { marginBottom: 12, opacity: 0.7 }]}>
                    Ask anything about this {entry.scan.commonName} — preparation, safety, uses, seasonality, or anything else.
                  </Text>
                )}

                {agentError ? (
                  <Text style={{ color: COLORS.error, fontSize: 13, marginBottom: 8 }}>
                    Error: {agentError.message ?? 'Could not get a response. Try again.'}
                  </Text>
                ) : null}

                {visibleMessages.filter(m => m.role === 'user' || m.role === 'assistant').length >= 2 ? (
                  <View style={styles.chatActionsRow} testID="tucka-guide-chat-actions">
                    <TouchableOpacity
                      style={[styles.chatActionBtn, savedConvoToCook && styles.chatActionBtnDone]}
                      onPress={() => {
                        if (savedConvoToCook || !entry) return;
                        const filtered = visibleMessages.filter(m => m.role === 'user' || m.role === 'assistant');
                        const textParts = filtered.map(m => {
                          const parts = m.parts?.filter((p: { type: string }) => p.type === 'text') ?? [];
                          let text = parts.map((p: { type: string; text?: string }) => p.text ?? '').join('');
                          if (m.role === 'user') {
                            const sysCtxEndMarker = '[SYS_CTX_END]';
                            const sysCtxEndIdx = text.indexOf(sysCtxEndMarker);
                            if (sysCtxEndIdx !== -1) text = text.substring(sysCtxEndIdx + sysCtxEndMarker.length).trim();
                            const sysCtxStart = text.indexOf('[SYS_CTX_START]');
                            if (sysCtxStart !== -1) {
                              const sysCtxEnd2 = text.indexOf(sysCtxEndMarker, sysCtxStart);
                              if (sysCtxEnd2 !== -1) text = text.substring(sysCtxEnd2 + sysCtxEndMarker.length).trim();
                              else text = text.substring(0, sysCtxStart).trim();
                            }
                          }
                          return `${m.role === 'user' ? 'You' : 'Tucka Guide'}: ${text}`;
                        }).join('\n\n');
                        const firstQuestion = filtered.find(m => m.role === 'user');
                        const firstQuestionParts = firstQuestion?.parts?.filter((p: { type: string }) => p.type === 'text') ?? [];
                        let titleText = firstQuestionParts.map((p: { type: string; text?: string }) => p.text ?? '').join('');
                        const sysEnd = titleText.indexOf('[SYS_CTX_END]');
                        if (sysEnd !== -1) titleText = titleText.substring(sysEnd + '[SYS_CTX_END]'.length).trim();
                        const sysStart = titleText.indexOf('[SYS_CTX_START]');
                        if (sysStart !== -1) titleText = titleText.substring(0, sysStart).trim();
                        const title = titleText.length > 60 ? titleText.substring(0, 57) + '...' : (titleText || 'Tucka Guide Chat');
                        saveGuideEntry({
                          title,
                          guideText: textParts,
                          commonName: entry.scan.commonName,
                          scientificName: entry.scan.scientificName,
                          imageUri: entry.imageUri ?? entry.imagePreviewUri,
                          confidence: entry.scan.confidence,
                          safetyStatus: entry.scan.safety.status as 'safe' | 'caution' | 'unknown',
                          scanEntryId: entry.id,
                          suggestedUses: entry.scan.suggestedUses,
                        }).then(() => {
                          setSavedConvoToCook(true);
                          console.log('[TuckaGuide] conversation saved to Cook');
                        }).catch(e => {
                          const msg = e instanceof Error ? e.message : String(e);
                          console.log('[TuckaGuide] save to cook failed', { msg });
                          Alert.alert('Could not save', 'Please try again.');
                        });
                      }}
                      disabled={savedConvoToCook}
                      testID="tucka-guide-save-convo"
                    >
                      {savedConvoToCook ? <Check size={16} color={COLORS.status} /> : <BookmarkPlus size={16} color={COLORS.text} />}
                      <Text style={[styles.chatActionText, savedConvoToCook && styles.chatActionTextDone]}>
                        {savedConvoToCook ? 'Saved' : 'Save to Cook'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chatActionBtn}
                      onPress={() => void exportConversationPdf()}
                      testID="tucka-guide-export-pdf"
                    >
                      <FileDown size={16} color={COLORS.text} />
                      <Text style={styles.chatActionText}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chatActionBtn}
                      onPress={() => void shareConversationText()}
                      testID="tucka-guide-share-convo"
                    >
                      <Share2 size={16} color={COLORS.text} />
                      <Text style={styles.chatActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

              </View>
            </>
          ) : (
            <>
              <Section title="Edit title">
                <TextInput
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  placeholder="e.g. Backyard find"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.fieldInputSolo}
                  testID="scan-details-edit-title"
                />
                <TouchableOpacity style={styles.primaryButton} onPress={onSaveTitle} testID="scan-details-save-title">
                  <Text style={styles.primaryButtonText}>Save title</Text>
                </TouchableOpacity>
              </Section>

              <Section title="Chat history">
                {chatHistory.length === 0 ? (
                  <Text style={styles.bodyText}>No chat history saved for this scan yet.</Text>
                ) : (
                  <View style={styles.chatList}>
                    {chatHistory.map((m) => (
                      <View
                        key={m.id}
                        style={[styles.chatBubble, m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant]}
                        testID={`scan-details-chat-${m.role}-${m.id}`}
                      >
                        <Text style={styles.chatRole}>{m.role === 'user' ? 'You' : 'Companion'}</Text>
                        <Text style={styles.chatText}>{m.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Section>

              <Section title="Your notes">
                <TextInput
                  value={notesDraft}
                  onChangeText={setNotesDraft}
                  placeholder="Add notes (taste, smell, ID tips, who confirmed it, etc.)"
                  placeholderTextColor={COLORS.textSecondary}
                  style={styles.textArea}
                  multiline
                  testID="scan-details-notes"
                />
                <TouchableOpacity style={styles.primaryButton} onPress={onSave} testID="scan-details-save">
                  <Text style={styles.primaryButtonText}>Save notes</Text>
                </TouchableOpacity>
              </Section>

              <Section title="Location">
                <View style={styles.fieldRow}>
                  <MapPin size={16} color={COLORS.primary} />
                  <TextInput
                    value={locationNameDraft}
                    onChangeText={setLocationNameDraft}
                    placeholder="Location name (optional)"
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.fieldInput}
                    testID="scan-details-location-name"
                  />
                </View>

                <View style={styles.coordRow}>
                  <View style={styles.coordField}>
                    <Text style={styles.coordLabel}>Lat</Text>
                    <TextInput
                      value={latDraft}
                      onChangeText={setLatDraft}
                      placeholder="-27.47"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                      style={styles.coordInput}
                      testID="scan-details-lat"
                    />
                  </View>
                  <View style={styles.coordField}>
                    <Text style={styles.coordLabel}>Lng</Text>
                    <TextInput
                      value={lngDraft}
                      onChangeText={setLngDraft}
                      placeholder="153.02"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                      style={styles.coordInput}
                      testID="scan-details-lng"
                    />
                  </View>
                </View>

                <View style={styles.locationButtons}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={onUseCurrentLocation} testID="scan-details-use-location">
                    <Navigation size={16} color={COLORS.text} />
                    <Text style={styles.secondaryButtonText}>Use current</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButtonCompact} onPress={onSave} testID="scan-details-save-location">
                    <Text style={styles.primaryButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </Section>
            </>
          )}

          <View style={{ height: activeTab === 'guide' ? 100 : 40 }} />
        </ScrollView>

        {activeTab === 'guide' ? (
          <View style={[styles.floatingChatBar, { paddingBottom: Math.max(bottomInsets.bottom, 10) }]} testID="tucka-guide-floating-input">
            <View style={styles.floatingChatInner}>
              <TextInput
                style={styles.floatingChatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask Tucka Guide..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                testID="tucka-guide-input"
              />
              <TouchableOpacity
                style={[styles.floatingChatSendBtn, (chatInput.trim().length === 0 || isSending) ? styles.chatSendBtnDisabled : null]}
                onPress={handleSendMessage}
                disabled={chatInput.trim().length === 0 || isSending}
                testID="tucka-guide-send"
              >
                <Send size={18} color={chatInput.trim().length > 0 && !isSending ? '#06120B' : COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function AlertIcon() {
  return (
    <View style={styles.alertIconWrap}>
      <ShieldAlert size={16} color={COLORS.warning} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    zIndex: 4,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.55,
    borderColor: 'rgba(155,179,164,0.18)',
  },
  trashButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  heroCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 18,
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  heroOverlay: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleStack: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(7,17,11,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11,25,17,0.62)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.22)',
    borderRadius: 999,
    padding: 6,
    marginBottom: 14,
  },
  tabPill: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: COLORS.action,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: COLORS.textSecondary,
  },
  tabPillTextActive: {
    color: '#06120B',
  },

  guideHeaderCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.20)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 8,
    marginBottom: 14,
  },
  guideHeaderTop: {
    flexDirection: 'row',
    gap: 14,
  },
  guideHeaderLeft: {
    flex: 1,
  },
  guideHeaderRight: {
    width: 110,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(7,17,11,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideKicker: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  guideHeadline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  guideConfidenceLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  guideConfidenceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  guideConfidenceHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  guideChipRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  guideChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(155,179,164,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.22)',
  },
  guideChipLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  guideChipValue: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.2,
  },

  guideStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.20)',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.2,
  },

  insightsHeader: {
    paddingHorizontal: 2,
    marginTop: 10,
    marginBottom: 10,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  insightCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.20)',
    marginBottom: 14,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  insightHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  sectionGroup: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.20)',
  },
  sectionBody: {},
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  bullets: {
    marginTop: 10,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  culturalFooter: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    color: 'rgba(234,246,238,0.55)',
  },
  gateCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,92,92,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.35)',
  },
  gateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  gateTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  gateText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  gateMeta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  lockedCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(155,179,164,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155,179,164,0.22)',
    opacity: 0.92,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  lockedTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textSecondary,
    letterSpacing: -0.2,
  },
  lockedText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 10,
    backgroundColor: COLORS.statusSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.statusBorder,
    textAlign: 'center',
    color: COLORS.status,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chatList: {
    gap: 10,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatBubbleUser: {
    backgroundColor: COLORS.statusSoft,
    borderColor: COLORS.statusBorder,
  },
  chatBubbleAssistant: {
    backgroundColor: 'rgba(155,179,164,0.08)',
    borderColor: 'rgba(155,179,164,0.22)',
  },
  chatRole: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  chatText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  chatSection: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.20)',
    marginBottom: 14,
    marginTop: 6,
  },
  chatMessagesWrap: {
    gap: 10,
    marginBottom: 14,
  },
  chatMsg: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatMsgUser: {
    backgroundColor: COLORS.statusSoft,
    borderColor: COLORS.statusBorder,
    alignSelf: 'flex-end' as const,
    maxWidth: '85%' as unknown as number,
  },
  chatMsgAssistant: {
    backgroundColor: 'rgba(155,179,164,0.08)',
    borderColor: 'rgba(155,179,164,0.22)',
    alignSelf: 'flex-start' as const,
    maxWidth: '92%' as unknown as number,
  },
  chatMsgRole: {
    fontSize: 11,
    fontWeight: '900' as const,
    color: COLORS.secondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  chatMsgText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  chatInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 10,
  },
  chatInputField: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.action,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chatSendBtnDisabled: {
    backgroundColor: 'rgba(155,179,164,0.12)',
  },
  floatingChatBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,18,11,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(56,217,137,0.28)',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  floatingChatInner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 10,
  },
  floatingChatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(56,217,137,0.40)',
    backgroundColor: 'rgba(20,48,34,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  floatingChatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.action,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chatActionsRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 14,
    marginTop: 4,
  },
  chatActionBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
  },
  chatActionBtnDone: {
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderColor: 'rgba(56,217,137,0.35)',
  },
  chatActionText: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  chatActionTextDone: {
    color: COLORS.status,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    padding: 14,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonCompact: {
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.action,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#06120B',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  quickActionsRow: {
    marginTop: 12,
    marginBottom: 8,
  },
  quickCookButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.action,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  quickCookButtonDisabled: {
    opacity: 0.6,
  },
  quickCookButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#06120B',
    letterSpacing: 0.2,
  },
  locationButtons: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInputSolo: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  coordField: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  coordInput: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  alertIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  missingCard: {
    marginTop: 24,
    marginHorizontal: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 8,
  },
  missingText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  HelpCircle,
  Image as ImageIcon,
  RefreshCcw,
  Scan,
} from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createScanEntryId,
  useScanJournal,
  type GeminiScanResult as JournalGeminiScanResult,
} from '@/app/providers/ScanJournalProvider';

import type {
  GeminiScanResult,
  GeminiApiResponse,
  GeminiListModelsResponse,
  ScanImage,
  ScanPhase,
} from './helpers/types';
import {
  getLegacyFileSystem,
  getExpoImageManipulator,
} from './helpers/lazyModules';
import {
  getGeminiText,
  parseGeminiResult,
} from './helpers/scanUtils';
import { styles, DARK } from './helpers/styles';

export default function HomeScreen() {
  const { addEntry } = useScanJournal();
  const currentEntryIdRef = useRef<string | null>(null);

  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const primaryImage = scanImages.length > 0 ? scanImages[0] : null;
  const primaryImageDisplayUri = primaryImage?.previewUri ?? primaryImage?.uri ?? null;

  const [mode, setMode] = useState<'identify' | 'identify360'>('identify');

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [_scanResult, setScanResult] = useState<GeminiScanResult | null>(null);
  const [_scanError, setScanError] = useState<string | null>(null);

  const geminiApiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();

  const canScan = useMemo(() => {
    return scanImages.length > 0 && Boolean(geminiApiKey);
  }, [geminiApiKey, scanImages.length]);

  const analyzeWithGemini = useCallback(
    async (imagesOverride?: ScanImage[]): Promise<void> => {
      const imagesToUse = Array.isArray(imagesOverride) ? imagesOverride : scanImages;
      const primaryToUse = imagesToUse.length > 0 ? imagesToUse[0] : null;
      console.log('[Scan] analyzeWithGemini start', { imageCount: imagesToUse.length, mode });

      setScanPhase('preparing');
      setScanError(null);
      setScanResult(null);

      if (!geminiApiKey) { setScanError('Gemini API key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY.'); return; }
      if (imagesToUse.length === 0) { setScanError('No image data found. Please upload or take a photo again.'); return; }
      const expectedCount = mode === 'identify360' ? 3 : 1;
      if (mode === 'identify360' && imagesToUse.length < expectedCount) {
        setScanError('360 Identify needs 3 angles. Please take a front, side, and close-up shot.');
        return;
      }

      setAnalyzing(true);

      const prompt = `You are an expert Australian bush tucker identification assistant. Use the photo(s) to identify the MOST LIKELY plant/food item and provide practical, safety-first guidance.

If there are multiple photos, treat them as different angles of THE SAME specimen.

Rules:
- Respond ONLY as strict JSON (no markdown, no backticks).
- If you are not highly confident, set bushTuckerLikely=false and safety.status='uncertain'.
- When uncertain, DO NOT encourage eating. Emphasize verification with a local Indigenous guide / botanist.
- When sharing cultural knowledge, avoid pan-Indigenous generalisations. Use precise language like "Some species have been traditionally used…" and add "Knowledge and use vary by region and community."
- Consider toxic lookalikes and common hazards (sap/latex, spines, fungi, berries, allergic reactions).
- If the photos show multiple species or are too blurry/dark, reduce confidence and set safety.status='uncertain'.
- Keep language concise, friendly, and Australia-specific.

Return JSON with keys:
- commonName: string (use "Unconfirmed Plant" if unsure)
- scientificName: string or null
- confidence: number (0..1)
- safety: { status: 'safe'|'caution'|'unknown', summary: string, keyRisks: string[] }
- categories: string[] (e.g. ['fruit','leaf','seed','medicinal','bush tucker'])
- bushTuckerLikely: boolean
- preparation: { ease: 'easy'|'medium'|'hard'|'unknown', steps: string[] }
- seasonality: { bestMonths: string[] (e.g. ['Sep','Oct']), notes: string }
- culturalKnowledge: { notes: string, respect: string[] }
- warnings: string[]
- suggestedUses: string[]`;

      const imageParts = imagesToUse.map((img) => ({
        inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.base64 },
      }));

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts.map(({ inlineData }) => ({ inlineData }))] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 700 },
      };

      const normalizeModelName = (name: string) => {
        const trimmed = name.trim();
        return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;
      };

      const listModels = async (apiVersion: 'v1' | 'v1beta'): Promise<string[]> => {
        const ep = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(geminiApiKey)}`;
        setScanPhase('listing-models');
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = setTimeout(() => { try { controller?.abort(); } catch { /* noop */ } }, 25000);
        let res: Response;
        let json: GeminiListModelsResponse;
        try { res = await fetch(ep, { method: 'GET', signal: controller?.signal }); json = (await res.json()) as GeminiListModelsResponse; } finally { clearTimeout(timeoutId); }
        if (!res.ok) throw new Error(json?.error?.message ?? 'Could not list Gemini models.');
        const eligible = (json.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'));
        return eligible.map((m) => normalizeModelName(String(m.name ?? ''))).filter(Boolean);
      };

      const buildCandidates = async (): Promise<{ apiVersion: 'v1' | 'v1beta'; model: string }[]> => {
        try {
          const [v1Models, v1betaModels] = await Promise.all([
            listModels('v1').catch(() => [] as string[]),
            listModels('v1beta').catch(() => [] as string[]),
          ]);
          const preferOrder = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-1.5-pro-latest'];
          const sortByPreference = (a: string, b: string) => {
            const ai = preferOrder.findIndex((p) => a === p);
            const bi = preferOrder.findIndex((p) => b === p);
            const av = ai === -1 ? 999 : ai;
            const bv = bi === -1 ? 999 : bi;
            if (av !== bv) return av - bv;
            return a.localeCompare(b);
          };
          const fromV1 = [...new Set(v1Models)].sort(sortByPreference).map((model) => ({ apiVersion: 'v1' as const, model }));
          const fromV1beta = [...new Set(v1betaModels)].sort(sortByPreference).map((model) => ({ apiVersion: 'v1beta' as const, model }));
          const combined = [...fromV1, ...fromV1beta];
          if (combined.length > 0) return combined;
        } catch (e) {
          console.log('[Scan] buildCandidates error', { message: e instanceof Error ? e.message : String(e) });
        }
        return [
          { apiVersion: 'v1', model: 'gemini-1.5-flash' }, { apiVersion: 'v1', model: 'gemini-1.5-flash-latest' },
          { apiVersion: 'v1', model: 'gemini-1.5-pro' }, { apiVersion: 'v1beta', model: 'gemini-1.5-flash' },
          { apiVersion: 'v1beta', model: 'gemini-1.5-flash-latest' }, { apiVersion: 'v1beta', model: 'gemini-1.5-pro' },
        ];
      };

      const candidates = await buildCandidates();

      const postOnce = async (apiVersion: 'v1' | 'v1beta', modelName: string): Promise<GeminiApiResponse> => {
        const ep = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
        setScanPhase('sending');
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = setTimeout(() => { try { controller?.abort(); } catch { /* noop */ } }, 30000);
        let res: Response;
        let json: GeminiApiResponse;
        try {
          res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller?.signal });
          json = (await res.json()) as GeminiApiResponse;
        } finally { clearTimeout(timeoutId); }
        if (!res.ok) throw new Error(json?.error?.message ?? 'Gemini request failed.');
        return json;
      };

      try {
        let lastError: string | null = null;
        for (const c of candidates) {
          try {
            const json = await postOnce(c.apiVersion, c.model);
            const text = getGeminiText(json);
            if (json?.promptFeedback?.blockReason) throw new Error(`Gemini blocked the response: ${json.promptFeedback.blockReason}`);
            if (!text) throw new Error('Gemini returned an empty response.');
            setScanPhase('parsing');
            let parsed: GeminiScanResult;
            try { parsed = parseGeminiResult(text); } catch (parseError) {
              const message = parseError instanceof Error ? parseError.message : String(parseError);
              throw new Error(`Could not parse Gemini response as JSON. ${message}`);
            }
            setScanResult(parsed);

            try {
              const entryId = createScanEntryId({
                commonName: parsed.commonName, scientificName: parsed.scientificName,
                confidence: parsed.confidence, imageBase64: primaryToUse?.base64 ?? null, imageUri: primaryToUse?.uri ?? null,
              });
              setScanPhase('saving');

              let persistedImageUri: string | undefined = primaryToUse?.uri ?? undefined;
              let previewImageUri: string | undefined = primaryToUse?.previewUri ?? undefined;
              const base64 = primaryToUse?.base64;
              const mimeType = primaryToUse?.mimeType;

              try {
                if (Platform.OS === 'web') {
                  const maxDataUriLength = 650_000;
                  const makeDataUri = (mt: string, data: string) => `data:${mt};base64,${data}`;
                  const trySmaller = async (targetWidth: number, compress: number): Promise<string | null> => {
                    const ImageManipulator = await getExpoImageManipulator();
                    if (!ImageManipulator) return null;
                    const manipResult = await ImageManipulator.manipulateAsync(primaryToUse?.uri ?? '', [{ resize: { width: targetWidth } }], { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true });
                    if (typeof manipResult.base64 === 'string' && manipResult.base64.length > 0) return manipResult.base64;
                    return null;
                  };

                  if (typeof base64 === 'string' && base64.length > 0) {
                    let chosenBase64: string | null = base64;
                    try { const reduced = await trySmaller(900, 0.6); if (reduced) chosenBase64 = reduced; } catch { /* noop */ }
                    if (chosenBase64 && chosenBase64.length > maxDataUriLength) {
                      for (const candidate of [{ width: 640, compress: 0.52 }, { width: 420, compress: 0.45 }]) {
                        try { const reduced = await trySmaller(candidate.width, candidate.compress); if (reduced) chosenBase64 = reduced; if (chosenBase64 && chosenBase64.length <= maxDataUriLength) break; } catch { /* noop */ }
                      }
                    }
                    if (chosenBase64 && chosenBase64.length <= maxDataUriLength) {
                      persistedImageUri = makeDataUri('image/jpeg', chosenBase64);
                      previewImageUri = persistedImageUri;
                    } else { persistedImageUri = undefined; previewImageUri = undefined; }
                  }
                } else {
                  const fs = await getLegacyFileSystem();
                  const rawDocDirUri = fs?.documentDirectory ?? fs?.cacheDirectory ?? null;
                  const docDirUri = rawDocDirUri ? (rawDocDirUri.endsWith('/') ? rawDocDirUri : `${rawDocDirUri}/`) : null;

                  if (docDirUri && fs) {
                    const scanDirUri = `${docDirUri}scan-journal/`;
                    try { await fs.makeDirectoryAsync(scanDirUri, { intermediates: true }); } catch { /* noop */ }
                    const safeFileStem = entryId.replace(/[^a-z0-9-_]+/gi, '-');
                    const dest = `${scanDirUri}${safeFileStem}.jpg`;
                    const from = primaryToUse?.uri ?? '';
                    const fromScheme = from.split(':')[0];

                    const attemptTranscodeToJpeg = async () => {
                      const ImageManipulator = await getExpoImageManipulator();
                      if (!ImageManipulator) throw new Error('ImageManipulator unavailable');
                      const manipResult = await ImageManipulator.manipulateAsync(from, [{ resize: { width: 1400 } }], { compress: 0.86, format: ImageManipulator.SaveFormat.JPEG });
                      await fs.copyAsync({ from: manipResult.uri, to: dest });
                      persistedImageUri = dest;
                    };

                    try {
                      await attemptTranscodeToJpeg();
                    } catch {
                      const canCopyDirectly = fromScheme === 'file' || fromScheme === 'content';
                      if (canCopyDirectly) {
                        try { await fs.copyAsync({ from, to: dest }); persistedImageUri = dest; } catch {
                          if (typeof base64 === 'string' && base64.length > 0) {
                            try { await fs.writeAsStringAsync(dest, base64, { encoding: fs.EncodingType.Base64 }); persistedImageUri = dest; } catch { persistedImageUri = primaryToUse?.uri ?? undefined; }
                          } else { persistedImageUri = primaryToUse?.uri ?? undefined; }
                        }
                      } else if (typeof base64 === 'string' && base64.length > 0) {
                        try { await fs.writeAsStringAsync(dest, base64, { encoding: fs.EncodingType.Base64 }); persistedImageUri = dest; } catch { persistedImageUri = primaryToUse?.uri ?? undefined; }
                      } else { persistedImageUri = primaryToUse?.uri ?? undefined; }
                    }
                  }

                  if ((!previewImageUri || previewImageUri.length === 0) && typeof base64 === 'string' && base64.length > 0) {
                    try {
                      const ImageManipulator = await getExpoImageManipulator();
                      if (!ImageManipulator) throw new Error('ImageManipulator unavailable');
                      const manipPreview = await ImageManipulator.manipulateAsync(primaryToUse?.uri ?? '', [{ resize: { width: 900 } }], { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true });
                      const outBase64 = typeof manipPreview.base64 === 'string' && manipPreview.base64.length > 0 ? manipPreview.base64 : base64;
                      previewImageUri = `data:image/jpeg;base64,${outBase64}`;
                    } catch { previewImageUri = `data:${typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'};base64,${base64}`; }
                  }

                  if (typeof persistedImageUri === 'string' && persistedImageUri.startsWith('/')) persistedImageUri = `file://${persistedImageUri}`;
                  if (typeof persistedImageUri === 'string' && persistedImageUri.startsWith('file:/') && !persistedImageUri.startsWith('file://')) {
                    persistedImageUri = `file:///${persistedImageUri.replace(/^file:\/*/i, '')}`;
                  }
                  const scheme = (persistedImageUri ?? '').split(':')[0];
                  if ((scheme === 'ph' || scheme === 'assets-library' || scheme === 'content') && typeof base64 === 'string' && base64.length > 0) {
                    const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                    persistedImageUri = `data:${mt};base64,${base64}`;
                  }
                  if (typeof persistedImageUri === 'string' && persistedImageUri.startsWith('file://')) {
                    try {
                      const fsCheck = await getLegacyFileSystem();
                      if (fsCheck) {
                        const info = await fsCheck.getInfoAsync(persistedImageUri);
                        if (!info.exists && typeof base64 === 'string' && base64.length > 0) {
                          const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                          persistedImageUri = `data:${mt};base64,${base64}`;
                        }
                      }
                    } catch { /* noop */ }
                  }
                }
              } catch { persistedImageUri = undefined; previewImageUri = undefined; }

              const savedEntry = await addEntry({
                id: entryId,
                title: parsed.commonName?.trim().length ? parsed.commonName : 'Unconfirmed Plant',
                imageUri: persistedImageUri,
                imagePreviewUri: previewImageUri,
                chatHistory: [],
                scan: parsed as unknown as JournalGeminiScanResult,
              });

              currentEntryIdRef.current = savedEntry.id;
              setScanPhase('done');
              router.push(`/scan/${encodeURIComponent(savedEntry.id)}`);
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[Scan] saving scan to journal failed', { message });
              setScanPhase('error');
              setScanError('Could not save this scan to your Collection. Please try again.');
              Alert.alert('Save failed', 'Could not save this scan to your Collection. Please try again.');
            }

            if (parsed.safety.status !== 'safe' && parsed.warnings.length === 0) {
              setScanError('Could not confidently confirm this is safe to eat. Please verify with a trusted local guide.');
            }
            return;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            lastError = message;
            if (/not found/i.test(message) || /is not supported/i.test(message) || /unsupported/i.test(message)) continue;
            throw e;
          }
        }
        throw new Error(lastError ?? 'Gemini request failed for all supported models.');
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error while scanning.';
        console.log('[Scan] analyzeWithGemini error', { message });
        setScanPhase('error');
        setScanError(message);
        Alert.alert('Scan failed', message);
      } finally { setAnalyzing(false); }
    }, [addEntry, geminiApiKey, mode, scanImages]);

  const collectImages = useCallback(
    async (source: 'camera' | 'library'): Promise<ScanImage[] | null> => {
      const count = mode === 'identify360' ? 3 : 1;
      if (source === 'camera' && Platform.OS === 'web') {
        Alert.alert('Unavailable', 'Camera capture is not available in the web preview. Please use Select photo, or open the app on your phone via the QR code.');
        return null;
      }
      if (source === 'library') {
        if (Platform.OS !== 'web') {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed', 'Sorry, we need photo library permissions to make this work!'); return null; }
        }
      } else {
        if (Platform.OS !== 'web') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!'); return null; }
        }
      }

      const next: ScanImage[] = [];
      for (let i = 0; i < count; i += 1) {
        if (count > 1) {
          const stepLabel = i === 0 ? 'front view' : i === 1 ? 'side view' : 'close-up (leaf/fruit)';
          Alert.alert(`360 Identify · ${i + 1} / ${count}`, `Capture a ${stepLabel}. Keep the plant sharp and fill the frame.`, [{ text: 'OK' }]);
        }
        const allowsEditing = Platform.OS !== 'ios';
        const result = source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing, aspect: [4, 3], quality: 0.92, base64: true, exif: false })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing, aspect: [4, 3], quality: 0.92, base64: true, exif: false, selectionLimit: 1 });
        if (result.canceled) return null;
        const asset = result.assets?.[0];
        const uri = asset?.uri;
        if (!uri) return null;
        const mt = typeof asset?.mimeType === 'string' && asset.mimeType.length > 0 ? asset.mimeType : undefined;
        const base64Clean = typeof asset?.base64 === 'string' && asset.base64.length > 0 ? asset.base64 : undefined;
        const previewUri = base64Clean ? `data:${mt ?? 'image/jpeg'};base64,${base64Clean}` : undefined;
        next.push({ uri, base64: base64Clean, mimeType: mt, previewUri });
      }
      return next;
    },
    [mode],
  );

  const pickImage = useCallback(async () => {
    const imgs = await collectImages('library');
    if (!imgs) { setScanError(mode === 'identify360' ? '360 Identify cancelled. Try again and capture all 3 angles.' : null); return; }
    setScanImages(imgs); setScanResult(null); setScanError(null);
    await analyzeWithGemini(imgs);
  }, [analyzeWithGemini, collectImages, mode]);

  const takePhoto = useCallback(async () => {
    const imgs = await collectImages('camera');
    if (!imgs) { setScanError(mode === 'identify360' ? '360 Identify cancelled. Try again and capture all 3 angles.' : null); return; }
    setScanImages(imgs); setScanResult(null); setScanError(null);
    await analyzeWithGemini(imgs);
  }, [analyzeWithGemini, collectImages, mode]);

  const onPressRescan = useCallback(() => {
    if (!canScan) { Alert.alert('Cannot scan', 'Please upload or take a new photo first.'); return; }
    void analyzeWithGemini(scanImages);
  }, [analyzeWithGemini, canScan, scanImages]);

  const shutterScale = useRef<Animated.Value>(new Animated.Value(1)).current;

  const pressShutter = useCallback(
    async (action: 'camera' | 'library') => {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); } catch { /* noop */ }
      Animated.sequence([
        Animated.timing(shutterScale, { toValue: 0.94, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(shutterScale, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      if (action === 'camera') await takePhoto(); else await pickImage();
    },
    [pickImage, shutterScale, takePhoto],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.scanStage} testID="scan-stage">
            <LinearGradient
              colors={[DARK.bg, '#0B150F', '#09110C']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.scanStageBg}
            >
              <View style={styles.scanStageTopBar}>
                <View style={styles.scanStageTitleWrap}>
                  <Text style={styles.scanStageTitle}>Identify</Text>
                  <Text style={styles.scanStageSubtitle}>Place the plant in focus</Text>
                </View>
                <View style={styles.scanStageTopActions}>
                  <TouchableOpacity style={styles.topIconButton} onPress={() => Alert.alert('Snap tips', 'For best results: fill the frame, avoid multiple species, and keep it sharp. If unsure, take 2–3 angles.')} testID="scan-help-button">
                    <HelpCircle size={18} color={DARK.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.topIconButton} onPress={onPressRescan} disabled={analyzing} testID="scan-refresh-button">
                    <RefreshCcw size={18} color={DARK.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.focusArea}>
                {primaryImage?.uri ? (
                  <Image source={{ uri: primaryImageDisplayUri ?? primaryImage.uri }} style={styles.focusImage} contentFit="cover" transition={120} cachePolicy="memory-disk" testID="scan-primary-image" />
                ) : (
                  <View style={styles.focusPlaceholder}>
                    <Scan size={70} color="rgba(255,255,255,0.18)" />
                  </View>
                )}
                <View style={styles.focusFrame} pointerEvents="none">
                  <View style={[styles.focusCorner, styles.focusCornerTL]} />
                  <View style={[styles.focusCorner, styles.focusCornerTR]} />
                  <View style={[styles.focusCorner, styles.focusCornerBL]} />
                  <View style={[styles.focusCorner, styles.focusCornerBR]} />
                </View>
                {analyzing ? (
                  <View style={styles.scanBusyPill} testID="scan-analyzing-badge">
                    <View style={styles.scanBusyDot} />
                    <Text style={styles.scanBusyText}>{scanPhase === 'sending' ? 'Starting…' : scanPhase === 'listing-models' ? 'Preparing…' : scanPhase === 'parsing' ? 'Reading…' : scanPhase === 'saving' ? 'Saving…' : 'Scanning…'}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.bottomTray}>
                <View style={styles.modeRow}>
                  <TouchableOpacity style={[styles.modePill, mode === 'identify' ? styles.modePillActive : null]} onPress={() => setMode('identify')} testID="scan-mode-identify">
                    <Text style={[styles.modeText, mode === 'identify' ? styles.modeTextActive : null]}>Identify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modePill, mode === 'identify360' ? styles.modePillActive : null]} onPress={() => setMode('identify360')} testID="scan-mode-360">
                    <Text style={[styles.modeText, mode === 'identify360' ? styles.modeTextActive : null]}>360 Identify</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.controlsRow}>
                  <TouchableOpacity style={styles.smallAction} onPress={() => pressShutter('library')} disabled={analyzing} testID="scan-library-button">
                    <ImageIcon size={22} color={DARK.text} />
                  </TouchableOpacity>
                  <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
                    <TouchableOpacity style={styles.shutterOuter} onPress={() => pressShutter('camera')} disabled={analyzing} testID="scan-shutter-button">
                      <View style={styles.shutterInner} />
                    </TouchableOpacity>
                  </Animated.View>
                  <TouchableOpacity style={styles.smallAction} onPress={() => Alert.alert('Quick warning', 'Only consume after verification. Many native plants have toxic lookalikes.')} testID="scan-warning-button">
                    <AlertTriangle size={22} color={DARK.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Handy Pocket Guides</Text>
              <TouchableOpacity style={styles.seeAllButton} onPress={() => Alert.alert('Coming soon', 'More Handy Pocket Guides are being added.')} testID="pocket-guides-see-all">
                <Text style={styles.seeAllText}>See All</Text>
                <ArrowRight size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidesScroll}>
              <TouchableOpacity style={[styles.guideCard, styles.guideCardBrand]} onPress={() => router.push('/pocket-guides/cultural-respect-on-country')} testID="pocket-guide-card-cultural-respect">
                <View style={styles.guideIconBrand}>
                  <Image source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/r5y6q5zltfpde776ienrb' }} style={styles.guideIconArt} contentFit="contain" cachePolicy="memory-disk" transition={140} testID="pocket-guide-icon-cultural-respect" />
                </View>
                <Text style={[styles.guideTitle, styles.guideTitleDark]} numberOfLines={2}>Cultural respect{'\n'}On Country</Text>
                <Text style={[styles.guideCount, styles.guideCountDark]}>Pocket guide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.guideCard, styles.guideCardBrand]} onPress={() => router.push('/pocket-guides/animal-care-and-share')} testID="pocket-guide-card-animal-care">
                <View style={styles.guideIconBrand}>
                  <Image source={{ uri: 'https://r2-pub.rork.com/generated-images/fe0dfa28-4dd0-4574-b256-a3bc44b69f81.png' }} style={styles.guideIconArt} contentFit="contain" cachePolicy="memory-disk" transition={140} testID="pocket-guide-icon-animal-care" />
                </View>
                <Text style={[styles.guideTitle, styles.guideTitleDark]} numberOfLines={2}>Animal Care{'\n'}& Share</Text>
                <Text style={[styles.guideCount, styles.guideCountDark]}>Pocket guide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.guideCard, styles.guideCardBrand]} onPress={() => router.push('/pocket-guides/foraging-with-kids')} testID="pocket-guide-card-foraging-kids">
                <View style={styles.guideIconBrand}>
                  <Image source={{ uri: 'https://r2-pub.rork.com/generated-images/50835e04-6a03-4f4c-87c8-eee59a6447ce.png' }} style={styles.guideIconArt} contentFit="contain" cachePolicy="memory-disk" transition={140} testID="pocket-guide-icon-foraging-kids" />
                </View>
                <Text style={[styles.guideTitle, styles.guideTitleDark]} numberOfLines={2}>Foraging{'\n'}With Kids</Text>
                <Text style={[styles.guideCount, styles.guideCountDark]}>Pocket guide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.guideCard, styles.guideCardBrand]} onPress={() => router.push('/pocket-guides/if-something-goes-wrong')} testID="pocket-guide-card-if-something-wrong">
                <View style={styles.guideIconBrand}>
                  <Image source={{ uri: 'https://r2-pub.rork.com/generated-images/c97fe2cf-35fc-456c-b184-b1e64301acb7.png' }} style={styles.guideIconArt} contentFit="contain" cachePolicy="memory-disk" transition={140} testID="pocket-guide-icon-if-something-wrong" />
                </View>
                <Text style={[styles.guideTitle, styles.guideTitleDark]} numberOfLines={2}>If Something{'\n'}Goes Wrong</Text>
                <Text style={[styles.guideCount, styles.guideCountDark]}>Pocket guide</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Collection</Text>
            <View style={styles.collectionList}>
              <TouchableOpacity style={styles.collectionCard}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop' }} style={styles.collectionImage} />
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionName}>Wattleseed</Text>
                  <Text style={styles.collectionDate}>Today, 10:23 AM</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}><Text style={styles.tagText}>Seed</Text></View>
                    <View style={styles.tag}><Text style={styles.tagText}>Edible</Text></View>
                  </View>
                </View>
                <ChevronRight size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.collectionCard}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop' }} style={styles.collectionImage} />
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionName}>Finger Lime</Text>
                  <Text style={styles.collectionDate}>Yesterday, 2:15 PM</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}><Text style={styles.tagText}>Fruit</Text></View>
                    <View style={styles.tag}><Text style={styles.tagText}>Medicinal</Text></View>
                  </View>
                </View>
                <ChevronRight size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

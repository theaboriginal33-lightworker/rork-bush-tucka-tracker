import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertTriangle,
  HelpCircle,
  Image as ImageIcon,
  RefreshCcw,
  Scan,
  Settings,
} from 'lucide-react-native';
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

// ─── Plant.id API helper ────────────────────────────────────────────────────
async function identifyWithPlantId(
  base64Image: string,
  mimeType: string,
  apiKey: string,
): Promise<{ scientificName: string | null; commonName: string | null; probability: number } | null> {
  if (!apiKey) return null;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => { try { controller?.abort(); } catch { /* noop */ } }, 20000);
    const body = JSON.stringify({
      images: [`data:${mimeType};base64,${base64Image}`],
      classification_level: 'species',
      similar_images: false,
    });
    let res: Response;
    try {
      res = await fetch('https://plant.id/api/v3/identification', {
        method: 'POST',
        headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
        body,
        signal: controller?.signal,
      });
    } finally { clearTimeout(timeoutId); }
    if (!res.ok) {
      console.log('[PlantId] request failed', { status: res.status });
      return null;
    }
    const json = await res.json() as {
      result?: {
        classification?: {
          suggestions?: Array<{
            name?: string;
            probability?: number;
            details?: { common_names?: string[] };
          }>;
        };
      };
    };
    const suggestions = json?.result?.classification?.suggestions ?? [];
    if (suggestions.length === 0) return null;
    const top = suggestions[0];
    return {
      scientificName: top.name ?? null,
      commonName: top.details?.common_names?.[0] ?? null,
      probability: typeof top.probability === 'number' ? top.probability : 0,
    };
  } catch (e) {
    console.log('[PlantId] error', { message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// ─── iNaturalist API helper ─────────────────────────────────────────────────
async function getINaturalistCount(scientificName: string): Promise<number> {
  if (!scientificName) return 0;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => { try { controller?.abort(); } catch { /* noop */ } }, 10000);
    const encoded = encodeURIComponent(scientificName);
    let res: Response;
    try {
      res = await fetch(
        `https://api.inaturalist.org/v1/observations?taxon_name=${encoded}&place_id=6744&per_page=1&order=desc&order_by=created_at`,
        { signal: controller?.signal },
      );
    } finally { clearTimeout(timeoutId); }
    if (!res.ok) return 0;
    const json = await res.json() as { total_results?: number };
    return json?.total_results ?? 0;
  } catch {
    return 0;
  }
}

// ─── Merge confidence from multiple sources ─────────────────────────────────
function mergeConfidence(
  geminiConfidence: number,
  plantIdResult: { scientificName: string | null; probability: number } | null,
  geminiScientificName: string | null | undefined,
): { mergedConfidence: number; verifiedBy: string[]; iNatCount: number } {
  const verifiedBy: string[] = ['Gemini AI'];
  let mergedConfidence = geminiConfidence;

  if (plantIdResult) {
    verifiedBy.push('Plant.id');
    const namesMatch =
      geminiScientificName &&
      plantIdResult.scientificName &&
      geminiScientificName.toLowerCase().split(' ')[0] ===
        plantIdResult.scientificName.toLowerCase().split(' ')[0];

    if (namesMatch) {
      // Both agree on genus — boost confidence
      mergedConfidence = Math.min(0.99, (geminiConfidence + plantIdResult.probability) / 2 + 0.08);
    } else {
      // Disagree — be more conservative
      mergedConfidence = Math.min(geminiConfidence, plantIdResult.probability) * 0.9;
    }
  }

  return { mergedConfidence, verifiedBy, iNatCount: 0 };
}

export default function HomeScreen() {
  const { addEntry } = useScanJournal();
  const currentEntryIdRef = useRef<string | null>(null);
  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const primaryImage = scanImages.length > 0 ? scanImages[0] : null;
  const primaryImageDisplayUri = primaryImage?.previewUri ?? primaryImage?.uri ?? null;
  const [mode, setMode] = useState<'identify' | 'identify360'>('identify');
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [_scanResult, setScanResult] = useState<GeminiScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const shutterScale = useRef(new Animated.Value(1)).current;

  const geminiApiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  const plantIdApiKey = (process.env.EXPO_PUBLIC_PLANT_ID_API_KEY ?? '').trim();

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

            // ── Triple-Verification: Run Plant.id + iNaturalist in parallel ──
            setScanPhase('sending');
            const primaryBase64 = primaryToUse?.base64 ?? '';
            const primaryMime = primaryToUse?.mimeType ?? 'image/jpeg';

            const [plantIdResult, iNatCount] = await Promise.all([
              plantIdApiKey && primaryBase64
                ? identifyWithPlantId(primaryBase64, primaryMime, plantIdApiKey)
                : Promise.resolve(null),
              parsed.scientificName
                ? getINaturalistCount(parsed.scientificName)
                : Promise.resolve(0),
            ]);

            // Merge confidence from all sources
            const { mergedConfidence, verifiedBy } = mergeConfidence(
              parsed.confidence,
              plantIdResult,
              parsed.scientificName,
            );

            // Build verification note for the scan result
            let verificationNote = '';
            if (verifiedBy.length > 1) {
              verificationNote = `Verified by ${verifiedBy.join(' + ')}`;
              if (plantIdResult?.scientificName) {
                const namesMatch =
                  parsed.scientificName &&
                  parsed.scientificName.toLowerCase().split(' ')[0] ===
                    plantIdResult.scientificName.toLowerCase().split(' ')[0];
                if (namesMatch) {
                  verificationNote += ` — both sources agree on ${plantIdResult.scientificName}`;
                } else {
                  verificationNote += ` — Plant.id suggests ${plantIdResult.scientificName} (${Math.round(plantIdResult.probability * 100)}%)`;
                }
              }
            }
            if (iNatCount > 0) {
              verificationNote += verificationNote
                ? `. ${iNatCount.toLocaleString()} community sightings in Australia (iNaturalist)`
                : `${iNatCount.toLocaleString()} community sightings in Australia (iNaturalist)`;
            }

            // Inject verification data into the parsed result
            const enrichedParsed: GeminiScanResult = {
              ...parsed,
              confidence: mergedConfidence,
              culturalKnowledge: {
                ...parsed.culturalKnowledge,
                notes: [
                  parsed.culturalKnowledge?.notes ?? '',
                  verificationNote,
                ].filter(Boolean).join('\n\n'),
              },
            };

            console.log('[Scan] triple-verification complete', {
              geminiConfidence: parsed.confidence,
              mergedConfidence,
              plantIdMatch: plantIdResult?.scientificName ?? 'none',
              iNatCount,
              verifiedBy,
            });

            setScanResult(enrichedParsed);
            try {
              const entryId = createScanEntryId({
                commonName: enrichedParsed.commonName, scientificName: enrichedParsed.scientificName,
                confidence: enrichedParsed.confidence, imageBase64: primaryToUse?.base64 ?? null, imageUri: primaryToUse?.uri ?? null,
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
                            const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                            persistedImageUri = `data:${mt};base64,${base64}`;
                          }
                        }
                      } else if (typeof base64 === 'string' && base64.length > 0) {
                        const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                        persistedImageUri = `data:${mt};base64,${base64}`;
                      }
                    }
                    try {
                      const ImageManipulator = await getExpoImageManipulator();
                      if (ImageManipulator && persistedImageUri && persistedImageUri.startsWith('file://')) {
                        const manipPreview = await ImageManipulator.manipulateAsync(persistedImageUri, [{ resize: { width: 400 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
                        const outBase64 = typeof manipPreview.base64 === 'string' && manipPreview.base64.length > 0 ? manipPreview.base64 : base64;
                        previewImageUri = `data:image/jpeg;base64,${outBase64}`;
                      } else if (typeof base64 === 'string' && base64.length > 0) {
                        previewImageUri = `data:${typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'};base64,${base64}`;
                      }
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
                title: enrichedParsed.commonName?.trim().length ? enrichedParsed.commonName : 'Unconfirmed Plant',
                imageUri: persistedImageUri,
                imagePreviewUri: previewImageUri,
                chatHistory: [],
                scan: enrichedParsed as unknown as JournalGeminiScanResult,
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
            if (enrichedParsed.safety.status !== 'safe' && enrichedParsed.warnings.length === 0) {
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
    }, [addEntry, geminiApiKey, plantIdApiKey, mode, scanImages]);

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
      const results: ScanImage[] = [];
      for (let i = 0; i < count; i++) {
        let result: ImagePicker.ImagePickerResult;
        if (source === 'library') {
          result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.92, base64: true });
        } else {
          result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.92, base64: true });
        }
        if (result.canceled) return null;
        const asset = result.assets[0];
        results.push({ uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: asset.mimeType ?? 'image/jpeg' });
      }
      setScanImages(results);
      return results;
    },
    [mode],
  );

  const pressShutter = useCallback(
    async (source: 'camera' | 'library'): Promise<void> => {
      Animated.sequence([
        Animated.timing(shutterScale, { toValue: 0.88, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(shutterScale, { toValue: 1, duration: 160, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
      ]).start();
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { /* noop */ }
      const imgs = await collectImages(source);
      if (!imgs) { setScanError(mode === 'identify360' ? '360 Identify cancelled. Try again and capture all 3 angles.' : null); return; }
      await analyzeWithGemini(imgs);
    },
    [analyzeWithGemini, collectImages, mode, shutterScale],
  );

  const onPressRescan = useCallback(async () => {
    setScanImages([]);
    setScanResult(null);
    setScanError(null);
    setScanPhase('idle');
    currentEntryIdRef.current = null;
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.scanStage}>
            <LinearGradient
              colors={['#0d1f0f', '#1a3a1c', '#0d2410']}
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
                  <TouchableOpacity style={styles.topIconButton} onPress={() => router.push('/settings')} testID="scan-settings-button">
                    <Settings size={18} color={DARK.text} />
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
                  <View style={styles.focusCornerWrap}>
                    <View style={[styles.focusCorner, styles.focusCornerTL]} />
                    <View style={[styles.focusCorner, styles.focusCornerTR]} />
                    <View style={[styles.focusCorner, styles.focusCornerBL]} />
                    <View style={[styles.focusCorner, styles.focusCornerBR]} />
                    <View style={styles.focusCenterCircle} />
                    <View style={[styles.focusCrossLineH, styles.focusCrossLineLeft]} />
                    <View style={[styles.focusCrossLineH, styles.focusCrossLineRight]} />
                  </View>
                </View>
                {analyzing ? (
                  <View style={styles.scanBusyPill} testID="scan-analyzing-badge">
                    <View style={styles.scanBusyDot} />
                    <Text style={styles.scanBusyText}>{scanPhase === 'sending' ? 'Verifying…' : scanPhase === 'listing-models' ? 'Preparing…' : scanPhase === 'parsing' ? 'Reading…' : scanPhase === 'saving' ? 'Saving…' : 'Scanning…'}</Text>
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
        </View>
      </SafeAreaView>
    </View>
  );
}

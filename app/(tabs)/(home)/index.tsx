import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  ChevronRight,
  HelpCircle,
  Image as ImageIcon,
  Leaf,
  RefreshCcw,
  Scan,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

type SafetyEdibility = {
  status: 'safe' | 'unsafe' | 'uncertain';
  summary: string;
  keyRisks: string[];
};

type Preparation = {
  ease: 'easy' | 'medium' | 'hard' | 'unknown';
  steps: string[];
};

type Seasonality = {
  bestMonths: string[];
  notes: string;
};

type CulturalKnowledge = {
  notes: string;
  respect: string[];
};

type GeminiScanResult = {
  commonName: string;
  scientificName?: string;
  confidence: number;

  bushTuckerLikely: boolean;
  safety: SafetyEdibility;
  preparation: Preparation;
  seasonality: Seasonality;
  culturalKnowledge: CulturalKnowledge;

  warnings: string[];
  suggestedUses: string[];
};

type GeminiApiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: { category?: string; probability?: string }[];
  };
  error?: { message?: string; status?: string };
};

type GeminiListModelsResponse = {
  models?: {
    name?: string;
    supportedGenerationMethods?: string[];
  }[];
  error?: { message?: string };
};

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<GeminiScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();

  const canScan = useMemo(() => {
    return Boolean(imageBase64) && Boolean(apiKey);
  }, [apiKey, imageBase64]);

  const getGeminiText = useCallback((json: GeminiApiResponse): string => {
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    return parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('\n')
      .trim();
  }, []);

  const extractJsonFromText = useCallback((rawText: string): unknown => {
    const text = rawText.trim();

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1]);
    }

    const firstCurly = text.indexOf('{');
    const lastCurly = text.lastIndexOf('}');
    if (firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly) {
      const candidate = text.slice(firstCurly, lastCurly + 1);
      return JSON.parse(candidate);
    }

    return JSON.parse(text);
  }, []);

  const parseGeminiResult = useCallback(
    (text: string): GeminiScanResult => {
      const parsed = extractJsonFromText(text) as {
        commonName?: unknown;
        scientificName?: unknown;
        confidence?: unknown;
        bushTuckerLikely?: unknown;
        safety?: {
          status?: unknown;
          summary?: unknown;
          keyRisks?: unknown;
        };
        preparation?: {
          ease?: unknown;
          steps?: unknown;
        };
        seasonality?: {
          bestMonths?: unknown;
          notes?: unknown;
        };
        culturalKnowledge?: {
          notes?: unknown;
          respect?: unknown;
        };
        warnings?: unknown;
        suggestedUses?: unknown;
      };

      const confidenceRaw = Number(parsed.confidence ?? 0);
      const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;

      const safetyStatusRaw = String(parsed.safety?.status ?? 'uncertain');
      const safetyStatus: SafetyEdibility['status'] =
        safetyStatusRaw === 'safe' || safetyStatusRaw === 'unsafe' || safetyStatusRaw === 'uncertain'
          ? safetyStatusRaw
          : 'uncertain';

      const prepEaseRaw = String(parsed.preparation?.ease ?? 'unknown');
      const prepEase: Preparation['ease'] =
        prepEaseRaw === 'easy' || prepEaseRaw === 'medium' || prepEaseRaw === 'hard' || prepEaseRaw === 'unknown'
          ? prepEaseRaw
          : 'unknown';

      const safeArray = (value: unknown, max: number): string[] => {
        if (!Array.isArray(value)) return [];
        return value.map((v) => String(v)).filter(Boolean).slice(0, max);
      };

      return {
        commonName: String(parsed.commonName ?? 'Unknown'),
        scientificName: parsed.scientificName ? String(parsed.scientificName) : undefined,
        confidence,

        bushTuckerLikely: Boolean(parsed.bushTuckerLikely ?? false),
        safety: {
          status: safetyStatus,
          summary: String(parsed.safety?.summary ?? ''),
          keyRisks: safeArray(parsed.safety?.keyRisks, 6),
        },
        preparation: {
          ease: prepEase,
          steps: safeArray(parsed.preparation?.steps, 8),
        },
        seasonality: {
          bestMonths: safeArray(parsed.seasonality?.bestMonths, 12),
          notes: String(parsed.seasonality?.notes ?? ''),
        },
        culturalKnowledge: {
          notes: String(parsed.culturalKnowledge?.notes ?? ''),
          respect: safeArray(parsed.culturalKnowledge?.respect, 6),
        },

        warnings: safeArray(parsed.warnings, 8),
        suggestedUses: safeArray(parsed.suggestedUses, 8),
      };
    },
    [extractJsonFromText],
  );

  const analyzeWithGemini = useCallback(async (): Promise<void> => {
    console.log('[Scan] analyzeWithGemini start', { hasImage: Boolean(image), hasBase64: Boolean(imageBase64) });

    setScanError(null);
    setScanResult(null);

    if (!apiKey) {
      setScanError('Gemini API key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY.');
      return;
    }

    console.log('[Scan] using gemini api key', { length: apiKey.length });

    if (!imageBase64) {
      setScanError('No image data found. Please upload or take a photo again.');
      return;
    }

    setAnalyzing(true);

    const prompt = `You are an expert Australian bush tucker identification assistant. Use the photo to identify the MOST LIKELY plant/food item and provide practical, safety-first guidance.

Rules:
- Respond ONLY as strict JSON (no markdown, no backticks).
- If you are not highly confident, set bushTuckerLikely=false and safety.status='uncertain'.
- When uncertain, DO NOT encourage eating. Emphasize verification with a local Indigenous guide / botanist.
- Consider toxic lookalikes and common hazards (sap/latex, spines, fungi, berries, allergic reactions).
- Keep language concise, friendly, and Australia-specific.

Return JSON with keys:
- commonName: string
- scientificName: string or null
- confidence: number (0..1)
- bushTuckerLikely: boolean
- safety: { status: 'safe'|'unsafe'|'uncertain', summary: string, keyRisks: string[] }
- preparation: { ease: 'easy'|'medium'|'hard'|'unknown', steps: string[] }
- seasonality: { bestMonths: string[] (e.g. ['Sep','Oct']), notes: string }
- culturalKnowledge: { notes: string, respect: string[] }
- warnings: string[]
- suggestedUses: string[]`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: imageMimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    };

    const normalizeModelName = (name: string) => {
      const trimmed = name.trim();
      return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;
    };

    const listModels = async (apiVersion: 'v1' | 'v1beta'): Promise<string[]> => {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
      console.log('[Scan] gemini listModels request', { apiVersion });

      const res = await fetch(endpoint, { method: 'GET' });
      const json = (await res.json()) as GeminiListModelsResponse;

      console.log('[Scan] gemini listModels response', {
        apiVersion,
        ok: res.ok,
        status: res.status,
        modelCount: json?.models?.length ?? 0,
        error: json?.error?.message,
      });

      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Could not list Gemini models.');
      }

      const eligible = (json.models ?? []).filter((m) => {
        const methods = m.supportedGenerationMethods ?? [];
        return methods.includes('generateContent');
      });

      return eligible
        .map((m) => normalizeModelName(String(m.name ?? '')))
        .filter((m) => Boolean(m));
    };

    const buildCandidates = async (): Promise<{ apiVersion: 'v1' | 'v1beta'; model: string }[]> => {
      try {
        const [v1Models, v1betaModels] = await Promise.all([
          listModels('v1').catch((e) => {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Scan] listModels v1 failed', { message });
            return [] as string[];
          }),
          listModels('v1beta').catch((e) => {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Scan] listModels v1beta failed', { message });
            return [] as string[];
          }),
        ]);

        const preferOrder = [
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-flash',
          'gemini-1.5-flash-latest',
          'gemini-1.5-pro',
          'gemini-1.5-pro-latest',
        ];

        const sortByPreference = (a: string, b: string) => {
          const ai = preferOrder.findIndex((p) => a === p);
          const bi = preferOrder.findIndex((p) => b === p);
          const av = ai === -1 ? 999 : ai;
          const bv = bi === -1 ? 999 : bi;
          if (av !== bv) return av - bv;
          return a.localeCompare(b);
        };

        const v1Sorted = [...new Set(v1Models)].sort(sortByPreference);
        const v1betaSorted = [...new Set(v1betaModels)].sort(sortByPreference);

        const fromV1 = v1Sorted.map((model) => ({ apiVersion: 'v1' as const, model }));
        const fromV1beta = v1betaSorted.map((model) => ({ apiVersion: 'v1beta' as const, model }));

        const combined = [...fromV1, ...fromV1beta];
        if (combined.length > 0) {
          console.log('[Scan] discovered gemini models', {
            v1: v1Sorted.slice(0, 10),
            v1beta: v1betaSorted.slice(0, 10),
          });
          return combined;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[Scan] buildCandidates error', { message });
      }

      return [
        { apiVersion: 'v1', model: 'gemini-1.5-flash' },
        { apiVersion: 'v1', model: 'gemini-1.5-flash-latest' },
        { apiVersion: 'v1', model: 'gemini-1.5-pro' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-flash-latest' },
        { apiVersion: 'v1beta', model: 'gemini-1.5-pro' },
      ];
    };

    const candidates = await buildCandidates();

    const postOnce = async (apiVersion: 'v1' | 'v1beta', model: string): Promise<GeminiApiResponse> => {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      console.log('[Scan] gemini request', { apiVersion, model });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as GeminiApiResponse;
      console.log('[Scan] gemini response', {
        apiVersion,
        model,
        ok: res.ok,
        status: res.status,
        error: json?.error?.message,
        hasCandidates: Boolean(json?.candidates?.length),
      });

      if (!res.ok) {
        const msg = json?.error?.message ?? 'Gemini request failed.';
        throw new Error(msg);
      }

      return json;
    };

    try {
      let lastError: string | null = null;

      for (const c of candidates) {
        try {
          const json = await postOnce(c.apiVersion, c.model);

          const text = getGeminiText(json);
          console.log('[Scan] gemini raw text (first 500 chars)', { text: text?.slice(0, 500) });

          if (json?.promptFeedback?.blockReason) {
            throw new Error(`Gemini blocked the response: ${json.promptFeedback.blockReason}`);
          }

          if (!text) {
            throw new Error('Gemini returned an empty response.');
          }

          let parsed: GeminiScanResult;
          try {
            parsed = parseGeminiResult(text);
          } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : String(parseError);
            console.log('[Scan] parseGeminiResult failed', { message });
            throw new Error(`Could not parse Gemini response as JSON. ${message}`);
          }

          setScanResult(parsed);

          if (parsed.safety.status !== 'safe' && parsed.warnings.length === 0) {
            setScanError('Could not confidently confirm this is safe to eat. Please verify with a trusted local guide.');
          }

          return;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          lastError = message;
          if (/not found/i.test(message) || /is not supported/i.test(message) || /unsupported/i.test(message)) {
            console.log('[Scan] gemini candidate failed, trying next', { message });
            continue;
          }
          throw e;
        }
      }

      throw new Error(lastError ?? 'Gemini request failed for all supported models.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error while scanning.';
      console.log('[Scan] analyzeWithGemini error', { message });
      setScanError(message);
      Alert.alert('Scan failed', message);
    } finally {
      setAnalyzing(false);
    }
  }, [apiKey, image, imageBase64, imageMimeType, getGeminiText, parseGeminiResult]);

  const pickImage = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageMimeType(asset.mimeType ?? 'image/jpeg');
      setScanResult(null);
      setScanError(null);
      if (asset.base64) {
        await analyzeWithGemini();
      }
    }
  }, [analyzeWithGemini]);

  const takePhoto = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setImage(asset.uri);
      setImageBase64(asset.base64 ?? null);
      setImageMimeType(asset.mimeType ?? 'image/jpeg');
      setScanResult(null);
      setScanError(null);
      if (asset.base64) {
        await analyzeWithGemini();
      }
    }
  }, [analyzeWithGemini]);

  const onPressRescan = useCallback(() => {
    if (!canScan) {
      Alert.alert('Cannot scan', 'Please upload or take a new photo first.');
      return;
    }
    analyzeWithGemini();
  }, [analyzeWithGemini, canScan]);

  const [mode, setMode] = useState<'identify' | 'identify360'>('identify');
  const shutterScale = useRef<Animated.Value>(new Animated.Value(1)).current;

  const pressShutter = useCallback(
    async (action: 'camera' | 'library') => {
      console.log('[Scan] pressShutter', { action, mode });
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } catch {
        
      }

      Animated.sequence([
        Animated.timing(shutterScale, {
          toValue: 0.94,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shutterScale, {
          toValue: 1,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      if (action === 'camera') {
        await takePhoto();
      } else {
        await pickImage();
      }
    },
    [mode, pickImage, shutterScale, takePhoto],
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good Morning,</Text>
              <Text style={styles.title}>Bush Tucka</Text>
            </View>
            <TouchableOpacity style={styles.profileButton}>
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop' }} 
                style={styles.profileImage} 
              />
            </TouchableOpacity>
          </View>

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
                  <TouchableOpacity
                    style={styles.topIconButton}
                    onPress={() => {
                      Alert.alert(
                        'Snap tips',
                        'For best results: fill the frame, avoid multiple species, and keep it sharp. If unsure, take 2–3 angles.',
                      );
                    }}
                    testID="scan-help-button"
                  >
                    <HelpCircle size={18} color={DARK.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.topIconButton} onPress={onPressRescan} disabled={analyzing} testID="scan-refresh-button">
                    <RefreshCcw size={18} color={DARK.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.focusArea}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.focusImage} />
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
                    <Text style={styles.scanBusyText}>Scanning…</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.bottomTray}>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[styles.modePill, mode === 'identify' ? styles.modePillActive : null]}
                    onPress={() => setMode('identify')}
                    testID="scan-mode-identify"
                  >
                    <Text style={[styles.modeText, mode === 'identify' ? styles.modeTextActive : null]}>Identify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modePill, mode === 'identify360' ? styles.modePillActive : null]}
                    onPress={() => setMode('identify360')}
                    testID="scan-mode-360"
                  >
                    <Text style={[styles.modeText, mode === 'identify360' ? styles.modeTextActive : null]}>360 Identify</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.controlsRow}>
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() => pressShutter('library')}
                    disabled={analyzing}
                    testID="scan-library-button"
                  >
                    <ImageIcon size={22} color={DARK.text} />
                  </TouchableOpacity>

                  <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
                    <TouchableOpacity
                      style={styles.shutterOuter}
                      onPress={() => pressShutter('camera')}
                      disabled={analyzing}
                      testID="scan-shutter-button"
                    >
                      <View style={styles.shutterInner} />
                    </TouchableOpacity>
                  </Animated.View>

                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() => {
                      Alert.alert('Quick warning', 'Only consume after verification. Many native plants have toxic lookalikes.');
                    }}
                    testID="scan-warning-button"
                  >
                    <AlertTriangle size={22} color={DARK.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Scan Result */}
          {(scanResult || scanError) && (
            <View style={styles.resultCard} testID="scan-result-card">
              <View style={styles.resultHeader}>
                <View style={styles.resultTitleRow}>
                  <Sparkles size={18} color={COLORS.primary} />
                  <Text style={styles.resultTitle}>Gemini Detection</Text>
                </View>
                <TouchableOpacity style={styles.rescanButton} onPress={onPressRescan} disabled={analyzing} testID="scan-rescan-button">
                  <Text style={styles.rescanText}>{analyzing ? 'Scanning…' : 'Rescan'}</Text>
                </TouchableOpacity>
              </View>

              {scanError ? (
                <View style={styles.resultWarningRow}>
                  <ShieldAlert size={16} color="#B91C1C" />
                  <Text style={styles.resultWarningText}>{scanError}</Text>
                </View>
              ) : null}

              {scanResult ? (
                <View style={styles.resultBody}>
                  <Text style={styles.resultName}>
                    {scanResult.commonName}
                    {scanResult.scientificName ? ` · ${scanResult.scientificName}` : ''}
                  </Text>

                  <View style={styles.resultMetaRow}>
                    <View
                      style={[
                        styles.pill,
                        scanResult.safety.status === 'safe'
                          ? styles.pillGood
                          : scanResult.safety.status === 'unsafe'
                            ? styles.pillBad
                            : styles.pillNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          scanResult.safety.status === 'safe'
                            ? styles.pillTextGood
                            : scanResult.safety.status === 'unsafe'
                              ? styles.pillTextBad
                              : styles.pillTextNeutral,
                        ]}
                      >
                        {scanResult.safety.status === 'safe'
                          ? 'Safe Edible (Check Locally)'
                          : scanResult.safety.status === 'unsafe'
                            ? 'Unsafe / Avoid'
                            : 'Uncertain / Verify'}
                      </Text>
                    </View>
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>Confidence: {Math.round(scanResult.confidence * 100)}%</Text>
                    </View>
                  </View>

                  {scanResult.bushTuckerLikely ? null : (
                    <View style={styles.resultWarningRow} testID="scan-not-bush-tucker">
                      <ShieldAlert size={16} color="#B91C1C" />
                      <Text style={styles.resultWarningText}>
                        This doesn’t look like a known Australian bush tucker item from the photo alone. Please verify before consuming.
                      </Text>
                    </View>
                  )}

                  {scanResult.safety.summary ? <Text style={styles.resultNotes}>{scanResult.safety.summary}</Text> : null}

                  {scanResult.safety.keyRisks.length > 0 ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Is this safe edible bush tucka?</Text>
                      {scanResult.safety.keyRisks.map((w, idx) => (
                        <Text key={`risk-${idx}`} style={styles.bulletText}>
                          • {w}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.twoColRow}>
                    <View style={styles.infoTile}>
                      <Text style={styles.infoTileTitle}>Easy to prepare</Text>
                      <Text style={styles.infoTileValue}>
                        {scanResult.preparation.ease === 'easy'
                          ? 'Easy'
                          : scanResult.preparation.ease === 'medium'
                            ? 'Medium'
                            : scanResult.preparation.ease === 'hard'
                              ? 'Hard'
                              : 'Unknown'}
                      </Text>
                    </View>
                    <View style={styles.infoTile}>
                      <Text style={styles.infoTileTitle}>Seasonal</Text>
                      <Text style={styles.infoTileValue}>
                        {scanResult.seasonality.bestMonths.length > 0
                          ? scanResult.seasonality.bestMonths.join(', ')
                          : 'Varies'}
                      </Text>
                    </View>
                  </View>

                  {scanResult.preparation.steps.length > 0 ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Preparation</Text>
                      {scanResult.preparation.steps.map((s, idx) => (
                        <Text key={`prep-${idx}`} style={styles.bulletText}>
                          • {s}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {scanResult.seasonality.notes ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Seasonality notes</Text>
                      <Text style={styles.bulletText}>• {scanResult.seasonality.notes}</Text>
                    </View>
                  ) : null}

                  {(scanResult.culturalKnowledge.notes || scanResult.culturalKnowledge.respect.length > 0) ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Cultural Knowledge</Text>
                      {scanResult.culturalKnowledge.notes ? (
                        <Text style={styles.bulletText}>• {scanResult.culturalKnowledge.notes}</Text>
                      ) : null}
                      {scanResult.culturalKnowledge.respect.map((r, idx) => (
                        <Text key={`respect-${idx}`} style={styles.bulletText}>
                          • {r}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {scanResult.warnings.length > 0 ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Extra Warnings</Text>
                      {scanResult.warnings.map((w, idx) => (
                        <Text key={`w-${idx}`} style={styles.bulletText}>
                          • {w}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {scanResult.suggestedUses.length > 0 ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Suggested Uses</Text>
                      {scanResult.suggestedUses.map((u, idx) => (
                        <Text key={`u-${idx}`} style={styles.bulletText}>
                          • {u}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}

          {/* Quick Categories / Guides */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Handy Pocket Guides</Text>
              <TouchableOpacity style={styles.seeAllButton}>
                <Text style={styles.seeAllText}>See All</Text>
                <ArrowRight size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidesScroll}>
              <TouchableOpacity style={[styles.guideCard, { backgroundColor: '#E3F2FD' }]}>
                <View style={[styles.guideIcon, { backgroundColor: '#BBDEFB' }]}>
                  <Bug size={24} color="#1565C0" />
                </View>
                <Text style={styles.guideTitle}>Edible Insects</Text>
                <Text style={styles.guideCount}>12 Species</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.guideCard, { backgroundColor: '#E8F5E9' }]}>
                <View style={[styles.guideIcon, { backgroundColor: '#C8E6C9' }]}>
                  <Leaf size={24} color="#2E7D32" />
                </View>
                <Text style={styles.guideTitle}>Native Berries</Text>
                <Text style={styles.guideCount}>24 Species</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.guideCard, { backgroundColor: '#FFF3E0' }]}>
                <View style={[styles.guideIcon, { backgroundColor: '#FFE0B2' }]}>
                  <AlertTriangle size={24} color="#E65100" />
                </View>
                <Text style={styles.guideTitle}>Toxic Lookalikes</Text>
                <Text style={styles.guideCount}>8 Species</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Recent Collections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Collection</Text>
            
            <View style={styles.collectionList}>
              <TouchableOpacity style={styles.collectionCard}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop' }} 
                  style={styles.collectionImage} 
                />
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionName}>Wattleseed</Text>
                  <Text style={styles.collectionDate}>Today, 10:23 AM</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Seed</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Edible</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.collectionCard}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop' }} 
                  style={styles.collectionImage} 
                />
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionName}>Finger Lime</Text>
                  <Text style={styles.collectionDate}>Yesterday, 2:15 PM</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Fruit</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Medicinal</Text>
                    </View>
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

const DARK = {
  bg: '#070A08',
  text: '#F2F5F2',
  subtext: 'rgba(242,245,242,0.70)',
  border: 'rgba(255,255,255,0.12)',
  accent: '#2DD37C',
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK.bg,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 13,
    color: DARK.subtext,
    marginBottom: 4,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: -0.6,
  },
  profileButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  scanStage: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DARK.border,
    marginBottom: 18,
  },
  scanStageBg: {
    minHeight: 520,
  },
  scanStageTopBar: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  scanStageTitleWrap: {
    gap: 6,
  },
  scanStageTitle: {
    color: DARK.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  scanStageSubtitle: {
    color: DARK.subtext,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  scanStageTopActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  focusArea: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  focusImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  focusPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusFrame: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 18,
    bottom: 18,
  },
  focusCorner: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderColor: 'rgba(242,245,242,0.85)',
  },
  focusCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 14,
  },
  focusCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 14,
  },
  focusCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 14,
  },
  focusCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 14,
  },
  scanBusyPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scanBusyDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: DARK.accent,
  },
  scanBusyText: {
    color: DARK.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  bottomTray: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  modeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    padding: 4,
    gap: 6,
    marginBottom: 14,
  },
  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modePillActive: {
    backgroundColor: 'rgba(45,211,124,0.20)',
  },
  modeText: {
    color: 'rgba(242,245,242,0.65)',
    fontSize: 13,
    fontWeight: '900',
  },
  modeTextActive: {
    color: DARK.accent,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  smallAction: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  shutterOuter: {
    width: 86,
    height: 86,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,211,124,0.20)',
    borderWidth: 3,
    borderColor: DARK.accent,
    shadowColor: DARK.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 999,
    backgroundColor: DARK.accent,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: -0.2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: DARK.accent,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  guidesScroll: {
    paddingRight: 24,
    gap: 16,
  },
  guideCard: {
    width: 140,
    padding: 16,
    borderRadius: 24,
    justifyContent: 'space-between',
    height: 160,
  },
  guideIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: DARK.text,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  guideCount: {
    fontSize: 12,
    color: DARK.subtext,
    fontWeight: '800',
  },
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: 0.3,
  },
  rescanButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(45,211,124,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(45,211,124,0.25)',
  },
  rescanText: {
    color: DARK.accent,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  resultWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.12)',
    marginBottom: 12,
  },
  resultWarningText: {
    flex: 1,
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  resultBody: {
    gap: 10,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: -0.2,
  },
  resultMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillGood: {
    backgroundColor: '#ECFDF5',
  },
  pillBad: {
    backgroundColor: '#FFF7ED',
  },
  pillNeutral: {
    backgroundColor: '#EFF6FF',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '900',
    color: DARK.subtext,
  },
  pillTextGood: {
    color: '#065F46',
  },
  pillTextBad: {
    color: '#9A3412',
  },
  pillTextNeutral: {
    color: '#1D4ED8',
  },
  resultNotes: {
    fontSize: 13,
    color: DARK.subtext,
    lineHeight: 18,
    fontWeight: '700',
  },
  bullets: {
    gap: 6,
    paddingTop: 4,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  infoTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  infoTileTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: DARK.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  infoTileValue: {
    fontSize: 14,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: -0.2,
  },
  bulletsTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: DARK.text,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  bulletText: {
    fontSize: 13,
    color: DARK.subtext,
    lineHeight: 18,
    fontWeight: '700',
  },
  collectionList: {
    gap: 16,
  },
  collectionCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  collectionImage: {
    width: 70,
    height: 70,
    borderRadius: 16,
  },
  collectionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '900',
    color: DARK.text,
    marginBottom: 4,
  },
  collectionDate: {
    fontSize: 12,
    color: DARK.subtext,
    marginBottom: 8,
    fontWeight: '700',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(45,211,124,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(45,211,124,0.22)',
  },
  tagText: {
    fontSize: 10,
    color: DARK.accent,
    fontWeight: '900',
  },
});

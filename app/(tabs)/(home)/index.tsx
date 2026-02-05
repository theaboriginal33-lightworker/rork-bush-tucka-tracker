import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert, TextInput, Share } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertTriangle,
  ArrowRight,
  BookmarkPlus,
  Copy,
  Download,
  ChevronRight,
  HelpCircle,
  Image as ImageIcon,
  MessageCircle,
  RefreshCcw,
  Scan,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useCookbook } from '@/app/providers/CookbookProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupportDirectory, type SupportOrganization } from '@/constants/supportDirectory';
import {
  createScanEntryId,
  useScanJournal,
  type GeminiScanResult as JournalGeminiScanResult,
  type ScanJournalChatMessage,
} from '@/app/providers/ScanJournalProvider';

type RorkToolkitModule = typeof import('@rork-ai/toolkit-sdk');

type LegacyFileSystemModule = typeof import('expo-file-system/legacy');

type ExpoSharingModule = typeof import('expo-sharing');

type ExpoClipboardModule = typeof import('expo-clipboard');

type ExpoImageManipulatorModule = typeof import('expo-image-manipulator');

let rorkToolkitPromise: Promise<RorkToolkitModule | null> | null = null;
let legacyFsPromise: Promise<LegacyFileSystemModule | null> | null = null;
let sharingPromise: Promise<ExpoSharingModule | null> | null = null;
let clipboardPromise: Promise<ExpoClipboardModule | null> | null = null;
let imageManipulatorPromise: Promise<ExpoImageManipulatorModule | null> | null = null;

async function getRorkToolkit(): Promise<RorkToolkitModule | null> {
  try {
    if (!rorkToolkitPromise) {
      rorkToolkitPromise = import('@rork-ai/toolkit-sdk')
        .then((m) => m as RorkToolkitModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load @rork-ai/toolkit-sdk', { message, platform: Platform.OS });
          return null;
        });
    }
    return await rorkToolkitPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getRorkToolkit unexpected error', { message, platform: Platform.OS });
    return null;
  }
}

async function getLegacyFileSystem(): Promise<LegacyFileSystemModule | null> {
  try {
    if (!legacyFsPromise) {
      legacyFsPromise = import('expo-file-system/legacy')
        .then((m) => m as LegacyFileSystemModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-file-system/legacy', { message });
          return null;
        });
    }
    return await legacyFsPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getLegacyFileSystem unexpected error', { message });
    return null;
  }
}

async function getExpoSharing(): Promise<ExpoSharingModule | null> {
  try {
    if (!sharingPromise) {
      sharingPromise = import('expo-sharing')
        .then((m) => m as ExpoSharingModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-sharing', { message });
          return null;
        });
    }
    return await sharingPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getExpoSharing unexpected error', { message });
    return null;
  }
}

async function getExpoClipboard(): Promise<ExpoClipboardModule | null> {
  try {
    if (!clipboardPromise) {
      clipboardPromise = import('expo-clipboard')
        .then((m) => m as ExpoClipboardModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-clipboard', { message });
          return null;
        });
    }
    return await clipboardPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getExpoClipboard unexpected error', { message });
    return null;
  }
}

async function getExpoImageManipulator(): Promise<ExpoImageManipulatorModule | null> {
  try {
    if (!imageManipulatorPromise) {
      imageManipulatorPromise = import('expo-image-manipulator')
        .then((m) => m as ExpoImageManipulatorModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-image-manipulator', { message });
          return null;
        });
    }
    return await imageManipulatorPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getExpoImageManipulator unexpected error', { message });
    return null;
  }
}

type SafetyEdibility = {
  status: 'safe' | 'caution' | 'unknown';
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

const CULTURAL_FOOTER = 'Cultural knowledge shared here is general and non-restricted.';

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

type GeminiScanResult = {
  commonName: string;
  scientificName?: string;
  confidence: number;

  safety: SafetyEdibility;
  categories: string[];

  bushTuckerLikely: boolean;
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
  const { addEntry, updateEntry } = useScanJournal();
  const { saveGuideEntry } = useCookbook();
  const currentEntryIdRef = useRef<string | null>(null);

  type ScanImage = { uri: string; base64?: string; mimeType?: string; previewUri?: string };
  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const primaryImage = scanImages.length > 0 ? scanImages[0] : null;
  const primaryImageDisplayUri = primaryImage?.previewUri ?? primaryImage?.uri ?? null;

  const [mode, setMode] = useState<'identify' | 'identify360'>('identify');

  type ScanPhase =
    | 'idle'
    | 'preparing'
    | 'listing-models'
    | 'sending'
    | 'parsing'
    | 'saving'
    | 'done'
    | 'error';

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [scanResult, setScanResult] = useState<GeminiScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');

  type ConfidenceGate = {
    level: 'confident' | 'likely' | 'observe';
    title: string;
    blurb: string;
    tone: 'good' | 'neutral' | 'bad';
  };

  const confidenceGate = useMemo((): ConfidenceGate | null => {
    const cRaw = scanResult?.confidence;
    const c = typeof cRaw === 'number' && Number.isFinite(cRaw) ? cRaw : null;
    if (c === null) return null;

    if (c >= 0.8) {
      return {
        level: 'confident',
        title: 'Confident ID',
        blurb: 'High confidence identification. Still verify locally before consuming.',
        tone: 'good',
      };
    }

    if (c >= 0.6) {
      return {
        level: 'likely',
        title: 'Likely match – verify locally',
        blurb: 'Likely identification. Confirm with local knowledge before consuming.',
        tone: 'neutral',
      };
    }

    return {
      level: 'observe',
      title: 'Observe only',
      blurb: 'Low confidence. Observe only — do not rely on this ID for safety or preparation.',
      tone: 'bad',
    };
  }, [scanResult?.confidence]);

  const displaySafetyStatus = useMemo((): GeminiScanResult['safety']['status'] | null => {
    if (!scanResult) return null;
    if (confidenceGate?.level === 'confident') return scanResult.safety.status;
    return 'unknown';
  }, [confidenceGate?.level, scanResult]);

  const geminiApiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  const openAiKey =
    (
      process.env.EXPO_PUBLIC_OPENAI_API_KEY ??
      process.env.EXPO_PUBLIC_OPENAI_KEY ??
      process.env.OPENAI_API_KEY ??
      process.env.OPENAI_KEY ??
      ''
    ).trim();
  const hasOpenAiKey = openAiKey.length > 0;
  const useRorkBackend = Platform.OS === 'web' || !hasOpenAiKey;
  const chatContextKeyRef = useRef<string | null>(null);
  const systemPromptRef = useRef<string | null>(null);

  const canScan = useMemo(() => {
    return scanImages.length > 0 && Boolean(geminiApiKey);
  }, [geminiApiKey, scanImages.length]);

  const normalizeSupportText = useCallback((value?: string): string => {
    if (!value) return '';
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const tokenizeSupportText = useCallback(
    (value?: string): string[] => {
      const normalized = normalizeSupportText(value);
      return normalized.length > 0 ? normalized.split(' ').filter((token) => token.length > 1) : [];
    },
    [normalizeSupportText],
  );

  const supportTriggerTokens = useMemo(
    () =>
      new Set([
        'contact',
        'details',
        'phone',
        'address',
        'email',
        'website',
        'council',
        'land',
        'lalc',
        'organisation',
        'organization',
        'verify',
        'verification',
        'guide',
        'elder',
        'community',
        'help',
        'local',
      ]),
    [],
  );

  const supportStopTokens = useMemo(
    () =>
      new Set([
        'a',
        'an',
        'the',
        'what',
        'where',
        'which',
        'when',
        'why',
        'how',
        'is',
        'are',
        'was',
        'were',
        'do',
        'does',
        'did',
        'can',
        'could',
        'would',
        'should',
        'please',
        'tell',
        'give',
        'show',
        'list',
        'provide',
        'get',
        'need',
        'looking',
        'find',
        'search',
        'look',
        'info',
        'information',
        'contact',
        'contacts',
        'details',
        'detail',
        'phone',
        'number',
        'address',
        'email',
        'website',
        'council',
        'land',
        'lalc',
        'organisation',
        'organisations',
        'organization',
        'organizations',
        'local',
        'verify',
        'verification',
        'guide',
        'elder',
        'community',
        'help',
        'who',
        'near',
        'nearby',
        'around',
        'me',
        'my',
        'for',
        'to',
        'of',
        'and',
        'this',
        'that',
        'in',
        'on',
        'at',
        'from',
        'with',
        'by',
        'about',
      ]),
    [],
  );

  const getSearchTokens = useCallback(
    (tokens: string[]): string[] => {
      return tokens.filter((token) => !supportStopTokens.has(token));
    },
    [supportStopTokens],
  );

  const hasSupportIntent = useCallback(
    (tokens: string[], directory: SupportOrganization[]): boolean => {
      if (tokens.some((token) => supportTriggerTokens.has(token))) return true;

      const nameTokens = new Set<string>();
      directory.forEach((entry) => {
        tokenizeSupportText(entry.name)
          .filter((token) => token.length >= 3)
          .forEach((token) => nameTokens.add(token));
      });

      return tokens.some((token) => nameTokens.has(token));
    },
    [supportTriggerTokens, tokenizeSupportText],
  );

  const extractRegionContext = useCallback(
    (input: string): string | null => {
      const normalized = normalizeSupportText(input);
      if (!normalized) return null;

      const regionMatches: string[] = [];
      if (/\bnsw\b|new south wales/.test(normalized)) regionMatches.push('NSW');
      if (/\bqld\b|queensland/.test(normalized)) regionMatches.push('QLD');
      if (/\bvic\b|victoria/.test(normalized)) regionMatches.push('VIC');
      if (/\bsa\b|south australia/.test(normalized)) regionMatches.push('SA');
      if (/\bwa\b|western australia/.test(normalized)) regionMatches.push('WA');
      if (/\btas\b|tasmania/.test(normalized)) regionMatches.push('TAS');
      if (/\bnt\b|northern territory/.test(normalized)) regionMatches.push('NT');
      if (/\bact\b|australian capital territory/.test(normalized)) regionMatches.push('ACT');

      const habitatMatches: string[] = [];
      const coastRegionMatch = normalized.match(/\b(east|west|north|south)\s+coast\b/);
      if (coastRegionMatch?.[1]) {
        regionMatches.push(`${coastRegionMatch[1]} coast`);
        habitatMatches.push('coastal');
      } else if (/\bcoast(al)?\b/.test(normalized)) {
        habitatMatches.push('coastal');
      }
      if (/\binland\b/.test(normalized)) habitatMatches.push('inland');
      if (/\barid\b/.test(normalized)) habitatMatches.push('arid');
      if (/\bdesert\b/.test(normalized)) habitatMatches.push('desert');
      if (/\btropical\b/.test(normalized)) habitatMatches.push('tropical');
      if (/\btemperate\b/.test(normalized)) habitatMatches.push('temperate');
      if (/\brainforest\b/.test(normalized)) habitatMatches.push('rainforest');
      if (/\balpine\b/.test(normalized)) habitatMatches.push('alpine');
      if (/\bbush\b/.test(normalized)) habitatMatches.push('bush');

      if (regionMatches.length === 0 && habitatMatches.length === 0) return null;

      const parts: string[] = [];
      if (regionMatches.length > 0) parts.push(regionMatches.join('/'));
      if (habitatMatches.length > 0) parts.push(habitatMatches.join(', '));
      return parts.join(' - ');
    },
    [normalizeSupportText],
  );

  type AgentTextPart = { type: 'text'; text: string };
  type AgentMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts: AgentTextPart[];
    createdAt?: number;
  };

  const [chatMessagesRaw, setChatMessages] = useState<AgentMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<'idle' | 'submitted' | 'streaming'>('idle');
  const [chatError, setChatError] = useState<Error | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const [regionContext, setRegionContext] = useState<string | null>(null);

  const clearChatError = useCallback(() => {
    setChatError(null);
  }, []);

  const buildRegionClarifier = useCallback((): string => {
    return 'What state or region are you in? Is it coastal, inland, bush, rainforest, arid, tropical, or temperate?';
  }, []);

  const updateRegionFromText = useCallback(
    (text: string): string | null => {
      const extracted = extractRegionContext(text);
      if (extracted && extracted !== regionContext) {
        setRegionContext(extracted);
        return extracted;
      }
      return extracted ?? regionContext;
    },
    [extractRegionContext, regionContext],
  );

  const isRegionOnlyMessage = useCallback(
    (text: string): boolean => {
      const tokens = tokenizeSupportText(text);
      if (tokens.length === 0) return false;
      const regionTokens = new Set([
        'nsw',
        'qld',
        'vic',
        'sa',
        'wa',
        'tas',
        'nt',
        'act',
        'new',
        'south',
        'wales',
        'queensland',
        'victoria',
        'australia',
        'western',
        'northern',
        'territory',
        'coast',
        'coastal',
        'inland',
        'bush',
        'rainforest',
        'arid',
        'tropical',
        'temperate',
        'east',
        'west',
        'north',
      ]);
      return tokens.every((token) => regionTokens.has(token));
    },
    [tokenizeSupportText],
  );

  const needsRegionForQuestion = useCallback(
    (text: string, effectiveRegion: string | null): boolean => {
      if (effectiveRegion) return false;
      const normalized = normalizeSupportText(text);
      if (!normalized) return false;

      const isGreeting = /^(hi|hello|hey|thanks|thank you)\b/.test(normalized);
      if (isGreeting) return false;

      const guidanceKeywords =
        /safe|edible|eat|recipe|cook|cooking|prepare|prep|season|when|use|lookalike|warning|identify|id|plant|bush|tucker|berry|fruit|leaf|seed|root|spice|jam|chutney|sauce/i;
      return guidanceKeywords.test(normalized);
    },
    [normalizeSupportText],
  );

  const sendMessage = useCallback(
    async (userText: string, options?: { retry?: boolean }) => {
      const trimmed = String(userText ?? '').trim();
      if (!trimmed) return;
      const isRetry = options?.retry === true;

      if (!hasOpenAiKey && !useRorkBackend) {
        setChatStatus('idle');
        setChatError(
          new Error(
            'OpenAI API key is missing. Set EXPO_PUBLIC_OPENAI_API_KEY in Rork and reload the app.',
          ),
        );
        return;
      }

      if (!isRetry) {
        const now = Date.now();
        const userMsg: AgentMessage = {
          id: `user-${now}-${Math.random().toString(16).slice(2)}`,
          role: 'user',
          parts: [{ type: 'text', text: trimmed }],
          createdAt: now,
        };

        lastUserMessageRef.current = trimmed;
        setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), userMsg]);
      }
      setChatError(null);

      const model = 'gpt-4.1-mini';
      const endpoint = 'https://api.openai.com/v1/chat/completions';

      const promptText = systemPromptRef.current ?? 'You are a helpful assistant.';

      const history = (Array.isArray(chatMessagesRaw) ? chatMessagesRaw : [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => {
          const text = Array.isArray(m.parts)
            ? m.parts
                .filter((p) => p?.type === 'text')
                .map((p) => String(p.text ?? ''))
                .join('')
            : '';
          return {
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: text,
          };
        });

      const shouldAppendUser =
        !isRetry || history.length === 0 || history[history.length - 1]?.role !== 'user';

      const messages = [
        { role: 'system' as const, content: promptText },
        ...(shouldAppendUser
          ? [
              ...history,
              {
                role: 'user' as const,
                content: trimmed,
              },
            ]
          : history),
      ];

      type BackendChatMessage = { role: 'user' | 'assistant'; content: string };
      const backendMessages = messages.filter((m) => m.role !== 'system') as BackendChatMessage[];

      const toolkit = useRorkBackend ? await getRorkToolkit() : null;
      const shouldUseRorkBackend = Boolean(useRorkBackend && toolkit?.generateText);
      console.log('[TuckaGuide] backend choice', {
        useRorkBackend,
        shouldUseRorkBackend,
        hasToolkit: Boolean(toolkit),
        hasGenerateText: Boolean(toolkit?.generateText),
        platform: Platform.OS,
      });

      if (useRorkBackend && !toolkit?.generateText) {
        setChatStatus('idle');
        setChatError(new Error('AI chat is unavailable right now. Please reload and try again.'));
        return;
      }

      const requestBody = {
        model,
        messages: [
          { role: 'system' as const, content: promptText },
          ...(shouldAppendUser
            ? [
                ...history.map((m) => ({
                  role: m.role,
                  content: m.content ?? '',
                })),
                {
                  role: 'user' as const,
                  content: trimmed,
                },
              ]
            : history.map((m) => ({
                role: m.role,
                content: m.content ?? '',
              }))),
        ],
        temperature: 0.35,
        max_tokens: 500,
      };

      const parseFailureMessage = (resStatus: number, payload: unknown): string => {
        const p = payload as { error?: { message?: unknown; type?: unknown } };
        const apiMsg = typeof p?.error?.message === 'string' ? p.error.message : '';
        const apiType = typeof p?.error?.type === 'string' ? p.error.type : '';
        const core = apiMsg || apiType || `Chat request failed (${resStatus}).`;
        const cleaned = core.trim().length > 0 ? core : `Chat request failed (${resStatus}).`;
        return `OpenAI error ${resStatus}: ${cleaned}`;
      };

      const runOnce = async (): Promise<string> => {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutMs = 25000;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            try {
              controller?.abort();
            } catch {
              
            }
            reject(new Error('Request timeout'));
          }, timeoutMs);
        });

        const runOpenAiDirect = async (): Promise<string> => {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller?.signal,
          });

          let json: unknown = null;
          try {
            json = (await res.json()) as unknown;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[TuckaGuide] failed to parse json response', { message, status: res.status });
            json = null;
          }

          const data = json as
            | { choices?: { message?: { content?: string | null } | null }[] | null }
            | null;
          const assistantText = String(data?.choices?.[0]?.message?.content ?? '').trim();

          if (!res.ok || assistantText.length === 0) {
            throw new Error(parseFailureMessage(res.status, json));
          }

          return assistantText;
        };

        const runRorkToolkit = async (): Promise<string> => {
          const response = await (toolkit as RorkToolkitModule).generateText({ messages: backendMessages });
          return String(response ?? '').trim();
        };

        const requestPromise = (async () => {
          if (shouldUseRorkBackend) {
            try {
              const res = await runRorkToolkit();
              if (res.length > 0) return res;
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              const isOpenAiDetected = /openai\s+key\s+detected/i.test(message);
              console.log('[TuckaGuide] toolkit generateText failed', { message, isOpenAiDetected });
              if (!isOpenAiDetected) {
                throw e;
              }
              if (!hasOpenAiKey) {
                throw e;
              }
              console.log('[TuckaGuide] Falling back to direct OpenAI after toolkit rejection');
            }
          }

          if (!hasOpenAiKey) {
            throw new Error('OpenAI API key is missing.');
          }
          return await runOpenAiDirect();
        })();

        try {
          const result = await Promise.race([requestPromise, timeoutPromise]);
          return String(result ?? '').trim();
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      };

      const fallbackToRork = async (): Promise<string | null> => {
        try {
          const mod = toolkit ?? (await getRorkToolkit());
          if (!mod?.generateText) return null;
          const response = await mod.generateText({ messages: backendMessages });
          const cleaned = String(response ?? '').trim();
          return cleaned.length > 0 ? cleaned : null;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[TuckaGuide] fallback generateText failed', { message });
          return null;
        }
      };

      try {
        setChatStatus('submitted');

        let assistantText: string | null = null;
        const retryDelays = [0, 900, 2200];
        for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
          if (retryDelays[attempt] > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[attempt]));
          }
          try {
            assistantText = await runOnce();
            break;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            const shouldRetry = /timeout|network|unavailable|overloaded|rate|quota|busy|429|503/i.test(message);
            console.log('[TuckaGuide] attempt failed', { attempt, message, shouldRetry });
            if (!shouldRetry || attempt === retryDelays.length - 1) {
              throw e;
            }
          }
        }

        const finalAssistantText = String(assistantText ?? '').trim();
        if (finalAssistantText.length === 0) {
          throw new Error('Empty response');
        }

        const assistantMsg: AgentMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: 'assistant',
          parts: [{ type: 'text', text: finalAssistantText }],
          createdAt: Date.now(),
        };

        setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), assistantMsg]);
      } catch (e) {
        const rawMessage = e instanceof Error ? e.message : String(e);
        console.log('[TuckaGuide] sendMessage failed', { rawMessage });

        if (!useRorkBackend) {
          const fallbackText = await fallbackToRork();
          if (fallbackText) {
            const assistantMsg: AgentMessage = {
              id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              role: 'assistant',
              parts: [{ type: 'text', text: fallbackText }],
              createdAt: Date.now(),
            };
            setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), assistantMsg]);
            setChatError(null);
            return;
          }
        }

        const isMissingKey = /provide an api key|no api key|api key missing|missing api key/i.test(rawMessage);
        const isInvalidKey = /invalid api key|api_key_invalid|incorrect api key|invalid_api_key/i.test(rawMessage);
        const isModelAccess = /model.*(not found|does not exist|not available|access)/i.test(rawMessage);
        const isRateLimited = /rate|quota|busy|overloaded|429|503|unavailable|timeout/i.test(rawMessage);

        const userMessage = isMissingKey
          ? 'OpenAI API key is missing. Set EXPO_PUBLIC_OPENAI_API_KEY in Rork and reload the app.'
          : isInvalidKey
            ? 'OpenAI API key was rejected. Confirm the key is correct and has access to gpt-4.1-mini.'
            : isModelAccess
              ? 'OpenAI model access error. This key may not have access to gpt-4.1-mini.'
              : isRateLimited
                ? 'Tucka Guide is busy right now. Please try again in a moment.'
                : rawMessage.trim().length > 0
                  ? rawMessage
                  : 'Could not send message. Please try again.';

        setChatError(new Error(userMessage));
      } finally {
        setChatStatus('idle');
      }
    },
    [chatMessagesRaw, hasOpenAiKey, openAiKey, useRorkBackend],
  );

  const chatMessages = useMemo((): unknown[] => {
    if (!Array.isArray(chatMessagesRaw)) {
      console.log('[Chat] messages is not an array yet', { type: typeof chatMessagesRaw });
      return [];
    }
    return chatMessagesRaw as unknown[];
  }, [chatMessagesRaw]);

  const busyRetryRef = useRef<{ attempts: number; timer: ReturnType<typeof setTimeout> | null }>({
    attempts: 0,
    timer: null,
  });

  const isBusyChatError = useCallback((error: Error | null): boolean => {
    if (!error) return false;
    const message = error.message?.toLowerCase?.() ?? '';
    return (
      message.includes('busy') ||
      message.includes('try again') ||
      message.includes('temporarily unavailable') ||
      message.includes('overloaded') ||
      message.includes('rate') ||
      message.includes('quota') ||
      message.includes('429') ||
      message.includes('503')
    );
  }, []);

  const retryChatNow = useCallback(async () => {
    if (!isBusyChatError(chatError)) return;
    clearChatError();
    if (chatStatus !== 'idle') return;
    if (!lastUserMessageRef.current) return;
    await sendMessage(lastUserMessageRef.current, { retry: true });
  }, [chatError, chatStatus, clearChatError, isBusyChatError, sendMessage]);

  useEffect(() => {
    if (!isBusyChatError(chatError)) {
      busyRetryRef.current.attempts = 0;
      if (busyRetryRef.current.timer) {
        clearTimeout(busyRetryRef.current.timer);
        busyRetryRef.current.timer = null;
      }
      return;
    }

    if (busyRetryRef.current.attempts >= 2) {
      return;
    }

    const attempt = busyRetryRef.current.attempts + 1;
    busyRetryRef.current.attempts = attempt;
    const delayMs = attempt === 1 ? 1500 : 3000;

    if (busyRetryRef.current.timer) {
      clearTimeout(busyRetryRef.current.timer);
    }

    busyRetryRef.current.timer = setTimeout(() => {
      retryChatNow().catch(() => undefined);
    }, delayMs);

    const busyRetry = busyRetryRef.current;
    const timerToClear = busyRetry.timer;
    return () => {
      if (timerToClear) {
        clearTimeout(timerToClear);
      }
      if (busyRetry.timer === timerToClear) {
        busyRetry.timer = null;
      }
    };
  }, [chatError, isBusyChatError, retryChatNow]);

  const chatCreatedAtByIdRef = useRef<Record<string, number>>({});

  const scanContext = useMemo(() => {
    if (!scanResult) return null;

    const lines = [
      `Common name: ${scanResult.commonName}`,
      scanResult.scientificName ? `Scientific name: ${scanResult.scientificName}` : null,
      `Confidence: ${Math.round(scanResult.confidence * 100)}%`,
      `Bush tucker likely: ${scanResult.bushTuckerLikely ? 'yes' : 'no'}`,
      `Safety status: ${scanResult.safety.status}`,
      scanResult.safety.summary ? `Safety summary: ${scanResult.safety.summary}` : null,
      scanResult.safety.keyRisks.length > 0 ? `Key risks: ${scanResult.safety.keyRisks.join('; ')}` : null,
      scanResult.preparation.steps.length > 0 ? `Preparation steps: ${scanResult.preparation.steps.join('; ')}` : null,
      scanResult.preparation.ease ? `Preparation ease: ${scanResult.preparation.ease}` : null,
      scanResult.seasonality.bestMonths.length > 0 ? `Best months: ${scanResult.seasonality.bestMonths.join(', ')}` : null,
      scanResult.seasonality.notes ? `Seasonality notes: ${scanResult.seasonality.notes}` : null,
      scanResult.culturalKnowledge.notes ? `Cultural notes: ${scanResult.culturalKnowledge.notes}` : null,
      scanResult.culturalKnowledge.respect.length > 0 ? `Respect notes: ${scanResult.culturalKnowledge.respect.join('; ')}` : null,
      scanResult.warnings.length > 0 ? `Warnings: ${scanResult.warnings.join('; ')}` : null,
      scanResult.suggestedUses.length > 0 ? `Suggested uses: ${scanResult.suggestedUses.join('; ')}` : null,
    ].filter(Boolean);

    return lines.join('\n');
  }, [scanResult]);

  const scanContextKey = useMemo(() => {
    if (!scanResult) return null;
    return [scanResult.commonName, scanResult.scientificName ?? '', Math.round(scanResult.confidence * 100)].join('|');
  }, [scanResult]);

  const systemPrompt = useMemo(() => {
    if (!scanResult || !scanContext) return null;

    const confidencePct = Math.round(scanResult.confidence * 100);
    const gateInstruction =
      confidenceGate?.level === 'confident'
        ? 'Confidence gate: 80%+. You may provide safety + preparation + suggested uses, but still remind to verify locally.'
        : confidenceGate?.level === 'likely'
          ? 'Confidence gate: 60–79%. Treat identification as provisional. Do NOT give cooking/preparation steps or consumption advice. Focus on verification steps, lookalikes, and safe observation.'
          : 'Confidence gate: <60%. Treat identification as very uncertain. Do NOT give cooking/preparation steps or consumption advice. Focus on observation tips and how to rescan/verify.';

    return `You are Tucka Guide, an advanced Australian Bush Tucker + plant knowledge companion.

Your role: provide deep, practical, culturally respectful guidance about bush tucker plants across Australia. Use the scan info for identification and safety context, and you may add well-known, low-risk guidance (including simple recipes) when rules allow and it fits the user's region. If you are unsure or the plant is not clearly safe, say so and request local confirmation.

REGION-AWARE (NOT REGION-LOCKED)
- Ask for or infer the user's region (state, climate zone, coastal/inland, desert/tropical/temperate) BEFORE giving confident guidance.
- If region is unknown, ask 1–3 short clarifying questions and keep the response brief.
- Tailor advice to the region once known.

RESPONSE STRUCTURE (always use these section labels, plain text only):
Best Identification (Confidence Level Stated)
How to Confirm Safely
Region + Seasonality
Traditional Context (Respectful + General)
Uses (Food / Medicine)
Bush Tucker Recipe (ONLY IF SAFE)
Lookalikes + Warnings
Next Safe Step

Follow-up responses:
- If the user asks a specific follow-up (e.g. recipe, season, uses), respond with ONLY the relevant section(s).
- Do NOT repeat the full template every time.
- Keep follow-ups concise and focused on the question.

BUSH TUCKER RECIPES — STRICT RULES
- Offer a recipe ONLY if the plant is widely recognised as edible, preparation is low-risk, and no specialist cultural methods are required.
- If not safe, say: “This plant is not suitable for casual cooking. I won’t provide a recipe for safety reasons.”

SAFETY FIRST
- Never guarantee identification from text alone.
- Never encourage wild consumption without confirmation.
- Warn about toxic lookalikes and allergies.
- No medicinal dosages. No sacred or restricted cultural knowledge.

If the user asks for local organisations or verification help, share contact details only if they are in the local directory. If not, ask for their town/state.

${gateInstruction}
User region context: ${regionContext ?? 'unknown'}
Confidence: ${confidencePct}%

Scan info:
${scanContext}`;
  }, [confidenceGate?.level, regionContext, scanContext, scanResult]);

  useEffect(() => {
    systemPromptRef.current = systemPrompt;
  }, [systemPrompt]);

  const assistantGreeting = useMemo(() => {
    if (!scanResult) return '';

    const gateLine =
      confidenceGate?.level === 'confident'
        ? 'Confident ID (80%+).'
        : confidenceGate?.level === 'likely'
          ? 'Likely match (60–79%). Confirm with local knowledge before consuming.'
          : 'Observe only (<60%). Do not rely on this ID for safety or preparation.';

    const safetyNote =
      scanResult.safety.status === 'safe'
        ? 'Ask about preparation, seasonality, or uses. Always verify locally before eating.'
        : 'This scan is not fully confirmed. Ask about risks and verification steps before doing anything.';

    const regionPrompt = regionContext ? `Region noted: ${regionContext}.` : 'Tell me your state/region and habitat (coastal, bush, rainforest, arid) for tailored guidance.';

    return `I can answer questions about ${scanResult.commonName}. ${gateLine} ${safetyNote} ${regionPrompt} Need local help? Ask for nearby organisations and include your town or region.`;
  }, [confidenceGate?.level, regionContext, scanResult]);

  const chatDisplayMessages = useMemo(() => {
    const sanitizeChatText = (value: string): string => {
      let cleaned = value;
      cleaned = cleaned.replace(/<execute_[\s\S]*?<\/execute_[^>]*>/gi, '');
      cleaned = cleaned.replace(/<\/?execute_[^>]*>/gi, '');
      cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
      cleaned = cleaned
        .split('\n')
        .filter((line) => !/execute_ipython|execute_python|search_web\(/i.test(line))
        .map((line) => {
          let trimmedLine = line.trim();
          if (trimmedLine.startsWith('#')) {
            trimmedLine = trimmedLine.replace(/^#{1,6}\s*/, '');
          }
          if (/^[-*]\s+/.test(trimmedLine)) {
            trimmedLine = trimmedLine.replace(/^[-*]\s+/, '• ');
          }
          trimmedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '$1');
          trimmedLine = trimmedLine.replace(/\*(.*?)\*/g, '$1');
          return trimmedLine;
        })
        .join('\n');
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
      return cleaned;
    };

    try {
      const safeMessages: unknown[] = Array.isArray(chatMessages) ? chatMessages : [];
      return safeMessages
        .filter((m) => (m as any)?.role !== 'system')
        .map((m, index) => {
          const message = m as any;
          const partsArray: any[] = Array.isArray(message?.parts) ? message.parts : [];
          const textFromParts = partsArray
            .filter((part: any) => part?.type === 'text' && typeof part?.text === 'string')
            .map((part: any) => String(part.text ?? ''))
            .join('');

          const text =
            textFromParts ||
            (typeof message?.content === 'string'
              ? message.content
              : typeof message?.text === 'string'
                ? message.text
                : '');

          if (!text) return null;

          const role = message?.role === 'user' ? ('user' as const) : ('assistant' as const);
          const cleanedText = role === 'assistant' ? sanitizeChatText(text) : text;
          const finalText =
            cleanedText.trim() ||
            (role === 'assistant' ? 'I could not find an answer from the scan details.' : text);

          const hashText = (value: string): string => {
            let h = 2166136261;
            for (let i = 0; i < value.length; i += 1) {
              h ^= value.charCodeAt(i);
              h = Math.imul(h, 16777619);
            }
            return (h >>> 0).toString(16);
          };

          const rawId = typeof message?.id === 'string' ? message.id : '';
          const stableIdSeed = `${role}|${index}|${finalText.slice(0, 120)}`;
          const id = rawId.trim().length > 0 ? rawId : `msg-${hashText(stableIdSeed)}`;

          const rawCreatedAt = Number(message?.createdAt);
          const createdAtFromMessage = Number.isFinite(rawCreatedAt) ? rawCreatedAt : null;

          const seen = chatCreatedAtByIdRef.current[id];
          const createdAt =
            typeof seen === 'number'
              ? seen
              : typeof createdAtFromMessage === 'number'
                ? createdAtFromMessage
                : Date.now();
          if (typeof seen !== 'number') {
            chatCreatedAtByIdRef.current[id] = createdAt;
          }

          return {
            id,
            role,
            text: finalText,
            createdAt,
          };
        })
        .filter((message): message is { id: string; role: 'user' | 'assistant'; text: string; createdAt: number } => Boolean(message));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] chatDisplayMessages compute failed', { msg });
      return [] as { id: string; role: 'user' | 'assistant'; text: string; createdAt: number }[];
    }
  }, [chatMessages]);

  const [chatTimeout, setChatTimeout] = useState<boolean>(false);
  const chatBusySinceRef = useRef<number | null>(null);

  const resetChatToGreeting = useCallback(() => {
    if (!scanResult || !systemPrompt || !scanContextKey) {
      setChatMessages([]);
      setChatInput('');
      chatContextKeyRef.current = null;
      pendingQuestionRef.current = null;
      lastUserMessageRef.current = null;
      setRegionContext(null);
      return;
    }

    chatContextKeyRef.current = scanContextKey;
    setChatMessages([
      {
        id: `system-${scanContextKey}`,
        role: 'system',
        parts: [{ type: 'text', text: systemPrompt }],
      },
      {
        id: `assistant-${scanContextKey}`,
        role: 'assistant',
        parts: [{ type: 'text', text: assistantGreeting }],
      },
    ] as unknown as Parameters<typeof setChatMessages>[0]);
    setChatInput('');
    setChatTimeout(false);
    chatBusySinceRef.current = null;
    pendingQuestionRef.current = null;
    lastUserMessageRef.current = null;
    setRegionContext(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [assistantGreeting, scanContextKey, scanResult, setChatMessages, systemPrompt]);

  useEffect(() => {
    if (!scanResult || !systemPrompt || !scanContextKey) {
      if (chatContextKeyRef.current) {
        chatContextKeyRef.current = null;
        setChatMessages([]);
        setChatInput('');
        setChatTimeout(false);
        chatBusySinceRef.current = null;
      }
      return;
    }

    if (chatContextKeyRef.current === scanContextKey) {
      return;
    }

    resetChatToGreeting();
  }, [resetChatToGreeting, scanContextKey, scanResult, setChatMessages, systemPrompt]);

  const chatBusy = chatStatus === 'submitted' || chatStatus === 'streaming';

  useEffect(() => {
    if (!chatBusy) {
      setChatTimeout(false);
      chatBusySinceRef.current = null;
      return;
    }

    if (chatBusySinceRef.current === null) {
      chatBusySinceRef.current = Date.now();
      setChatTimeout(false);
    }

    const handle = setTimeout(() => {
      const since = chatBusySinceRef.current;
      const elapsedMs = typeof since === 'number' ? Date.now() - since : 0;
      console.log('[TuckaGuide] chat busy watchdog fired', { chatStatus, elapsedMs });
      setChatTimeout(true);
      setChatStatus('idle');
      setChatError(new Error('Tucka Guide timed out. Please try again.'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 30000);

    return () => {
      clearTimeout(handle);
    };
  }, [chatBusy, chatStatus]);

  const [savedGuideByMessageId, setSavedGuideByMessageId] = useState<Record<string, boolean>>({});

  const buildGuideExportText = useCallback(
    (assistantText: string): string => {
      const now = new Date();
      const lines: string[] = [];
      lines.push('Tucka Guide');
      if (scanResult?.commonName) lines.push(`Plant: ${scanResult.commonName}`);
      if (scanResult?.scientificName) lines.push(`Scientific: ${scanResult.scientificName}`);
      if (scanResult?.confidence != null) lines.push(`Confidence: ${Math.round(scanResult.confidence * 100)}%`);
      if (scanResult?.safety?.status) lines.push(`Safety: ${String(scanResult.safety.status).toUpperCase()}`);
      lines.push(`Saved: ${now.toLocaleString()}`);
      lines.push('');
      lines.push(assistantText.trim());
      lines.push('');
      lines.push('—');
      lines.push('Always verify locally before consuming.');
      return lines.join('\n');
    },
    [scanResult?.commonName, scanResult?.confidence, scanResult?.scientificName, scanResult?.safety?.status],
  );

  const copyGuideText = useCallback(
    async (assistantText: string) => {
      const exportText = buildGuideExportText(assistantText);
      try {
        const Clipboard = await getExpoClipboard();
        if (!Clipboard) {
          await Share.share({ message: exportText });
          return;
        }
        await Clipboard.setStringAsync(exportText);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Copied', 'Tucka Guide answer copied to clipboard.');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[TuckaGuide] copy failed', { message });
        Alert.alert('Could not copy', 'Please try again.');
      }
    },
    [buildGuideExportText],
  );

  const shareOrDownloadGuideText = useCallback(
    async (assistantText: string) => {
      const exportText = buildGuideExportText(assistantText);
      const safeName = `tucka-guide-${Date.now()}.txt`;

      if (Platform.OS === 'web') {
        try {
          const hasDocument = typeof document !== 'undefined';
          if (!hasDocument) {
            await copyGuideText(assistantText);
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
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[TuckaGuide] web download failed', { message });
          await copyGuideText(assistantText);
          return;
        }
      }

      try {
        const fs = await getLegacyFileSystem();
        const baseDir = fs?.cacheDirectory ?? fs?.documentDirectory;
        if (!baseDir) {
          console.log('[TuckaGuide] no writable directory available');
          await Share.share({ message: exportText });
          return;
        }

        if (!fs) {
          await Share.share({ message: exportText });
          return;
        }

        const fileUri = `${baseDir}${safeName}`;
        console.log('[TuckaGuide] writing export file', { fileUri });

        await fs.writeAsStringAsync(fileUri, exportText, { encoding: fs.EncodingType.UTF8 });

        const Sharing = await getExpoSharing();
        if (Sharing) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share / Save' });
            return;
          }
        }

        await Share.share({ message: exportText });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[TuckaGuide] share/download failed', { message });
        Alert.alert('Could not export', message.length > 140 ? 'Please try again.' : message);
      }
    },
    [buildGuideExportText, copyGuideText],
  );

  const extractGuideTitle = useCallback(
    (assistantText: string): string => {
      const fallback = scanResult?.commonName?.trim() ? `${scanResult.commonName} – Guide` : 'Tucka Guide – Saved';
      const raw = String(assistantText ?? '');

      const cleaned = raw
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .trim();

      if (!cleaned) return fallback;

      const lines = cleaned
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const takeFromLine = (line: string): string => {
        const l0 = line
          .replace(/^```[a-zA-Z0-9_-]*\s*/i, '')
          .replace(/^#+\s*/, '')
          .replace(/^\*\*\s*/, '')
          .replace(/\s*\*\*$/, '')
          .trim();

        const stripped = l0
          .replace(/^recipe\s*(name|title)?\s*[:\-]\s*/i, '')
          .replace(/^title\s*[:\-]\s*/i, '')
          .replace(/^name\s*[:\-]\s*/i, '')
          .trim();

        return stripped;
      };

      const candidatePatterns: RegExp[] = [
        /^#+\s*recipe\s*(name|title)?\s*[:\-]/i,
        /^recipe\s*(name|title)?\s*[:\-]/i,
        /^title\s*[:\-]/i,
        /^name\s*[:\-]/i,
      ];

      const bestExplicit = lines.find((l) => candidatePatterns.some((p) => p.test(l)));
      const picked = takeFromLine(bestExplicit ?? (lines[0] ?? ''));

      const finalTitle = picked.length > 0 ? picked : fallback;
      const maxLen = 64;
      const normalized = finalTitle.replace(/\s+/g, ' ').trim();
      const cropped = normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1).trim()}…` : normalized;

      console.log('[TuckaGuide] extractGuideTitle', {
        fallback,
        picked: bestExplicit ?? lines[0] ?? null,
        finalTitle: cropped,
      });

      return cropped;
    },
    [scanResult?.commonName],
  );

  const saveGuideToCook = useCallback(
    async (assistantText: string, messageId: string) => {
      if (!scanResult) return;
      if (savedGuideByMessageId[messageId]) {
        Alert.alert('Already saved', 'This answer is already saved to Cook.');
        return;
      }

      try {
        const title = extractGuideTitle(assistantText);
        const saved = await saveGuideEntry({
          title,
          guideText: assistantText,
          commonName: scanResult.commonName,
          scientificName: scanResult.scientificName,
          imageUri: primaryImageDisplayUri ?? undefined,
          confidence: scanResult.confidence,
          safetyStatus: scanResult.safety.status,
          scanEntryId: currentEntryIdRef.current ?? undefined,
          chatMessageId: messageId,
          suggestedUses: scanResult.suggestedUses,
        });

        setSavedGuideByMessageId((prev) => ({ ...prev, [messageId]: true }));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Saved to Cook', `Saved “${saved.title}”.`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[TuckaGuide] save to Cook failed', { message });
        Alert.alert('Could not save', 'Please try again.');
      }
    },
    [extractGuideTitle, primaryImageDisplayUri, saveGuideEntry, savedGuideByMessageId, scanResult],
  );

  const journalChatHistory = useMemo((): ScanJournalChatMessage[] => {
    return chatDisplayMessages.map((m) => ({
      id: String(m.id),
      role: m.role,
      text: m.text,
      createdAt: Number.isFinite(m.createdAt) ? m.createdAt : Date.now(),
    }));
  }, [chatDisplayMessages]);

  const lastSavedChatHashRef = useRef<string>('');

  useEffect(() => {
    const entryId = currentEntryIdRef.current;
    if (!entryId) return;
    if (journalChatHistory.length === 0) return;

    const hash = JSON.stringify(journalChatHistory.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt })));
    if (lastSavedChatHashRef.current === hash) {
      return;
    }

    lastSavedChatHashRef.current = hash;
    updateEntry(entryId, { chatHistory: journalChatHistory }).catch((e) => {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[Scan] updateEntry chatHistory failed', { message });
    });
  }, [journalChatHistory, updateEntry]);
  const chatDisabled = !scanResult || chatBusy;
  const sendDisabled = chatDisabled || chatInput.trim().length === 0;

  const suggestedQuestions = useMemo(() => {
    if (!scanResult) return [];
    return [
      `Is ${scanResult.commonName} safe to eat?`,
      'How should I prepare it?',
      'When is it in season?',
      'Any warnings or lookalikes?',
      'Who can verify this locally?',
    ];
  }, [scanResult]);

  const formatSupportEntry = useCallback((entry: SupportOrganization): string => {
    const lines = [
      entry.name,
      entry.region ? `Region: ${entry.region}` : null,
      entry.phone ? `Phone: ${entry.phone}` : null,
      entry.address ? `Address: ${entry.address}` : null,
      entry.email ? `Email: ${entry.email}` : null,
      entry.website ? `Website: ${entry.website}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }, []);

  const findSupportEntries = useCallback(
    (directory: SupportOrganization[], searchTokens: string[]): SupportOrganization[] => {
      if (searchTokens.length === 0) return [];
      return directory.filter((entry) => {
        const haystack = [
          entry.name,
          entry.region,
          entry.address ?? '',
          entry.notes ?? '',
          entry.phone ?? '',
          entry.email ?? '',
          entry.website ?? '',
          ...(entry.categories ?? []),
          ...(entry.tags ?? []),
        ]
          .map((value) => normalizeSupportText(value))
          .join(' ');

        return searchTokens.every((token) => haystack.includes(token));
      });
    },
    [normalizeSupportText],
  );

  const getRegionTokens = useCallback((): string[] => {
    if (!regionContext) return [];
    return tokenizeSupportText(regionContext);
  }, [regionContext, tokenizeSupportText]);

  const appendLocalMessages = useCallback(
    (userText: string, assistantText: string) => {
      setChatMessages((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const stamp = Date.now();
        const userMessage = {
          id: `user-${stamp}-${Math.random().toString(16).slice(2)}`,
          role: 'user',
          parts: [{ type: 'text', text: userText }],
        };
        const assistantMessage = {
          id: `assistant-${stamp}-${Math.random().toString(16).slice(2)}`,
          role: 'assistant',
          parts: [{ type: 'text', text: assistantText }],
        };
        return [...base, userMessage, assistantMessage] as unknown as typeof base;
      });
    },
    [setChatMessages],
  );

  const handleSupportRequest = useCallback(
    async (text: string): Promise<boolean> => {
      const directory = await getSupportDirectory();
      const tokens = tokenizeSupportText(text);
      if (!hasSupportIntent(tokens, directory)) {
        return false;
      }

      const regionTokens = getRegionTokens();
      const searchTokens = getSearchTokens(tokens);
      if (searchTokens.length === 0) {
        if (regionTokens.length === 0) {
          appendLocalMessages(
            text,
            'Please share your town/state or the organisation name so I can provide the right local contact details.',
          );
          return true;
        }
      }

      const directMatches = searchTokens.length > 0 ? findSupportEntries(directory, searchTokens) : [];
      const regionMatches = directMatches.length === 0 && regionTokens.length > 0 ? findSupportEntries(directory, regionTokens) : [];
      const matches = directMatches.length > 0 ? directMatches : regionMatches;
      if (matches.length === 0) {
        const regionHint = regionContext ? ` (region detected: ${regionContext})` : '';
        appendLocalMessages(
          text,
          `I do not have a matching local contact yet${regionHint}. Tell me your town/state or the organisation name so I can look it up, or add contacts to the local directory.`,
        );
        return true;
      }

      const response = matches.map((entry) => formatSupportEntry(entry)).join('\n\n');
      const followUp =
        matches.length === 1 ? 'If you need a different area, tell me your town/state.' : 'Tell me your town/state if you need a different area.';
      appendLocalMessages(text, `${response}\n\n${followUp}`);
      return true;
    },
    [appendLocalMessages, findSupportEntries, formatSupportEntry, getRegionTokens, getSearchTokens, hasSupportIntent, regionContext, tokenizeSupportText],
  );

  const onSendChat = useCallback(async () => {
    if (sendDisabled) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    if (chatError) {
      clearChatError();
    }

    const effectiveRegion = updateRegionFromText(trimmed);
    const handled = await handleSupportRequest(trimmed);
    if (handled) {
      setChatInput('');
      return;
    }
    if (needsRegionForQuestion(trimmed, effectiveRegion)) {
      pendingQuestionRef.current = trimmed;
      const clarifier = buildRegionClarifier();
      appendLocalMessages(trimmed, clarifier);
      setChatInput('');
      return;
    }

    if (effectiveRegion && pendingQuestionRef.current && isRegionOnlyMessage(trimmed)) {
      const followUp = `Region: ${effectiveRegion}. ${pendingQuestionRef.current}`;
      pendingQuestionRef.current = null;
      lastUserMessageRef.current = followUp;
      sendMessage(followUp);
      setChatInput('');
      return;
    }

    lastUserMessageRef.current = trimmed;
    sendMessage(trimmed);
    setChatInput('');
  }, [
    chatError,
    chatInput,
    clearChatError,
    handleSupportRequest,
    isRegionOnlyMessage,
    sendDisabled,
    sendMessage,
    updateRegionFromText,
    needsRegionForQuestion,
    buildRegionClarifier,
    appendLocalMessages,
  ]);

  const onSendSuggestion = useCallback(
    async (prompt: string) => {
      if (chatDisabled) return;
      if (chatError) {
        clearChatError();
      }
      const effectiveRegion = updateRegionFromText(prompt);
      const handled = await handleSupportRequest(prompt);
      if (handled) return;
      if (needsRegionForQuestion(prompt, effectiveRegion)) {
        pendingQuestionRef.current = prompt;
        const clarifier = buildRegionClarifier();
        appendLocalMessages(prompt, clarifier);
        return;
      }
      if (effectiveRegion && pendingQuestionRef.current && isRegionOnlyMessage(prompt)) {
        const followUp = `Region: ${effectiveRegion}. ${pendingQuestionRef.current}`;
        pendingQuestionRef.current = null;
        lastUserMessageRef.current = followUp;
        sendMessage(followUp);
        return;
      }
      lastUserMessageRef.current = prompt;
      sendMessage(prompt);
    },
    [
      chatDisabled,
      chatError,
      clearChatError,
      handleSupportRequest,
      isRegionOnlyMessage,
      sendMessage,
      updateRegionFromText,
      needsRegionForQuestion,
      buildRegionClarifier,
      appendLocalMessages,
    ],
  );

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
        categories?: unknown;
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

      const safetyStatusRaw = String(parsed.safety?.status ?? 'unknown');
      const safetyStatus: SafetyEdibility['status'] =
        safetyStatusRaw === 'safe' || safetyStatusRaw === 'caution' || safetyStatusRaw === 'unknown'
          ? safetyStatusRaw
          : safetyStatusRaw === 'unsafe'
            ? 'caution'
            : safetyStatusRaw === 'uncertain'
              ? 'unknown'
              : 'unknown';

      const prepEaseRaw = String(parsed.preparation?.ease ?? 'unknown');
      const prepEase: Preparation['ease'] =
        prepEaseRaw === 'easy' || prepEaseRaw === 'medium' || prepEaseRaw === 'hard' || prepEaseRaw === 'unknown'
          ? prepEaseRaw
          : 'unknown';

      const safeArray = (value: unknown, max: number): string[] => {
        if (!Array.isArray(value)) return [];
        return value.map((v) => String(v)).filter(Boolean).slice(0, max);
      };

      const rawCommonName = String(parsed.commonName ?? '').trim();
      const commonName = rawCommonName.length > 0 ? rawCommonName : 'Unconfirmed Plant';

      const categories = Array.isArray(parsed.categories)
        ? parsed.categories.map((c) => String(c)).filter((c) => c.trim().length > 0).slice(0, 12)
        : [];

      return {
        commonName,
        scientificName: parsed.scientificName ? String(parsed.scientificName) : undefined,
        confidence,

        bushTuckerLikely: Boolean(parsed.bushTuckerLikely ?? false),
        safety: {
          status: safetyStatus,
          summary: String(parsed.safety?.summary ?? ''),
          keyRisks: safeArray(parsed.safety?.keyRisks, 6),
        },
        categories,
        preparation: {
          ease: prepEase,
          steps: safeArray(parsed.preparation?.steps, 8),
        },
        seasonality: {
          bestMonths: safeArray(parsed.seasonality?.bestMonths, 12),
          notes: String(parsed.seasonality?.notes ?? ''),
        },
        culturalKnowledge: {
          notes: refineCulturalNotes(String(parsed.culturalKnowledge?.notes ?? '')),
          respect: safeArray(parsed.culturalKnowledge?.respect, 6),
        },

        warnings: safeArray(parsed.warnings, 8),
        suggestedUses: safeArray(parsed.suggestedUses, 8),
      };
    },
    [extractJsonFromText],
  );

  const analyzeWithGemini = useCallback(
    async (imagesOverride?: ScanImage[]): Promise<void> => {
      const imagesToUse = Array.isArray(imagesOverride) ? imagesOverride : scanImages;
      const primaryToUse = imagesToUse.length > 0 ? imagesToUse[0] : null;

      console.log('[Scan] analyzeWithGemini start', {
        imageCount: imagesToUse.length,
        mode,
        hasOverride: Boolean(imagesOverride),
      });

    setScanPhase('preparing');
    setScanError(null);
    setScanResult(null);

    if (!geminiApiKey) {
      setScanError('Gemini API key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY.');
      return;
    }

    console.log('[Scan] using gemini api key', { length: geminiApiKey.length });

    if (imagesToUse.length === 0) {
      setScanError('No image data found. Please upload or take a photo again.');
      return;
    }

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
- When sharing cultural knowledge, avoid pan-Indigenous generalisations. Use precise language like “Some species have been traditionally used…” and add “Knowledge and use vary by region and community.”
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

    const imageParts = imagesToUse.map((img, idx) => ({
      inlineData: {
        mimeType: img.mimeType || 'image/jpeg',
        data: img.base64,
      },
      _debugIndex: idx + 1,
    }));

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, ...imageParts.map(({ inlineData }) => ({ inlineData }))],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 700,
      },
    };

    const normalizeModelName = (name: string) => {
      const trimmed = name.trim();
      return trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;
    };

    const listModels = async (apiVersion: 'v1' | 'v1beta'): Promise<string[]> => {
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(geminiApiKey)}`;
      console.log('[Scan] gemini listModels request', { apiVersion });

      setScanPhase('listing-models');

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          
        }
      }, 25000);

      let res: Response;
      let json: GeminiListModelsResponse;
      try {
        res = await fetch(endpoint, { method: 'GET', signal: controller?.signal });
        json = (await res.json()) as GeminiListModelsResponse;
      } finally {
        clearTimeout(timeoutId);
      }

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
      const endpoint = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
      console.log('[Scan] gemini request', { apiVersion, model });

      setScanPhase('sending');

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          
        }
      }, 30000);

      let res: Response;
      let json: GeminiApiResponse;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller?.signal,
        });

        json = (await res.json()) as GeminiApiResponse;
      } finally {
        clearTimeout(timeoutId);
      }
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

          setScanPhase('parsing');

          let parsed: GeminiScanResult;
          try {
            parsed = parseGeminiResult(text);
          } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : String(parseError);
            console.log('[Scan] parseGeminiResult failed', { message });
            throw new Error(`Could not parse Gemini response as JSON. ${message}`);
          }

          setScanResult(parsed);

          try {
            const entryId = createScanEntryId({
              commonName: parsed.commonName,
              scientificName: parsed.scientificName,
              confidence: parsed.confidence,
              imageBase64: primaryToUse?.base64 ?? null,
              imageUri: primaryToUse?.uri ?? null,
            });

            setScanPhase('saving');

            let persistedImageUri: string | undefined = primaryToUse?.uri ?? undefined;
            let previewImageUri: string | undefined = primaryToUse?.previewUri ?? undefined;
            const base64 = primaryToUse?.base64;
            const mimeType = primaryToUse?.mimeType;

            if (Platform.OS === 'web') {
              const maxDataUriLength = 650_000;

              const makeDataUri = (mt: string, data: string) => `data:${mt};base64,${data}`;

              const trySmaller = async (targetWidth: number, compress: number): Promise<string | null> => {
                const ImageManipulator = await getExpoImageManipulator();
                if (!ImageManipulator) return null;
                const manipResult = await ImageManipulator.manipulateAsync(
                  primaryToUse?.uri ?? '',
                  [{ resize: { width: targetWidth } }],
                  {
                    compress,
                    format: ImageManipulator.SaveFormat.JPEG,
                    base64: true,
                  },
                );
                if (typeof manipResult.base64 === 'string' && manipResult.base64.length > 0) {
                  return manipResult.base64;
                }
                return null;
              };

              if (typeof base64 === 'string' && base64.length > 0) {
                const mt = 'image/jpeg';
                let chosenBase64: string | null = base64;

                try {
                  const reduced = await trySmaller(900, 0.6);
                  if (reduced) {
                    chosenBase64 = reduced;
                    console.log('[Scan] web image reduced', { targetWidth: 900, outLength: reduced.length });
                  }
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Scan] web image reduction failed (initial)', { message });
                }

                if (chosenBase64 && chosenBase64.length > maxDataUriLength) {
                  const fallbackCandidates: { width: number; compress: number }[] = [
                    { width: 640, compress: 0.52 },
                    { width: 420, compress: 0.45 },
                  ];

                  for (const candidate of fallbackCandidates) {
                    try {
                      const reduced = await trySmaller(candidate.width, candidate.compress);
                      if (reduced) {
                        chosenBase64 = reduced;
                        console.log('[Scan] web image reduced (fallback)', {
                          targetWidth: candidate.width,
                          outLength: reduced.length,
                        });
                      }
                      if (chosenBase64 && chosenBase64.length <= maxDataUriLength) break;
                    } catch (e) {
                      const message = e instanceof Error ? e.message : String(e);
                      console.log('[Scan] web image reduction failed (fallback)', { message, candidate });
                    }
                  }
                }

                if (chosenBase64 && chosenBase64.length <= maxDataUriLength) {
                  persistedImageUri = makeDataUri(mt, chosenBase64);
                  previewImageUri = persistedImageUri;
                  console.log('[Scan] persisted scan photo (web, size-capped)', {
                    base64Length: chosenBase64.length,
                    dataUriLength: persistedImageUri.length,
                  });
                } else {
                  persistedImageUri = undefined;
                  previewImageUri = undefined;
                  console.log('[Scan] web image too large for storage; skipping image persistence', {
                    base64Length: chosenBase64?.length ?? 0,
                    maxDataUriLength,
                  });
                }
              } else {
                console.log('[Scan] web scan has no base64; using original uri (non-persistent)', { uri: primaryToUse?.uri });
              }
            } else {
              const fs = await getLegacyFileSystem();
              const rawDocDirUri = fs?.documentDirectory ?? fs?.cacheDirectory ?? null;
              const docDirUri = rawDocDirUri ? (rawDocDirUri.endsWith('/') ? rawDocDirUri : `${rawDocDirUri}/`) : null;
              console.log('[Scan] resolved storage directory', { rawDocDirUri, docDirUri, platform: Platform.OS, hasFs: Boolean(fs) });

              if (docDirUri) {
                const scanDirUri = `${docDirUri}scan-journal/`;

                try {
                  if (!fs) {
                    throw new Error('FileSystem unavailable');
                  }
                  await fs.makeDirectoryAsync(scanDirUri, { intermediates: true });
                  console.log('[Scan] ensured scan directory', { scanDirUri });
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Scan] makeDirectoryAsync failed (scan-journal)', { message, scanDirUri });
                }

                const safeFileStem = entryId.replace(/[^a-z0-9-_]+/gi, '-');
                const dest = `${scanDirUri}${safeFileStem}.jpg`;
                const from = primaryToUse?.uri ?? '';
                const fromScheme = from.split(':')[0];

                const attemptTranscodeToJpeg = async () => {
                  console.log('[Scan] transcoding scan photo to JPEG (ImageManipulator)', {
                    from,
                    fromScheme,
                    dest,
                    mimeType,
                    platform: Platform.OS,
                  });

                  const ImageManipulator = await getExpoImageManipulator();
                  if (!ImageManipulator) {
                    throw new Error('ImageManipulator unavailable');
                  }

                  const manipResult = await ImageManipulator.manipulateAsync(
                    from,
                    [{ resize: { width: 1400 } }],
                    {
                      compress: 0.86,
                      format: ImageManipulator.SaveFormat.JPEG,
                    },
                  );

                  console.log('[Scan] transcode result', {
                    intermediateUri: manipResult.uri,
                    intermediateUriScheme: (manipResult.uri ?? '').split(':')[0],
                  });

                  if (!fs) {
                    throw new Error('FileSystem unavailable');
                  }
                  await fs.copyAsync({ from: manipResult.uri, to: dest });
                  persistedImageUri = dest;
                  console.log('[Scan] persisted scan photo via transcode + copy', { dest });
                };

                try {
                  await attemptTranscodeToJpeg();
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Scan] transcodeToJpeg failed; falling back', {
                    message,
                    from,
                    fromScheme,
                    dest,
                    hasBase64: typeof base64 === 'string' && base64.length > 0,
                  });

                  const canCopyDirectly = fromScheme === 'file' || fromScheme === 'content';

                  if (canCopyDirectly) {
                    try {
                      console.log('[Scan] fallback copyAsync', { from, dest, platform: Platform.OS });
                      if (!fs) {
                        throw new Error('FileSystem unavailable');
                      }
                      await fs.copyAsync({ from, to: dest });
                      persistedImageUri = dest;
                      console.log('[Scan] persisted scan photo via fallback copyAsync', { dest });
                    } catch (copyErr) {
                      const copyMsg = copyErr instanceof Error ? copyErr.message : String(copyErr);
                      console.log('[Scan] fallback copyAsync failed; trying base64 write', { copyMsg, from, dest });

                      if (typeof base64 === 'string' && base64.length > 0) {
                        try {
                          if (!fs) {
                            throw new Error('FileSystem unavailable');
                          }
                          await fs.writeAsStringAsync(dest, base64, { encoding: fs.EncodingType.Base64 });
                          persistedImageUri = dest;
                          console.log('[Scan] persisted scan photo via base64 write (final fallback)', { dest, length: base64.length });
                        } catch (writeErr) {
                          const writeMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
                          persistedImageUri = primaryToUse?.uri ?? undefined;
                          console.log('[Scan] base64 write failed; using original uri', {
                            writeMsg,
                            originalUri: primaryToUse?.uri,
                            originalUriScheme: (primaryToUse?.uri ?? '').split(':')[0],
                          });
                        }
                      } else {
                        persistedImageUri = primaryToUse?.uri ?? undefined;
                        console.log('[Scan] no base64 available; using original uri', {
                          originalUri: primaryToUse?.uri,
                          originalUriScheme: (primaryToUse?.uri ?? '').split(':')[0],
                        });
                      }
                    }
                  } else if (typeof base64 === 'string' && base64.length > 0) {
                    try {
                      if (!fs) {
                        throw new Error('FileSystem unavailable');
                      }
                      await fs.writeAsStringAsync(dest, base64, { encoding: fs.EncodingType.Base64 });
                      persistedImageUri = dest;
                      console.log('[Scan] persisted scan photo via base64 write (non-file uri scheme)', { fromScheme, dest, length: base64.length });
                    } catch (writeErr) {
                      const writeMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
                      persistedImageUri = primaryToUse?.uri ?? undefined;
                      console.log('[Scan] base64 write failed; using original uri', {
                        writeMsg,
                        originalUri: primaryToUse?.uri,
                        originalUriScheme: (primaryToUse?.uri ?? '').split(':')[0],
                      });
                    }
                  } else {
                    persistedImageUri = primaryToUse?.uri ?? undefined;
                    console.log('[Scan] cannot persist non-file uri (no base64 available); using original uri', {
                      originalUri: primaryToUse?.uri,
                      originalUriScheme: (primaryToUse?.uri ?? '').split(':')[0],
                    });
                  }
                }
              } else {
                console.log('[Scan] skipping photo persist (no document/cache directory)', { platform: Platform.OS });
              }

              if ((typeof previewImageUri !== 'string' || previewImageUri.length === 0) && Platform.OS !== ('web' as any)) {
                if (typeof base64 === 'string' && base64.length > 0) {
                  try {
                    const ImageManipulator = await getExpoImageManipulator();
                    if (!ImageManipulator) {
                      throw new Error('ImageManipulator unavailable');
                    }

                    const manipPreview = await ImageManipulator.manipulateAsync(
                      primaryToUse?.uri ?? '',
                      [{ resize: { width: 900 } }],
                      {
                        compress: 0.65,
                        format: ImageManipulator.SaveFormat.JPEG,
                        base64: true,
                      },
                    );
                    const outBase64 = typeof manipPreview.base64 === 'string' && manipPreview.base64.length > 0 ? manipPreview.base64 : base64;
                    previewImageUri = `data:image/jpeg;base64,${outBase64}`;
                    console.log('[Scan] generated preview image URI', { outLength: outBase64.length });
                  } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    previewImageUri = `data:${typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'};base64,${base64}`;
                    console.log('[Scan] preview ImageManipulator failed; using raw base64', { message, length: base64.length });
                  }
                }
              }
            }

            const beforeSanitize = persistedImageUri;
            const beforeScheme = (beforeSanitize ?? '').split(':')[0] || 'none';

            if (Platform.OS !== 'web') {
              const scheme = beforeScheme;
              const looksLikeBarePath = typeof beforeSanitize === 'string' && beforeSanitize.startsWith('/');
              const isBadScheme = scheme === 'ph' || scheme === 'assets-library' || scheme === 'content';

              if (looksLikeBarePath) {
                persistedImageUri = `file://${beforeSanitize}`;
                console.log('[Scan] sanitized persistedImageUri (added file:// prefix)', { beforeSanitize, persistedImageUri });
              }

              if (typeof persistedImageUri === 'string' && persistedImageUri.startsWith('file:/') && !persistedImageUri.startsWith('file://')) {
                const fixed = `file:///${persistedImageUri.replace(/^file:\/*/i, '')}`;
                console.log('[Scan] sanitized persistedImageUri (fixed file:/ -> file:///)', { before: persistedImageUri, fixed });
                persistedImageUri = fixed;
              }

              if (isBadScheme && typeof base64 === 'string' && base64.length > 0) {
                const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                persistedImageUri = `data:${mt};base64,${base64}`;
                console.log('[Scan] sanitized persistedImageUri (fallback to data URI for bad scheme)', { scheme, mt, base64Length: base64.length });
              }

              if (typeof persistedImageUri === 'string' && persistedImageUri.startsWith('file://')) {
                try {
                  const fs = await getLegacyFileSystem();
                  if (!fs) {
                    console.log('[Scan] FileSystem not available; skipping getInfoAsync', { uri: persistedImageUri });
                    return;
                  }

                  const info = await fs.getInfoAsync(persistedImageUri);
                  const size =
                    info.exists && 'size' in info && typeof (info as unknown as { size?: number }).size === 'number' && Number.isFinite((info as unknown as { size?: number }).size)
                      ? (info as unknown as { size?: number }).size
                      : undefined;
                  console.log('[Scan] persisted image file info', { exists: info.exists, size, uri: persistedImageUri });
                  if (!info.exists && typeof base64 === 'string' && base64.length > 0) {
                    const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                    persistedImageUri = `data:${mt};base64,${base64}`;
                    console.log('[Scan] persisted image missing on disk; using data URI instead', { mt, base64Length: base64.length });
                  }
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Scan] getInfoAsync failed for persisted image', { message, uri: persistedImageUri });
                }
              }
            }

            const savedEntry = await addEntry({
              id: entryId,
              title: parsed.commonName?.trim().length ? parsed.commonName : 'Unconfirmed Plant',
              imageUri: persistedImageUri,
              imagePreviewUri: previewImageUri,
              chatHistory: journalChatHistory,
              scan: parsed as unknown as JournalGeminiScanResult,
            });

            if (Platform.OS !== 'web') {
              const scheme = (persistedImageUri ?? '').split(':')[0];
              const isProblematic = scheme === 'ph' || scheme === 'assets-library' || scheme === 'content';
              if (isProblematic) {
                console.log('[Scan] WARNING: persistedImageUri is a non-file scheme; it may not render later', {
                  persistedImageUri,
                  scheme,
                  originalUri: primaryToUse?.uri,
                });
              } else {
                console.log('[Scan] persistedImageUri scheme ok', { scheme, persistedImageUri });
              }
            }

            currentEntryIdRef.current = savedEntry.id;

            const confidence = Number.isFinite(savedEntry.scan?.confidence) ? (savedEntry.scan.confidence as number) : 0;
            console.log('[Scan] cook eligibility (derived view)', {
              scanEntryId: savedEntry.id,
              confidence,
              safetyStatus: savedEntry.scan?.safety?.status,
              eligible: savedEntry.scan?.safety?.status === 'safe' && confidence >= 0.75,
            });

            console.log('[Scan] navigating to saved scan details', { scanEntryId: savedEntry.id });
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
      setScanPhase('error');
      setScanError(message);
      Alert.alert('Scan failed', message);
    } finally {
      setAnalyzing(false);
    }
  }, [addEntry, geminiApiKey, getGeminiText, journalChatHistory, mode, parseGeminiResult, scanImages]);

  const collectImages = useCallback(
    async (source: 'camera' | 'library'): Promise<ScanImage[] | null> => {
      const count = mode === 'identify360' ? 3 : 1;
      const label = source === 'camera' ? 'Take photo' : 'Select photo';

      console.log('[Scan] collectImages start', { source, mode, platform: Platform.OS });

      if (source === 'camera' && Platform.OS === 'web') {
        Alert.alert('Unavailable', 'Camera capture is not available in the web preview. Please use Select photo, or open the app on your phone via the QR code.');
        return null;
      }

      if (source === 'library') {
        if (Platform.OS !== 'web') {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need photo library permissions to make this work!');
            return null;
          }
        }
      } else {
        if (Platform.OS !== 'web') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
            return null;
          }
        }
      }

      const next: ScanImage[] = [];

      for (let i = 0; i < count; i += 1) {
        if (count > 1) {
          const stepLabel = i === 0 ? 'front view' : i === 1 ? 'side view' : 'close-up (leaf/fruit)';
          Alert.alert(
            `360 Identify · ${i + 1} / ${count}`,
            `Capture a ${stepLabel}. Keep the plant sharp and fill the frame.`,
            [{ text: 'OK' }],
          );
        }

        const allowsEditing = Platform.OS !== 'ios';

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                allowsEditing,
                aspect: [4, 3],
                quality: 0.92,
                base64: true,
                exif: false,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing,
                aspect: [4, 3],
                quality: 0.92,
                base64: true,
                exif: false,
                selectionLimit: 1,
              });

        if (result.canceled) {
          console.log('[Scan] collectImages cancelled', { source, index: i });
          return null;
        }

        const asset = result.assets?.[0];
        const base64 = asset?.base64;
        const uri = asset?.uri;
        if (!uri) {
          console.log('[Scan] collectImages missing uri', { hasUri: Boolean(uri), hasBase64: Boolean(base64) });
          return null;
        }

        const scheme = uri.split(':')[0];
        const mt = typeof asset?.mimeType === 'string' && asset.mimeType.length > 0 ? asset.mimeType : undefined;
        const base64Clean = typeof base64 === 'string' && base64.length > 0 ? base64 : undefined;
        const previewUri = base64Clean ? `data:${mt ?? 'image/jpeg'};base64,${base64Clean}` : undefined;

        console.log('[Scan] collectImages picked', {
          source,
          index: i,
          uriScheme: scheme,
          hasBase64: Boolean(base64Clean),
          base64Length: base64Clean?.length ?? 0,
          mimeType: mt,
          allowsEditing,
          platform: Platform.OS,
        });

        next.push({
          uri,
          base64: base64Clean,
          mimeType: mt,
          previewUri,
        });
      }

      console.log('[Scan] collectImages success', { label, count: next.length });
      return next;
    },
    [mode],
  );

  const pickImage = useCallback(async () => {
    const imgs = await collectImages('library');
    if (!imgs) {
      setScanError(mode === 'identify360' ? '360 Identify cancelled. Try again and capture all 3 angles.' : null);
      return;
    }
    setScanImages(imgs);
    setScanResult(null);
    setScanError(null);
    await analyzeWithGemini(imgs);
  }, [analyzeWithGemini, collectImages, mode]);

  const takePhoto = useCallback(async () => {
    const imgs = await collectImages('camera');
    if (!imgs) {
      setScanError(mode === 'identify360' ? '360 Identify cancelled. Try again and capture all 3 angles.' : null);
      return;
    }
    setScanImages(imgs);
    setScanResult(null);
    setScanError(null);
    await analyzeWithGemini(imgs);
  }, [analyzeWithGemini, collectImages, mode]);

  const onPressRescan = useCallback(() => {
    if (!canScan) {
      Alert.alert('Cannot scan', 'Please upload or take a new photo first.');
      return;
    }
    analyzeWithGemini(scanImages);
  }, [analyzeWithGemini, canScan, scanImages]);

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
                {primaryImage?.uri ? (
                  <Image
                    source={{ uri: primaryImageDisplayUri ?? primaryImage.uri }}
                    style={styles.focusImage}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="memory-disk"
                    testID="scan-primary-image"
                    onError={(e) => {
                      console.log('[Home] primary image load error', {
                        uri: primaryImageDisplayUri ?? primaryImage.uri,
                        error: (e as unknown as { error?: string })?.error,
                      });
                    }}
                  />
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
                  <Text style={styles.resultTitle}>Bush Tucka ID</Text>
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
                        displaySafetyStatus === 'safe'
                          ? styles.pillGood
                          : displaySafetyStatus === 'caution'
                            ? styles.pillBad
                            : styles.pillNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          displaySafetyStatus === 'safe'
                            ? styles.pillTextGood
                            : displaySafetyStatus === 'caution'
                              ? styles.pillTextBad
                              : styles.pillTextNeutral,
                        ]}
                      >
                        {confidenceGate?.level === 'confident'
                          ? displaySafetyStatus === 'safe'
                            ? 'Safe (Still verify locally)'
                            : displaySafetyStatus === 'caution'
                              ? 'Caution'
                              : 'Unknown / Verify'
                          : confidenceGate?.level === 'likely'
                            ? 'Safety: Verify before consuming'
                            : 'Safety: Observe only'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.pill,
                        confidenceGate?.tone === 'good' ? styles.pillGood : confidenceGate?.tone === 'bad' ? styles.pillBad : styles.pillNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          confidenceGate?.tone === 'good'
                            ? styles.pillTextGood
                            : confidenceGate?.tone === 'bad'
                              ? styles.pillTextBad
                              : styles.pillTextNeutral,
                        ]}
                      >
                        {confidenceGate?.title ?? `Confidence: ${Math.round(scanResult.confidence * 100)}%`}
                      </Text>
                    </View>
                  </View>

                  {confidenceGate?.level && confidenceGate.level !== 'confident' ? (
                    <View style={styles.resultWarningRow} testID="scan-confidence-gate">
                      <ShieldAlert size={16} color="#B91C1C" />
                      <Text style={styles.resultWarningText}>{confidenceGate.blurb}</Text>
                    </View>
                  ) : null}

                  <View style={styles.pill} testID="scan-confidence-percent">
                    <Text style={[styles.pillText, styles.pillTextNeutral]}>Confidence: {Math.round(scanResult.confidence * 100)}%</Text>
                  </View>

                  {scanResult.bushTuckerLikely ? null : (
                    <View style={styles.resultWarningRow} testID="scan-not-bush-tucker">
                      <ShieldAlert size={16} color="#B91C1C" />
                      <Text style={styles.resultWarningText}>
                        This doesn’t look like a known Australian bush tucker item from the photo alone. Please verify before consuming.
                      </Text>
                    </View>
                  )}

                  {confidenceGate?.level === 'confident' && scanResult.safety.summary ? (
                    <Text style={styles.resultNotes} testID="scan-safety-summary">
                      {scanResult.safety.summary}
                    </Text>
                  ) : null}

                  {confidenceGate?.level === 'confident' && scanResult.safety.keyRisks.length > 0 ? (
                    <View style={styles.bullets} testID="scan-safety-risks">
                      <Text style={styles.bulletsTitle}>Is this safe edible bush tucka?</Text>
                      {scanResult.safety.keyRisks.map((w, idx) => (
                        <Text key={`risk-${idx}`} style={styles.bulletText}>
                          • {w}
                        </Text>
                      ))}
                    </View>
                  ) : confidenceGate?.level && confidenceGate.level !== 'confident' ? (
                    <View style={styles.bullets} testID="scan-safety-locked">
                      <Text style={styles.bulletsTitle}>Safety</Text>
                      <Text style={styles.bulletText}>• {confidenceGate.blurb}</Text>
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

                  {confidenceGate?.level === 'confident' && scanResult.preparation.steps.length > 0 ? (
                    <View style={styles.bullets} testID="scan-prep-steps">
                      <Text style={styles.bulletsTitle}>Preparation</Text>
                      {scanResult.preparation.steps.map((s, idx) => (
                        <Text key={`prep-${idx}`} style={styles.bulletText}>
                          • {s}
                        </Text>
                      ))}
                    </View>
                  ) : confidenceGate?.level && confidenceGate.level !== 'confident' ? (
                    <View style={styles.bullets} testID="scan-prep-locked">
                      <Text style={styles.bulletsTitle}>Preparation</Text>
                      <Text style={styles.bulletText}>• Available when confidence is 80%+.</Text>
                    </View>
                  ) : null}

                  {scanResult.seasonality.notes ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Seasonality notes</Text>
                      <Text style={styles.bulletText}>• {scanResult.seasonality.notes}</Text>
                    </View>
                  ) : null}

                  {(scanResult.culturalKnowledge.notes || scanResult.culturalKnowledge.respect.length > 0) ? (
                    <View style={styles.bullets} testID="scan-cultural-knowledge">
                      <Text style={styles.bulletsTitle}>Cultural Knowledge</Text>
                      {scanResult.culturalKnowledge.notes ? (
                        <Text style={styles.bulletText}>• {refineCulturalNotes(scanResult.culturalKnowledge.notes)}</Text>
                      ) : null}
                      {scanResult.culturalKnowledge.respect.map((r, idx) => (
                        <Text key={`respect-${idx}`} style={styles.bulletText}>
                          • {r}
                        </Text>
                      ))}
                      <Text style={styles.culturalFooter} testID="cultural-footer">
                        {CULTURAL_FOOTER}
                      </Text>
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

                  {confidenceGate?.level === 'confident' && scanResult.suggestedUses.length > 0 ? (
                    <View style={styles.bullets} testID="scan-suggested-uses">
                      <Text style={styles.bulletsTitle}>Suggested Uses</Text>
                      {scanResult.suggestedUses.map((u, idx) => (
                        <Text key={`u-${idx}`} style={styles.bulletText}>
                          • {u}
                        </Text>
                      ))}
                    </View>
                  ) : confidenceGate?.level && confidenceGate.level !== 'confident' ? (
                    <View style={styles.bullets} testID="scan-suggested-uses-locked">
                      <Text style={styles.bulletsTitle}>Suggested Uses</Text>
                      <Text style={styles.bulletText}>• Available when confidence is 80%+.</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}

          {/* AI Companion */}
          <View style={styles.chatCard} testID="ai-chat-card">
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <MessageCircle size={18} color={COLORS.primary} />
                <Text style={styles.chatTitle}>Tucka Guide</Text>
              </View>
              <TouchableOpacity style={styles.chatHeaderButton} onPress={resetChatToGreeting} testID="tucka-guide-reset">
                <RefreshCcw size={14} color={COLORS.text} />
                <Text style={styles.chatHeaderButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
            {!scanResult ? (
              <Text style={styles.chatEmptyText}>
                Scan a plant to start a chat based on its Gemini results.
              </Text>
            ) : (
              <>
                <Text style={styles.chatSubtitle}>
                  Ask questions about the scanned plant. Answers are grounded in the scan details.
                </Text>

                {chatError && !/^debug:/i.test(chatError.message ?? '') ? (
                  <View style={styles.chatErrorRow}>
                    <AlertTriangle size={16} color="#B91C1C" />
                    <Text style={styles.chatErrorText}>
                      {isBusyChatError(chatError)
                        ? 'Tucka Guide is busy right now. Retrying…'
                        : chatError.message}
                    </Text>
                    <TouchableOpacity
                      style={styles.chatErrorDismiss}
                      onPress={isBusyChatError(chatError) ? retryChatNow : clearChatError}
                    >
                      <Text style={styles.chatErrorDismissText}>
                        {isBusyChatError(chatError) ? 'Retry now' : 'Dismiss'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {chatDisplayMessages.length > 0 ? (
                  <View style={styles.chatMessages}>
                    {(Array.isArray(chatDisplayMessages) ? chatDisplayMessages : []).map((message) => (
                      <View key={message.id} style={{ gap: 8 }} testID={`tucka-guide-message-${message.id}`}>
                        <View
                          style={[
                            styles.chatBubble,
                            message.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                          ]}
                        >
                          <Text style={styles.chatBubbleText}>{message.text}</Text>
                        </View>

                        {message.role === 'assistant' ? (
                          <View style={styles.chatActionsRow} testID={`tucka-guide-actions-${message.id}`}>
                            <TouchableOpacity
                              style={[styles.chatActionButton, savedGuideByMessageId[message.id] ? styles.chatActionButtonSaved : null]}
                              onPress={() => saveGuideToCook(message.text, message.id)}
                              disabled={!scanResult}
                              testID={`tucka-guide-save-${message.id}`}
                            >
                              <BookmarkPlus size={16} color={savedGuideByMessageId[message.id] ? COLORS.primary : COLORS.text} />
                              <Text style={[styles.chatActionText, savedGuideByMessageId[message.id] ? styles.chatActionTextSaved : null]}>
                                {savedGuideByMessageId[message.id] ? 'Saved' : 'Save'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.chatActionButton}
                              onPress={() => shareOrDownloadGuideText(message.text)}
                              testID={`tucka-guide-export-${message.id}`}
                            >
                              <Share2 size={16} color={COLORS.text} />
                              <Text style={styles.chatActionText}>Export</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.chatActionButton}
                              onPress={() => copyGuideText(message.text)}
                              testID={`tucka-guide-copy-${message.id}`}
                            >
                              <Copy size={16} color={COLORS.text} />
                              <Text style={styles.chatActionText}>Copy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.chatActionButton}
                              onPress={() => shareOrDownloadGuideText(message.text)}
                              testID={`tucka-guide-download-${message.id}`}
                            >
                              <Download size={16} color={COLORS.text} />
                              <Text style={styles.chatActionText}>Download</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {chatBusy ? (
                  <View style={[styles.chatBubble, styles.chatBubbleAssistant]} testID="tucka-guide-thinking">
                    <Text style={styles.chatBubbleText}>Thinking...</Text>
                    {chatTimeout ? (
                      <View style={styles.chatTimeoutRow} testID="tucka-guide-timeout">
                        <Text style={styles.chatTimeoutText}>Taking longer than usual. Check your connection and try again.</Text>
                        <View style={styles.chatTimeoutActions}>
                          <TouchableOpacity
                            style={styles.chatTimeoutButton}
                            onPress={() => {
                              console.log('[TuckaGuide] user pressed Reset chat');
                              clearChatError();
                              resetChatToGreeting();
                            }}
                            testID="tucka-guide-reset-chat"
                          >
                            <Text style={styles.chatTimeoutButtonText}>Reset</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {chatDisplayMessages.length <= 1 ? (
                  <View style={styles.chatSuggestionsRow}>
                    {(Array.isArray(suggestedQuestions) ? suggestedQuestions : []).map((prompt) => (
                      <TouchableOpacity
                        key={prompt}
                        style={styles.chatSuggestion}
                        onPress={() => onSendSuggestion(prompt)}
                        disabled={chatDisabled}
                      >
                        <Text style={styles.chatSuggestionText}>{prompt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Ask about safety, preparation, seasonality..."
                    placeholderTextColor="rgba(242,245,242,0.45)"
                    value={chatInput}
                    onChangeText={setChatInput}
                    editable={!chatDisabled}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.chatSendButton, sendDisabled ? styles.chatSendButtonDisabled : null]}
                    onPress={onSendChat}
                    disabled={sendDisabled}
                    testID="ai-chat-send"
                  >
                    <Send size={16} color={DARK.bg} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Handy Pocket Guides */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Handy Pocket Guides</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => {
                  console.log('[Home] pocket guides: See All pressed');
                  Alert.alert('Coming soon', 'More Handy Pocket Guides are being added.');
                }}
                testID="pocket-guides-see-all"
              >
                <Text style={styles.seeAllText}>See All</Text>
                <ArrowRight size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guidesScroll}>
              <TouchableOpacity
                style={[styles.guideCard, styles.guideCardBrand]}
                onPress={() => {
                  console.log('[Home] open pocket guide', { slug: 'cultural-respect-on-country' });
                  router.push('/pocket-guides/cultural-respect-on-country');
                }}
                testID="pocket-guide-card-cultural-respect"
              >
                <LinearGradient
                  colors={['rgba(56,217,137,0.26)', 'rgba(246,196,69,0.20)', 'rgba(255,140,60,0.14)']}
                  start={{ x: 0.05, y: 0.0 }}
                  end={{ x: 0.95, y: 1.0 }}
                  style={styles.guideCardGlow}
                />

                <View style={styles.guideIconBrand}>
                  <Image
                    source={{
                      uri: 'https://r2-pub.rork.com/generated-images/3557752f-d8c5-4990-8e75-39a56c0573a4.png',
                    }}
                    style={styles.guideIconArt}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={140}
                    testID="pocket-guide-icon-cultural-respect"
                    onLoad={() => console.log('[Home] pocket guide icon loaded', { slug: 'cultural-respect-on-country' })}
                    onError={(e) =>
                      console.log('[Home] pocket guide icon load error', {
                        slug: 'cultural-respect-on-country',
                        error: (e as unknown as { error?: string })?.error,
                      })
                    }
                  />
                </View>

                <Text style={styles.guideTitle} numberOfLines={2}>
                  Cultural respect
                  {'\n'}On Country
                </Text>
                <Text style={styles.guideCount}>Pocket guide</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.guideCard, styles.guideCardBrand]}
                onPress={() => {
                  console.log('[Home] open pocket guide', { slug: 'animal-care-and-share' });
                  router.push('/pocket-guides/animal-care-and-share');
                }}
                testID="pocket-guide-card-animal-care"
              >
                <LinearGradient
                  colors={['rgba(56,217,137,0.22)', 'rgba(246,196,69,0.20)', 'rgba(255,140,60,0.14)']}
                  start={{ x: 0.05, y: 0.0 }}
                  end={{ x: 0.95, y: 1.0 }}
                  style={styles.guideCardGlow}
                />

                <View style={styles.guideIconBrand}>
                  <Image
                    source={{
                      uri: 'https://r2-pub.rork.com/generated-images/fe0dfa28-4dd0-4574-b256-a3bc44b69f81.png',
                    }}
                    style={styles.guideIconArt}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={140}
                    testID="pocket-guide-icon-animal-care"
                    onLoad={() => console.log('[Home] pocket guide icon loaded', { slug: 'animal-care-and-share' })}
                    onError={(e) =>
                      console.log('[Home] pocket guide icon load error', {
                        slug: 'animal-care-and-share',
                        error: (e as unknown as { error?: string })?.error,
                      })
                    }
                  />
                </View>

                <Text style={styles.guideTitle} numberOfLines={2}>
                  Animal Care
                  {'\n'}& Share
                </Text>
                <Text style={styles.guideCount}>Pocket guide</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.guideCard, styles.guideCardBrand]}
                onPress={() => {
                  console.log('[Home] open pocket guide', { slug: 'foraging-with-kids' });
                  router.push('/pocket-guides/foraging-with-kids');
                }}
                testID="pocket-guide-card-foraging-kids"
              >
                <LinearGradient
                  colors={['rgba(56,217,137,0.22)', 'rgba(246,196,69,0.20)', 'rgba(255,140,60,0.14)']}
                  start={{ x: 0.05, y: 0.0 }}
                  end={{ x: 0.95, y: 1.0 }}
                  style={styles.guideCardGlow}
                />

                <View style={styles.guideIconBrand}>
                  <Image
                    source={{
                      uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/q0ba7e9rhso2gk6j3v492',
                    }}
                    style={styles.guideIconArt}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={140}
                    testID="pocket-guide-icon-foraging-kids"
                    onLoad={() => console.log('[Home] pocket guide icon loaded', { slug: 'foraging-with-kids' })}
                    onError={(e) =>
                      console.log('[Home] pocket guide icon load error', {
                        slug: 'foraging-with-kids',
                        error: (e as unknown as { error?: string })?.error,
                      })
                    }
                  />
                </View>

                <Text style={styles.guideTitle} numberOfLines={2}>
                  Foraging
                  {'\n'}With Kids
                </Text>
                <Text style={styles.guideCount}>Pocket guide</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.guideCard, styles.guideCardBrand]}
                onPress={() => {
                  console.log('[Home] open pocket guide', { slug: 'if-something-goes-wrong' });
                  router.push('/pocket-guides/if-something-goes-wrong');
                }}
                testID="pocket-guide-card-if-something-wrong"
              >
                <LinearGradient
                  colors={['rgba(56,217,137,0.18)', 'rgba(246,196,69,0.18)', 'rgba(255,140,60,0.18)']}
                  start={{ x: 0.05, y: 0.0 }}
                  end={{ x: 0.95, y: 1.0 }}
                  style={styles.guideCardGlow}
                />

                <View style={styles.guideIconBrand}>
                  <Image
                    source={{
                      uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/te8vqa5rsun5j348kk3ln',
                    }}
                    style={styles.guideIconArt}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={140}
                    testID="pocket-guide-icon-if-something-wrong"
                    onLoad={() => console.log('[Home] pocket guide icon loaded', { slug: 'if-something-goes-wrong' })}
                    onError={(e) =>
                      console.log('[Home] pocket guide icon load error', {
                        slug: 'if-something-goes-wrong',
                        error: (e as unknown as { error?: string })?.error,
                      })
                    }
                  />
                </View>

                <Text style={styles.guideTitle} numberOfLines={2}>
                  If Something
                  {'\n'}Goes Wrong
                </Text>
                <Text style={styles.guideCount}>Pocket guide</Text>
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
    width: 152,
    padding: 16,
    borderRadius: 24,
    justifyContent: 'space-between',
    height: 176,
  },
  guideCardBrand: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(56,217,137,0.22)',
    overflow: 'hidden',
  },
  guideCardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  guideIconBrand: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(7,10,8,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  guideIconArt: {
    width: 44,
    height: 44,
    backgroundColor: 'transparent',
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
  culturalFooter: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(242,245,242,0.55)',
    fontWeight: '800',
  },
  chatCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: DARK.border,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: 0.3,
  },
  chatHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chatHeaderButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: DARK.text,
  },
  chatSubtitle: {
    fontSize: 12,
    color: DARK.subtext,
    fontWeight: '700',
    marginBottom: 12,
  },
  chatEmptyText: {
    fontSize: 12,
    color: DARK.subtext,
    fontWeight: '700',
  },
  chatErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.12)',
    marginBottom: 10,
  },
  chatErrorText: {
    flex: 1,
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  chatErrorDismiss: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(185, 28, 28, 0.12)',
  },
  chatErrorDismissText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  chatMessages: {
    gap: 10,
    marginBottom: 10,
  },
  chatBubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: '92%',
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(45,211,124,0.18)',
    borderColor: 'rgba(45,211,124,0.28)',
  },
  chatBubbleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: DARK.text,
  },
  chatSuggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chatSuggestion: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatSuggestionText: {
    fontSize: 11,
    color: DARK.subtext,
    fontWeight: '700',
  },
  chatActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 4,
  },
  chatActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatActionButtonSaved: {
    backgroundColor: 'rgba(56,217,137,0.12)',
    borderColor: 'rgba(56,217,137,0.35)',
  },
  chatActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: DARK.text,
    letterSpacing: 0.2,
  },
  chatActionTextSaved: {
    color: COLORS.primary,
  },
  chatTimeoutRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    gap: 10,
  },
  chatTimeoutText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: 'rgba(242,245,242,0.72)',
  },
  chatTimeoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chatTimeoutButton: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  chatTimeoutButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: 0.2,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chatInput: {
    flex: 1,
    color: DARK.text,
    fontSize: 13,
    fontWeight: '600',
    minHeight: 36,
  },
  chatSendButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK.accent,
  },
  chatSendButtonDisabled: {
    opacity: 0.5,
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

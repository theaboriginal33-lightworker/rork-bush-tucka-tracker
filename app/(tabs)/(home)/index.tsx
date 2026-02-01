import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import {
  AlertTriangle,
  ArrowRight,
  Bug,
  ChevronRight,
  HelpCircle,
  Image as ImageIcon,
  Leaf,
  MessageCircle,
  RefreshCcw,
  Scan,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import * as z from 'zod/v4';
import { getSupportDirectory, type SupportOrganization } from '@/constants/supportDirectory';
import {
  createScanEntryId,
  useScanJournal,
  type GeminiScanResult as JournalGeminiScanResult,
  type ScanJournalChatMessage,
} from '@/app/providers/ScanJournalProvider';
import { useCookbook } from '@/app/providers/CookbookProvider';

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
  const { addEntry, updateEntry } = useScanJournal();
  const { addFromScanEntry, getEntryByScanId } = useCookbook();
  const currentEntryIdRef = useRef<string | null>(null);

  type ScanImage = { uri: string; base64: string; mimeType: string };
  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const primaryImage = scanImages.length > 0 ? scanImages[0] : null;

  const [mode, setMode] = useState<'identify' | 'identify360'>('identify');

  const [analyzing, setAnalyzing] = useState<boolean>(false);
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
    return 'uncertain';
  }, [confidenceGate?.level, scanResult]);

  const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  const chatContextKeyRef = useRef<string | null>(null);

  const canScan = useMemo(() => {
    return scanImages.length > 0 && Boolean(apiKey);
  }, [apiKey, scanImages.length]);

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

  const localSupportTool = useMemo(
    () =>
      createRorkTool({
        description:
          'Find local Aboriginal organisations, Land Councils, or community support contacts with phone/address details. Use when the user asks for local verification, guides, councils, or help contacts.',
        zodSchema: z.object({
          query: z.string().optional(),
          region: z.string().optional(),
          limit: z.number().int().min(1).max(6).optional(),
        }),
        execute: async (input) => {
          const directory = await getSupportDirectory();
          const queryTokens = tokenizeSupportText(input.query);
          const regionTokens = tokenizeSupportText(input.region);
          const searchTokens = getSearchTokens([...queryTokens, ...regionTokens]);
          const limit = Number.isFinite(input.limit) ? Math.min(Math.max(Number(input.limit), 1), 6) : 4;

          if (searchTokens.length === 0) {
            return JSON.stringify({
              results: [],
              message: 'Please share your town/state or the organisation name so I can find the right local contacts.',
            });
          }

          const matches = directory.filter((entry: SupportOrganization) => {
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

            if (!searchTokens.every((token) => haystack.includes(token))) return false;
            return true;
          });

          const results = matches.slice(0, limit).map((entry) => ({
            name: entry.name,
            region: entry.region,
            categories: entry.categories,
            phone: entry.phone ?? null,
            address: entry.address ?? null,
            website: entry.website ?? null,
            email: entry.email ?? null,
            notes: entry.notes ?? null,
          }));

          if (results.length === 0) {
            return JSON.stringify({
              results: [],
              message:
                'No local support contacts are configured yet. Ask the user for their region/state or add contacts in the support directory.',
            });
          }

          return JSON.stringify({ results });
        },
      }),
    [getSearchTokens, normalizeSupportText, tokenizeSupportText],
  );

  const tools = useMemo(
    () => ({
      local_support: localSupportTool,
    }),
    [localSupportTool],
  );
  const {
    messages: chatMessagesRaw,
    sendMessage,
    status: chatStatus,
    error: chatError,
    setMessages: setChatMessages,
    clearError: clearChatError,
  } = useRorkAgent({ tools });

  const chatMessages = useMemo((): unknown[] => {
    if (!Array.isArray(chatMessagesRaw)) {
      console.log('[Chat] messages is not an array yet', { type: typeof chatMessagesRaw });
      return [];
    }
    return chatMessagesRaw as unknown[];
  }, [chatMessagesRaw]);

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

    return `You are the Bush Tucker companion for this app. Answer questions only about the scanned plant. Use the scan info as the ground truth, and do not guess beyond it. If the user asks for details that are missing, say you do not have that detail and suggest rescanning or consulting a local Indigenous guide or botanist. Always prioritize safety and remind users to verify before consuming any plant. Respond in plain text only (no markdown headings, no code blocks, no tool logs or execution tags).\n\nIf the user asks for local organisations, contact details, or verification help, call the local_support tool. Only share phone/address/website details that come from the tool results. If the tool returns no results, say you do not have local contacts yet and ask for their town/state or to add contacts.\n\n${gateInstruction}\nConfidence: ${confidencePct}%\n\nScan info:\n${scanContext}`;
  }, [confidenceGate?.level, scanContext, scanResult]);

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

    return `I can answer questions about ${scanResult.commonName}. ${gateLine} ${safetyNote} Need local help? Ask for nearby organisations and include your town or region.`;
  }, [confidenceGate?.level, scanResult]);

  useEffect(() => {
    if (!scanResult || !systemPrompt || !scanContextKey) {
      if (chatContextKeyRef.current) {
        chatContextKeyRef.current = null;
        setChatMessages([]);
        setChatInput('');
      }
      return;
    }

    if (chatContextKeyRef.current === scanContextKey) {
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
  }, [assistantGreeting, scanContextKey, scanResult, setChatMessages, systemPrompt]);

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
        .map((m) => {
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

          return {
            id: typeof message?.id === 'string' ? message.id : `msg-${Math.random().toString(16).slice(2)}`,
            role,
            text: finalText,
          };
        })
        .filter((message): message is { id: string; role: 'user' | 'assistant'; text: string } => Boolean(message));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] chatDisplayMessages compute failed', { msg });
      return [] as { id: string; role: 'user' | 'assistant'; text: string }[];
    }
  }, [chatMessages]);

  const chatBusy = chatStatus === 'submitted' || chatStatus === 'streaming';

  const journalChatHistory = useMemo((): ScanJournalChatMessage[] => {
    return chatDisplayMessages.map((m) => ({
      id: String(m.id),
      role: m.role,
      text: m.text,
      createdAt: Date.now(),
    }));
  }, [chatDisplayMessages]);

  useEffect(() => {
    const entryId = currentEntryIdRef.current;
    if (!entryId) return;
    if (journalChatHistory.length === 0) return;
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

      const searchTokens = getSearchTokens(tokens);
      if (searchTokens.length === 0) {
        appendLocalMessages(
          text,
          'Please share your town/state or the organisation name so I can provide the right local contact details.',
        );
        return true;
      }

      const matches = findSupportEntries(directory, searchTokens);
      if (matches.length === 0) {
        appendLocalMessages(
          text,
          'I do not have a matching local contact yet. Tell me your town/state or the organisation name so I can look it up.',
        );
        return true;
      }

      const response = matches.map((entry) => formatSupportEntry(entry)).join('\n\n');
      const followUp =
        matches.length === 1 ? 'If you need a different area, tell me your town/state.' : 'Tell me your town/state if you need a different area.';
      appendLocalMessages(text, `${response}\n\n${followUp}`);
      return true;
    },
    [appendLocalMessages, findSupportEntries, formatSupportEntry, getSearchTokens, hasSupportIntent, tokenizeSupportText],
  );

  const onSendChat = useCallback(async () => {
    if (sendDisabled) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    if (chatError) {
      clearChatError();
    }

    const handled = await handleSupportRequest(trimmed);
    if (!handled) {
      sendMessage(trimmed);
    }
    setChatInput('');
  }, [chatError, chatInput, clearChatError, handleSupportRequest, sendDisabled, sendMessage]);

  const onSendSuggestion = useCallback(
    async (prompt: string) => {
      if (chatDisabled) return;
      if (chatError) {
        clearChatError();
      }
      const handled = await handleSupportRequest(prompt);
      if (!handled) {
        sendMessage(prompt);
      }
    },
    [chatDisabled, chatError, clearChatError, handleSupportRequest, sendMessage],
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

      console.log('[Scan] analyzeWithGemini start', {
        imageCount: imagesToUse.length,
        mode,
        hasOverride: Boolean(imagesOverride),
      });

    setScanError(null);
    setScanResult(null);

    if (!apiKey) {
      setScanError('Gemini API key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY.');
      return;
    }

    console.log('[Scan] using gemini api key', { length: apiKey.length });

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

          try {
            const entryId = createScanEntryId({
              commonName: parsed.commonName,
              scientificName: parsed.scientificName,
              confidence: parsed.confidence,
              imageBase64: scanImages[0]?.base64 ?? null,
              imageUri: primaryImage?.uri ?? null,
            });

            let persistedImageUri: string | undefined = primaryImage?.uri ?? undefined;
            const base64 = scanImages[0]?.base64;
            const mimeType = scanImages[0]?.mimeType;

            if (Platform.OS === 'web') {
              if (typeof base64 === 'string' && base64.length > 0) {
                const mt = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg';
                persistedImageUri = `data:${mt};base64,${base64}`;
                console.log('[Scan] persisted scan photo as data URI (web)', { mimeType: mt, length: base64.length });
              } else {
                console.log('[Scan] web scan has no base64; using original uri', { uri: primaryImage?.uri });
              }
            } else {
              const docDirUri =
                (FileSystem as unknown as { documentDirectory?: string }).documentDirectory ??
                FileSystem.Paths.document?.uri ??
                null;

              if (docDirUri) {
                const scanDirUri = `${docDirUri}scan-journal/`;

                try {
                  await FileSystem.makeDirectoryAsync(scanDirUri, { intermediates: true });
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Scan] makeDirectoryAsync failed (scan-journal)', { message, scanDirUri });
                }

                const uriExtMatch = (primaryImage?.uri ?? '').match(/\.(png|jpe?g|heic)$/i);
                const extFromUri = uriExtMatch?.[1]?.toLowerCase();
                const extFromMime = mimeType?.includes('png') ? 'png' : mimeType?.includes('heic') ? 'heic' : 'jpg';
                const ext = extFromUri === 'png' || extFromUri === 'jpg' || extFromUri === 'jpeg' || extFromUri === 'heic'
                  ? (extFromUri === 'jpeg' ? 'jpg' : extFromUri)
                  : extFromMime;

                const dest = `${scanDirUri}${encodeURIComponent(entryId)}.${ext}`;
                const from = primaryImage?.uri ?? '';

                try {
                  console.log('[Scan] persisting scan photo to documentDirectory (copyAsync attempt)', {
                    from,
                    dest,
                    mimeType,
                    platform: Platform.OS,
                  });

                  await FileSystem.copyAsync({ from, to: dest });
                  persistedImageUri = dest;
                  console.log('[Scan] persisted scan photo via copyAsync', { dest });
                } catch (copyErr) {
                  const message = copyErr instanceof Error ? copyErr.message : String(copyErr);
                  console.log('[Scan] copyAsync failed; trying base64 write', { message, from, dest });

                  if (typeof base64 === 'string' && base64.length > 0) {
                    try {
                      await FileSystem.writeAsStringAsync(dest, base64, { encoding: 'base64' });
                      persistedImageUri = dest;
                      console.log('[Scan] persisted scan photo via base64 write', { dest, length: base64.length });
                    } catch (writeErr) {
                      const writeMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
                      persistedImageUri = primaryImage?.uri ?? undefined;
                      console.log('[Scan] base64 write failed; falling back to original uri', { writeMsg, originalUri: primaryImage?.uri });
                    }
                  } else {
                    persistedImageUri = primaryImage?.uri ?? undefined;
                    console.log('[Scan] no base64 available; falling back to original uri', { originalUri: primaryImage?.uri });
                  }
                }
              } else {
                console.log('[Scan] skipping photo persist (no documentDirectory)', { platform: Platform.OS });
              }
            }

            const savedEntry = await addEntry({
              id: entryId,
              title: parsed.commonName,
              imageUri: persistedImageUri,
              chatHistory: journalChatHistory,
              scan: parsed as unknown as JournalGeminiScanResult,
            });
            currentEntryIdRef.current = savedEntry.id;

            const confidence = Number.isFinite(savedEntry.scan?.confidence) ? (savedEntry.scan.confidence as number) : 0;
            const shouldAutoAddToCook =
              confidence >= 0.8 &&
              savedEntry.scan?.bushTuckerLikely === true &&
              savedEntry.scan?.safety?.status === 'safe';

            if (shouldAutoAddToCook) {
              const existing = getEntryByScanId(savedEntry.id);
              if (!existing) {
                console.log('[Scan] auto-add to Cook (confidence gate passed)', { scanEntryId: savedEntry.id, confidence });
                try {
                  await addFromScanEntry(savedEntry);
                } catch (e) {
                  const message = e instanceof Error ? e.message : String(e);
                  console.log('[Scan] auto-add to Cook failed', { message, scanEntryId: savedEntry.id });
                }
              } else {
                console.log('[Scan] skip auto-add to Cook (already exists)', { scanEntryId: savedEntry.id, cookId: existing.id });
              }
            } else {
              console.log('[Scan] skip auto-add to Cook (confidence gate not met)', {
                scanEntryId: savedEntry.id,
                confidence,
                bushTuckerLikely: savedEntry.scan?.bushTuckerLikely,
                safetyStatus: savedEntry.scan?.safety?.status,
              });
            }

            console.log('[Scan] navigating to saved scan details', { scanEntryId: savedEntry.id });
            router.push(`/scan/${encodeURIComponent(savedEntry.id)}`);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Scan] saving scan to journal failed', { message });
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
      setScanError(message);
      Alert.alert('Scan failed', message);
    } finally {
      setAnalyzing(false);
    }
  }, [addEntry, addFromScanEntry, apiKey, getEntryByScanId, getGeminiText, journalChatHistory, mode, parseGeminiResult, primaryImage?.uri, scanImages]);

  const collectImages = useCallback(
    async (source: 'camera' | 'library'): Promise<ScanImage[] | null> => {
      const count = mode === 'identify360' ? 3 : 1;
      const label = source === 'camera' ? 'Take photo' : 'Select photo';

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

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.92,
                base64: true,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.92,
                base64: true,
                selectionLimit: 1,
              });

        if (result.canceled) {
          console.log('[Scan] collectImages cancelled', { source, index: i });
          return null;
        }

        const asset = result.assets?.[0];
        const base64 = asset?.base64;
        const uri = asset?.uri;
        if (!uri || !base64) {
          console.log('[Scan] collectImages missing base64/uri', { hasUri: Boolean(uri), hasBase64: Boolean(base64) });
          return null;
        }

        next.push({
          uri,
          base64,
          mimeType: asset?.mimeType ?? 'image/jpeg',
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
                {primaryImage?.uri ? (
                  <Image source={{ uri: primaryImage.uri }} style={styles.focusImage} />
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
                        displaySafetyStatus === 'safe'
                          ? styles.pillGood
                          : displaySafetyStatus === 'unsafe'
                            ? styles.pillBad
                            : styles.pillNeutral,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          displaySafetyStatus === 'safe'
                            ? styles.pillTextGood
                            : displaySafetyStatus === 'unsafe'
                              ? styles.pillTextBad
                              : styles.pillTextNeutral,
                        ]}
                      >
                        {confidenceGate?.level === 'confident'
                          ? displaySafetyStatus === 'safe'
                            ? 'Safe Edible (Check Locally)'
                            : displaySafetyStatus === 'unsafe'
                              ? 'Unsafe / Avoid'
                              : 'Uncertain / Verify'
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
              <MessageCircle size={18} color={COLORS.primary} />
              <Text style={styles.chatTitle}>Bush Tucker Companion</Text>
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

                {chatError ? (
                  <View style={styles.chatErrorRow}>
                    <AlertTriangle size={16} color="#B91C1C" />
                    <Text style={styles.chatErrorText}>{chatError.message}</Text>
                    <TouchableOpacity style={styles.chatErrorDismiss} onPress={clearChatError}>
                      <Text style={styles.chatErrorDismissText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {chatDisplayMessages.length > 0 ? (
                  <View style={styles.chatMessages}>
                    {(Array.isArray(chatDisplayMessages) ? chatDisplayMessages : []).map((message) => (
                      <View
                        key={message.id}
                        style={[
                          styles.chatBubble,
                          message.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                        ]}
                      >
                        <Text style={styles.chatBubbleText}>{message.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {chatBusy ? (
                  <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                    <Text style={styles.chatBubbleText}>Thinking...</Text>
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
    gap: 8,
    marginBottom: 6,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: DARK.text,
    letterSpacing: 0.3,
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

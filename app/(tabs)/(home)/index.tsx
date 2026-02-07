import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, ScrollView, Platform, Alert, Share } from 'react-native';
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

import type {
  GeminiScanResult,
  GeminiApiResponse,
  GeminiListModelsResponse,
  ScanImage,
  ScanPhase,
  ConfidenceGate,
  AgentMessage,
} from './helpers/types';
import {
  getRorkToolkit,
  getLegacyFileSystem,
  getExpoSharing,
  getExpoClipboard,
  getExpoImageManipulator,
} from './helpers/lazyModules';
import {
  CULTURAL_FOOTER,
  refineCulturalNotes,
  generateLocalFallbackResponse,
  getGeminiText,
  parseGeminiResult,
} from './helpers/scanUtils';
import { styles, DARK } from './helpers/styles';

export default function HomeScreen() {
  const { addEntry, updateEntry } = useScanJournal();
  const { saveGuideEntry } = useCookbook();
  const currentEntryIdRef = useRef<string | null>(null);

  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const primaryImage = scanImages.length > 0 ? scanImages[0] : null;
  const primaryImageDisplayUri = primaryImage?.previewUri ?? primaryImage?.uri ?? null;

  const [mode, setMode] = useState<'identify' | 'identify360'>('identify');

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [scanResult, setScanResult] = useState<GeminiScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatTimeout, setChatTimeout] = useState<boolean>(false);
  const chatBusySinceRef = useRef<number | null>(null);

  const confidenceGate = useMemo((): ConfidenceGate | null => {
    const cRaw = scanResult?.confidence;
    const c = typeof cRaw === 'number' && Number.isFinite(cRaw) ? cRaw : null;
    if (c === null) return null;

    if (c >= 0.8) {
      return { level: 'confident', title: 'Confident ID', blurb: 'High confidence identification. Still verify locally before consuming.', tone: 'good' };
    }
    if (c >= 0.6) {
      return { level: 'likely', title: 'Likely match – verify locally', blurb: 'Likely identification. Confirm with local knowledge before consuming.', tone: 'neutral' };
    }
    return { level: 'observe', title: 'Observe only', blurb: 'Low confidence. Observe only — do not rely on this ID for safety or preparation.', tone: 'bad' };
  }, [scanResult?.confidence]);

  const displaySafetyStatus = useMemo((): GeminiScanResult['safety']['status'] | null => {
    if (!scanResult) return null;
    if (confidenceGate?.level === 'confident') return scanResult.safety.status;
    return 'unknown';
  }, [confidenceGate?.level, scanResult]);

  const geminiApiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  const openAiKey = (process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? process.env.EXPO_PUBLIC_OPENAI_KEY ?? '').trim();
  const hasOpenAiKey = openAiKey.length > 0;
  const useRorkBackend = true;
  const chatContextKeyRef = useRef<string | null>(null);
  const systemPromptRef = useRef<string | null>(null);
  const chatRequestIdRef = useRef<number>(0);

  const canScan = useMemo(() => {
    return scanImages.length > 0 && Boolean(geminiApiKey);
  }, [geminiApiKey, scanImages.length]);

  const normalizeSupportText = useCallback((value?: string): string => {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }, []);

  const tokenizeSupportText = useCallback(
    (value?: string): string[] => {
      const normalized = normalizeSupportText(value);
      return normalized.length > 0 ? normalized.split(' ').filter((token) => token.length > 1) : [];
    },
    [normalizeSupportText],
  );

  const supportTriggerTokens = useMemo(
    () => new Set(['contact', 'details', 'phone', 'address', 'email', 'website', 'council', 'land', 'lalc', 'organisation', 'organization', 'verify', 'verification', 'guide', 'elder', 'community', 'help', 'local']),
    [],
  );

  const supportStopTokens = useMemo(
    () => new Set(['a', 'an', 'the', 'what', 'where', 'which', 'when', 'why', 'how', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'would', 'should', 'please', 'tell', 'give', 'show', 'list', 'provide', 'get', 'need', 'looking', 'find', 'search', 'look', 'info', 'information', 'contact', 'contacts', 'details', 'detail', 'phone', 'number', 'address', 'email', 'website', 'council', 'land', 'lalc', 'organisation', 'organisations', 'organization', 'organizations', 'local', 'verify', 'verification', 'guide', 'elder', 'community', 'help', 'who', 'near', 'nearby', 'around', 'me', 'my', 'for', 'to', 'of', 'and', 'this', 'that', 'in', 'on', 'at', 'from', 'with', 'by', 'about']),
    [],
  );

  const getSearchTokens = useCallback(
    (tokens: string[]): string[] => tokens.filter((token) => !supportStopTokens.has(token)),
    [supportStopTokens],
  );

  const hasSupportIntent = useCallback(
    (tokens: string[], directory: SupportOrganization[]): boolean => {
      if (tokens.some((token) => supportTriggerTokens.has(token))) return true;
      const nameTokens = new Set<string>();
      directory.forEach((entry) => {
        tokenizeSupportText(entry.name).filter((token) => token.length >= 3).forEach((token) => nameTokens.add(token));
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

  const [chatMessagesRaw, setChatMessages] = useState<AgentMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<'idle' | 'submitted' | 'streaming'>('idle');
  const [chatError, setChatError] = useState<Error | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const [regionContext, setRegionContext] = useState<string | null>(null);

  const clearChatError = useCallback(() => { setChatError(null); }, []);

  useEffect(() => {
    if (!chatError) return;
    if (chatStatus !== 'idle') return;
    if (chatInput.trim().length === 0) return;
    clearChatError();
  }, [chatError, chatInput, chatStatus, clearChatError]);

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
      const regionTokens = new Set(['nsw', 'qld', 'vic', 'sa', 'wa', 'tas', 'nt', 'act', 'new', 'south', 'wales', 'queensland', 'victoria', 'australia', 'western', 'northern', 'territory', 'coast', 'coastal', 'inland', 'bush', 'rainforest', 'arid', 'tropical', 'temperate', 'east', 'west', 'north']);
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
      const guidanceKeywords = /safe|edible|eat|recipe|cook|cooking|prepare|prep|season|when|use|lookalike|warning|identify|id|plant|bush|tucker|berry|fruit|leaf|seed|root|spice|jam|chutney|sauce/i;
      return guidanceKeywords.test(normalized);
    },
    [normalizeSupportText],
  );

  const sendMessage = useCallback(
    async (userText: string, options?: { retry?: boolean }) => {
      const trimmed = String(userText ?? '').trim();
      if (!trimmed) return;
      const isRetry = options?.retry === true;
      const requestId = chatRequestIdRef.current + 1;
      chatRequestIdRef.current = requestId;
      console.log('[TuckaGuide] sendMessage start', { requestId, isRetry, platform: Platform.OS });

      if (!hasOpenAiKey && !useRorkBackend) {
        setChatStatus('idle');
        setChatError(new Error('OpenAI API key is missing. Set EXPO_PUBLIC_OPENAI_API_KEY in Rork and reload the app.'));
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

      const model = 'gpt-4o-mini';
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      const promptText = systemPromptRef.current ?? 'You are a helpful assistant.';

      const history = (Array.isArray(chatMessagesRaw) ? chatMessagesRaw : [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => {
          const text = Array.isArray(m.parts)
            ? m.parts.filter((p) => p?.type === 'text').map((p) => String(p.text ?? '')).join('')
            : '';
          return { role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: text };
        });

      const shouldAppendUser = !isRetry || history.length === 0 || history[history.length - 1]?.role !== 'user';

      type ToolkitUserMessage = { role: 'user'; content: string };
      type ToolkitAssistantMessage = { role: 'assistant'; content: string };
      type ToolkitMessage = ToolkitUserMessage | ToolkitAssistantMessage;

      const toolkitHistoryMessages: ToolkitMessage[] = (shouldAppendUser
        ? [...history, { role: 'user' as const, content: trimmed }]
        : history)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m): ToolkitMessage => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content ?? '') }));

      const toolkitMessages: ToolkitMessage[] = (() => {
        let systemPrepended = false;
        return toolkitHistoryMessages.map((m) => {
          if (!systemPrepended && m.role === 'user') {
            systemPrepended = true;
            return { role: 'user' as const, content: `[System Instructions]\n${promptText}\n\n[User Message]\n${m.content}` };
          }
          return m;
        });
      })();

      const toolkit = await getRorkToolkit();
      const hasToolkit = Boolean(toolkit?.generateText);
      const shouldUseRorkBackend = Boolean(useRorkBackend && hasToolkit);
      console.log('[TuckaGuide] backend choice', { useRorkBackend, shouldUseRorkBackend, hasToolkit, platform: Platform.OS });

      if (useRorkBackend && !hasToolkit && !hasOpenAiKey) {
        setChatStatus('idle');
        setChatError(new Error('AI chat is unavailable right now. Please reload and try again.'));
        return;
      }

      const requestBody = {
        model,
        messages: [
          { role: 'system' as const, content: promptText },
          ...(shouldAppendUser
            ? [...history.map((m) => ({ role: m.role, content: m.content ?? '' })), { role: 'user' as const, content: trimmed }]
            : history.map((m) => ({ role: m.role, content: m.content ?? '' }))),
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
            try { controller?.abort(); } catch { /* noop */ }
            reject(new Error('Request timeout'));
          }, timeoutMs);
        });

        const runOpenAiDirect = async (): Promise<string> => {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
            body: JSON.stringify(requestBody),
            signal: controller?.signal,
          });
          let json: unknown = null;
          try { json = (await res.json()) as unknown; } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[TuckaGuide] failed to parse json response', { message, status: res.status });
          }
          const data = json as { choices?: { message?: { content?: string | null } | null }[] | null } | null;
          const assistantText = String(data?.choices?.[0]?.message?.content ?? '').trim();
          if (!res.ok || assistantText.length === 0) throw new Error(parseFailureMessage(res.status, json));
          return assistantText;
        };

        const runRorkToolkit = async (): Promise<string> => {
          const maxRetries = 2;
          let lastError: Error | null = null;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              console.log('[TuckaGuide] runRorkToolkit attempt', { attempt, messageCount: toolkitMessages.length });
              const mod = toolkit ?? await getRorkToolkit();
              if (!mod?.generateText) throw new Error('Toolkit generateText not available');
              const response = await mod.generateText({ messages: toolkitMessages });
              const result = String(response ?? '').trim();
              console.log('[TuckaGuide] runRorkToolkit response', { attempt, responseLength: result.length });
              if (result.length > 0) return result;
              if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
              throw new Error('AI returned empty response');
            } catch (e) {
              lastError = e instanceof Error ? e : new Error(String(e));
              console.log('[TuckaGuide] runRorkToolkit error', { attempt, error: lastError.message });
              if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
            }
          }
          throw new Error(`Toolkit error: ${lastError?.message ?? 'Unknown error'}`);
        };

        const requestPromise = (async () => {
          if (shouldUseRorkBackend) {
            try {
              const res = await runRorkToolkit();
              if (res.length > 0) return res;
            } catch (toolkitErr) {
              const toolkitMsg = toolkitErr instanceof Error ? toolkitErr.message : String(toolkitErr);
              console.log('[TuckaGuide] Rork toolkit failed, will try OpenAI', { toolkitMsg });
            }
          }
          if (hasOpenAiKey) {
            try { return await runOpenAiDirect(); } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[TuckaGuide] OpenAI also failed', { message });
              if (shouldUseRorkBackend) throw new Error('AI service temporarily unavailable. Please try again.');
              throw e;
            }
          }
          if (shouldUseRorkBackend) throw new Error('AI service temporarily unavailable. Please try again.');
          throw new Error('AI chat is not configured. Please reload the app.');
        })();

        try {
          const result = await Promise.race([requestPromise, timeoutPromise]);
          return String(result ?? '').trim();
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      };

      const fallbackToRork = async (): Promise<string | null> => {
        try {
          const mod = toolkit ?? (await getRorkToolkit());
          if (!mod?.generateText) return null;
          const response = await mod.generateText({ messages: toolkitMessages });
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
          if (retryDelays[attempt] > 0) await new Promise<void>((resolve) => setTimeout(resolve, retryDelays[attempt]));
          try { assistantText = await runOnce(); break; } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            const shouldRetry = /timeout|network|unavailable|overloaded|rate|quota|busy|429|503/i.test(message);
            console.log('[TuckaGuide] attempt failed', { attempt, message, shouldRetry });
            if (!shouldRetry || attempt === retryDelays.length - 1) throw e;
          }
        }

        const finalAssistantText = String(assistantText ?? '').trim();
        if (finalAssistantText.length === 0) throw new Error('Empty response');

        const assistantMsg: AgentMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: 'assistant',
          parts: [{ type: 'text', text: finalAssistantText }],
          createdAt: Date.now(),
        };

        if (chatRequestIdRef.current !== requestId) return;
        setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), assistantMsg]);
        setChatError(null);
        setChatTimeout(false);
      } catch (e) {
        if (chatRequestIdRef.current !== requestId) return;
        const rawMessage = e instanceof Error ? e.message : String(e);
        console.log('[TuckaGuide] sendMessage failed', { rawMessage, requestId });

        if (shouldUseRorkBackend) {
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
        const isToolkitError = /toolkit error/i.test(rawMessage);
        const isEmptyResponse = /empty response/i.test(rawMessage);
        const isNetworkError = /network|unavailable|timeout|fetch failed|failed to fetch|aborted/i.test(rawMessage);
        const isTemporarilyUnavailable = /temporarily unavailable|service.*unavailable/i.test(rawMessage);
        const isRateLimited = !isToolkitError && !isEmptyResponse && !isNetworkError && !isTemporarilyUnavailable && /rate|quota|busy|overloaded|429|503/i.test(rawMessage);

        const userMessage = isMissingKey
          ? 'OpenAI API key is missing. Set EXPO_PUBLIC_OPENAI_API_KEY in Rork and reload the app.'
          : isInvalidKey ? 'OpenAI API key was rejected. Confirm the key is correct and has access to gpt-4o-mini.'
          : isModelAccess ? 'OpenAI model access error. This key may not have access to gpt-4o-mini.'
          : isRateLimited ? 'Tucka Guide is busy. Please wait a moment and try again.'
          : isTemporarilyUnavailable ? 'Tucka Guide is temporarily unavailable. Please try again in a moment.'
          : isNetworkError ? 'Network issue. Please check your connection and try again.'
          : isEmptyResponse || isToolkitError ? 'I couldn\'t generate a response. Please try rephrasing your question.'
          : rawMessage.trim().length > 0 ? rawMessage : 'Could not send message. Please try again.';

        const localFallback = generateLocalFallbackResponse(scanResult, trimmed, regionContext);
        if (localFallback) {
          console.log('[TuckaGuide] using local scan-data fallback response');
          const localMsg: AgentMessage = {
            id: `assistant-local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: 'assistant',
            parts: [{ type: 'text', text: localFallback }],
            createdAt: Date.now(),
          };
          setChatMessages((prev) => [...(Array.isArray(prev) ? prev : []), localMsg]);
          setChatError(null);
        } else {
          setChatError(new Error(userMessage));
          const fallbackAssistantMsg: AgentMessage = {
            id: `assistant-error-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            role: 'assistant',
            parts: [{ type: 'text', text: userMessage }],
            createdAt: Date.now(),
          };
          setChatMessages((prev) => {
            const base = Array.isArray(prev) ? prev : [];
            const hasRecentError = base.some(
              (m) => m.role === 'assistant' && typeof m.id === 'string' && m.id.startsWith('assistant-error-') && Date.now() - (m.createdAt ?? 0) < 5000,
            );
            if (hasRecentError) return base;
            return [...base, fallbackAssistantMsg];
          });
        }
      } finally {
        if (chatRequestIdRef.current === requestId) setChatStatus('idle');
      }
    },
    [chatMessagesRaw, hasOpenAiKey, openAiKey, regionContext, scanResult, useRorkBackend],
  );

  const chatMessages = useMemo((): unknown[] => {
    if (!Array.isArray(chatMessagesRaw)) return [];
    return chatMessagesRaw as unknown[];
  }, [chatMessagesRaw]);

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
- If not safe, say: "This plant is not suitable for casual cooking. I won't provide a recipe for safety reasons."

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

  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);

  const assistantGreeting = useMemo(() => {
    if (!scanResult) return '';
    const gateLine = confidenceGate?.level === 'confident' ? 'Confident ID (80%+).'
      : confidenceGate?.level === 'likely' ? 'Likely match (60–79%). Confirm with local knowledge before consuming.'
      : 'Observe only (<60%). Do not rely on this ID for safety or preparation.';
    const safetyNote = scanResult.safety.status === 'safe'
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
      cleaned = cleaned.split('\n')
        .filter((line) => !/execute_ipython|execute_python|search_web\(/i.test(line))
        .map((line) => {
          let trimmedLine = line.trim();
          if (trimmedLine.startsWith('#')) trimmedLine = trimmedLine.replace(/^#{1,6}\s*/, '');
          if (/^[-*]\s+/.test(trimmedLine)) trimmedLine = trimmedLine.replace(/^[-*]\s+/, '• ');
          trimmedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '$1');
          trimmedLine = trimmedLine.replace(/\*(.*?)\*/g, '$1');
          return trimmedLine;
        }).join('\n');
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
          const textFromParts = partsArray.filter((part: any) => part?.type === 'text' && typeof part?.text === 'string').map((part: any) => String(part.text ?? '')).join('');
          const text = textFromParts || (typeof message?.content === 'string' ? message.content : typeof message?.text === 'string' ? message.text : '');
          if (!text) return null;
          const role = message?.role === 'user' ? ('user' as const) : ('assistant' as const);
          const cleanedText = role === 'assistant' ? sanitizeChatText(text) : text;
          const finalText = cleanedText.trim() || (role === 'assistant' ? 'I could not find an answer from the scan details.' : text);

          const hashText = (value: string): string => {
            let h = 2166136261;
            for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
            return (h >>> 0).toString(16);
          };

          const rawId = typeof message?.id === 'string' ? message.id : '';
          const stableIdSeed = `${role}|${index}|${finalText.slice(0, 120)}`;
          const id = rawId.trim().length > 0 ? rawId : `msg-${hashText(stableIdSeed)}`;
          const rawCreatedAt = Number(message?.createdAt);
          const createdAtFromMessage = Number.isFinite(rawCreatedAt) ? rawCreatedAt : null;
          const seen = chatCreatedAtByIdRef.current[id];
          const createdAt = typeof seen === 'number' ? seen : typeof createdAtFromMessage === 'number' ? createdAtFromMessage : Date.now();
          if (typeof seen !== 'number') chatCreatedAtByIdRef.current[id] = createdAt;

          return { id, role, text: finalText, createdAt };
        })
        .filter((message): message is { id: string; role: 'user' | 'assistant'; text: string; createdAt: number } => Boolean(message));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] chatDisplayMessages compute failed', { msg });
      return [] as { id: string; role: 'user' | 'assistant'; text: string; createdAt: number }[];
    }
  }, [chatMessages]);

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
      { id: `system-${scanContextKey}`, role: 'system', parts: [{ type: 'text', text: systemPrompt }] },
      { id: `assistant-${scanContextKey}`, role: 'assistant', parts: [{ type: 'text', text: assistantGreeting }] },
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
    if (chatContextKeyRef.current === scanContextKey) return;
    resetChatToGreeting();
  }, [resetChatToGreeting, scanContextKey, scanResult, setChatMessages, systemPrompt]);

  const chatBusy = chatStatus === 'submitted' || chatStatus === 'streaming';
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Array.isArray(chatDisplayMessages)) return;
    const last = [...chatDisplayMessages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    const isSameMessage = lastAssistantMessageIdRef.current === last.id;
    if (!isSameMessage) lastAssistantMessageIdRef.current = last.id;
    if (chatError) clearChatError();
  }, [chatDisplayMessages, chatError, clearChatError]);

  useEffect(() => {
    if (!chatBusy) { setChatTimeout(false); chatBusySinceRef.current = null; return; }
    if (chatBusySinceRef.current === null) { chatBusySinceRef.current = Date.now(); setChatTimeout(false); }
    const activeRequestId = chatRequestIdRef.current;
    const handle = setTimeout(() => {
      if (chatRequestIdRef.current !== activeRequestId) return;
      setChatTimeout(true);
      setChatStatus('idle');
      setChatError(new Error('Tucka Guide timed out. Please try again.'));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 30000);
    return () => { clearTimeout(handle); };
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
        if (!Clipboard) { await Share.share({ message: exportText }); return; }
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
          if (!hasDocument) { await copyGuideText(assistantText); return; }
          const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = safeName; a.rel = 'noopener'; a.target = '_blank';
          document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
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
        if (!baseDir || !fs) { await Share.share({ message: exportText }); return; }
        const fileUri = `${baseDir}${safeName}`;
        await fs.writeAsStringAsync(fileUri, exportText, { encoding: fs.EncodingType.UTF8 });
        const Sharing = await getExpoSharing();
        if (Sharing) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) { await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share / Save' }); return; }
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
      const cleaned = raw.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
      if (!cleaned) return fallback;
      const lines = cleaned.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      const takeFromLine = (line: string): string => {
        const l0 = line.replace(/^```[a-zA-Z0-9_-]*\s*/i, '').replace(/^#+\s*/, '').replace(/^\*\*\s*/, '').replace(/\s*\*\*$/, '').trim();
        return l0.replace(/^recipe\s*(name|title)?\s*[:\-]\s*/i, '').replace(/^title\s*[:\-]\s*/i, '').replace(/^name\s*[:\-]\s*/i, '').trim();
      };
      const candidatePatterns: RegExp[] = [/^#+\s*recipe\s*(name|title)?\s*[:\-]/i, /^recipe\s*(name|title)?\s*[:\-]/i, /^title\s*[:\-]/i, /^name\s*[:\-]/i];
      const bestExplicit = lines.find((l) => candidatePatterns.some((p) => p.test(l)));
      const picked = takeFromLine(bestExplicit ?? (lines[0] ?? ''));
      const finalTitle = picked.length > 0 ? picked : fallback;
      const maxLen = 64;
      const normalized = finalTitle.replace(/\s+/g, ' ').trim();
      return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1).trim()}…` : normalized;
    },
    [scanResult?.commonName],
  );

  const saveGuideToCook = useCallback(
    async (assistantText: string, messageId: string) => {
      if (!scanResult) return;
      if (savedGuideByMessageId[messageId]) { Alert.alert('Already saved', 'This answer is already saved to Cook.'); return; }
      try {
        const title = extractGuideTitle(assistantText);
        const saved = await saveGuideEntry({
          title, guideText: assistantText, commonName: scanResult.commonName, scientificName: scanResult.scientificName,
          imageUri: primaryImageDisplayUri ?? undefined, confidence: scanResult.confidence, safetyStatus: scanResult.safety.status,
          scanEntryId: currentEntryIdRef.current ?? undefined, chatMessageId: messageId, suggestedUses: scanResult.suggestedUses,
        });
        setSavedGuideByMessageId((prev) => ({ ...prev, [messageId]: true }));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert('Saved to Cook', `Saved "${saved.title}".`);
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
      id: String(m.id), role: m.role, text: m.text, createdAt: Number.isFinite(m.createdAt) ? m.createdAt : Date.now(),
    }));
  }, [chatDisplayMessages]);

  const lastSavedChatHashRef = useRef<string>('');

  useEffect(() => {
    const entryId = currentEntryIdRef.current;
    if (!entryId) return;
    if (journalChatHistory.length === 0) return;
    const hash = JSON.stringify(journalChatHistory.map((m) => ({ id: m.id, role: m.role, text: m.text, createdAt: m.createdAt })));
    if (lastSavedChatHashRef.current === hash) return;
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
    return [`Is ${scanResult.commonName} safe to eat?`, 'How should I prepare it?', 'When is it in season?', 'Any warnings or lookalikes?', 'Who can verify this locally?'];
  }, [scanResult]);

  const formatSupportEntry = useCallback((entry: SupportOrganization): string => {
    const lines = [entry.name, entry.region ? `Region: ${entry.region}` : null, entry.phone ? `Phone: ${entry.phone}` : null, entry.address ? `Address: ${entry.address}` : null, entry.email ? `Email: ${entry.email}` : null, entry.website ? `Website: ${entry.website}` : null].filter(Boolean);
    return lines.join('\n');
  }, []);

  const findSupportEntries = useCallback(
    (directory: SupportOrganization[], searchTokens: string[]): SupportOrganization[] => {
      if (searchTokens.length === 0) return [];
      return directory.filter((entry) => {
        const haystack = [entry.name, entry.region, entry.address ?? '', entry.notes ?? '', entry.phone ?? '', entry.email ?? '', entry.website ?? '', ...(entry.categories ?? []), ...(entry.tags ?? [])]
          .map((value) => normalizeSupportText(value)).join(' ');
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
        const userMessage = { id: `user-${stamp}-${Math.random().toString(16).slice(2)}`, role: 'user', parts: [{ type: 'text', text: userText }] };
        const assistantMessage = { id: `assistant-${stamp}-${Math.random().toString(16).slice(2)}`, role: 'assistant', parts: [{ type: 'text', text: assistantText }] };
        return [...base, userMessage, assistantMessage] as unknown as typeof base;
      });
    },
    [setChatMessages],
  );

  const handleSupportRequest = useCallback(
    async (text: string): Promise<boolean> => {
      const directory = await getSupportDirectory();
      const tokens = tokenizeSupportText(text);
      if (!hasSupportIntent(tokens, directory)) return false;
      const regionTokens = getRegionTokens();
      const searchTokens = getSearchTokens(tokens);
      if (searchTokens.length === 0 && regionTokens.length === 0) {
        appendLocalMessages(text, 'Please share your town/state or the organisation name so I can provide the right local contact details.');
        return true;
      }
      const directMatches = searchTokens.length > 0 ? findSupportEntries(directory, searchTokens) : [];
      const regionMatches = directMatches.length === 0 && regionTokens.length > 0 ? findSupportEntries(directory, regionTokens) : [];
      const matches = directMatches.length > 0 ? directMatches : regionMatches;
      if (matches.length === 0) {
        const regionHint = regionContext ? ` (region detected: ${regionContext})` : '';
        appendLocalMessages(text, `I do not have a matching local contact yet${regionHint}. Tell me your town/state or the organisation name so I can look it up, or add contacts to the local directory.`);
        return true;
      }
      const response = matches.map((entry) => formatSupportEntry(entry)).join('\n\n');
      const followUp = matches.length === 1 ? 'If you need a different area, tell me your town/state.' : 'Tell me your town/state if you need a different area.';
      appendLocalMessages(text, `${response}\n\n${followUp}`);
      return true;
    },
    [appendLocalMessages, findSupportEntries, formatSupportEntry, getRegionTokens, getSearchTokens, hasSupportIntent, regionContext, tokenizeSupportText],
  );

  const onSendChat = useCallback(async () => {
    if (sendDisabled) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    if (chatError) clearChatError();
    const effectiveRegion = updateRegionFromText(trimmed);
    const handled = await handleSupportRequest(trimmed);
    if (handled) { setChatInput(''); return; }
    if (needsRegionForQuestion(trimmed, effectiveRegion)) {
      pendingQuestionRef.current = trimmed;
      appendLocalMessages(trimmed, buildRegionClarifier());
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
  }, [chatError, chatInput, clearChatError, handleSupportRequest, isRegionOnlyMessage, sendDisabled, sendMessage, updateRegionFromText, needsRegionForQuestion, buildRegionClarifier, appendLocalMessages]);

  const onSendSuggestion = useCallback(
    async (prompt: string) => {
      if (chatDisabled) return;
      if (chatError) clearChatError();
      const effectiveRegion = updateRegionFromText(prompt);
      const handled = await handleSupportRequest(prompt);
      if (handled) return;
      if (needsRegionForQuestion(prompt, effectiveRegion)) {
        pendingQuestionRef.current = prompt;
        appendLocalMessages(prompt, buildRegionClarifier());
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
    [chatDisabled, chatError, clearChatError, handleSupportRequest, isRegionOnlyMessage, sendMessage, updateRegionFromText, needsRegionForQuestion, buildRegionClarifier, appendLocalMessages],
  );

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
                chatHistory: journalChatHistory,
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
    }, [addEntry, geminiApiKey, journalChatHistory, mode, scanImages]);

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
    analyzeWithGemini(scanImages);
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
                    {scanResult.commonName}{scanResult.scientificName ? ` · ${scanResult.scientificName}` : ''}
                  </Text>
                  <View style={styles.resultMetaRow}>
                    <View style={[styles.pill, displaySafetyStatus === 'safe' ? styles.pillGood : displaySafetyStatus === 'caution' ? styles.pillBad : styles.pillNeutral]}>
                      <Text style={[styles.pillText, displaySafetyStatus === 'safe' ? styles.pillTextGood : displaySafetyStatus === 'caution' ? styles.pillTextBad : styles.pillTextNeutral]}>
                        {confidenceGate?.level === 'confident' ? (displaySafetyStatus === 'safe' ? 'Safe (Still verify locally)' : displaySafetyStatus === 'caution' ? 'Caution' : 'Unknown / Verify') : confidenceGate?.level === 'likely' ? 'Safety: Verify before consuming' : 'Safety: Observe only'}
                      </Text>
                    </View>
                    <View style={[styles.pill, confidenceGate?.tone === 'good' ? styles.pillGood : confidenceGate?.tone === 'bad' ? styles.pillBad : styles.pillNeutral]}>
                      <Text style={[styles.pillText, confidenceGate?.tone === 'good' ? styles.pillTextGood : confidenceGate?.tone === 'bad' ? styles.pillTextBad : styles.pillTextNeutral]}>
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
                      <Text style={styles.resultWarningText}>This does not look like a known Australian bush tucker item from the photo alone. Please verify before consuming.</Text>
                    </View>
                  )}

                  {confidenceGate?.level === 'confident' && scanResult.safety.summary ? (
                    <Text style={styles.resultNotes} testID="scan-safety-summary">{scanResult.safety.summary}</Text>
                  ) : null}

                  {confidenceGate?.level === 'confident' && scanResult.safety.keyRisks.length > 0 ? (
                    <View style={styles.bullets} testID="scan-safety-risks">
                      <Text style={styles.bulletsTitle}>Is this safe edible bush tucka?</Text>
                      {scanResult.safety.keyRisks.map((w, idx) => <Text key={`risk-${idx}`} style={styles.bulletText}>• {w}</Text>)}
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
                      <Text style={styles.infoTileValue}>{scanResult.preparation.ease === 'easy' ? 'Easy' : scanResult.preparation.ease === 'medium' ? 'Medium' : scanResult.preparation.ease === 'hard' ? 'Hard' : 'Unknown'}</Text>
                    </View>
                    <View style={styles.infoTile}>
                      <Text style={styles.infoTileTitle}>Seasonal</Text>
                      <Text style={styles.infoTileValue}>{scanResult.seasonality.bestMonths.length > 0 ? scanResult.seasonality.bestMonths.join(', ') : 'Varies'}</Text>
                    </View>
                  </View>

                  {confidenceGate?.level === 'confident' && scanResult.preparation.steps.length > 0 ? (
                    <View style={styles.bullets} testID="scan-prep-steps">
                      <Text style={styles.bulletsTitle}>Preparation</Text>
                      {scanResult.preparation.steps.map((s, idx) => <Text key={`prep-${idx}`} style={styles.bulletText}>• {s}</Text>)}
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
                      {scanResult.culturalKnowledge.notes ? <Text style={styles.bulletText}>• {refineCulturalNotes(scanResult.culturalKnowledge.notes)}</Text> : null}
                      {scanResult.culturalKnowledge.respect.map((r, idx) => <Text key={`respect-${idx}`} style={styles.bulletText}>• {r}</Text>)}
                      <Text style={styles.culturalFooter} testID="cultural-footer">{CULTURAL_FOOTER}</Text>
                    </View>
                  ) : null}

                  {scanResult.warnings.length > 0 ? (
                    <View style={styles.bullets}>
                      <Text style={styles.bulletsTitle}>Extra Warnings</Text>
                      {scanResult.warnings.map((w, idx) => <Text key={`w-${idx}`} style={styles.bulletText}>• {w}</Text>)}
                    </View>
                  ) : null}

                  {confidenceGate?.level === 'confident' && scanResult.suggestedUses.length > 0 ? (
                    <View style={styles.bullets} testID="scan-suggested-uses">
                      <Text style={styles.bulletsTitle}>Suggested Uses</Text>
                      {scanResult.suggestedUses.map((u, idx) => <Text key={`u-${idx}`} style={styles.bulletText}>• {u}</Text>)}
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

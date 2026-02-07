export type SafetyEdibility = {
  status: 'safe' | 'caution' | 'unknown';
  summary: string;
  keyRisks: string[];
};

export type Preparation = {
  ease: 'easy' | 'medium' | 'hard' | 'unknown';
  steps: string[];
};

export type Seasonality = {
  bestMonths: string[];
  notes: string;
};

export type CulturalKnowledge = {
  notes: string;
  respect: string[];
};

export type GeminiScanResult = {
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

export type GeminiApiResponse = {
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

export type GeminiListModelsResponse = {
  models?: {
    name?: string;
    supportedGenerationMethods?: string[];
  }[];
  error?: { message?: string };
};

export type ScanImage = {
  uri: string;
  base64?: string;
  mimeType?: string;
  previewUri?: string;
};

export type ScanPhase =
  | 'idle'
  | 'preparing'
  | 'listing-models'
  | 'sending'
  | 'parsing'
  | 'saving'
  | 'done'
  | 'error';

export type ConfidenceGate = {
  level: 'confident' | 'likely' | 'observe';
  title: string;
  blurb: string;
  tone: 'good' | 'neutral' | 'bad';
};

export type AgentTextPart = { type: 'text'; text: string };

export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentTextPart[];
  createdAt?: number;
};

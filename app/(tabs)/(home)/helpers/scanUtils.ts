import type { GeminiScanResult, SafetyEdibility, Preparation } from './types';

export const CULTURAL_FOOTER = 'Cultural knowledge shared here is general and non-restricted.';

export function refineCulturalNotes(raw: string): string {
  const note = String(raw ?? '').trim();
  if (note.length === 0) return '';

  const normalized = note.replace(/\s+/g, ' ').trim();
  const oldPhrase = /has been used by Indigenous Australians for food and medicine\.?/i;
  if (oldPhrase.test(normalized)) {
    return 'Some Lilly Pilly species have been traditionally used as food. Knowledge and use vary by region and community.';
  }

  return note;
}

export function generateLocalFallbackResponse(scan: GeminiScanResult | null, userQuestion: string, region: string | null): string | null {
  if (!scan) return null;
  const q = userQuestion.toLowerCase();
  const lines: string[] = [];
  const name = scan.commonName || 'this plant';
  const confidence = Math.round(scan.confidence * 100);
  const isConfident = scan.confidence >= 0.8;

  const wantsRecipe = /recipe|cook|eating|eat|prepare|preparation|how to make|salad|soup|jam|chutney|sauce|roast|fry|boil/i.test(q);
  const wantsSafety = /safe|danger|toxic|poison|risk|edible|warning|lookalike/i.test(q);
  const wantsSeason = /season|month|when|harvest|time of year|best time/i.test(q);
  const wantsUses = /use|benefit|purpose|what can|good for/i.test(q);
  const wantsCulture = /cultur|indigenous|aboriginal|traditional|first nations|respect/i.test(q);
  const wantsRegion = /region|state|area|where|location|coastal|inland|bush|rainforest/i.test(q);

  lines.push(`Best Identification (${confidence}% Confidence)`);
  lines.push(`${name}${scan.scientificName ? ` (${scan.scientificName})` : ''}`);
  lines.push(`Safety: ${scan.safety.status.toUpperCase()}`);
  if (scan.safety.summary) lines.push(scan.safety.summary);
  lines.push('');

  if (wantsSafety || (!wantsRecipe && !wantsSeason && !wantsUses && !wantsCulture)) {
    if (scan.safety.keyRisks.length > 0) {
      lines.push('Key Risks');
      scan.safety.keyRisks.forEach(r => lines.push(`• ${r}`));
      lines.push('');
    }
    if (scan.warnings.length > 0) {
      lines.push('Lookalikes + Warnings');
      scan.warnings.forEach(w => lines.push(`• ${w}`));
      lines.push('');
    }
  }

  if (wantsRecipe || wantsUses) {
    if (!isConfident) {
      lines.push('Uses (Food / Medicine)');
      lines.push(`Confidence is ${confidence}% — too low to recommend preparation or consumption. Please get a local expert to confirm this ID first.`);
      lines.push('');
    } else if (scan.safety.status === 'caution') {
      lines.push('Uses (Food / Medicine)');
      lines.push('This plant has a CAUTION safety status. Do not prepare or eat without expert confirmation of safe handling.');
      lines.push('');
    } else {
      if (scan.suggestedUses.length > 0) {
        lines.push('Uses (Food / Medicine)');
        scan.suggestedUses.forEach(u => lines.push(`• ${u}`));
        lines.push('');
      }
      if (scan.preparation.steps.length > 0) {
        lines.push('Preparation');
        scan.preparation.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
        lines.push('');
      }
      if (wantsRecipe && scan.suggestedUses.length === 0 && scan.preparation.steps.length === 0) {
        lines.push('Bush Tucker Recipe');
        lines.push(`No specific recipe data is available for ${name}. Try searching for "${name} bush tucker recipe" for community-shared ideas. Always verify safety locally before consuming.`);
        lines.push('');
      }
    }
  }

  if (wantsSeason) {
    lines.push('Region + Seasonality');
    if (scan.seasonality.bestMonths.length > 0) {
      lines.push(`Best months: ${scan.seasonality.bestMonths.join(', ')}`);
    } else {
      lines.push('No specific seasonal data available — may be available year-round.');
    }
    if (scan.seasonality.notes) lines.push(scan.seasonality.notes);
    if (region) lines.push(`Your region: ${region}`);
    lines.push('');
  }

  if (wantsCulture) {
    lines.push('Traditional Context (Respectful + General)');
    if (scan.culturalKnowledge.notes) {
      lines.push(scan.culturalKnowledge.notes);
    } else {
      lines.push('No general cultural notes available for this plant.');
    }
    if (scan.culturalKnowledge.respect.length > 0) {
      scan.culturalKnowledge.respect.forEach(r => lines.push(`• ${r}`));
    }
    lines.push('');
  }

  if (wantsRegion && !wantsSeason) {
    if (region) {
      lines.push(`Region noted: ${region}. Guidance above is tailored where possible.`);
    } else {
      lines.push('Tell me your state/region and habitat (coastal, bush, rainforest, arid) for more tailored guidance.');
    }
    lines.push('');
  }

  lines.push('Next Safe Step');
  lines.push('Always verify this identification with a local expert or field guide before consuming. If unsure, observe only.');

  const result = lines.join('\n').trim();
  return result.length > 0 ? result : null;
}

export function getGeminiText(json: { candidates?: { content?: { parts?: { text?: string }[] } }[] }): string {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();
}

export function extractJsonFromText(rawText: string): unknown {
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
}

export function parseGeminiResult(text: string): GeminiScanResult {
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
}

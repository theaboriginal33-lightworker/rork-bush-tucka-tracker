export type SupportOrganization = {
  id: string;
  name: string;
  region: string;
  categories: string[];
  phone?: string;
  address?: string;
  website?: string;
  email?: string;
  notes?: string;
  tags?: string[];
};

const LOCAL_SUPPORT_DIRECTORY: SupportOrganization[] = [
  // Add local organizations here for offline lookups.
  // Example:
  // {
  //   id: 'example-land-council',
  //   name: 'Example Local Aboriginal Land Council',
  //   region: 'NSW - Port Stephens',
  //   categories: ['Local Aboriginal Land Council'],
  //   phone: '(02) 1234 5678',
  //   address: '123 Country Rd, Example NSW 2000',
  //   website: 'https://example.org.au',
  //   notes: 'Call ahead for cultural verification.',
  //   tags: ['verification', 'cultural knowledge'],
  // },
];

const REMOTE_DIRECTORY_TTL_MS = 1000 * 60 * 30;
let cachedRemoteDirectory: SupportOrganization[] | null = null;
let cachedAt = 0;

const toStringOrEmpty = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toStringOrEmpty(item)).filter((item) => item.length > 0);
};

const normalizeEntry = (raw: SupportOrganization): SupportOrganization | null => {
  const name = toStringOrEmpty(raw.name);
  const region = toStringOrEmpty(raw.region);
  const categories = toStringArray(raw.categories);
  if (!name || !region || categories.length === 0) return null;

  const normalized: SupportOrganization = {
    id: toStringOrEmpty(raw.id) || `org-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    region,
    categories,
  };

  const phone = toStringOrEmpty(raw.phone);
  const address = toStringOrEmpty(raw.address);
  const website = toStringOrEmpty(raw.website);
  const email = toStringOrEmpty(raw.email);
  const notes = toStringOrEmpty(raw.notes);
  const tags = toStringArray(raw.tags);

  if (phone) normalized.phone = phone;
  if (address) normalized.address = address;
  if (website) normalized.website = website;
  if (email) normalized.email = email;
  if (notes) normalized.notes = notes;
  if (tags.length > 0) normalized.tags = tags;

  return normalized;
};

const parseDirectoryPayload = (payload: unknown): SupportOrganization[] => {
  if (!payload) return [];
  const items = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload && 'organizations' in payload
      ? (payload as { organizations?: unknown }).organizations
      : null;

  if (!Array.isArray(items)) return [];

  return items
    .map((item) => normalizeEntry(item as SupportOrganization))
    .filter((item): item is SupportOrganization => Boolean(item));
};

export async function getSupportDirectory(): Promise<SupportOrganization[]> {
  const url = (process.env.EXPO_PUBLIC_SUPPORT_DIRECTORY_URL ?? '').trim();
  if (!url) {
    return LOCAL_SUPPORT_DIRECTORY;
  }

  const now = Date.now();
  if (cachedRemoteDirectory && now - cachedAt < REMOTE_DIRECTORY_TTL_MS) {
    return cachedRemoteDirectory;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Support directory request failed (${res.status}).`);
    }

    const json = (await res.json()) as unknown;
    const parsed = parseDirectoryPayload(json);
    cachedRemoteDirectory = parsed.length > 0 ? parsed : LOCAL_SUPPORT_DIRECTORY;
    cachedAt = now;
    return cachedRemoteDirectory;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[SupportDirectory] fetch failed', { message });
    return LOCAL_SUPPORT_DIRECTORY;
  }
}

# Bush Tucka Tracker — Supabase backend summary (client update)

This document describes **what is stored in Supabase** (database tables and file storage), how it supports **sync across devices**, and what the **mobile app** expects. You can share this with stakeholders or your database administrator.

---

## 1. High-level overview

- Users sign in with **Supabase Auth** (same account on phone, tablet, or simulator).
- **Plant scans (Collection)** and **scan photos** sync via a database table plus a **private Storage bucket**.
- **Saved Cook / Tucka Guide entries** (manual saves from chat) sync via a dedicated table.
- **Community map pins** sync via another table.
- **User profile / onboarding / subscription flags** use the `profiles` table.
- **Learn** plant content may be read from a `plants` table (if configured).

All user-owned data uses **Row Level Security (RLS)** so each user can only read and write **their own** rows.

---

## 2. Storage (files — images)

| Item | Value |
|------|--------|
| **Bucket name** | `scan-images` (private) |
| **Path pattern** | `{user_id}/{entry_or_key}.{ext}` (e.g. JPEG after upload) |
| **Used for** | Photos from **Home scan flow**, **Cook** recipe images linked to scans or guides, backfill uploads |
| **App access** | The app requests **time-limited signed URLs** to display images (not public URLs by default) |

**Supabase Dashboard:** Storage → create bucket `scan-images` if it does not exist → set **private** → add policies so authenticated users can upload/read/delete objects under their own `user_id` prefix (matching your RLS rules).

---

## 3. Database tables (used by this app)

### 3.1 `scan_journal_entries` — Collection (scanned plants)

| Column (typical) | Purpose |
|------------------|--------|
| `user_id` | Owner (`auth.users.id`) |
| `id` | Stable entry id (with `user_id`, forms primary key) |
| `storage_path` | Path inside `scan-images` for the photo, or `null` if not uploaded yet |
| `payload` | JSON: title, scan results, notes, chat history metadata, etc. (large/binary image data is minimised for sync) |
| `updated_at` | Last change (optional but recommended for ordering) |

**App behaviour:** On login, the app **downloads** rows for that user, merges with any local data, and **upserts** when scans are added or updated. Images load using `storage_path` + signed URLs when local file paths are not valid on another device.

> **Note:** If this table is not created yet in your Supabase project, add it with RLS policies mirroring other user-scoped tables (`user_id = auth.uid()` for select/insert/update/delete).

---

### 3.2 `cookbook_manual_entries` — Cook (saved Tucka Guide answers)

Defined in repo migration: `supabase/migrations/20260411120000_cookbook_manual_entries.sql`

| Column | Purpose |
|--------|--------|
| `user_id` | Owner |
| `id` | Guide row id |
| `payload` | JSON: title, guide text, plant names, safety, `storage_path` for custom images when applicable, etc. |
| `created_at` / `updated_at` | Timestamps |

**App behaviour:** When the user saves a conversation to **Cook**, the app **upserts** here so **another device** with the same login sees the same saved guides.

---

### 3.3 `community_pins` — Community map

Defined in repo migration: `supabase/migrations/20260410120000_community_pins.sql`

| Column | Purpose |
|--------|--------|
| `user_id` | Owner |
| `id` | Pin id |
| `payload` | JSON: title, coordinates, category, optional `imageUri`, tags, etc. |

---

### 3.4 `profiles` — User profile & app state

Used by auth/onboarding/settings flows (not fully defined in the migrations folder above; usually created during Supabase setup).

Typical fields referenced by the app include:

- `id` (matches `auth.users.id`)
- `onboarding_completed`
- `subscription_active` (and related subscription sync from the app)

---

### 3.5 `plants` — Learn section (optional)

If present, the Learn screens can load plant content from this table. Schema depends on your content setup.

---

## 4. SQL migrations included in this repository

Run these in order in the **Supabase SQL Editor** (or via Supabase CLI) if the objects do not already exist:

| File | Creates |
|------|--------|
| `supabase/migrations/20260410120000_community_pins.sql` | `community_pins` + RLS + `set_updated_at` helper (if needed) |
| `supabase/migrations/20260411120000_cookbook_manual_entries.sql` | `cookbook_manual_entries` + RLS |

**Additionally required in your project (not necessarily in this repo):**

- `scan_journal_entries` table + RLS + indexes as needed  
- `profiles` (and any triggers for new sign-ups)  
- Storage bucket **`scan-images`** + Storage policies  
- Optional: `plants` and any seed data for Learn  

---

## 5. Mobile app configuration

The Expo app reads:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

These must be set in **EAS / build secrets** or `.env` for production builds so **every install** talks to the same Supabase project.

---

## 6. Security summary (for the client)

- **Authentication:** Supabase Auth identifies the user.
- **RLS:** Data rows are scoped with `user_id = auth.uid()` so users cannot read each other’s scans, cook saves, or pins.
- **Storage:** Files should be restricted so users can only access objects under their own prefix (aligned with `scan-images` path design).

---

## 7. Short summary (Hindi — internal / WhatsApp)

**Pehle yahan apna TestFlight link paste karo** (App Store Connect → TestFlight → public link / invite):

- **TestFlight (iOS beta build):** `https://testflight.apple.com/join/____________`  
  _(8-character code App Store Connect se copy karke `____________` ki jagah lagao.)_

**Supabase proof (client / internal):** WhatsApp / email par **1–2 screenshots** attach karo:

1. **Database → Table Editor** — `scan_journal_entries` ya `cookbook_manual_entries` ki 1 row dikh rahi ho.  
2. **Storage** — bucket **`scan-images`** (files / folder structure).

Optional: screenshot file repo mein save karo → `docs/images/supabase-dashboard.png` (instructions: `docs/images/README.md`). PDF / GitHub par share karte waqt embed kar sakte ho.

---

### WhatsApp par copy-paste (Hindi)

```
Bush Tucka Tracker — backend + sync update

📱 iOS (TestFlight):
[PASTE_PUBLIC_LINK — e.g. testflight.apple.com/join/XXXXXXXX]

☁️ Backend: Supabase
• Collection + Cook + pins = cloud sync (same login, any device)
• Photos: scan-images storage bucket

📎 Attachments (is message ke sath):
• Supabase Table Editor screenshot (1 table open)
• Supabase Storage → scan-images screenshot

Tables: scan_journal_entries | cookbook_manual_entries | community_pins | profiles

🤖 Android: [Internal testing / Play link yahan agar ho]
```

---

### Bullets (reference)

- **Storage bucket:** `scan-images` — yahan scan / recipe photos save hote hain.  
- **Tables:** `scan_journal_entries` (Collection), `cookbook_manual_entries` (Cook saves), `community_pins` (map), `profiles` (user), optional `plants` (Learn).  
- **Sync:** Same login se doosre device par data isi database + storage se aata hai.  
- **Repo migrations:** `community_pins` aur `cookbook_manual_entries` ke SQL files `supabase/migrations/` mein hain; baaki tables project ke hisaab se Supabase par banane pad sakte hain.  
- **TestFlight:** Upar wala join link client / testers ko bhejo.  
- **Supabase screenshot:** Internal record + client confidence ke liye — Table Editor + Storage screen.

---

*Document generated for Bush Tucka Tracker. Update this file if schema or bucket names change. **TestFlight URL yahan section 7 mein manually update karte rehna** — har naye build par link same rehta hai aksar, par verify kar lena.*

# Bush Tucka Tracker — Project Handover Document

**Prepared:** 27 April 2026
**Branch Under Review:** `onboarding_flow`
**Target Branch:** `main`
**App Version:** 2.0.0
**Document Purpose:** Pre-merge handover and development ownership transfer

---

## 1. Project Overview

**Application Name:** Bush Tucka Tracker
**Platform:** iOS & Android (React Native / Expo)
**Bundle Identifier (iOS):** `app.rork.bush-tucka-tracker`
**Package Name (Android):** `app.rork.bush_tucka_tracker`
**Repository:** https://github.com/theaboriginal33-lightworker/rork-bush-tucka-tracker

The Bush Tucka Tracker is a mobile application that enables users to identify, track, and learn about Australian bush tucker (native edible plants and animals) using AI-powered scanning via Google Gemini. The app includes community features, a cook guide, a scan journal, an interactive map, and a premium subscription model powered by RevenueCat.

---

## 2. Branch Comparison: `onboarding_flow` vs `main`

The `onboarding_flow` branch is **17 commits ahead** of `main` and contains **73 files changed** with approximately **19,466 line additions** and **1,027 deletions**.

### 2.1 Summary of Changes

| Area | Status |
|------|--------|
| Onboarding Flow (new screens) | Completed |
| Paywall & Subscription UI | Completed |
| In-App Purchase Logic (RevenueCat) | Completed |
| OTP / Phone Verification Screen | Completed |
| Supabase Edge Functions | Completed |
| Database Migrations | Completed |
| App Icon & Splash Screen | Updated |
| Intro Video Asset | Added |
| Google Maps Location Picker | Added |
| Gemini AI Scan Fixes | Completed |
| Privacy Permission Descriptions (App Store rejection fix) | Completed |
| Google Play Closed Testing Setup | Completed |

---

## 3. Completed Work (on `onboarding_flow`)

### 3.1 Onboarding Flow
- Built a full multi-step onboarding experience:
  - Welcome / intro screen (`app/onboarding/index.tsx`)
  - User goals selection (`app/onboarding/goals.tsx`)
  - Data collection (`app/onboarding/collect.tsx`)
  - Intro video playback (`app/onboarding/playvideo.tsx`)
  - Safety introduction (`app/onboarding/safety-intro.tsx`)
  - Safety information screen (`app/onboarding/safety.tsx`)
- Onboarding completion status is stored in Supabase (`profiles.onboarding_completed`).
- App routing respects onboarding state — users are not shown onboarding again after completion.

### 3.2 Paywall & In-App Purchases
- Paywall screen built at `app/paywall/paywall.tsx`.
- Three subscription tiers implemented: Monthly, Annual, Lifetime.
- RevenueCat SDK integrated (`react-native-purchases`) via `hooks/usePurchases.ts`.
- Product IDs configured for both platforms:
  - iOS (App Store): `bushtucka_monthly_v2`, `bushtucka_annual`, `bushtucka_lifetime`
  - Android (Google Play): `bushtucka-monthly-v2`, `bushtucka-annual`, `bushtucka-lifetime`
- Subscription sync between RevenueCat and Supabase via `hooks/useSubscriptionSync.ts`.
- Subscription status is double-checked against RevenueCat on app launch to prevent stale paywall display.

### 3.3 Authentication Updates
- OTP (One-Time Password) phone verification screen added (`app/auth/index.tsx`).
- Phone OTP configured via Supabase native Phone Auth provider using Twilio (Account SID + Message Service SID set up in production).
- Auth flow updated to check both `onboarding_completed` and `subscription_active` on login.

### 3.4 Supabase Backend
- Edge Functions status:
  - `revenuecat-webhook` — deployed and live (200 OK confirmed)
  - `phone-otp` — handled via Supabase native Phone Auth provider (Twilio), no custom Edge Function required
- Two new database migrations applied:
  - `20260410120000_community_pins.sql` — community sighting pins schema
  - `20260411120000_cookbook_manual_entries.sql` — manual cookbook entry schema
- Remote data helpers added for: scan images, scan journal, community pins, cookbook entries.

### 3.5 Map Feature
- Location picker screen added at `app/map/location-picker.tsx`.
- Google Maps integrated for both iOS and Android.

### 3.6 App Store & Google Play
- Privacy permission usage descriptions added to `app.json` / `Info.plist` (addressed App Store Review rejection).
- Google Play closed testing configured.
- App icon and splash screen updated to new branding assets.
- Intro video asset added (`assets/vidos/bushtuckaintro.mov`, ~43 MB).

---

## 4. Pending Tasks

The following items are **not yet complete** and should be addressed before or shortly after merging:

| # | Task | Priority |
|---|------|----------|
| 1 | Submit App Store build (Version 5) for full review | High |
| 2 | Promote Google Play closed test to open testing / production | High |
| 3 | ~~Verify RevenueCat webhooks are live and syncing to Supabase in production~~ — **Done** | ~~High~~ |
| 4 | ~~Apply pending Supabase migrations to the production database~~ — **Done** | ~~High~~ |
| 5 | ~~Deploy Supabase Edge Functions to production environment~~ — **Done** (`revenuecat-webhook` live; phone OTP handled via Supabase native Phone Auth + Twilio) | ~~High~~ |
| 6 | Test full onboarding → paywall → subscription flow on a real device (both platforms) | High |
| 7 | Remove or secure any hardcoded API keys (Google Maps key is visible in `app.json`) | High |
| 8 | End-to-end QA of OTP authentication on both platforms | Medium |
| 9 | Test community pins map feature with live location data | Medium |
| 10 | Confirm intro video plays correctly on low-end Android devices | Medium |
| 11 | Review and clean up `console.log` debug statements left in AuthProvider | Low |

---

## 5. Known Issues & Risks

### 5.1 Hardcoded Google Maps API Key
- **Issue:** The Google Maps API key (`AIzaSyAFrrz5XvKH9nBbIIAyIlLCil0azTKYwA8`) is embedded in plain text inside `app.json`. This key is committed to the repository.
- **Risk:** Anyone with repository access can use or abuse this key, potentially incurring unexpected billing charges.
- **Recommended Action:** Restrict the key in Google Cloud Console to only the app's bundle identifiers, and rotate the key before public release.

### 5.2 Supabase Migrations Applied to Production
- Both database migrations have been successfully applied to the live Supabase production database.
- **Status:** Complete — `community_pins` and `cookbook_manual_entries` tables are live and contain data.
- No further action required for database migrations.

### 5.3 Large Binary Assets in Repository
- The intro video (`assets/vidos/bushtuckaintro.mov` ~43 MB) is committed directly to the Git repository.
- **Risk:** This inflates the repository size and slows cloning. It is not standard practice to store large media in Git.
- **Recommended Action:** Move this file to a CDN or cloud storage (e.g., Supabase Storage, S3) and reference it by URL.

### 5.4 RevenueCat / Supabase Subscription Sync
- **Status:** Complete — `revenuecat-webhook` Edge Function is deployed and returning **200 OK**.
- RevenueCat webhook is active and successfully hitting the Supabase Edge Function endpoint.
- Subscription events (purchases, renewals, cancellations) will sync to Supabase automatically.
- No further action required.

### 5.5 Debug Logging in Production Code
- `AuthProvider.tsx` contains `console.log` statements (e.g., `[fetchOnboarding]`, `[auth] Purchases.getCustomerInfo failed`).
- **Risk:** Logs expose internal state and user IDs in production builds.
- **Recommended Action:** Remove or gate all `console.log` calls behind a `__DEV__` flag.

### 5.6 App Store Review — Version 5
- The previous build was rejected due to missing privacy permission descriptions (now fixed).
- The updated build has been submitted but review outcome is pending.
- **Risk:** A further rejection could delay the iOS release.

---

## 6. Technical Architecture Summary

| Layer | Technology |
|-------|------------|
| Framework | Expo (SDK 54) / React Native 0.81 |
| Routing | Expo Router v6 |
| Language | TypeScript |
| Backend / Database | Supabase (PostgreSQL + Edge Functions) |
| Authentication | Supabase Auth (Email OTP) |
| In-App Purchases | RevenueCat (`react-native-purchases`) |
| AI Scanning | Google Gemini API |
| Maps | Google Maps (`react-native-maps`) |
| State Management | Zustand + React Query (TanStack) |
| Build System | EAS (Expo Application Services) |
| Package Manager | Bun |

---

## 7. Repository Ownership Transfer

### 7.1 GitHub Repository Transfer

To transfer the GitHub repository to the client team:

1. Log in to GitHub as the current owner account (`theaboriginal33-lightworker`).
2. Navigate to the repository: `rork-bush-tucka-tracker`.
3. Go to **Settings → General → Danger Zone**.
4. Click **Transfer ownership**.
5. Enter the destination GitHub username or organisation (provided by the client team).
6. Confirm the transfer by typing the repository name.

> **Note:** After transfer, all existing clone URLs and forks will redirect automatically. Any GitHub Actions workflows or secrets tied to the repository should be reviewed and updated by the new owner.

### 7.2 Adding the Client Team as Collaborators (prior to or instead of transfer)

1. Go to the repository → **Settings → Collaborators and teams**.
2. Click **Add people** or **Add teams**.
3. Assign appropriate roles:
   - **Admin** — for the lead developer or project owner
   - **Maintain** — for senior contributors
   - **Write** — for general developers

---

## 8. Credentials & Access Handover

The following accounts, keys, and credentials must be formally transferred to the client team. Each item should be handed over securely (e.g., via a password manager invitation or encrypted handover session — never via email or chat).

| Service | What to Transfer | Notes |
|---------|-----------------|-------|
| **GitHub** | Repository ownership or collaborator access | See Section 7 |
| **Apple Developer Account** | Team ID `542P4J57LM` — add client as Account Holder or Admin | Log in at developer.apple.com |
| **App Store Connect** | App access for `Bush Tucka Tracker` — invite client Apple ID as Admin | App ID: `app.rork.bush-tucka-tracker` |
| **Google Play Console** | Add client Google account as Owner of the app | Package: `app.rork.bush_tucka_tracker` |
| **Expo / EAS Account** | Current EAS owner: `evish3652` — transfer project or invite client | EAS Project ID: `30746df5-2087-42aa-81da-f27a6d755195` |
| **Supabase Project** | Transfer project ownership or invite client as Owner | Provide project URL and service role key securely |
| **RevenueCat** | Invite client team as Admin to the RevenueCat project | Entitlement: `premium` |
| **Google Cloud / Maps API** | Transfer API key ownership or regenerate a new key under client's GCP account | Restrict key to client's bundle IDs |
| **Google Gemini API** | Provide API key or transfer GCP project | Currently used for plant scanning |
| **Rork Platform** | Project `mvdyra21f77y4oer3x0a6` — transfer or provide access | Used in development start scripts |

---

## 9. Environment Variables & Configuration

The following environment values must be configured in the client's development and CI/CD environment:

| Variable / Config | Location | Description |
|-------------------|----------|-------------|
| Supabase URL | `constants/supabase.ts` | Project API URL |
| Supabase Anon Key | `constants/supabase.ts` | Public client key |
| Google Maps API Key | `app.json` | iOS and Android maps |
| Gemini API Key | (server-side or constants file) | AI plant identification |
| RevenueCat API Keys | `hooks/usePurchases.ts` or env | Separate keys for iOS/Android |
| EAS Project ID | `app.json` → `extra.eas.projectId` | `30746df5-2087-42aa-81da-f27a6d755195` |

> **Security Reminder:** All API keys should be rotated upon ownership transfer. The outgoing development team should revoke their own access to all services after confirming the client team has full access.

---

## 10. Development Environment Setup (for Client Team)

To begin local development after handover:

```bash
# 1. Clone the repository
git clone https://github.com/<new-owner>/rork-bush-tucka-tracker.git
cd rork-bush-tucka-tracker

# 2. Install Bun (package manager used by this project)
curl -fsSL https://bun.sh/install | bash

# 3. Install dependencies
bun install

# 4. Install EAS CLI globally
npm install -g eas-cli

# 5. Log in to Expo with the new account
eas login

# 6. Start the development server
bun start
```

**Prerequisites:**
- Node.js 20+
- Bun package manager
- Xcode (for iOS builds, macOS only)
- Android Studio (for Android builds)
- EAS CLI (`eas-cli`)
- Supabase CLI (for managing edge functions and migrations)

---

## 11. Pre-Merge Checklist

Before merging `onboarding_flow` into `main`, confirm all of the following:

- [ ] Full onboarding flow tested on iOS (real device)
- [ ] Full onboarding flow tested on Android (real device)
- [ ] Paywall and subscription purchase tested on both platforms
- [ ] OTP authentication tested end-to-end
- [ ] Supabase migrations applied to production database
- [ ] Supabase Edge Functions deployed to production
- [ ] RevenueCat webhooks verified and active
- [ ] Google Maps API key restricted to app bundle IDs
- [ ] All `console.log` debug statements removed or gated
- [ ] App Store Version 5 review result confirmed
- [ ] Google Play closed test promoted appropriately
- [ ] Large video asset strategy reviewed (CDN vs Git)
- [ ] All team members have been granted access to production services
- [ ] Outgoing developer access revoked from all services after handover

---

## 12. Contact & Handover Sign-Off

| Role | Name / Handle | Contact |
|------|--------------|---------|
| Outgoing Developer / Owner | `evish3652` / `theaboriginal33-lightworker` | (to be provided) |
| Client Lead / New Owner | (to be completed by client) | — |
| Handover Date | 27 April 2026 | — |

---

*This document was prepared as part of the formal handover process for Bush Tucka Tracker v2.0.0. All items listed as pending or at-risk should be resolved prior to a production release.*

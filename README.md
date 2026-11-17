# AIEM Hunt — Campus Lost & Found Augmented Reality Platform

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.0-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react)](https://react.dev/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 3.4](https://img.shields.io/badge/Tailwind_CSS-3.4.17-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![MongoDB 8.9](https://img.shields.io/badge/MongoDB-Mongoose_8.9-47a248?logo=mongodb)](https://mongoosejs.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Procedural_SFX-purple)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Timezone: Asia/Kolkata](https://img.shields.io/badge/Timezone-Asia%2FKolkata_(IST)-emerald)](https://en.wikipedia.org/wiki/Indian_Standard_Time)

> **Agnel Institute of Engineering and Management (AIEM), Assagao, Goa**  
> Physical Custody &bull; Fraud-Resilient Verification &bull; Live-Ops Gamification &bull; Course-Aligned AI Quests

---

## 1. Overview & Core Philosophy

**AIEM Hunt** merges real-world campus utility (rapid lost-and-found recovery, safe-desk physical custody, single-use handover verification) with live-ops Alternate Reality Game (ARG) mechanics. The platform transforms routine campus vigilance into an engaging, collaborative experience for students, faculty, and security personnel.

```
+-------------------------------------------------------------------------------+
|                            AIEM HUNT DUAL ENGINE                              |
+-------------------------------------------------------------------------------+
|                                                                               |
|   REAL-WORLD UTILITY LAYER                    LIVE-OPS GAMIFICATION           |
|  +---------------------------------+         +-----------------------------+  |
|  |  Lost & Found Registry          |         | Seasonal Prestige Leagues   |  |
|  |  Safe-Desk Physical Custody <------------>| Rush Hour Recon Multipliers |  |
|  |  Single-Use Bcrypt Handover PIN |         | Kinetic Canvas Avatar FX    |  |
|  |  Anti-Collusion & Fraud Checks  |         | Tactical Audio SFX Engine   |  |
|  +---------------------------------+         +-----------------------------+  |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Core Design Pillars
1. **Physical Grounding & Safety First:** Real-world ethical vigilance is rewarded: depositing items at authorized Safe Desks, verifying ownership before claim, and respecting campus hours.
2. **Zero Plaintext Credentials & Strict Privacy:** Handover verification PINs and password-reset OTPs are hashed using `bcrypt` and never exposed via public APIs or visitor feeds. Anonymity/pseudonymity controls protect sensitive student records.
3. **Tactical "Cyber-Noir" Aesthetic:** High-contrast dark mode HUD, glassmorphism, procedural sound synthesis, and GPU-accelerated canvas particle shaders.
4. **Anti-Inflationary Economy:** Fixed vanity sinks, non-linear XP thresholds, and pair-collusion throttling prevent bot farming and reward inflation.

---

## 2. Key Systems & Modules

### 2.1 Physical Safe-Desk & Handover Workflow
- **Item Lifecycle:** Unverified Finder Report $\rightarrow$ Safe-Desk Physical Deposit $\rightarrow$ Custody Verification $\rightarrow$ Claimant Inquiry $\rightarrow$ Single-Use Handover Verification $\rightarrow$ Dual-Party Signed Release.
- **Handover Security:** Single-use 6-digit handover PIN hashed via `bcryptjs`. Staff scans/inputs the code to execute immutable transfer of custody.
- **Collusion Guard:** Automated `checkPairCollusion` flags reciprocal reporting loops between pairs exceeding 2 returns in 30 days.

### 2.2 Procedural Tactical Web Audio Engine (`src/lib/audio/sfx.ts`)
- **Zero Asset Latency:** Procedural sound synthesis via the Web Audio API with microsecond response times and zero external network assets.
- **Soundscape Profiles:**
  - `playRadarPing`: High-frequency directional chirp for scanner beacons.
  - `playDecryptionStutter`: 4-beat mechanical cryptographic solve stutter for clue deductions.
  - `playLevelUpFanfare`: Polyphonic cybernetic synth chord progression.
  - `playCoinCascade`: Metallic micro-click cascade for bounty claims.
  - `playLockerEquip`: Pneumatic servo latch `CLACK` for cosmetic changes.
  - `playSafeDeskStamp`: Low-pass 120Hz magnetic solenoid `THUD` for custody handovers.
- **Audio Control:** Toggle button on the global HUD with persistent `localStorage` quiet-mode preferences.

### 2.3 Kinetic Canvas Avatar Shaders (`src/components/profile/KineticAvatarFX.tsx`)
- **GPU 2D Particle Shaders:**
  - **Streak 3–6 Days:** *Ember Drifter* (floating golden embers).
  - **Streak 7–14 Days:** *Ion Arc Discharge* (cyan electric sparks arcing across the avatar rim).
  - **Streak 15–29 Days:** *Void Singularity* (violet gravitational distortion with accretion dots).
  - **Streak 30+ Days:** *Solar Flare Corona* (radiant gold prominence flares).
  - **Cosmetic Override:** *Holo-Glitch* horizontal scanline slivers.
- **Accessibility & Low Power:** Automatic hardware detection downgrades to accessible static CSS glow rings on `prefers-reduced-motion` or low-concurrency devices ($\le 2$ cores).
- **Legendary Typography:** Animated gradient sheen shaders (`.title-apex-grandmaster`, `.title-phantom-custodian`, `.title-campus-oracle`).

### 2.4 Seasonal Prestige Leagues & Compressed Soft Reset (`src/lib/seasons.ts`)
- **Academic Trimester Cadence (Asia/Kolkata):**
  - **Season Alpha (Fall Semester):** *"The Autumn Reconnaissance"* (Aug – Nov)
  - **Season Beta (Spring Semester):** *"The Midnight Protocol"* (Jan – Apr)
  - **Season Gamma (Summer Sprint):** *"The Solstice Syndicate"* (May – Jul)
  - **Intermission & Audit:** December calibration period.
- **6 Competitive Tiers:** *Bronze Scout* (0–999), *Silver Tracker* (1,000–1,999), *Gold Sleuth* (2,000–3,499), *Platinum Sentinel* (3,500–4,999), *Diamond Vanguard* (5,000–7,499), and *Apex Grandmaster* (7,500+).
- **Compressed Soft Reset Formula:**
  $$\text{Trophies}_{\text{New}} = \text{TrophyFloor} + \lfloor (\text{Trophies}_{\text{Old}} - \text{TrophyFloor}) \times 0.40 \rfloor$$
  *(Players below 1,000 trophies do not decay. Prestige Shard payouts are calculated at season close).*

### 2.5 Live-Ops Community Mini-Events (`src/lib/communityEvents.ts`)
- **Rush Hour Recon:** Active during peak arrival and departure times (08:30–09:30 & 16:30–17:30 IST), granting **+50% XP Boost (1.5x)** and **+20 Bonus Coins** on all investigations.
- **Tactical Syndicate Weekends:** Friday 18:00 to Sunday 23:59 IST with **2.0x Squad XP Multipliers**.
- **Emergency Campus Beacons:** Critical lost items (Student ID cards, admit cards, scientific calculators, prescription inhalers, hard drives) automatically trigger double bounty rewards (2.0x).
- **Live Telemetry Bar:** Dynamic HUD banner on the quests board displaying live event countdowns and active multipliers.

### 2.6 Daily Quests Retention Engine (`src/lib/dailyQuests.ts`)
- Grounded strictly to `Asia/Kolkata` midnight rollover (00:00:00 IST / 18:30:00 UTC).
- Dynamic streak multipliers and daily caps preventing economic exploitation.

---

## 3. Tech Stack

- **Framework:** Next.js 15.1.0 (App Router, Server Components, Route Handlers)
- **UI Library:** React 19.0.0
- **Styling:** Tailwind CSS 3.4.17 with custom tactical cyber-noir design tokens
- **Animations:** Framer Motion 11.15.0 & HTML5 Canvas 2D
- **Database & ODM:** MongoDB with Mongoose 8.9.2
- **Authentication:** `jose` JWT stateless sessions + `bcryptjs` password/PIN hashing
- **Audio:** Web Audio API (procedural synthesis, zero external assets)
- **Maps:** Leaflet 1.9.4 with custom dark mode tiles
- **Validation:** Zod 3.24.1
- **Testing:** `tsx` + Puppeteer (responsive viewport matrix)

---

## 4. Project Directory Structure

```
aiem-hunt/
├── docs/
│   └── FEATURE_ROADMAP.md        # Complete game design and live-ops specification
├── public/                       # Static public assets, maps, and icons
├── src/
│   ├── app/                      # Next.js 15 App Router pages & API routes
│   │   ├── api/                  # 90+ REST API route endpoints
│   │   │   ├── admin/            # Administrative queues, audit logs, economy adjust
│   │   │   ├── auth/             # Login, register, forgot-password, session me
│   │   │   ├── claims/           # Claim filing, verification, and handover codes
│   │   │   ├── items/            # Lost and found reporting & custody tracking
│   │   │   ├── quests/           # Solo, squad, and daily quest completion
│   │   │   ├── rewards/          # Cosmetic catalogue purchase transactions
│   │   │   ├── squads/           # Squad operations, member management, hunts
│   │   │   └── user/             # Profile, privacy settings, operations ledger
│   │   ├── dashboard/            # Player HQ & command center
│   │   ├── events/               # Campus events & mystery expeditions
│   │   ├── items/                # Item detail views, error boundaries, skeletons
│   │   ├── leaderboard/          # Department and seasonal trophy leaderboards
│   │   ├── lost-and-found/       # Search directory, report-lost, report-found
│   │   ├── map/                  # Interactive campus sector map
│   │   ├── profile/              # Agent hero dossier, locker tab, trophy room
│   │   ├── quests/               # Live quest board, daily rotation, investigations
│   │   ├── rewards/              # Virtual vanity shop
│   │   ├── squads/               # Squad headquarters & raid clues
│   │   └── staff/                # Safe-Desk custody intake and queue terminal
│   ├── components/               # Modular React UI components
│   │   ├── dashboard/            # Live telemetry bar, quick stats
│   │   ├── lost-and-found/       # Handover chat, directory item cards
│   │   ├── profile/              # AgentHeroCard, KineticAvatarFX, locker tab
│   │   └── squads/               # Squad roster, hunt boards
│   ├── lib/                      # Core business logic & engines
│   │   ├── audio/sfx.ts          # Procedural Web Audio API synthesizer
│   │   ├── communityEvents.ts    # Rush Hour Recon & Syndicate Weekend engine
│   │   ├── cosmetics.ts          # Cosmetic catalogue & unlock validations
│   │   ├── dailyQuests.ts        # Asia/Kolkata daily quest rotation engine
│   │   ├── economy.ts            # Non-linear progression, rewards, anti-collusion
│   │   ├── progression.ts        # Polynomial XP scaling math
│   │   └── seasons.ts            # 12-week trimester leagues & soft reset
│   ├── models/                   # Mongoose schemas & data contracts
│   └── scripts/                  # Automated & adversarial test suites
└── package.json
```

---

## 5. Getting Started

### Prerequisites
- **Node.js:** `>= 18.18.0` (Node 20+ recommended)
- **MongoDB:** `>= 6.0` (running locally on port `27017` or via MongoDB Atlas)
- **npm:** `>= 9.0.0`

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/aiem-hunt.git
   cd aiem-hunt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create `.env.local` by copying `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   *Required minimum variables:*
   ```env
   MONGODB_URI="mongodb://127.0.0.1:27017/aiem_hunt"
   NEXTAUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   JWT_SECRET="your-cryptographically-secure-jwt-secret-min-32-chars"
   VARIANT_SECRET="your-variant-cryptographic-seed-secret-2026"
   ```

4. **Seed Database (Admin & Sample Data):**
   ```bash
   npm run seed:admin
   npm run seed:items
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Available Scripts & Testing Matrix

AIEM Hunt includes an automated verification and adversarial testing pipeline:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server with hot-reloading |
| `npm run build` | Compiles optimized Next.js 15 production build (all 74 routes) |
| `npm run start` | Launches Next.js production server |
| `npm run typecheck` | Executes `tsc --noEmit` across all App Router routes |
| `npm run lint` | Runs Next.js ESLint validation |
| `npm test` | Safe test harness (bcrypt handover PIN, JWT, safe-desk custody) |
| `npm run test:daily` | Daily quest rotation & Asia/Kolkata midnight rollover suite |
| `npm run test:quests` | Course syllabus AI alignment & HMAC anti-cheat verification |
| `npm run test:trophies` | Operative and squad trophy standings integration |
| `npm run test:leaderboard` | Privacy masking, department filters, and dynamic squads |
| `npm run test:profile-audit`| Visitor privacy leak audit & role boundary checks |
| `npm run test:viewports` | Puppeteer matrix across 41 mobile, tablet, and desktop viewports |

### Individual Feature Test Suites
```bash
npx tsx src/scripts/test_tactical_audio_engine.ts    # Web Audio SFX API & SSR safety
npx tsx src/scripts/test_kinetic_avatar_fx.ts        # Canvas particle shaders & A11y
npx tsx src/scripts/test_seasonal_leagues.ts         # Trimester calendar & soft reset math
npx tsx src/scripts/test_community_events.ts         # Rush Hour & Syndicate Weekend windows
npx tsx src/scripts/adversarial_challenger_pr4_comprehensive.ts # High-concurrency route blast
```

---

## 7. Security & Privacy Invariants

- **Zero Plaintext Sensitive Data:** Handover PINs (`ClaimRequest.handoverCodeHash`) and password-reset OTPs (`User.emailOtpHash`) use `bcrypt`. Raw values are never stored or logged.
- **Visitor Privacy Boundaries:** Visitor queries never return student IDs, email addresses, phone numbers, or private ledger transactions.
- **Local Isolation Assurance:** All test runners strictly enforce loopback database URIs (`assertSafeConnectionUri`), preventing accidental execution against staging or production databases.
- **Race Condition Prevention:** Critical wallet and reward adjustments use `withUserLock` mutex serialization to prevent double-claim attacks.

---

## 8. License & Institutional Attribution

Developed for **Agnel Institute of Engineering and Management (AIEM)**, Assagao, Goa.  
All rights reserved. Proprietary software for university campus deployment.


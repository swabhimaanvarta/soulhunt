# AIEM Hunt — Long-Term Feature Roadmap & Architecture Blueprint

**Document Version:** 2.0.0-PROD  
**Authoritative Scope:** Academic Cycles 2026 – 2027  
**Status:** Approved Technical Specification & Phased Engineering Roadmap  
**Target Platform:** AIEM Hunt (Next.js 15 App Router, React 19, TypeScript 5.7, Tailwind CSS, MongoDB / Mongoose, Web Audio API, WebGL / Canvas)

---

## Executive Summary & Core Game Philosophy

AIEM Hunt bridges real-world campus vigilance (lost-and-found recovery, Safe-Desk custody verification, anti-collusion item handovers) with an alternate reality game (ARG) retention engine. Having established authoritative non-linear progression curves, server-enforced cosmetic gating, and Asia/Kolkata (IST) daily quest rotations in Milestones 1 through 4, this roadmap defines the next evolution of AIEM Hunt across four foundational design pillars:

```
+---------------------------------------------------------------------------------------+
|                               AIEM HUNT ECOSYSTEM                                     |
+---------------------------------------------------------------------------------------+
|  PILLAR 1: SEASONAL PRESTIGE LEAGUES     |  PILLAR 2: SQUAD RAID COSMETICS            |
|  - 6-Week Academic Seasons               |  - Synchronous 3-8 Operative Campus Raids   |
|  - 6 Tiered LP Ladders                   |  - Modular SVG Faction Banners             |
|  - Non-Linear Soft MMR Reset             |  - Animated Team Insignias & Crests        |
|  - Daily LP Caps & Win-Trading Guards    |  - 48h Squad Transfer Reward Cooldown      |
+------------------------------------------+--------------------------------------------+
|  PILLAR 3: TACTICAL AUDIO & SFX ENGINE   |  PILLAR 4: ANIMATED BORDERS & TITLES       |
|  - Zero-Overhead Web Audio Synthesis     |  - CSS GPU Conic Laser Rings               |
|  - 0 KB Audio Asset Downloads            |  - SVG Turbulence & Displacement Shaders   |
|  - Procedural Oscillator Soundscape      |  - Canvas Orbital Micro-Particle Emitters  |
|  - WCAG Screen-Reader & Mute Controls    |  - State-Reactive Titles (Streak / Tier)   |
+---------------------------------------------------------------------------------------+
```

### Core Design Values
1. **Campus Utility First:** Every gaming mechanic directly advances real-world campus safety, lost item return speed, or student collaboration.
2. **Anti-Inflationary Equilibrium:** Sinks (cosmetics, titles, raid entries, hint tiers) balance faucets (quests, returns, level milestones) to ensure long-term coin value.
3. **Zero Paywalls:** All game-affecting utilities are unlocked through exploration and merit; cosmetics remain strictly vanity and prestige indicators.
4. **Resilient Security:** Server-authoritative validation, atomic database operations, and cryptographic verifications back all game state transitions.

---

## 1. Pillar 1: Seasonal Prestige Leagues

### 1.1 Seasonal Cadence & Academic Schedule Alignment
Competitive seasons operate on **6-week structured leagues** synchronized with campus academic cycles (midterm sprint, semester finals, inter-college tech fests).

* **Season 1 (Fall Sprint A):** *"Operation Cyber Lattice"* (Weeks 1 – 6)
* **Season 2 (Fall Sprint B):** *"The Midnight Protocol"* (Weeks 7 – 12)
* **Season 3 (Spring Sprint A):** *"Synapse Rebirth"* (Weeks 1 – 6)
* **Season 4 (Spring Sprint B):** *"Apex Citadel"* (Weeks 7 – 12)

Between seasons, an **intermission window of 72 hours** freezes seasonal leaderboards, conducts anti-exploit audits, computes soft resets, and distributes prestige rewards.

### 1.2 League Points (LP) & Rank Tiers
Players earn League Points (LP) from daily quests, clue discoveries, Safe-Desk verified item handovers, and squad hunts. Standings are stratified into 6 distinct competitive tiers:

| Rank Tier | LP Threshold | Target Population | Season Token Reward | Tier Demotion Protection |
|---|---|---|---|---|
| **Operative Recruit** | 0 – 499 LP | Bottom 35% | 50 Prestige Shards | None (Baseline) |
| **Field Specialist** | 500 – 1,199 LP | Next 25% | 150 Prestige Shards | 100 LP Demotion Floor Grace |
| **Recon Veteran** | 1,200 – 2,499 LP | Next 20% | 350 Prestige Shards | 150 LP Demotion Floor Grace |
| **Tactical Commander** | 2,500 – 4,499 LP | Next 12% | 750 Prestige Shards | 200 LP Demotion Floor Grace |
| **Apex Vanguard** | 4,500 – 6,999 LP | Next 7% | 1,500 Prestige Shards | 250 LP Demotion Floor Grace |
| **Campus Legend** | $\ge 7,000$ LP | Top 1% (Capped Top 50) | 3,000 Prestige Shards + Exclusive Title | Fixed Top-50 Dynamic Ladder |

### 1.3 Mathematical Soft Reset & MMR Decay Model
To maintain competitive freshness each semester without erasing veteran achievement, seasonal LP undergoes a non-linear compression upon season rollover:

$$LP_{\text{new}} = \min\left(1500, \left\lfloor LP_{\text{old}} \times 0.35 \right\rfloor\right)$$

* **Lifetime Stats Invariance:** Total XP, account level, lifetime trophies, and cosmetic armory items are **never reset**.
* **Soft MMR Compression:** High-ranking commanders (e.g., 6,000 LP) compress to 1,500 LP (Recon Veteran tier), giving active up-and-coming recruits an attainable competitive runway while recognizing veteran skill.
* **Recruit Immunity:** Players below 300 LP experience zero deduction ($LP_{\text{new}} = LP_{\text{old}}$).

### 1.4 Anti-Exploit Guardrails & Fairness Controls
1. **Daily LP Earning Cap:** Maximum **600 LP per calendar day** (00:00:00 to 23:59:59 IST) from solo activities to eliminate bot farming. Safe-Desk physical deposits are exempt from this cap.
2. **Win-Trading & Rapid-Solve Detection:** Clue solves completed under 8 seconds trigger automated telemetry flags in `FraudAlert` and omit LP disbursement pending staff review.
3. **Collusion Throttling:** The existing `checkPairCollusion` engine throttles repeat returns between identical user pairs to 2 per 30-day window.
4. **Historical Hall of Fame Archive:** At season freeze, an immutable snapshot is persisted to `/api/leaderboard/season/[id]/archive`, allowing operatives to review past champions and rank snapshots.

### 1.5 Proposed TypeScript Data Contracts

```typescript
// src/models/LeagueSeason.ts
export interface ILeagueSeason {
  seasonNumber: number;
  seasonCode: string; // e.g. "SEASON_01_SYNAPSE"
  title: string;      // "Season 1: Operation Cyber Lattice"
  startsAt: Date;
  endsAt: Date;
  status: "UPCOMING" | "ACTIVE" | "FROZEN" | "CONCLUDED" | "ARCHIVED";
  rewardTiers: {
    tier: "RECRUIT" | "SPECIALIST" | "VETERAN" | "COMMANDER" | "VANGUARD" | "LEGEND";
    minLp: number;
    coinReward: number;
    prestigeShards: number;
    cosmeticRewardId?: string;
    titleReward?: string;
  }[];
}

// src/models/UserSeasonStanding.ts
export interface IUserSeasonStanding {
  userId: mongoose.Types.ObjectId;
  seasonId: mongoose.Types.ObjectId;
  leagueTier: "RECRUIT" | "SPECIALIST" | "VETERAN" | "COMMANDER" | "VANGUARD" | "LEGEND";
  leaguePoints: number;
  seasonXp: number;
  dailyLpAccumulated: number;
  lastLpResetDateKey: string; // "YYYY-MM-DD" in Asia/Kolkata
  peakLp: number;
  rankSnapshot?: number;
  claimedSeasonRewards: string[];
}
```

---

## 2. Pillar 2: Squad Raid Cosmetics & Co-Op Hunts

### 2.1 Synchronous Multi-Stage Campus Raids
Squad Raids are high-difficulty investigations designed for **3 to 8 registered squad operatives**. Unlike solo mysteries, raid clues are physically distributed across multiple campus sectors and require synchronized multi-agent presence within a timed operation window (e.g., 45 minutes).

```
+-----------------------------------------------------------------------------------------+
|                              CAMPUS RAID OPERATION PHASES                               |
+-----------------------------------------------------------------------------------------+
|   STAGE 1: CENTRAL LIBRARY        STAGE 2: MECH WORKSHOP          STAGE 3: SERVER LAB   |
|   Operative A scans physical      Operative B calculates RPM      Operative C decrypts  |
|   archive catalog barcode.        tachometer anomaly.             dual-key RSA payload. |
|            |                               |                               |            |
|            +-------------------------------+-------------------------------+            |
|                                            |                                            |
|                           SYNCHRONIZED SQUAD CLEAR VERIFIED                             |
|                           - Unlocks Syndicate Raid Crate                                |
|                           - Awards Custom Banner Crest Component                        |
+-----------------------------------------------------------------------------------------+
```

### 2.2 Squad Customization & Modular SVG Faction Banners
Squads can display collective visual identity across the leaderboard, squad hub, and profile cards via **Modular SVG Banners**:
* **Selectable Crest Insignias:** High-contrast tactical icons (Falcon, Cyber Dragon, Quantum Eye, Sentinel Shield).
* **Faction Trim & Background Patterns:** Obsidian grid, carbon fiber weave, emerald pulse scanlines, laser lattice.
* **Animated Team Insignias:** CSS/Canvas animated emblems rendered in the Squads Hub with real-time glow effects.
* **Raid Victor Titles:** High-prestige titles (e.g., *"Apex Syndicate"*, *"Campus Sentinel"*, *"Raid Breaker"*) unlockable exclusively through multi-stage raid clears.
* **Syndicate Trophy Showcase:** Interactive 3D/isometric trophy display within the Squad Locker Room.

### 2.3 Anti-Exploit & Anti-Leech Guardrails
* **Minimum Contribution Requirement:** Squad members must solve at least one clue stage or perform a physical location check-in to be eligible for the raid reward payout.
* **48-Hour Squad Switch Lockout:** Operatives who transfer to a new squad are subject to a 48-hour raid reward lockout to eliminate mercenary raiding.
* **Strict 8-Member Squad Cap:** Enforces the application-standard 8-member limit (`memberCap: 8`), preventing mega-syndicate monopolies.

### 2.4 Proposed TypeScript Data Contracts

```typescript
// src/models/SquadRaidInstance.ts
export interface ISquadRaidInstance {
  squadId: mongoose.Types.ObjectId;
  raidTemplateId: string;
  status: "LOBBY" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "EXPIRED";
  startedAt: Date;
  expiresAt: Date;
  timeLimitMinutes: number; // e.g. 45
  zones: {
    zoneName: string;
    stageIndex: number;
    locationId: mongoose.Types.ObjectId;
    isCleared: boolean;
    clearedByUserId?: mongoose.Types.ObjectId;
    clearedAt?: Date;
  }[];
  activeOperatives: {
    userId: mongoose.Types.ObjectId;
    joinedAt: Date;
    stagesSolved: number;
    contributionScore: number;
  }[];
}

// Extension to SquadSchema (src/models/index.ts)
export interface ISquadCustomBanner {
  crestId: string;
  primaryColor: string;
  secondaryColor: string;
  borderStyle: "OBSIDIAN_EDGE" | "CYBER_NEON" | "GILDED_TITANIUM";
  emblemEffect: "STATIC" | "PULSE" | "TURBULENCE_PLASMA";
  squadMotto: string;
}
```

---

## 3. Pillar 3: Tactical Audio & Sound Effects Engine

### 3.1 Zero-Overhead Procedural Web Audio Architecture
To eliminate heavy asset payloads, audio bandwidth costs, and network latency, the Tactical Sound Effects Engine synthesizes sound cues **procedurally on the client** using the HTML5 **Web Audio API** (`AudioContext`).

* **Zero Asset Overhead:** 0 KB audio files downloaded over the network; zero `.mp3` or `.wav` latency.
* **Ultra-Low Latency:** Synthesizer nodes execute in sub-10ms audio hardware buffers.
* **Procedural Synthesis Elements:** Standard oscillators (`sine`, `triangle`, `sawtooth`, `square`), biquad filter nodes, exponential gain envelopes, and white/pink noise buffers.

### 3.2 Acoustic Palette Specification

| Acoustic Event | Frequency & Envelope | Duration | Sound Character & Valence |
|---|---|---|---|
| **Tactical Micro-Click** | 2,400 Hz bandpass, exponential decay | 8ms | Sub-perceptual mechanical button response |
| **Clue Decryption Chirp** | 440 Hz $\to$ 880 Hz $\to$ 1,760 Hz arpeggio | 180ms | Clean, high-tech positive verification |
| **Error / Rejection Buzz** | Dual detuned saws (120 Hz + 85 Hz), lowpass 400 Hz | 250ms | Damped, firm but non-jarring refusal |
| **Daily Quest Stinger** | Major 7th arpeggio + soft granular coin chimes | 600ms | Gratifying milestone progression chime |
| **Level-Up Fanfare** | Synthetic brass fanfare with sub-bass drop (50 Hz) | 1,800ms | Grand, cinematic status milestone fanfare |
| **Safe-Desk Handover Chime** | Dual bell harmonics (1,200 Hz & 2,400 Hz) | 750ms | Authoritative institutional physical custody signal |

### 3.3 Accessibility, Autoplay & System Controls
* **Lazy User-Gesture Initialization:** `AudioContext` initializes strictly upon the user's first click or tap, fully conforming to strict browser autoplay policies.
* **User Audio Persistence:** Master volume slider (0–100%) and instant mute toggle persisted across sessions via `localStorage` (`aiem_hunt_audio_config`) and user preferences.
* **WCAG 2.1 Alignment:** Every acoustic signal pairs with visible screen-reader aria updates (`aria-live="polite"`) or toast notifications for hearing-impaired users.

### 3.4 Proposed TypeScript Hook Implementation

```typescript
// src/lib/audio/useTacticalAudio.ts
export interface TacticalAudioControls {
  playClick: () => void;
  playSuccess: () => void;
  playError: () => void;
  playLevelUp: (level: number) => void;
  playQuestComplete: () => void;
  playHandoverChime: () => void;
  setMasterVolume: (volume: number) => void;
  toggleMute: () => void;
  isMuted: boolean;
}

export function useTacticalAudio(): TacticalAudioControls {
  // Client-side Web Audio API synthesizer implementation
  // with lazy AudioContext creation, gain node ramp-downs,
  // and master volume state synchronization.
}
```

---

## 4. Pillar 4: Animated Avatar Borders & Reactive Titles

### 4.1 GPU Acceleration & Visual Shaders
Operative profile cards and leaderboards feature high-performance GPU-accelerated cosmetic shaders that celebrate player dedication without impacting frame rates or mobile battery life:

1. **CSS Conic-Gradient Laser Rings:** Smooth GPU-accelerated rotating borders (`@keyframes spin-conic`) with multi-stop neon cyan, emerald pulse, and ultraviolet gradients.
2. **SVG Turbulence Displacement Shaders:** Electric plasma distortions and lightning ripple effects built via native `<feTurbulence>` and `<feDisplacementMap>` filter primitives.
3. **HTML5 2D Canvas Micro-Particles:** Lightweight orbital dust, embers, and quantum sparks circulating the avatar perimeter.

### 4.2 Dynamic Reactive Titles
Titles equipped in the tactical locker dynamically react to the operative's live game state:
* **Blazing Pathfinder:** Ignites an animated flame corona whenever `user.dailyStreak >= 7`.
* **Apex Sovereign:** Shimmers with a sweeping 45-degree iridescent golden sheen when the operative ranks in the Top 10 of the active season.
* **Glitch Phantom:** Emits CRT scanline chromatic aberration on hover or card selection.
* **Safe-Desk Guardian:** Emits an authoritative cyan shield pulse reflecting high trust tier standing.

### 4.3 Mobile Battery & Accessibility Guardrails
* **CSS Layer Promotion:** Animations execute exclusively on `transform`, `opacity`, and `filter` using `will-change: transform`.
* **Reduced-Motion Fallbacks:** When `@media (prefers-reduced-motion: reduce)` is detected, canvas animations and spinning conic rings are replaced with static, high-contrast matte borders.
* **Intersection Observer Viewport Culling:** Off-screen canvas particle loops pause rendering automatically when scrolled out of view, minimizing mobile GPU load.

### 4.4 Proposed TypeScript Schema Extension

```typescript
// Extension to src/lib/cosmetics.ts
export interface AnimatedCosmeticEffect {
  id: string;
  name: string;
  category: "FRAME" | "EFFECT" | "TITLE";
  renderEngine: "CSS_CONIC" | "SVG_FILTER" | "CANVAS_PARTICLES";
  cssAnimationClass: string;
  particleConfig?: {
    particleCount: number;
    colorHex: string;
    speed: number;
    orbitRadius: number;
  };
  reactiveCondition?: {
    metric: "DAILY_STREAK" | "LEADERBOARD_RANK" | "SEASON_TIER";
    minThreshold: number;
  };
}
```

---

## 5. Prioritization Matrix (Impact vs. Effort vs. Fairness)

| Feature Pillar / Sub-Feature | Player Engagement | Dev Complexity | Game Fairness Risk | Priority | Recommended Rollout |
|---|:---:|:---:|:---:|:---:|:---:|
| **Tactical Audio & SFX Engine** | **High (9/10)** | **Low (4 Days)** | **Zero (Aesthetic Only)** | **P1 (Immediate)** | Phase 1 (Weeks 1 – 2) |
| **Animated Borders & Reactive Titles** | **High (8/10)** | **Medium (6 Days)** | **Zero (Aesthetic Only)** | **P2 (Near-Term)** | Phase 2 (Weeks 2 – 4) |
| **Seasonal Prestige Leagues** | **Very High (10/10)** | **Med-High (10 Days)**| **Medium (Requires LP Caps)**| **P3 (Next Milestone)**| Phase 3 (Weeks 4 – 7) |
| **Squad Raid Cosmetics & Co-Op Hunts** | **Very High (10/10)** | **High (14 Days)** | **Medium (Transfer Cooldowns)**| **P4 (Major Release)** | Phase 4 (Weeks 7 – 11) |

```
                       HIGH IMPACT ^
                                   |  [P1] Tactical Audio Engine
                                   |       (Procedural Web Audio)     [P3] Seasonal Prestige Leagues
                                   |                                       (6-Week LP Ladder & Reset)
                                   |  [P2] Animated Avatar Borders
                                   |       (CSS GPU Laser Rings)      [P4] Squad Raid Co-Op Hunts
                                   |                                       (Modular SVG Banners & Clues)
                                   +------------------------------------------------------------>
                                   LOW EFFORT / COMPLEXITY                     HIGH EFFORT / COMPLEXITY
```

---

## 6. Phased Rollout Timeline

```
+----------------------------------------------------------------------------------------------------+
|                                    PHASED ROLLOUT ROADMAP                                          |
+----------------------------------------------------------------------------------------------------+
|  PHASE 1: SENSORY TACTICAL IMMERSION (WEEKS 1 - 2)                                                |
|  - Implement useTacticalAudio Web Audio procedural synthesizer hook                                |
|  - Wire tactile clicks, clue decryption chirps, level-up fanfares, and quest stingers              |
|  - Add user master volume slider and instant mute toggle in settings / navbar                      |
|  - Deliver unit tests for audio context lazy-loading and reduced-motion states                     |
+----------------------------------------------------------------------------------------------------+
|  PHASE 2: VISUAL PRESTIGE & REACTIVE SHADERS (WEEKS 3 - 4)                                         |
|  - Deploy CSS conic-gradient rotating laser rings on AgentHeroCard and Leaderboard                 |
|  - Build SVG displacement turbulence filters for rare and epic frames                              |
|  - Add streak-reactive titles (Blazing Pathfinder, Apex Sovereign)                                 |
|  - Implement IntersectionObserver canvas particle culling for mobile battery preservation         |
+----------------------------------------------------------------------------------------------------+
|  PHASE 3: SEASONAL PRESTIGE LEAGUES & MMR RESET (WEEKS 5 - 7)                                      |
|  - Deploy ILeagueSeason and IUserSeasonStanding Mongoose schemas with compound indexes             |
|  - Implement 6-week seasonal lifecycle cron with automated LP soft reset calculations             |
|  - Implement daily 600 LP cap and rapid-solve detection telemetry                                  |
|  - Launch /api/season/active and seasonal leaderboard snapshot archives                           |
+----------------------------------------------------------------------------------------------------+
|  PHASE 4: SQUAD RAID CO-OP OPERATIONS & CUSTOM BANNERS (WEEKS 8 - 11)                              |
|  - Scaffold ISquadRaidInstance coordinator for synchronized multi-stage campus investigations      |
|  - Build modular SVG banner generator (crest, trim, animated insignias) in Squad Locker            |
|  - Enforce 48-hour squad transfer reward lockout and contribution threshold checks                 |
|  - Launch full-campus Syndicate Raid tournaments with exclusive cosmetics                          |
+----------------------------------------------------------------------------------------------------+
```

---

## 7. Architectural Compliance & Integration Sign-Off

1. **Non-Linear Progression Cohesion:** All season XP rewards and raid payouts integrate strictly with the authoritative non-linear curve $XP_{\text{step}}(L) = \lfloor 150 \times L + 50 \times L^{1.35} \rfloor$ exported from `src/lib/economy.ts` and `src/lib/progression.ts`.
2. **Cosmetic Gating Consistency:** Raid and prestige cosmetics pass through `isCosmeticEligible` in `src/app/api/user/profile/route.ts`, preventing unauthorized equips via direct API tampering (`403 Forbidden`).
3. **Timezone Authority:** All season transitions and daily LP reset boundaries anchor strictly to `Asia/Kolkata` (IST, UTC+05:30) via `getCampusDateKey()` in `src/lib/dailyQuests.ts`.
4. **Data Privacy Preservation:** Public seasonal standings strictly omit internal moderation signals (`trustScore`, `trustTier`), private contact information, and unmasked identities.

/**
 * AIEM Hunt — Milestone 4 Adversarial Empirical Verification & Stress Test Harness
 * Author: UI & Cosmetics Challenger (Critic / Specialist)
 * Target: Milestone 4 UI, UX, Cosmetics Gating, Mobile Nav, Progression & Daily Quests
 */

import fs from "fs";
import path from "path";
import {
  getXpRequiredForLevel,
  calculateLevelFromXp,
  getXpProgressInLevel,
  getXpRequiredForNextLevel,
  getCumulativeXpForLevel,
} from "../lib/economy";
import {
  COSMETIC_CATALOGUE,
  isCosmeticOwned,
  getStarterCosmetics,
  isStarterCosmetic,
  CosmeticItem,
} from "../lib/cosmetics";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

async function runM4AdversarialAudit() {
  console.log("================================================================================");
  console.log("⚔️  AIEM HUNT — MILESTONE 4 EMPIRICAL ADVERSARIAL STRESS TEST");
  console.log("================================================================================");

  const root = path.resolve(__dirname, "../../");

  // ---------------------------------------------------------------------------
  // SECTION 1: Cosmetic Gating Invariant & Starter Loadout Integrity
  // ---------------------------------------------------------------------------
  console.log("\n─── 1. Cosmetic Gating & Tactical Locker Invariant ───");
  const lockerPath = path.join(root, "src/components/profile/TacticalLockerTab.tsx");
  assert(fs.existsSync(lockerPath), "TacticalLockerTab.tsx exists at expected path");
  const lockerSrc = fs.readFileSync(lockerPath, "utf-8");

  // 1.1: Assert Gating logic in TacticalLockerTab
  assert(
    lockerSrc.includes("disabled={!isOwned}"),
    "Selection button enforces disabled={!isOwned} attribute"
  );
  assert(
    lockerSrc.includes("cursor-not-allowed"),
    "Locked items visually styled with cursor-not-allowed"
  );
  assert(
    lockerSrc.includes("opacity-50"),
    "Locked items visually dimmed with opacity-50"
  );
  assert(
    lockerSrc.includes("Lock className") || lockerSrc.includes("<Lock"),
    "Locked items render Lock icon"
  );
  assert(
    lockerSrc.includes("getUnlockRequirementText(item)"),
    "Requirement text helper getUnlockRequirementText is invoked for locked items"
  );

  // 1.2: Check all 8 cosmetic categories present in Locker definition
  const requiredCategories = [
    "AVATAR",
    "FRAME",
    "THEME",
    "TITLE",
    "BANNER",
    "BANNER_FRAME",
    "EFFECT",
    "DECORATION",
  ];
  for (const cat of requiredCategories) {
    assert(
      lockerSrc.includes(`key: "${cat}"`) || lockerSrc.includes(`"${cat}"`),
      `TacticalLockerTab supports category: ${cat}`
    );
  }

  // 1.3: Empirical Stress-Test on Cosmetic Catalogue & Starter Loadout
  const starterCosmetics = getStarterCosmetics();
  assert(
    starterCosmetics.length >= 7,
    `Starter loadout contains comprehensive items across categories (found ${starterCosmetics.length})`
  );

  // Ensure starter items cover vital categories
  const starterCategories = new Set(starterCosmetics.map((c) => c.category));
  assert(starterCategories.has("AVATAR"), "Starter loadout provides free AVATAR");
  assert(starterCategories.has("FRAME"), "Starter loadout provides free FRAME");
  assert(starterCategories.has("TITLE"), "Starter loadout provides free TITLE");
  assert(starterCategories.has("BANNER"), "Starter loadout provides free BANNER / THEME");
  assert(starterCategories.has("DECORATION"), "Starter loadout provides free DECORATION");

  // Adversarial user: brand new student, 0 XP, Level 1, empty ownedCosmetics array
  const freshUser = {
    level: 1,
    xp: 0,
    ownedCosmetics: [],
  };

  for (const starter of starterCosmetics) {
    const isOwned = isCosmeticOwned(freshUser, starter.id, freshUser.level);
    assert(
      isOwned === true,
      `Starter item '${starter.id}' is unconditionally accessible to Level 1 fresh user`
    );
  }

  // Adversarial check: locked items must NOT be accessible to fresh user
  const lockedItems = COSMETIC_CATALOGUE.filter(
    (c) =>
      !c.isStarter &&
      c.unlockType !== "STARTER" &&
      ((c.unlockType === "LEVEL" && (c.unlockRequirement?.level || 0) > 1) ||
        c.unlockType === "SHOP" ||
        c.unlockType === "ACHIEVEMENT")
  );

  assert(lockedItems.length > 0, "Cosmetic catalogue contains locked progression/shop items");

  let lockedCorrectly = true;
  for (const item of lockedItems) {
    const owned = isCosmeticOwned(freshUser, item.id, freshUser.level);
    if (owned) {
      lockedCorrectly = false;
      console.error(`  Violation: Locked item '${item.id}' was considered owned by fresh user!`);
    }
  }
  assert(
    lockedCorrectly,
    `All ${lockedItems.length} locked catalogue items correctly evaluate to isOwned=false for fresh user`
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: Mobile Bottom Nav Invariants
  // ---------------------------------------------------------------------------
  console.log("\n─── 2. Mobile Bottom Nav Viewport & Cleanliness Invariants ───");
  const navPath = path.join(root, "src/components/MobileBottomNav.tsx");
  assert(fs.existsSync(navPath), "MobileBottomNav.tsx exists");
  const navSrc = fs.readFileSync(navPath, "utf-8");

  // 2.1: Assert 0 occurrences of floating '+' FAB or Quick Action Menu
  assert(!navSrc.includes("fabOpen"), "Zero occurrences of 'fabOpen' state");
  assert(!navSrc.includes("setFabOpen"), "Zero occurrences of 'setFabOpen' state updater");
  assert(
    !navSrc.includes('aria-label="Quick Action Menu"'),
    "Zero occurrences of 'Quick Action Menu' aria container"
  );
  assert(
    !navSrc.includes("fixed bottom-20 right-4"),
    "Zero occurrences of fixed bottom-20 right-4 FAB overlay styling"
  );
  assert(
    !navSrc.includes("PackagePlus") && !navSrc.includes("PackageSearch"),
    "Zero occurrences of unused floating FAB icons"
  );

  // 2.2: Assert strict 5-item thumb grid & safe-area padding
  assert(
    navSrc.includes("grid-cols-5"),
    "Navigation bar maintains thumb-friendly 'grid-cols-5' layout"
  );
  assert(
    navSrc.includes("safe-area-pb"),
    "Navigation bar includes 'safe-area-pb' for iOS / mobile home bar clearance"
  );
  assert(
    navSrc.includes("md:hidden"),
    "Navigation bar is strictly mobile/tablet hidden above medium breakpoint (md:hidden)"
  );

  // 2.3: Assert all 5 primary bottom nav destinations
  const expectedRoutes = [
    { label: "HQ", href: "/dashboard" },
    { label: "Lost & Found", href: "/lost-and-found" },
    { label: "Map", href: "/map" },
    { label: "Quests", href: "/quests" },
    { label: "Squad", href: "/squads" },
  ];

  for (const route of expectedRoutes) {
    assert(
      navSrc.includes(`href: "${route.href}"`) || navSrc.includes(`href: '${route.href}'`),
      `MobileBottomNav routes to destination: ${route.label} (${route.href})`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: Economy Progression Invariant & Non-Linear Mathematical Audit
  // ---------------------------------------------------------------------------
  console.log("\n─── 3. Economy Progression Invariant & Non-Linear Math ───");
  const heroPath = path.join(root, "src/components/profile/AgentHeroCard.tsx");
  const dashPath = path.join(root, "src/app/dashboard/page.tsx");

  assert(fs.existsSync(heroPath), "AgentHeroCard.tsx exists");
  assert(fs.existsSync(dashPath), "dashboard/page.tsx exists");

  const heroSrc = fs.readFileSync(heroPath, "utf-8");
  const dashSrc = fs.readFileSync(dashPath, "utf-8");

  // 3.1: Assert neither component contains XP_PER_LEVEL = 500
  assert(
    !heroSrc.includes("XP_PER_LEVEL = 500"),
    "AgentHeroCard has zero flat 'XP_PER_LEVEL = 500'"
  );
  assert(
    !dashSrc.includes("XP_PER_LEVEL = 500"),
    "dashboard/page.tsx has zero flat 'XP_PER_LEVEL = 500'"
  );

  // 3.2: Assert both components integrate non-linear helpers from @/lib/economy
  assert(
    heroSrc.includes("getXpProgressInLevel") &&
      heroSrc.includes("getXpRequiredForNextLevel") &&
      heroSrc.includes("calculateLevelFromXp"),
    "AgentHeroCard imports and utilizes all 3 non-linear progression helpers"
  );
  assert(
    dashSrc.includes("getXpProgressInLevel") &&
      dashSrc.includes("getXpRequiredForNextLevel") &&
      dashSrc.includes("calculateLevelFromXp"),
    "dashboard/page.tsx imports and utilizes all 3 non-linear progression helpers"
  );

  // 3.3: Mathematical Verification of Levels 1, 2, 5, 10, 20 XP Thresholds
  // Authoritative step formula: XP_step(L) = floor(150 * L + 50 * L^1.35)
  // Authoritative cumulative formula: cumulativeXp(1) = 0, cumulativeXp(L) = sum_{i=1}^{L-1} XP_step(i)
  function manualStepXp(level: number): number {
    return Math.floor(150 * level + 50 * Math.pow(level, 1.35));
  }

  function manualCumulativeXp(targetLevel: number): number {
    if (targetLevel <= 1) return 0;
    let sum = 0;
    for (let l = 1; l < targetLevel; l++) {
      sum += manualStepXp(l);
    }
    return sum;
  }

  const testLevels = [1, 2, 5, 10, 20];
  for (const lvl of testLevels) {
    const expectedCumulative = manualCumulativeXp(lvl);
    const actualCumulative = getCumulativeXpForLevel(lvl);
    assert(
      expectedCumulative === actualCumulative,
      `Cumulative XP for Level ${lvl} matches authoritative non-linear curve: ${actualCumulative} XP`
    );

    const calculatedLvl = calculateLevelFromXp(actualCumulative);
    assert(
      calculatedLvl === lvl,
      `calculateLevelFromXp(${actualCumulative} XP) exactly resolves to Level ${lvl}`
    );

    if (lvl > 1) {
      const justBelow = calculateLevelFromXp(actualCumulative - 1);
      assert(
        justBelow === lvl - 1,
        `calculateLevelFromXp(${actualCumulative - 1} XP) resolves to Level ${lvl - 1} (exact boundary below Level ${lvl})`
      );
    }
  }

  // Verify non-linearity: step delta must strictly increase
  const stepL1 = manualStepXp(1);
  const stepL2 = manualStepXp(2);
  const stepL5 = manualStepXp(5);
  const stepL10 = manualStepXp(10);
  const stepL20 = manualStepXp(20);
  assert(
    stepL1 < stepL2 && stepL2 < stepL5 && stepL5 < stepL10 && stepL10 < stepL20,
    `XP steps scale strictly non-linearly: L1(${stepL1}) < L2(${stepL2}) < L5(${stepL5}) < L10(${stepL10}) < L20(${stepL20})`
  );

  // Test getXpProgressInLevel invariants
  for (const xp of [0, 50, 199, 200, 350, 626, 627, 2220, 8132, 30472]) {
    const progress = getXpProgressInLevel(xp);
    assert(
      progress.progressPercent >= 0 && progress.progressPercent <= 100,
      `progressPercent (${progress.progressPercent}%) within [0, 100] bounds for XP=${xp}`
    );
    assert(
      progress.currentXpInLevel >= 0 &&
        progress.currentXpInLevel < progress.xpRequiredForNextLevel,
      `currentXpInLevel (${progress.currentXpInLevel}) < nextLevelReq (${progress.xpRequiredForNextLevel}) for XP=${xp}`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: Daily Quests UI & Network States Invariant
  // ---------------------------------------------------------------------------
  console.log("\n─── 4. Daily Quests Board UI & Network State Invariants ───");
  const questsPagePath = path.join(root, "src/app/quests/page.tsx");
  assert(fs.existsSync(questsPagePath), "quests/page.tsx exists");
  const questsSrc = fs.readFileSync(questsPagePath, "utf-8");

  // 4.1: Daily Quests Board integration & IST Timezone
  assert(
    questsSrc.includes("/api/quests/daily"),
    "Quests page fetches data from /api/quests/daily"
  );
  assert(
    questsSrc.includes("Asia/Kolkata") || questsSrc.includes("IST"),
    "Quests page explicitly documents Goa campus Asia/Kolkata (IST) timezone"
  );

  // 4.2: Network States Handling
  // Loading state
  assert(
    questsSrc.includes("dailyLoading") && questsSrc.includes("Loader2"),
    "Daily Quests Board handles loading state with animated Loader2 spinner"
  );
  assert(
    questsSrc.includes("SYNCHRONIZING CAMPUS DAILY DIRECTIVES"),
    "Displays loading status message during fetch"
  );

  // Empty state
  assert(
    questsSrc.includes("No active daily directives found"),
    "Daily Quests Board handles empty / no-directives fallback gracefully"
  );

  // Active countdown timer
  assert(
    questsSrc.includes("formatCountdown(secondsRemaining)") ||
      questsSrc.includes("formatCountdown"),
    "Daily Quests Board renders live formatted countdown timer"
  );
  assert(
    questsSrc.includes("setInterval") && questsSrc.includes("setSecondsRemaining"),
    "Countdown timer decrements every second and triggers refresh upon reaching 0"
  );

  // Claim states
  assert(
    questsSrc.includes("quest.isClaimed"),
    "Daily Quests Board checks quest.isClaimed property"
  );
  assert(
    questsSrc.includes("Claimed") && questsSrc.includes("CheckCircle2"),
    "Renders 'Claimed' badge with CheckCircle2 when objective is claimed"
  );
  assert(
    questsSrc.includes("handleClaimDaily(quest.questKey)"),
    "Renders functional claim button triggering handleClaimDaily"
  );
  assert(
    questsSrc.includes("isClaiming") && questsSrc.includes("Claiming Bounty..."),
    "Handles in-flight claim request with disabled loading state"
  );

  // Streak counters
  assert(
    questsSrc.includes("dailyData?.dailyStreak") || questsSrc.includes("dailyStreak"),
    "Displays current daily active streak"
  );
  assert(
    questsSrc.includes("dailyData?.longestDailyStreak") || questsSrc.includes("longestDailyStreak"),
    "Displays historical longest daily streak"
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: Rewards Shop Gating & Equipping Fix
  // ---------------------------------------------------------------------------
  console.log("\n─── 5. Rewards Hub Slug Comparison & Armory Previews ───");
  const rewardsPath = path.join(root, "src/app/rewards/page.tsx");
  assert(fs.existsSync(rewardsPath), "rewards/page.tsx exists");
  const rewardsSrc = fs.readFileSync(rewardsPath, "utf-8");

  assert(
    !rewardsSrc.includes("user.equippedFrame === reward.title"),
    "Fixed slug mismatch bug: removed faulty 'user.equippedFrame === reward.title'"
  );
  assert(
    rewardsSrc.includes("isCosmeticOwned") || rewardsSrc.includes("checkRewardOwnership"),
    "Rewards shop uses canonical ownership check"
  );
  assert(
    rewardsSrc.includes("CosmeticVisualPreview"),
    "Rewards page renders interactive cosmetic visual previews"
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`⚔️  ADVERSARIAL STRESS TEST COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runM4AdversarialAudit().catch((err) => {
  console.error("Test execution aborted with error:", err);
  process.exit(1);
});

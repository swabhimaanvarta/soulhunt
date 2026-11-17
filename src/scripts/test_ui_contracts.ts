/**
 * Milestone 4 UI/UX Contracts & Behavioral Invariants Test Suite
 * Validates:
 * 1. MobileBottomNav: 0 '+' FAB button occurrences, strict 5-item thumb grid, safe-area-pb.
 * 2. TacticalLockerTab: All 8 cosmetic categories, isCosmeticOwned gating, locked disabled state & requirements.
 * 3. AgentHeroCard & dashboard/page: Zero flat XP_PER_LEVEL = 500, non-linear progression helpers used.
 * 4. rewards/page: Fixed equippedFrame slug comparison bug, visual cosmetic previews, status badges, purchase flow.
 * 5. quests/page: Prominent Daily Quests Board, GET /api/quests/daily integration, IST countdown, streak counters, claim flow.
 */

import fs from "fs";
import path from "path";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
  }
}

async function runUiContractsTests() {
  console.log("========================================================");
  console.log("🎨 AIEM HUNT — MILESTONE 4 UI & UX CONTRACTS AUDIT");
  console.log("========================================================");

  const projectRoot = path.resolve(__dirname, "../../");

  // -------------------------------------------------------------------------
  // Suite 1: MobileBottomNav Inspection
  // -------------------------------------------------------------------------
  console.log("\n─── Suite 1: MobileBottomNav Structure & Viewport Safety ───");
  const navPath = path.join(projectRoot, "src/components/MobileBottomNav.tsx");
  assert(fs.existsSync(navPath), "MobileBottomNav.tsx exists");
  const navContent = fs.readFileSync(navPath, "utf-8");

  assert(!navContent.includes("fabOpen"), "Zero occurrences of 'fabOpen' state");
  assert(!navContent.includes("setFabOpen"), "Zero occurrences of 'setFabOpen' updater");
  assert(!navContent.includes('aria-label="Quick Action Menu"'), "Zero Quick Action Menu containers");
  assert(!navContent.includes("PackagePlus"), "No unused FAB Lucide icons (PackagePlus)");
  assert(!navContent.includes("PackageSearch"), "No unused FAB Lucide icons (PackageSearch)");
  assert(navContent.includes("grid-cols-5"), "Preserves thumb-friendly grid-cols-5 layout");
  assert(navContent.includes("safe-area-pb"), "Preserves safe-area-pb padding class");
  assert(navContent.includes("/dashboard") && navContent.includes("/lost-and-found") && navContent.includes("/map") && navContent.includes("/quests") && navContent.includes("/squads"), "All 5 core destination routes present");

  // -------------------------------------------------------------------------
  // Suite 2: Non-Linear Progression Integration (AgentHeroCard & Dashboard)
  // -------------------------------------------------------------------------
  console.log("\n─── Suite 2: Progression Formula Invariants ───");
  const heroPath = path.join(projectRoot, "src/components/profile/AgentHeroCard.tsx");
  assert(fs.existsSync(heroPath), "AgentHeroCard.tsx exists");
  const heroContent = fs.readFileSync(heroPath, "utf-8");

  assert(!heroContent.includes("XP_PER_LEVEL = 500"), "AgentHeroCard has zero flat 'XP_PER_LEVEL = 500'");
  assert(heroContent.includes("getXpProgressInLevel"), "AgentHeroCard imports/uses getXpProgressInLevel");
  assert(heroContent.includes("getXpRequiredForNextLevel"), "AgentHeroCard imports/uses getXpRequiredForNextLevel");
  assert(heroContent.includes("calculateLevelFromXp"), "AgentHeroCard imports/uses calculateLevelFromXp");

  const dashPath = path.join(projectRoot, "src/app/dashboard/page.tsx");
  assert(fs.existsSync(dashPath), "dashboard/page.tsx exists");
  const dashContent = fs.readFileSync(dashPath, "utf-8");

  assert(!dashContent.includes("XP_PER_LEVEL = 500"), "dashboard/page.tsx has zero flat 'XP_PER_LEVEL = 500'");
  assert(dashContent.includes("getXpProgressInLevel"), "dashboard/page.tsx imports/uses getXpProgressInLevel");
  assert(dashContent.includes("getXpRequiredForNextLevel"), "dashboard/page.tsx imports/uses getXpRequiredForNextLevel");
  assert(dashContent.includes("calculateLevelFromXp"), "dashboard/page.tsx imports/uses calculateLevelFromXp");
  assert(dashContent.includes("xpRequiredForNextLevel"), "dashboard/page.tsx references dynamic xpRequiredForNextLevel in HUD");

  // -------------------------------------------------------------------------
  // Suite 3: TacticalLockerTab Cosmetic Gating & Categories
  // -------------------------------------------------------------------------
  console.log("\n─── Suite 3: Tactical Locker & Cosmetic Catalogue Gating ───");
  const lockerPath = path.join(projectRoot, "src/components/profile/TacticalLockerTab.tsx");
  assert(fs.existsSync(lockerPath), "TacticalLockerTab.tsx exists");
  const lockerContent = fs.readFileSync(lockerPath, "utf-8");

  assert(lockerContent.includes("COSMETIC_CATALOGUE"), "TacticalLockerTab imports COSMETIC_CATALOGUE");
  assert(lockerContent.includes("isCosmeticOwned"), "TacticalLockerTab imports isCosmeticOwned");
  assert(lockerContent.includes("CosmeticItem"), "TacticalLockerTab imports CosmeticItem type");

  // Verify all 8 categories
  const categories = ["AVATAR", "FRAME", "THEME", "TITLE", "BANNER", "BANNER_FRAME", "EFFECT", "DECORATION"];
  categories.forEach((cat) => {
    assert(lockerContent.includes(`"${cat}"`), `TacticalLockerTab supports category "${cat}"`);
  });

  assert(lockerContent.includes("disabled={!isOwned}"), "Enforces disabled={!isOwned} on unowned cosmetics");
  assert(lockerContent.includes("cursor-not-allowed"), "Applies cursor-not-allowed styling to locked items");
  assert(lockerContent.includes("opacity-50"), "Applies opacity-50 dimming to locked items");
  assert(lockerContent.includes("Lock"), "Displays Lock icon for locked cosmetics");
  assert(lockerContent.includes("Unlocked at Level") || lockerContent.includes("getUnlockRequirementText"), "Displays dynamic unlock requirement texts");
  assert(lockerContent.includes("Shop Item"), "Handles shop unlock requirement indicator");

  // -------------------------------------------------------------------------
  // Suite 4: Rewards Page Bug Fix & Cosmetic Previews
  // -------------------------------------------------------------------------
  console.log("\n─── Suite 4: Rewards Hub Armory & Preview Contracts ───");
  const rewardsPath = path.join(projectRoot, "src/app/rewards/page.tsx");
  assert(fs.existsSync(rewardsPath), "rewards/page.tsx exists");
  const rewardsContent = fs.readFileSync(rewardsPath, "utf-8");

  assert(!rewardsContent.includes("user.equippedFrame === reward.title"), "Fixed false-unowned comparison bug (user.equippedFrame === reward.title removed)");
  assert(rewardsContent.includes("checkRewardOwnership") || rewardsContent.includes("isCosmeticOwned"), "Uses robust cosmetic ownership resolution");
  assert(rewardsContent.includes("CosmeticVisualPreview"), "Displays CosmeticVisualPreview for armory items");
  assert(rewardsContent.includes("Equipped"), "Displays 'Equipped' status badge");
  assert(rewardsContent.includes("Owned"), "Displays 'Owned' status badge");
  assert(rewardsContent.includes("/api/rewards/purchase"), "Wires purchase button to /api/rewards/purchase");

  // -------------------------------------------------------------------------
  // Suite 5: Quests Page Daily Quests Board
  // -------------------------------------------------------------------------
  console.log("\n─── Suite 5: Daily Quests Board & IST Retention ───");
  const questsPath = path.join(projectRoot, "src/app/quests/page.tsx");
  assert(fs.existsSync(questsPath), "quests/page.tsx exists");
  const questsContent = fs.readFileSync(questsPath, "utf-8");

  assert(questsContent.includes("/api/quests/daily"), "Quests page integrates /api/quests/daily");
  assert(questsContent.includes("formatCountdown") || questsContent.includes("secondsRemaining"), "Calculates and displays real-time countdown to IST midnight");
  assert(questsContent.includes("dailyStreak"), "Displays dailyStreak counter");
  assert(questsContent.includes("longestDailyStreak"), "Displays longestDailyStreak counter");
  assert(questsContent.includes("handleClaimDaily") || questsContent.includes("POST"), "Provides claim daily objective action");
  assert(questsContent.includes("Claimed"), "Displays 'Claimed' badge for rewarded daily objectives");
  assert(questsContent.includes("Asia/Kolkata") || questsContent.includes("IST"), "Explicitly references Goa campus IST timezone");

  console.log("\n========================================================");
  console.log(`🎉 CONTRACTS AUDIT COMPLETED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runUiContractsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

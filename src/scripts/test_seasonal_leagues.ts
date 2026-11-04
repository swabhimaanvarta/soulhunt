import assert from "node:assert";
import {
  getSeasonalTier,
  calculateCompressedTrophyReset,
  getCurrentSeason,
  calculateSeasonPayout,
  SEASONAL_TIERS,
} from "../lib/seasons";

console.log("\n========================================================");
console.log("🏆 AIEM HUNT — SEASONAL PRESTIGE LEAGUES (M8) QA SUITE");
console.log("========================================================\n");

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASSED: ${name}`);
  } catch (err: any) {
    console.error(`  ❌ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("─── Suite 1: Tier Boundary Classification ───");

runTest("0 trophies resolves to Bronze Scout", () => {
  const tier = getSeasonalTier(0);
  assert.strictEqual(tier.tier, "BRONZE_SCOUT");
  assert.strictEqual(tier.shardPayout, 50);
});

runTest("999 trophies resolves to Bronze Scout", () => {
  const tier = getSeasonalTier(999);
  assert.strictEqual(tier.tier, "BRONZE_SCOUT");
});

runTest("1000 trophies resolves to Silver Tracker", () => {
  const tier = getSeasonalTier(1000);
  assert.strictEqual(tier.tier, "SILVER_TRACKER");
  assert.strictEqual(tier.trophyFloor, 1000);
  assert.strictEqual(tier.shardPayout, 150);
});

runTest("2000 trophies resolves to Gold Sleuth", () => {
  const tier = getSeasonalTier(2000);
  assert.strictEqual(tier.tier, "GOLD_SLEUTH");
  assert.strictEqual(tier.trophyFloor, 1400);
  assert.strictEqual(tier.shardPayout, 350);
});

runTest("3500 trophies resolves to Platinum Sentinel", () => {
  const tier = getSeasonalTier(3500);
  assert.strictEqual(tier.tier, "PLATINUM_SENTINEL");
  assert.strictEqual(tier.trophyFloor, 2000);
  assert.strictEqual(tier.shardPayout, 700);
});

runTest("5000 trophies resolves to Diamond Vanguard", () => {
  const tier = getSeasonalTier(5000);
  assert.strictEqual(tier.tier, "DIAMOND_VANGUARD");
  assert.strictEqual(tier.trophyFloor, 2600);
  assert.strictEqual(tier.shardPayout, 1200);
});

runTest("7500 trophies resolves to Apex Grandmaster", () => {
  const tier = getSeasonalTier(7500);
  assert.strictEqual(tier.tier, "APEX_GRANDMASTER");
  assert.strictEqual(tier.trophyFloor, 3600);
  assert.strictEqual(tier.shardPayout, 2500);
});

console.log("\n─── Suite 2: Compressed Trophy Soft Reset Mathematical Integrity ───");

runTest("Bronze player (500 trophies) experiences 0 decay", () => {
  const reset = calculateCompressedTrophyReset(500);
  assert.strictEqual(reset.oldTrophies, 500);
  assert.strictEqual(reset.newTrophies, 500);
  assert.strictEqual(reset.decayedTrophies, 0);
  assert.strictEqual(reset.shardPayout, 50);
});

runTest("Silver player (1500 trophies) soft resets with 40% excess retention: Floor 1000 + 200 = 1200", () => {
  const reset = calculateCompressedTrophyReset(1500);
  assert.strictEqual(reset.oldTrophies, 1500);
  assert.strictEqual(reset.floor, 1000);
  assert.strictEqual(reset.newTrophies, 1200);
  assert.strictEqual(reset.decayedTrophies, 300);
  assert.strictEqual(reset.shardPayout, 150);
});

runTest("Gold player (3000 trophies) soft resets: Floor 1400 + floor(1600 * 0.40 = 640) = 2040", () => {
  const reset = calculateCompressedTrophyReset(3000);
  assert.strictEqual(reset.oldTrophies, 3000);
  assert.strictEqual(reset.floor, 1400);
  assert.strictEqual(reset.newTrophies, 2040);
  assert.strictEqual(reset.decayedTrophies, 960);
  assert.strictEqual(reset.shardPayout, 350);
});

runTest("Platinum player (4200 trophies) soft resets: Floor 2000 + floor(2200 * 0.40 = 880) = 2880", () => {
  const reset = calculateCompressedTrophyReset(4200);
  assert.strictEqual(reset.oldTrophies, 4200);
  assert.strictEqual(reset.floor, 2000);
  assert.strictEqual(reset.newTrophies, 2880);
  assert.strictEqual(reset.decayedTrophies, 1320);
  assert.strictEqual(reset.shardPayout, 700);
});

runTest("Apex Grandmaster (10,000 trophies) soft resets: Floor 3600 + floor(6400 * 0.40 = 2560) = 6160", () => {
  const reset = calculateCompressedTrophyReset(10000);
  assert.strictEqual(reset.oldTrophies, 10000);
  assert.strictEqual(reset.floor, 3600);
  assert.strictEqual(reset.newTrophies, 6160);
  assert.strictEqual(reset.decayedTrophies, 3840);
  assert.strictEqual(reset.shardPayout, 2500);
});

console.log("\n─── Suite 3: Campus Trimester Calendar Alignment ───");

runTest("August-November maps to Fall Semester (Season Alpha)", () => {
  const fallDate = new Date("2026-10-15T12:00:00Z");
  const season = getCurrentSeason(fallDate);
  assert.strictEqual(season.academicSemester, "FALL");
  assert.strictEqual(season.name, "Season Alpha");
  assert.strictEqual(season.isIntermission, false);
});

runTest("January-April maps to Spring Semester (Season Beta)", () => {
  const springDate = new Date("2027-02-15T12:00:00Z");
  const season = getCurrentSeason(springDate);
  assert.strictEqual(season.academicSemester, "SPRING");
  assert.strictEqual(season.name, "Season Beta");
  assert.strictEqual(season.isIntermission, false);
});

runTest("May-July maps to Summer Sprint (Season Gamma)", () => {
  const summerDate = new Date("2027-06-15T12:00:00Z");
  const season = getCurrentSeason(summerDate);
  assert.strictEqual(season.academicSemester, "SUMMER");
  assert.strictEqual(season.name, "Season Gamma");
  assert.strictEqual(season.isIntermission, false);
});

runTest("December maps to Intermission & Calibration Period", () => {
  const decDate = new Date("2026-12-20T12:00:00Z");
  const season = getCurrentSeason(decDate);
  assert.strictEqual(season.academicSemester, "INTERMISSION");
  assert.strictEqual(season.isIntermission, true);
});

console.log("\n─── Suite 4: Season Payout Utility ───");

runTest("calculateSeasonPayout matches specification exactly", () => {
  const p1 = calculateSeasonPayout(800);
  assert.strictEqual(p1.shards, 50);
  assert.strictEqual(p1.tierTitle, "Bronze Scout");

  const p2 = calculateSeasonPayout(2500);
  assert.strictEqual(p2.shards, 350);
  assert.strictEqual(p2.tierTitle, "Gold Sleuth");

  const p3 = calculateSeasonPayout(8000);
  assert.strictEqual(p3.shards, 2500);
  assert.strictEqual(p3.tierTitle, "Apex Grandmaster");
});

console.log("\n========================================================");
console.log("🎉 ALL SEASONAL PRESTIGE LEAGUES TESTS PASSED (100%)");
console.log("========================================================\n");


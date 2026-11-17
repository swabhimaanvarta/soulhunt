import assert from "node:assert";
import {
  isRushHourActive,
  getRushHourStatus,
  isSyndicateWeekendActive,
  getSyndicateWeekendStatus,
  applyLiveEventModifiers,
  getEmergencyBeaconPriority,
} from "../lib/communityEvents";

console.log("\n========================================================");
console.log("⚡ AIEM HUNT — COMMUNITY MINI-EVENTS & TELEMETRY (M9) QA");
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

console.log("─── Suite 1: Rush Hour Recon Time Windows (Asia/Kolkata) ───");

runTest("09:00 IST (Morning Recon Window) triggers Rush Hour active", () => {
  // 09:00 IST = 03:30 UTC
  const morningDate = new Date("2026-11-04T03:30:00.000Z");
  assert.strictEqual(isRushHourActive(morningDate), true);

  const status = getRushHourStatus(morningDate);
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.windowName, "MORNING_RECON");
  assert.strictEqual(status.xpMultiplier, 1.5);
  assert.strictEqual(status.bonusCoins, 20);
  assert.strictEqual(status.minutesRemaining, 30);
});

runTest("17:00 IST (Evening Recon Window) triggers Rush Hour active", () => {
  // 17:00 IST = 11:30 UTC
  const eveningDate = new Date("2026-11-04T11:30:00.000Z");
  assert.strictEqual(isRushHourActive(eveningDate), true);

  const status = getRushHourStatus(eveningDate);
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.windowName, "EVENING_RECON");
  assert.strictEqual(status.xpMultiplier, 1.5);
  assert.strictEqual(status.bonusCoins, 20);
  assert.strictEqual(status.minutesRemaining, 30);
});

runTest("12:00 IST (Midday Off-Peak) triggers Rush Hour inactive", () => {
  // 12:00 IST = 06:30 UTC
  const middayDate = new Date("2026-11-04T06:30:00.000Z");
  assert.strictEqual(isRushHourActive(middayDate), false);

  const status = getRushHourStatus(middayDate);
  assert.strictEqual(status.isActive, false);
  assert.strictEqual(status.windowName, null);
  assert.strictEqual(status.xpMultiplier, 1.0);
  assert.strictEqual(status.bonusCoins, 0);
});

console.log("\n─── Suite 2: Tactical Syndicate Weekend Multipliers ───");

runTest("Friday 19:00 IST activates Syndicate Weekend (2.0x Squad XP)", () => {
  // 2026-11-06 is a Friday. 19:00 IST = 13:30 UTC
  const friNight = new Date("2026-11-06T13:30:00.000Z");
  assert.strictEqual(isSyndicateWeekendActive(friNight), true);

  const status = getSyndicateWeekendStatus(friNight);
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.squadXpMultiplier, 2.0);
  assert(status.hoursRemaining > 48, "Friday night should have > 48 hours remaining in weekend sprint");
});

runTest("Saturday 14:00 IST remains active with 2.0x Squad XP", () => {
  // 2026-11-07 is a Saturday. 14:00 IST = 08:30 UTC
  const satAfternoon = new Date("2026-11-07T08:30:00.000Z");
  assert.strictEqual(isSyndicateWeekendActive(satAfternoon), true);
  const status = getSyndicateWeekendStatus(satAfternoon);
  assert.strictEqual(status.isActive, true);
  assert.strictEqual(status.squadXpMultiplier, 2.0);
});

runTest("Monday 10:00 IST is inactive for Syndicate Weekend", () => {
  // 2026-11-09 is a Monday. 10:00 IST = 04:30 UTC
  const monMorning = new Date("2026-11-09T04:30:00.000Z");
  assert.strictEqual(isSyndicateWeekendActive(monMorning), false);
  const status = getSyndicateWeekendStatus(monMorning);
  assert.strictEqual(status.isActive, false);
  assert.strictEqual(status.squadXpMultiplier, 1.0);
});

console.log("\n─── Suite 3: Reward Calculation with Multipliers ───");

runTest("Applying Rush Hour Recon boost gives 1.5x XP and +20 Coins", () => {
  const morningDate = new Date("2026-11-04T03:30:00.000Z");
  const result = applyLiveEventModifiers({
    baseXp: 100,
    baseCoins: 40,
    now: morningDate,
  });

  assert.strictEqual(result.isRushHour, true);
  assert.strictEqual(result.bonusXp, 50); // 100 * 1.5 = 150 -> bonus 50
  assert.strictEqual(result.effectiveXp, 150);
  assert.strictEqual(result.bonusCoins, 20);
  assert.strictEqual(result.effectiveCoins, 60);
});

runTest("Applying Weekend boost to Squad Quest applies 2.0x multiplier", () => {
  const satDate = new Date("2026-11-07T08:30:00.000Z"); // Saturday 14:00 IST (not rush hour)
  const result = applyLiveEventModifiers({
    baseXp: 200,
    baseCoins: 50,
    isSquadQuest: true,
    now: satDate,
  });

  assert.strictEqual(result.isRushHour, false);
  assert.strictEqual(result.isSyndicateWeekend, true);
  assert.strictEqual(result.effectiveXp, 400); // 200 * 2.0 = 400
  assert.strictEqual(result.effectiveCoins, 50);
});

console.log("\n─── Suite 4: Emergency Campus Beacon Detection ───");

runTest("Lost Student ID card triggers Emergency Beacon (2.0x priority multiplier)", () => {
  const beacon = getEmergencyBeaconPriority({
    title: "AIEM Student ID Card (Mechanical Dept)",
    category: "DOCUMENTS",
  });

  assert.strictEqual(beacon.isEmergencyBeacon, true);
  assert.strictEqual(beacon.priorityMultiplier, 2.0);
  assert.strictEqual(beacon.badgeCode, "beacon-emergency");
  assert(beacon.reason?.includes("student id"), "Reason should mention student id keyword");
});

runTest("Lost Scientific Calculator triggers Emergency Beacon", () => {
  const beacon = getEmergencyBeaconPriority({
    title: "Casio FX-991CW Scientific Calculator",
    category: "ELECTRONICS",
  });

  assert.strictEqual(beacon.isEmergencyBeacon, true);
  assert.strictEqual(beacon.priorityMultiplier, 2.0);
});

runTest("Ordinary umbrella does not trigger Emergency Beacon", () => {
  const beacon = getEmergencyBeaconPriority({
    title: "Blue Foldable Rain Umbrella",
    category: "ACCESSORIES",
  });

  assert.strictEqual(beacon.isEmergencyBeacon, false);
  assert.strictEqual(beacon.priorityMultiplier, 1.0);
  assert.strictEqual(beacon.reason, null);
});

console.log("\n========================================================");
console.log("🎉 ALL COMMUNITY EVENTS & TELEMETRY TESTS PASSED (100%)");
console.log("========================================================\n");


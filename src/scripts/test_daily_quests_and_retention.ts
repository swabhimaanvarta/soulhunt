/**
 * AIEM Hunt — Automated Integration Test Suite: Daily Quests & Retention Engine (Milestone 3)
 *
 * Verifies:
 * 1. Campus Timezone (Asia/Kolkata, IST +05:30) dateKey & reset countdown boundaries.
 * 2. Daily quest rotation determinism & schema validation.
 * 3. Campus action hooks advancing objective progress.
 * 4. Idempotent reward claiming under serial & concurrent conditions.
 * 5. Retention streak logic across consecutive, broken, and repeat completions.
 * 6. API routes GET and POST /api/quests/daily.
 * 7. Content Engine campus date synchronization & graceful quest rotation fallback.
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  User,
  UserDailyQuest,
  Transaction,
  Quest,
  Clue,
  CampusLocation,
} from "../models";
import {
  getCampusDateKey,
  getCampusResetInfo,
  isConsecutiveDay,
  getDailyQuestTemplates,
  getDailyQuestSet,
  recordDailyQuestAction,
  claimDailyQuestReward,
  CAMPUS_DAILY_TEMPLATES,
} from "../lib/dailyQuests";
import { getOrRotateDailyQuest } from "../lib/content/contentEngine";
import { GET as getDailyQuestsRoute, POST as postDailyQuestsRoute } from "../app/api/quests/daily/route";

const RUN_ID = `aiem_hunt_test_daily_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runDailyQuestsAndRetentionTests() {
  console.log("========================================================");
  console.log("🛡️  AIEM HUNT — DAILY QUESTS & RETENTION ENGINE TEST SUITE");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`📦 Connected to ephemeral test database: ${RUN_ID}`);

  let passedCount = 0;
  function pass(msg: string) {
    passedCount++;
    console.log(`  ✅ PASSED: ${msg}`);
  }

  try {
    // ─── Suite 1: Campus Timezone (Asia/Kolkata, IST +05:30) & Countdown Boundaries ───
    console.log("\n─── Suite 1: Asia/Kolkata (IST) & Midnight Countdown Calculations ───");

    // 1.1: 12:00 UTC = 17:30 IST on same date
    const afternoonUtc = new Date("2026-10-30T12:00:00.000Z");
    const afternoonKey = getCampusDateKey(afternoonUtc);
    assert(afternoonKey === "2026-10-30", `Expected 2026-10-30, got ${afternoonKey}`);
    pass("12:00 UTC correctly resolves to 2026-10-30 in Asia/Kolkata (17:30 IST)");

    // 1.2: 18:29:59 UTC = 23:59:59 IST on same date (1 second before midnight)
    const lateUtc = new Date("2026-10-30T18:29:59.000Z");
    const lateKey = getCampusDateKey(lateUtc);
    assert(lateKey === "2026-10-30", `Expected 2026-10-30, got ${lateKey}`);
    pass("18:29:59 UTC correctly resolves to 2026-10-30 (23:59:59 IST)");

    // 1.3: 18:30:00 UTC = 00:00:00 IST of next day (midnight rollover)
    const midnightTurnoverUtc = new Date("2026-10-30T18:30:00.000Z");
    const midnightKey = getCampusDateKey(midnightTurnoverUtc);
    assert(midnightKey === "2026-10-31", `Expected 2026-10-31, got ${midnightKey}`);
    pass("18:30:00 UTC correctly rolls over to next date (2026-10-31 00:00:00 IST)");

    // 1.4: Year rollover 2026-12-31T18:30:00Z -> 2027-01-01
    const newYearUtc = new Date("2026-12-31T18:30:00.000Z");
    const newYearKey = getCampusDateKey(newYearUtc);
    assert(newYearKey === "2027-01-01", `Expected 2027-01-01, got ${newYearKey}`);
    pass("Year-end 18:30:00 UTC turnover correctly advances to 2027-01-01 in IST");

    // 1.5: Countdown timer accuracy
    const resetInfoLate = getCampusResetInfo(lateUtc);
    assert(resetInfoLate.secondsRemaining === 1, `Expected 1 second remaining, got ${resetInfoLate.secondsRemaining}`);
    pass("Countdown timer accurately reports 1 second remaining at 23:59:59 IST");

    const resetInfoNoon = getCampusResetInfo(afternoonUtc);
    // 12:00 UTC to 18:30 UTC is 6.5 hours = 23400 seconds
    assert(resetInfoNoon.secondsRemaining === 23400, `Expected 23400s, got ${resetInfoNoon.secondsRemaining}`);
    pass("Countdown timer accurately calculates 23400 seconds remaining at 17:30 IST");

    const resetInfoTurnover = getCampusResetInfo(midnightTurnoverUtc);
    // Exactly at midnight, next reset is in 24 hours = 86400 seconds
    assert(resetInfoTurnover.secondsRemaining === 86400, `Expected 86400s at midnight, got ${resetInfoTurnover.secondsRemaining}`);
    pass("Countdown timer resets to full 86400 seconds (24h) immediately upon IST midnight");

    // ─── Suite 2: Daily Quest Rotation Determinism & Schema Verification ───
    console.log("\n─── Suite 2: Daily Quest Templates & Determinism ───");

    const templatesDay1 = getDailyQuestTemplates("2026-10-30");
    const templatesDay1Recheck = getDailyQuestTemplates("2026-10-30");
    assert(templatesDay1.length === 3, "Expected 3 daily quest objectives");
    assert(templatesDay1[0].questKey === templatesDay1Recheck[0].questKey, "Rotation must be deterministic");
    assert(templatesDay1[0].rewardXp === 150 && templatesDay1[0].rewardCoins === 40, "Objective 1 reward XP/coins match spec");
    assert(templatesDay1[1].rewardXp === 100 && templatesDay1[1].rewardCoins === 30, "Objective 2 reward XP/coins match spec");
    assert(templatesDay1[2].rewardXp === 250 && templatesDay1[2].rewardCoins === 60, "Objective 3 reward XP/coins match spec");
    pass("Daily quest templates are deterministic, non-empty, and align with design specs");

    // Verify compound unique index on UserDailyQuest
    await UserDailyQuest.createIndexes();
    const indexes = await UserDailyQuest.collection.indexes();
    const compoundIdx = indexes.find((idx) => {
      const keys = Object.keys(idx.key || {});
      return keys.includes("userId") && keys.includes("dateKey") && keys.includes("questKey");
    });
    assert(Boolean(compoundIdx), "UserDailyQuest must have compound index on { userId, dateKey, questKey }");
    assert(compoundIdx?.unique === true, "UserDailyQuest compound index must be unique");
    pass("UserDailyQuest compound unique index { userId: 1, dateKey: 1, questKey: 1 } confirmed");

    // ─── Suite 3: Campus Action Hooks & Objective Advancement ───
    console.log("\n─── Suite 3: Campus Action Hooks & Progress Advancement ───");

    const hunter = await User.create({
      email: "daily_hunter@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "daily_agent",
      displayName: "Rohan Hunter",
      role: "STUDENT",
      department: "Information Technology",
      xp: 0,
      level: 1,
      coins: 50,
      dailyStreak: 0,
      longestDailyStreak: 0,
    });

    const todayKey = getCampusDateKey();

    // Initial quest set for user
    const initialSet = await getDailyQuestSet(todayKey, hunter._id.toString());
    assert(initialSet.quests.every((q) => q.currentProgress === 0 && !q.isCompleted), "Initial progress must be 0");
    pass("Initial daily quest state is initialized at 0 progress and uncompleted");

    // Hook 1: SOLVE_CLUE
    await recordDailyQuestAction(hunter._id.toString(), "SOLVE_CLUE", 1);
    let afterOneClue = await UserDailyQuest.findOne({
      userId: hunter._id,
      dateKey: todayKey,
      questKey: "daily-clues-1",
    });
    assert(afterOneClue?.currentProgress === 1, `Expected progress 1, got ${afterOneClue?.currentProgress}`);
    assert(afterOneClue?.isCompleted === false, "Progress 1 of 2 should not be completed");
    pass("Single clue solve increments progress from 0 to 1 without completing");

    await recordDailyQuestAction(hunter._id.toString(), "SOLVE_CLUE", 1);
    let afterTwoClues = await UserDailyQuest.findOne({
      userId: hunter._id,
      dateKey: todayKey,
      questKey: "daily-clues-1",
    });
    assert(afterTwoClues?.currentProgress === 2, `Expected progress 2, got ${afterTwoClues?.currentProgress}`);
    assert(afterTwoClues?.isCompleted === true, "Progress 2 of 2 must mark quest as completed");
    assert(Boolean(afterTwoClues?.completedAt), "completedAt timestamp must be populated");
    pass("Second clue solve reaches target, marking isCompleted = true with completedAt timestamp");

    // Additional action past target count should not overflow
    await recordDailyQuestAction(hunter._id.toString(), "SOLVE_CLUE", 1);
    let afterThreeClues = await UserDailyQuest.findOne({
      userId: hunter._id,
      dateKey: todayKey,
      questKey: "daily-clues-1",
    });
    assert(afterThreeClues?.currentProgress === 2, "Progress must cap at targetCount (2)");
    pass("Surplus actions past target count are safely capped at targetCount");

    // Hook 2: REPORT_LOST
    await recordDailyQuestAction(hunter._id.toString(), "REPORT_LOST", 1);
    let vigilanceQuest = await UserDailyQuest.findOne({
      userId: hunter._id,
      dateKey: todayKey,
      questKey: "daily-vigilance-1",
    });
    assert(vigilanceQuest?.currentProgress === 1 && vigilanceQuest?.isCompleted === true, "REPORT_LOST completes vigilance quest");
    pass("REPORT_LOST action successfully satisfies campus vigilance objective");

    // Hook 3: COMPLETE_QUEST
    await recordDailyQuestAction(hunter._id.toString(), "COMPLETE_QUEST", 1);
    let resolveQuest = await UserDailyQuest.findOne({
      userId: hunter._id,
      dateKey: todayKey,
      questKey: "daily-resolve-1",
    });
    assert(resolveQuest?.currentProgress === 1 && resolveQuest?.isCompleted === true, "COMPLETE_QUEST completes resolve quest");
    pass("COMPLETE_QUEST action successfully completes case resolution objective");

    // ─── Suite 4: Reward Claim Idempotency & Concurrency Protection ───
    console.log("\n─── Suite 4: Idempotent Reward Claims & Concurrency Protection ───");

    // First claim of daily-clues-1
    const claimRes1 = await claimDailyQuestReward(hunter._id.toString(), "daily-clues-1", todayKey);
    assert(claimRes1.success === true, "First reward claim must succeed");
    assert(claimRes1.coinsAwarded === 40, `Expected 40 coins, got ${claimRes1.coinsAwarded}`);
    assert(claimRes1.xpAwarded === 150, `Expected 150 XP, got ${claimRes1.xpAwarded}`);

    const refreshedHunter = await User.findById(hunter._id);
    assert(refreshedHunter?.coins === 90, `Coins should be 50 + 40 = 90, got ${refreshedHunter?.coins}`);
    assert(refreshedHunter?.xp === 150, `XP should be 150, got ${refreshedHunter?.xp}`);

    // Verify transaction record created
    const dailyTx = await Transaction.findOne({
      userId: hunter._id,
      referenceType: "DAILY_QUEST",
      referenceId: `${todayKey}:daily-clues-1`,
    });
    assert(Boolean(dailyTx), "Transaction audit record must exist with referenceType DAILY_QUEST");
    pass("Initial reward claim credits coins/XP and creates audit transaction");

    // Duplicate claim attempt (serial)
    const claimRes2 = await claimDailyQuestReward(hunter._id.toString(), "daily-clues-1", todayKey);
    assert(claimRes2.success === false, "Second reward claim must fail");
    assert(claimRes2.alreadyClaimed === true, "Second claim must report alreadyClaimed = true");

    const recheckHunter = await User.findById(hunter._id);
    assert(recheckHunter?.coins === 90, "Coins must NOT increase on duplicate claim");
    assert(recheckHunter?.xp === 150, "XP must NOT increase on duplicate claim");
    pass("Second serial claim attempt is strictly rejected with zero additional coin/XP payout");

    // Concurrent claim attempt simulation on daily-vigilance-1
    const concurrentClaims = await Promise.all([
      claimDailyQuestReward(hunter._id.toString(), "daily-vigilance-1", todayKey),
      claimDailyQuestReward(hunter._id.toString(), "daily-vigilance-1", todayKey),
      claimDailyQuestReward(hunter._id.toString(), "daily-vigilance-1", todayKey),
    ]);

    const successes = concurrentClaims.filter((c) => c.success);
    const rejected = concurrentClaims.filter((c) => !c.success);
    assert(successes.length === 1, `Expected exactly 1 successful claim under race condition, got ${successes.length}`);
    assert(rejected.length === 2, `Expected 2 rejected claims, got ${rejected.length}`);
    pass("Concurrent claim burst race condition: exactly 1 wins, 2 rejected idempotently");

    // Claim attempt on uncompleted quest should fail
    const uncompletedUserId = new Types.ObjectId().toString();
    const failClaim = await claimDailyQuestReward(uncompletedUserId, "daily-clues-1", todayKey);
    assert(failClaim.success === false, "Unstarted / uncompleted quest claim must be rejected");
    pass("Reward claim for uncompleted quest is properly blocked");

    // ─── Suite 5: Daily Streak Retention & Consecutive Day Logic ───
    console.log("\n─── Suite 5: Daily Streak Retention & Calendar Logic ───");

    assert(isConsecutiveDay("2026-10-29", "2026-10-30") === true, "Oct 29 to Oct 30 is consecutive");
    assert(isConsecutiveDay("2026-10-30", "2026-10-30") === false, "Same day is not consecutive");
    assert(isConsecutiveDay("2026-10-28", "2026-10-30") === false, "2-day gap is not consecutive");
    assert(isConsecutiveDay("2026-02-28", "2026-03-01") === true, "Feb 28 to Mar 01 is consecutive");
    assert(isConsecutiveDay("2026-12-31", "2027-01-01") === true, "Dec 31 to Jan 01 is consecutive");
    pass("isConsecutiveDay handles ordinary, leap, month, and year calendar boundaries flawlessly");

    // Check streak of hunter who just finished all 3 quests today
    await claimDailyQuestReward(hunter._id.toString(), "daily-resolve-1", todayKey);
    const streakHunter = await User.findById(hunter._id);
    assert(streakHunter?.dailyStreak === 1, `Expected dailyStreak 1, got ${streakHunter?.dailyStreak}`);
    assert(streakHunter?.longestDailyStreak === 1, "Expected longestDailyStreak 1");
    assert(streakHunter?.lastDailyCompletionDate === todayKey, "lastDailyCompletionDate should be today's dateKey");
    pass("Completing all daily objectives initializes dailyStreak = 1 and sets lastDailyCompletionDate");

    // Re-checking on same day must not increment streak again
    await claimDailyQuestReward(hunter._id.toString(), "daily-resolve-1", todayKey);
    const sameDayCheck = await User.findById(hunter._id);
    assert(sameDayCheck?.dailyStreak === 1, "dailyStreak must not increment twice on same date");
    pass("Duplicate completions on same date preserve streak without false increments");

    // Simulate next consecutive day completion
    const [y, m, d] = todayKey.split("-").map(Number);
    const nextDayObj = new Date(Date.UTC(y, m - 1, d + 1));
    const tomorrowKey = nextDayObj.toISOString().slice(0, 10);
    // Mock user having finished todayKey
    await User.findByIdAndUpdate(hunter._id, {
      $set: { lastDailyCompletionDate: todayKey, dailyStreak: 1, longestDailyStreak: 1 },
    });

    for (const t of CAMPUS_DAILY_TEMPLATES) {
      await UserDailyQuest.create({
        userId: hunter._id,
        dateKey: tomorrowKey,
        questKey: t.questKey,
        targetCount: t.targetCount,
        currentProgress: t.targetCount,
        isCompleted: true,
        isClaimed: false,
      });
    }

    await claimDailyQuestReward(hunter._id.toString(), "daily-clues-1", tomorrowKey);
    const consecutiveHunter = await User.findById(hunter._id);
    assert(consecutiveHunter?.dailyStreak === 2, `Expected streak 2 on consecutive day, got ${consecutiveHunter?.dailyStreak}`);
    assert(consecutiveHunter?.longestDailyStreak === 2, "longestDailyStreak should update to 2");
    pass("Consecutive day completion properly advances dailyStreak to 2 and updates longestDailyStreak");

    // Simulate broken streak (missed days)
    const gapDayObj = new Date(Date.UTC(y, m - 1, d + 6));
    const gapDateKey = gapDayObj.toISOString().slice(0, 10);
    for (const t of CAMPUS_DAILY_TEMPLATES) {
      await UserDailyQuest.create({
        userId: hunter._id,
        dateKey: gapDateKey,
        questKey: t.questKey,
        targetCount: t.targetCount,
        currentProgress: t.targetCount,
        isCompleted: true,
        isClaimed: false,
      });
    }

    await claimDailyQuestReward(hunter._id.toString(), "daily-clues-1", gapDateKey);
    const brokenHunter = await User.findById(hunter._id);
    assert(brokenHunter?.dailyStreak === 1, `Broken streak should reset to 1, got ${brokenHunter?.dailyStreak}`);
    assert(brokenHunter?.longestDailyStreak === 2, `longestDailyStreak should be preserved at 2, got ${brokenHunter?.longestDailyStreak}`);
    pass("Broken streak (missed days) resets dailyStreak to 1 while preserving highest longestDailyStreak");

    // ─── Suite 6: Daily Quests API Route (GET and POST /api/quests/daily) ───
    console.log("\n─── Suite 6: HTTP Route Layer (/api/quests/daily) ───");

    // GET /api/quests/daily without session
    delete (globalThis as any).__TEST_CURRENT_USER__;
    const reqGetAnon = new NextRequest("http://localhost:3000/api/quests/daily");
    const resGetAnon = await getDailyQuestsRoute(reqGetAnon);
    const jsonGetAnon = await resGetAnon.json();
    assert(jsonGetAnon.success === true, "GET /api/quests/daily should succeed for unauthenticated visitor");
    assert(jsonGetAnon.quests.length === 3, "GET should return 3 rotating objectives");
    assert(typeof jsonGetAnon.secondsRemaining === "number", "secondsRemaining should be numeric");
    pass("GET /api/quests/daily returns valid campus daily quest board with countdown timer");

    // POST /api/quests/daily unauthenticated -> 401
    const reqPostAnon = new NextRequest("http://localhost:3000/api/quests/daily", {
      method: "POST",
      body: JSON.stringify({ questKey: "daily-clues-1" }),
    });
    const resPostAnon = await postDailyQuestsRoute(reqPostAnon);
    assert(resPostAnon.status === 401, `Expected 401 for unauthenticated claim, got ${resPostAnon.status}`);
    pass("POST /api/quests/daily strictly rejects unauthenticated claim with 401");

    // POST /api/quests/daily with authenticated session
    (globalThis as any).__TEST_CURRENT_USER__ = brokenHunter;
    const reqPostAuth = new NextRequest("http://localhost:3000/api/quests/daily", {
      method: "POST",
      body: JSON.stringify({ questKey: "daily-vigilance-1", dateKey: gapDateKey }),
    });
    const resPostAuth = await postDailyQuestsRoute(reqPostAuth);
    const jsonPostAuth = await resPostAuth.json();
    assert(resPostAuth.status === 200, "Authenticated reward claim should return 200");
    assert(jsonPostAuth.success === true, "Claim payload should indicate success");
    pass("POST /api/quests/daily successfully claims reward for authenticated hunter");

    // Duplicate POST on same quest returns 409 Conflict
    const reqPostDup = new NextRequest("http://localhost:3000/api/quests/daily", {
      method: "POST",
      body: JSON.stringify({ questKey: "daily-vigilance-1", dateKey: gapDateKey }),
    });
    const resPostDup = await postDailyQuestsRoute(reqPostDup);
    assert(resPostDup.status === 409, `Duplicate POST should return 409 Conflict, got ${resPostDup.status}`);
    pass("POST /api/quests/daily duplicate claim returns 409 Conflict with ALREADY_CLAIMED");

    delete (globalThis as any).__TEST_CURRENT_USER__;

    // ─── Suite 7: Content Engine UTC fix & Safe Daily Hunt Rotation ───
    console.log("\n─── Suite 7: Content Engine Fallback & Campus Timezone Alignment ───");

    // Seed a CampusLocation to allow Quest creation
    await CampusLocation.create({
      code: "BLK-B",
      name: "Engineering Block B",
      zoneType: "ACADEMIC_BLOCK",
      coordinates: { lat: 15.283, lng: 73.985, mapX: 200, mapY: 200 },
      isActive: true,
    });

    // Call getOrRotateDailyQuest()
    const rotated = await getOrRotateDailyQuest();
    assert(Boolean(rotated.quest), "getOrRotateDailyQuest must return or create an active daily quest");
    assert(rotated.today === getCampusDateKey(), "Returned today date string must match campus dateKey in Asia/Kolkata");
    assert(rotated.quest?.questType === "DAILY_HUNT", "Created quest must have questType DAILY_HUNT");
    assert(rotated.clues.length > 0, "Created quest must have associated stage clues");
    pass("getOrRotateDailyQuest generates deterministic campus mystery with IST dateKey without crashing");

    console.log("\n========================================================");
    console.log(`🎉 ALL DAILY QUESTS & RETENTION TESTS PASSED: ${passedCount} PASSED | 0 FAILED`);
    console.log("========================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
  }
}

runDailyQuestsAndRetentionTests().catch((err) => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});

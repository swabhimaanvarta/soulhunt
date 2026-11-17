/**
 * AIEM Hunt — Adversarial Stress Test Suite: Daily Quests & Retention Engine
 * Challenger Role: Empirical verification, race condition stress tests, boundary conditions.
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  User,
  UserDailyQuest,
  Transaction,
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
import { POST as postDailyQuestsRoute } from "../app/api/quests/daily/route";

const RUN_ID = `aiem_hunt_stress_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ADVERSARIAL ASSERTION FAILED: ${message}`);
  }
}

async function runAdversarialStressSuite() {
  console.log("==================================================================");
  console.log("⚡ AIEM HUNT — ADVERSARIAL STRESS TEST: DAILY QUESTS & RETENTION");
  console.log(`   Database: ${TEST_DB_URI}`);
  console.log("==================================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`Connected to isolated test database: ${RUN_ID}`);

  // Ensure all model indexes are created
  await UserDailyQuest.createIndexes();
  await Transaction.createIndexes();
  await User.createIndexes();

  let passedAssertions = 0;
  function pass(msg: string) {
    passedAssertions++;
    console.log(`  🔥 [PASS]: ${msg}`);
  }

  try {
    // =========================================================================
    // TEST 1: Concurrency Stress Test — 20 Parallel Claims via Promise.all
    // =========================================================================
    console.log("\n▶ TEST 1: Concurrency Stress Test (20 Parallel Claims on Single Quest)");
    const stressUser = await User.create({
      email: "stress_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "stress_hunter",
      displayName: "Stress Tester",
      role: "STUDENT",
      department: "Computer Science",
      xp: 0,
      level: 1,
      coins: 50,
      dailyStreak: 0,
      longestDailyStreak: 0,
    });

    const testDateKey = "2026-10-30";
    const testQuestKey = "daily-clues-1"; // Reward: 150 XP, 40 Coins

    // Pre-populate completed quest document
    await UserDailyQuest.create({
      userId: stressUser._id,
      dateKey: testDateKey,
      questKey: testQuestKey,
      targetCount: 2,
      currentProgress: 2,
      isCompleted: true,
      isClaimed: false,
    });

    // Launch 20 concurrent claims
    const claimPromises = Array.from({ length: 20 }, (_, i) =>
      claimDailyQuestReward(stressUser._id.toString(), testQuestKey, testDateKey)
    );

    const claimResults = await Promise.all(claimPromises);

    const winningClaims = claimResults.filter((r) => r.success);
    const rejectedClaims = claimResults.filter((r) => !r.success);

    assert(
      winningClaims.length === 1,
      `Expected exactly 1 claim to succeed under 20 parallel requests, got ${winningClaims.length}`
    );
    assert(
      winningClaims[0].coinsAwarded === 40,
      `Expected winner coinsAwarded = 40, got ${winningClaims[0].coinsAwarded}`
    );
    assert(
      winningClaims[0].xpAwarded === 150,
      `Expected winner xpAwarded = 150, got ${winningClaims[0].xpAwarded}`
    );
    pass("Exactly 1 concurrent claim succeeded with full reward payload");

    assert(
      rejectedClaims.length === 19,
      `Expected 19 rejected claims, got ${rejectedClaims.length}`
    );
    assert(
      rejectedClaims.every((r) => r.alreadyClaimed === true && r.error === "ALREADY_CLAIMED"),
      "All 19 rejected parallel calls must report alreadyClaimed = true and error ALREADY_CLAIMED"
    );
    pass("All 19 competing concurrent calls were rejected with ALREADY_CLAIMED");

    // Check user coins and XP in DB
    const freshUser = await User.findById(stressUser._id);
    assert(
      freshUser?.coins === 90,
      `User coins must increment by exactly 40 (50 -> 90), but got ${freshUser?.coins}`
    );
    assert(
      freshUser?.xp === 150,
      `User XP must increment by exactly 150 (0 -> 150), but got ${freshUser?.xp}`
    );
    pass("User balance updated exactly once (no double-credit / inflation)");

    // Check Transaction count
    const txCount = await Transaction.countDocuments({
      userId: stressUser._id,
      referenceType: "DAILY_QUEST",
    });
    assert(
      txCount === 1,
      `Expected exactly 1 Transaction record in database, found ${txCount}`
    );

    const txDoc = await Transaction.findOne({
      userId: stressUser._id,
      referenceType: "DAILY_QUEST",
    });
    assert(
      txDoc?.referenceId === `${testDateKey}:${testQuestKey}`,
      `Transaction referenceId mismatch: got ${txDoc?.referenceId}`
    );
    assert(
      txDoc?.deltaCoins === 40 && txDoc?.deltaXp === 150,
      `Transaction delta amounts incorrect: coins=${txDoc?.deltaCoins}, xp=${txDoc?.deltaXp}`
    );
    pass("Database contains exactly 1 Transaction audit record with correct referenceId & deltas");

    // =========================================================================
    // TEST 2: Concurrency Stress Test on Action Hooks (20 Parallel Dispatches)
    // =========================================================================
    console.log("\n▶ TEST 2: Concurrency Stress on recordDailyQuestAction (20 parallel dispatches)");
    const hookUser = await User.create({
      email: "hook_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "hook_hunter",
      displayName: "Hook Hunter",
      role: "STUDENT",
      department: "Mechanical Engineering",
      xp: 0,
      level: 1,
      coins: 50,
    });

    // 20 parallel dispatches of SOLVE_CLUE on a fresh user (upsert race condition stress)
    const actionPromises = Array.from({ length: 20 }, () =>
      recordDailyQuestAction(hookUser._id.toString(), "SOLVE_CLUE", 1)
    );

    await Promise.all(actionPromises);

    const userDocs = await UserDailyQuest.find({
      userId: hookUser._id,
      questKey: "daily-clues-1",
    });

    assert(
      userDocs.length === 1,
      `Expected exactly 1 UserDailyQuest doc for daily-clues-1, found ${userDocs.length} (duplicate key race condition failed!)`
    );
    assert(
      userDocs[0].currentProgress === 2,
      `Progress must cap at targetCount (2), got ${userDocs[0].currentProgress}`
    );
    assert(
      userDocs[0].isCompleted === true,
      "Quest must be marked completed"
    );
    pass("Parallel action hook dispatch handled compound unique key race gracefully with 0 duplicates and capped progress");

    // =========================================================================
    // TEST 3: Progress Cap & Overflow Resilience
    // =========================================================================
    console.log("\n▶ TEST 3: Progress Cap & Boundary Overflow Resilience");
    const capUser = await User.create({
      email: "cap_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "cap_hunter",
      displayName: "Cap Hunter",
      role: "STUDENT",
      department: "Civil Engineering",
      xp: 0,
      level: 1,
      coins: 50,
    });

    // Action with huge batch count: count = 999
    await recordDailyQuestAction(capUser._id.toString(), "SOLVE_CLUE", 999);
    const capDoc = await UserDailyQuest.findOne({
      userId: capUser._id,
      questKey: "daily-clues-1",
    });
    assert(
      capDoc?.currentProgress === 2,
      `Batch action count of 999 must clamp to targetCount 2, got ${capDoc?.currentProgress}`
    );
    assert(capDoc?.isCompleted === true, "Must be completed");
    const originalCompletedAt = capDoc?.completedAt?.getTime();

    // Additional action when already completed
    await recordDailyQuestAction(capUser._id.toString(), "SOLVE_CLUE", 1);
    const capDocAfter = await UserDailyQuest.findOne({
      userId: capUser._id,
      questKey: "daily-clues-1",
    });
    assert(
      capDocAfter?.currentProgress === 2,
      "Progress must remain 2 after additional actions on completed quest"
    );
    assert(
      capDocAfter?.completedAt?.getTime() === originalCompletedAt,
      "completedAt timestamp must remain immutable once completed"
    );
    pass("Massive surplus batch actions clamped to targetCount; subsequent actions leave completed state untouched");

    // =========================================================================
    // TEST 4: Action Hook Dispatch Matrix (All 4 Action Types)
    // =========================================================================
    console.log("\n▶ TEST 4: Action Hook Dispatch Matrix (SOLVE_CLUE, REPORT_LOST, DEPOSIT_FOUND, COMPLETE_QUEST)");
    const matrixUser = await User.create({
      email: "matrix_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "matrix_hunter",
      displayName: "Matrix Hunter",
      role: "STUDENT",
      department: "ECE",
      xp: 0,
      level: 1,
      coins: 50,
    });

    const todayDateKey = getCampusDateKey();

    // 4.1 SOLVE_CLUE -> affects daily-clues-1 ONLY
    await recordDailyQuestAction(matrixUser._id.toString(), "SOLVE_CLUE", 1);
    const mClue = await UserDailyQuest.findOne({ userId: matrixUser._id, dateKey: todayDateKey, questKey: "daily-clues-1" });
    const mVig1 = await UserDailyQuest.findOne({ userId: matrixUser._id, dateKey: todayDateKey, questKey: "daily-vigilance-1" });
    const mRes1 = await UserDailyQuest.findOne({ userId: matrixUser._id, dateKey: todayDateKey, questKey: "daily-resolve-1" });
    assert(mClue?.currentProgress === 1, "daily-clues-1 must be 1");
    assert(!mVig1, "daily-vigilance-1 must not be created by SOLVE_CLUE");
    assert(!mRes1, "daily-resolve-1 must not be created by SOLVE_CLUE");
    pass("SOLVE_CLUE strictly advances daily-clues-1 without side-effects on vigilance or resolve");

    // 4.2 REPORT_LOST -> affects daily-vigilance-1
    await recordDailyQuestAction(matrixUser._id.toString(), "REPORT_LOST", 1);
    const mVigAfterLost = await UserDailyQuest.findOne({ userId: matrixUser._id, dateKey: todayDateKey, questKey: "daily-vigilance-1" });
    assert(mVigAfterLost?.currentProgress === 1 && mVigAfterLost.isCompleted === true, "REPORT_LOST completes vigilance quest");
    pass("REPORT_LOST satisfies daily-vigilance-1");

    // Reset vigilance quest to test DEPOSIT_FOUND
    await UserDailyQuest.deleteOne({ _id: mVigAfterLost?._id });

    // 4.3 DEPOSIT_FOUND -> also affects daily-vigilance-1 (acceptedActionTypes)
    await recordDailyQuestAction(matrixUser._id.toString(), "DEPOSIT_FOUND", 1);
    const mVigAfterFound = await UserDailyQuest.findOne({ userId: matrixUser._id, dateKey: todayDateKey, questKey: "daily-vigilance-1" });
    assert(mVigAfterFound?.currentProgress === 1 && mVigAfterFound.isCompleted === true, "DEPOSIT_FOUND completes vigilance quest");
    pass("DEPOSIT_FOUND satisfies daily-vigilance-1 via acceptedActionTypes");

    // 4.4 COMPLETE_QUEST -> affects daily-resolve-1
    await recordDailyQuestAction(matrixUser._id.toString(), "COMPLETE_QUEST", 1);
    const mResAfter = await UserDailyQuest.findOne({ userId: matrixUser._id, dateKey: todayDateKey, questKey: "daily-resolve-1" });
    assert(mResAfter?.currentProgress === 1 && mResAfter.isCompleted === true, "COMPLETE_QUEST completes daily-resolve-1");
    pass("COMPLETE_QUEST satisfies daily-resolve-1");

    // 4.5 Robustness on bad / invalid userIds
    await recordDailyQuestAction("", "SOLVE_CLUE", 1);
    await recordDailyQuestAction("not-an-id", "SOLVE_CLUE", 1);
    await recordDailyQuestAction(null as any, "SOLVE_CLUE", 1);
    pass("recordDailyQuestAction gracefully handles empty, invalid, and null userIds without throwing");

    // =========================================================================
    // TEST 5: Comprehensive Streak Boundary & Multi-Day Transition Matrix
    // =========================================================================
    console.log("\n▶ TEST 5: Multi-Day Streak State Machine & Boundary Transitions");
    const streakUser = await User.create({
      email: "streak_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "streak_hunter",
      displayName: "Streak Hunter",
      role: "STUDENT",
      department: "Data Science",
      xp: 0,
      level: 1,
      coins: 50,
      dailyStreak: 0,
      longestDailyStreak: 0,
      lastDailyCompletionDate: null,
    });

    const days = [
      { date: "2026-02-27", completeAll: true, expectedStreak: 1, expectedLongest: 1, desc: "Day 1: initial streak start" },
      { date: "2026-02-28", completeAll: true, expectedStreak: 2, expectedLongest: 2, desc: "Day 2: consecutive increment" },
      { date: "2026-03-01", completeAll: true, expectedStreak: 3, expectedLongest: 3, desc: "Day 3: month boundary transition (Feb 28 -> Mar 1)" },
      { date: "2026-03-02", completeAll: false, expectedStreak: 3, expectedLongest: 3, desc: "Day 4: incomplete day (no streak advance)" },
      { date: "2026-03-04", completeAll: true, expectedStreak: 1, expectedLongest: 3, desc: "Day 6: missed Day 4 & 5 -> streak resets to 1, longest preserved at 3" },
      { date: "2026-03-05", completeAll: true, expectedStreak: 2, expectedLongest: 3, desc: "Day 7: consecutive again -> streak 2, longest remains 3" },
    ];

    for (const d of days) {
      if (d.completeAll) {
        // Create all 3 quests completed
        for (const t of CAMPUS_DAILY_TEMPLATES) {
          await UserDailyQuest.create({
            userId: streakUser._id,
            dateKey: d.date,
            questKey: t.questKey,
            targetCount: t.targetCount,
            currentProgress: t.targetCount,
            isCompleted: true,
            isClaimed: false,
          });
        }
        // Claim the last quest to trigger checkAndUpdateDailyStreak
        const claimRes = await claimDailyQuestReward(streakUser._id.toString(), "daily-resolve-1", d.date);
        assert(claimRes.success === true, `Claim on ${d.date} failed`);
      } else {
        // Only complete 1 quest, leave others absent
        await UserDailyQuest.create({
          userId: streakUser._id,
          dateKey: d.date,
          questKey: "daily-clues-1",
          targetCount: 2,
          currentProgress: 1,
          isCompleted: false,
          isClaimed: false,
        });
      }

      const u = await User.findById(streakUser._id);
      assert(
        u?.dailyStreak === d.expectedStreak,
        `Streak mismatch on ${d.date} (${d.desc}): expected ${d.expectedStreak}, got ${u?.dailyStreak}`
      );
      assert(
        u?.longestDailyStreak === d.expectedLongest,
        `Longest streak mismatch on ${d.date}: expected ${d.expectedLongest}, got ${u?.longestDailyStreak}`
      );
      pass(`Streak assertion passed for ${d.desc}`);
    }

    // Repeat check on same day: claiming another quest on 2026-03-05 must not increment streak
    await claimDailyQuestReward(streakUser._id.toString(), "daily-clues-1", "2026-03-05");
    const uSameDay = await User.findById(streakUser._id);
    assert(
      uSameDay?.dailyStreak === 2,
      `Repeat claim on same day must keep dailyStreak at 2, got ${uSameDay?.dailyStreak}`
    );
    pass("Repeat claims on the same day strictly maintain streak without duplicate increment");

    // Year turnover test
    assert(isConsecutiveDay("2026-12-31", "2027-01-01") === true, "Dec 31 to Jan 1 is consecutive");
    assert(isConsecutiveDay("2026-12-31", "2027-01-02") === false, "Dec 31 to Jan 2 is not consecutive");
    pass("Calendar year turnover boundary confirmed");

    // =========================================================================
    // TEST 6: HTTP Route Layer Concurrency (15 Parallel POSTs to /api/quests/daily)
    // =========================================================================
    console.log("\n▶ TEST 6: HTTP Route Layer Concurrency (15 Parallel POSTs to /api/quests/daily)");
    const httpUser = await User.create({
      email: "http_stress@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "http_hunter",
      displayName: "HTTP Hunter",
      role: "STUDENT",
      department: "IT",
      xp: 0,
      level: 1,
      coins: 50,
    });

    const httpDateKey = "2026-10-30";
    await UserDailyQuest.create({
      userId: httpUser._id,
      dateKey: httpDateKey,
      questKey: "daily-resolve-1",
      targetCount: 1,
      currentProgress: 1,
      isCompleted: true,
      isClaimed: false,
    });

    // Mock authenticated user on globalThis
    (globalThis as any).__TEST_CURRENT_USER__ = httpUser;

    const httpPromises = Array.from({ length: 15 }, () => {
      const req = new NextRequest("http://localhost:3000/api/quests/daily", {
        method: "POST",
        body: JSON.stringify({ questKey: "daily-resolve-1", dateKey: httpDateKey }),
      });
      return postDailyQuestsRoute(req);
    });

    const httpResponses = await Promise.all(httpPromises);
    const successRes = httpResponses.filter((r) => r.status === 200);
    const conflictRes = httpResponses.filter((r) => r.status === 409);

    assert(
      successRes.length === 1,
      `Expected exactly 1 HTTP 200 from 15 parallel route calls, got ${successRes.length}`
    );
    assert(
      conflictRes.length === 14,
      `Expected exactly 14 HTTP 409 Conflict from parallel route calls, got ${conflictRes.length}`
    );

    const winnerJson = await successRes[0].json();
    assert(winnerJson.success === true, "Winner JSON success must be true");
    assert(winnerJson.coinsAwarded === 60, "Winner coinsAwarded must be 60");
    assert(winnerJson.xpAwarded === 250, "Winner xpAwarded must be 250");

    const loserJson = await conflictRes[0].json();
    assert(loserJson.success === false, "Loser JSON success must be false");
    assert(loserJson.error.code === "ALREADY_CLAIMED", "Loser error code must be ALREADY_CLAIMED");

    delete (globalThis as any).__TEST_CURRENT_USER__;
    pass("HTTP route layer handles 15 parallel bursts with exactly 1 HTTP 200 and 14 HTTP 409 Conflicts");

    // =========================================================================
    // TEST 7: IST Midnight Clock & Monotonic Countdown Stress
    // =========================================================================
    console.log("\n▶ TEST 7: IST Midnight Countdown & Millisecond Boundary Precision");

    // 1 millisecond before midnight IST: 18:29:59.999Z UTC
    const subSecondBeforeMidnight = new Date("2026-10-30T18:29:59.999Z");
    const subSecondKey = getCampusDateKey(subSecondBeforeMidnight);
    const subSecondReset = getCampusResetInfo(subSecondBeforeMidnight);
    assert(subSecondKey === "2026-10-30", "1ms before midnight must still belong to 2026-10-30");
    assert(subSecondReset.secondsRemaining === 0 || subSecondReset.secondsRemaining === 1, "Remaining seconds at 1ms before midnight should be 0 or 1");

    // Exactly at midnight IST: 18:30:00.000Z UTC
    const exactMidnight = new Date("2026-10-30T18:30:00.000Z");
    const midnightKey = getCampusDateKey(exactMidnight);
    const midnightReset = getCampusResetInfo(exactMidnight);
    assert(midnightKey === "2026-10-31", "Exactly at 18:30:00Z must be 2026-10-31 in IST");
    assert(midnightReset.secondsRemaining === 86400, `At midnight, secondsRemaining must be exactly 86400, got ${midnightReset.secondsRemaining}`);

    // Monotonicity check across 5 evenly spaced hourly steps
    let previousRemaining = 86400;
    for (let hour = 1; hour <= 5; hour++) {
      const stepDate = new Date(exactMidnight.getTime() + hour * 3600 * 1000);
      const info = getCampusResetInfo(stepDate);
      const expectedRemaining = 86400 - hour * 3600;
      assert(
        info.secondsRemaining === expectedRemaining,
        `Hour ${hour}: expected ${expectedRemaining}s, got ${info.secondsRemaining}s`
      );
      assert(
        info.secondsRemaining < previousRemaining,
        `Countdown must strictly decrease monotonically: ${info.secondsRemaining} < ${previousRemaining}`
      );
      previousRemaining = info.secondsRemaining;
    }
    pass("IST countdown timer is strictly monotonic, non-negative, and exact to the second across hourly intervals");

    console.log("\n==================================================================");
    console.log(`🏆 ALL ADVERSARIAL STRESS TESTS PASSED: ${passedAssertions} ASSERTIONS VERIFIED`);
    console.log("==================================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral stress database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral stress database dropped cleanly.");
  }
}

runAdversarialStressSuite().catch((err) => {
  console.error("❌ ADVERSARIAL STRESS SUITE CRASHED:", err);
  process.exit(1);
});

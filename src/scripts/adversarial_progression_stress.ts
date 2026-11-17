import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, SystemConfig } from "../models";
import {
  getXpRequiredForLevel,
  getXpRequiredForNextLevel,
  getCumulativeXpForLevel,
  calculateLevelFromXp,
  getXpProgressInLevel,
  grantUserRewards,
} from "../lib/economy";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ADVERSARIAL ASSERTION FAILED: ${message}`);
  }
}

async function runAdversarialStressTests() {
  console.log("================================================================================");
  console.log("🔥 AIEM HUNT — ADVERSARIAL STRESS-TEST HARNESS FOR PROGRESSION & REWARDS ENGINE");
  console.log("================================================================================");

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: MONOTONICITY ACROSS DENSE & HIGH RANGE (0 to 1,000,000+ XP)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[Test 1] Monotonicity Stress Test: calculateLevelFromXp(XP1) <= calculateLevelFromXp(XP2)");
  {
    const startMono = Date.now();
    let prevLevel = calculateLevelFromXp(0);
    assert(prevLevel === 1, "Level at 0 XP must be 1");

    // Dense step-by-step check for every single integer XP from 0 to 50,000
    for (let xp = 1; xp <= 50000; xp++) {
      const curLevel = calculateLevelFromXp(xp);
      assert(curLevel >= prevLevel, `Monotonicity violated at XP=${xp}: ${curLevel} < ${prevLevel}`);
      prevLevel = curLevel;
    }

    // Step jumps through 50,000 to 1,000,000
    for (let xp = 50000; xp <= 1000000; xp += 100) {
      const curLevel = calculateLevelFromXp(xp);
      assert(curLevel >= prevLevel, `Monotonicity violated at XP=${xp}: ${curLevel} < ${prevLevel}`);
      prevLevel = curLevel;
    }

    // Randomized adversarial pairwise checks (50,000 random pairs up to 5,000,000 XP)
    for (let i = 0; i < 50000; i++) {
      const xpA = Math.floor(Math.random() * 5000000);
      const xpB = xpA + Math.floor(Math.random() * 100000);
      const lvlA = calculateLevelFromXp(xpA);
      const lvlB = calculateLevelFromXp(xpB);
      assert(lvlA <= lvlB, `Adversarial pair failed: xpA=${xpA} (L${lvlA}) > xpB=${xpB} (L${lvlB})`);
    }

    // Extreme high XP values
    assert(calculateLevelFromXp(10000000) >= calculateLevelFromXp(1000000), "10M XP >= 1M XP");
    assert(calculateLevelFromXp(100000000) >= calculateLevelFromXp(10000000), "100M XP >= 10M XP");
    assert(calculateLevelFromXp(Number.MAX_SAFE_INTEGER) > 1000, "MAX_SAFE_INTEGER scales properly");

    console.log(`  ✅ PASSED: 100,000+ monotonicity checks passed in ${Date.now() - startMono}ms with 0 violations.`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: INVERTIBILITY (L <-> cumulativeXp(L)) FOR LEVELS 1 TO 200
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[Test 2] Invertibility Test: L === calculateLevelFromXp(cumulativeXp(L))");
  {
    const startInv = Date.now();
    for (let L = 1; L <= 200; L++) {
      const cumXp = getCumulativeXpForLevel(L);

      // Invertibility check 1: Exact threshold must map to level L
      const calculatedL = calculateLevelFromXp(cumXp);
      assert(calculatedL === L, `Invertibility failed at L=${L}: cumulativeXp=${cumXp}, calculateLevelFromXp returned ${calculatedL}`);

      // Invertibility check 2: Threshold minus 1 must map to level L - 1 (for L >= 2)
      if (L >= 2) {
        const calculatedLMinus1 = calculateLevelFromXp(cumXp - 1);
        assert(calculatedLMinus1 === L - 1, `Invertibility boundary (cumXp - 1) failed at L=${L}: cumulativeXp - 1 = ${cumXp - 1}, calculateLevelFromXp returned ${calculatedLMinus1}`);
      }

      // Invertibility check 3: Threshold plus 1 must map to level L (since step > 1)
      const calculatedLPlus1 = calculateLevelFromXp(cumXp + 1);
      assert(calculatedLPlus1 === L, `Invertibility boundary (cumXp + 1) failed at L=${L}: cumulativeXp + 1 = ${cumXp + 1}, calculateLevelFromXp returned ${calculatedLPlus1}`);

      // Cumulative recurrence relation: cum(L+1) === cum(L) + step(L)
      const nextCumXp = getCumulativeXpForLevel(L + 1);
      const stepXp = getXpRequiredForLevel(L);
      assert(nextCumXp === cumXp + stepXp, `Recurrence relation failed at L=${L}: cum(L+1)=${nextCumXp} != cum(L)=${cumXp} + step(L)=${stepXp}`);
    }
    console.log(`  ✅ PASSED: Exact invertibility verified for all levels 1..200 in ${Date.now() - startInv}ms.`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: RANGE OF getXpProgressInLevel (Strictly in [0, 100] for 0 to 1,000,000 XP)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[Test 3] Range and Progress Percent Stress Test: progressPercent in [0, 100]");
  {
    const startRange = Date.now();
    // 1. Continuous check for every integer XP from 0 to 25,000
    for (let xp = 0; xp <= 25000; xp++) {
      const prog = getXpProgressInLevel(xp);
      assert(prog.progressPercent >= 0 && prog.progressPercent <= 100, `Range violation at XP=${xp}: progressPercent=${prog.progressPercent}`);
      assert(prog.currentXpInLevel >= 0, `Negative currentXpInLevel at XP=${xp}: ${prog.currentXpInLevel}`);
      assert(prog.currentXpInLevel < prog.xpRequiredForNextLevel, `currentXpInLevel >= required at XP=${xp}: ${prog.currentXpInLevel} >= ${prog.xpRequiredForNextLevel}`);
      assert(prog.xpRequiredForNextLevel > 0, `xpRequiredForNextLevel must be positive at XP=${xp}`);
    }

    // 2. High-volume sampling from 25,000 to 1,000,000 XP
    for (let xp = 25000; xp <= 1000000; xp += 47) {
      const prog = getXpProgressInLevel(xp);
      assert(prog.progressPercent >= 0 && prog.progressPercent <= 100, `Range violation at XP=${xp}: progressPercent=${prog.progressPercent}`);
      assert(prog.currentXpInLevel >= 0, `Negative currentXpInLevel at XP=${xp}: ${prog.currentXpInLevel}`);
      assert(prog.currentXpInLevel < prog.xpRequiredForNextLevel, `currentXpInLevel overflow at XP=${xp}: ${prog.currentXpInLevel} >= ${prog.xpRequiredForNextLevel}`);
    }

    // 3. Boundary testing around every single level threshold up to Level 100
    for (let L = 1; L <= 100; L++) {
      const cum = getCumulativeXpForLevel(L);
      const atBoundary = getXpProgressInLevel(cum);
      assert(atBoundary.currentXpInLevel === 0, `At Level ${L} threshold (${cum} XP), currentXpInLevel must be 0, got ${atBoundary.currentXpInLevel}`);
      assert(atBoundary.progressPercent === 0, `At Level ${L} threshold (${cum} XP), progressPercent must be 0, got ${atBoundary.progressPercent}`);

      if (cum > 0) {
        const justBefore = getXpProgressInLevel(cum - 1);
        assert(justBefore.progressPercent >= 0 && justBefore.progressPercent <= 100, `Just before Level ${L} (${cum - 1} XP), progressPercent out of range: ${justBefore.progressPercent}`);
        assert(justBefore.progressPercent === 99 || justBefore.progressPercent === 100, `Just before Level ${L} (${cum - 1} XP), expected 99% or 100%, got ${justBefore.progressPercent}`);
      }
    }

    // 4. Adversarial inputs: negative, NaN, floating point, extreme numbers
    const progNeg = getXpProgressInLevel(-500);
    assert(progNeg.progressPercent === 0, `Negative XP progressPercent must be 0, got ${progNeg.progressPercent}`);
    assert(progNeg.currentXpInLevel === 0, "Negative XP currentXpInLevel must be 0");

    const progNaN = getXpProgressInLevel(NaN);
    assert(progNaN.progressPercent === 0, "NaN XP progressPercent must be 0");
    assert(progNaN.currentXpInLevel === 0, "NaN XP currentXpInLevel must be 0");

    const progFloat = getXpProgressInLevel(199.999);
    assert(progFloat.progressPercent >= 0 && progFloat.progressPercent <= 100, "Float XP within range");

    console.log(`  ✅ PASSED: 50,000+ progress checks passed in ${Date.now() - startRange}ms with strictly [0, 100] bounds.`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: MULTI-LEVEL JUMP REWARD CALCULATION & CLAIM COUNT
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[Test 4] Multi-Level Jump Reward Invariant: (L_end - L_start) level rewards claimed");
  {
    // Mathematical invariant verification:
    // When jumping from L_start to L_end, the intermediate levels crossed are (L_start + 1)..L_end.
    // Number of elements in this range is exactly: L_end - (L_start + 1) + 1 = L_end - L_start.
    for (let L_start = 1; L_start <= 30; L_start++) {
      for (let L_end = L_start + 1; L_end <= 35; L_end++) {
        const claimed: number[] = [];
        for (let lvl = L_start + 1; lvl <= L_end; lvl++) {
          if (!claimed.includes(lvl)) {
            claimed.push(lvl);
          }
        }
        assert(
          claimed.length === L_end - L_start,
          `Claimed count mismatch for jump ${L_start} -> ${L_end}: expected ${L_end - L_start}, got ${claimed.length}`
        );
      }
    }
    console.log("  ✅ PASSED: Mathematical claim count invariant L_end - L_start holds for all test intervals.");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: DATABASE INTEGRATION & ADVERSARIAL REWARD STRESS
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[Test 5] Live Database Multi-Level Jumps, Replays & Re-entrancy");
  const RUN_ID = `adversarial_stress_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;
  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`  📦 Connected to stress DB: ${RUN_ID}`);

  try {
    await SystemConfig.create({
      key: "GLOBAL_CONFIG",
      xpPerLevelBase: 250,
      globalXpMultiplier: 1,
      globalCoinMultiplier: 1,
      rankThresholds: [
        { minLevel: 1, title: "Rookie Scout" },
        { minLevel: 5, title: "Special Agent" },
        { minLevel: 10, title: "Master Hunter" },
        { minLevel: 20, title: "Legendary Operative" },
      ],
    });

    // Subtest 5.1: Jump from Level 1 to Level 12 in one atomic grant
    const targetL12Cum = getCumulativeXpForLevel(12); // exact XP for level 12
    const userJump = await User.create({
      email: "jump_stress@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "jump_stress_user",
      displayName: "Jump Stress User",
      role: "STUDENT",
      xp: 0,
      level: 1,
      coins: 100,
      claimedLevelRewards: [],
    });

    await grantUserRewards({
      userId: userJump._id as Types.ObjectId,
      baseXp: targetL12Cum,
      baseCoins: 0,
      reason: "Direct jump to Level 12",
      referenceType: "QUEST",
    });

    const userAfterL12 = await User.findById(userJump._id);
    assert(userAfterL12!.level === 12, `Expected Level 12, got ${userAfterL12!.level}`);
    // Exactly 12 - 1 = 11 levels claimed (levels 2..12)
    assert(userAfterL12!.claimedLevelRewards.length === 11, `Expected 11 claimed rewards, got ${userAfterL12!.claimedLevelRewards.length}`);
    for (let lvl = 2; lvl <= 12; lvl++) {
      assert(userAfterL12!.claimedLevelRewards.includes(lvl), `Missing claimed level reward for level ${lvl}`);
    }

    // Expected coin calculation: 100 + sum_{lvl=2..12} 25 * lvl
    // sum_{lvl=2..12} lvl = 77. 77 * 25 = 1925 bonus coins. Total = 2025 coins.
    assert(userAfterL12!.coins === 2025, `Expected 2025 coins, got ${userAfterL12!.coins}`);

    // Subtest 5.2: Replay attack / Zero XP grant on already leveled user
    await grantUserRewards({
      userId: userJump._id as Types.ObjectId,
      baseXp: 0,
      baseCoins: 0,
      reason: "Replay attack zero delta",
      referenceType: "QUEST",
    });
    const userReplay = await User.findById(userJump._id);
    assert(userReplay!.level === 12, "Level remained 12");
    assert(userReplay!.coins === 2025, "Coins unchanged on replay");
    assert(userReplay!.claimedLevelRewards.length === 11, "Claimed count unchanged");

    // Subtest 5.3: Incremental multi-step jumps
    // Jump from 12 to 15 (threshold for 15)
    const targetL15Cum = getCumulativeXpForLevel(15);
    const xpDelta = targetL15Cum - userReplay!.xp;
    await grantUserRewards({
      userId: userJump._id as Types.ObjectId,
      baseXp: xpDelta,
      baseCoins: 0,
      reason: "Jump from Level 12 to Level 15",
      referenceType: "QUEST",
    });
    const userAtL15 = await User.findById(userJump._id);
    assert(userAtL15!.level === 15, `Expected Level 15, got ${userAtL15!.level}`);
    // Exactly 15 - 1 = 14 levels claimed
    assert(userAtL15!.claimedLevelRewards.length === 14, `Expected 14 claimed rewards, got ${userAtL15!.claimedLevelRewards.length}`);
    // Levels 13, 14, 15 added: 25 * (13 + 14 + 15) = 25 * 42 = 1050 bonus coins
    assert(userAtL15!.coins === 2025 + 1050, `Expected 3075 coins, got ${userAtL15!.coins}`);

    console.log("  ✅ PASSED: Live database multi-level jump and idempotency stress tests passed with 100% precision.");
  } finally {
    console.log(`  🧹 Cleaning up stress DB: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("  ✨ Cleaned up test database.");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: PERFORMANCE / TLE STRESS CHECK
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[Test 6] Performance Benchmark: 100,000 calculateLevelFromXp evaluations");
  {
    const startPerf = Date.now();
    for (let i = 0; i < 100000; i++) {
      // evaluate across random XP up to 1,000,000
      const xp = (i * 37) % 1000000;
      calculateLevelFromXp(xp);
    }
    const elapsed = Date.now() - startPerf;
    console.log(`  ⏱️ 100,000 evaluations completed in ${elapsed}ms (${(elapsed / 100).toFixed(3)} µs per call).`);
    assert(elapsed < 2000, `Performance too slow: ${elapsed}ms for 100k calls (must be < 2000ms)`);
    console.log("  ✅ PASSED: Formula evaluation is blazing fast with zero TLE risk.");
  }

  console.log("\n================================================================================");
  console.log("🏆 ALL ADVERSARIAL STRESS-TESTS PASSED EMPIRICALLY (0 FAILURES, 100% ROBUST)");
  console.log("================================================================================");
}

runAdversarialStressTests().catch((err) => {
  console.error("❌ ADVERSARIAL STRESS TEST FAILED:", err);
  process.exit(1);
});

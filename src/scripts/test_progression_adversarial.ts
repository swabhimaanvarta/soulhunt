import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, Achievement, UserAchievement, Notification, SystemConfig, Transaction } from "../models";
import {
  getXpRequiredForLevel,
  getXpRequiredForNextLevel,
  getCumulativeXpForLevel,
  calculateLevelFromXp,
  getXpProgressInLevel,
  grantUserRewards,
  evaluateUserAchievements,
} from "../lib/economy";

const RUN_ID = `aiem_hunt_test_adv_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runAdversarialProgressionTests() {
  console.log("================================================================================");
  console.log("🔥 AIEM HUNT — EMPIRICAL ADVERSARIAL PROGRESSION & REWARDS HARNESS");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("================================================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`\n📦 Connected to ephemeral test database: ${RUN_ID}`);
  await User.syncIndexes();
  await Transaction.syncIndexes();

  try {
    await SystemConfig.create({
      key: "GLOBAL_CONFIG",
      xpPerLevelBase: 250,
      globalXpMultiplier: 1,
      globalCoinMultiplier: 1,
      rankThresholds: [
        { minLevel: 1, title: "Rookie Scout" },
        { minLevel: 3, title: "Campus Tracker" },
        { minLevel: 6, title: "Field Investigator" },
        { minLevel: 10, title: "Senior Detective" },
        { minLevel: 15, title: "Master Hunter" },
      ],
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 1: Repeated sequential reward calls with same XP & level
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 1: Repeated Sequential Reward Calls at Same XP & Level ───");
    {
      const user = await User.create({
        email: "adv_seq@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_seq_user",
        displayName: "Adversarial Sequential User",
        role: "STUDENT",
        department: "Computer Science",
        xp: 100, // Level 1 (threshold for L2 is 200)
        level: 1,
        coins: 100,
        claimedLevelRewards: [],
      });

      // 5 calls that gain XP and coins within Level 1 (100 -> 115 -> 130 -> 145 -> 160 -> 175)
      for (let i = 1; i <= 5; i++) {
        await grantUserRewards({
          userId: user._id as Types.ObjectId,
          baseXp: 15,
          baseCoins: 10,
          reason: `Sub-threshold quest ${i}`,
          referenceType: "QUEST",
          referenceId: new Types.ObjectId(),
        });
      }

      let u = await User.findById(user._id);
      assert(u!.xp === 175, `Expected 175 XP, got ${u!.xp}`);
      assert(u!.level === 1, `Expected Level 1, got ${u!.level}`);
      assert(u!.coins === 150, `Expected 150 coins (100 + 5*10), got ${u!.coins}`);
      assert(u!.claimedLevelRewards.length === 0, `Expected 0 claimed rewards, got ${u!.claimedLevelRewards.length}`);

      // Now grant +25 XP to reach exactly 200 XP (Level 2 threshold)
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 25,
        baseCoins: 0,
        reason: "Crossing Level 2 threshold",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      u = await User.findById(user._id);
      assert(u!.xp === 200, `Expected 200 XP, got ${u!.xp}`);
      assert(u!.level === 2, `Expected Level 2, got ${u!.level}`);
      // Initial 150 + Level 2 milestone (25 * 2 = 50 coins) = 200 coins
      assert(u!.coins === 200, `Expected 200 coins, got ${u!.coins}`);
      assert(u!.claimedLevelRewards.length === 1 && u!.claimedLevelRewards[0] === 2, "claimedLevelRewards must contain exactly [2]");

      // Now call grantUserRewards 10 times at Level 2 with sub-threshold XP and coins
      // (L3 threshold is 627 XP; 10 * 10 = 100 XP, so XP goes to 300, still well within Level 2)
      for (let i = 1; i <= 10; i++) {
        await grantUserRewards({
          userId: user._id as Types.ObjectId,
          baseXp: 10,
          baseCoins: 5,
          reason: `Level 2 sub-threshold quest ${i}`,
          referenceType: "QUEST",
          referenceId: new Types.ObjectId(),
        });

        const checkU = await User.findById(user._id);
        assert(checkU!.level === 2, `Level must remain 2, got ${checkU!.level}`);
        // claimedLevelRewards must NEVER get duplicate entries!
        assert(checkU!.claimedLevelRewards.length === 1, `claimedLevelRewards must have exactly 1 entry, got ${checkU!.claimedLevelRewards.length}`);
        assert(checkU!.claimedLevelRewards[0] === 2, "claimedLevelRewards entry must remain 2");
      }

      u = await User.findById(user._id);
      assert(u!.xp === 300, `Expected 300 XP, got ${u!.xp}`);
      assert(u!.level === 2, `Expected Level 2, got ${u!.level}`);
      // Coins: 200 + 10 * 5 = 250 coins. ZERO duplicate milestone coins!
      assert(u!.coins === 250, `Coins must be exactly 250, got ${u!.coins}`);

      console.log("  ✅ PASSED: 10 repeated calls at same level preserved claimedLevelRewards=[2] with ZERO duplicate entries or coins");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 2: Concurrency & Duplicate Prevention on grantUserRewards
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 2: Concurrency & Duplicate Prevention (Promise.all) ───");
    {
      const user = await User.create({
        email: "adv_concurrent@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_conc_user",
        displayName: "Adversarial Concurrent User",
        role: "STUDENT",
        department: "Electrical Engineering",
        xp: 150,
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
      });

      const sharedQuestId = new Types.ObjectId();
      // Simulate 10 simultaneous requests attempting to claim rewards for the exact same quest
      const concurrentAttempts = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentAttempts; i++) {
        promises.push(
          grantUserRewards({
            userId: user._id as Types.ObjectId,
            baseXp: 100, // Would push XP to 250 (Level 2)
            baseCoins: 40,
            reason: "Simultaneous duplicate claim attempt",
            referenceType: "QUEST",
            referenceId: sharedQuestId,
          }).catch((err) => {
            // MongoDB duplicate key error on Transaction unique index
            return { error: err.code || err.message };
          })
        );
      }

      const results = await Promise.all(promises);

      // Verify how many claims actually credited rewards
      const alreadyClaimedCount = results.filter((r) => r?.alreadyClaimed === true).length;
      const dupKeyErrors = results.filter((r) => r?.error === 11000 || (typeof r?.error === "string" && r.error.includes("duplicate"))).length;
      const successfulClaims = results.filter((r) => r && !r.alreadyClaimed && !r.error).length;

      console.log(`    Concurrent dispatch of 10 requests with same referenceId:`);
      console.log(`    - Successful initial claims: ${successfulClaims}`);
      console.log(`    - Caught as alreadyClaimed: ${alreadyClaimedCount}`);
      console.log(`    - Caught by DB unique constraint: ${dupKeyErrors}`);

      // Check whether duplicate entries occurred
      const u = await User.findById(user._id);
      const hasDuplicates = new Set(u!.claimedLevelRewards).size !== u!.claimedLevelRewards.length;
      console.log(`    Concurrency Result: hasDuplicates=${hasDuplicates}, claimedLevelRewards=${JSON.stringify(u?.claimedLevelRewards)}`);
      
      // Check transactions in DB for this quest
      const txs = await Transaction.find({ userId: user._id, referenceId: sharedQuestId });
      console.log(`    Transactions recorded in DB: ${txs.length}`);

      assert(!hasDuplicates, `claimedLevelRewards must have no duplicates: ${JSON.stringify(u?.claimedLevelRewards)}`);
      assert(u!.claimedLevelRewards.length === 1 && u!.claimedLevelRewards[0] === 2, "claimedLevelRewards must contain exactly [2]");
      assert(successfulClaims === 1, `Expected exactly 1 successful claim, got ${successfulClaims}`);
      assert(alreadyClaimedCount === concurrentAttempts - 1, `Expected ${concurrentAttempts - 1} caught as alreadyClaimed, got ${alreadyClaimedCount}`);
      assert(dupKeyErrors === 0, `Expected 0 unhandled duplicate key errors, got ${dupKeyErrors}`);
      assert(txs.length === 1, `Expected 1 transaction in DB, got ${txs.length}`);
      assert(u!.xp === 250, `Expected 250 XP, got ${u!.xp}`);
      assert(u!.coins === 140, `Expected 140 coins (50 + 40 + 50), got ${u!.coins}`);
      console.log("  ✅ PASSED: Concurrency handled cleanly (1 success, 9 alreadyClaimed, 0 duplicates)");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 2B: Concurrent distinct quest rewards (Lost Update race condition)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 2B: Concurrent Distinct Quests Race Condition ───");
    {
      const user = await User.create({
        email: "adv_distinct_conc@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_distinct_user",
        displayName: "Adversarial Distinct Concurrent User",
        role: "STUDENT",
        department: "Computer Science",
        xp: 150,
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
      });

      const questIdA = new Types.ObjectId();
      const questIdB = new Types.ObjectId();

      // Dispatch 2 distinct quests simultaneously
      await Promise.all([
        grantUserRewards({
          userId: user._id as Types.ObjectId,
          baseXp: 100,
          baseCoins: 20,
          reason: "Quest A completion",
          referenceType: "QUEST",
          referenceId: questIdA,
        }),
        grantUserRewards({
          userId: user._id as Types.ObjectId,
          baseXp: 100,
          baseCoins: 30,
          reason: "Quest B completion",
          referenceType: "QUEST",
          referenceId: questIdB,
        }),
      ]);

      const u = await User.findById(user._id);
      console.log(`    Distinct concurrent quests result:`);
      console.log(`    Expected without race: xp=350, coins=50+20+30+50(L2 milestone)=150, claimed=[2]`);
      console.log(`    Actual in DB: xp=${u?.xp}, coins=${u?.coins}, level=${u?.level}, claimedLevelRewards=${JSON.stringify(u?.claimedLevelRewards)}`);

      assert(u!.xp === 350, `Expected 350 XP without lost updates, got ${u!.xp}`);
      assert(u!.coins === 150, `Expected 150 coins without lost updates, got ${u!.coins}`);
      assert(new Set(u!.claimedLevelRewards).size === u!.claimedLevelRewards.length, `Duplicate entries in claimedLevelRewards: ${JSON.stringify(u?.claimedLevelRewards)}`);
      assert(u!.claimedLevelRewards.length === 1 && u!.claimedLevelRewards[0] === 2, "claimedLevelRewards must be [2]");
      console.log("  ✅ PASSED: Concurrent distinct quests completed without lost updates or duplicate entries");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 3: Multi-Level Jump & Skip Idempotency
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 3: Multi-Level Threshold Jumps & Intermediate Milestone Tracking ───");
    {
      const user = await User.create({
        email: "adv_multijump@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_multijump_user",
        displayName: "Adversarial Multi Jump User",
        role: "STUDENT",
        department: "Information Technology",
        xp: 0,
        level: 1,
        coins: 100,
        claimedLevelRewards: [],
      });

      // Jump 1: Level 1 to Level 10 (cumXP for L10 is 10,960 XP)
      // Intermediate crossed levels: 2, 3, 4, 5, 6, 7, 8, 9, 10
      // Sum of milestone coins: 25 * (2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10) = 25 * 54 = 1,350 bonus coins
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 11000,
        baseCoins: 0,
        reason: "Massive campus tournament victory",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      let u = await User.findById(user._id);
      assert(u!.level === 10, `Expected Level 10, got ${u!.level}`);
      assert(u!.claimedLevelRewards.length === 9, `Expected 9 claimed levels (2-10), got ${u!.claimedLevelRewards.length}`);
      // Check set of claimed levels is exactly 2..10
      for (let l = 2; l <= 10; l++) {
        assert(u!.claimedLevelRewards.includes(l), `claimedLevelRewards must contain Level ${l}`);
      }
      // Check for strictly NO duplicates in claimedLevelRewards
      const uniqueClaimed = new Set(u!.claimedLevelRewards);
      assert(uniqueClaimed.size === u!.claimedLevelRewards.length, "claimedLevelRewards must have no duplicates");
      // Initial 100 + 1350 milestone coins = 1450 coins
      assert(u!.coins === 1450, `Expected 1450 coins, got ${u!.coins}`);

      // Now fire 3 repeat calls at Level 10 with +50 XP (cumXP for L11 is 14,037, so 11,150 is still L10)
      for (let i = 1; i <= 3; i++) {
        await grantUserRewards({
          userId: user._id as Types.ObjectId,
          baseXp: 50,
          baseCoins: 20,
          reason: `Repeat call at level 10 (#${i})`,
          referenceType: "QUEST",
          referenceId: new Types.ObjectId(),
        });
      }

      u = await User.findById(user._id);
      assert(u!.level === 10, `Expected Level 10, got ${u!.level}`);
      assert(u!.claimedLevelRewards.length === 9, `claimedLevelRewards must still have exactly 9 entries, got ${u!.claimedLevelRewards.length}`);
      assert(u!.coins === 1450 + 3 * 20, `Coins must only increase by 60 base coins, got ${u!.coins}`);

      // Jump 2: From Level 10 to Level 13 (cumXP for L13 is 21,988; current XP = 11,150; add 11,000 XP -> 22,150 XP)
      // Crossed levels: 11, 12, 13
      // Milestone coins: 25 * (11 + 12 + 13) = 25 * 36 = 900 bonus coins
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 11000,
        baseCoins: 0,
        reason: "Second big jump",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      u = await User.findById(user._id);
      assert(u!.level === 13, `Expected Level 13, got ${u!.level}`);
      assert(u!.claimedLevelRewards.length === 12, `Expected 12 claimed levels (2-13), got ${u!.claimedLevelRewards.length}`);
      for (let l = 2; l <= 13; l++) {
        assert(u!.claimedLevelRewards.includes(l), `claimedLevelRewards must contain Level ${l}`);
      }
      assert(new Set(u!.claimedLevelRewards).size === u!.claimedLevelRewards.length, "claimedLevelRewards must have no duplicates");
      assert(u!.coins === 1510 + 900, `Expected 2410 coins, got ${u!.coins}`);

      console.log("  ✅ PASSED: Multi-level jumps from 1->10 and 10->13 correctly tracked intermediate levels with zero duplicates");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 4: Achievement Level-Up Triggers & Milestone Integration
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 4: Achievement Level-Up Triggers & Milestone Integration ───");
    {
      // Sub-test A: Single achievement threshold crossing
      const userA = await User.create({
        email: "adv_ach_single@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_ach_single",
        displayName: "Achievement Single",
        role: "STUDENT",
        department: "Computer Engineering",
        xp: 195, // 5 XP away from Level 2 (200 threshold)
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
        stats: {
          questsCompleted: 0,
          safeDeskDepositsCount: 0,
          investigationQuestsCompleted: 0,
          mysteryQuestsNoHints: 0,
          legendaryQuestsCompleted: 0,
          cluesSolved: 0,
          squadQuestsCompleted: 0,
          treasuresFound: 0,
          visitedBlocks: [],
        },
      });

      const achA = await Achievement.create({
        code: `ACH_ADV_A_${Date.now()}`,
        title: "First Clue",
        description: "Solve first quest",
        category: "EXPLORATION",
        tier: "BRONZE",
        metricKey: "QUESTS_COMPLETED",
        threshold: 1,
        xpReward: 30, // 195 + 30 = 225 XP -> Level 2
        coinReward: 20,
        isActive: true,
      });

      await User.findByIdAndUpdate(userA._id, { $inc: { "stats.questsCompleted": 1 } });
      await evaluateUserAchievements(userA._id as Types.ObjectId);

      let uA = await User.findById(userA._id);
      assert(uA!.xp === 225, `Expected 225 XP, got ${uA!.xp}`);
      assert(uA!.level === 2, `Expected Level 2, got ${uA!.level}`);
      assert(uA!.claimedLevelRewards.includes(2), "claimedLevelRewards must contain Level 2");
      // Initial 50 + 20 (ach coins) + 50 (Level 2 milestone: 25*2) = 120 coins
      assert(uA!.coins === 120, `Expected 120 coins, got ${uA!.coins}`);

      // Sub-test B: Calling evaluateUserAchievements repeatedly does NOT re-award
      await evaluateUserAchievements(userA._id as Types.ObjectId);
      uA = await User.findById(userA._id);
      assert(uA!.xp === 225, `XP must not change on re-evaluation, got ${uA!.xp}`);
      assert(uA!.coins === 120, `Coins must not change on re-evaluation, got ${uA!.coins}`);
      assert(uA!.claimedLevelRewards.length === 1, `claimedLevelRewards length must remain 1, got ${uA!.claimedLevelRewards.length}`);

      // Sub-test C: Multi-level jump purely through achievements
      const userB = await User.create({
        email: "adv_ach_multi@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_ach_multi",
        displayName: "Achievement Multi",
        role: "STUDENT",
        department: "Computer Engineering",
        xp: 0,
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
        stats: {
          questsCompleted: 0,
          safeDeskDepositsCount: 0,
          investigationQuestsCompleted: 0,
          mysteryQuestsNoHints: 0,
          legendaryQuestsCompleted: 0,
          cluesSolved: 0,
          squadQuestsCompleted: 0,
          treasuresFound: 0,
          visitedBlocks: [],
        },
      });

      // An achievement that awards 4,000 XP (reaches Level 6: cumXP=3417, L7 is 4871)
      const achB = await Achievement.create({
        code: `ACH_ADV_B_${Date.now()}`,
        title: "Master Sleuth",
        description: "Solve 10 mysteries",
        category: "EXPLORATION",
        tier: "GOLD",
        metricKey: "MYSTERY_NO_HINTS",
        threshold: 10,
        xpReward: 4000,
        coinReward: 150,
        isActive: true,
      });

      await User.findByIdAndUpdate(userB._id, { $inc: { "stats.mysteryQuestsNoHints": 10 } });
      await evaluateUserAchievements(userB._id as Types.ObjectId);

      const uB = await User.findById(userB._id);
      assert(uB!.xp === 4000, `Expected 4000 XP, got ${uB!.xp}`);
      assert(uB!.level === 6, `Expected Level 6 from achievement, got ${uB!.level}`);
      // Crossed levels: 2, 3, 4, 5, 6
      assert(uB!.claimedLevelRewards.length === 5, `Expected 5 claimed levels, got ${uB!.claimedLevelRewards.length}`);
      for (const lvl of [2, 3, 4, 5, 6]) {
        assert(uB!.claimedLevelRewards.includes(lvl), `claimedLevelRewards must contain Level ${lvl}`);
      }
      assert(new Set(uB!.claimedLevelRewards).size === uB!.claimedLevelRewards.length, "No duplicates in claimedLevelRewards");
      // Coins: 50 initial + 150 ach + 25 * (2+3+4+5+6 = 20) [500 milestone] = 700 coins
      assert(uB!.coins === 700, `Expected 700 coins, got ${uB!.coins}`);

      // Sub-test D: Mixed Progression: Direct Quests followed by Achievement Crossing
      // User reaches Level 3 via quest (claimed levels 2, 3)
      const userC = await User.create({
        email: "adv_mixed@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_mixed_user",
        displayName: "Mixed Progression User",
        role: "STUDENT",
        department: "Computer Engineering",
        xp: 0,
        level: 1,
        coins: 100,
        claimedLevelRewards: [],
        stats: {
          questsCompleted: 0,
          safeDeskDepositsCount: 0,
          investigationQuestsCompleted: 0,
          mysteryQuestsNoHints: 0,
          legendaryQuestsCompleted: 0,
          cluesSolved: 0,
          squadQuestsCompleted: 0,
          treasuresFound: 0,
          visitedBlocks: [],
        },
      });

      // Advance to Level 3 via quest (cumXP for L3 is 627)
      await grantUserRewards({
        userId: userC._id as Types.ObjectId,
        baseXp: 700, // Level 3
        baseCoins: 0,
        reason: "Initial quest to Level 3",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      let uC = await User.findById(userC._id);
      assert(uC!.level === 3, `Expected Level 3, got ${uC!.level}`);
      assert(uC!.claimedLevelRewards.length === 2, "claimedLevelRewards should have [2, 3]");
      // Coins: 100 + 25*(2+3) = 100 + 125 = 225
      assert(uC!.coins === 225, `Expected 225 coins, got ${uC!.coins}`);

      // Now achieve something that awards 1,600 XP (700 + 1600 = 2300 XP -> Level 5: cumXP=2221)
      const achC = await Achievement.create({
        code: `ACH_ADV_C_${Date.now()}`,
        title: "Campus Explorer Legend",
        description: "Find 5 treasures",
        category: "EXPLORATION",
        tier: "SILVER",
        metricKey: "TREASURES_FOUND",
        threshold: 5,
        xpReward: 1600,
        coinReward: 50,
        isActive: true,
      });

      await User.findByIdAndUpdate(userC._id, { $inc: { "stats.treasuresFound": 5 } });
      await evaluateUserAchievements(userC._id as Types.ObjectId);

      uC = await User.findById(userC._id);
      assert(uC!.level === 5, `Expected Level 5, got ${uC!.level}`);
      // Should now contain [2, 3, 4, 5]
      assert(uC!.claimedLevelRewards.length === 4, `Expected 4 claimed levels, got ${uC!.claimedLevelRewards.length}`);
      for (const lvl of [2, 3, 4, 5]) {
        assert(uC!.claimedLevelRewards.includes(lvl), `claimedLevelRewards must contain Level ${lvl}`);
      }
      assert(new Set(uC!.claimedLevelRewards).size === 4, "No duplicate claimed levels");
      // Milestone coins should ONLY be for levels 4 and 5: 25*(4+5) = 225 bonus coins
      // Total coins = 225 previous + 50 (ach coins) + 225 (milestone 4+5) = 500 coins!
      assert(uC!.coins === 500, `Expected 500 coins, got ${uC!.coins}`);

      console.log("  ✅ PASSED: evaluateUserAchievements properly handles single crossings, multi-level jumps, and mixed quest/achievement progression without duplicate milestone payouts");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 5: Pre-Existing Gaps & Resilience in claimedLevelRewards
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 5: Pre-Existing Gaps & Partial Claim Resilience ───");
    {
      const user = await User.create({
        email: "adv_gaps@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_gaps_user",
        displayName: "Adversarial Gaps User",
        role: "STUDENT",
        department: "Civil Engineering",
        xp: 0,
        level: 1,
        coins: 100,
        claimedLevelRewards: [2, 4], // Simulating corrupted or partial prior claims
      });

      // Jump from Level 1 to Level 5 (cumXP=2221)
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 2300,
        baseCoins: 0,
        reason: "Gaps jump test",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      const u = await User.findById(user._id);
      assert(u!.level === 5, `Expected Level 5, got ${u!.level}`);
      // Level 2 and Level 4 were already claimed, so only Level 3 and Level 5 should be awarded!
      // Milestone coins: 25 * 3 + 25 * 5 = 75 + 125 = 200 coins.
      // Total coins: 100 initial + 200 milestone = 300 coins.
      assert(u!.coins === 300, `Expected 300 coins (only L3 and L5 awarded), got ${u!.coins}`);
      assert(u!.claimedLevelRewards.length === 4, `Expected 4 claimed levels, got ${u!.claimedLevelRewards.length}`);
      for (const lvl of [2, 3, 4, 5]) {
        assert(u!.claimedLevelRewards.includes(lvl), `claimedLevelRewards must contain Level ${lvl}`);
      }
      assert(new Set(u!.claimedLevelRewards).size === 4, "No duplicate entries despite pre-existing gaps");

      console.log("  ✅ PASSED: Pre-existing claimedLevelRewards entries respected; only unawarded levels were credited");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST SUITE 6: Exact Boundary Stress Testing
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Test Suite 6: Exact XP Threshold Boundary Stress Testing ───");
    {
      // Level 3 cumulative XP is 627. (L1->L2: 200, L2->L3: 427, total 627)
      const user = await User.create({
        email: "adv_boundary@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "adv_boundary_user",
        displayName: "Adversarial Boundary User",
        role: "STUDENT",
        department: "Computer Science",
        xp: 0,
        level: 1,
        coins: 0,
        claimedLevelRewards: [],
      });

      // Grant exactly 626 XP (1 XP below Level 3)
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 626,
        baseCoins: 0,
        reason: "1 XP below L3",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      let u = await User.findById(user._id);
      assert(u!.level === 2, `626 XP must remain Level 2, got ${u!.level}`);
      assert(u!.claimedLevelRewards.includes(2), "Must have claimed Level 2");
      assert(!u!.claimedLevelRewards.includes(3), "Must NOT have claimed Level 3");
      assert(u!.coins === 50, `Coins must be 50 (only L2 milestone), got ${u!.coins}`);

      // Grant exactly 1 XP to reach 627 XP (exact Level 3 threshold)
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 1,
        baseCoins: 0,
        reason: "Exact L3 threshold",
        referenceType: "QUEST",
        referenceId: new Types.ObjectId(),
      });

      u = await User.findById(user._id);
      assert(u!.level === 3, `627 XP must be Level 3, got ${u!.level}`);
      assert(u!.claimedLevelRewards.includes(3), "Must have claimed Level 3");
      // Total coins: 50 (L2) + 75 (L3: 25*3) = 125 coins
      assert(u!.coins === 125, `Coins must be 125, got ${u!.coins}`);

      // Grant 0 XP call (verify no side effects)
      await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 0,
        baseCoins: 0,
        reason: "Zero reward call",
        referenceType: "ADMIN_ADJUST",
        referenceId: new Types.ObjectId(),
      });

      u = await User.findById(user._id);
      assert(u!.level === 3, "Level remains 3");
      assert(u!.claimedLevelRewards.length === 2, "claimedLevelRewards remains [2, 3]");
      assert(u!.coins === 125, "Coins remain 125");

      console.log("  ✅ PASSED: Exact threshold boundaries (626 XP -> L2, 627 XP -> L3) and zero XP calls behave identically to mathematical specification");
    }

    console.log("\n================================================================================");
    console.log("🎉 ALL ADVERSARIAL PROGRESSION & REWARDS HARNESS TESTS PASSED (100%)");
    console.log("================================================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
  }
}

runAdversarialProgressionTests().catch((err) => {
  console.error("❌ ADVERSARIAL TEST FAILED:", err);
  process.exit(1);
});

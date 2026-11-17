import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, Achievement, UserAchievement, Notification, SystemConfig } from "../models";
import {
  getXpRequiredForLevel,
  getXpRequiredForNextLevel,
  getCumulativeXpForLevel,
  calculateLevelFromXp,
  getXpProgressInLevel,
  grantUserRewards,
  evaluateUserAchievements,
} from "../lib/economy";

const RUN_ID = `aiem_hunt_test_prog_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runProgressionEngineTests() {
  console.log("========================================================");
  console.log("⚡ AIEM HUNT — PROGRESSION & REWARDS ENGINE TEST SUITE");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  // ─── Suite 1: Non-Linear Progression Curve Math & Monotonicity ───
  console.log("\n─── Suite 1: Non-Linear Progression Curve Math & Monotonicity ───");
  {
    // Exact expected values: floor(150 * L + 50 * L^1.35)
    // Level 1: floor(150*1 + 50*1^1.35) = 200
    // Level 2: floor(150*2 + 50*2^1.35) = 427
    // Level 5: floor(150*5 + 50*5^1.35) = 1189
    // Level 10: floor(150*10 + 50*10^1.35) = 2619
    // Level 20: floor(150*20 + 50*20^1.35) = 5853

    const stepL1 = getXpRequiredForLevel(1);
    assert(stepL1 === 200, `Level 1 step XP must be 200, got ${stepL1}`);
    assert(getXpRequiredForNextLevel(1) === 200, "getXpRequiredForNextLevel(1) matches getXpRequiredForLevel(1)");

    const stepL2 = getXpRequiredForLevel(2);
    assert(stepL2 === 427, `Level 2 step XP must be 427, got ${stepL2}`);

    const stepL5 = getXpRequiredForLevel(5);
    assert(stepL5 === 1189, `Level 5 step XP must be 1189, got ${stepL5}`);

    const stepL10 = getXpRequiredForLevel(10);
    assert(stepL10 === 2619, `Level 10 step XP must be 2619, got ${stepL10}`);

    const stepL20 = getXpRequiredForLevel(20);
    assert(stepL20 === 5853, `Level 20 step XP must be 5853, got ${stepL20}`);

    // Verify monotonic increase from level 1 up to level 50
    for (let l = 1; l < 50; l++) {
      const curr = getXpRequiredForLevel(l);
      const next = getXpRequiredForLevel(l + 1);
      assert(next > curr, `Monotonic scaling broken at Level ${l}: ${curr} >= ${next}`);
    }

    // Verify cumulative XP
    assert(getCumulativeXpForLevel(1) === 0, "Level 1 cumulative XP must be 0");
    assert(getCumulativeXpForLevel(2) === 200, "Level 2 cumulative XP must be 200");
    assert(getCumulativeXpForLevel(3) === 200 + 427, "Level 3 cumulative XP must be 627");
    assert(getCumulativeXpForLevel(5) === 2221, "Level 5 cumulative XP must be 2221");
    assert(getCumulativeXpForLevel(10) === 10960, "Level 10 cumulative XP must be 10960");
    assert(getCumulativeXpForLevel(20) === 51364, "Level 20 cumulative XP must be 51364");

    console.log("  ✅ PASSED: Non-linear curve exact values verified for levels 1, 2, 5, 10, 20 and strictly monotonic up to level 50");
  }

  // ─── Suite 2: calculateLevelFromXp Threshold Boundaries ───
  console.log("\n─── Suite 2: calculateLevelFromXp Threshold Boundaries ───");
  {
    assert(calculateLevelFromXp(0) === 1, "0 XP must be Level 1");
    assert(calculateLevelFromXp(-50) === 1, "Negative XP must be Level 1");
    assert(calculateLevelFromXp(NaN) === 1, "NaN XP must be Level 1");

    // Level 2 boundary (200 XP required)
    assert(calculateLevelFromXp(199) === 1, "199 XP (1 XP before L2) must be Level 1");
    assert(calculateLevelFromXp(200) === 2, "200 XP (exact L2 threshold) must be Level 2");
    assert(calculateLevelFromXp(201) === 2, "201 XP (1 XP after L2) must be Level 2");

    // Level 3 boundary (200 + 427 = 627 XP required)
    assert(calculateLevelFromXp(626) === 2, "626 XP (1 XP before L3) must be Level 2");
    assert(calculateLevelFromXp(627) === 3, "627 XP (exact L3 threshold) must be Level 3");
    assert(calculateLevelFromXp(628) === 3, "628 XP (1 XP after L3) must be Level 3");

    // Level 5 boundary (2221 XP required)
    assert(calculateLevelFromXp(2220) === 4, "2220 XP (1 XP before L5) must be Level 4");
    assert(calculateLevelFromXp(2221) === 5, "2221 XP (exact L5 threshold) must be Level 5");

    // Level 10 boundary (10960 XP required)
    assert(calculateLevelFromXp(10959) === 9, "10959 XP (1 XP before L10) must be Level 9");
    assert(calculateLevelFromXp(10960) === 10, "10960 XP (exact L10 threshold) must be Level 10");

    console.log("  ✅ PASSED: Threshold boundary tests (1 XP before, exactly at, 1 XP after) pass flawlessly");
  }

  // ─── Suite 3: getXpProgressInLevel Math & Percentages ───
  console.log("\n─── Suite 3: getXpProgressInLevel Math & Percentages ───");
  {
    // At 0 XP
    const p0 = getXpProgressInLevel(0);
    assert(p0.currentXpInLevel === 0, `Expected currentXpInLevel 0, got ${p0.currentXpInLevel}`);
    assert(p0.xpRequiredForNextLevel === 200, `Expected xpRequiredForNextLevel 200, got ${p0.xpRequiredForNextLevel}`);
    assert(p0.progressPercent === 0, `Expected progressPercent 0, got ${p0.progressPercent}`);

    // At 100 XP (midway through Level 1)
    const p100 = getXpProgressInLevel(100);
    assert(p100.currentXpInLevel === 100, `Expected currentXpInLevel 100, got ${p100.currentXpInLevel}`);
    assert(p100.xpRequiredForNextLevel === 200, `Expected xpRequiredForNextLevel 200, got ${p100.xpRequiredForNextLevel}`);
    assert(p100.progressPercent === 50, `Expected progressPercent 50, got ${p100.progressPercent}`);

    // At 199 XP (99.5% through Level 1)
    const p199 = getXpProgressInLevel(199);
    assert(p199.currentXpInLevel === 199, `Expected currentXpInLevel 199, got ${p199.currentXpInLevel}`);
    assert(p199.progressPercent === 99, `Expected progressPercent 99, got ${p199.progressPercent}`);

    // At 200 XP (Start of Level 2)
    const p200 = getXpProgressInLevel(200);
    assert(p200.currentXpInLevel === 0, `Expected currentXpInLevel 0 at L2 start, got ${p200.currentXpInLevel}`);
    assert(p200.xpRequiredForNextLevel === 427, `Expected xpRequiredForNextLevel 427, got ${p200.xpRequiredForNextLevel}`);
    assert(p200.progressPercent === 0, `Expected progressPercent 0, got ${p200.progressPercent}`);

    // At 5000 XP (Level 7: cumXP=4871, stepXP=1741, progress = 129 / 1741 = 7%)
    const p5000 = getXpProgressInLevel(5000);
    assert(p5000.currentXpInLevel === 129, `Expected currentXpInLevel 129 at 5000 XP, got ${p5000.currentXpInLevel}`);
    assert(p5000.xpRequiredForNextLevel === 1741, `Expected xpRequiredForNextLevel 1741, got ${p5000.xpRequiredForNextLevel}`);
    assert(p5000.progressPercent === 7, `Expected progressPercent 7, got ${p5000.progressPercent}`);

    console.log("  ✅ PASSED: getXpProgressInLevel accurately computes currentXpInLevel, xpRequiredForNextLevel, and progressPercent");
  }

  // Connect to database for integration suites
  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`\n📦 Connected to ephemeral test database: ${RUN_ID}`);

  try {
    // Ensure SystemConfig exists with rank thresholds
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

    // ─── Suite 4: Multi-Level Jump & Milestone Rewards Tracking ───
    console.log("\n─── Suite 4: Multi-Level Jump & Milestone Rewards Tracking ───");
    {
      const userA = await User.create({
        email: "operative_jump@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "jumper_one",
        displayName: "Jumper One",
        role: "STUDENT",
        department: "Computer Science & Engineering",
        xp: 0,
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
      });

      // Award 5,000 XP in a single atomic operation
      // Level 7 is reached (cumXP=4871, L8 is 6612).
      // Intermediate levels crossed: 2, 3, 4, 5, 6, 7.
      // Milestone coins: 25*2 + 25*3 + 25*4 + 25*5 + 25*6 + 25*7
      // = 50 + 75 + 100 + 125 + 150 + 175 = 675 coins.
      // Expected total coins = 50 + 675 = 725.
      const questId1 = new Types.ObjectId();
      const res = await grantUserRewards({
        userId: userA._id as Types.ObjectId,
        baseXp: 5000,
        baseCoins: 0,
        reason: "Epic Campus Raid Multi-Level Jump",
        referenceType: "QUEST",
        referenceId: questId1,
      });

      assert(res !== null, "grantUserRewards result must not be null");
      const updatedUserA = await User.findById(userA._id);
      assert(updatedUserA !== null, "User must exist in DB");
      assert(updatedUserA!.xp === 5000, `Expected 5000 XP, got ${updatedUserA!.xp}`);
      assert(updatedUserA!.level === 7, `Expected Level 7, got ${updatedUserA!.level}`);
      assert(updatedUserA!.rankTitle === "Field Investigator", `Expected rank 'Field Investigator', got ${updatedUserA!.rankTitle}`);
      assert(updatedUserA!.coins === 725, `Expected 725 coins (50 initial + 675 milestones), got ${updatedUserA!.coins}`);

      // Verify claimedLevelRewards array contains exactly [2, 3, 4, 5, 6, 7]
      const claimed = updatedUserA!.claimedLevelRewards;
      assert(claimed.length === 6, `Expected 6 claimed levels, got ${claimed.length}`);
      for (const expectedLvl of [2, 3, 4, 5, 6, 7]) {
        assert(claimed.includes(expectedLvl), `claimedLevelRewards must include Level ${expectedLvl}`);
      }

      // Verify level-up notifications were created
      const notifs = await Notification.find({ userId: userA._id, category: "SYSTEM_REWARD" });
      assert(notifs.length === 6, `Expected 6 milestone notifications, got ${notifs.length}`);

      console.log("  ✅ PASSED: 0 to 5,000 XP multi-level jump correctly advanced user to Level 7, awarded all 6 milestone rewards (675 coins), and recorded claimedLevelRewards");
    }

    // ─── Suite 5: Idempotency & Repeat Granting ───
    console.log("\n─── Suite 5: Idempotency & Repeat Granting ───");
    {
      const user = await User.findOne({ username: "jumper_one" });
      assert(user !== null, "User jumper_one must exist");
      const previousCoins = user!.coins;

      // Grant rewards with +10 XP without advancing level (5000 + 10 = 5010 XP, still Level 7)
      const questId2 = new Types.ObjectId();
      await grantUserRewards({
        userId: user!._id as Types.ObjectId,
        baseXp: 10,
        baseCoins: 20,
        reason: "Minor Clue Solved",
        referenceType: "QUEST",
        referenceId: questId2,
      });

      const userAfterMinor = await User.findById(user!._id);
      assert(userAfterMinor!.level === 7, "Level must remain 7");
      assert(userAfterMinor!.claimedLevelRewards.length === 6, "claimedLevelRewards length must remain 6");
      // Only the 20 base coins should have been added, ZERO duplicate milestone coins
      assert(userAfterMinor!.coins === previousCoins + 20, `Coins must increase by exactly 20 base coins, got ${userAfterMinor!.coins}`);

      // Now grant sufficient XP to reach Level 8 (Level 8 threshold is 6612 XP. Current XP = 5010. Need +1602 XP)
      const questId3 = new Types.ObjectId();
      await grantUserRewards({
        userId: user!._id as Types.ObjectId,
        baseXp: 1602,
        baseCoins: 0,
        reason: "Advancing to Level 8",
        referenceType: "QUEST",
        referenceId: questId3,
      });

      const userAtLevel8 = await User.findById(user!._id);
      assert(userAtLevel8!.level === 8, `Expected Level 8, got ${userAtLevel8!.level}`);
      // Only Level 8 milestone coins added: 25 * 8 = 200 coins
      assert(userAtLevel8!.claimedLevelRewards.length === 7, "claimedLevelRewards length must be 7");
      assert(userAtLevel8!.claimedLevelRewards.includes(8), "claimedLevelRewards must now include Level 8");
      assert(userAtLevel8!.coins === userAfterMinor!.coins + 200, `Coins must increase by exactly 200 (Level 8 milestone), got ${userAtLevel8!.coins}`);

      console.log("  ✅ PASSED: Idempotency strictly maintained: no duplicate milestone coins awarded on sub-threshold gains; subsequent level properly awards only the new level milestone");
    }

    // ─── Suite 6: Achievement Unlocks Triggering Non-Linear Level Up ───
    console.log("\n─── Suite 6: Achievement Unlocks Triggering Non-Linear Level Up ───");
    {
      const userAch = await User.create({
        email: "operative_ach@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "ach_hunter",
        displayName: "Achievement Hunter",
        role: "STUDENT",
        department: "Mechanical Engineering",
        xp: 190, // 10 XP away from Level 2 (200 XP threshold)
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

      // Create an achievement that awards 50 XP (which pushes user to 240 XP -> Level 2)
      const ach = await Achievement.create({
        code: `ACH_TEST_QUEST_${Date.now()}`,
        title: "Master of Discovery",
        description: "Complete your first campus quest",
        category: "EXPLORATION",
        tier: "BRONZE",
        metricKey: "QUESTS_COMPLETED",
        threshold: 1,
        xpReward: 50,
        coinReward: 30,
        isActive: true,
      });

      // User completes 1 quest
      await User.findByIdAndUpdate(userAch._id, {
        $inc: { "stats.questsCompleted": 1 },
      });

      // Evaluate achievements
      await evaluateUserAchievements(userAch._id as Types.ObjectId);

      const updatedUserAch = await User.findById(userAch._id);
      assert(updatedUserAch !== null, "User must exist");
      assert(updatedUserAch!.xp === 240, `Expected 240 XP, got ${updatedUserAch!.xp}`);
      assert(updatedUserAch!.level === 2, `Expected Level 2 from achievement unlock, got ${updatedUserAch!.level}`);
      assert(updatedUserAch!.claimedLevelRewards.includes(2), "Level 2 milestone must be recorded in claimedLevelRewards");
      // Initial 100 + 30 (ach coins) + 50 (Level 2 milestone: 25 * 2) = 180 coins
      assert(updatedUserAch!.coins === 180, `Expected 180 coins, got ${updatedUserAch!.coins}`);

      console.log("  ✅ PASSED: Achievement unlocks recalculate user.level using non-linear formula and award level-up milestone rewards");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL PROGRESSION & REWARDS ENGINE TESTS PASSED (100%)");
    console.log("========================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
  }
}

runProgressionEngineTests().catch((err) => {
  console.error("❌ PROGRESSION ENGINE TEST FAILED:", err);
  process.exit(1);
});

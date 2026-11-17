import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, Achievement, UserAchievement, Notification, SystemConfig, Transaction } from "../models";
import {
  getXpRequiredForLevel,
  calculateLevelFromXp,
  grantUserRewards,
  evaluateUserAchievements,
} from "../lib/economy";

const RUN_ID = `aiem_hunt_test_recheck_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runEmpiricalRecheckSuite() {
  console.log("================================================================================");
  console.log("🔍 EMPIRICAL CHALLENGER RE-CHECK: PROGRESSION CONCURRENCY & WRITE ORDERING");
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
    // STRESS SUITE 1: 50 Simultaneous Duplicate Requests (Code 11000 Collision Stress)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Stress Suite 1: 50 Simultaneous Duplicate Requests Collision ───");
    {
      const user = await User.create({
        email: "recheck_dup50@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "recheck_dup50",
        displayName: "Recheck Dup 50 User",
        role: "STUDENT",
        department: "Computer Science",
        xp: 150,
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
      });

      const sharedQuestId = new Types.ObjectId();
      const concurrency = 50;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrency; i++) {
        promises.push(
          grantUserRewards({
            userId: user._id as Types.ObjectId,
            baseXp: 100, // pushes to 250 (Level 2 threshold is 200)
            baseCoins: 40,
            reason: "Simultaneous 50x duplicate claim attempt",
            referenceType: "QUEST",
            referenceId: sharedQuestId,
          }).catch((err) => {
            return { error: err.code || err.message };
          })
        );
      }

      const results = await Promise.all(promises);

      const alreadyClaimedCount = results.filter((r) => r?.alreadyClaimed === true).length;
      const dupKeyErrors = results.filter((r) => r?.error === 11000 || (typeof r?.error === "string" && r.error.includes("duplicate"))).length;
      const successfulClaims = results.filter((r) => r && !r.alreadyClaimed && !r.error).length;

      console.log(`    Dispatched ${concurrency} simultaneous duplicate requests:`);
      console.log(`    - Successful initial claims: ${successfulClaims}`);
      console.log(`    - Caught as alreadyClaimed: ${alreadyClaimedCount}`);
      console.log(`    - Uncaught duplicate key errors: ${dupKeyErrors}`);

      const u = await User.findById(user._id);
      const hasDuplicates = new Set(u!.claimedLevelRewards).size !== u!.claimedLevelRewards.length;
      console.log(`    User DB state: xp=${u?.xp}, coins=${u?.coins}, level=${u?.level}, claimedLevelRewards=${JSON.stringify(u?.claimedLevelRewards)}`);

      const txs = await Transaction.find({ userId: user._id, referenceId: sharedQuestId });
      console.log(`    Transaction records in DB: ${txs.length}`);

      assert(successfulClaims === 1, `Expected exactly 1 successful claim, got ${successfulClaims}`);
      assert(alreadyClaimedCount === concurrency - 1, `Expected ${concurrency - 1} caught as alreadyClaimed, got ${alreadyClaimedCount}`);
      assert(dupKeyErrors === 0, `Expected 0 uncaught duplicate key errors, got ${dupKeyErrors}`);
      assert(!hasDuplicates, `claimedLevelRewards must not have duplicates, got ${JSON.stringify(u?.claimedLevelRewards)}`);
      assert(u!.claimedLevelRewards.length === 1 && u!.claimedLevelRewards[0] === 2, "claimedLevelRewards must contain exactly [2]");
      assert(u!.xp === 250, `Expected 250 XP, got ${u!.xp}`);
      assert(u!.coins === 140, `Expected 140 coins (50 + 40 + 50), got ${u!.coins}`);
      assert(txs.length === 1, `Expected exactly 1 Transaction record, got ${txs.length}`);

      console.log("  ✅ PASSED: 50 concurrent duplicate requests strictly deduplicated with zero partial writes");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STRESS SUITE 2: 20 Concurrent Distinct Quests (Massive Lost Update Stress)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Stress Suite 2: 20 Concurrent Distinct Quests ───");
    {
      const user = await User.create({
        email: "recheck_distinct20@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "recheck_distinct20",
        displayName: "Recheck Distinct 20 User",
        role: "STUDENT",
        department: "Information Technology",
        xp: 0,
        level: 1,
        coins: 0,
        claimedLevelRewards: [],
      });

      const questCount = 20;
      const xpPerQuest = 50; // Total 1000 XP
      const coinsPerQuest = 10; // Total 200 base coins
      const promises: Promise<any>[] = [];

      for (let i = 0; i < questCount; i++) {
        promises.push(
          grantUserRewards({
            userId: user._id as Types.ObjectId,
            baseXp: xpPerQuest,
            baseCoins: coinsPerQuest,
            reason: `Distinct Quest #${i + 1}`,
            referenceType: "QUEST",
            referenceId: new Types.ObjectId(),
          })
        );
      }

      await Promise.all(promises);

      const u = await User.findById(user._id);
      const expectedXp = questCount * xpPerQuest; // 1000
      const expectedLevel = calculateLevelFromXp(expectedXp); // 3
      // Milestones for Level 2 (50 coins) and Level 3 (75 coins) = 125 bonus coins
      const expectedCoins = questCount * coinsPerQuest + 50 + 75; // 200 + 125 = 325

      console.log(`    Dispatched ${questCount} concurrent distinct quests:`);
      console.log(`    - Expected XP: ${expectedXp}, Actual XP in DB: ${u?.xp}`);
      console.log(`    - Expected Level: ${expectedLevel}, Actual Level in DB: ${u?.level}`);
      console.log(`    - Expected Coins: ${expectedCoins}, Actual Coins in DB: ${u?.coins}`);
      console.log(`    - claimedLevelRewards: ${JSON.stringify(u?.claimedLevelRewards)}`);

      const txs = await Transaction.find({ userId: user._id, referenceType: "QUEST" });
      console.log(`    - Distinct transactions recorded: ${txs.length} / ${questCount}`);

      assert(u!.xp === expectedXp, `Lost updates detected! Expected ${expectedXp} XP, got ${u!.xp}`);
      assert(u!.level === expectedLevel, `Expected Level ${expectedLevel}, got ${u!.level}`);
      assert(u!.coins === expectedCoins, `Coins lost or duplicated! Expected ${expectedCoins}, got ${u!.coins}`);
      assert(new Set(u!.claimedLevelRewards).size === u!.claimedLevelRewards.length, "claimedLevelRewards has duplicate entries!");
      assert(u!.claimedLevelRewards.length === 2 && u!.claimedLevelRewards[0] === 2 && u!.claimedLevelRewards[1] === 3, "claimedLevelRewards must be [2, 3]");
      assert(txs.length === questCount, `Expected ${questCount} distinct transactions, got ${txs.length}`);

      console.log("  ✅ PASSED: 20 concurrent distinct quests handled with 0 lost updates and 0 array duplicates");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STRESS SUITE 3: Interleaved Duplicate & Distinct Matrix (40 requests in parallel)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Stress Suite 3: Interleaved Duplicate & Distinct Matrix (4 distinct quests x 10 parallel attempts) ───");
    {
      const user = await User.create({
        email: "recheck_matrix@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "recheck_matrix",
        displayName: "Recheck Matrix User",
        role: "STUDENT",
        department: "Mechanical Engineering",
        xp: 100,
        level: 1,
        coins: 50,
        claimedLevelRewards: [],
      });

      const questA = new Types.ObjectId();
      const questB = new Types.ObjectId();
      const questC = new Types.ObjectId();
      const questD = new Types.ObjectId();
      const questIds = [questA, questB, questC, questD];

      const promises: Promise<any>[] = [];
      // Dispatch 10 attempts for each of the 4 quests, all mixed in one Promise.all
      for (const qId of questIds) {
        for (let i = 0; i < 10; i++) {
          promises.push(
            grantUserRewards({
              userId: user._id as Types.ObjectId,
              baseXp: 50,
              baseCoins: 15,
              reason: `Matrix quest ${qId.toString().slice(-4)} attempt ${i + 1}`,
              referenceType: "QUEST",
              referenceId: qId,
            }).catch((err) => ({ error: err.code || err.message }))
          );
        }
      }

      const results = await Promise.all(promises);

      const successfulClaims = results.filter((r) => r && !r.alreadyClaimed && !r.error).length;
      const alreadyClaimedCount = results.filter((r) => r?.alreadyClaimed === true).length;

      console.log(`    Dispatched 40 mixed requests (4 distinct quests x 10 attempts):`);
      console.log(`    - Successful claims: ${successfulClaims} (expected 4)`);
      console.log(`    - Caught as alreadyClaimed: ${alreadyClaimedCount} (expected 36)`);

      const u = await User.findById(user._id);
      // Initial 100 XP + 4 * 50 = 300 XP (Level 2: threshold 200, Level 3: 627)
      // Level 2 reached -> 25 * 2 = 50 milestone coins
      // Initial coins 50 + 4 * 15 base + 50 milestone = 160 coins
      console.log(`    User DB state: xp=${u?.xp}, coins=${u?.coins}, level=${u?.level}, claimedLevelRewards=${JSON.stringify(u?.claimedLevelRewards)}`);

      const txs = await Transaction.find({ userId: user._id, referenceType: "QUEST" });
      console.log(`    Transactions recorded in DB: ${txs.length} (expected 4)`);

      assert(successfulClaims === 4, `Expected exactly 4 successful claims, got ${successfulClaims}`);
      assert(alreadyClaimedCount === 36, `Expected 36 alreadyClaimed, got ${alreadyClaimedCount}`);
      assert(txs.length === 4, `Expected exactly 4 transactions, got ${txs.length}`);
      assert(u!.xp === 300, `Expected 300 XP, got ${u!.xp}`);
      assert(u!.coins === 160, `Expected 160 coins, got ${u!.coins}`);
      assert(u!.level === 2, `Expected Level 2, got ${u!.level}`);
      assert(u!.claimedLevelRewards.length === 1 && u!.claimedLevelRewards[0] === 2, "claimedLevelRewards must contain exactly [2]");
      assert(new Set(u!.claimedLevelRewards).size === u!.claimedLevelRewards.length, "claimedLevelRewards must have no duplicates");

      console.log("  ✅ PASSED: Mixed matrix safely filtered all duplicates and correctly applied all distinct rewards");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STRESS SUITE 4: Multi-User Parallelism & Non-Contention
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Stress Suite 4: Multi-User Concurrency (5 distinct users in parallel) ───");
    {
      const users: any[] = [];
      for (let i = 0; i < 5; i++) {
        const u = await User.create({
          email: `multi_user_${i}@aiemgoa.ac.in`,
          passwordHash: "securehash",
          username: `multi_user_${i}`,
          displayName: `Multi User ${i}`,
          role: "STUDENT",
          department: "Computer Science",
          xp: 0,
          level: 1,
          coins: 0,
          claimedLevelRewards: [],
        });
        users.push(u);
      }

      // Each user does 5 distinct quests concurrently
      const allPromises: Promise<any>[] = [];
      for (const u of users) {
        for (let q = 0; q < 5; q++) {
          allPromises.push(
            grantUserRewards({
              userId: u._id as Types.ObjectId,
              baseXp: 50,
              baseCoins: 10,
              reason: `User ${u.username} Quest ${q}`,
              referenceType: "QUEST",
              referenceId: new Types.ObjectId(),
            })
          );
        }
      }

      await Promise.all(allPromises);

      // Verify each user has 250 XP (Level 2), 50 base coins + 50 L2 milestone = 100 coins, claimedLevelRewards=[2]
      for (const u of users) {
        const fresh = await User.findById(u._id);
        assert(fresh!.xp === 250, `User ${u.username} expected 250 XP, got ${fresh!.xp}`);
        assert(fresh!.level === 2, `User ${u.username} expected Level 2, got ${fresh!.level}`);
        assert(fresh!.coins === 100, `User ${u.username} expected 100 coins, got ${fresh!.coins}`);
        assert(fresh!.claimedLevelRewards.length === 1 && fresh!.claimedLevelRewards[0] === 2, `User ${u.username} claimedLevelRewards must be [2]`);
      }

      console.log("  ✅ PASSED: Multi-user parallelism executed without deadlock, cross-talk, or contention");
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STRESS SUITE 5: Transaction Rollback on User Save Failure
    // ─────────────────────────────────────────────────────────────────────────────
    console.log("\n─── Stress Suite 5: Transaction Rollback Verification on User Save Failure ───");
    {
      const user = await User.create({
        email: "rollback_test@aiemgoa.ac.in",
        passwordHash: "securehash",
        username: "rollback_test_user",
        displayName: "Rollback Test User",
        role: "STUDENT",
        department: "Computer Science",
        xp: 100,
        level: 1,
        coins: 10,
        claimedLevelRewards: [],
      });

      const questId = new Types.ObjectId();

      // Temporarily mock User.prototype.save to reject with a validation error
      const originalSave = User.prototype.save;
      let mockTriggered = false;
      User.prototype.save = async function (this: any, ...args: any[]) {
        if (this._id.equals(user._id)) {
          mockTriggered = true;
          throw new Error("MOCK_DATABASE_SAVE_FAILURE");
        }
        return originalSave.apply(this, args);
      };

      let errorThrown = false;
      try {
        await grantUserRewards({
          userId: user._id as Types.ObjectId,
          baseXp: 50,
          baseCoins: 10,
          reason: "Rollback stress quest",
          referenceType: "QUEST",
          referenceId: questId,
        });
      } catch (err: any) {
        errorThrown = true;
        assert(err.message === "MOCK_DATABASE_SAVE_FAILURE", `Unexpected error message: ${err.message}`);
      } finally {
        // Restore original save
        User.prototype.save = originalSave;
      }

      assert(mockTriggered, "Mock save failure was not triggered");
      assert(errorThrown, "Expected error was not thrown");

      // Verify that the pre-created transaction was rolled back (deleted)
      const orphanedTx = await Transaction.findOne({ userId: user._id, referenceId: questId });
      assert(!orphanedTx, "Orphaned transaction was NOT rolled back!");

      // Verify user document was not modified
      const cleanUser = await User.findById(user._id);
      assert(cleanUser!.xp === 100, `User XP was modified despite failure! Got ${cleanUser!.xp}`);
      assert(cleanUser!.coins === 10, `User coins was modified despite failure! Got ${cleanUser!.coins}`);

      // Now verify that the quest CAN be successfully claimed after the failure was fixed
      const retryResult = await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: 50,
        baseCoins: 10,
        reason: "Rollback retry quest",
        referenceType: "QUEST",
        referenceId: questId,
      });

      assert(Boolean(retryResult && !retryResult.alreadyClaimed), "Retry should succeed and not be falsely blocked by orphaned tx");
      const finalUser = await User.findById(user._id);
      assert(finalUser!.xp === 150, `Expected 150 XP after retry, got ${finalUser!.xp}`);
      assert(finalUser!.coins === 20, `Expected 20 coins after retry, got ${finalUser!.coins}`);

      console.log("  ✅ PASSED: User save failure cleanly rolls back pre-created transaction with zero orphaned records");
    }

    console.log("\n================================================================================");
    console.log("🎉 ALL EMPIRICAL RE-CHECK STRESS TESTS PASSED (100%)");
    console.log("================================================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
  }
}

runEmpiricalRecheckSuite().catch((err) => {
  console.error("FATAL SUITE FAILURE:", err);
  process.exit(1);
});

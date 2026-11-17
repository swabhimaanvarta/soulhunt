/**
 * AIEM Hunt — Challenger Empirical Stress Harness for Milestone 2
 * Focus: Concurrency Stress on Shop Purchases & Direct API Equip Fuzzing
 *
 * Verifies:
 * 1. Parallel purchase race with borderline coins (100 coins, 100 cost): atomic debit, zero negative balance, zero double-charge.
 * 2. Parallel purchase race with abundant coins (1000 coins, 150 cost): single-buy guarantee on unique cosmetics.
 * 3. Concurrent duplicate purchase attempts on already-owned reward: exactly 0 duplicate transactions or entries.
 * 4. Concurrent purchase attempts on free starter loadouts: 100% rejected, zero coin deduction.
 * 5. Finite stock race condition across multiple distinct users: stock atomically decremented, zero overselling, zero coin leak for losers.
 * 6. Direct API equip fuzzing on PUT /api/user/profile: unowned frames, unowned titles, injection payloads, unowned ObjectIds strictly return HTTP 403 COSMETIC_NOT_OWNED.
 */

import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { NextRequest } from "next/server";
import mongoose, { Types } from "mongoose";
import {
  User,
  Reward,
  Transaction,
  AuditEvent,
} from "../models";
import { connectDB } from "../lib/db";
import { POST as postPurchase } from "../app/api/rewards/purchase/route";
import { PUT as putProfile } from "../app/api/user/profile/route";

const RUN_ID = `aiem_hunt_challenger_m2_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.ALLOW_DESTRUCTIVE_SEED = "true";
process.env.JWT_SECRET = "production_super_secret_key_minimum_32_characters_long";

// AsyncLocalStorage to isolate simulated user sessions during concurrent requests
const userStorage = new AsyncLocalStorage<any>();
let fallbackTestUser: any = null;

Object.defineProperty(globalThis, "__TEST_CURRENT_USER__", {
  get() {
    return userStorage.getStore() || fallbackTestUser;
  },
  configurable: true,
});

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failure: ${message}`);
  } else {
    passedCount++;
    console.log(`  ✅ PASSED: ${message}`);
  }
}

function createJsonRequest(url: string, method: string, body: any): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function runEmpiricalStressTests() {
  console.log("\n========================================================");
  console.log("⚔️  CHALLENGER STRESS HARNESS — MILESTONE 2 (COSMETICS & SHOP)");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Concurrency on Shop Purchases with Borderline Coins
    // -------------------------------------------------------------------------
    console.log("─── Challenge 1: Parallel Purchase Race with Borderline Coins (100 coins, cost 100) ───");

    const shopReward100 = await Reward.create({
      code: "FRAME_OBSIDIAN_CORE",
      title: "Obsidian Core Frame",
      name: "Obsidian Core Frame",
      description: "Dark tactical avatar frame",
      type: "FRAME",
      coinCost: 100,
      metadata: { value: "frame-obsidian" },
      isActive: true,
      minLevelRequired: 1,
    });

    const borderUser = await User.create({
      username: `border_user_${Date.now()}`,
      displayName: "Borderline User",
      email: `border_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 100, // Exactly enough for 1 purchase
      level: 1,
      ownedCosmetics: [],
    });

    fallbackTestUser = borderUser;

    const PARALLEL_ATTEMPTS_1 = 15;
    console.log(`  >>> Firing ${PARALLEL_ATTEMPTS_1} parallel purchase requests for 100-coin item with 100 coins...`);

    const purchasePromises1 = Array.from({ length: PARALLEL_ATTEMPTS_1 }).map((_, idx) => {
      const req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
        rewardId: shopReward100._id.toString(),
        clientRequestId: `req_border_${idx}_${crypto.randomBytes(4).toString("hex")}`,
      });
      return postPurchase(req);
    });

    const purchaseResponses1 = await Promise.all(purchasePromises1);
    const purchaseResults1 = await Promise.all(
      purchaseResponses1.map(async (res) => ({
        status: res.status,
        body: await res.json(),
      }))
    );

    const successfulPurchases1 = purchaseResults1.filter((r) => r.status === 200 && r.body.success === true);
    const rejectedPurchases1 = purchaseResults1.filter((r) => r.status === 400);

    assert(successfulPurchases1.length === 1, `Exactly ONE purchase succeeded out of ${PARALLEL_ATTEMPTS_1} concurrent requests (got ${successfulPurchases1.length})`);
    assert(rejectedPurchases1.length === PARALLEL_ATTEMPTS_1 - 1, `All other ${PARALLEL_ATTEMPTS_1 - 1} concurrent requests were rejected with HTTP 400 (got ${rejectedPurchases1.length})`);

    // Verify DB integrity for borderUser
    const borderUserPost = await User.findById(borderUser._id).lean();
    assert(borderUserPost?.coins === 0, `User balance is exactly 0 Hunter Coins (got ${borderUserPost?.coins}) — ZERO negative balance!`);
    assert(
      Array.isArray(borderUserPost?.ownedCosmetics) && borderUserPost.ownedCosmetics.length === 1,
      `User ownedCosmetics has exactly 1 cosmetic entry (got ${borderUserPost?.ownedCosmetics?.length})`
    );
    assert(
      borderUserPost?.ownedCosmetics[0]?.toString() === shopReward100._id.toString(),
      "ownedCosmetics entry strictly matches purchased reward ObjectId"
    );

    // Verify Transaction ledger
    const txRecords1 = await Transaction.find({ userId: borderUser._id });
    assert(txRecords1.length === 1, `Transaction collection has exactly 1 debit record (got ${txRecords1.length}) — ZERO double-charging!`);
    assert(txRecords1[0].deltaCoins === -100, "Transaction deltaCoins is -100");

    // Verify AuditEvent ledger
    const auditRecords1 = await AuditEvent.find({ actorId: borderUser._id, action: "REWARD_PURCHASE" });
    assert(auditRecords1.length === 1, `AuditEvent collection has exactly 1 audit record (got ${auditRecords1.length})`);

    // -------------------------------------------------------------------------
    // TEST 2: Parallel Purchase Race with Abundant Coins (Unique Cosmetic Protection)
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 2: Parallel Purchase Race with Abundant Coins (1000 coins, cost 150) ───");

    const shopReward150 = await Reward.create({
      code: "FRAME_CYAN_MATRIX",
      title: "Neon Cyan Matrix Frame",
      name: "Neon Cyan Matrix Frame",
      description: "Cyberpunk frame",
      type: "FRAME",
      coinCost: 150,
      metadata: { value: "frame-cyan-matrix" },
      isActive: true,
      minLevelRequired: 1,
    });

    const richUser = await User.create({
      username: `rich_user_${Date.now()}`,
      displayName: "Rich Operative",
      email: `rich_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 1000,
      level: 1,
      ownedCosmetics: [],
    });

    fallbackTestUser = richUser;

    const PARALLEL_ATTEMPTS_2 = 15;
    console.log(`  >>> Firing ${PARALLEL_ATTEMPTS_2} parallel purchase requests from user with 1000 coins...`);

    const purchasePromises2 = Array.from({ length: PARALLEL_ATTEMPTS_2 }).map((_, idx) => {
      const req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
        rewardId: shopReward150._id.toString(),
        clientRequestId: `req_rich_${idx}_${crypto.randomBytes(4).toString("hex")}`,
      });
      return postPurchase(req);
    });

    const purchaseResponses2 = await Promise.all(purchasePromises2);
    const purchaseResults2 = await Promise.all(
      purchaseResponses2.map(async (res) => ({
        status: res.status,
        body: await res.json(),
      }))
    );

    const successfulPurchases2 = purchaseResults2.filter((r) => r.status === 200 && r.body.success === true);
    const rejectedPurchases2 = purchaseResults2.filter((r) => r.status === 400);

    assert(successfulPurchases2.length === 1, `Exactly ONE purchase succeeded out of ${PARALLEL_ATTEMPTS_2} concurrent requests (got ${successfulPurchases2.length})`);
    assert(rejectedPurchases2.length === PARALLEL_ATTEMPTS_2 - 1, `Remaining ${PARALLEL_ATTEMPTS_2 - 1} requests rejected (got ${rejectedPurchases2.length})`);

    const richUserPost = await User.findById(richUser._id).lean();
    assert(richUserPost?.coins === 850, `Rich user coins correctly debited from 1000 to 850 (got ${richUserPost?.coins}) — ZERO duplicate debits!`);
    assert(
      richUserPost?.ownedCosmetics?.filter((id: any) => id.toString() === shopReward150._id.toString()).length === 1,
      "ownedCosmetics contains exactly ONE entry for the purchased cosmetic"
    );

    const txRecords2 = await Transaction.find({ userId: richUser._id });
    assert(txRecords2.length === 1, `Transaction ledger has exactly 1 entry for richUser (got ${txRecords2.length})`);

    // -------------------------------------------------------------------------
    // TEST 3: Concurrent Purchase Attempts on Already-Owned Reward
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 3: Concurrent Duplicate Purchase Attempts on Already-Owned Reward ───");

    // richUser already owns shopReward150 now
    fallbackTestUser = await User.findById(richUser._id).lean();

    const PARALLEL_ATTEMPTS_3 = 10;
    console.log(`  >>> Firing ${PARALLEL_ATTEMPTS_3} parallel duplicate purchase requests on already-owned reward...`);

    const purchasePromises3 = Array.from({ length: PARALLEL_ATTEMPTS_3 }).map((_, idx) => {
      const req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
        rewardId: shopReward150._id.toString(),
        clientRequestId: `req_dup_${idx}_${crypto.randomBytes(4).toString("hex")}`,
      });
      return postPurchase(req);
    });

    const purchaseResponses3 = await Promise.all(purchasePromises3);
    const purchaseResults3 = await Promise.all(
      purchaseResponses3.map(async (res) => ({
        status: res.status,
        body: await res.json(),
      }))
    );

    const allRejected3 = purchaseResults3.every(
      (r) => r.status === 400 && (r.body.error === "ALREADY_OWNED" || r.body.error?.code === "ALREADY_OWNED")
    );
    assert(allRejected3, `All ${PARALLEL_ATTEMPTS_3} duplicate requests returned HTTP 400 ALREADY_OWNED`);

    const richUserAfterDup = await User.findById(richUser._id).lean();
    assert(richUserAfterDup?.coins === 850, "User balance remains strictly 850 after duplicate attempts");

    const txRecords3 = await Transaction.find({ userId: richUser._id });
    assert(txRecords3.length === 1, `Transaction count strictly remained 1 — exactly 0 duplicate ledger entries created`);

    // -------------------------------------------------------------------------
    // TEST 4: Concurrent Purchase Attempts on Starter Loadout Item
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 4: Concurrent Purchase Attempts on Free Starter Items ───");

    const starterReward = await Reward.create({
      code: "STARTER_PULSE_FRAME",
      title: "frame-emerald-pulse",
      name: "Emerald Cyber Pulse",
      description: "Starter pulse frame",
      type: "FRAME",
      coinCost: 50,
      metadata: { value: "frame-emerald-pulse" },
      isActive: true,
      minLevelRequired: 1,
    });

    const starterBuyer = await User.create({
      username: `starter_buyer_${Date.now()}`,
      displayName: "Starter Buyer",
      email: `starter_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 500,
      level: 1,
      ownedCosmetics: [],
    });

    fallbackTestUser = starterBuyer;

    const PARALLEL_ATTEMPTS_4 = 10;
    console.log(`  >>> Firing ${PARALLEL_ATTEMPTS_4} parallel purchases on starter item...`);

    const purchasePromises4 = Array.from({ length: PARALLEL_ATTEMPTS_4 }).map((_, idx) => {
      const req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
        rewardId: starterReward._id.toString(),
        clientRequestId: `req_starter_${idx}_${crypto.randomBytes(4).toString("hex")}`,
      });
      return postPurchase(req);
    });

    const purchaseResponses4 = await Promise.all(purchasePromises4);
    const purchaseResults4 = await Promise.all(
      purchaseResponses4.map(async (res) => ({
        status: res.status,
        body: await res.json(),
      }))
    );

    const allStarterRejected = purchaseResults4.every(
      (r) => r.status === 400 && r.body.error === "ALREADY_OWNED"
    );
    assert(allStarterRejected, `All ${PARALLEL_ATTEMPTS_4} attempts to buy starter cosmetic rejected with ALREADY_OWNED`);

    const starterBuyerPost = await User.findById(starterBuyer._id).lean();
    assert(starterBuyerPost?.coins === 500, "Starter buyer balance untouched at 500 coins");
    assert(
      (starterBuyerPost?.ownedCosmetics || []).length === 0,
      "ownedCosmetics is still empty (starter item remains free and universal)"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Finite Stock Concurrency Race Across Multiple Users
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 5: Finite Stock Race Across 5 Competing Users (Stock = 1) ───");

    const limitedReward = await Reward.create({
      code: "LIMITED_HOLO_PRISM",
      title: "Holographic Prism Frame",
      name: "Holographic Prism Frame",
      description: "Prismatic holographic border",
      type: "FRAME",
      coinCost: 50,
      metadata: { value: "frame-hologram" },
      isActive: true,
      minLevelRequired: 1,
      stock: 1, // Only 1 in stock!
    });

    const competingUsers: any[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await User.create({
        username: `competitor_${i}_${Date.now()}`,
        displayName: `Competitor ${i + 1}`,
        email: `comp_${i}_${Date.now()}@aiemgoa.ac.in`,
        passwordHash: "hash123",
        role: "STUDENT",
        accountStatus: "ACTIVE",
        emailVerified: true,
        coins: 50, // Exactly enough for 1 purchase
        level: 1,
        ownedCosmetics: [],
      });
      competingUsers.push(u);
    }

    fallbackTestUser = null; // Clear fallback to force AsyncLocalStorage per competitor

    console.log("  >>> Firing 5 simultaneous purchase requests for a single in-stock item across 5 users...");

    const competingPromises = competingUsers.map((user, idx) =>
      userStorage.run(user, async () => {
        const req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
          rewardId: limitedReward._id.toString(),
          clientRequestId: `req_comp_${idx}_${crypto.randomBytes(4).toString("hex")}`,
        });
        const res = await postPurchase(req);
        return {
          userId: user._id.toString(),
          status: res.status,
          body: await res.json(),
        };
      })
    );

    const competingResults = await Promise.all(competingPromises);

    const winningCompetitors = competingResults.filter((r) => r.status === 200 && r.body.success === true);
    const losingCompetitors = competingResults.filter((r) => r.status === 400);

    assert(winningCompetitors.length === 1, `Exactly ONE competitor won the limited stock item (got ${winningCompetitors.length})`);
    assert(losingCompetitors.length === 4, `The other 4 competitors were rejected with HTTP 400 (got ${losingCompetitors.length})`);

    const limitedRewardPost = await Reward.findById(limitedReward._id).lean();
    assert(limitedRewardPost?.stock === 0, `Reward stock is exactly 0 (got ${limitedRewardPost?.stock}) — ZERO negative overselling!`);

    const winningUserPost = await User.findById(winningCompetitors[0].userId).lean();
    assert(winningUserPost?.coins === 0, "Winner coins atomically debited to 0");
    assert(
      Boolean(winningUserPost?.ownedCosmetics?.some((id: any) => id.toString() === limitedReward._id.toString())),
      "Winner successfully received limited cosmetic in ownedCosmetics"
    );

    for (const loser of losingCompetitors) {
      const loserUserPost = await User.findById(loser.userId).lean();
      assert(loserUserPost?.coins === 50, `Losing user (${loser.userId}) coins remained 50 — ZERO coin leaks for failed purchases!`);
      assert(
        (loserUserPost?.ownedCosmetics || []).length === 0,
        `Losing user (${loser.userId}) was NOT granted the cosmetic`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 6: Direct API Equip Fuzzing on PUT /api/user/profile
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 6: Direct API Equip Fuzzing (PUT /api/user/profile) ───");

    const fuzzUser = await User.create({
      username: `fuzz_user_${Date.now()}`,
      displayName: "Fuzzing Tester",
      email: `fuzz_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 50,
      level: 1, // Level 1 (cannot equip level 5+ or achievement items)
      equippedTitle: "Campus Pathfinder",
      equippedFrame: "frame-emerald-pulse",
      equippedTheme: "theme-obsidian-grid",
      ownedCosmetics: [], // Owns no shop items
    });

    fallbackTestUser = fuzzUser;

    // 6.1 Fuzz Unowned Prestige Frames
    const unownedFrames = [
      "frame-obsidian", // Shop item
      "frame-neon-gold", // Level 5 locked
      "frame-hologram", // Shop item
      "frame-cyan-matrix", // Shop item
    ];

    for (const frame of unownedFrames) {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
        equippedFrame: frame,
      });
      const res = await putProfile(req);
      const json = await res.json();

      assert(res.status === 403, `Equipping unowned frame '${frame}' returned HTTP 403 Forbidden`);
      assert(json.error === "COSMETIC_NOT_OWNED", `Error code is strictly COSMETIC_NOT_OWNED for '${frame}'`);
    }

    // 6.2 Fuzz Unowned Prestige Titles
    const unownedTitles = [
      "Apex Hunter", // Level 15 locked
      "Master Tracker", // Level 8 locked
      "Night Owl", // Achievement locked
      "Dean's Honor Guard", // Achievement locked
      "Crypto Sleuth", // Shop locked
    ];

    for (const title of unownedTitles) {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
        equippedTitle: title,
      });
      const res = await putProfile(req);
      const json = await res.json();

      assert(res.status === 403, `Equipping unowned title '${title}' returned HTTP 403 Forbidden`);
      assert(json.error === "COSMETIC_NOT_OWNED", `Error code is strictly COSMETIC_NOT_OWNED for '${title}'`);
    }

    // 6.3 Fuzz Random Strings, SQL Injection, Script Injection Payloads
    const injectionPayloads = [
      "SuperAdmin_Hacked_Title",
      "' OR 1=1 --",
      "<script>alert('xss')</script>",
      "{{7*7}}",
      "undefined",
      "null",
      "NaN",
      crypto.randomBytes(32).toString("hex"),
      "../../../etc/passwd",
    ];

    for (const payload of injectionPayloads) {
      // Test as equippedTitle
      {
        const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
          equippedTitle: payload,
        });
        const res = await putProfile(req);
        const json = await res.json();
        assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Fuzz title '${payload.slice(0, 15)}...' rejected with HTTP 403 COSMETIC_NOT_OWNED`);
      }

      // Test as equippedFrame
      {
        const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
          equippedFrame: payload,
        });
        const res = await putProfile(req);
        const json = await res.json();
        assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Fuzz frame '${payload.slice(0, 15)}...' rejected with HTTP 403 COSMETIC_NOT_OWNED`);
      }

      // Test as equippedTheme
      {
        const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
          equippedTheme: payload,
        });
        const res = await putProfile(req);
        const json = await res.json();
        assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Fuzz theme '${payload.slice(0, 15)}...' rejected with HTTP 403 COSMETIC_NOT_OWNED`);
      }

      // Test as equippedBanner
      {
        const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
          equippedBanner: payload,
        });
        const res = await putProfile(req);
        const json = await res.json();
        assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Fuzz banner '${payload.slice(0, 15)}...' rejected with HTTP 403 COSMETIC_NOT_OWNED`);
      }

      // Test as equippedDecoration
      {
        const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
          equippedDecoration: payload,
        });
        const res = await putProfile(req);
        const json = await res.json();
        assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Fuzz decoration '${payload.slice(0, 15)}...' rejected with HTTP 403 COSMETIC_NOT_OWNED`);
      }
    }

    // 6.4 Fuzz with Unowned ObjectIds (Non-existent ObjectId and Valid unowned Reward ObjectId)
    const fakeObjectId = new Types.ObjectId().toString();
    {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
        equippedFrame: fakeObjectId,
      });
      const res = await putProfile(req);
      const json = await res.json();
      assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Non-existent ObjectId '${fakeObjectId}' rejected with 403 COSMETIC_NOT_OWNED`);
    }

    // Valid Reward ObjectId existing in DB but NOT owned by user
    const unownedShopRewardId = shopReward100._id.toString();
    {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
        equippedFrame: unownedShopRewardId,
      });
      const res = await putProfile(req);
      const json = await res.json();
      assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Unowned existing Reward ObjectId '${unownedShopRewardId}' rejected with 403 COSMETIC_NOT_OWNED`);
    }

    // 6.5 Fuzz with Tampered Request Types (Numbers, Booleans, Objects, Arrays)
    const tamperedPayloads = [
      { equippedFrame: 99999 },
      { equippedFrame: true },
      { equippedFrame: ["frame-obsidian"] },
      { equippedFrame: { evil: "payload" } },
      { equippedTitle: 12345 },
      { equippedTitle: false },
      { equippedTitle: ["Apex Hunter"] },
    ];

    for (const tampered of tamperedPayloads) {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", tampered);
      const res = await putProfile(req);
      const json = await res.json();
      assert(res.status === 403 && json.error === "COSMETIC_NOT_OWNED", `Tampered payload ${JSON.stringify(tampered)} rejected with 403 COSMETIC_NOT_OWNED`);
    }

    // 6.6 Verify Starter Loadout Equips Always Succeed (HTTP 200 OK)
    const starterEquipChecks = [
      { equippedTitle: "Campus Pathfinder" },
      { equippedTitle: "Rookie Investigator" },
      { equippedFrame: "frame-emerald-pulse" },
      { equippedFrame: "frame-cyber-grid" },
      { equippedTheme: "theme-obsidian-grid" },
      { equippedTheme: "theme-cyber-dark" },
      { equippedDecoration: "badge-verified-hunter" },
    ];

    for (const starterEquip of starterEquipChecks) {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", starterEquip);
      const res = await putProfile(req);
      const json = await res.json();
      assert(res.status === 200 && json.success === true, `Equipping starter item ${JSON.stringify(starterEquip)} succeeded with HTTP 200`);
    }

    // 6.7 Verify Empty String / Reset Un-equip is Allowed (HTTP 200 OK)
    {
      const req = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
        equippedTitle: "",
      });
      const res = await putProfile(req);
      const json = await res.json();
      assert(res.status === 200 && json.success === true, "Clearing / un-equipping title with empty string succeeded with HTTP 200");
    }

    // Verify DB integrity of fuzzUser: title cleared, frame still starter
    const finalFuzzUser = await User.findById(fuzzUser._id).lean();
    assert(finalFuzzUser?.equippedTitle === "", "User equippedTitle was cleared in DB");
    assert(finalFuzzUser?.equippedFrame === "frame-cyber-grid", "User equippedFrame was updated to valid starter frame in DB");

  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    try {
      await mongoose.connection.db?.dropDatabase();
      console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
    } catch (dropErr) {
      console.error("Warning: Failed to drop test DB:", dropErr);
    }
    await mongoose.disconnect();
  }

  console.log("\n========================================================");
  console.log(`🎉 CHALLENGER STRESS SUITE RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runEmpiricalStressTests().catch((err) => {
  console.error("Fatal stress test error:", err);
  process.exit(1);
});

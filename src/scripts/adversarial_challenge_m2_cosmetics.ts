/**
 * AIEM Hunt — Milestone 2 Adversarial Security & Stress Verification
 * Independent verification script written by Reviewer 2 (Critic).
 * 
 * Verifies:
 * 1. 403 Equip Check Bypass Attempts:
 *    - null value
 *    - empty string / whitespace
 *    - case variation of locked/shop items
 *    - fake ObjectId injection
 *    - real unowned Reward ObjectId injection
 *    - object / operator injection
 * 2. Exact Coins vs 1 Coin Less in Shop Purchases:
 *    - 100 coins vs 100 coin cost (boundary pass)
 *    - 99 coins vs 100 coin cost (boundary fail)
 *    - 0 coins vs 100 coin cost
 * 3. Starter Cosmetics:
 *    - Zero paywall verification for all 11 starter cosmetics
 *    - Free equip for new user with 0 coins and empty inventory
 *    - Shop purchase rejection for starter items
 * 4. Concurrency & Race Conditions:
 *    - Simultaneous dual purchase requests on exact funds
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { User, Reward, Transaction, AuditEvent } from "../models";
import { connectDB } from "../lib/db";
import {
  getStarterCosmetics,
  isStarterCosmetic,
  getCosmeticById,
  isCosmeticOwned,
  COSMETIC_CATALOGUE,
} from "../lib/cosmetics";
import { PUT as putProfile } from "../app/api/user/profile/route";
import { POST as postPurchase } from "../app/api/rewards/purchase/route";

const RUN_ID = `aiem_hunt_adv_m2_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.ALLOW_DESTRUCTIVE_SEED = "true";
process.env.JWT_SECRET = "production_super_secret_key_minimum_32_characters_long";

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

async function runAdversarialTests() {
  console.log("\n========================================================");
  console.log("🛡️  MILESTONE 2 INDEPENDENT ADVERSARIAL AUDIT");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: Adversarial 403 Equip Check Bypass Attempts
    // -------------------------------------------------------------------------
    console.log("─── Section 1: Adversarial 403 Equip Check Bypass Attempts ───");

    // Create locked shop reward and level-locked items
    const unownedShopFrame = await Reward.create({
      code: "FRAME_CYAN_MATRIX",
      title: "Neon Cyan Matrix Frame",
      name: "Neon Cyan Matrix Frame",
      description: "Cyberpunk frame",
      type: "FRAME",
      coinCost: 180,
      metadata: { value: "frame-cyan-matrix" },
      minLevelRequired: 1,
      stock: 10,
      isActive: true,
    });

    const levelLockedReward = await Reward.create({
      code: "FRAME_NEON_GOLD",
      title: "Neon Gold Apex Frame",
      name: "Neon Gold Apex Frame",
      description: "Prestige gold frame",
      type: "FRAME",
      coinCost: 0,
      metadata: { value: "frame-neon-gold" },
      minLevelRequired: 5,
      isActive: true,
    });

    // Operative with Level 1, 0 coins, and no owned cosmetics
    const attackerUser = await User.create({
      username: `adv_attacker_${Date.now()}`,
      displayName: "Adversarial Attacker",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF1234567890abcdefghijklm",
      email: `adv_attacker_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 0,
      level: 1,
      equippedTitle: "Campus Pathfinder",
      equippedFrame: "frame-emerald-pulse",
      equippedTheme: "theme-obsidian-grid",
      ownedCosmetics: [],
    });

    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(attackerUser._id).lean();

    // 1.1 Bypass attempt with null
    const nullReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: null,
    });
    const nullRes = await putProfile(nullReq);
    assert(nullRes.status === 403, "Sending null as equippedFrame is rejected with HTTP 403 (String(null)='null' is not owned)");

    // 1.2 Bypass attempt with empty string ""
    const emptyReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "",
    });
    const emptyRes = await putProfile(emptyReq);
    assert(emptyRes.status === 200, "Sending empty string '' is treated as unequip/clear (HTTP 200)");
    const dbUserAfterEmpty = await User.findById(attackerUser._id).lean();
    assert(dbUserAfterEmpty?.equippedFrame === "", "Equipped frame was cleared to empty string, not granted any cosmetic");

    // 1.3 Bypass attempt with whitespace "   "
    const wsReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "   ",
    });
    const wsRes = await putProfile(wsReq);
    assert(wsRes.status === 200, "Sending whitespace '   ' cleans to empty string (clears field)");

    // Reset back to starter frame
    await User.findByIdAndUpdate(attackerUser._id, { equippedFrame: "frame-emerald-pulse" });
    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(attackerUser._id).lean();

    // 1.4 Bypass attempt: Case variation of locked shop item ("FRAME-CYAN-MATRIX" / "Neon Cyan Matrix Frame")
    const caseVarReq1 = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "FRAME-CYAN-MATRIX",
    });
    const caseVarRes1 = await putProfile(caseVarReq1);
    assert(caseVarRes1.status === 403, "Case variation 'FRAME-CYAN-MATRIX' rejected with HTTP 403");

    const caseVarReq2 = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "neon cyan matrix frame",
    });
    const caseVarRes2 = await putProfile(caseVarReq2);
    assert(caseVarRes2.status === 403, "Case variation 'neon cyan matrix frame' rejected with HTTP 403");

    // 1.5 Bypass attempt: Case variation of level-locked item ("APEX HUNTER" / "apex hunter" Level 15)
    const levelCaseReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedTitle: "APEX HUNTER",
    });
    const levelCaseRes = await putProfile(levelCaseReq);
    assert(levelCaseRes.status === 403, "Case variation of level-gated title 'APEX HUNTER' rejected with HTTP 403 for Level 1 user");

    // 1.6 Bypass attempt: Fake random ObjectId injection
    const fakeObjectId = new Types.ObjectId().toString();
    const fakeObjIdReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: fakeObjectId,
    });
    const fakeObjIdRes = await putProfile(fakeObjIdReq);
    assert(fakeObjIdRes.status === 403, "Random fake ObjectId injection rejected with HTTP 403");

    // 1.7 Bypass attempt: Real valid Reward ObjectId from MongoDB, but UNOWNED by the attacker
    const realUnownedRewardId = unownedShopFrame._id.toString();
    const realUnownedReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: realUnownedRewardId,
    });
    const realUnownedRes = await putProfile(realUnownedReq);
    assert(realUnownedRes.status === 403, "Real existing Reward ObjectId (unowned) rejected with HTTP 403");

    // 1.8 Bypass attempt: Object / NoSQL injection payload
    const objInjReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: { $ne: null },
    });
    const objInjRes = await putProfile(objInjReq);
    assert(objInjRes.status === 403, "Object/NoSQL injection payload is coerced to '[object Object]' and rejected with HTTP 403");

    // Verify DB integrity: Attacker has not equipped any unowned cosmetic
    const dbAttacker = await User.findById(attackerUser._id).lean();
    assert(dbAttacker?.equippedFrame === "frame-emerald-pulse", "Attacker equippedFrame remained intact starter");
    assert(dbAttacker?.equippedTitle === "Campus Pathfinder", "Attacker equippedTitle remained intact starter");

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Exact Coins vs 1 Coin Less in Shop Purchases
    // -------------------------------------------------------------------------
    console.log("\n─── Section 2: Exact Coins vs 1 Coin Less in Shop Purchases ───");

    const item100 = await Reward.create({
      code: "BANNER_SYNTHWAVE_TEST",
      title: "Synthwave Sunset Banner",
      name: "Synthwave Sunset Banner",
      description: "Neon synthwave profile banner",
      type: "BANNER",
      coinCost: 100,
      metadata: { value: "banner-synthwave" },
      minLevelRequired: 1,
      stock: 5,
      isActive: true,
    });

    // 2.1 Boundary: User has 99 coins (1 coin LESS than required 100)
    const user99 = await User.create({
      username: `buyer_99_${Date.now()}`,
      displayName: "Buyer 99 Coins",
      passwordHash: "mock_hash",
      email: `buyer_99_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 99,
      level: 1,
      ownedCosmetics: [],
    });
    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(user99._id).lean();

    const buy99Req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: item100._id.toString(),
    });
    const buy99Res = await postPurchase(buy99Req);
    const buy99Json = await buy99Res.json();

    assert(buy99Res.status === 400, "Purchase with 99 coins (1 coin less) rejected with HTTP 400");
    assert(buy99Json.error === "INSUFFICIENT_FUNDS", "Error code is strictly INSUFFICIENT_FUNDS");
    assert(buy99Json.message.includes("Needed: 100, Available: 99"), "Message precisely states Needed: 100, Available: 99");

    const dbUser99 = await User.findById(user99._id).lean();
    assert(dbUser99?.coins === 99, "User coins remained exactly 99 (zero debit on failure)");
    assert(dbUser99?.ownedCosmetics.length === 0, "No item was added to user.ownedCosmetics");

    // 2.2 Boundary: User has EXACTLY 100 coins (equal to required 100)
    const user100 = await User.create({
      username: `buyer_100_${Date.now()}`,
      displayName: "Buyer 100 Coins",
      passwordHash: "mock_hash",
      email: `buyer_100_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 100,
      level: 1,
      ownedCosmetics: [],
    });
    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(user100._id).lean();

    const buy100Req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: item100._id.toString(),
    });
    const buy100Res = await postPurchase(buy100Req);
    const buy100Json = await buy100Res.json();

    assert(buy100Res.status === 200, "Purchase with exactly 100 coins succeeded with HTTP 200");
    assert(buy100Json.success === true, "Response reported success = true");
    assert(buy100Json.data?.coins === 0, "Response shows remaining coins = 0");

    const dbUser100 = await User.findById(user100._id).lean();
    assert(dbUser100?.coins === 0, "User balance in MongoDB atomically reduced from 100 to 0");
    assert(
      Boolean(dbUser100?.ownedCosmetics.some((id) => id.toString() === item100._id.toString())),
      "Reward successfully added to user.ownedCosmetics"
    );

    // 2.3 User with 0 coins attempting to purchase
    (globalThis as any).__TEST_CURRENT_USER__ = dbUser100; // now has 0 coins
    const anotherItem = await Reward.create({
      code: "TITLE_CRYPTO_TEST",
      title: "Crypto Sleuth",
      name: "Crypto Sleuth",
      description: "Decoder title",
      type: "TITLE",
      coinCost: 50,
      metadata: { value: "title-crypto-sleuth" },
      minLevelRequired: 1,
      isActive: true,
    });

    const buy0Req = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: anotherItem._id.toString(),
    });
    const buy0Res = await postPurchase(buy0Req);
    assert(buy0Res.status === 400, "Purchase with 0 coins rejected with HTTP 400");
    const dbUser0 = await User.findById(user100._id).lean();
    assert(dbUser0?.coins === 0, "User coins remained 0");

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Starter Cosmetics Zero-Paywall Verification
    // -------------------------------------------------------------------------
    console.log("\n─── Section 3: Starter Cosmetics Zero-Paywall Verification ───");

    const starterList = getStarterCosmetics();
    console.log(`  ℹ️ Found ${starterList.length} starter cosmetics in catalogue.`);
    assert(starterList.length >= 10, "Authoritative catalogue contains at least 10 starter cosmetics");

    // Create a brand new operative with 0 XP, Level 1, 0 Coins, empty inventory
    const starterUser = await User.create({
      username: `starter_hero_${Date.now()}`,
      displayName: "Starter Operative",
      passwordHash: "mock_hash",
      email: `starter_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 0,
      xp: 0,
      level: 1,
      ownedCosmetics: [],
    });
    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(starterUser._id).lean();

    // Verify all starter items are owned according to isCosmeticOwned
    for (const item of starterList) {
      assert(
        isCosmeticOwned(starterUser, item.id),
        `Starter cosmetic '${item.id}' (${item.name}) is free and owned for brand new user`
      );
    }

    // Verify user can equip starter items freely
    // 1. Equip starter frame 'frame-cyber-grid'
    const equipStarterFrameReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "frame-cyber-grid",
    });
    const equipStarterFrameRes = await putProfile(equipStarterFrameReq);
    assert(equipStarterFrameRes.status === 200, "Equipping starter frame 'frame-cyber-grid' returns HTTP 200");

    // 2. Equip starter title 'Rookie Investigator'
    const equipStarterTitleReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedTitle: "Rookie Investigator",
    });
    const equipStarterTitleRes = await putProfile(equipStarterTitleReq);
    assert(equipStarterTitleRes.status === 200, "Equipping starter title 'Rookie Investigator' returns HTTP 200");

    // 3. Equip starter theme 'theme-cyber-dark'
    const equipStarterThemeReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedTheme: "theme-cyber-dark",
    });
    const equipStarterThemeRes = await putProfile(equipStarterThemeReq);
    assert(equipStarterThemeRes.status === 200, "Equipping starter theme 'theme-cyber-dark' returns HTTP 200");

    // 4. Equip starter avatar presets
    for (const avatarPreset of ["recon", "scout", "infiltrator", "tactician"]) {
      const equipAvatarReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
        avatarPreset,
      });
      const equipAvatarRes = await putProfile(equipAvatarReq);
      assert(equipAvatarRes.status === 200, `Setting starter avatar preset '${avatarPreset}' returns HTTP 200`);
    }

    // Verify starter items cannot be sold in the shop
    const maliciousStarterReward = await Reward.create({
      code: "STARTER_TITLE_CAMPUS_PATHFINDER",
      title: "Campus Pathfinder",
      name: "Campus Pathfinder Title",
      description: "Paywalled starter title attempt",
      type: "TITLE",
      coinCost: 50,
      metadata: { value: "Campus Pathfinder" },
      minLevelRequired: 1,
      isActive: true,
    });

    const buyStarterMaliciousReq = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: maliciousStarterReward._id.toString(),
    });
    const buyStarterMaliciousRes = await postPurchase(buyStarterMaliciousReq);
    const buyStarterMaliciousJson = await buyStarterMaliciousRes.json();

    assert(buyStarterMaliciousRes.status === 400, "Attempting to sell/buy starter item in shop is rejected with HTTP 400");
    assert(buyStarterMaliciousJson.error === "ALREADY_OWNED", "Error is ALREADY_OWNED");
    assert(buyStarterMaliciousJson.message.includes("starter loadout"), "Explanation notes item is part of starter loadout and already free");

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Concurrency & Double-Spend Defense
    // -------------------------------------------------------------------------
    console.log("\n─── Section 4: Concurrency & Double-Spend Defense ───");

    const finiteItem = await Reward.create({
      code: "FRAME_HOLO_PRISM",
      title: "Holographic Prism Frame",
      name: "Holographic Prism Frame",
      description: "Unique frame",
      type: "FRAME",
      coinCost: 200,
      metadata: { value: "frame-hologram" },
      minLevelRequired: 1,
      stock: 1, // Only 1 in stock!
      isActive: true,
    });

    // User has exactly 200 coins (only enough for 1 purchase)
    const concurrentUser = await User.create({
      username: `concurrent_user_${Date.now()}`,
      displayName: "Concurrent User",
      passwordHash: "mock_hash",
      email: `concurrent_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 200,
      level: 1,
      ownedCosmetics: [],
    });

    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(concurrentUser._id).lean();

    // Fire 2 concurrent purchases for the exact same reward
    const p1 = postPurchase(createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: finiteItem._id.toString(),
      clientRequestId: `req_${Date.now()}_1`,
    }));
    const p2 = postPurchase(createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: finiteItem._id.toString(),
      clientRequestId: `req_${Date.now()}_2`,
    }));

    const [res1, res2] = await Promise.all([p1, p2]);
    const json1 = await res1.json();
    const json2 = await res2.json();

    const successCount = [res1, res2].filter((r) => r.status === 200 && r.json).length;
    console.log(`  ℹ️ Concurrent responses: [${res1.status}, ${res2.status}]`);

    // Verify user coins in DB never dropped below 0
    const dbConcurrentUser = await User.findById(concurrentUser._id).lean();
    assert(dbConcurrentUser?.coins === 0, `User balance after concurrent calls is exactly 0 (no negative balance, was: ${dbConcurrentUser?.coins})`);
    assert(
      dbConcurrentUser?.ownedCosmetics.filter((id) => id.toString() === finiteItem._id.toString()).length === 1,
      "Item added exactly ONCE to ownedCosmetics under concurrent fire"
    );

    // Verify audit logs for the purchase
    const auditLogs = await AuditEvent.find({
      actorId: concurrentUser._id,
      action: "REWARD_PURCHASE",
    });
    assert(auditLogs.length === 1, "Exactly one AuditEvent logged for the successful purchase");

    console.log();
  } finally {
    const currentDb = mongoose.connection.db;
    if (currentDb && currentDb.databaseName === RUN_ID) {
      console.log(`🧹 Dropping ephemeral audit test database: ${RUN_ID}...`);
      await currentDb.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Dropped cleanly.\n");
    }
  }

  console.log("========================================================");
  console.log(`🎉 ADVERSARIAL AUDIT COMPLETED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdversarialTests().catch((err) => {
  console.error("FATAL ERROR IN ADVERSARIAL AUDIT:", err);
  process.exit(1);
});

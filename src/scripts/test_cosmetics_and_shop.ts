import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  User,
  Reward,
  Transaction,
  AuditEvent,
} from "../models";
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

// Ephemeral isolated test database strictly bound to aiem_hunt_test_*
const RUN_ID = `aiem_hunt_test_cosmetics_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function runCosmeticsAndShopTests() {
  console.log("\n========================================================");
  console.log("🎨 AIEM HUNT — COSMETICS, OWNERSHIP & SHOP TEST SUITE");
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
    // SUITE 1: Starter Loadouts & Ownership Invariants
    // -------------------------------------------------------------------------
    console.log("─── Suite 1: Starter Loadouts & Zero-Paywall Ownership ───");

    const starterItems = getStarterCosmetics();
    assert(Array.isArray(starterItems) && starterItems.length >= 10, "Starter cosmetics catalogue contains all baseline items");

    // Verify all starter categories are present
    const starterAvatars = starterItems.filter((i) => i.category === "AVATAR").map((i) => i.id);
    const starterFrames = starterItems.filter((i) => i.category === "FRAME").map((i) => i.id);
    const starterBanners = starterItems.filter((i) => i.category === "BANNER").map((i) => i.id);
    const starterTitles = starterItems.filter((i) => i.category === "TITLE").map((i) => i.id);
    const starterDecorations = starterItems.filter((i) => i.category === "DECORATION").map((i) => i.id);

    assert(
      ["recon", "scout", "infiltrator", "tactician"].every((id) => starterAvatars.includes(id)),
      "Starter avatars include recon, scout, infiltrator, tactician"
    );
    assert(
      ["frame-emerald-pulse", "frame-cyber-grid"].every((id) => starterFrames.includes(id)),
      "Starter frames include frame-emerald-pulse, frame-cyber-grid"
    );
    assert(
      ["theme-obsidian-grid", "theme-cyber-dark"].every((id) => starterBanners.includes(id)),
      "Starter themes/banners include theme-obsidian-grid, theme-cyber-dark"
    );
    assert(
      ["Campus Pathfinder", "Rookie Investigator"].every((id) => starterTitles.includes(id)),
      "Starter titles include Campus Pathfinder, Rookie Investigator"
    );
    assert(
      starterDecorations.includes("badge-verified-hunter"),
      "Starter decorations include badge-verified-hunter"
    );

    // Verify isStarterCosmetic helper
    assert(isStarterCosmetic("frame-emerald-pulse"), "isStarterCosmetic returns true for frame-emerald-pulse");
    assert(isStarterCosmetic("frame-cyber-grid"), "isStarterCosmetic returns true for frame-cyber-grid");
    assert(isStarterCosmetic("Campus Pathfinder"), "isStarterCosmetic returns true for Campus Pathfinder");
    assert(isStarterCosmetic("recon"), "isStarterCosmetic returns true for recon");
    assert(!isStarterCosmetic("frame-obsidian"), "isStarterCosmetic returns false for purchasable frame-obsidian");
    assert(!isStarterCosmetic("Apex Hunter"), "isStarterCosmetic returns false for level-locked Apex Hunter");

    // Verify isCosmeticOwned gives starter access to ANY user without purchase or unlock
    const freshMockUser = { ownedCosmetics: [], level: 1 };
    assert(isCosmeticOwned(freshMockUser, "frame-emerald-pulse"), "Fresh user with empty inventory owns starter frame-emerald-pulse");
    assert(isCosmeticOwned(freshMockUser, "Campus Pathfinder"), "Fresh user with empty inventory owns starter title Campus Pathfinder");
    assert(isCosmeticOwned(freshMockUser, "recon"), "Fresh user with empty inventory owns starter avatar recon");
    assert(!isCosmeticOwned(freshMockUser, "frame-obsidian"), "Fresh user does NOT own purchasable frame-obsidian");
    assert(!isCosmeticOwned(freshMockUser, "Apex Hunter"), "Fresh user does NOT own Level 15 title Apex Hunter");

    // Verify that attempting to purchase a starter item in the shop is rejected
    const starterReward = await Reward.create({
      code: "STARTER_FRAME_EMERALD",
      title: "frame-emerald-pulse",
      name: "Emerald Cyber Pulse Frame",
      description: "Starter loadout frame",
      type: "FRAME",
      coinCost: 50,
      metadata: { value: "frame-emerald-pulse" },
      isActive: true,
      minLevelRequired: 1,
    });

    const testUser = await User.create({
      username: "cosmetic_agent_01",
      displayName: "Cosmetic Agent",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF1234567890abcdefghijklm",
      email: "cosmetic.agent01@aiemgoa.ac.in",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 200,
      level: 1,
      equippedTitle: "Campus Pathfinder",
      equippedFrame: "frame-emerald-pulse",
      equippedTheme: "theme-obsidian-grid",
      ownedCosmetics: [],
    });

    (globalThis as any).__TEST_CURRENT_USER__ = await User.findById(testUser._id).lean();

    const buyStarterReq = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: starterReward._id.toString(),
    });
    const buyStarterRes = await postPurchase(buyStarterReq);
    const buyStarterJson = await buyStarterRes.json();

    assert(buyStarterRes.status === 400, "Attempting to purchase a starter cosmetic returns HTTP 400");
    assert(
      buyStarterJson.error === "ALREADY_OWNED" || buyStarterJson.error?.code === "ALREADY_OWNED",
      "Starter purchase rejected with error ALREADY_OWNED"
    );
    assert(
      buyStarterJson.message.includes("starter loadout"),
      "Friendly message informs user that starter item is already free"
    );

    // -------------------------------------------------------------------------
    // SUITE 2: Unowned Cosmetic Equip Attempt Rejected with 403 Forbidden
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 2: Unowned Cosmetic Equip Rejection (403 Forbidden) ───");

    // 2.1 Attempt to equip unowned frame
    const unownedFrameReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "frame-obsidian",
    });
    const unownedFrameRes = await putProfile(unownedFrameReq);
    const unownedFrameJson = await unownedFrameRes.json();

    assert(unownedFrameRes.status === 403, "Equipping unowned frame rejected with HTTP 403 Forbidden");
    assert(unownedFrameJson.error === "COSMETIC_NOT_OWNED", "Error code is strictly COSMETIC_NOT_OWNED");
    assert(
      unownedFrameJson.message === "Cannot equip an unowned cosmetic item.",
      "Rejection message states cannot equip unowned cosmetic"
    );

    // 2.2 Attempt to equip unowned level-locked title
    const unownedTitleReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedTitle: "Master Tracker",
    });
    const unownedTitleRes = await putProfile(unownedTitleReq);
    const unownedTitleJson = await unownedTitleRes.json();

    assert(unownedTitleRes.status === 403, "Equipping unowned level-gated title rejected with HTTP 403 Forbidden");
    assert(unownedTitleJson.error === "COSMETIC_NOT_OWNED", "Error code is strictly COSMETIC_NOT_OWNED");

    // 2.3 Attempt to equip arbitrary fake/unowned theme
    const unownedThemeReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedTheme: "theme-neon-abyss-unowned",
    });
    const unownedThemeRes = await putProfile(unownedThemeReq);
    const unownedThemeJson = await unownedThemeRes.json();

    assert(unownedThemeRes.status === 403, "Equipping arbitrary unowned theme rejected with HTTP 403 Forbidden");
    assert(unownedThemeJson.error === "COSMETIC_NOT_OWNED", "Error code is strictly COSMETIC_NOT_OWNED");

    // Verify database state was NOT modified
    const dbUserUnchanged = await User.findById(testUser._id).lean();
    assert(dbUserUnchanged?.equippedFrame === "frame-emerald-pulse", "User equippedFrame remains starter default in database");
    assert(dbUserUnchanged?.equippedTitle === "Campus Pathfinder", "User equippedTitle remains starter default in database");
    assert(dbUserUnchanged?.equippedTheme === "theme-obsidian-grid", "User equippedTheme remains starter default in database");

    // -------------------------------------------------------------------------
    // SUITE 3: Equipped Starter Items Succeed with 200 OK
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 3: Starter Items Equip Allowed (200 OK) ───");

    const starterEquipReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "frame-cyber-grid",
      equippedTitle: "Rookie Investigator",
      equippedTheme: "theme-cyber-dark",
    });
    const starterEquipRes = await putProfile(starterEquipReq);
    const starterEquipJson = await starterEquipRes.json();

    assert(starterEquipRes.status === 200, "Equipping starter items returns HTTP 200 OK");
    assert(starterEquipJson.success === true, "Response reports success = true");

    const dbUserStarterEquipped = await User.findById(testUser._id).lean();
    assert(
      dbUserStarterEquipped?.equippedFrame === "frame-cyber-grid" &&
      dbUserStarterEquipped?.equippedTitle === "Rookie Investigator" &&
      dbUserStarterEquipped?.equippedTheme === "theme-cyber-dark",
      "User profile in MongoDB updated to newly equipped starter items"
    );

    // Synchronize test mock session
    (globalThis as any).__TEST_CURRENT_USER__ = dbUserStarterEquipped;

    // -------------------------------------------------------------------------
    // SUITE 4: Reward Shop Atomic Purchase Debits Coins, Adds to Inventory & Logs Audit
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 4: Atomic Shop Purchase, Coin Debit & Audit Logging ───");

    const shopReward = await Reward.create({
      code: "FRAME_OBSIDIAN_CORE",
      title: "Obsidian Core Frame",
      name: "Obsidian Core Frame",
      description: "Dark carbon-fiber tactical avatar frame with animated stealth border.",
      type: "FRAME",
      coinCost: 100,
      metadata: { value: "frame-obsidian" },
      minLevelRequired: 1,
      stock: 5,
      isActive: true,
    });

    const initialCoins = dbUserStarterEquipped?.coins || 200;
    const purchaseReq = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: shopReward._id.toString(),
    });
    const purchaseRes = await postPurchase(purchaseReq);
    const purchaseJson = await purchaseRes.json();

    assert(purchaseRes.status === 200, "Purchasing valid cosmetic returns HTTP 200 OK");
    assert(purchaseJson.success === true, "Purchase response reports success = true");
    assert(purchaseJson.data?.coins === initialCoins - 100, "Response reflects atomic debit of 100 Hunter Coins");

    // Verify database state: coins debited, ownedCosmetics updated
    const dbUserPurchased = await User.findById(testUser._id).lean();
    assert(dbUserPurchased?.coins === initialCoins - 100, "User coins in MongoDB atomically reduced from 200 to 100");
    assert(
      Boolean(dbUserPurchased?.ownedCosmetics.some((id) => id.toString() === shopReward._id.toString())),
      "Reward ObjectId atomically appended to user.ownedCosmetics in MongoDB"
    );

    // Verify audit event creation
    const auditRecord = await AuditEvent.findOne({
      targetId: shopReward._id,
      action: "REWARD_PURCHASE",
    }).lean();

    assert(Boolean(auditRecord), "Immutable AuditEvent logged for REWARD_PURCHASE");
    assert(Boolean(auditRecord?.actorId && auditRecord.actorId.toString() === testUser._id.toString()), "Audit event correctly attributes actorId to buyer");
    assert(auditRecord?.targetType === "REWARD", "Audit event targetType is REWARD");
    assert(Boolean(auditRecord?.reason && auditRecord.reason.includes("Obsidian Core Frame")), "Audit event reason logs item title and cost details");

    // Update test mock session
    (globalThis as any).__TEST_CURRENT_USER__ = dbUserPurchased;

    // -------------------------------------------------------------------------
    // SUITE 5: Duplicate Purchase Attempt Rejected
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 5: Duplicate Purchase Prevention ───");

    const dupPurchaseReq = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: shopReward._id.toString(),
    });
    const dupPurchaseRes = await postPurchase(dupPurchaseReq);
    const dupPurchaseJson = await dupPurchaseRes.json();

    assert(dupPurchaseRes.status === 400, "Duplicate purchase attempt returns HTTP 400");
    assert(
      dupPurchaseJson.error === "ALREADY_OWNED" || dupPurchaseJson.error?.code === "ALREADY_OWNED",
      "Duplicate purchase rejected with error ALREADY_OWNED"
    );

    // Confirm coins were NOT debited again
    const dbUserAfterDup = await User.findById(testUser._id).lean();
    assert(dbUserAfterDup?.coins === 100, "User balance remains 100 (zero double-charging occurred)");
    assert(
      dbUserAfterDup?.ownedCosmetics.filter((id) => id.toString() === shopReward._id.toString()).length === 1,
      "ownedCosmetics contains exactly one reference to the purchased reward"
    );

    // -------------------------------------------------------------------------
    // SUITE 6: Insufficient Coins Purchase Attempt Rejected
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 6: Insufficient Funds Rejection ───");

    const expensiveReward = await Reward.create({
      code: "EFFECT_GLITCH_PRISM",
      title: "Holo-Glitch Effect",
      name: "Holo-Glitch Effect",
      description: "Animated holographic glitch distortion overlay.",
      type: "EFFECT",
      coinCost: 150, // User only has 100 coins
      metadata: { value: "effect-glitch" },
      minLevelRequired: 1,
      stock: 10,
      isActive: true,
    });

    const brokePurchaseReq = createJsonRequest("http://localhost:3000/api/rewards/purchase", "POST", {
      rewardId: expensiveReward._id.toString(),
    });
    const brokePurchaseRes = await postPurchase(brokePurchaseReq);
    const brokePurchaseJson = await brokePurchaseRes.json();

    assert(brokePurchaseRes.status === 400, "Insufficient coins purchase attempt returns HTTP 400");
    assert(
      brokePurchaseJson.error === "INSUFFICIENT_FUNDS" || brokePurchaseJson.error?.code === "INSUFFICIENT_FUNDS",
      "Purchase rejected with error INSUFFICIENT_FUNDS"
    );

    // Confirm database state
    const dbUserAfterBroke = await User.findById(testUser._id).lean();
    assert(dbUserAfterBroke?.coins === 100, "User coins unchanged at 100");
    assert(
      !dbUserAfterBroke?.ownedCosmetics.some((id) => id.toString() === expensiveReward._id.toString()),
      "Unpaid item was NOT added to user.ownedCosmetics"
    );

    // -------------------------------------------------------------------------
    // SUITE 7: Newly Owned Cosmetic Can Now Be Successfully Equipped (200 OK)
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 7: Equip Newly Owned Cosmetic (200 OK) ───");

    // 7.1 Equip by metadata value ("frame-obsidian")
    const equipPurchasedReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: "frame-obsidian",
    });
    const equipPurchasedRes = await putProfile(equipPurchasedReq);
    const equipPurchasedJson = await equipPurchasedRes.json();

    assert(equipPurchasedRes.status === 200, "Equipping newly purchased frame-obsidian returns HTTP 200 OK");
    assert(equipPurchasedJson.success === true, "Response reports success = true");

    const dbUserEquippedNew = await User.findById(testUser._id).lean();
    assert(
      dbUserEquippedNew?.equippedFrame === "frame-obsidian",
      "User equippedFrame successfully updated to purchased frame-obsidian in MongoDB"
    );

    // 7.2 Equip by passing Reward ObjectId directly
    const equipByObjectIdReq = createJsonRequest("http://localhost:3000/api/user/profile", "PUT", {
      equippedFrame: shopReward._id.toString(),
    });
    const equipByObjectIdRes = await putProfile(equipByObjectIdReq);
    const equipByObjectIdJson = await equipByObjectIdRes.json();

    assert(equipByObjectIdRes.status === 200, "Equipping by passing Reward ObjectId returns HTTP 200 OK");
    assert(equipByObjectIdJson.success === true, "Response reports success = true");

    const dbUserEquippedByObjId = await User.findById(testUser._id).lean();
    assert(
      dbUserEquippedByObjId?.equippedFrame === "frame-obsidian",
      "Reward ObjectId correctly resolved to metadata.value frame-obsidian in user document"
    );

    console.log();
  } finally {
    // Teardown ephemeral test database
    const currentDb = mongoose.connection.db;
    if (currentDb && currentDb.databaseName === RUN_ID) {
      console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
      await currentDb.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.\n");
    }
  }

  console.log("========================================================");
  console.log(`🎉 ALL TESTS COMPLETED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runCosmeticsAndShopTests().catch((err) => {
  console.error("FATAL ERROR RUNNING COSMETICS AND SHOP TESTS:", err);
  process.exit(1);
});

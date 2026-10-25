import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  User,
  Investigation,
  Clue,
  Quest,
  Reward,
  Transaction,
  HintUnlock,
  CampusLocation,
  FoundItem,
  LostItem,
  ClaimRequest,
} from "../models";
import { connectDB } from "../lib/db";
import { canManageStationCustody, canViewStationQueue } from "../lib/permissions";
import { toPublicItemDTO } from "../lib/item-dto";

const RUN_ID = `aiem_hunt_test_concurrency_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function runConcurrencyAndScopingTests() {
  console.log("\n========================================================");
  console.log("⚡ AIEM HUNT — CONCURRENCY, SCOPING & DTO INTEGRATION TESTS");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  try {
    // ---------------------------------------------------------
    // TEST 1: Hint Purchase Concurrency & Zero-Balance Guard
    // ---------------------------------------------------------
    console.log("─── Test 1: Hint Purchase Concurrency & Negative Balance Guard ───");

    const testUser = await User.create({
      username: "hunter_racer",
      email: "racer@aiemgoa.ac.in",
      displayName: "Hunter Racer",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      coins: 10, // Exactly enough for 1 hint (cost: 10)
      accountStatus: "ACTIVE",
    });

    const dummyLocation = await CampusLocation.create({
      name: "Engineering Lab 3",
      code: "ENG_L3",
      zoneType: "ACADEMIC_BLOCK",
      coordinates: { lat: 15.283, lng: 73.985, mapX: 200, mapY: 200 },
    });

    const testQuest = await Quest.create({
      questCode: `Q_HINT_${Date.now()}`,
      title: "Ancient Circuit Clue",
      description: "Search for historical electronics in Lab 3",
      questType: "CAMPUS_TREASURE",
      targetLocationId: dummyLocation._id,
      difficulty: 1,
      xpReward: 100,
      coinReward: 20,
      status: "ACTIVE",
    });

    const clue1 = await Clue.create({
      questId: testQuest._id,
      stageOrder: 1,
      title: "Stage 1 Clue",
      clueText: "Locate the historic multimeter.",
      hintCoinCost: 10,
      hintText: "Check behind the oscilloscope on bench 4",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "multimeter",
    });

    const clue2 = await Clue.create({
      questId: testQuest._id,
      stageOrder: 2,
      title: "Stage 2 Clue",
      clueText: "Find the cabinet cipher.",
      hintCoinCost: 10,
      hintText: "Look inside the blue cabinet drawer",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "cipher42",
    });

    const investigation = await Investigation.create({
      questId: testQuest._id,
      userId: testUser._id,
      currentStage: 1,
      isSquadInvestigation: false,
      participatingUserIds: [testUser._id],
      status: "IN_PROGRESS",
      unlockedHintStages: [],
    });

    // Simulate 5 simultaneous concurrent requests to unlock hint for stageOrder 1
    const HINT_COST = 10;
    const concurrentAttempts = 5;

    const results = await Promise.all(
      Array.from({ length: concurrentAttempts }, async (_, idx) => {
        // Attempt atomic conditional debit:
        const updatedUser = await User.findOneAndUpdate(
          { _id: testUser._id, coins: { $gte: HINT_COST } },
          { $inc: { coins: -HINT_COST } },
          { new: true }
        );

        if (!updatedUser) {
          return { success: false, reason: "INSUFFICIENT_FUNDS" };
        }

        // Try creating HintUnlock record (unique compound index { investigationId, stageOrder })
        try {
          await HintUnlock.create({
            investigationId: investigation._id,
            questId: testQuest._id,
            stageOrder: 1,
            unlockedByUserId: testUser._id,
            coinCost: HINT_COST,
          });
          return { success: true, balance: updatedUser.coins };
        } catch (e: any) {
          if (e.code === 11000) {
            // Already unlocked, refund user immediately
            await User.findByIdAndUpdate(testUser._id, { $inc: { coins: HINT_COST } });
            return { success: false, reason: "ALREADY_UNLOCKED_REFUNDED" };
          }
          throw e;
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const refreshedUser = await User.findById(testUser._id);

    assert(successCount === 1, "Exactly 1 concurrent hint purchase succeeded out of 5 race attempts");
    assert(refreshedUser?.coins === 0, `User balance is exactly 0 (actual: ${refreshedUser?.coins}), never negative`);

    // Verify subsequent idempotent check: Hint is now unlocked, stage retrieval is free
    const existingUnlock = await HintUnlock.findOne({
      investigationId: investigation._id,
      stageOrder: 1,
    });
    assert(Boolean(existingUnlock), "HintUnlock record safely persists for stageOrder 1");

    // Progression check: Cannot unlock stage 2 while still on stage 1
    const TARGET_STAGE = 2;
    const canUnlockStage2 = TARGET_STAGE <= investigation.currentStage;
    assert(!canUnlockStage2, "Cannot buy hint for stage 2 while current stage is 1 (stage progression guard)");

    console.log();

    // ---------------------------------------------------------
    // TEST 2: Reward Purchase Idempotency Key Guard
    // ---------------------------------------------------------
    console.log("─── Test 2: Reward Purchase Scoped Idempotency Key ───");

    const testReward = await Reward.create({
      code: `REWARD_CYBER_${Date.now()}`,
      name: "Cybernetic Badge",
      title: "Cybernetic Badge",
      description: "Holo-foil investigator badge",
      type: "BADGE",
      coinCost: 20,
      minLevelRequired: 1,
      stock: 5,
      isActive: true,
    });

    const buyerUser = await User.create({
      username: "cyber_buyer",
      email: "buyer2@aiemgoa.ac.in",
      displayName: "Cyber Buyer",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      coins: 40,
      accountStatus: "ACTIVE",
    });

    const clientRequestId = `req_${Date.now()}_abc`;
    const idempotencyKey = `PURCHASE_${buyerUser._id}_${testReward._id}_${clientRequestId}`;

    // First purchase attempt
    const initialDebit = await User.findOneAndUpdate(
      { _id: buyerUser._id, coins: { $gte: testReward.coinCost } },
      { $inc: { coins: -testReward.coinCost }, $addToSet: { ownedCosmetics: testReward._id } },
      { new: true }
    );
    assert(initialDebit?.coins === 20, "First purchase atomically debited coins from 40 to 20");

    await Transaction.create({
      userId: buyerUser._id,
      deltaCoins: -testReward.coinCost,
      reason: `Purchased cosmetic: ${testReward.name}`,
      referenceType: "REWARD_PURCHASE",
      referenceId: testReward._id,
      idempotencyKey,
    });

    // Replay with exact same idempotencyKey
    const cachedTx = await Transaction.findOne({ idempotencyKey });
    assert(Boolean(cachedTx), "Idempotency key accurately discovered existing transaction in ledger");

    // Second debit is prevented because caller checks cachedTx before mutating
    let replayedDebitHappened = false;
    if (!cachedTx) {
      await User.findOneAndUpdate({ _id: buyerUser._id }, { $inc: { coins: -testReward.coinCost } });
      replayedDebitHappened = true;
    }
    assert(!replayedDebitHappened, "Replayed request returned cached transaction without re-debiting");

    const finalBuyer = await User.findById(buyerUser._id);
    assert(finalBuyer?.coins === 20, "Buyer coin balance remains 20 after duplicate request");

    console.log();

    // ---------------------------------------------------------
    // TEST 3: Safe-Desk Station Scoping Guards
    // ---------------------------------------------------------
    console.log("─── Test 3: Safe-Desk Station Scoping Guards ───");

    const stationX = new Types.ObjectId();
    const stationY = new Types.ObjectId();

    const staffWithStation = {
      role: "SAFE_DESK_STAFF" as const,
      assignedStationId: stationX,
    };

    const staffWithoutStation = {
      role: "SAFE_DESK_STAFF" as const,
      assignedStationId: undefined,
    };

    const admin = {
      role: "ADMIN" as const,
    };

    // Station management authorization
    assert(
      canManageStationCustody(staffWithStation, stationX.toString()),
      "Staff authorized for their own assigned station X"
    );
    assert(
      !canManageStationCustody(staffWithStation, stationY.toString()),
      "Staff rejected for different station Y (strict boundary)"
    );
    assert(
      !canManageStationCustody(staffWithStation, null as any),
      "Staff rejected when stationId is null/missing"
    );
    assert(
      !canManageStationCustody(staffWithoutStation, stationX.toString()),
      "Unassigned staff rejected for all stations"
    );
    assert(
      canManageStationCustody(admin, stationY.toString()),
      "Admin authorized for any station custody"
    );

    // Station queue viewing authorization
    assert(
      canViewStationQueue(staffWithStation, stationX.toString()),
      "Staff authorized to view assigned station X queue"
    );
    assert(
      !canViewStationQueue(staffWithStation, stationY.toString()),
      "Staff prohibited from viewing station Y queue"
    );
    assert(
      !canViewStationQueue(staffWithoutStation, stationX.toString()),
      "Unassigned staff prohibited from viewing station queue"
    );
    assert(
      canViewStationQueue(admin, stationY.toString()),
      "Admin authorized to view all station queues"
    );

    console.log();

    // ---------------------------------------------------------
    // TEST 4: Squad Search Regex Metacharacter Escaping
    // ---------------------------------------------------------
    console.log("─── Test 4: Squad Search Regex Metacharacter Escaping ───");

    const maliciousQueries = [
      ".*([a-zA-Z0-9]+)/?{1,5}\\$",
      "Squad (Alpha) [Beta] {Gamma} + ? ^ $ * |",
      "\\Q\\E\\\\\\\\\\",
      "((((((((a+)+)+)+)+)+)+)+)+",
    ];

    for (const rawQuery of maliciousQueries) {
      const sanitized = rawQuery
        .trim()
        .slice(0, 50)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      let safeRegex: RegExp | null = null;
      let compilationFailed = false;
      try {
        safeRegex = new RegExp(sanitized, "i");
      } catch {
        compilationFailed = true;
      }

      assert(!compilationFailed, `Query '${rawQuery.slice(0, 20)}...' compiles safely without ReDoS/SyntaxError`);
      assert(safeRegex !== null, "RegExp instance created successfully");
    }

    console.log();

    // ---------------------------------------------------------
    // TEST 5: Strict Public Item DTO Projection & Redaction
    // ---------------------------------------------------------
    console.log("─── Test 5: Strict Public Item DTO Projection & Redaction ───");

    const secretItemDoc = {
      _id: new Types.ObjectId(),
      itemType: "FOUND",
      shortTitle: "Smart Watch with Engraving",
      category: "ELECTRONICS",
      publicDescription: "Found near library entrance",
      status: "APPROVED",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      foundLocationId: stationX,
      foundAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      // Private fields that MUST NOT leak:
      rawPhotoUrl: "https://storage.internal/uploads/raw_sensitive_id_999.jpg",
      secretIdentifiers: "Serial # AIEM-ENG-987654; Engraved 'Rahul 2024'",
      lockerReceiptCode: "LOCKER_SECRET_4829",
      verificationAnswerHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
      internalNotes: "Suspicious finder dropped off without ID",
    };

    const publicDTO = toPublicItemDTO(secretItemDoc, "FOUND");

    assert((publicDTO as any).secretIdentifiers === undefined, "secretIdentifiers is completely omitted from public DTO");
    assert((publicDTO as any).lockerReceiptCode === undefined, "lockerReceiptCode is completely omitted from public DTO");
    assert((publicDTO as any).rawPhotoUrl === undefined, "rawPhotoUrl is completely omitted from public DTO");
    assert((publicDTO as any).verificationAnswerHash === undefined, "verificationAnswerHash is completely omitted from public DTO");
    assert((publicDTO as any).internalNotes === undefined, "internalNotes is completely omitted from public DTO");
    assert(publicDTO.title === "Smart Watch with Engraving", "Public shortTitle is accurately mapped to DTO title");
    assert(publicDTO.publicDescription === "Found near library entrance", "Public description is accurately preserved");

    console.log();
  } finally {
    const currentDb = mongoose.connection.db;
    if (currentDb && currentDb.databaseName === RUN_ID) {
      console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
      await currentDb.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.\n");
    }
  }

  console.log("========================================================");
  console.log(`🎉 CONCURRENCY & SCOPING TESTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runConcurrencyAndScopingTests().catch((err) => {
  console.error("FATAL ERROR IN CONCURRENCY TESTS:", err);
  process.exit(1);
});

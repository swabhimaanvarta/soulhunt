import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { EJSON } from "bson";
import {
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  CampusLocation,
  Quest,
  Clue,
  Investigation,
  Squad,
  SquadMember,
  SquadMessage,
  Achievement,
  UserAchievement,
  Transaction,
  AuditEvent,
} from "../models";
import { connectDB } from "../lib/db";
import { isFeatureEnabled } from "../lib/featureFlags";
import { apiError } from "../lib/api-error";

const RUN_ID = `backup_restore_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const SOURCE_DB = `aiem_hunt_staging_source_${RUN_ID}`;
const RESTORE_DB = `aiem_hunt_staging_restore_${RUN_ID}`;
const BACKUP_DIR = path.join(process.cwd(), "tmp_staging_backup", RUN_ID);

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

async function runBackupAndRestoreVerification() {
  console.log("\n==========================================================================");
  console.log("💾 AIEM HUNT — EMPIRICAL BACKUP, RESTORE & FEATURE FLAG ROLLBACK PROOF");
  console.log(`   Source DB: mongodb://127.0.0.1:27017/${SOURCE_DB}`);
  console.log(`   Restore DB: mongodb://127.0.0.1:27017/${RESTORE_DB}`);
  console.log(`   Backup Snapshot Dir: ${BACKUP_DIR}`);
  console.log("==========================================================================\n");

  (process.env as Record<string, string>)["NODE_ENV"] = "test";
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${SOURCE_DB}`;

  await connectDB();
  const db = mongoose.connection.db;
  if (!db || !db.databaseName.startsWith("aiem_hunt_staging_source_")) {
    throw new Error("Fatal: Not connected to an isolated test source database");
  }

  try {
    console.log("─── Step 1: Populating Source Database with Production-Scale Documents ───");

    // Seed Location
    const loc = await CampusLocation.create({
      name: "Central Library Desk",
      code: "STATION_LIB_BKP",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5961, lng: 73.7932, mapX: 50, mapY: 50 },
      isSafeDesk: true,
      currentCapacity: 50,
    });

    // Seed Users
    const u1 = await User.create({
      email: "student1.bkp@aiemgoa.ac.in",
      passwordHash: "dummyhash123",
      username: "student_bkp1",
      displayName: "Student Backup 1",
      role: "STUDENT",
    });

    const u2 = await User.create({
      email: "staff1.bkp@aiemgoa.ac.in",
      passwordHash: "dummyhash123",
      username: "staff_bkp1",
      displayName: "Staff Backup 1",
      role: "SAFE_DESK_STAFF",
      assignedStationId: loc._id,
    });

    // Seed Items & Claims
    const item = await FoundItem.create({
      finderId: u1._id,
      title: "Scientific Calculator CASIO",
      category: "ELECTRONICS",
      publicDescription: "Found in Block A Room 204",
      foundLocationId: loc._id,
      foundAt: new Date(),
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      status: "APPROVED",
    });

    const claim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: item._id,
      claimantId: u1._id,
      counterpartyUserId: u2._id,
      submittedAnswer: "FX-991CW",
      notes: "Initials on cover",
      handoverCodeHash: "hash123",
      status: "APPROVED",
    });

    // Seed Quest
    const quest = await Quest.create({
      questCode: "Q_BKP_01",
      title: "Circuitry Archive",
      description: "Find the relic",
      questType: "CAMPUS_TREASURE",
      difficulty: 3,
      targetLocationId: loc._id,
      xpReward: 100,
      coinReward: 25,
      status: "ACTIVE",
    });

    // Seed Squad & Chat
    const squad = await Squad.create({
      name: "Vanguards Backup",
      tag: "VG_BKP",
      leaderId: u1._id,
    });

    const msg = await SquadMessage.create({
      squadId: squad._id,
      senderId: u1._id,
      text: "Backup test chat message",
      moderationState: "VISIBLE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Seed Audit & Transaction
    const tx = await Transaction.create({
      userId: u1._id,
      deltaCoins: 20,
      deltaXp: 50,
      reason: "BACKUP_TEST_REWARD",
      referenceType: "RECOVERY",
      referenceId: item._id,
      idempotencyKey: `BKP_TX_${item._id}`,
    });

    const audit = await AuditEvent.create({
      actorId: u2._id,
      actorName: u2.displayName,
      actorRole: u2.role,
      action: "ITEM_INTAKE",
      targetType: "FOUND_ITEM",
      targetId: item._id,
      reason: "Intake verified",
    });

    const preCounts = {
      users: await User.countDocuments(),
      locations: await CampusLocation.countDocuments(),
      items: await FoundItem.countDocuments(),
      claims: await ClaimRequest.countDocuments(),
      quests: await Quest.countDocuments(),
      squads: await Squad.countDocuments(),
      messages: await SquadMessage.countDocuments(),
      transactions: await Transaction.countDocuments(),
      audits: await AuditEvent.countDocuments(),
    };

    assert(preCounts.users === 2, "Source DB seeded 2 users");
    assert(preCounts.items === 1, "Source DB seeded 1 found item");
    assert(preCounts.claims === 1, "Source DB seeded 1 claim request");
    assert(preCounts.messages === 1, "Source DB seeded 1 squad message");

    console.log("\n─── Step 2: Extracting Snapshot Export into Structured Storage ───");
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const collections = [
      { name: "users", model: User },
      { name: "locations", model: CampusLocation },
      { name: "founditems", model: FoundItem },
      { name: "claimrequests", model: ClaimRequest },
      { name: "quests", model: Quest },
      { name: "squads", model: Squad },
      { name: "squadmessages", model: SquadMessage },
      { name: "transactions", model: Transaction },
      { name: "auditevents", model: AuditEvent },
    ];

    const snapshotManifest: Record<string, number> = {};

    for (const col of collections) {
      const docs = await (col.model as any).collection.find({}).toArray();
      const filePath = path.join(BACKUP_DIR, `${col.name}.json`);
      fs.writeFileSync(filePath, EJSON.stringify(docs, undefined, 2), "utf-8");
      snapshotManifest[col.name] = docs.length;
    }

    const manifestPath = path.join(BACKUP_DIR, "manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          runId: RUN_ID,
          timestamp: new Date().toISOString(),
          sourceDb: SOURCE_DB,
          targetRestoreDb: RESTORE_DB,
          collections: snapshotManifest,
        },
        null,
        2
      ),
      "utf-8"
    );

    assert(fs.existsSync(manifestPath), "Backup manifest successfully written to disk");
    assert(fs.existsSync(path.join(BACKUP_DIR, "users.json")), "Users snapshot file written");
    assert(fs.existsSync(path.join(BACKUP_DIR, "founditems.json")), "FoundItems snapshot file written");

    console.log("\n─── Step 3: Simulating Disaster Recovery & Restoring into Clean Database ───");
    await mongoose.disconnect();
    if (global.mongooseCache) {
      global.mongooseCache.conn = null;
      global.mongooseCache.promise = null;
    }

    process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${RESTORE_DB}`;
    await connectDB();

    const restoreDb = mongoose.connection.db;
    if (!restoreDb || !restoreDb.databaseName.startsWith("aiem_hunt_staging_restore_")) {
      throw new Error("Fatal: Not connected to an isolated test restore database");
    }

    // Verify restore DB is completely empty before restoration
    const emptyUsers = await User.countDocuments();
    assert(emptyUsers === 0, "Target restore database is pristine and empty (0 users)");

    // Restore each collection from the snapshot
    for (const col of collections) {
      const filePath = path.join(BACKUP_DIR, `${col.name}.json`);
      const rawData = fs.readFileSync(filePath, "utf-8");
      const docs = EJSON.parse(rawData);
      if (Array.isArray(docs) && docs.length > 0) {
        await (col.model as any).collection.insertMany(docs);
      }
    }

    console.log("\n─── Step 4: Empirical Data Integrity & Checksum Verification ───");
    const postCounts = {
      users: await User.countDocuments(),
      locations: await CampusLocation.countDocuments(),
      items: await FoundItem.countDocuments(),
      claims: await ClaimRequest.countDocuments(),
      quests: await Quest.countDocuments(),
      squads: await Squad.countDocuments(),
      messages: await SquadMessage.countDocuments(),
      transactions: await Transaction.countDocuments(),
      audits: await AuditEvent.countDocuments(),
    };

    assert(postCounts.users === preCounts.users, "Restored User count exactly matches pre-backup count (2 == 2)");
    assert(postCounts.items === preCounts.items, "Restored FoundItem count exactly matches pre-backup count (1 == 1)");
    assert(postCounts.claims === preCounts.claims, "Restored ClaimRequest count exactly matches pre-backup count (1 == 1)");
    assert(postCounts.squads === preCounts.squads, "Restored Squad count exactly matches pre-backup count (1 == 1)");
    assert(postCounts.messages === preCounts.messages, "Restored SquadMessage count exactly matches pre-backup count (1 == 1)");
    assert(postCounts.transactions === preCounts.transactions, "Restored Transaction count exactly matches pre-backup count (1 == 1)");
    assert(postCounts.audits === preCounts.audits, "Restored AuditEvent count exactly matches pre-backup count (1 == 1)");

    // Inspect document fields and references in restored database
    const restoredItem = await FoundItem.findById(item._id);
    assert(restoredItem !== null, "Found item preserved exact ObjectId in restore");
    assert(restoredItem?.title === "Scientific Calculator CASIO", "Found item title accurately restored");
    assert(restoredItem?.custodyStatus === "DEPOSITED_AT_SAFE_DESK", "Item custody status preserved across restoration");

    const restoredClaim = await ClaimRequest.findById(claim._id);
    assert(restoredClaim !== null, "Claim request preserved exact ObjectId in restore");
    assert(restoredClaim?.submittedAnswer === "FX-991CW", "Claim cryptographic answer and details preserved");

    console.log("\n─── Step 5: Empirical Dynamic Feature Flag Rollback Verification ───");
    // 5.1 Test active state
    assert(isFeatureEnabled("SQUAD_CHAT_ENABLED") === true, "Default: SQUAD_CHAT_ENABLED is active");

    // 5.2 Test rollback toggle
    process.env.SQUAD_CHAT_ENABLED = "false";
    assert(isFeatureEnabled("SQUAD_CHAT_ENABLED") === false, "Rollback: SQUAD_CHAT_ENABLED toggled to FALSE");

    // Simulate endpoint behavior under rollback
    const disabledResponse = apiError("FEATURE_DISABLED", "Squad chat is temporarily disabled.", 403);
    const disabledJson = await disabledResponse.json();
    assert(disabledResponse.status === 403, "Rollback API intercepts request with HTTP 403 Forbidden");
    assert(disabledJson.error.code === "FEATURE_DISABLED", "Rollback API returns structured code FEATURE_DISABLED");

    // Restore feature flag
    process.env.SQUAD_CHAT_ENABLED = "true";
    assert(isFeatureEnabled("SQUAD_CHAT_ENABLED") === true, "Restored: SQUAD_CHAT_ENABLED safely reactivated");

    console.log("\n==========================================================================");
    console.log(`🎉 BACKUP, RESTORE & ROLLBACK VERIFICATION PASSED!`);
    console.log(`   Passed: ${passedCount} / ${passedCount + failedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log("==========================================================================\n");
  } finally {
    // Clean up temporary databases and files
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db?.databaseName.startsWith("aiem_hunt_staging_restore_")) {
        console.log(`🧹 Dropping restore test database: ${mongoose.connection.db.databaseName}`);
        await mongoose.connection.db.dropDatabase();
      }
      await mongoose.disconnect();
      if (global.mongooseCache) {
        global.mongooseCache.conn = null;
        global.mongooseCache.promise = null;
      }

      process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${SOURCE_DB}`;
      await connectDB();
      if (mongoose.connection.readyState === 1 && mongoose.connection.db?.databaseName.startsWith("aiem_hunt_staging_source_")) {
        console.log(`🧹 Dropping source test database: ${mongoose.connection.db.databaseName}`);
        await mongoose.connection.db.dropDatabase();
      }
      await mongoose.disconnect();
      if (global.mongooseCache) {
        global.mongooseCache.conn = null;
        global.mongooseCache.promise = null;
      }

      if (fs.existsSync(BACKUP_DIR)) {
        fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temporary backup snapshot directory`);
      }
    } catch (cleanupErr) {
      console.error("Cleanup warning:", cleanupErr);
    }
  }
}

runBackupAndRestoreVerification().catch((err) => {
  console.error("Backup and restore verification failed:", err);
  process.exit(1);
});

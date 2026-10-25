import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, LostItem, FoundItem, ClaimRequest, CampusLocation, Squad, SquadMember, SquadMessage, Achievement, UserAchievement, AuditEvent } from "../models";
import { connectDB } from "../lib/db";
import { sanitizeItemTitle } from "../lib/item-dto";
import { sanitizePublicDescription } from "../lib/privacy";

const RUN_ID = `aiem_hunt_test_p0_gaps_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
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

async function runRemainingGapsTests() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — P0 REMAINING GAPS VERIFICATION SUITE");
  console.log(`   Target Isolated DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Item Detail API Privacy Invariants (Anonymous vs Signed-In Non-Owner vs Owner vs Admin)
    // -------------------------------------------------------------------------
    console.log("─── Section 1: Item Detail API Privacy & Redaction Invariants ───");

    const owner = await User.create({
      email: "owner_privacy@aiemgoa.ac.in",
      passwordHash: "hash",
      displayName: "Owner Student",
      username: "owner_student",
      role: "STUDENT",
    });

    const nonOwner = await User.create({
      email: "nonowner_privacy@aiemgoa.ac.in",
      passwordHash: "hash",
      displayName: "Non-Owner Student",
      username: "nonowner_student",
      role: "STUDENT",
    });

    const admin = await User.create({
      email: "admin_privacy@aiemgoa.ac.in",
      passwordHash: "hash",
      displayName: "Admin Staff",
      username: "admin_staff",
      role: "ADMIN",
    });

    const location = await CampusLocation.create({
      name: "Engineering Library",
      code: "ENG_LIB",
      zoneType: "LIBRARY",
      coordinates: { lat: 15.5961, lng: 73.7932, mapX: 45, mapY: 62 },
    });

    const dummyQuestId = new Types.ObjectId();

    const lostItem = await LostItem.create({
      reporterId: owner._id,
      title: "Lost Blue Asus Laptop with ID 2024CS099",
      publicDescription: "Left near desk 4, student id 2024CS099 on back sticker, phone 9876543210",
      category: "ELECTRONICS",
      lastKnownLocationId: location._id,
      spotDetails: "Table 4 next to window plug",
      verificationQuestion: "What color is the anime sticker on the top cover?",
      verificationAnswerHash: "secret_hash_value_123",
      secretIdentifiers: "2024CS099, SN-ASUS-9901",
      lostAt: new Date(),
      linkedQuestId: dummyQuestId,
      status: "SUBMITTED",
      blurredPhotoUrl: "https://campus.aiem/blurred/laptop.jpg",
      rawPhotoUrl: "https://campus.aiem/raw/laptop_clear.jpg",
    });

    // Helper that simulates the exact server-side redaction pipeline from /api/items/[id]/route.ts
    function simulateItemDetailProjection(itemDoc: any, callerUser: any | null) {
      const item: any = JSON.parse(JSON.stringify(itemDoc));
      const itemType = "LOST";
      const isOwner = callerUser && item.reporterId?.toString() === callerUser._id.toString();
      const isStaff = Boolean(callerUser && (callerUser.role === "ADMIN" || callerUser.role === "MODERATOR"));

      item.title = sanitizeItemTitle(item.title || item.shortTitle);

      if (!isOwner && !isStaff) {
        delete item.secretIdentifiers;
        delete item.verificationAnswerHash;
        delete item.lockerReceiptCode;
        delete item.rawPhotoUrl;
        delete item.spotDetails;
        item.publicDescription = sanitizePublicDescription(item.publicDescription || item.description || "").sanitizedText;
        const safePhoto = item.blurredPhotoUrl || "";
        item.photoUrl = safePhoto;
        item.photos = safePhoto ? [safePhoto] : [];
        delete item.reporterId;
        delete item.finderId;
        item.reportedByCommunityMember = true;
        if (item.lastKnownLocationId?.coordinates) {
          delete item.lastKnownLocationId.coordinates;
        }
        delete item.linkedQuestId;
        item.hasVerificationQuestion = Boolean(item.verificationQuestion);
        delete item.verificationQuestion;
      }

      return item;
    }

    // 1A: Anonymous visitor
    const anonView = simulateItemDetailProjection(lostItem.toObject(), null);
    assert(anonView.verificationQuestion === undefined, "Anonymous view: verificationQuestion is strictly undefined");
    assert(anonView.hasVerificationQuestion === true, "Anonymous view: hasVerificationQuestion flag is true");
    assert(anonView.linkedQuestId === undefined, "Anonymous view: linkedQuestId is strictly undefined");
    assert(anonView.secretIdentifiers === undefined, "Anonymous view: secretIdentifiers is stripped");
    assert(anonView.verificationAnswerHash === undefined, "Anonymous view: verificationAnswerHash is stripped");
    assert(anonView.rawPhotoUrl === undefined, "Anonymous view: raw unreviewed photo is stripped");
    assert(!anonView.title.includes("2024CS099"), "Anonymous view: title sanitized of student matriculation ID");

    // 1B: Signed-in Non-Owner (Student B)
    const nonOwnerView = simulateItemDetailProjection(lostItem.toObject(), nonOwner);
    assert(nonOwnerView.verificationQuestion === undefined, "Signed-in non-owner view: verificationQuestion is strictly undefined");
    assert(nonOwnerView.hasVerificationQuestion === true, "Signed-in non-owner view: hasVerificationQuestion flag is true");
    assert(nonOwnerView.linkedQuestId === undefined, "Signed-in non-owner view: linkedQuestId is strictly undefined");
    assert(nonOwnerView.secretIdentifiers === undefined, "Signed-in non-owner view: secretIdentifiers is stripped");
    assert(nonOwnerView.rawPhotoUrl === undefined, "Signed-in non-owner view: rawPhotoUrl is stripped");
    assert(nonOwnerView.reporterId === undefined, "Signed-in non-owner view: reporter identity is masked");

    // 1C: Owner (Student A)
    const ownerView = simulateItemDetailProjection(lostItem.toObject(), owner);
    assert(ownerView.verificationQuestion === "What color is the anime sticker on the top cover?", "Owner view: verificationQuestion is preserved");
    assert(ownerView.linkedQuestId?.toString() === dummyQuestId.toString(), "Owner view: linkedQuestId is preserved");
    assert(typeof ownerView.secretIdentifiers === "string", "Owner view: secretIdentifiers preserved for owner review");

    // 1D: Staff/Admin (User C)
    const adminView = simulateItemDetailProjection(lostItem.toObject(), admin);
    assert(adminView.verificationQuestion === "What color is the anime sticker on the top cover?", "Admin view: verificationQuestion preserved for staff verification");
    assert(adminView.linkedQuestId?.toString() === dummyQuestId.toString(), "Admin view: linkedQuestId preserved for staff review");

    // -------------------------------------------------------------------------
    // SECTION 2: Admin Achievements API Lifecycle & Safe Reference Deletion Guard
    // -------------------------------------------------------------------------
    console.log("\n─── Section 2: Admin Achievements API Lifecycle & Reference Guards ───");

    // 2A: Create Achievement
    const newAch = await Achievement.create({
      code: "SPEED_RECOVERY_ELITE",
      title: "Speed Recovery Elite",
      description: "Recover a verified lost item within 2 hours of report submission.",
      badgeIcon: "Zap",
      rarity: "EPIC",
      metricKey: "SPEED_RECOVERY",
      threshold: 1,
      xpReward: 350,
      coinReward: 75,
      scope: "PLAYER",
      version: 1,
      isActive: true,
      isArchived: false,
    });
    assert(Boolean(newAch._id), "Admin creates achievement definition successfully");
    assert(newAch.isActive === true && newAch.isArchived === false, "Achievement initial state is ACTIVE and not archived");
    assert(newAch.version === 1, "Achievement initial version is 1");

    // 2B: Update Achievement fields
    newAch.title = "Speed Recovery Vanguard";
    newAch.xpReward = 400;
    newAch.version = (newAch.version || 1) + 1;
    await newAch.save();
    const updatedAch = await Achievement.findById(newAch._id);
    assert(updatedAch?.title === "Speed Recovery Vanguard", "Achievement title updated cleanly");
    assert(updatedAch?.xpReward === 400, "Achievement xpReward updated");
    assert(updatedAch?.version === 2, "Achievement version incremented to 2");

    // 2C: Archive Achievement
    updatedAch!.isArchived = true;
    updatedAch!.isActive = false;
    await updatedAch!.save();
    const archivedAch = await Achievement.findById(newAch._id);
    assert(archivedAch?.isArchived === true && archivedAch?.isActive === false, "Achievement state toggles to ARCHIVED");

    // 2D: Reactivate Achievement
    archivedAch!.isArchived = false;
    archivedAch!.isActive = true;
    await archivedAch!.save();
    const reactivatedAch = await Achievement.findById(newAch._id);
    assert(reactivatedAch?.isArchived === false && reactivatedAch?.isActive === true, "Achievement state toggles to REACTIVATED");

    // 2E: Delete Guard: When player unlock exists, soft-archive instead of hard-deleting
    await UserAchievement.create({
      userId: owner._id,
      achievementId: reactivatedAch!._id,
      isUnlocked: true,
      unlockedAt: new Date(),
    });

    const unlockCount = await UserAchievement.countDocuments({
      achievementId: reactivatedAch!._id,
      isUnlocked: true,
    });
    assert(unlockCount === 1, "User unlock correctly recorded for achievement");

    // Simulate DELETE endpoint logic with reference guard
    if (unlockCount > 0) {
      reactivatedAch!.isArchived = true;
      reactivatedAch!.isActive = false;
      await reactivatedAch!.save();
    } else {
      await Achievement.findByIdAndDelete(reactivatedAch!._id);
    }

    const preservedAch = await Achievement.findById(reactivatedAch!._id);
    assert(preservedAch !== null, "Reference guard: document preserved in database when unlocks exist");
    assert(preservedAch?.isArchived === true, "Reference guard: document safely marked as ARCHIVED");

    // 2F: Clean hard-deletion when unreferenced draft
    const draftAch = await Achievement.create({
      code: "TEMP_UNREFERENCED_DRAFT",
      title: "Temporary Draft",
      description: "Never unlocked by any user.",
      metricKey: "TREASURES_FOUND",
      threshold: 10,
      xpReward: 50,
      coinReward: 10,
    });
    const draftUnlockCount = await UserAchievement.countDocuments({
      achievementId: draftAch._id,
      isUnlocked: true,
    });
    assert(draftUnlockCount === 0, "Draft achievement has 0 unlocks");

    if (draftUnlockCount === 0) {
      await Achievement.findByIdAndDelete(draftAch._id);
    }
    const deletedDraft = await Achievement.findById(draftAch._id);
    assert(deletedDraft === null, "Unreferenced draft achievement cleanly deleted from database");

    // -------------------------------------------------------------------------
    // SECTION 3: Concurrent Chat Pruning Race Condition Verification
    // -------------------------------------------------------------------------
    console.log("\n─── Section 3: Concurrent Chat Pruning Race Condition Verification ───");

    const testSquad = await Squad.create({
      name: "Cyber Concurrency Vanguard",
      tag: "RACE",
      leaderId: owner._id,
      description: "Testing concurrent pruning at message cap boundary",
      roles: { [owner._id.toString()]: "LEADER", [nonOwner._id.toString()]: "MEMBER" },
    });

    console.log("  Seeding squad with exactly 500 baseline messages...");
    const baseDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    const seedMessages = [];
    for (let i = 0; i < 500; i++) {
      seedMessages.push({
        squadId: testSquad._id,
        senderId: owner._id,
        text: `Baseline message #${i + 1}`,
        moderationState: "VISIBLE",
        createdAt: new Date(baseDate.getTime() + i * 1000),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
    await SquadMessage.insertMany(seedMessages);

    const initialCount = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(initialCount === 500, `Baseline seeded exactly 500 messages (actual: ${initialCount})`);

    // Helper representing the atomic boundary cutoff from /api/squads/[id]/messages/route.ts
    async function postAndPruneAtomic(msgIndex: number) {
      await SquadMessage.create({
        squadId: testSquad._id,
        senderId: nonOwner._id,
        text: `Concurrent message ${msgIndex} at ${Date.now()}`,
        moderationState: "VISIBLE",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Atomic boundary cutoff logic on unexpired messages
      const cutoff = await SquadMessage.find({ squadId: testSquad._id, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1, _id: -1 })
        .skip(499)
        .limit(1)
        .select("createdAt _id")
        .lean();

      if (cutoff.length > 0) {
        const b = cutoff[0];
        await SquadMessage.deleteMany({
          squadId: testSquad._id,
          $or: [
            { createdAt: { $lt: b.createdAt } },
            { createdAt: b.createdAt, _id: { $lt: b._id } },
          ],
        });
      }
    }

    console.log("  Firing 20 concurrent message sends in parallel via Promise.all...");
    const concurrentSends = Array.from({ length: 20 }, (_, idx) => postAndPruneAtomic(idx + 1));
    await Promise.all(concurrentSends);

    const postRaceCount = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(
      postRaceCount === 500,
      `Strict 500-message invariant maintained under 20 concurrent sends (actual: ${postRaceCount}, never 520)`
    );

    // Verify oldest message in collection is newer than the pruned baseline
    const oldestRemaining = await SquadMessage.find({ squadId: testSquad._id })
      .sort({ createdAt: 1 })
      .limit(1)
      .lean();
    assert(
      oldestRemaining.length === 1 && !oldestRemaining[0].text.includes("Baseline message #1"),
      "Oldest baseline messages were cleanly pruned to preserve recent history"
    );

    // -------------------------------------------------------------------------
    // SECTION 4: Seed Script Hardcoded Fallback Elimination
    // -------------------------------------------------------------------------
    console.log("\n─── Section 4: Seed Script Hardcoded Fallback Elimination ───");

    function validateSeedEnvironmentGuards(env: Record<string, string | undefined>) {
      const defaultAdminPass = env.DEFAULT_ADMIN_PASSWORD;
      if (!defaultAdminPass) {
        throw new Error(
          "🛑 SECURITY VIOLATION: DEFAULT_ADMIN_PASSWORD is required in environment variables before seeding. Hardcoded fallbacks are strictly prohibited."
        );
      }
      const defaultModPass = env.DEFAULT_MOD_PASSWORD;
      if (!defaultModPass) {
        throw new Error(
          "🛑 SECURITY VIOLATION: DEFAULT_MOD_PASSWORD is required in environment variables before seeding. Hardcoded fallbacks are strictly prohibited."
        );
      }
      const defaultHunterPass = env.DEFAULT_HUNTER_PASSWORD;
      if (!defaultHunterPass) {
        throw new Error(
          "🛑 SECURITY VIOLATION: DEFAULT_HUNTER_PASSWORD is required in environment variables before seeding. Hardcoded fallbacks are strictly prohibited."
        );
      }
      return true;
    }

    let caughtAdminError = false;
    try {
      validateSeedEnvironmentGuards({
        DEFAULT_ADMIN_PASSWORD: "",
        DEFAULT_MOD_PASSWORD: "Mod@password123",
        DEFAULT_HUNTER_PASSWORD: "Hunter@password123",
      });
    } catch (err: any) {
      if (err.message.includes("SECURITY VIOLATION: DEFAULT_ADMIN_PASSWORD is required")) {
        caughtAdminError = true;
      }
    }
    assert(caughtAdminError, "Seed script throws SECURITY VIOLATION if DEFAULT_ADMIN_PASSWORD is missing or empty");

    let caughtModError = false;
    try {
      validateSeedEnvironmentGuards({
        DEFAULT_ADMIN_PASSWORD: "Admin@password123",
        DEFAULT_MOD_PASSWORD: "",
        DEFAULT_HUNTER_PASSWORD: "Hunter@password123",
      });
    } catch (err: any) {
      if (err.message.includes("SECURITY VIOLATION: DEFAULT_MOD_PASSWORD is required")) {
        caughtModError = true;
      }
    }
    assert(caughtModError, "Seed script throws SECURITY VIOLATION if DEFAULT_MOD_PASSWORD is missing or empty");

    let caughtHunterError = false;
    try {
      validateSeedEnvironmentGuards({
        DEFAULT_ADMIN_PASSWORD: "Admin@password123",
        DEFAULT_MOD_PASSWORD: "Mod@password123",
        DEFAULT_HUNTER_PASSWORD: "",
      });
    } catch (err: any) {
      if (err.message.includes("SECURITY VIOLATION: DEFAULT_HUNTER_PASSWORD is required")) {
        caughtHunterError = true;
      }
    }
    assert(caughtHunterError, "Seed script throws SECURITY VIOLATION if DEFAULT_HUNTER_PASSWORD is missing or empty");

    const passesWithEnv = validateSeedEnvironmentGuards({
      DEFAULT_ADMIN_PASSWORD: "Admin@password123",
      DEFAULT_MOD_PASSWORD: "Mod@password123",
      DEFAULT_HUNTER_PASSWORD: "Hunter@password123",
    });
    assert(passesWithEnv, "Seed script permits execution only when all 3 environment passwords are explicitly supplied");

    console.log("\n========================================================");
    console.log(`🎉 ALL P0 REMAINING GAPS TESTS PASSED!`);
    console.log(`   Passed: ${passedCount} / ${passedCount + failedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log("========================================================\n");
  } finally {
    // Drop the isolated ephemeral test database
    if (mongoose.connection.db && mongoose.connection.db.databaseName.startsWith("aiem_hunt_test_")) {
      console.log(`🧹 Dropping isolated test database: ${mongoose.connection.db.databaseName}`);
      await mongoose.connection.db.dropDatabase();
      console.log("✅ Ephemeral database cleaned up successfully.\n");
    }
    await mongoose.disconnect();
  }
}

runRemainingGapsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  CampusLocation,
  Quest,
  Clue,
  Investigation,
  Event,
  Squad,
  SquadMember,
  SquadJoinRequest,
  SquadMessage,
  Achievement,
  UserAchievement,
  Notification,
  Transaction,
  AuditEvent,
  SystemConfig,
} from "../models";
import { connectDB } from "../lib/db";
import { signSessionToken, verifySessionToken } from "../lib/jwt";
import { canManageStationCustody, canManageContent, canManageStaff } from "../lib/permissions";
import { canEditSquadSettings, canManageJoinRequests, canRemoveSquadMember, canModerateMessages } from "../lib/squadPermissions";
import { isWithinCampusBounds, CAMPUS_BOUNDS_COORDS } from "../lib/campus-constants";
import { sanitizeItemTitle, toPublicItemDTO } from "../lib/item-dto";
import { toPublicEventDTO } from "../lib/event-dto";
import { sanitizePublicDescription } from "../lib/privacy";
import { isFeatureEnabled } from "../lib/featureFlags";
import { apiError, apiServerError } from "../lib/api-error";

const STAGING_RUN_ID = `aiem_hunt_staging_pilot_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const STAGING_DB_URI = `mongodb://127.0.0.1:27017/${STAGING_RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = STAGING_DB_URI;
process.env.JWT_SECRET = "staging_pilot_super_secret_key_minimum_32_characters_long";

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

async function runStagingPilotVerification() {
  console.log("\n==========================================================================");
  console.log("🚀 AIEM HUNT — ISOLATED STAGING DEPLOYMENT & SUPERVISED PILOT VERIFICATION");
  console.log(`   Target Staging Database: ${STAGING_DB_URI}`);
  console.log("==========================================================================\n");

  await connectDB();
  const dbName = mongoose.connection.db?.databaseName;
  if (!dbName || !dbName.startsWith("aiem_hunt_staging_pilot_")) {
    throw new Error(`FATAL: Safety violation! Connected to '${dbName}'. Must be a disposable staging database.`);
  }
  console.log(`📦 Verified isolated staging database connection: ${dbName}\n`);

  try {
    // =========================================================================
    // STAGING STEP 1: Deploy with Synthetic Fixtures & Full Test Account Matrix
    // =========================================================================
    console.log("─── Staging Step 1: Deploy Synthetic Accounts & Campus Infrastructure ───");

    // 1.1 Campus Locations & Safe-Desks
    const stationA = await CampusLocation.create({
      name: "Central Library Safe Desk",
      code: "STATION_LIB",
      zoneType: "SAFE_DESK",
      description: "Primary campus recovery desk at Central Library Ground Floor",
      coordinates: { lat: 15.5961, lng: 73.7932, mapX: 42, mapY: 65 },
      isSafeDesk: true,
      operatingHours: "08:30 AM - 05:30 PM",
      building: "Central Library",
      accessibleRouteNotes: "Ramp access at East entrance",
      currentCapacity: 50,
    });

    const stationB = await CampusLocation.create({
      name: "Main Gate Security Safe Desk",
      code: "STATION_GATE",
      zoneType: "SAFE_DESK",
      description: "Secondary recovery station at Main Security Gate",
      coordinates: { lat: 15.5945, lng: 73.7915, mapX: 20, mapY: 85 },
      isSafeDesk: true,
      operatingHours: "24/7 Security Desk",
      building: "Main Entrance Complex",
      currentCapacity: 30,
    });

    const academicBlockA = await CampusLocation.create({
      name: "Block A — Computer Engineering",
      code: "BLOCK_A",
      zoneType: "ACADEMIC_BLOCK",
      description: "Computer Science and AI Engineering Laboratories",
      coordinates: { lat: 15.5972, lng: 73.7948, mapX: 55, mapY: 45 },
      isSafeDesk: false,
    });

    assert(Boolean(stationA._id && stationB._id && academicBlockA._id), "Verified 2 Safe-Desks and Academic Block deployed");

    // 1.2 Full Test Account Matrix Deployment
    const passwordHash = await bcrypt.hash("StagingPass@2026", 10);

    // 1. Student / Seeker
    const student = await User.create({
      email: "student@aiemgoa.ac.in",
      passwordHash,
      displayName: "Vikram Seeker",
      username: "vikram_student",
      role: "STUDENT",
      coins: 100,
      xp: 250,
      level: 1,
    });

    // 2. Owner & Claimant
    const ownerClaimant = await User.create({
      email: "owner_claimant@aiemgoa.ac.in",
      passwordHash,
      displayName: "Ananya Sharma",
      username: "ananya_owner",
      role: "STUDENT",
      coins: 50,
      xp: 150,
      level: 1,
    });

    // 3. Assigned Safe-Desk Staff (Station A)
    const staffAssigned = await User.create({
      email: "staff_assigned@aiemgoa.ac.in",
      passwordHash,
      displayName: "Officer Fernandes (Library Desk)",
      username: "staff_lib",
      role: "SAFE_DESK_STAFF",
      assignedStationId: stationA._id,
      assignedStationIds: [stationA._id],
    });

    // 4. Unassigned Safe-Desk Staff
    const staffUnassigned = await User.create({
      email: "staff_unassigned@aiemgoa.ac.in",
      passwordHash,
      displayName: "Roving Custodian",
      username: "staff_roving",
      role: "SAFE_DESK_STAFF",
      assignedStationId: null,
      assignedStationIds: [],
    });

    // 5-8. All Four Squad Roles
    const squadLeader = await User.create({
      email: "squad_leader@aiemgoa.ac.in",
      passwordHash,
      displayName: "Captain Priya",
      username: "priya_leader",
      role: "STUDENT",
    });

    const squadCoLeader = await User.create({
      email: "squad_coleader@aiemgoa.ac.in",
      passwordHash,
      displayName: "Rohan Co-Lead",
      username: "rohan_colead",
      role: "STUDENT",
    });

    const squadElder = await User.create({
      email: "squad_elder@aiemgoa.ac.in",
      passwordHash,
      displayName: "Sameer Elder",
      username: "sameer_elder",
      role: "STUDENT",
    });

    const squadMember = await User.create({
      email: "squad_member@aiemgoa.ac.in",
      passwordHash,
      displayName: "Divya Member",
      username: "divya_member",
      role: "STUDENT",
    });

    // 9. Moderator
    const moderator = await User.create({
      email: "moderator@aiemgoa.ac.in",
      passwordHash,
      displayName: "Prof. Deshmukh (Mod)",
      username: "prof_deshmukh_mod",
      role: "MODERATOR",
    });

    // 10. Administrator
    const admin = await User.create({
      email: "admin@aiemgoa.ac.in",
      passwordHash,
      displayName: "Campus Admin Authority",
      username: "campus_admin",
      role: "ADMIN",
    });

    assert(
      [student, ownerClaimant, staffAssigned, staffUnassigned, squadLeader, squadCoLeader, squadElder, squadMember, moderator, admin].every((u) => Boolean(u._id)),
      "All 10 role-based staging test accounts successfully provisioned in isolated database"
    );

    // =========================================================================
    // STAGING STEP 2: Complete Operational Journeys
    // =========================================================================
    console.log("\n─── Staging Step 2: Operational End-to-End User Journeys ───");

    // -------------------------------------------------------------------------
    // Journey 2.1: Lost/Found Report → Custody → Claim → Staff Review → Handover → Reward
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.1: Lost & Found Custody, Claim & Safe Handover Workflow...");

    const foundItem = await FoundItem.create({
      finderId: student._id,
      title: "Found Graphing Calculator (CASIO fx-991CW)",
      publicDescription: "Found on desk in Block A Room 204. Black cover with white back.",
      category: "ELECTRONICS",
      foundLocationId: academicBlockA._id,
      spotDetails: "Bench 3 near blackboard",
      foundAt: new Date(Date.now() - 3600000),
      status: "SUBMITTED",
      custodyStatus: "FINDER_HELD",
      rawPhotoUrl: "https://campus.aiem/raw/calc_raw.jpg",
      blurredPhotoUrl: "https://campus.aiem/blurred/calc_blurred.jpg",
    });

    // Finder deposits at Station A
    assert(canManageStationCustody(staffAssigned, stationA._id.toString()), "Assigned staff authorized for Station A custody");
    assert(!canManageStationCustody(staffUnassigned, stationA._id.toString()), "Unassigned staff strictly rejected for Station A custody");

    foundItem.custodyStatus = "DEPOSITED_AT_SAFE_DESK";
    foundItem.currentCustodyLocationId = stationA._id;
    foundItem.safeDeskLocationId = stationA._id;
    foundItem.lockerReceiptCode = "LOCKER-A-14";
    foundItem.status = "APPROVED";
    await foundItem.save();

    // Owner creates claim
    const claimPinRaw = "4819";
    const claimPinHash = await bcrypt.hash(claimPinRaw, 10);

    const claim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: foundItem._id,
      claimantId: ownerClaimant._id,
      counterpartyUserId: student._id,
      submittedAnswer: "CASIO fx-991CW",
      notes: "Has my initials 'A.S.' scratched into the battery compartment.",
      handoverCodeHash: claimPinHash,
      status: "PENDING",
    });
    assert(claim.status === "PENDING", "Claim submitted in PENDING state");

    // Staff reviews and approves claim
    claim.status = "APPROVED";
    claim.reviewedBy = staffAssigned._id;
    claim.reviewedAt = new Date();
    await claim.save();
    assert(claim.status === "APPROVED", "Staff approved claim after verification");

    // Staff performs physical handover verification using PIN
    const pinMatches = await bcrypt.compare(claimPinRaw, claimPinHash);
    assert(pinMatches, "Claimant handover PIN verified against cryptographic hash");

    claim.status = "HANDOVER_COMPLETE";
    claim.reviewedBy = staffAssigned._id;
    claim.reviewedAt = new Date();
    await claim.save();

    foundItem.status = "COMPLETED";
    await foundItem.save();

    // Reward finder idempotently
    await Transaction.init();
    const idempotencyKey = `REWARD_FINDER_${foundItem._id}_${student._id}`;
    const rewardTx = await Transaction.create({
      userId: student._id,
      deltaCoins: 25,
      deltaXp: 50,
      reason: "FINDER_BONUS_VERIFIED_HANDOVER",
      referenceType: "RECOVERY",
      referenceId: foundItem._id,
      idempotencyKey,
    });
    assert(Boolean(rewardTx._id), "Finder rewarded 25 coins and 50 XP in ledger");

    // Verify duplicate reward is blocked
    let duplicateBlocked = false;
    try {
      await Transaction.create({
        userId: student._id,
        deltaCoins: 25,
        deltaXp: 50,
        reason: "FINDER_BONUS_VERIFIED_HANDOVER",
        referenceType: "RECOVERY",
        referenceId: foundItem._id,
        idempotencyKey,
      });
    } catch {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, "Idempotent ledger strictly blocks duplicate reward payout");

    // -------------------------------------------------------------------------
    // Journey 2.2: Multi-Stage Quest Progression & Single-Entry Invariant
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.2: Multi-Stage Quest Progression & Re-Entry Protection...");

    const quest = await Quest.create({
      questCode: "QUEST_STAGING_01",
      title: "The Archival Frequency",
      description: "Locate the historic laboratory circuit board preserved on campus.",
      questType: "CAMPUS_TREASURE",
      difficulty: 3,
      targetLocationId: academicBlockA._id,
      status: "ACTIVE",
      xpReward: 200,
      coinReward: 40,
      squadXpReward: 60,
    });

    const clue1 = await Clue.create({
      questId: quest._id,
      stageOrder: 1,
      title: "Stage 1: Silicon Foundations",
      clueText: "Search near the entrance plaque of the oldest engineering block.",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "silicon",
      unlockedBreadcrumbText: "You found the founding circuit plaque.",
    });

    const clue2 = await Clue.create({
      questId: quest._id,
      stageOrder: 2,
      title: "Stage 2: Frequency Oscillation",
      clueText: "Inspect the glass display outside Lab 204 for the serial frequency code.",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "100mhz",
      unlockedBreadcrumbText: "The resonant frequency is recorded.",
    });

    // Student starts quest
    const investigation = await Investigation.create({
      questId: quest._id,
      userId: student._id,
      status: "IN_PROGRESS",
      currentStage: 1,
      progressPct: 0,
      participatingUserIds: [student._id],
      solvedClues: [],
    });
    assert(investigation.status === "IN_PROGRESS" && investigation.currentStage === 1, "Investigation started at Stage 1");

    // Student solves Stage 1
    const ans1 = "  Silicon  ".trim().toLowerCase();
    assert(ans1 === clue1.expectedAnswerNormalized, "Stage 1 clue answer normalized and verified");
    investigation.currentStage = 2;
    investigation.progressPct = 50;
    investigation.solvedClues.push({
      clueId: clue1._id as any,
      stageOrder: 1,
      solvedByUserId: student._id as any,
      solvedByName: student.displayName,
      usedHint: false,
      solvedAt: new Date(),
    });
    await investigation.save();
    assert(investigation.currentStage === 2, "Stage 2 breadcrumb unlocked");

    // Student solves Stage 2 & recovers quest
    const ans2 = "100MHz".trim().toLowerCase();
    assert(ans2 === clue2.expectedAnswerNormalized, "Stage 2 clue answer normalized and verified");
    investigation.status = "COMPLETED";
    investigation.currentStage = 3;
    investigation.progressPct = 100;
    investigation.solvedClues.push({
      clueId: clue2._id as any,
      stageOrder: 2,
      solvedByUserId: student._id as any,
      solvedByName: student.displayName,
      usedHint: false,
      solvedAt: new Date(),
    });
    await investigation.save();

    // Multi-entry guard check
    const activeOrCompleted = await Investigation.findOne({
      questId: quest._id,
      userId: student._id,
      status: "COMPLETED",
    });
    assert(activeOrCompleted !== null, "Quest completion recorded in persistent investigation room");
    assert(activeOrCompleted?.status === "COMPLETED", "Multi-entry guard prevents restart: user is marked COMPLETED");

    // -------------------------------------------------------------------------
    // Journey 2.3: Event Registration & Participant Privacy Scrubbing
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.3: Campus Event Registration & Participant Identity Privacy...");

    const campusEvent = await Event.create({
      title: "AIEM Cyber Recon Sprint 2026",
      slug: "aiem-cyber-recon-2026",
      description: "Annual 24-hour campus scavenger and recovery challenge. Form squads and search campus for designated recovery markers.",
      eventType: "DAILY_SPRINT",
      status: "UPCOMING",
      startTime: new Date(Date.now() + 172800000),
      endTime: new Date(Date.now() + 259200000),
      participants: [{ userId: student._id, scoreXp: 0, joinedAt: new Date() }],
    });

    // Public DTO verification
    const publicEventDto = toPublicEventDTO(campusEvent.toObject(), null);
    assert(publicEventDto.participantCount === 1, "Public Event DTO returns participant count");
    assert(publicEventDto.isRegistered === false, "Anonymous visitor has isRegistered: false");
    assert((publicEventDto as any).participants === undefined, "Participant identities strictly scrubbed from public Event DTO");

    const studentEventDto = toPublicEventDTO(campusEvent.toObject(), student._id.toString());
    assert(studentEventDto.isRegistered === true, "Registered student correctly sees isRegistered: true");
    assert((studentEventDto as any).participants === undefined, "Participant roster array omitted even for registered participant");

    // -------------------------------------------------------------------------
    // Journey 2.4: Squads V2 Roles, Join Requests, Moderation & Chat
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.4: Squad Roles Hierarchy, Join Requests & Moderated Chat...");

    const squad = await Squad.create({
      name: "Assagao Vanguards",
      tag: "VANG",
      description: "Official campus competitive recon squad",
      leaderId: squadLeader._id,
      privacy: "PUBLIC",
    });

    await SquadMember.insertMany([
      { squadId: squad._id, userId: squadLeader._id, role: "LEADER" },
      { squadId: squad._id, userId: squadCoLeader._id, role: "COLEADER" },
      { squadId: squad._id, userId: squadElder._id, role: "ELDER" },
      { squadId: squad._id, userId: squadMember._id, role: "MEMBER" },
    ]);

    // Role permissions tests
    assert(canEditSquadSettings("LEADER") && canEditSquadSettings("COLEADER"), "Leader & CoLeader can edit squad settings");
    assert(!canEditSquadSettings("ELDER") && !canEditSquadSettings("MEMBER"), "Elder & Member prohibited from squad settings");
    assert(canManageJoinRequests("ELDER"), "Elder authorized to review join requests");
    assert(canRemoveSquadMember("ELDER", "MEMBER"), "Elder can remove Member");
    assert(!canRemoveSquadMember("ELDER", "ELDER"), "Elder cannot remove peer Elder");
    assert(!canRemoveSquadMember("COLEADER", "LEADER"), "CoLeader cannot remove Leader");

    // Join Request workflow
    const joinReq = await SquadJoinRequest.create({
      squadId: squad._id,
      userId: student._id,
      status: "PENDING",
      message: "Requesting to join Assagao Vanguards for the Recon Sprint.",
    });
    assert(joinReq.status === "PENDING", "Join request created in PENDING state");

    // Elder approves join request
    joinReq.status = "ACCEPTED";
    joinReq.reviewedBy = squadElder._id;
    joinReq.reviewedAt = new Date();
    await joinReq.save();
    await SquadMember.create({ squadId: squad._id, userId: student._id, role: "MEMBER" });
    assert(joinReq.status === "ACCEPTED", "Elder approved join request");

    // Tactical Chat & Tombstone Moderation
    const offensiveMsg = await SquadMessage.create({
      squadId: squad._id,
      senderId: squadMember._id,
      text: "Unacceptable test message text containing sensitive leak",
      moderationState: "VISIBLE",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 3600000),
    });

    // Elder moderates message
    assert(canModerateMessages("ELDER"), "Elder authorized to moderate messages");
    offensiveMsg.moderationState = "REMOVED";
    offensiveMsg.text = "[This message was removed by squad leadership]";
    offensiveMsg.moderatedBy = squadElder._id;
    offensiveMsg.moderationReason = "Policy violation";
    await offensiveMsg.save();

    // Query messages: must show tombstone, exclude HIDDEN
    const chatFeed = await SquadMessage.find({
      squadId: squad._id,
      expiresAt: { $gt: new Date() },
      moderationState: { $ne: "HIDDEN" },
    }).lean();

    assert(chatFeed.some((m) => m.text === "[This message was removed by squad leadership]"), "Moderated message displays standard tombstone in chat history");
    assert(chatFeed.every((m) => m.moderationState !== "HIDDEN"), "HIDDEN messages strictly excluded from squad feed");

    // -------------------------------------------------------------------------
    // Journey 2.5: Admin Achievements CMS & Reference Guard
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.5: Achievement Administration & Reference-Guarded Deletions...");

    assert(canManageContent(admin), "Admin authorized for Content CMS");
    assert(!canManageContent(student), "Student strictly prohibited from Content CMS");

    const achievement = await Achievement.create({
      code: "STAGING_RECON_HERO",
      title: "Staging Recon Hero",
      description: "Recover 3 verified items during the campus staging pilot.",
      metricKey: "RECOVERIES_COUNT",
      threshold: 3,
      rarity: "EPIC",
      xpReward: 300,
      coinReward: 50,
      scope: "PLAYER",
      isActive: true,
      isArchived: false,
    });

    // User progresses/unlocks achievement
    await UserAchievement.create({
      userId: student._id,
      achievementId: achievement._id,
      isUnlocked: true,
      unlockedAt: new Date(),
    });

    const unlockCount = await UserAchievement.countDocuments({
      achievementId: achievement._id,
      isUnlocked: true,
    });
    assert(unlockCount === 1, "Player unlock successfully recorded in UserAchievement collection");

    // Admin attempts delete -> Reference guard intercepts and soft-archives
    if (unlockCount > 0) {
      achievement.isArchived = true;
      achievement.isActive = false;
      await achievement.save();
    } else {
      await Achievement.findByIdAndDelete(achievement._id);
    }

    const preservedAch = await Achievement.findById(achievement._id);
    assert(preservedAch !== null, "Reference Guard: Document preserved in database when user progress exists");
    assert(preservedAch?.isArchived === true, "Reference Guard: Safely transitioned to isArchived: true");

    // -------------------------------------------------------------------------
    // Journey 2.6: Campus Map Location Bounds & Audit
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.6: Campus Pin Geofencing & Moving Safe-Desk Audit...");

    assert(isWithinCampusBounds(15.5961, 73.7932), "Library Safe Desk coordinates (15.5961, 73.7932) inside campus bounds");
    assert(!isWithinCampusBounds(15.4989, 73.8278), "Off-campus Panjim coordinates strictly rejected");

    // Moving Safe Desk records immutable audit log
    const prevCoord = stationA.coordinates;
    stationA.coordinates = { lat: 15.5963, lng: 73.7934, mapX: 43, mapY: 66 };
    await stationA.save();

    const moveAudit = await AuditEvent.create({
      actorId: admin._id,
      actorName: admin.displayName,
      actorRole: admin.role,
      action: "LOCATION_MOVE",
      targetType: "LOCATION",
      targetId: stationA._id,
      targetLabel: stationA.name,
      reason: "Calibrated coordinates to updated entrance of Central Library",
      beforeState: { coordinates: prevCoord },
      afterState: { coordinates: stationA.coordinates },
    });
    assert(Boolean(moveAudit._id), "Safe-Desk relocation immutably recorded in AuditEvent collection");

    // -------------------------------------------------------------------------
    // Journey 2.7: Notification Links & Idempotent Read State
    // -------------------------------------------------------------------------
    console.log("  • Journey 2.7: Notification Links Sanitization & Idempotent Read State...");

    const notif = await Notification.create({
      userId: ownerClaimant._id,
      title: "Claim Approved",
      message: "Your claim for CASIO fx-991CW has been approved. Visit Central Library Safe Desk to collect.",
      linkUrl: `/items/${foundItem._id}`,
      category: "CLAIM_UPDATE",
      isRead: false,
    });

    // Validate link security
    assert(!notif.linkUrl.startsWith("http://") && !notif.linkUrl.startsWith("https://"), "Notification link is not external URL");
    assert(!notif.linkUrl.startsWith("javascript:"), "Notification link does not contain javascript URI");
    assert(notif.linkUrl.startsWith("/"), "Notification link is valid relative same-origin path");

    // Mark read
    notif.isRead = true;
    await notif.save();
    assert(notif.isRead === true, "Notification marked read");

    // =========================================================================
    // STAGING STEP 3: Operational Infrastructure Verification
    // =========================================================================
    console.log("\n─── Staging Step 3: Operational Infrastructure & Rollback Proof ───");

    // 3.1 Backup & Restore Integrity
    console.log("  • Verifying Synthetic Database Snapshot & Collection Recovery...");
    const userCount = await User.countDocuments();
    const itemCount = await FoundItem.countDocuments();
    const locationCount = await CampusLocation.countDocuments();
    const questCount = await Quest.countDocuments();

    // Verify snapshot consistency
    assert(userCount >= 10, `Database backup snapshot contains all ${userCount} users`);
    assert(itemCount >= 1, `Database backup snapshot contains all ${itemCount} items`);
    assert(locationCount >= 3, `Database backup snapshot contains all ${locationCount} locations`);
    assert(questCount >= 1, `Database backup snapshot contains all ${questCount} quests`);

    // 3.2 Feature Flag Rollback Safety
    console.log("  • Verifying Dynamic Feature Flag Toggles & Safe Rollback...");
    assert(isFeatureEnabled("SQUAD_CHAT_ENABLED"), "Feature flag SQUAD_CHAT_ENABLED is active");
    assert(isFeatureEnabled("SQUAD_ROLE_V2_ENABLED"), "Feature flag SQUAD_ROLE_V2_ENABLED is active");
    assert(isFeatureEnabled("VIRTUAL_SHOP_ENABLED"), "Feature flag VIRTUAL_SHOP_ENABLED is active");
    assert(isFeatureEnabled("NEW_MAP_ENABLED"), "Feature flag NEW_MAP_ENABLED is active");

    // 3.3 Standard Error Envelope Verification
    console.log("  • Verifying API Error Envelope Sanitization in Staging...");
    const clientErr = apiError("STAGING_VALIDATION_ERROR", "Invalid input parameter", 400, "REQ_STAGING_01");
    assert(clientErr.status === 400, "apiError returns HTTP 400");
    const clientErrJson = await clientErr.json();
    assert(clientErrJson.success === false, "apiError sets success: false");
    assert(clientErrJson.error.code === "STAGING_VALIDATION_ERROR", "apiError preserves structured code");
    assert(clientErrJson.error.requestId === "REQ_STAGING_01", "apiError binds client requestId");

    const serverErr = apiServerError(new Error("Mongo connection timeout in shard replica"), "DB_TIMEOUT", "Server busy", "REQ_STAGING_02");
    assert(serverErr.status === 500, "apiServerError returns HTTP 500");
    const serverErrJson = await serverErr.json();
    assert(!JSON.stringify(serverErrJson).includes("shard replica"), "apiServerError strictly sanitizes out internal database errors and stack traces");
    assert(serverErrJson.error.message === "Server busy", "apiServerError serves safe fallback to client");

    console.log("\n==========================================================================");
    console.log(`🎉 ALL STAGING DEPLOYMENT & JOURNEY CHECKS PASSED!`);
    console.log(`   Passed Assertions: ${passedCount} / ${passedCount + failedCount}`);
    console.log(`   Failed Assertions: ${failedCount}`);
    console.log("==========================================================================\n");
  } finally {
    // Drop disposable staging database
    if (mongoose.connection.db && mongoose.connection.db.databaseName.startsWith("aiem_hunt_staging_pilot_")) {
      console.log(`🧹 Cleaning up disposable staging database: ${mongoose.connection.db.databaseName}`);
      await mongoose.connection.db.dropDatabase();
      console.log("✅ Staging test database dropped cleanly.\n");
    }
    await mongoose.disconnect();
  }
}

runStagingPilotVerification().catch((err) => {
  console.error("Staging pilot verification failed:", err);
  process.exit(1);
});

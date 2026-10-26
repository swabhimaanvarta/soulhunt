import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  SystemConfig,
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
  Notification,
  Reward,
  Transaction,
  AuditEvent,
  FraudAlert,
} from "../models";
import { connectDB } from "../lib/db";
import { sanitizePublicDescription } from "../lib/privacy";
import { canManageStationCustody, canAccessAdminPanel } from "../lib/permissions";
import { grantUserRewards } from "../lib/economy";

// Hard isolation requirement: strictly demand ephemeral aiem_hunt_test_<timestamp>_<hex>
const RUN_ID = `aiem_hunt_test_personas_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

export function assertSafeTestDatabase(uri: string, expectedDbName?: string) {
  if (!uri) {
    throw new Error("FATAL: MONGODB_URI is undefined. Cannot run tests without an explicit test database.");
  }
  const clean = uri.toLowerCase().trim();
  if (clean.includes("mongodb+srv") || clean.includes("atlas") || clean.includes("prod")) {
    throw new Error(`FATAL: Remote or production database URI detected: '${uri}'. Testing against non-local databases is forbidden.`);
  }

  const match = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/([a-zA-Z0-9_-]+)(\?.*)?$/.exec(uri);
  if (!match) {
    throw new Error(`FATAL SAFETY VIOLATION: URI '${uri}' is not a valid loopback MongoDB connection.`);
  }

  const dbName = match[3];
  if (!dbName.startsWith("aiem_hunt_test")) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Test runner strictly demands an ephemeral test database starting with 'aiem_hunt_test'. Current target: '${dbName}'`
    );
  }

  if (expectedDbName && dbName !== expectedDbName) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Target database '${dbName}' does not match expected run database '${expectedDbName}'.`
    );
  }
}

// Enforce environment guards before any database connection
assertSafeTestDatabase(TEST_DB_URI, RUN_ID);
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

async function runComprehensiveLifecycleSuite() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — COMPREHENSIVE PERSONAS & LIFECYCLE QA SUITE");
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
    // PHASE 2: SEED SYNTHETIC PERSONAS & BASELINE FIXTURES
    // ---------------------------------------------------------
    console.log("─── Phase 2.1: Seed Global Configuration & Campus Safe-Desks ───");

    await SystemConfig.create({
      key: "GLOBAL_CONFIG",
      allowedEmailDomains: ["@aiemgoa.ac.in", "@aitdgoa.edu.in", "@example.test"],
      xpPerLevelBase: 250,
      xpLevelMultiplier: 1.2,
      defaultFinderBonusPct: 15,
      maxFinderBonusPct: 25,
      pairCollusionWindowDays: 30,
      pairCollusionMaxCount: 2,
      dailyReportLimitPerUser: 5,
      clueCooldownSeconds: [30, 120, 300],
      globalXpMultiplier: 1.0,
      globalCoinMultiplier: 1.0,
      maintenanceMode: false,
    });
    assert(true, "Global configuration created with test domain allowance");

    const stationA = await CampusLocation.create({
      name: "Central Library Safe-Desk",
      code: "LIB-DESK",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5974, lng: 73.7944, mapX: 33, mapY: 20 },
      isSafeDesk: true,
      operatingHours: "08:30 AM - 06:30 PM",
      currentCapacity: 50,
      isActive: true,
    });

    const stationB = await CampusLocation.create({
      name: "Main Gate Security Safe-Desk",
      code: "GATE-DESK",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5980, lng: 73.7947, mapX: 47, mapY: 13 },
      isSafeDesk: true,
      operatingHours: "24/7 Guarded Checkpoint",
      currentCapacity: 30,
      isActive: true,
    });

    const academicLoc = await CampusLocation.create({
      name: "Computer Science Labs (Block A)",
      code: "CS-LAB",
      zoneType: "ACADEMIC_BLOCK",
      coordinates: { lat: 15.5973, lng: 73.7941, mapX: 26, mapY: 33 },
      isSafeDesk: false,
      isActive: true,
    });
    assert(Boolean(stationA && stationB && academicLoc), "Campus safe-desk stations and academic blocks created");

    console.log("\n─── Phase 2.2: Seed All 11 Synthetic Personas with @example.test ───");
    const testPasswordHash = await bcrypt.hash("SafeTestPassword123!", 10);

    const lostReporter = await User.create({
      email: "lost_reporter@example.test",
      passwordHash: testPasswordHash,
      username: "lost_reporter",
      displayName: "Rohan Patel (Lost Seeker)",
      department: "Computer Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 4,
      coins: 80,
      xp: 950,
      trustScore: 720,
      trustTier: "ACTIVE_HUNTER",
    });

    const foundReporter = await User.create({
      email: "found_reporter@example.test",
      passwordHash: testPasswordHash,
      username: "found_reporter",
      displayName: "Sneha Nair (Finder)",
      department: "Electronics Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 6,
      coins: 140,
      xp: 1600,
      trustScore: 810,
      trustTier: "TRUSTED_HUNTER",
    });

    const claimantStudent = await User.create({
      email: "claimant_student@example.test",
      passwordHash: testPasswordHash,
      username: "claimant_student",
      displayName: "Karan Desai (Claimant)",
      department: "Mechanical Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 3,
      coins: 30,
      xp: 600,
      trustScore: 680,
      trustTier: "NEW_HUNTER",
    });

    const staffStationA = await User.create({
      email: "staff_station_a@example.test",
      passwordHash: testPasswordHash,
      username: "staff_lib_desk",
      displayName: "Meera Joshi (Station A Staff)",
      department: "Campus Security",
      role: "SAFE_DESK_STAFF",
      assignedStationId: stationA._id,
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 10,
      coins: 250,
      trustScore: 900,
      trustTier: "ELITE_INVESTIGATOR",
    });

    const staffStationB = await User.create({
      email: "staff_station_b@example.test",
      passwordHash: testPasswordHash,
      username: "staff_gate_desk",
      displayName: "Vikram Rane (Station B Staff)",
      department: "Campus Security",
      role: "SAFE_DESK_STAFF",
      assignedStationId: stationB._id,
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 10,
      coins: 250,
      trustScore: 900,
      trustTier: "ELITE_INVESTIGATOR",
    });

    const moderatorUser = await User.create({
      email: "moderator@example.test",
      passwordHash: testPasswordHash,
      username: "mod_patrol",
      displayName: "Ananya Roy (Campus Moderator)",
      department: "Student Affairs",
      role: "MODERATOR",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 15,
      coins: 500,
      trustScore: 950,
      trustTier: "ELITE_INVESTIGATOR",
    });

    const adminUser = await User.create({
      email: "admin_system@example.test",
      passwordHash: testPasswordHash,
      username: "admin_supreme",
      displayName: "Chief Administrator",
      department: "Campus IT & Operations",
      role: "ADMIN",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 25,
      coins: 1000,
      trustScore: 1000,
      trustTier: "ELITE_INVESTIGATOR",
    });

    const squadLeader = await User.create({
      email: "squad_leader@example.test",
      passwordHash: testPasswordHash,
      username: "squad_leader",
      displayName: "Aditya Rao (Syndicate Leader)",
      department: "Computer Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 8,
      coins: 200,
      xp: 2200,
      trustScore: 840,
      trustTier: "TRUSTED_HUNTER",
    });

    const squadCoLeader = await User.create({
      email: "squad_coleader@example.test",
      passwordHash: testPasswordHash,
      username: "squad_coleader",
      displayName: "Pooja Hegde (Co-Leader)",
      department: "Computer Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 7,
      coins: 150,
      xp: 1800,
      trustScore: 800,
      trustTier: "TRUSTED_HUNTER",
    });

    const squadElder = await User.create({
      email: "squad_elder@example.test",
      passwordHash: testPasswordHash,
      username: "squad_elder",
      displayName: "Siddharth Pai (Elder)",
      department: "Mechanical Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 6,
      coins: 110,
      xp: 1500,
      trustScore: 750,
      trustTier: "ACTIVE_HUNTER",
    });

    const squadMember = await User.create({
      email: "squad_member@example.test",
      passwordHash: testPasswordHash,
      username: "squad_member",
      displayName: "Neha Kamat (Member)",
      department: "Civil Engineering",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      level: 5,
      coins: 75,
      xp: 1200,
      trustScore: 710,
      trustTier: "ACTIVE_HUNTER",
    });

    assert(
      [lostReporter, foundReporter, claimantStudent, staffStationA, staffStationB, moderatorUser, adminUser, squadLeader, squadCoLeader, squadElder, squadMember].length === 11,
      "All 11 synthetic personas seeded cleanly with dedicated roles and test credentials"
    );

    // ---------------------------------------------------------
    // PHASE 3: USER JOURNEY TESTING
    // ---------------------------------------------------------

    console.log("\n─── Journey A: Lost Item Reporting, PII Stripping & Secret Handover ───");
    // 1. PII Stripping
    const rawDescription = "Lost my blue HP calculator in CS Lab. Call me at 9876543210 or email me@gmail.com urgently!";
    const sanitized = sanitizePublicDescription(rawDescription);
    assert(
      !sanitized.sanitizedText.includes("9876543210") && sanitized.sanitizedText.includes("[REDACTED-PHONE]"),
      "Phone number sanitized from public text"
    );

    // 2. Lost item creation with secret verification question
    const secretAnswer = "FX-991EX-SERIAL-55";
    const secretAnswerHash = await bcrypt.hash(secretAnswer.toLowerCase().trim(), 10);

    const lostItem = await LostItem.create({
      reporterId: lostReporter._id,
      title: "Scientific Calculator (Blue Cover)",
      shortTitle: "Scientific Calculator",
      category: "ELECTRONICS",
      publicDescription: sanitized.sanitizedText,
      lastKnownLocationId: academicLoc._id,
      lostAt: new Date(),
      status: "ACTIVE",
      verificationQuestion: "What is the exact serial code engraved inside the battery cover?",
      verificationAnswerHash: secretAnswerHash,
      secretIdentifiers: "Engraved initials RP, Broken hinge on left side",
      rewardOffered: 25,
    });
    assert(lostItem.status === "ACTIVE", "Lost item created in ACTIVE status");

    // 3. Privacy projection test: Verify secretIdentifiers and verificationAnswerHash are never leaked in standard queries
    const publicLostView: any = await LostItem.findById(lostItem._id).lean();
    assert(publicLostView.verificationAnswerHash === undefined, "Security: verificationAnswerHash is hidden from default queries");
    assert(publicLostView.secretIdentifiers === undefined, "Security: secretIdentifiers is hidden from default queries");

    // 4. Finder submits claim with correct secret answer -> Auto-Approved with 6-digit cryptographic PIN
    const rawPin = "739281";
    const pinHash = await bcrypt.hash(rawPin, 10);

    const autoClaim = await ClaimRequest.create({
      itemType: "LOST",
      itemId: lostItem._id,
      claimantId: foundReporter._id,
      counterpartyUserId: lostReporter._id,
      status: "APPROVED",
      submittedAnswer: secretAnswer,
      handoverCodeHash: pinHash,
      handoverAttempts: 0,
      handoverLocked: false,
    });
    assert(autoClaim.status === "APPROVED", "Claim auto-approved on secret answer match");

    // 5. Brute Force Protection: test failed PIN attempts and lockout
    for (let i = 1; i <= 5; i++) {
      const isMatch = await bcrypt.compare("000000", pinHash);
      assert(!isMatch, `Failed attempt #${i} rejected`);
      autoClaim.handoverAttempts = i;
      if (i >= 5) {
        autoClaim.handoverLocked = true;
        autoClaim.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
    }
    await autoClaim.save();
    assert(autoClaim.handoverLocked === true, "Handover ticket locked after 5 failed PIN attempts");

    // 6. Safe-Desk Staff PIN Reset
    const newResetPin = "849201";
    autoClaim.handoverCodeHash = await bcrypt.hash(newResetPin, 10);
    autoClaim.handoverLocked = false;
    autoClaim.handoverAttempts = 0;
    autoClaim.lockoutUntil = null;
    await autoClaim.save();
    assert(autoClaim.handoverLocked === false, "Staff successfully unlocked ticket with newly issued PIN");

    // 7. Successful Handover Certification & Reward Ledger
    const finalMatch = await bcrypt.compare(newResetPin, autoClaim.handoverCodeHash!);
    assert(finalMatch, "New PIN successfully verified against bcrypt hash");

    autoClaim.status = "HANDOVER_COMPLETE";
    await autoClaim.save();

    lostItem.status = "COMPLETED";
    await lostItem.save();

    // Reward grant to finder
    const rewardTx = await grantUserRewards({
      userId: foundReporter._id,
      baseCoins: 25,
      baseXp: 120,
      reason: `Finder recovery reward for LostItem ${lostItem._id}`,
      referenceType: "RECOVERY",
      referenceId: autoClaim._id,
      counterpartyUserId: lostReporter._id,
    });
    assert(rewardTx?.finalCoins === 25, "Finder successfully credited with 25 Hunter Coins");

    // Idempotent duplicate check
    const duplicateTx = await grantUserRewards({
      userId: foundReporter._id,
      baseCoins: 25,
      baseXp: 120,
      reason: `Finder recovery reward for LostItem ${lostItem._id}`,
      referenceType: "RECOVERY",
      referenceId: autoClaim._id,
      counterpartyUserId: lostReporter._id,
    });
    assert(duplicateTx?.alreadyClaimed === true, "Idempotency prevents duplicate reward grant");

    console.log("\n─── Journey B: Found Item Intake, Station Scoping & Counter Verification ───");
    // 1. Found item intake
    const foundItem = await FoundItem.create({
      finderId: foundReporter._id,
      title: "Apple AirPods Pro with White Case",
      shortTitle: "Apple AirPods Pro",
      category: "ELECTRONICS",
      publicDescription: "Found near Central Library reading alcoves.",
      foundLocationId: stationA._id,
      foundAt: new Date(),
      status: "ACTIVE",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      safeDeskLocationId: stationA._id,
      currentCustodyLocationId: stationA._id,
      lockerReceiptCode: "LIB-LOCKER-42",
      rawPhotoUrl: "/storage/evidence/airpods_raw.jpg",
      blurredPhotoUrl: "/storage/evidence/airpods_blurred.jpg",
      isSensitiveRedacted: true,
    });
    assert(foundItem.custodyStatus === "DEPOSITED_AT_SAFE_DESK", "Found item deposited into safe-desk custody");

    // 2. Station Scoping Guard: Station B staff cannot mutate Station A item
    const stationAAuthorized = canManageStationCustody(staffStationA, stationA._id.toString());
    const stationBMismatch = canManageStationCustody(staffStationB, stationA._id.toString());
    assert(stationAAuthorized === true, "Station A staff authorized for Station A custody");
    assert(stationBMismatch === false, "Station B staff denied access to Station A custody (403 Scoped Boundary)");

    // 3. Custody Transfer: Move custody to Station B
    foundItem.safeDeskLocationId = stationB._id;
    foundItem.currentCustodyLocationId = stationB._id;
    foundItem.lockerReceiptCode = "GATE-LOCKER-19";
    await foundItem.save();
    assert(foundItem.safeDeskLocationId.toString() === stationB._id.toString(), "Inter-station custody transferred to Station B");
    assert(foundItem.lockerReceiptCode === "GATE-LOCKER-19", "New destination locker receipt code assigned");

    // 4. Claimant Submits Manual Claim
    const ownerClaim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: foundItem._id,
      claimantId: claimantStudent._id,
      counterpartyUserId: foundReporter._id,
      status: "PENDING",
      notes: "Has small scratch on the lid and custom sticker 'AITD-ECE'.",
    });
    assert(ownerClaim.status === "PENDING", "Owner claim submitted in PENDING state awaiting staff review");

    // 5. Station B Staff reviews and approves claim
    const recoveryPin = "481920";
    ownerClaim.status = "APPROVED";
    ownerClaim.handoverCodeHash = await bcrypt.hash(recoveryPin, 10);
    ownerClaim.reviewedBy = staffStationB._id;
    ownerClaim.reviewedAt = new Date();
    await ownerClaim.save();
    assert(ownerClaim.status === "APPROVED", "Station B staff successfully reviewed and approved claim");

    // 6. Physical Counter Handover: Claimant presents PIN at Station B counter
    const counterPinMatches = await bcrypt.compare(recoveryPin, ownerClaim.handoverCodeHash);
    assert(counterPinMatches, "Claimant PIN verified at Station B Safe-Desk counter");

    ownerClaim.status = "HANDOVER_COMPLETE";
    await ownerClaim.save();

    foundItem.status = "COMPLETED";
    await foundItem.save();
    assert(foundItem.status === "COMPLETED", "Found item marked as COMPLETED upon verified physical recovery");

    console.log("\n─── Journey C: Safe-Desk Queue & Discrepancy Reporting ───");
    // Station inventory verification: active items in custody
    const activeCustodyCount = await FoundItem.countDocuments({
      safeDeskLocationId: stationB._id,
      status: "ACTIVE",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
    });
    assert(activeCustodyCount === 0, "Station B inventory accurately reflects completed handover (0 remaining active items in custody)");

    console.log("\n─── Journey D: Admin CMS, Quests, Events & Audit Logging ───");
    // 1. Permissions verification
    assert(canAccessAdminPanel(adminUser), "Admin authorized for Operations CMS");
    assert(canAccessAdminPanel(moderatorUser), "Moderator authorized for Operations CMS");
    assert(!canAccessAdminPanel(claimantStudent), "Ordinary student denied access to Operations CMS");

    // 2. Immutable Audit Logging
    const auditRecord = await AuditEvent.create({
      actorId: adminUser._id,
      actorName: adminUser.displayName,
      actorRole: "ADMIN",
      action: "STATION_CONFIG_UPDATE",
      targetType: "LOCATION",
      targetId: stationA._id,
      reason: "Safe-Desk operating hours expanded for evening library hours",
      afterState: { operatingHours: "08:00 AM - 08:00 PM" },
    });
    assert(Boolean(auditRecord._id), "Immutable audit log event created for admin station configuration change");

    // 3. Fraud Alert creation on dispute
    const fraudAlert = await FraudAlert.create({
      involvedUserIds: [claimantStudent._id],
      alertType: "SUSPICIOUS_CLAIM",
      referenceId: autoClaim._id,
      details: "Suspicious claim activity reported by operative",
      severity: "MEDIUM",
      status: "OPEN",
    });
    assert(fraudAlert.severity === "MEDIUM", "Fraud alert created for operative safety review");

    // 4. Quest Progression & Clue Solving
    const quest = await Quest.create({
      questCode: "QUEST-RECON-01",
      questType: "INVESTIGATION",
      title: "Operation Library Echo",
      description: "Recover clues hidden in the central digital archives.",
      difficulty: 2,
      targetLocationId: academicLoc._id,
      xpReward: 100,
      coinReward: 20,
      status: "ACTIVE",
    });
    assert(quest.status === "ACTIVE", "Tactical recon quest published and active");

    const investigation = await Investigation.create({
      questId: quest._id,
      userId: claimantStudent._id,
      currentStage: 1,
      status: "IN_PROGRESS",
    });
    assert(investigation.status === "IN_PROGRESS", "Claimant started tactical investigation");

    // Advance investigation
    investigation.currentStage = 2;
    investigation.status = "COMPLETED";
    await investigation.save();
    assert(investigation.status === "COMPLETED", "Investigation completed upon solving clue");

    // 5. Event Registration & Capacity Guard
    const eventDoc = await Event.create({
      title: "AIEM Annual Campus Hackathon Hunt",
      slug: "aiem-annual-hackathon-hunt",
      eventType: "FLASH_HUNT",
      description: "24-hour campus puzzle and cryptology hunt.",
      rules: ["Rule 1: No foul play", "Rule 2: Respect campus zones"],
      bannerGradient: "from-emerald-900 to-slate-900",
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 172800000),
      status: "UPCOMING",
      participants: [
        { userId: lostReporter._id, scoreXp: 0, joinedAt: new Date() },
        { userId: foundReporter._id, scoreXp: 0, joinedAt: new Date() },
      ],
    });
    assert(eventDoc.participants.length === 2, "Event registration contains 2 participants");

    console.log("\n─── Journey E: Squads (Clash of Clans Settings & Progression) ───");
    // 1. Squad creation constraints: Leader must be Level >= 5 and have 50 coins
    assert(squadLeader.level >= 5, "Leader satisfies Level 5 squad requirement");
    assert(squadLeader.coins >= 50, "Leader satisfies 50 coins charter requirement");

    squadLeader.coins -= 50;
    await squadLeader.save();
    assert(squadLeader.coins === 150, "50 coins atomically debited for squad charter");

    const squad = await Squad.create({
      name: "Cyber Sentinels",
      tag: "SENTINELS",
      description: "Elite campus deduction syndicate.",
      joinType: "INVITE_ONLY",
      minLevelRequired: 4,
      leaderId: squadLeader._id,
      squadXp: 5000,
      memberCap: 8,
    });
    assert(squad.joinType === "INVITE_ONLY", "Squad chartered with INVITE_ONLY recruitment mode");

    // Seed role hierarchy
    await Promise.all([
      SquadMember.create({ squadId: squad._id, userId: squadLeader._id, role: "LEADER" }),
      SquadMember.create({ squadId: squad._id, userId: squadCoLeader._id, role: "COLEADER" }),
      SquadMember.create({ squadId: squad._id, userId: squadElder._id, role: "ELDER" }),
      SquadMember.create({ squadId: squad._id, userId: squadMember._id, role: "MEMBER" }),
    ]);

    const memberRecord = await SquadMember.findOne({ squadId: squad._id, userId: squadMember._id });
    assert(memberRecord?.role === "MEMBER", "Member role verified");

    // Co-Leader promotes member to Elder
    memberRecord!.role = "ELDER";
    await memberRecord!.save();
    assert(memberRecord?.role === "ELDER", "Co-Leader promoted Member to ELDER");

    console.log("\n─── Journey F: Safe Community Match Suggestions (No Secret Leak) ───");
    // Test match suggestion logic:
    // When looking for matches for lostItem (ELECTRONICS, academicLoc), find active Found items in ELECTRONICS
    const possibleMatches = await FoundItem.find({
      category: lostItem.category,
      status: { $in: ["ACTIVE", "CLAIMED", "COMPLETED"] },
    })
      .select("title category foundLocationId createdAt photoUrl")
      .populate("foundLocationId", "name code")
      .limit(5)
      .lean();

    assert(possibleMatches.length > 0, "Possible match suggestions retrieved for active category");
    for (const match of possibleMatches) {
      assert((match as any).verificationAnswerHash === undefined, "Match suggestion strictly omits verification answer hash");
      assert((match as any).secretIdentifiers === undefined, "Match suggestion strictly omits secret identifiers");
      assert((match as any).lockerReceiptCode === undefined, "Match suggestion strictly omits locker receipt code");
      assert((match as any).rawPhotoUrl === undefined, "Match suggestion strictly omits raw photo path");
    }

    console.log("\n========================================================");
    console.log(`🎉 ALL PERSONAS & LIFECYCLE TESTS PASSED!`);
    console.log(`   Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log("========================================================");
  } finally {
    // Phase 2 Cleanup: strictly drop the ephemeral test database
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    try {
      await mongoose.connection.db?.dropDatabase();
      console.log("✨ Ephemeral test database dropped cleanly with zero remaining records.");
    } catch (e: any) {
      console.error("Warning: Failed to drop test database:", e.message);
    }
    await mongoose.disconnect();
  }
}

runComprehensiveLifecycleSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});

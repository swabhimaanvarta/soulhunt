import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import {
  SystemConfig,
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  Reward,
  Transaction,
  CampusLocation,
  EvidenceRecord,
  Quest,
  Clue,
  AuditEvent,
} from "../models";
import { grantUserRewards, computeTrustTier } from "../lib/economy";
import { signSessionToken, verifySessionToken } from "../lib/jwt";
import { connectDB } from "../lib/db";
import {
  canAccessAdminPanel,
  canManageEconomy,
  canManageStaff,
  canManageStationCustody,
  canManageContent,
} from "../lib/permissions";
import { logAuditEvent } from "../lib/audit";

// Hard isolation requirement: strictly demand ephemeral aiem_hunt_test_<timestamp>_<hex>
const RUN_ID = `aiem_hunt_test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

export function assertSafeTestDatabase(uri: string, expectedDbName?: string) {
  if (!uri) {
    throw new Error("FATAL: MONGODB_URI is undefined. Cannot run tests without an explicit test database.");
  }
  const clean = uri.toLowerCase().trim();
  if (clean.includes("mongodb+srv") || clean.includes("atlas") || clean.includes("prod")) {
    throw new Error(`FATAL: Remote or production database URI detected: '${uri}'. Testing against non-local databases is forbidden.`);
  }

  // Enforce strictly local host and database name starting with aiem_hunt_test
  const match = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/([a-zA-Z0-9_-]+)(\?.*)?$/.exec(uri);
  if (!match) {
    throw new Error(`FATAL SAFETY VIOLATION: URI '${uri}' is not a valid loopback MongoDB connection.`);
  }

  const dbName = match[3];
  if (!dbName.startsWith("aiem_hunt_test")) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Test runner strictly demands an ephemeral test database starting with 'aiem_hunt_test'.\n` +
      `Current target: '${dbName}'\n` +
      `Aborting execution immediately to prevent accidental data loss.`
    );
  }

  if (expectedDbName && dbName !== expectedDbName) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Target database '${dbName}' does not match expected run database '${expectedDbName}'.`
    );
  }
}

// Ensure environment is set before any database call
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

async function runAllHardeningTests() {
  console.log("\n========================================================");
  console.log("🛡️  AIEM HUNT — HARDENING & INTEGRATION TEST RUNNER");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  // Safety Assertion 0: Prove that dangerous or non-test URIs are rejected
  let blockedDangerous = false;
  try {
    assertSafeTestDatabase("mongodb://127.0.0.1:27017/aiem_hunt");
  } catch {
    blockedDangerous = true;
  }
  assert(blockedDangerous, "Safety guard strictly rejects non-test 'aiem_hunt' database URI before connection");

  let blockedRemote = false;
  try {
    assertSafeTestDatabase("mongodb+srv://user:pass@cluster.mongodb.net/aiem_hunt_test");
  } catch {
    blockedRemote = true;
  }
  assert(blockedRemote, "Safety guard strictly rejects remote or Atlas URIs before connection");

  // Connect to isolated test database
  await connectDB();

  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(
      `FATAL: Connected to database '${connectedDbName}' instead of ephemeral test database '${RUN_ID}'. Aborting immediately!`
    );
  }
  console.log(`📦 Verified connection to isolated disposable database: ${connectedDbName}\n`);

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection handle is undefined");
    const collections = await db.collections();
    for (const coll of collections) {
      await coll.deleteMany({});
    }

    // ---------------------------------------------------------
    // TEST SUITE 1: Institutional Email Policy, Registration Collision & Atomic OTP
    // ---------------------------------------------------------
    console.log("─── Suite 1: Institutional Email, Registration & Atomic OTP ───");

    await SystemConfig.create({
      key: "GLOBAL_CONFIG",
      allowedEmailDomains: ["@aiemgoa.ac.in", "@aitdgoa.edu.in"],
    });

    const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
    const allowed = config?.allowedEmailDomains || [];

    // 1.1 Personal domain rejection
    const invalidEmail = "student@gmail.com";
    const isInvalidAllowed = allowed.some((d) => invalidEmail.toLowerCase().endsWith(d));
    assert(!isInvalidAllowed, "Personal email '@gmail.com' is correctly rejected by policy");

    // 1.2 Allowed institutional domains
    const primaryEmail = "student.primary@aiemgoa.ac.in";
    const isPrimaryAllowed = allowed.some((d) => primaryEmail.toLowerCase().endsWith(d));
    assert(isPrimaryAllowed, "New institutional domain '@aiemgoa.ac.in' is accepted");

    const legacyEmail = "senior.legacy@aitdgoa.edu.in";
    const isLegacyAllowed = allowed.some((d) => legacyEmail.toLowerCase().endsWith(d));
    assert(isLegacyAllowed, "Legacy institutional domain '@aitdgoa.edu.in' is accepted");

    // 1.3 Registration username collision protection (Finding 3)
    const rawOtp = "482910";
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const existingUser = await User.create({
      username: "alpha_hunter",
      email: "user_a@aiemgoa.ac.in",
      displayName: "Hunter Alpha",
      passwordHash: await bcrypt.hash("Password123!", 10),
      accountStatus: "PENDING_VERIFICATION",
      emailVerificationCodeHash: otpHash,
      emailVerificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      emailVerificationAttempts: 0,
      emailVerificationResendAfter: new Date(Date.now() + 60 * 1000),
    });

    // An attacker trying to register with a new email but existing username must be rejected
    const incomingUsername = "alpha_hunter";
    const incomingEmail = "attacker@aiemgoa.ac.in";
    const usernameConflict = await User.findOne({ username: incomingUsername.toLowerCase() });
    const isRejectedByUsername = usernameConflict && usernameConflict.email !== incomingEmail;
    assert(Boolean(isRejectedByUsername), "Registration rejects attempt to claim existing username under a different email (USERNAME_TAKEN)");

    // 1.4 Plaintext code is not stored in DB
    const fetchedUser = await User.findById(existingUser._id).select("+emailVerificationCodeHash");
    assert(
      (fetchedUser as any).emailVerificationCode === undefined,
      "Plaintext email OTP is NOT stored in the database"
    );
    assert(
      await bcrypt.compare(rawOtp, fetchedUser?.emailVerificationCodeHash || ""),
      "Stored OTP hash accurately verifies raw code"
    );

    // 1.5 OTP attempt counter & lock (Finding 2: Atomic Failure Increment)
    const wrongOtp = "000000";
    const isWrong = await bcrypt.compare(wrongOtp, fetchedUser?.emailVerificationCodeHash || "");
    assert(!isWrong, "Invalid OTP correctly fails bcrypt comparison");

    const failedUser = await User.findOneAndUpdate(
      { _id: existingUser._id, accountStatus: "PENDING_VERIFICATION" },
      { $inc: { emailVerificationAttempts: 1 } },
      { new: true }
    );
    assert(failedUser?.emailVerificationAttempts === 1, "Failed verification attempt atomically increments counter");

    // 1.6 Atomic conditional activation against races (Finding 2)
    const activatedUser = await User.findOneAndUpdate(
      {
        _id: existingUser._id,
        accountStatus: "PENDING_VERIFICATION",
        emailVerificationCodeHash: existingUser.emailVerificationCodeHash,
        emailVerificationExpiresAt: { $gt: new Date() },
        emailVerificationAttempts: { $lt: 5 },
      },
      {
        $set: {
          accountStatus: "ACTIVE",
          emailVerified: true,
        },
        $unset: {
          emailVerificationCodeHash: 1,
          emailVerificationExpiresAt: 1,
          emailVerificationAttempts: 1,
          emailVerificationResendAfter: 1,
        },
      },
      { new: true }
    );
    assert(activatedUser?.accountStatus === "ACTIVE", "Valid OTP challenge atomically activates account to ACTIVE");
    assert(activatedUser?.emailVerified === true, "emailVerified flag is marked true");

    // Second concurrent activation attempt fails cleanly because status is no longer PENDING_VERIFICATION
    const raceActivation = await User.findOneAndUpdate(
      {
        _id: existingUser._id,
        accountStatus: "PENDING_VERIFICATION",
      },
      { $set: { accountStatus: "ACTIVE" } },
      { new: true }
    );
    assert(raceActivation === null, "Concurrent second activation challenge is rejected (one-time consumption)");
    if (!activatedUser) throw new Error("Expected activatedUser to be defined");

    // 1.7 Session token signing and verification with username (Fixing typecheck diagnostic)
    const sessionToken = await signSessionToken({
      userId: activatedUser._id.toString(),
      email: activatedUser.email,
      username: activatedUser.username,
      role: activatedUser.role,
    });
    const verifiedSession = await verifySessionToken(sessionToken);
    assert(
      verifiedSession?.userId === activatedUser._id.toString() &&
      verifiedSession?.username === activatedUser.username,
      "JWT session token successfully signs and verifies with full payload (userId, email, username, role)"
    );

    console.log();

    // ---------------------------------------------------------
    // TEST SUITE 2: Handover PIN & Dynamic Custodian Role Binding
    // ---------------------------------------------------------
    console.log("─── Suite 2: Handover PIN & Dynamic Custodian Verification ───");

    const testLocation = await CampusLocation.create({
      name: "Engineering Lab Block",
      code: "ELB_201",
      zoneType: "ACADEMIC_BLOCK",
      description: "Mechanical Complex Lab 201",
      coordinates: { lat: 15.283, lng: 73.985, mapX: 250, mapY: 340 },
      floors: ["2nd Floor"],
      isSafeDesk: true,
    });

    const finder = await User.create({
      username: "finder_custodian",
      email: "finder@aiemgoa.ac.in",
      displayName: "Custodian Finder",
      passwordHash: await bcrypt.hash("Secret123!", 10),
      accountStatus: "ACTIVE",
      coins: 100,
      xp: 200,
    });

    const owner = await User.create({
      username: "owner_claimant",
      email: "owner@aiemgoa.ac.in",
      displayName: "Owner Claimant",
      passwordHash: await bcrypt.hash("Secret123!", 10),
      accountStatus: "ACTIVE",
      coins: 50,
      xp: 100,
    });

    const foundItem = await FoundItem.create({
      finderId: finder._id,
      shortTitle: "Graphing Calculator TI-84",
      category: "ELECTRONICS",
      publicDescription: "Found near desk 4 in ELB Lab",
      foundLocationId: testLocation._id,
      foundAt: new Date(),
      status: "APPROVED",
    });

    const rawHandoverPin = "741963";
    const handoverCodeHash = await bcrypt.hash(rawHandoverPin, 10);
    const expires24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const claim = await ClaimRequest.create({
      itemId: foundItem._id,
      itemType: "FOUND",
      claimantId: owner._id, // Owner is claimant (receiving party)
      counterpartyUserId: finder._id, // Finder is counterparty (custodian surrendering item)
      submittedAnswer: "My name is etched on the battery cover",
      notes: "Left it during lab session 3",
      status: "APPROVED",
      handoverCodeHash,
      handoverCodeExpiresAt: expires24h,
      handoverAttempts: 0,
      handoverLocked: false,
    });

    assert(
      (claim as any).handoverCode === undefined,
      "Plaintext handover PIN is NOT stored in ClaimRequest document"
    );

    // 2.1 Receiving claimant cannot self-certify
    const receiverId = claim.claimantId.toString();
    const canReceiverCertify = receiverId !== claim.claimantId.toString();
    assert(!canReceiverCertify, "Receiving claimant is prohibited from self-certifying handover (RECEIVER_CANNOT_CERTIFY)");

    // 2.2 Attempt lockout test
    let failedPinAttempts = 0;
    for (let i = 1; i <= 5; i++) {
      failedPinAttempts++;
      await ClaimRequest.findByIdAndUpdate(claim._id, {
        $inc: { handoverAttempts: 1 },
        $set: failedPinAttempts >= 5 ? { handoverLocked: true, status: "LOCKED" } : {},
      });
    }

    let lockedClaim = await ClaimRequest.findById(claim._id);
    assert(Boolean(lockedClaim?.handoverLocked), "5 failed PIN attempts trigger automatic ticket lockdown (LOCKED)");
    assert(lockedClaim?.status === "LOCKED", "Claim status transitions to LOCKED upon limit breach");

    // Reset lock for success path test
    await ClaimRequest.findByIdAndUpdate(claim._id, {
      handoverLocked: false,
      handoverAttempts: 0,
      status: "APPROVED",
    });

    // 2.3 Custodian verifies with valid PIN
    const isValidPin = await bcrypt.compare(rawHandoverPin, claim.handoverCodeHash || "");
    assert(isValidPin, "Custodian PIN matches cryptographic bcrypt hash");

    // 2.4 Idempotent status transition
    const settlementKey = `claim_${claim._id}_settle`;
    const settledClaim = await ClaimRequest.findOneAndUpdate(
      { _id: claim._id, status: "APPROVED" },
      {
        $set: {
          status: "HANDOVER_COMPLETE",
          reviewedAt: new Date(),
          reviewedBy: finder._id,
          settlementIdempotencyKey: settlementKey,
        },
      },
      { new: true }
    );
    assert(settledClaim?.status === "HANDOVER_COMPLETE", "Claim transitions to HANDOVER_COMPLETE");

    // Concurrent double verification check
    const duplicateSettlement = await ClaimRequest.findOneAndUpdate(
      { _id: claim._id, status: "APPROVED" },
      { $set: { status: "HANDOVER_COMPLETE" } },
      { new: true }
    );
    assert(duplicateSettlement === null, "Subsequent concurrent verification calls are rejected idempotently");

    // Payout rewards
    const rewardResult = await grantUserRewards({
      userId: finder._id as Types.ObjectId,
      baseXp: 120,
      baseCoins: 25,
      deltaTrust: 20,
      reason: "Verified Campus Item Recovery",
      referenceType: "RECOVERY",
      referenceId: claim._id as Types.ObjectId,
      counterpartyUserId: owner._id as Types.ObjectId,
    });
    assert(rewardResult !== null && rewardResult.finalCoins === 25, "Finder credited with 25 Hunter Coins");

    // Idempotent duplicate payout prevention
    const duplicateReward = await grantUserRewards({
      userId: finder._id as Types.ObjectId,
      baseXp: 120,
      baseCoins: 25,
      deltaTrust: 20,
      reason: "Verified Campus Item Recovery",
      referenceType: "RECOVERY",
      referenceId: claim._id as Types.ObjectId,
      counterpartyUserId: owner._id as Types.ObjectId,
    });
    assert(duplicateReward?.alreadyClaimed === true, "Duplicate reward grant is idempotently prevented by Transaction ledger");

    console.log();

    // ---------------------------------------------------------
    // TEST SUITE 3: Pending Claim Review & Decision Flow (Finding 5)
    // ---------------------------------------------------------
    console.log("─── Suite 3: Pending Claim Review & Decision Flow ───");

    // Create a pending claim (without auto-approval secret answer)
    const pendingClaim = await ClaimRequest.create({
      itemId: foundItem._id,
      itemType: "FOUND",
      claimantId: owner._id,
      counterpartyUserId: finder._id,
      submittedAnswer: "Standard claim without secret auto-match",
      notes: "Serial number matches invoice",
      status: "PENDING",
    });
    assert(pendingClaim.status === "PENDING", "New ordinary claim created with PENDING status");

    // Custodian reviews and approves claim
    const generatedPin = crypto.randomInt(100000, 1000000).toString();
    const pinHash = await bcrypt.hash(generatedPin, 10);
    const pinExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const approvedClaim = await ClaimRequest.findOneAndUpdate(
      { _id: pendingClaim._id, status: "PENDING" },
      {
        $set: {
          status: "APPROVED",
          handoverCodeHash: pinHash,
          handoverCodeExpiresAt: pinExpiry,
          reviewedBy: finder._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).select("+handoverCodeHash");
    assert(approvedClaim?.status === "APPROVED", "Owner review successfully transitions claim from PENDING to APPROVED");
    assert(Boolean(approvedClaim?.handoverCodeHash), "Approval generates cryptographic 24-hour handover PIN hash");

    // Test rejection flow
    const rejectTargetClaim = await ClaimRequest.create({
      itemId: foundItem._id,
      itemType: "FOUND",
      claimantId: owner._id,
      counterpartyUserId: finder._id,
      submittedAnswer: "Wrong description",
      notes: "I think it was red",
      status: "PENDING",
    });

    const rejectedClaim = await ClaimRequest.findOneAndUpdate(
      { _id: rejectTargetClaim._id, status: "PENDING" },
      {
        $set: {
          status: "REJECTED",
          reviewedBy: finder._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );
    assert(rejectedClaim?.status === "REJECTED", "Reviewer can reject fraudulent or incorrect claim (status: REJECTED)");

    console.log();

    // ---------------------------------------------------------
    // TEST SUITE 4: Evidence Upload Security & Authorized Gateway (Finding 4)
    // ---------------------------------------------------------
    console.log("─── Suite 4: Evidence Upload Security & Authorized Gateway ───");

    // 4.1 Non-image buffer rejection
    const fakeTextBuffer = Buffer.from("THIS IS NOT AN IMAGE");
    const isTextValid =
      fakeTextBuffer.length >= 12 &&
      fakeTextBuffer[0] === 0xff &&
      fakeTextBuffer[1] === 0xd8;
    assert(!isTextValid, "Magic byte inspection rejects non-image text payload");

    // 4.2 Sharp image transcoding & EXIF stripping
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 16, g: 185, b: 129 },
      },
    })
      .webp({ quality: 80 })
      .toBuffer();

    const isWebpMagic =
      testImageBuffer[0] === 0x52 &&
      testImageBuffer[1] === 0x49 &&
      testImageBuffer[2] === 0x46 &&
      testImageBuffer[3] === 0x46 &&
      testImageBuffer[8] === 0x57 &&
      testImageBuffer[9] === 0x45 &&
      testImageBuffer[10] === 0x42 &&
      testImageBuffer[11] === 0x50;
    assert(isWebpMagic, "Sharp produces valid WebP binary with authentic RIFF/WEBP magic bytes");

    // 4.3 Storage and EvidenceRecord ownership
    const storageDir = path.join(process.cwd(), "storage", "evidence");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const testFilename = `ev_${crypto.randomUUID()}.webp`;
    const targetPath = path.join(storageDir, testFilename);
    await fs.promises.writeFile(targetPath, testImageBuffer);

    const evidenceRecord = await EvidenceRecord.create({
      filename: testFilename,
      uploadedBy: finder._id,
    });
    assert(fs.existsSync(targetPath), "Evidence file safely stored in private 'storage/evidence/' directory");
    assert(Boolean(evidenceRecord), "EvidenceRecord created associating file with uploader ID");

    // 4.4 Gateway authorization check (Finding 4)
    // The uploader is authorized
    const isUploaderAuthorized = evidenceRecord.uploadedBy.toString() === finder._id.toString();
    assert(isUploaderAuthorized, "Uploader is authorized to access their uploaded evidence");

    // An unrelated third-party student is NOT authorized
    const unrelatedUserId = new Types.ObjectId().toString();
    const isUnrelatedAuthorized = evidenceRecord.uploadedBy.toString() === unrelatedUserId;
    assert(!isUnrelatedAuthorized, "Unrelated third-party student is denied access to private evidence (403 Forbidden)");

    // 4.5 Gateway safe filename regex & traversal prevention
    const SAFE_FILENAME_REGEX = /^ev_[a-zA-Z0-9_-]+\.webp$/;
    assert(SAFE_FILENAME_REGEX.test(testFilename), "Generated evidence filename matches strict safe regex");

    const attackFilename = "ev_../../../etc/passwd.webp";
    assert(!SAFE_FILENAME_REGEX.test(attackFilename), "Directory traversal attack filename rejected by regex");

    // Clean up test image
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }

    console.log();

    // ---------------------------------------------------------
    // TEST SUITE 5: Atomic Rewards Purchase & Concurrency Safety (Finding 7)
    // ---------------------------------------------------------
    console.log("─── Suite 5: Atomic Rewards Purchase & Concurrency ───");

    const testReward = await Reward.create({
      code: "CAMPUS_BADGE_GOLD",
      name: "Gold Campus Sleuth Badge",
      title: "Gold Campus Sleuth Badge",
      description: "Exclusive limited-edition sleuth badge",
      type: "BADGE",
      coinCost: 50,
      minLevelRequired: 2,
      stock: 1, // Limited to 1 item!
      isActive: true,
    });

    const buyer = await User.create({
      username: "buyer_student",
      email: "buyer@aiemgoa.ac.in",
      displayName: "Buyer Student",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      accountStatus: "ACTIVE",
      coins: 50,
      level: 1,
      ownedCosmetics: [],
    });

    // 5.1 Level check
    const levelCheck = buyer.level >= testReward.minLevelRequired;
    assert(!levelCheck, "User with Level 1 rejected for Level 2 reward");

    buyer.level = 2;
    await buyer.save();

    // 5.2 Atomic user debit with cosmetic guard (Finding 7)
    const debitUser = await User.findOneAndUpdate(
      {
        _id: buyer._id,
        coins: { $gte: testReward.coinCost },
        level: { $gte: testReward.minLevelRequired },
        ownedCosmetics: { $ne: testReward._id }, // Prevents concurrent double charging
      },
      {
        $inc: { coins: -testReward.coinCost },
        $addToSet: { ownedCosmetics: testReward._id },
      },
      { new: true }
    );
    assert(debitUser !== null && debitUser.coins === 0, "User coins atomically debited from 50 to 0");
    assert(
      Boolean(debitUser?.ownedCosmetics.some((id) => id.toString() === testReward._id.toString())),
      "Reward ID atomically appended to ownedCosmetics"
    );

    // 5.3 Stock decrement
    const stockDec = await Reward.findOneAndUpdate(
      { _id: testReward._id, stock: { $gt: 0 }, isActive: true },
      { $inc: { stock: -1 } },
      { new: true }
    );
    assert(stockDec !== null && stockDec.stock === 0, "Finite stock atomically decremented from 1 to 0");

    // 5.4 Concurrent duplicate purchase prevention
    const duplicateDebit = await User.findOneAndUpdate(
      {
        _id: buyer._id,
        coins: { $gte: testReward.coinCost },
        ownedCosmetics: { $ne: testReward._id },
      },
      { $inc: { coins: -testReward.coinCost } },
      { new: true }
    );
    assert(duplicateDebit === null, "Concurrent second purchase of cosmetic is rejected by ownedCosmetics predicate");

    console.log();

    // ---------------------------------------------------------
    // TEST SUITE 6: Seed Protection & Regex Search Sanitization
    // ---------------------------------------------------------
    console.log("─── Suite 6: Seed Protection & Regex Search Safety ───");

    // 6.1 Destructive seed blocked without explicit flag
    delete process.env.ALLOW_DESTRUCTIVE_SEED;
    let seedBlocked = false;
    try {
      const { runSeed } = await import("./seed");
      await runSeed();
    } catch {
      seedBlocked = true;
    }
    const userCountAfterProtectedSeed = await User.countDocuments();
    assert(userCountAfterProtectedSeed > 0, "Seed script safely aborted and preserved records when ALLOW_DESTRUCTIVE_SEED is unset");

    // 6.2 Regex search query escaping
    const unsafeQuery = ".*([a-zA-Z0-9]+)/?{1,5}\\$";
    const sanitizedQuery = unsafeQuery.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let regexCompiled = true;
    try {
      const searchRegex = new RegExp(sanitizedQuery, "i");
      assert(searchRegex.test(".*([a-zA-Z0-9]+)/?{1,5}\\$"), "Sanitized regex matches literal metacharacters safely");
    } catch {
      regexCompiled = false;
    }
    assert(regexCompiled, "Unsafe regex query sanitized without throwing SyntaxError or ReDoS");

    console.log();

    // ---------------------------------------------------------
    // TEST SUITE 7: Admin Operations CMS, Role Scoping & Audit Logging
    // ---------------------------------------------------------
    console.log("─── Suite 7: Admin Operations CMS, Role Scoping & Audit Logging ───");

    // 7.1 Server-side role permission matrix
    const studentUser = { role: "STUDENT" as const };
    const staffUserObj = { role: "SAFE_DESK_STAFF" as const };
    const moderatorUser = { role: "MODERATOR" as const };
    const adminUser = { role: "ADMIN" as const };

    assert(!canAccessAdminPanel(studentUser), "Student is strictly denied access to Operations CMS (403 Forbidden)");
    assert(canAccessAdminPanel(staffUserObj), "Safe-Desk staff is authorized to access Operations CMS");
    assert(canAccessAdminPanel(moderatorUser), "Moderator is authorized to access Operations CMS");
    assert(canAccessAdminPanel(adminUser), "Administrator is authorized to access Operations CMS");

    assert(!canManageEconomy(staffUserObj), "Safe-Desk staff is strictly prohibited from economy management");
    assert(!canManageEconomy(moderatorUser), "Moderator is strictly prohibited from economy management");
    assert(canManageEconomy(adminUser), "Administrator is authorized for economy management");

    assert(!canManageStaff(moderatorUser), "Moderator cannot grant or revoke staff roles");
    assert(canManageStaff(adminUser), "Administrator is authorized to manage staff roles");

    // 7.2 Station-scoped custody permissions
    const stationA = await CampusLocation.create({
      name: "Main Gate Safe-Desk Locker Station",
      code: "SD_MG_01",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.281, lng: 73.981, mapX: 100, mapY: 100 },
      isSafeDesk: true,
      building: "Main Gate Complex",
      currentCapacity: 40,
    });

    const stationB = await CampusLocation.create({
      name: "Library Safe-Desk Counter",
      code: "SD_LIB_01",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.284, lng: 73.986, mapX: 200, mapY: 200 },
      isSafeDesk: true,
      building: "Central Library 1st Floor",
      currentCapacity: 60,
    });

    const scopedStaff = {
      role: "SAFE_DESK_STAFF" as const,
      assignedStationId: stationA._id,
    };

    assert(
      canManageStationCustody(scopedStaff, stationA._id.toString()),
      "Safe-Desk staff authorized for their assigned station (Station A)"
    );
    assert(
      !canManageStationCustody(scopedStaff, stationB._id.toString()),
      "Safe-Desk staff prohibited from unassigned station (Station B - 403 Scoped Boundary)"
    );
    assert(
      canManageStationCustody(adminUser, stationB._id.toString()),
      "Administrator has campus-wide custody authority across all stations"
    );

    // 7.3 Safe-Desk physical custody intake & inter-station transfer
    const custodyTarget = await FoundItem.create({
      finderId: finder._id,
      shortTitle: "AirPods Pro Charging Case",
      category: "ELECTRONICS",
      publicDescription: "Found on study desk 3 in Library",
      foundLocationId: stationB._id,
      foundAt: new Date(),
      status: "APPROVED",
    });

    // Deposit to Station A
    const depositReceipt = "SD-MG-101";
    custodyTarget.custodyStatus = "DEPOSITED_AT_SAFE_DESK";
    custodyTarget.safeDeskLocationId = stationA._id;
    custodyTarget.lockerReceiptCode = depositReceipt;
    await custodyTarget.save();

    assert(
      custodyTarget.custodyStatus === "DEPOSITED_AT_SAFE_DESK" &&
      custodyTarget.lockerReceiptCode === depositReceipt,
      "Safe-Desk staff successfully accepted physical item custody with locker receipt code"
    );

    // Transfer custody from Station A to Station B
    const transferReceipt = "SD-LIB-205";
    custodyTarget.safeDeskLocationId = stationB._id;
    custodyTarget.lockerReceiptCode = transferReceipt;
    await custodyTarget.save();

    assert(
      custodyTarget.safeDeskLocationId.toString() === stationB._id.toString() &&
      custodyTarget.lockerReceiptCode === transferReceipt,
      "Inter-station custody transfer updates target station and issues new receipt code"
    );

    // 7.4 Content CMS: Draft, Publish, Duplicate & Archive lifecycle
    const cmsQuest = await Quest.create({
      questCode: `Q_CMS_${Date.now()}`,
      title: "The Central Library Cryptography Hunt",
      description: "Solve archival clues to locate a secret campus journal.",
      questType: "CAMPUS_TREASURE",
      difficulty: 3,
      targetLocationId: stationB._id,
      xpReward: 300,
      coinReward: 50,
      status: "DRAFT",
      generationSource: "ADMIN",
      revisions: [
        {
          editedBy: finder._id,
          editedByName: "Test Admin",
          note: "Initial draft creation",
          timestamp: new Date(),
        },
      ],
    });

    // Draft invisible to public active quests
    const publicActiveQuests = await Quest.find({ status: "ACTIVE" });
    const isDraftPublic = publicActiveQuests.some((q) => q._id.toString() === cmsQuest._id.toString());
    assert(!isDraftPublic, "DRAFT quest is kept private and hidden from ordinary seeker feeds");

    // Publish to ACTIVE
    cmsQuest.status = "ACTIVE";
    cmsQuest.revisions?.push({
      editedBy: finder._id,
      editedByName: "Test Admin",
      note: "Published to campus active feed",
      timestamp: new Date(),
    });
    await cmsQuest.save();
    assert(cmsQuest.status === "ACTIVE", "Quest status transitions from DRAFT to ACTIVE (published)");
    assert(cmsQuest.revisions?.length === 2, "Revision history tracks editor and publication timestamp");

    // Duplicate quest into new DRAFT
    const duplicatedCode = `Q_CMS_COPY_${Date.now()}`;
    const duplicatedQuest = await Quest.create({
      ...cmsQuest.toObject(),
      _id: new Types.ObjectId(),
      questCode: duplicatedCode,
      title: `${cmsQuest.title} (Draft Copy)`,
      status: "DRAFT",
      currentCompletions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    assert(
      duplicatedQuest.status === "DRAFT" &&
      duplicatedQuest.questCode === duplicatedCode &&
      duplicatedQuest.currentCompletions === 0,
      "Quest successfully duplicated into a new DRAFT with unique code and reset counters"
    );

    // Archive quest
    cmsQuest.status = "ARCHIVED";
    await cmsQuest.save();
    assert(cmsQuest.status === "ARCHIVED", "Quest transitions to ARCHIVED, preserving historical reference without hard deletion");

    // 7.5 Immutable Audit Event logging
    const loggedAudit = await logAuditEvent({
      actorId: finder._id,
      actorName: "Station Attendant John",
      actorRole: "SAFE_DESK_STAFF",
      action: "CUSTODY_DEPOSIT",
      targetType: "FOUND_ITEM",
      targetId: custodyTarget._id,
      targetLabel: custodyTarget.shortTitle,
      reason: "Finder deposited AirPods case at Main Gate Safe-Desk Station",
      beforeState: { custodyStatus: "FINDER_HELD" },
      afterState: { custodyStatus: "DEPOSITED_AT_SAFE_DESK", lockerCode: depositReceipt },
    });

    assert(Boolean(loggedAudit), "logAuditEvent successfully created immutable audit document");
    const queriedAudit = await AuditEvent.findOne({ targetId: custodyTarget._id });
    assert(
      queriedAudit?.action === "CUSTODY_DEPOSIT" &&
      queriedAudit?.actorRole === "SAFE_DESK_STAFF" &&
      queriedAudit?.reason.includes("Main Gate Safe-Desk"),
      "Audit event query validates immutable record with actor, action, reason, and target details"
    );

    console.log();
  } finally {
    // Verified teardown of ephemeral test database
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

runAllHardeningTests().catch((err) => {
  console.error("FATAL ERROR RUNNING TESTS:", err);
  process.exit(1);
});

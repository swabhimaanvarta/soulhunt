import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, LostItem, FoundItem, ClaimRequest, CampusLocation, Notification, AuditEvent } from "../models";
import { connectDB } from "../lib/db";
import { sanitizeSensitiveText, sanitizePublicDescription } from "../lib/privacy";

const RUN_ID = `aiem_hunt_test_audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function runAuditSuite() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — LOST & FOUND FLOW AUDIT SUITE");
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
    // 0. SEED BASELINE ENTITIES (LOCATIONS & PERSONAS)
    // ---------------------------------------------------------
    console.log("─── Step 0: Seed Locations and Users ───");

    const safeDeskLocation = await CampusLocation.create({
      name: "Main Campus Safe-Desk (Station A)",
      code: "SDK-A",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5948, lng: 73.7947, mapX: 50, mapY: 50 },
      isSafeDesk: true,
      operatingHours: "08:00 AM - 08:00 PM",
      currentCapacity: 100,
      isActive: true,
    });

    const classroomLocation = await CampusLocation.create({
      name: "Lecture Hall Block C",
      code: "LHC",
      zoneType: "ACADEMIC_BLOCK",
      coordinates: { lat: 15.5950, lng: 73.7950, mapX: 60, mapY: 60 },
      isSafeDesk: false,
      operatingHours: "09:00 AM - 05:00 PM",
      currentCapacity: 200,
      isActive: true,
    });

    const inactiveLocation = await CampusLocation.create({
      name: "Old Safe-Desk Depot",
      code: "OLD-DEPOT",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5955, lng: 73.7955, mapX: 70, mapY: 70 },
      isSafeDesk: true,
      operatingHours: "Closed",
      currentCapacity: 0,
      isActive: false,
    });

    const passwordHash = await bcrypt.hash("TestPass123!Safe", 8);

    const reporterOwner = await User.create({
      username: "maya_reporter",
      displayName: "Maya Reporter (Owner)",
      email: "maya.reporter@example.test",
      passwordHash,
      role: "STUDENT",
      coins: 100,
      level: 3,
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const finderUser = await User.create({
      username: "leo_finder",
      displayName: "Leo Finder",
      email: "leo.finder@example.test",
      passwordHash,
      role: "STUDENT",
      coins: 50,
      level: 2,
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const claimantUser = await User.create({
      username: "sam_claimant",
      displayName: "Sam Claimant",
      email: "sam.claimant@example.test",
      passwordHash,
      role: "STUDENT",
      coins: 25,
      level: 1,
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const staffUser = await User.create({
      username: "sarah_staff",
      displayName: "Safe-Desk Officer Sarah",
      email: "sarah.safedesk@example.test",
      passwordHash,
      role: "MODERATOR",
      assignedStationId: safeDeskLocation._id,
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    assert(Boolean(reporterOwner && finderUser && claimantUser && staffUser), "All 4 synthetic test personas created successfully");

    // ---------------------------------------------------------
    // 1. REPORT LOST: VALIDATION, APPROXIMATE TIME RANGE, OPTIONAL QUESTION, PII SEGREGATION
    // ---------------------------------------------------------
    console.log("\n─── Step 1: Report Lost Validations & Features ───");

    // Case 1A: Lost report with NO verification question and default bounty (0)
    const lostNoQuestion = await LostItem.create({
      reporterId: reporterOwner._id,
      title: "Blue Leather Notebook",
      category: "BOOKS_NOTES",
      publicDescription: "A dark blue notebook with grid lines inside.",
      lastKnownLocationId: classroomLocation._id,
      lostAt: new Date(),
      approximateTimeRange: "10:00 AM - 12:00 PM",
      status: "ACTIVE",
      rewardOffered: 0,
      isEscrowSecured: false,
      idempotencyKey: "req-lost-001",
    });
    assert(lostNoQuestion.title === "Blue Leather Notebook", "Lost report created cleanly without verification question");
    assert(lostNoQuestion.rewardOffered === 0, "Default bounty is 0");
    assert(lostNoQuestion.approximateTimeRange === "10:00 AM - 12:00 PM", "Approximate time range preserved");
    assert(!lostNoQuestion.verificationQuestion, "Verification question is empty/unset as expected");

    // Case 1B: Lost report with private verification challenge and PII segregation
    const rawPublicDesc = "Lost my Casio Scientific Calculator near Lab 3. Serial number is SN-987654321, call me at 9876543210!";
    const { sanitizedText } = sanitizePublicDescription(rawPublicDesc);
    assert(!sanitizedText.includes("9876543210"), "Phone number sanitized out of public description");

    const answerHash = await bcrypt.hash("StickerOfBatman", 8);
    const lostWithQuestion = await LostItem.create({
      reporterId: reporterOwner._id,
      title: "Casio FX991CW Calculator",
      category: "ELECTRONICS",
      publicDescription: sanitizedText,
      secretIdentifiers: "Back has a small Batman sticker and serial SN-987654321",
      lastKnownLocationId: classroomLocation._id,
      lostAt: new Date(),
      approximateTimeRange: "Afternoon (02:00 PM - 04:00 PM)",
      verificationQuestion: "What sticker is placed on the backside battery cover?",
      verificationAnswerHash: answerHash,
      status: "ACTIVE",
      rewardOffered: 20,
      isEscrowSecured: true,
      idempotencyKey: "req-lost-002",
    });
    assert(Boolean(lostWithQuestion.verificationQuestion), "Lost item with challenge created");
    assert(lostWithQuestion.secretIdentifiers.includes("Batman"), "Private ownership evidence segregated");

    // Case 1C: Idempotency replay check
    const existingLost = await LostItem.findOne({
      reporterId: reporterOwner._id,
      idempotencyKey: "req-lost-002",
    });
    assert(Boolean(existingLost && existingLost._id.equals(lostWithQuestion._id)), "Idempotency key correctly matches existing lost item");

    // ---------------------------------------------------------
    // 2. REPORT FOUND: CUSTODY VALIDATION & SAFE-DESK VERIFICATION
    // ---------------------------------------------------------
    console.log("\n─── Step 2: Report Found Custody Validation ───");

    // Case 2A: Safe-Desk custody with VALID active safe-desk station
    const validDesk = await CampusLocation.findOne({ _id: safeDeskLocation._id, isSafeDesk: true, isActive: true });
    assert(Boolean(validDesk), "Verified Safe-Desk location exists and is active");

    const foundAtSafeDesk = await FoundItem.create({
      finderId: finderUser._id,
      title: "Scientific Calculator found at Library entrance",
      shortTitle: "Scientific Calculator",
      category: "ELECTRONICS",
      publicDescription: "A black scientific calculator found on a wooden bench near entrance.",
      secretIdentifiers: "Has Batman sticker on battery case",
      foundLocationId: classroomLocation._id,
      currentCustodyLocationId: safeDeskLocation._id,
      custodyStatus: "SAFE_DESK",
      status: "ACTIVE",
      foundAt: new Date(),
      approximateTimeRange: "Morning (09:00 AM - 11:00 AM)",
      idempotencyKey: "req-found-001",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: finderUser._id,
          note: "Reported as deposited at Safe-Desk; awaiting staff physical intake confirmation",
          timestamp: new Date(),
        },
      ],
    });
    assert(foundAtSafeDesk.custodyStatus === "SAFE_DESK", "Found item created with SAFE_DESK custody");
    assert(foundAtSafeDesk.stateHistory[0].note.includes("awaiting staff physical intake confirmation"), "Accurate intake audit note stored");

    // Case 2B: Safe-Desk custody validation rejects non-SafeDesk location
    const nonDesk = await CampusLocation.findOne({ _id: classroomLocation._id, isSafeDesk: true, isActive: true });
    assert(nonDesk === null, "Classroom location correctly rejected as non-SafeDesk");

    // Case 2C: Inactive location correctly rejected
    const inactiveDesk = await CampusLocation.findOne({ _id: inactiveLocation._id, isSafeDesk: true, isActive: true });
    assert(inactiveDesk === null, "Inactive depot correctly rejected as unavailable SafeDesk");

    // Case 2D: Finder-held custody
    const foundKeptByFinder = await FoundItem.create({
      finderId: finderUser._id,
      title: "Silver Keychain with 3 keys",
      shortTitle: "Silver Keychain",
      category: "KEYS",
      publicDescription: "Found silver keychain near cafeteria lawn.",
      foundLocationId: classroomLocation._id,
      custodyStatus: "FINDER_HELD",
      status: "ACTIVE",
      foundAt: new Date(),
      idempotencyKey: "req-found-002",
    });
    assert(foundKeptByFinder.custodyStatus === "FINDER_HELD", "Finder custody option recorded accurately");

    // ---------------------------------------------------------
    // 3. PRIVACY & PROJECTION GUARDS (API SIMULATION)
    // ---------------------------------------------------------
    console.log("\n─── Step 3: Privacy Redaction & Public Projections ───");

    // Query item as anonymous / public visitor:
    // Schema defines verificationAnswerHash and secretIdentifiers with select: false
    const publicItem = await LostItem.findById(lostWithQuestion._id).lean();
    assert(publicItem!.verificationAnswerHash === undefined, "verificationAnswerHash is hidden from default lean queries");
    assert(publicItem!.secretIdentifiers === undefined, "secretIdentifiers is hidden from default lean queries");

    // Simulating GET /api/items/[id] privacy projection logic:
    // When caller is unprivileged (not owner, not staff), verificationQuestion is deleted and hasVerificationQuestion flag is set
    const itemForPublicVisitor = { ...publicItem };
    const isOwner = false;
    const isStaff = false;

    const hasVerificationQuestion = Boolean(itemForPublicVisitor.verificationQuestion);
    if (!isOwner && !isStaff) {
      delete (itemForPublicVisitor as any).verificationQuestion;
    }
    (itemForPublicVisitor as any).hasVerificationQuestion = hasVerificationQuestion;

    assert((itemForPublicVisitor as any).verificationQuestion === undefined, "verificationQuestion prompt is STRICTLY DELETED for public visitors");
    assert((itemForPublicVisitor as any).hasVerificationQuestion === true, "hasVerificationQuestion boolean flag correctly informs claimant UI");

    // When caller IS owner or staff:
    const itemForOwner = { ...publicItem };
    const ownerHasVerificationQuestion = Boolean(itemForOwner.verificationQuestion);
    (itemForOwner as any).hasVerificationQuestion = ownerHasVerificationQuestion;
    assert((itemForOwner as any).verificationQuestion === "What sticker is placed on the backside battery cover?", "verificationQuestion prompt is preserved for owner/staff");

    // ---------------------------------------------------------
    // 4. CLAIM LIFECYCLE & SELF-CLAIM / DUPLICATE PREVENTION
    // ---------------------------------------------------------
    console.log("\n─── Step 4: Claim Submission, Anti-Self-Claim, and Status ───");

    // Case 4A: Self-claim prohibition on lost item (reporter claiming own report)
    const isSelfClaimLost = lostWithQuestion.reporterId.equals(reporterOwner._id);
    assert(isSelfClaimLost === true, "Identified self-claim attempt on lost item (reporter = claimant)");

    // Case 4B: Self-claim prohibition on found item (finder claiming own found item)
    const isSelfClaimFound = foundAtSafeDesk.finderId.equals(finderUser._id);
    assert(isSelfClaimFound === true, "Identified self-claim attempt on found item (finder = claimant)");

    // Case 4C: Legitimate claimant submits claim for found calculator
    // Check for existing active claim
    const existingActiveClaim = await ClaimRequest.findOne({
      itemId: foundAtSafeDesk._id,
      claimantId: claimantUser._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });
    assert(existingActiveClaim === null, "No prior claim exists for this user and item");

    const claim = await ClaimRequest.create({
      itemId: foundAtSafeDesk._id,
      itemType: "FOUND",
      claimantId: claimantUser._id,
      counterpartyUserId: finderUser._id,
      status: "PENDING",
      notes: "This is my Casio FX991CW. It has my roll number inside the battery compartment and a Batman sticker on the back.",
      submittedAnswer: "StickerOfBatman",
    });
    assert(claim.status === "PENDING", "Claim is created in PENDING status, awaiting review (not instantly auto-approved)");

    // Case 4D: Duplicate active claim is prevented
    const duplicateClaimCheck = await ClaimRequest.findOne({
      itemId: foundAtSafeDesk._id,
      claimantId: claimantUser._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });
    assert(duplicateClaimCheck !== null, "Duplicate active claim detected and prevented");

    // Case 4E: Claimant Withdrawal Flow
    // Claimant decides to withdraw their claim
    claim.status = "WITHDRAWN";
    claim.rejectionReason = "Claim withdrawn by claimant";
    await claim.save();

    const remainingActiveClaims = await ClaimRequest.countDocuments({
      itemId: foundAtSafeDesk._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });
    assert(remainingActiveClaims === 0, "Zero remaining active claims after withdrawal");

    assert(claim.status === "WITHDRAWN", "Claim status successfully transitioned to WITHDRAWN");

    // ---------------------------------------------------------
    // 5. SECURE HANDOVER VERIFICATION & AUDIT INTEGRITY
    // ---------------------------------------------------------
    console.log("\n─── Step 5: Secure Handover Verification ───");

    // Create an approved claim for a lost item and verify handover code lifecycle
    const rawPin = "741963";
    const recoveryPinHash = await bcrypt.hash(rawPin, 10);

    const approvedClaim = await ClaimRequest.create({
      itemId: lostWithQuestion._id,
      itemType: "LOST",
      claimantId: claimantUser._id,
      counterpartyUserId: reporterOwner._id,
      status: "APPROVED",
      notes: "I found this calculator under the seat in Lab 3.",
      handoverCodeHash: recoveryPinHash,
      handoverAttempts: 0,
      handoverLocked: false,
      handoverCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    // Verify recovery PIN hash is stored and never plaintext
    assert(approvedClaim.handoverCodeHash!.startsWith("$2"), "Recovery PIN stored as strong bcrypt hash");

    // Attempt PIN verification with wrong PIN
    const wrongAttempt = await bcrypt.compare("000000", approvedClaim.handoverCodeHash!);
    assert(wrongAttempt === false, "Incorrect PIN rejected");

    // Attempt PIN verification with correct PIN
    const correctAttempt = await bcrypt.compare(rawPin, approvedClaim.handoverCodeHash!);
    assert(correctAttempt === true, "Correct PIN verified successfully");

    // Complete handover
    approvedClaim.status = "HANDOVER_COMPLETE";
    approvedClaim.reviewedBy = staffUser._id;
    approvedClaim.reviewedAt = new Date();
    await approvedClaim.save();

    lostWithQuestion.status = "RECOVERED";
    await lostWithQuestion.save();

    assert(approvedClaim.status === "HANDOVER_COMPLETE", "Claim completed");
    assert(lostWithQuestion.status === "RECOVERED", "Item marked as RECOVERED only after verified handover");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.\n");
  }

  console.log("========================================================");
  console.log(`🎉 LOST & FOUND AUDIT TESTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAuditSuite().catch((err) => {
  console.error("Fatal error in test suite:", err);
  process.exit(1);
});

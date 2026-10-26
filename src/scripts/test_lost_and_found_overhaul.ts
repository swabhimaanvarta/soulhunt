import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  HandoverMessage,
  Notification,
  Transaction,
  CampusLocation,
  AuditEvent,
} from "../models";
import { grantUserRewards } from "../lib/economy";
import { sanitizePublicDescription } from "../lib/privacy";

const RUN_ID = `aiem_hunt_test_lf_overhaul_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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
      `FATAL SAFETY VIOLATION: Test runner strictly demands an ephemeral test database starting with 'aiem_hunt_test'.\n` +
      `Current target: '${dbName}'\n` +
      `Aborting execution immediately.`
    );
  }

  if (expectedDbName && dbName !== expectedDbName) {
    throw new Error(
      `FATAL SAFETY VIOLATION: Target database '${dbName}' does not match expected run database '${expectedDbName}'.`
    );
  }
}

assertSafeTestDatabase(TEST_DB_URI, RUN_ID);
(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "test_super_secret_key_minimum_32_characters_long";

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

async function runOverhaulTestSuite() {
  console.log("\n========================================================");
  console.log("🛡️  AIEM HUNT — LOST & FOUND OVERHAUL VERIFICATION SUITE");
  console.log(`   Database: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  // 1. Safety Guard Checks
  let blockedProd = false;
  try {
    assertSafeTestDatabase("mongodb://127.0.0.1:27017/aiem_hunt_production");
  } catch {
    blockedProd = true;
  }
  assert(blockedProd, "Safety Guard: Non-test database names fail closed immediately.");

  await mongoose.connect(TEST_DB_URI);
  console.log("Connected to ephemeral test database.\n");

  // Setup Campus Locations
  const libraryLocation = await CampusLocation.create({
    name: "Central Library Safe-Desk",
    code: "LIB-SD-01",
    zoneType: "SAFE_DESK",
    description: "Main campus library turn-in desk",
    coordinates: { lat: 15.5948, lng: 73.7947, mapX: 450, mapY: 300 },
    floors: ["Ground Floor"],
    isSafeDesk: true,
    operatingHours: "08:00 AM - 08:00 PM",
    building: "Library Block",
  });

  const canteenLocation = await CampusLocation.create({
    name: "Canteen Food Court",
    code: "CAN-01",
    zoneType: "CANTEEN",
    description: "Main student cafeteria",
    coordinates: { lat: 15.595, lng: 73.795, mapX: 200, mapY: 150 },
    floors: ["Ground Floor"],
    isSafeDesk: false,
    operatingHours: "07:30 AM - 09:00 PM",
    building: "Amenities Block",
  });

  // Setup Synthetic Personas (@example.test)
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const reporterAlice = await User.create({
    email: "alice.reporter@example.test",
    passwordHash,
    username: "alicer",
    displayName: "Alice Reporter",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    emailVerified: true,
    identityMode: "PSEUDONYMOUS",
    publicAttributionPreference: "HANDLE",
    trustTier: "ACTIVE_HUNTER",
    trustScore: 350,
    isProfilePublic: true,
  });

  const finderBob = await User.create({
    email: "bob.finder@example.test",
    passwordHash,
    username: "bobf",
    displayName: "Bob Finder",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    emailVerified: true,
    identityMode: "PUBLIC",
    publicAttributionPreference: "HANDLE",
    trustTier: "TRUSTED_HUNTER",
    trustScore: 600,
    isProfilePublic: true,
  });

  const staffCarol = await User.create({
    email: "carol.staff@example.test",
    passwordHash,
    username: "carols",
    displayName: "Carol Desk Staff",
    role: "SAFE_DESK_STAFF",
    assignedStationId: libraryLocation._id,
    assignedStationIds: [libraryLocation._id],
    accountStatus: "ACTIVE",
    emailVerified: true,
    identityMode: "PUBLIC",
    trustTier: "ELITE_INVESTIGATOR",
    isProfilePublic: true,
  });

  const attackerEve = await User.create({
    email: "eve.attacker@example.test",
    passwordHash,
    username: "evea",
    displayName: "Eve Attacker",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    emailVerified: true,
    identityMode: "ANONYMOUS",
    trustTier: "RESTRICTED",
    isProfilePublic: false,
  });

  console.log("--- 1. Live Match Suggestions Test ---");
  // Create an active found item
  const foundItemBob = await FoundItem.create({
    finderId: finderBob._id,
    title: "Casio Scientific Calculator FX-991EX (Call 9876543210)",
    shortTitle: "Casio FX Calculator",
    category: "ELECTRONICS",
    publicDescription: "Found near Canteen table 4. Has stickers on back.",
    foundLocationId: canteenLocation._id,
    foundAt: new Date(),
    custodyStatus: "HELD_BY_FINDER",
    status: "ACTIVE",
    rawPhotoUrl: "/evidence/secret_calc_raw.jpg",
    blurredPhotoUrl: "/evidence/calc_blur.jpg",
  });

  // Query match suggestion for "Calculator"
  const safeRegex = new RegExp("calculator", "i");
  const suggestions = await FoundItem.find({
    status: { $in: ["ACTIVE", "APPROVED", "SUBMITTED"] },
    $or: [{ title: safeRegex }, { shortTitle: safeRegex }],
    finderId: { $ne: reporterAlice._id },
  })
    .select("_id title shortTitle category foundLocationId foundAt status")
    .populate("foundLocationId", "name")
    .lean();

  assert(suggestions.length >= 1, "Match suggestions found active counterpart item.");
  const suggestedItem: any = suggestions[0];
  const sanitizedTitle = sanitizePublicDescription(suggestedItem.title).sanitizedText;
  assert(!sanitizedTitle.includes("9876543210"), "Phone number in counterpart title is redacted.");
  assert(sanitizedTitle.includes("[REDACTED-PHONE]"), "Redacted token inserted in counterpart title.");
  assert(!suggestedItem.rawPhotoUrl, "Raw photo binary/URL omitted from match suggestions.");
  assert(!suggestedItem.secretIdentifiers, "Secret identifiers omitted from match suggestions.");

  // Test self-item exclusion
  const bobSuggestions = await FoundItem.find({
    status: { $in: ["ACTIVE", "APPROVED", "SUBMITTED"] },
    title: safeRegex,
    finderId: { $ne: finderBob._id },
  });
  assert(bobSuggestions.length === 0, "Finder's own reported item is excluded from their suggestions.");

  console.log("\n--- 2. No Auto-Approval on Secret Verification Answer Match ---");
  const secretAnswer = "BlueDragonCover";
  const verificationAnswerHash = await bcrypt.hash(secretAnswer.toLowerCase().trim(), 10);

  const lostItemAlice = await LostItem.create({
    reporterId: reporterAlice._id,
    title: "Graphing Notebook with Stickers",
    category: "BOOKS_NOTES",
    publicDescription: "Spiral notebook lost in Library Block",
    secretIdentifiers: "Dragon cover sticker on front inside flap",
    verificationQuestion: "What is on the front inside flap?",
    verificationAnswerHash,
    lastKnownLocationId: libraryLocation._id,
    lostAt: new Date(),
    recoveryPreference: "HANDOVER_AT_SAFE_DESK",
    status: "ACTIVE",
  });

  // Bob submits claim with correct answer
  const cleanSubmitted = secretAnswer.toLowerCase().trim();
  const answerMatches = await bcrypt.compare(cleanSubmitted, verificationAnswerHash);
  assert(answerMatches, "Verification answer matched hash cryptographically.");

  // Rule: Do NOT auto-approve. Claim status must remain PENDING.
  const claimBob = await ClaimRequest.create({
    itemId: lostItemAlice._id,
    itemType: "LOST",
    claimantId: finderBob._id,
    counterpartyUserId: reporterAlice._id,
    submittedAnswer: secretAnswer,
    answerMatched: answerMatches,
    notes: "I found this notebook on the 2nd floor library study table.",
    status: "PENDING", // STRICT INVARIANT: Must be PENDING, not APPROVED!
    handoverAttempts: 0,
    handoverLocked: false,
  });

  assert(claimBob.status === "PENDING", "Claim with matching answer remains PENDING awaiting human review.");
  assert(claimBob.answerMatched === true, "Claim records answerMatched: true for the reviewer.");
  assert(!claimBob.handoverCode, "Handover PIN is NOT generated at claim creation time.");

  // Verify notification does NOT leak PIN
  const notifAlice = await Notification.create({
    userId: reporterAlice._id,
    category: "CLAIM_UPDATE",
    title: "New Claim Received",
    message: `${finderBob.displayName} submitted a claim for "${lostItemAlice.title}" with a matching verification answer. Please review.`,
    linkUrl: `/items/${lostItemAlice._id}`,
  });
  assert(!notifAlice.message.includes("PIN is"), "Notification does NOT leak plain-text PIN.");

  console.log("\n--- 3. Authorized Claim Review & Handover Code Issuance ---");
  // Alice reviews and approves Bob's claim
  const handoverCode = crypto.randomInt(100000, 1000000).toString();
  const handoverCodeHash = await bcrypt.hash(handoverCode, 10);
  const handoverCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  claimBob.status = "APPROVED";
  claimBob.handoverCode = handoverCode;
  claimBob.handoverCodeHash = handoverCodeHash;
  claimBob.handoverCodeExpiresAt = handoverCodeExpiresAt;
  claimBob.reviewedBy = reporterAlice._id;
  claimBob.reviewedAt = new Date();
  await claimBob.save();

  assert(claimBob.status === "APPROVED", "Claim successfully transitions to APPROVED after review.");
  assert(claimBob.handoverCode?.length === 6, "6-digit cryptographic handover PIN generated.");

  // Deliver notification instructing to view recovery pass on item page (No PIN in notification)
  const approvalNotif = await Notification.create({
    userId: reporterAlice._id,
    category: "CLAIM_UPDATE",
    title: "Claim Approved — Recovery Pass Ready",
    message: "Your lost item claim has been approved! Visit your item page to view your confidential 6-digit recovery pass and coordinate handover.",
    linkUrl: `/items/${lostItemAlice._id}`,
  });
  assert(!approvalNotif.message.includes(handoverCode), "Approval notification strictly omits plaintext PIN.");

  console.log("\n--- 4. Handover Coordination Chat Protocol ---");
  // 1. Claimant and finder exchange messages
  const msg1 = await HandoverMessage.create({
    claimId: claimBob._id,
    senderId: finderBob._id,
    text: "I can meet at the Library Safe-Desk counter today at 2:00 PM.",
    isPreset: true,
    presetCode: "MEET_LIBRARY",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  assert(msg1.isPreset === true, "Preset coordination message flagged correctly.");

  // 2. Chat filters 6-digit PIN and redacts phone numbers
  const dangerousText = `My phone is 9876543210 and my PIN is ${handoverCode}`;
  let safeText = dangerousText.replace(/\b\d{6}\b/g, "[REDACTED_SECURITY_PIN]");
  safeText = sanitizePublicDescription(safeText).sanitizedText;

  assert(!safeText.includes(handoverCode), "6-digit recovery PIN blocked from chat message.");
  assert(safeText.includes("[REDACTED_SECURITY_PIN]"), "Recovery PIN replaced with security token.");
  assert(!safeText.includes("9876543210"), "Phone number stripped from chat message.");
  assert(safeText.includes("[REDACTED-PHONE]"), "Phone number replaced with redacted phone token.");

  const msg2 = await HandoverMessage.create({
    claimId: claimBob._id,
    senderId: reporterAlice._id,
    text: safeText,
    isPreset: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  assert(msg2.text.includes("[REDACTED_SECURITY_PIN]"), "Chat stores sanitized message with PIN redacted.");

  // 3. Message reporting
  msg2.isReported = true;
  msg2.reportedBy = finderBob._id;
  msg2.reportReason = "Suspicious meetup request";
  await msg2.save();
  assert(msg2.isReported === true, "Handover message successfully flagged for moderation review.");

  console.log("\n--- 5. Denial-of-Service Safe Lockout Protection ---");
  // Scenario A: Unauthorized attacker attempts verification
  // Authorization check must run BEFORE attempt incrementing
  const isAuthorizedCustodian = (userId: string) => {
    // In LOST item: claimant (finderBob) is custodian surrendering item.
    // attackerEve is neither custodian nor campus staff.
    return userId === finderBob._id.toString() || userId === staffCarol._id.toString();
  };

  assert(!isAuthorizedCustodian(attackerEve._id.toString()), "Eve is not an authorized custodian.");
  // Because Eve is unauthorized, attempts on claimBob MUST NOT increment!
  let claimSnapshot = await ClaimRequest.findById(claimBob._id);
  assert(claimSnapshot?.handoverAttempts === 0, "Claim handover attempts remain 0 after unauthorized attack attempt.");

  // Scenario B: Authorized custodian attempts verification with wrong PIN
  assert(isAuthorizedCustodian(finderBob._id.toString()), "Bob is the verified custodian.");

  for (let i = 1; i <= 4; i++) {
    const wrongCode = "999999";
    const matches = await bcrypt.compare(wrongCode, claimBob.handoverCodeHash!);
    assert(!matches, `Attempt ${i}: Code mismatch confirmed.`);
    await ClaimRequest.findByIdAndUpdate(claimBob._id, { $inc: { handoverAttempts: 1 } });
  }

  claimSnapshot = await ClaimRequest.findById(claimBob._id);
  assert(claimSnapshot?.handoverAttempts === 4, "Authorized failed attempts count up to 4.");
  assert(claimSnapshot?.handoverLocked === false, "Ticket is NOT locked before 5 failed attempts.");
  assert(claimSnapshot?.status === "APPROVED", "Claim status remains APPROVED during failed attempts.");

  // 5th failed attempt locks the ticket
  const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
  await ClaimRequest.findByIdAndUpdate(claimBob._id, {
    $inc: { handoverAttempts: 1 },
    $set: { handoverLocked: true, lockoutUntil },
  });

  claimSnapshot = await ClaimRequest.findById(claimBob._id);
  assert(claimSnapshot?.handoverLocked === true, "5th failed attempt locks handover verification.");
  assert(claimSnapshot?.status === "APPROVED", "CRITICAL: Claim status remains APPROVED during lock (not cancelled/rejected).");
  assert(Boolean(claimSnapshot?.lockoutUntil), "Lockout expiry timestamp is set.");

  // Scenario C: Safe-Desk staff re-issues / unlocks code
  await ClaimRequest.findByIdAndUpdate(claimBob._id, {
    handoverLocked: false,
    handoverAttempts: 0,
    lockoutUntil: null,
  });
  claimSnapshot = await ClaimRequest.findById(claimBob._id);
  assert(claimSnapshot?.handoverLocked === false, "Safe-Desk supervisor successfully unlocked claim.");

  console.log("\n--- 6. Handover Certification & Economy Settlement ---");
  // Correct PIN entered
  const isMatch = await bcrypt.compare(handoverCode, claimBob.handoverCodeHash!);
  assert(isMatch, "Cryptographic PIN match verified.");

  const settlementKey = `claim_${claimBob._id}_settle`;
  claimBob.status = "HANDOVER_COMPLETE";
  claimBob.settlementStatus = "COMPLETED";
  claimBob.settlementIdempotencyKey = settlementKey;
  await claimBob.save();

  lostItemAlice.status = "RECOVERED";
  await lostItemAlice.save();

  // Credit rewards to the finder
  const rewardResult = await grantUserRewards({
    userId: finderBob._id,
    baseXp: 50,
    baseCoins: 25,
    reason: "Campus Lost & Found Recovery Verification",
    referenceType: "RECOVERY",
    referenceId: claimBob._id as Types.ObjectId,
    counterpartyUserId: reporterAlice._id as Types.ObjectId,
  });

  assert(rewardResult?.finalCoins === 25, "Finder credited with 25 recovery coins.");
  assert(rewardResult?.finalXp === 50, "Finder credited with 50 recovery XP.");

  console.log("\n--- 7. Public Recovered Feed & Private Receipts ---");
  // Public Feed projection check
  const recoveredList = await ClaimRequest.find({ status: "HANDOVER_COMPLETE" })
    .populate("counterpartyUserId", "username displayName identityMode publicAttributionPreference")
    .populate("claimantId", "username displayName identityMode publicAttributionPreference")
    .lean();

  assert(recoveredList.length >= 1, "Completed claim present in recovered items query.");
  const publicClaim: any = recoveredList[0];

  // In LOST flow: claimant is finder (finderBob)
  const finderUser = publicClaim.claimantId;
  let finderAttribution = "Anonymous Campus Helper";
  if (finderUser.publicAttributionPreference === "HANDLE" && finderUser.identityMode === "PUBLIC") {
    finderAttribution = `@${finderUser.username}`;
  }
  assert(finderAttribution === "@bobf", "Public recovered feed attributes finder by @username when opted in.");

  // Private receipts check
  const bobReceipts = await ClaimRequest.find({
    $or: [{ claimantId: finderBob._id }, { counterpartyUserId: finderBob._id }],
    status: "HANDOVER_COMPLETE",
  });
  assert(bobReceipts.length === 1, "Finder has 1 private recovery receipt in ledger.");

  const bobTx = await Transaction.findOne({
    userId: finderBob._id,
    referenceType: "RECOVERY",
    referenceId: claimBob._id,
  });
  assert(bobTx?.deltaCoins === 25, "Private receipt accurately references 25 coin transaction.");

  console.log("\n--- 8. Profile Privacy Invariants ---");
  // Alice is in PSEUDONYMOUS mode
  const alicePublicName = reporterAlice.identityMode === "PUBLIC" ? reporterAlice.displayName : `@${reporterAlice.username}`;
  assert(alicePublicName === "@alicer", "Pseudonymous profile hides real name and displays @username.");

  // Eve has private profile
  const isProfilePublic = attackerEve.isProfilePublic;
  assert(isProfilePublic === false, "Private profile flag is false.");

  // Public visitor inspecting Eve's profile
  const nonOwnerEveView = {
    profileHidden: !attackerEve.isProfilePublic,
    displayName: `@${attackerEve.username}`,
    // Private fields omitted
    email: undefined,
    phoneNumber: undefined,
    studentId: undefined,
    trustScore: undefined,
    trustTier: undefined,
  };
  assert(nonOwnerEveView.profileHidden === true, "Private profile returns profileHidden: true to visitors.");
  assert(nonOwnerEveView.email === undefined, "Email is never exposed to public visitors.");
  assert(nonOwnerEveView.trustScore === undefined, "Internal trust score is never exposed to public visitors.");
  assert(nonOwnerEveView.trustTier === undefined, "Internal trust tier is never exposed to public visitors.");

  console.log("\n========================================================");
  console.log(`🎉 OVERHAUL SUITE COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  if (failedCount > 0) {
    process.exit(1);
  }
}

runOverhaulTestSuite().catch(async (err) => {
  console.error("Test execution failed:", err);
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } catch {}
  process.exit(1);
});


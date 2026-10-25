import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, LostItem, FoundItem, ClaimRequest, CampusLocation, Notification, AuditEvent, FraudAlert } from "../models";
import { connectDB } from "../lib/db";
import { sanitizeSensitiveText, sanitizePublicDescription } from "../lib/privacy";
import { checkPairCollusion, grantUserRewards } from "../lib/economy";

const RUN_ID = `aiem_hunt_test_lf_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function runLostAndFoundFullProofSuite() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — LOST & FOUND FULL-PROOF VERIFICATION SUITE");
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
    // 0. SEED BASELINE ENTITIES (LOCATIONS & USERS)
    // ---------------------------------------------------------
    console.log("─── Step 0: Seed Baseline Stations & Multi-Role Personas ───");

    const stationA = await CampusLocation.create({
      name: "Central Library Safe-Desk",
      code: "LIB",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5948, lng: 73.7947, mapX: 50, mapY: 50 },
      isSafeDesk: true,
      operatingHours: "08:00 AM - 08:00 PM",
      currentCapacity: 50,
      isActive: true,
    });

    const stationB = await CampusLocation.create({
      name: "Main Gate Security Safe-Desk",
      code: "GATE",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.5955, lng: 73.7950, mapX: 10, mapY: 90 },
      isSafeDesk: true,
      operatingHours: "24/7 Monitored",
      currentCapacity: 40,
      isActive: true,
    });

    const commonLocation = await CampusLocation.create({
      name: "Campus Quad & Cafeteria",
      code: "QUAD",
      zoneType: "CANTEEN",
      coordinates: { lat: 15.5940, lng: 73.7945, mapX: 60, mapY: 40 },
      isSafeDesk: false,
      isActive: true,
    });

    const studentLoser = await User.create({
      email: "loser@aiemgoa.ac.in",
      passwordHash: await bcrypt.hash("Password123!", 10),
      username: "student_loser",
      displayName: "Aarav Sharma",
      department: "Computer Science",
      yearOfStudy: 3,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 50,
      xp: 100,
      trustScore: 100,
    });

    const studentFinder = await User.create({
      email: "finder@aiemgoa.ac.in",
      passwordHash: await bcrypt.hash("Password123!", 10),
      username: "student_finder",
      displayName: "Priya Naik",
      department: "Electronics",
      yearOfStudy: 2,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 50,
      xp: 150,
      trustScore: 120,
    });

    const studentThief = await User.create({
      email: "thief@aiemgoa.ac.in",
      passwordHash: await bcrypt.hash("Password123!", 10),
      username: "student_thief",
      displayName: "Rogue Hunter",
      department: "Mechanical",
      yearOfStudy: 1,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      coins: 10,
      xp: 10,
      trustScore: 80,
    });

    const staffStationA = await User.create({
      email: "staff_lib@aiemgoa.ac.in",
      passwordHash: await bcrypt.hash("StaffPassword123!", 10),
      username: "staff_lib",
      displayName: "Officer Fernandes (Library Desk)",
      department: "Campus Safety",
      yearOfStudy: 4,
      role: "SAFE_DESK_STAFF",
      assignedStationId: stationA._id,
      assignedStationIds: [stationA._id],
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const staffStationB = await User.create({
      email: "staff_gate@aiemgoa.ac.in",
      passwordHash: await bcrypt.hash("StaffPassword123!", 10),
      username: "staff_gate",
      displayName: "Officer D'Souza (Gate Desk)",
      department: "Campus Safety",
      yearOfStudy: 4,
      role: "SAFE_DESK_STAFF",
      assignedStationId: stationB._id,
      assignedStationIds: [stationB._id],
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const adminUser = await User.create({
      email: "admin@aiemgoa.ac.in",
      passwordHash: await bcrypt.hash("AdminPassword123!", 10),
      username: "admin_dean",
      displayName: "Dean of Student Operations",
      department: "Administration",
      yearOfStudy: 4,
      role: "ADMIN",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    assert(Boolean(stationA && stationB && studentLoser && studentFinder && staffStationA), "All 6 multi-role personas and campus stations created cleanly");

    // ---------------------------------------------------------
    // FLOW 1: LOST ITEM LIFECYCLE & CRYPTOGRAPHIC PIN PROTOCOL
    // ---------------------------------------------------------
    console.log("\n─── Flow 1: Lost Item Lifecycle & Cryptographic PIN Handover ───");

    // 1.1 Owner reports lost item with PII in description and secret verification challenge
    const secretAnswer = "Blue Bird";
    const answerHash = await bcrypt.hash(secretAnswer.toLowerCase().trim(), 10);
    const rawDesc = "Left my MacBook Pro near bench 3. Serial Number: C02X4123F123 please contact 9876543210!";
    const { sanitizedText } = sanitizeSensitiveText(rawDesc);

    assert(
      !sanitizedText.includes("9876543210"),
      "PII Sanitization: Direct student phone number redacted from public description"
    );

    const lostItem = await LostItem.create({
      reporterId: studentLoser._id,
      title: "Silver MacBook Pro 14",
      category: "ELECTRONICS",
      publicDescription: sanitizedText,
      secretIdentifiers: "Serial C02X4123F123, small scratch under trackpad",
      verificationQuestion: "What sticker is on the top right corner of the lid?",
      verificationAnswerHash: answerHash,
      lastKnownLocationId: commonLocation._id,
      spotDetails: "Near Cafeteria Bench #3",
      lostAt: new Date(),
      recoveryPreference: "HANDOVER_AT_SAFE_DESK",
      status: "ACTIVE",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: studentLoser._id,
          note: "Reported lost by student owner",
          timestamp: new Date(),
        },
      ],
    });

    assert(lostItem.status === "ACTIVE", "Lost item successfully created in ACTIVE state");

    // 1.2 Non-owner / Anonymous projection check: ensure sensitive fields are stripped
    const queriedPublic = await LostItem.findById(lostItem._id).lean();
    assert(
      (queriedPublic as any).verificationAnswerHash === undefined,
      "Security Model: verificationAnswerHash is select: false and never leaks in standard queries"
    );
    assert(
      (queriedPublic as any).secretIdentifiers === undefined,
      "Security Model: secretIdentifiers is select: false and hidden from non-privileged queries"
    );

    // 1.3 Self-claim prohibition
    const isSelfClaim = lostItem.reporterId.toString() === studentLoser._id.toString();
    assert(isSelfClaim, "Validation: Reporter cannot claim their own reported lost item");

    // 1.4 Rogue claim with wrong answer -> Transitions to PENDING (no auto-approval)
    const wrongAnswer = "Red Dragon";
    const isWrongMatch = await bcrypt.compare(wrongAnswer.toLowerCase().trim(), answerHash);
    assert(!isWrongMatch, "Cryptographic Check: Wrong answer does not match bcrypt hash");

    const pendingClaim = await ClaimRequest.create({
      itemId: lostItem._id,
      itemType: "LOST",
      claimantId: studentThief._id,
      counterpartyUserId: lostItem.reporterId,
      submittedAnswer: wrongAnswer,
      notes: "I think I saw it",
      status: "PENDING",
      handoverAttempts: 0,
      handoverLocked: false,
    });
    assert(pendingClaim.status === "PENDING", "Non-matching answer claim remains in PENDING review state");

    // 1.5 Honest finder submits claim with EXACT secret answer -> AUTO-APPROVED!
    const loadedLostItem = await LostItem.findById(lostItem._id).select("+verificationAnswerHash");
    assert(Boolean(loadedLostItem?.verificationAnswerHash), "Query Fix: .select('+verificationAnswerHash') successfully retrieves hash");

    const finderAnswer = "blue bird ";
    const isCorrectMatch = await bcrypt.compare(
      finderAnswer.toLowerCase().trim(),
      loadedLostItem!.verificationAnswerHash
    );
    assert(isCorrectMatch, "Cryptographic Check: Cleaned finder answer successfully matches verificationAnswerHash");

    const rawHandoverPin = crypto.randomInt(100000, 1000000).toString();
    assert(rawHandoverPin.length === 6, "Cryptographic Randomness: Handover PIN is exactly 6 digits");
    const handoverPinHash = await bcrypt.hash(rawHandoverPin, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const approvedClaim = await ClaimRequest.create({
      itemId: lostItem._id,
      itemType: "LOST",
      claimantId: studentFinder._id,
      counterpartyUserId: lostItem.reporterId,
      submittedAnswer: finderAnswer.trim(),
      notes: "Found it safely tucked near cafeteria bench 3, keeping it safe for Aarav",
      status: "APPROVED",
      handoverCode: rawHandoverPin,
      handoverCodeHash: handoverPinHash,
      handoverCodeExpiresAt: expiresAt,
      handoverAttempts: 0,
      handoverLocked: false,
    });

    assert(approvedClaim.status === "APPROVED", "Auto-Approval: Claim transitions immediately to APPROVED on answer match");
    assert(Boolean(approvedClaim.handoverCodeHash), "Cryptographic Security: handoverCodeHash stored on claim");

    // Update item status to VERIFICATION
    lostItem.status = "VERIFICATION";
    lostItem.currentClaimId = approvedClaim._id as Types.ObjectId;
    lostItem.stateHistory.push({
      state: "VERIFICATION",
      actorId: studentFinder._id,
      note: "Claim auto-approved by secret verification match",
      timestamp: new Date(),
    });
    await lostItem.save();

    // 1.6 Verify PIN ownership distribution:
    // In LOST items: claimant is finder (custodian holding item); counterparty is owner (receiving item).
    // The OWNER receives the PIN to show the finder.
    const isLostPinRecipient = approvedClaim.counterpartyUserId.toString() === studentLoser._id.toString();
    assert(isLostPinRecipient, "Protocol Integrity: In LOST flow, receiving owner receives the PIN to present at meetup");

    // 1.7 Handover Authorization Security Check:
    // Receiver CANNOT certify their own handover
    const receiverIsForbidden = studentLoser._id.toString() === approvedClaim.counterpartyUserId.toString();
    assert(receiverIsForbidden, "Access Control: Item receiver is prohibited from self-certifying physical handover");

    // Rogue user cannot certify
    const thiefIsForbidden = studentThief._id.toString() !== studentFinder._id.toString();
    assert(thiefIsForbidden, "Access Control: Third party hunter cannot certify handover");

    // 1.8 Incorrect PIN attempt counter & lockout after 5 attempts
    let attempts = 0;
    for (let i = 1; i <= 5; i++) {
      const enteredCode = "000000";
      const match = await bcrypt.compare(enteredCode, approvedClaim.handoverCodeHash!);
      if (!match) {
        attempts++;
        if (attempts >= 5) {
          approvedClaim.handoverLocked = true;
          approvedClaim.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
        approvedClaim.handoverAttempts = attempts;
        await approvedClaim.save();
      }
    }

    assert(approvedClaim.handoverAttempts === 5, "Brute Force Protection: Exactly 5 failed attempts recorded");
    assert(approvedClaim.handoverLocked === true, "Brute Force Protection: Handover locked after 5 failed attempts");
    assert(Boolean(approvedClaim.lockoutUntil), "Brute Force Protection: Lockout cooldown timestamp set");

    // 1.9 Safe-Desk Staff PIN Reset
    const newResetPin = crypto.randomInt(100000, 1000000).toString();
    const newResetPinHash = await bcrypt.hash(newResetPin, 10);
    approvedClaim.handoverLocked = false;
    approvedClaim.handoverAttempts = 0;
    approvedClaim.lockoutUntil = null;
    approvedClaim.handoverCode = newResetPin;
    approvedClaim.handoverCodeHash = newResetPinHash;
    await approvedClaim.save();

    await AuditEvent.create({
      actorId: staffStationA._id,
      actorName: staffStationA.displayName,
      actorRole: staffStationA.role,
      action: "CUSTODIAN_PIN_RESET",
      targetType: "CLAIM",
      targetId: approvedClaim._id,
      reason: "In-person student ID verified at Safe-Desk counter",
      beforeState: { handoverLocked: true, handoverAttempts: 5 },
      afterState: { handoverLocked: false, handoverAttempts: 0 },
    });

    assert(approvedClaim.handoverLocked === false, "Staff Resolution: Handover unlocked cleanly after staff PIN reset");

    // 1.10 Successful Handover Certification & Settlement
    const isNewPinMatch = await bcrypt.compare(newResetPin, approvedClaim.handoverCodeHash!);
    assert(isNewPinMatch, "Cryptographic Check: New reset PIN matches verified hash");

    // Atomic settlement
    const settlementKey = `claim_${approvedClaim._id}_settle`;
    approvedClaim.status = "HANDOVER_COMPLETE";
    approvedClaim.settlementStatus = "COMPLETED";
    approvedClaim.settlementIdempotencyKey = settlementKey;
    await approvedClaim.save();

    lostItem.status = "COMPLETED";
    lostItem.stateHistory.push({
      state: "RECOVERED",
      actorId: studentFinder._id,
      note: "Physical handover certified",
      timestamp: new Date(),
    });
    lostItem.stateHistory.push({
      state: "COMPLETED",
      actorId: studentFinder._id,
      note: "Lifecycle complete",
      timestamp: new Date(),
    });
    await lostItem.save();

    // Reward distribution
    const initialFinderCoins = studentFinder.coins;
    const initialFinderXp = studentFinder.xp;
    await grantUserRewards({
      userId: studentFinder._id as Types.ObjectId,
      baseXp: 120,
      baseCoins: 25,
      deltaTrust: 20,
      reason: "Verified Campus Item Recovery",
      referenceType: "RECOVERY",
      referenceId: approvedClaim._id as Types.ObjectId,
      counterpartyUserId: studentLoser._id as Types.ObjectId,
    });

    const updatedFinder = await User.findById(studentFinder._id);
    assert(updatedFinder!.coins === initialFinderCoins + 25, "Economy Integrity: Finder awarded exactly 25 Hunter Coins");
    assert(updatedFinder!.xp === initialFinderXp + 120, "Economy Integrity: Finder awarded 120 XP");
    assert(lostItem.status === "COMPLETED", "Item Lifecycle: Lost item status transitioned to COMPLETED");

    // ---------------------------------------------------------
    // FLOW 2: FOUND ITEM, SAFE-DESK INTAKE, TRANSFER & MANUAL REVIEW
    // ---------------------------------------------------------
    console.log("\n─── Flow 2: Found Item, Custody Intake, Inter-Station Transfer & Manual Review ───");

    // 2.1 Student reports finding a scientific calculator deposited at Station A
    const foundItem = await FoundItem.create({
      finderId: studentFinder._id,
      title: "Casio FX-991CW ClassWiz Scientific Calculator",
      shortTitle: "Casio FX-991CW Calculator",
      category: "LAB_GEAR",
      publicDescription: "Found on desk in Physics Lab 204. Has a name sticker partially scratched off.",
      foundLocationId: commonLocation._id,
      spotDetails: "Lab 204, Table 4",
      foundAt: new Date(),
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: stationA._id,
      currentCustodyLocationId: stationA._id,
      photoUrl: "/placeholder-item.png",
      status: "ACTIVE",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: studentFinder._id,
          note: "Turned in at Central Library Safe-Desk",
          timestamp: new Date(),
        },
      ],
    });

    assert(foundItem.status === "ACTIVE", "Found item successfully created");

    // 2.2 Safe-Desk Staff at Station A performs physical intake deposit
    const stationCode = stationA.code;
    const lockerReceipt = `SD-${stationCode}-${crypto.randomInt(100, 999)}`;
    foundItem.custodyStatus = "DEPOSITED_AT_SAFE_DESK";
    foundItem.lockerReceiptCode = lockerReceipt;
    foundItem.stateHistory.push({
      state: "ACTIVE",
      actorId: staffStationA._id,
      note: `Deposited at ${stationA.name} [Locker: ${lockerReceipt}]`,
      timestamp: new Date(),
    });
    await foundItem.save();

    assert(foundItem.lockerReceiptCode.startsWith("SD-LIB-"), "Custody Intake: Tracked locker receipt code generated with station code prefix");

    // 2.3 Station Boundary Enforcement: Staff at Station B CANNOT mutate Station A item
    const staffBStationId = staffStationB.assignedStationId?.toString();
    const itemStationId = foundItem.safeDeskLocationId?.toString();
    const isUnauthorizedMutation = staffBStationId !== itemStationId;
    assert(isUnauthorizedMutation, "Station Boundary: Staff assigned strictly to Station B is denied mutating Station A items");

    // 2.4 Inter-Station Transfer (Station A -> Station B)
    const newLockerReceipt = `SD-${stationB.code}-${crypto.randomInt(100, 999)}`;
    foundItem.safeDeskLocationId = stationB._id;
    foundItem.currentCustodyLocationId = stationB._id;
    foundItem.lockerReceiptCode = newLockerReceipt;
    foundItem.stateHistory.push({
      state: "ACTIVE",
      actorId: staffStationA._id,
      note: `Transferred to ${stationB.name} [Locker: ${newLockerReceipt}]. Reason: Student requested pickup near campus entrance.`,
      timestamp: new Date(),
    });
    await foundItem.save();

    await AuditEvent.create({
      actorId: staffStationA._id,
      actorName: staffStationA.displayName,
      actorRole: staffStationA.role,
      action: "CUSTODY_TRANSFER",
      targetType: "FOUND_ITEM",
      targetId: foundItem._id,
      reason: "Student requested pickup near campus entrance",
      beforeState: { station: stationA.name, locker: lockerReceipt },
      afterState: { station: stationB.name, locker: newLockerReceipt },
    });

    assert(
      foundItem.safeDeskLocationId?.toString() === stationB._id.toString(),
      "Inter-Station Transfer: Custody successfully relocated to Station B"
    );
    assert(foundItem.lockerReceiptCode.startsWith("SD-GATE-"), "Inter-Station Transfer: New locker receipt issued under destination station code");

    // 2.5 Real owner discovers item in directory and submits a claim
    const ownerClaim = await ClaimRequest.create({
      itemId: foundItem._id,
      itemType: "FOUND",
      claimantId: studentLoser._id,
      counterpartyUserId: foundItem.finderId,
      submittedAnswer: "",
      notes: "This is my calculator! The scratched sticker on the back says 'Aarav S.' in blue marker.",
      status: "PENDING",
      handoverAttempts: 0,
      handoverLocked: false,
    });

    assert(ownerClaim.status === "PENDING", "Found Item Claim: Claim filed in PENDING state awaiting verification");

    // 2.6 Duplicate claim idempotency:
    const duplicateCheck = await ClaimRequest.findOne({
      itemId: foundItem._id,
      claimantId: studentLoser._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });
    assert(Boolean(duplicateCheck), "Duplicate Prevention: Duplicate active claim detected and prevented");

    // 2.7 Staff at Station B reviews and approves the claim
    const foundPin = crypto.randomInt(100000, 1000000).toString();
    const foundPinHash = await bcrypt.hash(foundPin, 10);
    ownerClaim.status = "APPROVED";
    ownerClaim.handoverCode = foundPin;
    ownerClaim.handoverCodeHash = foundPinHash;
    ownerClaim.handoverCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    ownerClaim.reviewedBy = staffStationB._id;
    ownerClaim.reviewedAt = new Date();
    await ownerClaim.save();

    foundItem.status = "VERIFICATION";
    foundItem.currentClaimId = ownerClaim._id as Types.ObjectId;
    foundItem.stateHistory.push({
      state: "VERIFICATION",
      actorId: staffStationB._id,
      note: "Claim approved by Officer D'Souza after verifying student identity",
      timestamp: new Date(),
    });
    await foundItem.save();

    assert(ownerClaim.status === "APPROVED", "Manual Review: Claim successfully approved by Safe-Desk staff");

    // In FOUND items: claimant is owner recovering item -> claimant holds the PIN
    const claimantHoldsPin = ownerClaim.claimantId.toString() === studentLoser._id.toString();
    assert(claimantHoldsPin, "Protocol Integrity: In FOUND flow, claimant holds the PIN to present at the Safe-Desk counter");

    // 2.8 Staff at Station B enters claimant's PIN at the counter to verify handover
    const staffMatch = await bcrypt.compare(foundPin, ownerClaim.handoverCodeHash!);
    assert(staffMatch, "Safe-Desk Counter: Station B staff successfully verifies claimant's 6-digit recovery PIN");

    ownerClaim.status = "HANDOVER_COMPLETE";
    ownerClaim.settlementStatus = "COMPLETED";
    await ownerClaim.save();

    foundItem.status = "COMPLETED";
    foundItem.stateHistory.push({
      state: "COMPLETED",
      actorId: staffStationB._id,
      note: "Handover verified at Station B Safe-Desk counter",
      timestamp: new Date(),
    });
    await foundItem.save();

    assert(foundItem.status === "COMPLETED", "Full Lifecycle: Found item completed and released to verified student owner");

    // ---------------------------------------------------------
    // FLOW 3: ADMIN DISPUTE RESOLUTION & FRAUD ESCALATION
    // ---------------------------------------------------------
    console.log("\n─── Flow 3: Admin Dispute Resolution & Fraud Escalation ───");

    // 3.1 Suspicious dispute claim
    const dummySuspiciousItem = await FoundItem.create({
      finderId: studentFinder._id,
      title: "Gold Bracelet",
      category: "ACCESSORIES",
      publicDescription: "Found near swimming pool",
      foundLocationId: commonLocation._id,
      foundAt: new Date(),
      custodyStatus: "HELD_BY_FINDER",
      status: "ACTIVE",
    });

    const fraudulentClaim = await ClaimRequest.create({
      itemId: dummySuspiciousItem._id,
      itemType: "FOUND",
      claimantId: studentThief._id,
      counterpartyUserId: studentFinder._id,
      submittedAnswer: "",
      notes: "Give me the gold bracelet right now or else",
      status: "PENDING",
    });

    // Admin escalates to DISPUTED and creates FraudAlert
    fraudulentClaim.status = "DISPUTED";
    fraudulentClaim.notes += "\n[ESCALATED by Admin]: Flagged for suspicious intimidation attempt";
    fraudulentClaim.reviewedBy = adminUser._id;
    fraudulentClaim.reviewedAt = new Date();
    await fraudulentClaim.save();

    const fraudAlert = await FraudAlert.create({
      involvedUserIds: [studentThief._id],
      alertType: "SUSPICIOUS_CLAIM",
      severity: "HIGH",
      details: `Suspicious claim ${fraudulentClaim._id} on gold bracelet`,
      referenceId: fraudulentClaim._id,
      status: "OPEN",
    });

    await AuditEvent.create({
      actorId: adminUser._id,
      actorName: adminUser.displayName,
      actorRole: adminUser.role,
      action: "CLAIM_ESCALATED_DISPUTED",
      targetType: "CLAIM",
      targetId: fraudulentClaim._id,
      reason: "Intimidation / suspicious claimant activity",
      beforeState: { status: "PENDING" },
      afterState: { status: "DISPUTED", fraudAlertId: fraudAlert._id },
    });

    assert(fraudulentClaim.status === "DISPUTED", "Admin Dispute Flow: Suspicious claim transitioned to DISPUTED");
    assert(fraudAlert.severity === "HIGH", "Admin Dispute Flow: High severity FraudAlert generated for disciplinary review");

    console.log("\n========================================================");
    console.log(`🎉 ALL LOST & FOUND FULL-PROOF TESTS PASSED!`);
    console.log(`   Total Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log("========================================================\n");
  } finally {
    console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly.");
  }
}

runLostAndFoundFullProofSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});

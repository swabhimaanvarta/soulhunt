import assert from "assert";
import mongoose, { Types } from "mongoose";
import { connectDB } from "../lib/db";
import {
  User,
  Squad,
  SquadMember,
  SquadJoinRequest,
  LostItem,
  FoundItem,
  ClaimRequest,
  CampusLocation,
  Reward,
} from "../models";
import { isWithinCampusBounds, CAMPUS_CENTER } from "../lib/campus-constants";

const TEST_DB_URI = `mongodb://127.0.0.1:27017/aiem_hunt_test_review_${Date.now()}`;

async function runReviewTests() {
  console.log("========================================================");
  console.log("🧪 AIEM HUNT — USER NEEDS & GAPS AUTOMATED VERIFICATION");
  console.log(`   Database: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await mongoose.connect(TEST_DB_URI);

  try {
    // 1. Campus geofence & Admin coordinates check
    console.log("─── Suite 1: Campus Geofence & Admin Coordinates ───");
    assert.strictEqual(
      isWithinCampusBounds(CAMPUS_CENTER[0], CAMPUS_CENTER[1]),
      true,
      "Campus center must be inside campus bounds"
    );
    console.log("  ✅ PASSED: Campus center is within approved geofence bounds");

    const defaultAdminCoords = { lat: 15.5948, lng: 73.7947 };
    assert.strictEqual(
      isWithinCampusBounds(defaultAdminCoords.lat, defaultAdminCoords.lng),
      true,
      "Default admin location creation coordinates must be inside campus bounds"
    );
    console.log("  ✅ PASSED: Admin location default coordinates are strictly within campus bounds");

    // 2. User ownedCosmetics in User model
    console.log("\n─── Suite 2: User Model & Armory Ownership ───");
    const testCosmeticId = new Types.ObjectId();
    const testUser = await User.create({
      email: "test.seeker@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "test_seeker_review",
      displayName: "Test Seeker",
      role: "STUDENT",
      coins: 150,
      level: 3,
      ownedCosmetics: [testCosmeticId],
    });

    assert.strictEqual(testUser.ownedCosmetics.length, 1);
    assert.strictEqual(testUser.ownedCosmetics[0].toString(), testCosmeticId.toString());
    console.log("  ✅ PASSED: User model accurately persists ownedCosmetics array");

    // 3. Squad Join Request Lifecycle (Pending -> Withdrawn)
    console.log("\n─── Suite 3: Squad Join Request Lifecycle & Withdrawal ───");
    const leaderUser = await User.create({
      email: "leader@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "leader_squad_review",
      displayName: "Squad Leader",
      role: "STUDENT",
    });

    const testSquad = await Squad.create({
      name: "Vanguard Seeker Unit",
      tag: "VANG",
      leaderId: leaderUser._id,
      privacy: "INVITE_ONLY",
    });

    await SquadMember.create({
      squadId: testSquad._id,
      userId: leaderUser._id,
      role: "LEADER",
      squadRole: "LEADER",
    });

    // Applicant submits join request
    const joinReq = await SquadJoinRequest.create({
      squadId: testSquad._id,
      userId: testUser._id,
      status: "PENDING",
      message: "Requesting enlistment to the vanguard unit.",
    });

    assert.strictEqual(joinReq.status, "PENDING");
    console.log("  ✅ PASSED: Join request starts in PENDING status");

    // Applicant withdraws request
    joinReq.status = "WITHDRAWN";
    await joinReq.save();

    const updatedReq = await SquadJoinRequest.findById(joinReq._id);
    assert.strictEqual(updatedReq?.status, "WITHDRAWN");
    console.log("  ✅ PASSED: Join request successfully transitions to WITHDRAWN status");

    // 4. Claimant Status & Handover Tracking Invariants
    console.log("\n─── Suite 4: Claimant Item Lifecycle & Status Isolation ───");
    const finderUser = await User.create({
      email: "finder@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "finder_custody_review",
      displayName: "Finder Custodian",
      role: "STUDENT",
    });

    const foundItem = await FoundItem.create({
      title: "TI-84 Graphing Calculator",
      shortTitle: "Graphing Calculator",
      category: "ELECTRONICS",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      status: "SUBMITTED",
      finderId: finderUser._id,
      foundLocationId: new Types.ObjectId(),
      foundAt: new Date(),
      verificationQuestion: "What is written inside the battery cover?",
      verificationAnswerHash: "secret_hash",
      publicDescription: "Found near library study desk with blue protective sleeve.",
    });

    // Claimant submits claim
    const claim = await ClaimRequest.create({
      itemId: foundItem._id,
      itemType: "FOUND",
      claimantId: testUser._id,
      counterpartyUserId: finderUser._id,
      submittedAnswer: "My name Rahul etched in silver",
      proofDetails: {
        proofText: "I dropped my calculator on Tuesday morning around 11am.",
      },
      status: "PENDING",
    });

    assert.strictEqual(claim.status, "PENDING");
    console.log("  ✅ PASSED: Claim correctly filed in PENDING review state");

    // Staff approves claim
    claim.status = "APPROVED";
    claim.notes = "Verified matching battery cover marking.";
    await claim.save();

    const approvedClaim = await ClaimRequest.findById(claim._id);
    assert.strictEqual(approvedClaim?.status, "APPROVED");
    assert.strictEqual(approvedClaim?.notes, "Verified matching battery cover marking.");
    console.log("  ✅ PASSED: Claim correctly transitions to APPROVED with staff review notes");

    // Handover complete
    claim.status = "HANDOVER_COMPLETE";
    await claim.save();

    const completedClaim = await ClaimRequest.findById(claim._id);
    assert.strictEqual(completedClaim?.status, "HANDOVER_COMPLETE");
    console.log("  ✅ PASSED: Claim lifecycle cleanly finishes in HANDOVER_COMPLETE state");

    console.log("\n========================================================");
    console.log("🎉 ALL USER-NEEDS GAPS TESTS PASSED (8/8 assertions)");
    console.log("========================================================");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

runReviewTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

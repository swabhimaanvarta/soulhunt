/**
 * Milestone 1 Challenger Adversarial Stress Harness
 * 
 * Target: GET /api/user/operations & Personal Operations Activity Center
 * Evaluates:
 * 1. Zero records & query parameter boundaries (limit=0, limit=999, negative, invalid)
 * 2. Dangling / orphaned claims (pointing to deleted items, deleted counterparties)
 * 3. Mismatched item types (LOST claim pointing to FoundItem, FOUND claim pointing to LostItem)
 * 4. High-concurrency stress harness (50 simultaneous requests)
 * 5. Full mathematical enum state machine verification for all live badges
 * 6. Leakage check on sensitive internal fields
 */

import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import {
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  CampusLocation,
  Investigation,
  Quest,
} from "../models";
import { GET as getOperationsRoute } from "../app/api/user/operations/route";

import crypto from "crypto";
import { connectDB } from "../lib/db";

const RUN_ID = `aiem_hunt_adv_m1_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "test_super_secret_key_minimum_32_characters_long";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, desc: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASSED: ${desc}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${desc}`, detail !== undefined ? detail : "");
    failedCount++;
  }
}

async function invokeRoute(user: any, query = ""): Promise<{ status: number; body: any }> {
  (globalThis as any).__TEST_CURRENT_USER__ = user;
  const url = `http://localhost:3000/api/user/operations${query ? `?${query}` : ""}`;
  const req = new NextRequest(url, { method: "GET" });
  const res = await getOperationsRoute(req);
  const body = await res.json();
  return { status: res.status, body };
}

async function runAdversarialSuite() {
  console.log("========================================================");
  console.log("⚔️ STARTING M1 ADVERSARIAL CHALLENGER SUITE");
  console.log(`   Ephemeral DB: ${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  try {
    // ---------------------------------------------------------
    // TEST SECTION 1: Zero Records & Query Param Boundaries
    // ---------------------------------------------------------
    console.log("🧪 TEST 1: Zero Records & Parameter Boundaries");

    const zeroUser = await User.create({
      email: "zero_hunter@aiem.edu",
      passwordHash: "hash_zero_123",
      username: "zero_hunter",
      displayName: "Zero Hunter",
      avatarUrl: "/avatars/zero.png",
      department: "Mathematics",
      yearOfStudy: 1,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    // 1.1 Standard query
    const res1 = await invokeRoute(zeroUser);
    assert(res1.status === 200, "Zero-records user returns HTTP 200");
    assert(res1.body.success === true, "Zero-records response success is true");
    assert(res1.body.data.counts.lostTotal === 0, "Zero lostTotal");
    assert(res1.body.data.counts.foundTotal === 0, "Zero foundTotal");
    assert(res1.body.data.counts.claimsTotal === 0, "Zero claimsTotal");
    assert(res1.body.data.counts.cluesSolvedTotal === 0, "Zero cluesSolvedTotal");
    assert(res1.body.data.counts.evidenceTotal === 0, "Zero evidenceTotal");
    assert(Array.isArray(res1.body.data.lostItems) && res1.body.data.lostItems.length === 0, "lostItems is empty array");
    assert(Array.isArray(res1.body.data.foundItems) && res1.body.data.foundItems.length === 0, "foundItems is empty array");
    assert(Array.isArray(res1.body.data.claims) && res1.body.data.claims.length === 0, "claims is empty array");
    assert(Array.isArray(res1.body.data.clues) && res1.body.data.clues.length === 0, "clues is empty array");
    assert(Array.isArray(res1.body.data.evidence) && res1.body.data.evidence.length === 0, "evidence is empty array");

    // 1.2 Extreme & boundary query parameters
    const boundaryQueries = [
      "limit=0",
      "limit=9999",
      "limit=-10",
      "limit=garbage",
      "tab=nonexistent",
      "tab=lost&limit=1",
      "tab=found&limit=5",
      "tab=claims&limit=10",
      "tab=clues&limit=20",
    ];

    for (const q of boundaryQueries) {
      const resBoundary = await invokeRoute(zeroUser, q);
      assert(
        resBoundary.status === 200 && resBoundary.body.success === true,
        `Boundary query '${q}' handled gracefully with HTTP 200`
      );
    }

    // ---------------------------------------------------------
    // TEST SECTION 2: Dangling / Orphaned Claims & Mismatched Types
    // ---------------------------------------------------------
    console.log("\n🧪 TEST 2: Dangling Claims & Mismatched Item References");

    const actorUser = await User.create({
      email: "actor_m1@aiem.edu",
      passwordHash: "hash_actor_123",
      username: "actor_m1",
      displayName: "Actor One",
      avatarUrl: "/avatars/actor.png",
      department: "Robotics",
      yearOfStudy: 3,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const partnerUser = await User.create({
      email: "partner_m1@aiem.edu",
      passwordHash: "hash_partner_123",
      username: "partner_m1",
      displayName: "Partner Two",
      avatarUrl: "/avatars/partner.png",
      department: "Physics",
      yearOfStudy: 2,
      role: "SAFE_DESK_STAFF",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const campusLoc = await CampusLocation.create({
      name: "North Science Hub Safe Desk",
      code: "NSH-SD-01",
      zoneType: "SAFE_DESK",
      coordinates: { lat: 15.4, lng: 73.8, mapX: 200, mapY: 300 },
      isSafeDesk: true,
    });

    // 2.1 Create a LostItem and a FoundItem, then delete them to create orphaned claims
    const temporaryLostItem = await LostItem.create({
      title: "Temporary Quantum Sensor",
      category: "ELECTRONICS",
      publicDescription: "Experimental quantum sensor lost in lab",
      lostAt: new Date(),
      status: "ACTIVE",
      reporterId: partnerUser._id,
      lastKnownLocationId: campusLoc._id,
      rewardOffered: 120,
    });

    const temporaryFoundItem = await FoundItem.create({
      title: "Temporary Laser Pointer",
      shortTitle: "Laser Pointer",
      category: "LAB_GEAR",
      publicDescription: "Laser pointer found near podium",
      foundAt: new Date(),
      status: "ACTIVE",
      finderId: partnerUser._id,
      foundLocationId: campusLoc._id,
      currentCustodyLocationId: campusLoc._id,
      custodyStatus: "SAFE_DESK",
      lockerReceiptCode: "SD-TEMP-99",
    });

    const lostItemId = temporaryLostItem._id;
    const foundItemId = temporaryFoundItem._id;

    // Create claims pointing to them
    const orphanedLostClaim = await ClaimRequest.create({
      itemType: "LOST",
      itemId: lostItemId,
      claimantId: actorUser._id,
      counterpartyUserId: partnerUser._id,
      status: "PENDING",
      notes: "Claim on lost item that will be deleted",
    });

    const orphanedFoundClaim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: foundItemId,
      claimantId: actorUser._id,
      counterpartyUserId: partnerUser._id,
      status: "APPROVED",
      notes: "Claim on found item that will be deleted",
    });

    // 2.2 Create mismatched claims (LOST type pointing to FoundItem and vice versa)
    const validFoundItem = await FoundItem.create({
      title: "Valid Titanium Stylus",
      category: "ELECTRONICS",
      publicDescription: "Stylus found on desk",
      foundAt: new Date(),
      status: "ACTIVE",
      finderId: partnerUser._id,
      foundLocationId: campusLoc._id,
      currentCustodyLocationId: campusLoc._id,
      custodyStatus: "SAFE_DESK",
    });

    const validLostItem = await LostItem.create({
      title: "Valid Leather Notebook",
      category: "BOOKS_NOTES",
      publicDescription: "Brown leather journal misplaced",
      lostAt: new Date(),
      status: "ACTIVE",
      reporterId: partnerUser._id,
      lastKnownLocationId: campusLoc._id,
    });

    const mismatchedClaim1 = await ClaimRequest.create({
      itemType: "LOST", // Intentional mismatch: itemType is LOST, but itemId points to FoundItem
      itemId: validFoundItem._id,
      claimantId: actorUser._id,
      counterpartyUserId: partnerUser._id,
      status: "PENDING",
      notes: "Mismatched type: marked LOST but points to FoundItem",
    });

    const mismatchedClaim2 = await ClaimRequest.create({
      itemType: "FOUND", // Intentional mismatch: itemType is FOUND, but itemId points to LostItem
      itemId: validLostItem._id,
      claimantId: actorUser._id,
      counterpartyUserId: partnerUser._id,
      status: "PENDING",
      notes: "Mismatched type: marked FOUND but points to LostItem",
    });

    // 2.3 Create claim pointing to completely non-existent ObjectId
    const phantomClaim = await ClaimRequest.create({
      itemType: "LOST",
      itemId: new Types.ObjectId(),
      claimantId: actorUser._id,
      counterpartyUserId: partnerUser._id,
      status: "REJECTED",
      rejectionReason: "<script>alert('xss')</script> Invalid documentation provided ⚠️",
      notes: "Phantom item reference",
    });

    // Now DELETE the temporary items to make the first two claims truly orphaned
    await LostItem.deleteOne({ _id: lostItemId });
    await FoundItem.deleteOne({ _id: foundItemId });

    // Now execute query for actorUser
    const resOrphaned = await invokeRoute(actorUser);
    assert(resOrphaned.status === 200, "Query with orphaned and mismatched claims returns HTTP 200");
    assert(resOrphaned.body.success === true, "Response has success=true");
    assert(resOrphaned.body.data.claims.length === 5, "Received all 5 claims without crashing");

    // Check fallback behavior on orphaned claims
    const orphanedLostInResponse = resOrphaned.body.data.claims.find(
      (c: any) => c._id === orphanedLostClaim._id.toString()
    );
    assert(orphanedLostInResponse !== undefined, "Orphaned lost claim is present in response");
    assert(
      orphanedLostInResponse.itemTitle === "Campus Belonging",
      `Orphaned claim uses graceful fallback itemTitle (got: "${orphanedLostInResponse.itemTitle}")`
    );
    assert(
      orphanedLostInResponse.category === "OTHER",
      `Orphaned claim uses fallback category (got: "${orphanedLostInResponse.category}")`
    );
    assert(
      orphanedLostInResponse.item.status === "UNKNOWN",
      `Orphaned claim item.status is UNKNOWN (got: "${orphanedLostInResponse.item.status}")`
    );
    assert(
      orphanedLostInResponse.stationName === "Campus Safe-Desk Station",
      `Orphaned claim fallback station is Campus Safe-Desk Station (got: "${orphanedLostInResponse.stationName}")`
    );

    // Check mismatched claims fallback
    const mismatched1InResponse = resOrphaned.body.data.claims.find(
      (c: any) => c._id === mismatchedClaim1._id.toString()
    );
    assert(
      mismatched1InResponse.itemTitle === "Campus Belonging",
      "Mismatched LOST->FOUND claim safely falls back without crash"
    );

    // Check phantom claim rejection reason
    const phantomInResponse = resOrphaned.body.data.claims.find(
      (c: any) => c._id === phantomClaim._id.toString()
    );
    assert(
      phantomInResponse.rejectionReason === "<script>alert('xss')</script> Invalid documentation provided ⚠️",
      "Rejection reason string with symbols and tags preserved without mutation"
    );

    // ---------------------------------------------------------
    // TEST SECTION 3: Concurrency Stress Harness
    // ---------------------------------------------------------
    console.log("\n🧪 TEST 3: High-Concurrency Stress Harness (50 Concurrent Requests)");

    const CONCURRENCY = 50;
    const startTime = Date.now();

    const concurrentPromises = Array.from({ length: CONCURRENCY }, (_, i) => {
      // Alternate between zeroUser and actorUser to test interleaved connection handling
      const user = i % 2 === 0 ? zeroUser : actorUser;
      const tab = i % 4 === 0 ? "lost" : i % 4 === 1 ? "found" : i % 4 === 2 ? "claims" : "all";
      return invokeRoute(user, `tab=${tab}`).then((res) => ({
        index: i,
        status: res.status,
        success: res.body.success,
        counts: res.body.data?.counts,
      }));
    });

    const results = await Promise.all(concurrentPromises);
    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / CONCURRENCY;

    const allSuccessful = results.every((r) => r.status === 200 && r.success === true);
    assert(allSuccessful, `All 50 concurrent requests returned HTTP 200 with success=true`);

    // Verify tenant counts remain consistent under concurrency
    const zeroResults = results.filter((r) => r.index % 2 === 0);
    const actorResults = results.filter((r) => r.index % 2 !== 0);

    const zeroConsistent = zeroResults.every(
      (r) => r.counts && r.counts.lostTotal === 0 && r.counts.claimsTotal === 0
    );
    assert(zeroConsistent, "Zero-records user counts 100% consistent across all concurrent requests");

    const actorConsistent = actorResults.every(
      (r) => r.counts && r.counts.claimsTotal === 5
    );
    assert(actorConsistent, "Actor user claimsTotal=5 100% consistent across all concurrent requests");

    console.log(`     ⚡ Total concurrency duration: ${totalDuration}ms for 50 requests (Avg: ${avgDuration.toFixed(1)}ms/req)`);

    // ---------------------------------------------------------
    // TEST SECTION 4: Exhaustive Badge State Machine Consistency
    // ---------------------------------------------------------
    console.log("\n🧪 TEST 4: Exhaustive Badge State Machine & Enum Consistency");

    // Create a dedicated badge test user
    const badgeUser = await User.create({
      email: "badge_tester@aiem.edu",
      passwordHash: "hash_badge_123",
      username: "badge_tester",
      displayName: "Badge Tester",
      avatarUrl: "/avatars/badge.png",
      department: "Informatics",
      yearOfStudy: 4,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    // 4.1 Lost Item Status Matrix
    const lostItemStatuses = [
      { status: "SUBMITTED", expectedLabel: "Pending Triage", expectedColor: "amber" },
      { status: "UNDER_REVIEW", expectedLabel: "Under Review", expectedColor: "cyan" },
      { status: "ACTIVE", expectedLabel: "Active Search", expectedColor: "emerald" },
      { status: "APPROVED", expectedLabel: "Active Search", expectedColor: "emerald" },
      { status: "CLAIMED", expectedLabel: "Match Verification", expectedColor: "amber" },
      { status: "VERIFICATION", expectedLabel: "Match Verification", expectedColor: "amber" },
      { status: "RECOVERED", expectedLabel: "Recovered", expectedColor: "emerald" },
      { status: "COMPLETED", expectedLabel: "Recovered", expectedColor: "emerald" },
      { status: "REJECTED", expectedLabel: "Rejected", expectedColor: "rose" },
      { status: "DISPUTED", expectedLabel: "Disputed", expectedColor: "rose" },
      { status: "EXPIRED", expectedLabel: "Expired", expectedColor: "slate" },
      { status: "ARCHIVED", expectedLabel: "Archived", expectedColor: "slate" },
      { status: "CUSTOM_UNKNOWN", expectedLabel: "CUSTOM_UNKNOWN", expectedColor: "slate" },
    ];

    for (const testCase of lostItemStatuses) {
      let itemId: any;
      if (testCase.status === "CUSTOM_UNKNOWN") {
        const rawDoc = {
          _id: new Types.ObjectId(),
          title: `Item Status ${testCase.status}`,
          category: "OTHER",
          publicDescription: `Status test item for ${testCase.status}`,
          lostAt: new Date(),
          status: testCase.status,
          reporterId: badgeUser._id,
          lastKnownLocationId: campusLoc._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await mongoose.connection.collection("lostitems").insertOne(rawDoc as any);
        itemId = rawDoc._id;
      } else {
        const item = await LostItem.create({
          title: `Item Status ${testCase.status}`,
          category: "OTHER",
          publicDescription: `Status test item for ${testCase.status}`,
          lostAt: new Date(),
          status: testCase.status,
          reporterId: badgeUser._id,
          lastKnownLocationId: campusLoc._id,
        });
        itemId = item._id;
      }

      const res = await invokeRoute(badgeUser, `tab=lost&limit=100`);
      const foundInApi = res.body.data.lostItems.find((i: any) => i._id === itemId.toString());
      assert(foundInApi !== undefined, `Found lost item in API for state ${testCase.status}`);
      assert(
        foundInApi.liveBadge.label === testCase.expectedLabel,
        `Lost state '${testCase.status}' maps to label '${testCase.expectedLabel}' (got: '${foundInApi.liveBadge.label}')`
      );
      assert(
        foundInApi.liveBadge.color === testCase.expectedColor,
        `Lost state '${testCase.status}' maps to color '${testCase.expectedColor}' (got: '${foundInApi.liveBadge.color}')`
      );
    }

    // 4.2 Lost Item Converted to Bounty Quest
    const testQuest = await Quest.create({
      questCode: "Q-TEST-BOUNTY",
      title: "Test Bounty Quest",
      description: "Recover the lost device",
      questType: "INVESTIGATION",
      difficulty: 2,
      xpReward: 150,
      coinReward: 50,
      targetLocationId: campusLoc._id,
      creatorId: badgeUser._id,
      status: "ACTIVE",
    });

    const bountyLostItem = await LostItem.create({
      title: "Bounty Tracked Device",
      category: "ELECTRONICS",
      publicDescription: "Device converted to bounty quest",
      lostAt: new Date(),
      status: "ACTIVE",
      convertToQuest: true,
      linkedQuestId: testQuest._id,
      reporterId: badgeUser._id,
      lastKnownLocationId: campusLoc._id,
    });

    const resBounty = await invokeRoute(badgeUser, `tab=lost&limit=100`);
    const bountyFound = resBounty.body.data.lostItems.find((i: any) => i._id === bountyLostItem._id.toString());
    assert(
      bountyFound?.liveBadge.label === "Active Bounty Quest",
      `Lost item with linkedQuest maps to 'Active Bounty Quest' (got: '${bountyFound?.liveBadge.label}')`
    );
    assert(
      bountyFound?.liveBadge.color === "purple",
      `Lost item with linkedQuest maps to color 'purple' (got: '${bountyFound?.liveBadge.color}')`
    );
    assert(
      bountyFound?.linkedQuest?.code === "Q-TEST-BOUNTY",
      `Linked quest metadata properly mapped (got: '${bountyFound?.linkedQuest?.code}')`
    );

    // 4.3 Found Item Custody & Status Matrix
    const foundStatusMatrix = [
      { status: "RECOVERED", custody: "SAFE_DESK", label: "Returned to Owner", color: "emerald" },
      { status: "COMPLETED", custody: "SAFE_DESK", label: "Returned to Owner", color: "emerald" },
      { status: "CLAIMED", custody: "SAFE_DESK", label: "Claim Verification", color: "amber" },
      { status: "VERIFICATION", custody: "SAFE_DESK", label: "Claim Verification", color: "amber" },
      { status: "REJECTED", custody: "SAFE_DESK", label: "Intake Rejected", color: "rose" },
      { status: "ACTIVE", custody: "SAFE_DESK", label: "In Safe-Desk Custody", color: "cyan" },
      { status: "ACTIVE", custody: "DEPOSITED_AT_SAFE_DESK", label: "In Safe-Desk Custody", color: "cyan" },
      { status: "ACTIVE", custody: "HELD_BY_FINDER", label: "Finder Held (Pending Deposit)", color: "amber" },
      { status: "ACTIVE", custody: "FINDER_HELD", label: "Finder Held (Pending Deposit)", color: "amber" },
      { status: "ACTIVE", custody: "ADMIN_OFFICE", label: "In Moderator Custody", color: "cyan" },
      { status: "ACTIVE", custody: "HANDED_TO_MODERATOR", label: "In Moderator Custody", color: "cyan" },
      { status: "ACTIVE", custody: "UNKNOWN_LOCATION", label: "Intake Logged", color: "slate" },
    ];

    for (const testCase of foundStatusMatrix) {
      let itemId: any;
      if (testCase.custody === "UNKNOWN_LOCATION") {
        const rawFound = {
          _id: new Types.ObjectId(),
          title: `Found Matrix ${testCase.status}/${testCase.custody}`,
          category: "KEYS",
          publicDescription: `Found custody matrix item for ${testCase.status}/${testCase.custody}`,
          foundAt: new Date(),
          status: testCase.status,
          custodyStatus: testCase.custody,
          finderId: badgeUser._id,
          foundLocationId: campusLoc._id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await mongoose.connection.collection("founditems").insertOne(rawFound as any);
        itemId = rawFound._id;
      } else {
        const item = await FoundItem.create({
          title: `Found Matrix ${testCase.status}/${testCase.custody}`,
          category: "KEYS",
          publicDescription: `Found custody matrix item for ${testCase.status}/${testCase.custody}`,
          foundAt: new Date(),
          status: testCase.status,
          custodyStatus: testCase.custody,
          finderId: badgeUser._id,
          foundLocationId: campusLoc._id,
        });
        itemId = item._id;
      }

      const res = await invokeRoute(badgeUser, `tab=found&limit=100`);
      const foundInApi = res.body.data.foundItems.find((i: any) => i._id === itemId.toString());
      assert(
        foundInApi?.liveBadge.label === testCase.label,
        `Found [${testCase.status}, ${testCase.custody}] label is '${testCase.label}' (got: '${foundInApi?.liveBadge.label}')`
      );
      assert(
        foundInApi?.liveBadge.color === testCase.color,
        `Found [${testCase.status}, ${testCase.custody}] color is '${testCase.color}' (got: '${foundInApi?.liveBadge.color}')`
      );
    }

    // 4.4 Claim Status Matrix
    const claimStatusMatrix = [
      { status: "PENDING", locked: false, label: "Pending Review", color: "cyan", actionable: false },
      { status: "APPROVED", locked: false, label: "Handover Ready", color: "amber", actionable: true },
      { status: "APPROVED", locked: true, label: "PIN Locked (Max Tries)", color: "rose", actionable: false },
      { status: "HANDOVER_COMPLETE", locked: false, label: "Handover Complete", color: "emerald", actionable: false },
      { status: "REJECTED", locked: false, label: "Rejected", color: "rose", actionable: false },
      { status: "DISPUTED", locked: false, label: "Disputed", color: "rose", actionable: false },
      { status: "WITHDRAWN", locked: false, label: "Withdrawn", color: "slate", actionable: false },
      { status: "UNRECOGNIZED", locked: false, label: "UNRECOGNIZED", color: "slate", actionable: false },
    ];

    for (const testCase of claimStatusMatrix) {
      let claimId: any;
      if (testCase.status === "UNRECOGNIZED") {
        const rawClaim = {
          _id: new Types.ObjectId(),
          itemType: "LOST",
          itemId: bountyLostItem._id,
          claimantId: badgeUser._id,
          counterpartyUserId: partnerUser._id,
          status: testCase.status,
          handoverLocked: testCase.locked,
          handoverCode: "SECRET999",
          handoverCodeHash: "sha256_hash_secret",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await mongoose.connection.collection("claimrequests").insertOne(rawClaim as any);
        claimId = rawClaim._id;
      } else {
        const claim = await ClaimRequest.create({
          itemType: "LOST",
          itemId: bountyLostItem._id,
          claimantId: badgeUser._id,
          counterpartyUserId: partnerUser._id,
          status: testCase.status,
          handoverLocked: testCase.locked,
          handoverCode: "SECRET999",
          handoverCodeHash: "sha256_hash_secret",
        });
        claimId = claim._id;
      }

      const res = await invokeRoute(badgeUser, `tab=claims&limit=100`);
      const claimInApi = res.body.data.claims.find((c: any) => c._id === claimId.toString());
      assert(
        claimInApi?.liveBadge.label === testCase.label,
        `Claim [${testCase.status}, locked=${testCase.locked}] label is '${testCase.label}' (got: '${claimInApi?.liveBadge.label}')`
      );
      assert(
        claimInApi?.liveBadge.color === testCase.color,
        `Claim [${testCase.status}, locked=${testCase.locked}] color is '${testCase.color}' (got: '${claimInApi?.liveBadge.color}')`
      );
      assert(
        claimInApi?.liveBadge.actionable === testCase.actionable,
        `Claim [${testCase.status}, locked=${testCase.locked}] actionable is ${testCase.actionable} (got: ${claimInApi?.liveBadge.actionable})`
      );

      // Verify no plain handover code leak
      assert((claimInApi as any).handoverCode === undefined, "handoverCode is NOT in claim API output");
      assert((claimInApi as any).handoverCodeHash === undefined, "handoverCodeHash is NOT in claim API output");
    }

    // ---------------------------------------------------------
    // TEST SECTION 5: Clues and Evidence Nodes Aggregation
    // ---------------------------------------------------------
    console.log("\n🧪 TEST 5: Clues & Evidence Deductions Aggregation");

    const investigatorUser = await User.create({
      email: "deducer@aiem.edu",
      passwordHash: "hash_deducer_123",
      username: "master_deducer",
      displayName: "Master Deducer",
      avatarUrl: "/avatars/deducer.png",
      department: "Criminalistics",
      yearOfStudy: 3,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const testInvestigation = await Investigation.create({
      questId: testQuest._id,
      startedAt: new Date(),
      status: "IN_PROGRESS",
      solvedClues: [
        {
          clueId: new Types.ObjectId(),
          stageOrder: 1,
          solvedByUserId: investigatorUser._id,
          solvedByName: investigatorUser.displayName,
          solvedAt: new Date(Date.now() - 3600000),
        },
        {
          clueId: new Types.ObjectId(),
          stageOrder: 2,
          solvedByUserId: investigatorUser._id,
          solvedByName: investigatorUser.displayName,
          solvedAt: new Date(),
        },
      ],
      evidenceNodes: [
        {
          _id: new Types.ObjectId(),
          authorId: investigatorUser._id,
          authorName: investigatorUser.displayName,
          type: "PHOTO",
          title: "Surveillance footage still",
          content: "Spotted black backpack near safe desk at 14:15",
          upvotes: [zeroUser._id, partnerUser._id],
          createdAt: new Date(),
        },
      ],
    });

    const resInv = await invokeRoute(investigatorUser);
    assert(resInv.status === 200, "Investigation query returns HTTP 200");
    assert(resInv.body.data.counts.cluesSolvedTotal === 2, "cluesSolvedTotal is 2");
    assert(resInv.body.data.counts.evidenceTotal === 1, "evidenceTotal is 1");
    assert(resInv.body.data.clues.length === 2, "Received 2 clue entries");
    assert(resInv.body.data.evidence.length === 1, "Received 1 evidence node");
    assert(resInv.body.data.clues[0].stageOrder === 2, "Newest clue sorted first (stageOrder=2)");
    assert(resInv.body.data.evidence[0].upvotesCount === 2, "Evidence upvotes count correctly aggregated (got: 2)");
    assert(
      resInv.body.data.clues[0].liveBadge.label === "Verified Deduction",
      "Clue badge label is 'Verified Deduction'"
    );
    assert(
      resInv.body.data.evidence[0].liveBadge.label === "Active Case Board",
      "Evidence badge label is 'Active Case Board'"
    );

    console.log("\n========================================================");
    console.log(`📊 ADVERSARIAL CHALLENGE COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("========================================================");

  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Test database dropped cleanly.");
    } catch (cleanErr) {
      console.error("Cleanup error:", cleanErr);
    }
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error("Adversarial suite crashed:", err);
  process.exit(1);
});

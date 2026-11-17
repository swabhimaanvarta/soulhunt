import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  Investigation,
  Quest,
  CampusLocation,
} from "../models";
import { connectDB } from "../lib/db";
import { GET } from "../app/api/user/operations/route";

const RUN_ID = `aiem_hunt_test_ops_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

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

async function run() {
  console.log("========================================================");
  console.log("🚀 STARTING PERSONAL OPERATIONS LEDGER INTEGRATION SUITE");
  console.log(`   Database: ${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  // ------------------------------------------------------------------
  // SCENARIO 1: Unauthenticated request rejection
  // ------------------------------------------------------------------
  console.log("🧪 Scenario 1: Unauthenticated Access Guards");
  {
    (globalThis as any).__TEST_CURRENT_USER__ = null;
    const req = new NextRequest("http://localhost:3000/api/user/operations");
    const res = await GET(req);
    const json = await res.json();

    assert(res.status === 401, "Unauthenticated request returns HTTP 401");
    assert(json.success === false, "Unauthenticated response payload has success=false");
    assert(json.error?.code === "UNAUTHORIZED", "Error code is UNAUTHORIZED");
  }

  // ------------------------------------------------------------------
  // SEED DATA FOR INTEGRATION TESTS
  // ------------------------------------------------------------------
  console.log("\n🌱 Seeding test actors, campus locations, and operational records...");

  const testLocation = await CampusLocation.create({
    code: `LOC_LIB_${Date.now()}`,
    name: "Central Engineering Library",
    zoneType: "SAFE_DESK",
    building: "Library Block",
    floors: ["Ground", "2nd Floor"],
    description: "Quiet study hall with safe desk",
    coordinates: { lat: 15.2993, lng: 74.124, mapX: 450, mapY: 320 },
    isSafeDesk: true,
    operatingHours: "08:00 AM - 08:00 PM",
    isActive: true,
  });

  const alice = await User.create({
    email: `alice_${Date.now()}@aiemgoa.ac.in`,
    passwordHash: "hash_alice_123",
    username: `alice_scout_${Date.now()}`,
    displayName: "Alice Pathfinder",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    xp: 350,
    level: 2,
    coins: 100,
  });

  const bob = await User.create({
    email: `bob_${Date.now()}@aiemgoa.ac.in`,
    passwordHash: "hash_bob_123",
    username: `bob_hunter_${Date.now()}`,
    displayName: "Bob Investigator",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    xp: 120,
    level: 1,
    coins: 50,
  });

  const staffRamos = await User.create({
    email: `ramos_${Date.now()}@aiemgoa.ac.in`,
    passwordHash: "hash_staff_123",
    username: `ramos_desk_${Date.now()}`,
    displayName: "Officer Ramos",
    role: "SAFE_DESK_STAFF",
    accountStatus: "ACTIVE",
    assignedStationId: testLocation._id,
  });

  const testQuest = await Quest.create({
    questCode: "QUEST-ENG-001",
    title: "The Missing Lab Manual",
    description: "Find the missing thermal dynamics manual",
    difficulty: 2,
    xpReward: 150,
    coinReward: 50,
    status: "ACTIVE",
    questType: "INVESTIGATION",
    targetLocationId: testLocation._id,
  });

  // Seed Alice's Lost Item (Active Search)
  const aliceLostItem = await LostItem.create({
    reporterId: alice._id,
    title: "Blue Dell XPS 15 Laptop",
    category: "ELECTRONICS",
    publicDescription: "Left on 2nd floor desk near window.",
    secretIdentifiers: "SENSITIVE_SN_DELL_XYZ_9999",
    verificationQuestion: "What sticker is on the lid?",
    verificationAnswerHash: "HASH_OF_OCTOCAT_STICKER",
    lastKnownLocationId: testLocation._id,
    spotDetails: "Table 14 near south window",
    lostAt: new Date(Date.now() - 3600000 * 24),
    photos: ["/items/dell-photo.jpg"],
    photoUrl: "/items/dell-photo.jpg",
    rawPhotoUrl: "/items/dell-raw-private.jpg",
    rewardOffered: 75,
    status: "ACTIVE",
  });

  // Seed Alice's Found Item Deposit (In Safe-Desk Custody)
  const aliceFoundDeposit = await FoundItem.create({
    finderId: alice._id,
    title: "Casio FX-991EX Calculator",
    shortTitle: "FX-991EX Calculator",
    category: "LAB_GEAR",
    publicDescription: "Found on workshop bench",
    secretIdentifiers: "ENGRAVED_INITIALS_JG_ON_BACK",
    foundLocationId: testLocation._id,
    currentCustodyLocationId: testLocation._id,
    safeDeskLocationId: testLocation._id,
    custodyStatus: "SAFE_DESK",
    lockerReceiptCode: "SD-LIB-88",
    status: "APPROVED",
    foundAt: new Date(Date.now() - 3600000 * 12),
    rawPhotoUrl: "/items/calc-raw-private.jpg",
    blurredPhotoUrl: "/items/calc-blurred.jpg",
  });

  // Seed an item found by Staff that Alice filed a claim for
  const staffFoundItem = await FoundItem.create({
    finderId: staffRamos._id,
    title: "Campus ID Card & Lanyard",
    shortTitle: "ID Card",
    category: "ID_CARDS_DOCS",
    publicDescription: "Student ID card found near cafeteria",
    foundLocationId: testLocation._id,
    currentCustodyLocationId: testLocation._id,
    custodyStatus: "SAFE_DESK",
    status: "APPROVED",
    foundAt: new Date(Date.now() - 3600000 * 48),
    rawPhotoUrl: "/items/id-raw-private.jpg",
  });

  // Seed Alice's Claim (Approved & Handover Ready)
  const aliceClaim = await ClaimRequest.create({
    itemType: "FOUND",
    itemId: staffFoundItem._id,
    claimantId: alice._id,
    counterpartyUserId: staffRamos._id,
    submittedAnswer: "My name is Alice Pathfinder with Roll #124",
    status: "APPROVED",
    handoverCode: "847291",
    handoverCodeHash: "SECRET_HASH_847291",
    handoverAttempts: 0,
    handoverLocked: false,
  });

  // Seed Investigation with Alice's solved clue and evidence node
  const testClueId = new Types.ObjectId();
  const aliceInvestigation = await Investigation.create({
    questId: testQuest._id,
    userId: alice._id,
    participatingUserIds: [alice._id, bob._id],
    currentStage: 2,
    progressPct: 50,
    status: "IN_PROGRESS",
    solvedClues: [
      {
        clueId: testClueId,
        stageOrder: 1,
        solvedByUserId: alice._id,
        solvedByName: "Alice Pathfinder",
        usedHint: false,
        solvedAt: new Date(Date.now() - 3600000 * 6),
      },
    ],
    evidenceNodes: [
      {
        _id: new Types.ObjectId(),
        authorId: alice._id,
        authorName: "Alice Pathfinder",
        type: "PHOTO",
        title: "CCTV blindspot analysis near Server Room",
        content: "Observed unattended backpack on lower shelf",
        upvotes: [bob._id],
        createdAt: new Date(Date.now() - 3600000 * 5),
      },
    ],
  });

  console.log("✅ Seed records generated successfully.");

  // ------------------------------------------------------------------
  // SCENARIO 2: Alice queries operations ledger (All 4 categories & badges)
  // ------------------------------------------------------------------
  console.log("\n🧪 Scenario 2: Alice Ledger Data, Live Badges & Summary Counts");
  {
    (globalThis as any).__TEST_CURRENT_USER__ = alice;
    const req = new NextRequest("http://localhost:3000/api/user/operations");
    const res = await GET(req);
    const json = await res.json();

    assert(res.status === 200, "Alice operations query returns HTTP 200");
    assert(json.success === true, "Alice response payload has success=true");

    const { counts, lostItems, foundItems, claims, clues, evidence } = json.data;

    // Verify aggregate counts
    assert(counts.lostTotal === 1, `Alice lostTotal is 1 (got: ${counts.lostTotal})`);
    assert(counts.foundTotal === 1, `Alice foundTotal is 1 (got: ${counts.foundTotal})`);
    assert(counts.claimsTotal === 1, `Alice claimsTotal is 1 (got: ${counts.claimsTotal})`);
    assert(
      counts.cluesSolvedTotal === 1,
      `Alice cluesSolvedTotal is 1 (got: ${counts.cluesSolvedTotal})`
    );
    assert(counts.evidenceTotal === 1, `Alice evidenceTotal is 1 (got: ${counts.evidenceTotal})`);

    // Verify Lost Item
    assert(lostItems.length === 1, "Alice receives 1 lost item");
    const lostItem = lostItems[0];
    assert(lostItem.title === "Blue Dell XPS 15 Laptop", "Lost item title matches");
    assert(
      lostItem.liveBadge.label === "Active Search",
      `Lost item live badge label is "Active Search" (got: "${lostItem.liveBadge.label}")`
    );
    assert(lostItem.liveBadge.color === "emerald", "Lost item live badge color is emerald");
    assert(lostItem.locationName === "Central Engineering Library", "Location populated");
    assert(lostItem.rewardOffered === 75, "Reward offered is 75");

    // Verify Found Item Deposit
    assert(foundItems.length === 1, "Alice receives 1 found deposit");
    const foundItem = foundItems[0];
    assert(foundItem.title === "Casio FX-991EX Calculator", "Found item title matches");
    assert(
      foundItem.liveBadge.label === "In Safe-Desk Custody",
      `Found item live badge label is "In Safe-Desk Custody" (got: "${foundItem.liveBadge.label}")`
    );
    assert(foundItem.liveBadge.color === "cyan", "Found item live badge color is cyan");
    assert(
      foundItem.lockerReceiptCode === "SD-LIB-88",
      `Locker receipt code is "SD-LIB-88" (got: "${foundItem.lockerReceiptCode}")`
    );
    assert(
      foundItem.custodyLocationName === "Central Engineering Library",
      "Custody location populated"
    );

    // Verify Filed Claim
    assert(claims.length === 1, "Alice receives 1 filed claim");
    const claim = claims[0];
    assert(claim.itemTitle === "Campus ID Card & Lanyard", "Claimed item title matches");
    assert(
      claim.liveBadge.label === "Handover Ready",
      `Claim live badge label is "Handover Ready" (got: "${claim.liveBadge.label}")`
    );
    assert(claim.liveBadge.color === "amber", "Claim live badge color is amber");
    assert(claim.liveBadge.actionable === true, "Claim is actionable with PIN launcher");
    assert(claim.counterparty?.displayName === "Officer Ramos", "Counterparty populated");

    // Verify Clues
    assert(clues.length === 1, "Alice receives 1 solved clue");
    const clue = clues[0];
    assert(clue.questCode === "QUEST-ENG-001", "Clue quest code matches");
    assert(clue.stageOrder === 1, "Clue stage order is 1");
    assert(
      clue.liveBadge.label === "Verified Deduction",
      `Clue badge is "Verified Deduction" (got: "${clue.liveBadge.label}")`
    );

    // Verify Evidence
    assert(evidence.length === 1, "Alice receives 1 evidence node");
    const ev = evidence[0];
    assert(ev.type === "PHOTO", "Evidence type is PHOTO");
    assert(ev.upvotesCount === 1, "Evidence upvotes count is 1");
    assert(
      ev.liveBadge.label === "Active Case Board",
      `Evidence badge is "Active Case Board" (got: "${ev.liveBadge.label}")`
    );

    // ------------------------------------------------------------------
    // SECURITY INVARIANTS CHECK
    // ------------------------------------------------------------------
    console.log("\n🔒 Verifying security field sanitization...");
    assert(
      (lostItem as any).secretIdentifiers === undefined,
      "LostItem secretIdentifiers is stripped"
    );
    assert(
      (lostItem as any).verificationAnswerHash === undefined,
      "LostItem verificationAnswerHash is stripped"
    );
    assert((lostItem as any).rawPhotoUrl === undefined, "LostItem rawPhotoUrl is stripped");

    assert(
      (foundItem as any).secretIdentifiers === undefined,
      "FoundItem secretIdentifiers is stripped"
    );
    assert((foundItem as any).rawPhotoUrl === undefined, "FoundItem rawPhotoUrl is stripped");

    assert((claim as any).handoverCode === undefined, "Claim handoverCode is NOT exposed in ledger");
    assert(
      (claim as any).handoverCodeHash === undefined,
      "Claim handoverCodeHash is NOT exposed in ledger"
    );
  }

  // ------------------------------------------------------------------
  // SCENARIO 3: Bob queries operations ledger (Tenant Isolation)
  // ------------------------------------------------------------------
  console.log("\n🧪 Scenario 3: Bob Strict Tenant Isolation & Zero Empty State");
  {
    (globalThis as any).__TEST_CURRENT_USER__ = bob;
    const req = new NextRequest("http://localhost:3000/api/user/operations");
    const res = await GET(req);
    const json = await res.json();

    assert(res.status === 200, "Bob query returns HTTP 200");
    const { counts, lostItems, foundItems, claims, clues, evidence } = json.data;

    assert(counts.lostTotal === 0, `Bob lostTotal is 0 (got: ${counts.lostTotal})`);
    assert(counts.foundTotal === 0, `Bob foundTotal is 0 (got: ${counts.foundTotal})`);
    assert(counts.claimsTotal === 0, `Bob claimsTotal is 0 (got: ${counts.claimsTotal})`);
    assert(
      counts.cluesSolvedTotal === 0,
      `Bob cluesSolvedTotal is 0 (got: ${counts.cluesSolvedTotal})`
    );
    assert(
      counts.evidenceTotal === 0,
      `Bob evidenceTotal is 0 (got: ${counts.evidenceTotal})`
    );

    assert(lostItems.length === 0, "Bob receives 0 lost items");
    assert(foundItems.length === 0, "Bob receives 0 found deposits");
    assert(claims.length === 0, "Bob receives 0 filed claims");
    assert(clues.length === 0, "Bob receives 0 clues");
    assert(evidence.length === 0, "Bob receives 0 evidence nodes");
  }

  // ------------------------------------------------------------------
  // SCENARIO 4: Comprehensive Badge Mapping Coverage
  // ------------------------------------------------------------------
  console.log("\n🧪 Scenario 4: Operational Badge Mappings Across All Lifecycle States");
  {
    // 1. Lost Item Badges
    const lostStates = [
      { status: "SUBMITTED", expected: "Pending Triage", color: "amber" },
      { status: "UNDER_REVIEW", expected: "Under Review", color: "cyan" },
      { status: "CLAIMED", expected: "Match Verification", color: "amber" },
      { status: "RECOVERED", expected: "Recovered", color: "emerald" },
      { status: "REJECTED", expected: "Rejected", color: "rose" },
    ];

    for (const testCase of lostStates) {
      const item = await LostItem.create({
        reporterId: bob._id,
        title: `Test ${testCase.status}`,
        category: "OTHER",
        publicDescription: "Lost item test description",
        lastKnownLocationId: testLocation._id,
        lostAt: new Date(),
        status: testCase.status,
      });

      (globalThis as any).__TEST_CURRENT_USER__ = bob;
      const req = new NextRequest("http://localhost:3000/api/user/operations?tab=lost");
      const res = await GET(req);
      const json = await res.json();
      const match = json.data.lostItems.find((i: any) => i._id === item._id.toString());

      assert(match !== undefined, `Found created test item ${testCase.status}`);
      assert(
        match.liveBadge.label === testCase.expected,
        `Lost state ${testCase.status} maps to "${testCase.expected}" (got: "${match.liveBadge.label}")`
      );
      assert(
        match.liveBadge.color === testCase.color,
        `Lost state ${testCase.status} maps to color "${testCase.color}"`
      );

      await LostItem.findByIdAndDelete(item._id);
    }

    // 2. Found Item Custody Badges
    const foundStates = [
      {
        custodyStatus: "HELD_BY_FINDER",
        status: "SUBMITTED",
        expected: "Finder Held (Pending Deposit)",
        color: "amber",
      },
      {
        custodyStatus: "SAFE_DESK",
        status: "COMPLETED",
        expected: "Returned to Owner",
        color: "emerald",
      },
      {
        custodyStatus: "SAFE_DESK",
        status: "CLAIMED",
        expected: "Claim Verification",
        color: "amber",
      },
    ];

    for (const testCase of foundStates) {
      const item = await FoundItem.create({
        finderId: bob._id,
        title: `Found Test ${testCase.custodyStatus}`,
        category: "OTHER",
        publicDescription: "Found item test description",
        foundAt: new Date(),
        foundLocationId: testLocation._id,
        custodyStatus: testCase.custodyStatus,
        status: testCase.status,
      });

      (globalThis as any).__TEST_CURRENT_USER__ = bob;
      const req = new NextRequest("http://localhost:3000/api/user/operations?tab=found");
      const res = await GET(req);
      const json = await res.json();
      const match = json.data.foundItems.find((i: any) => i._id === item._id.toString());

      assert(match !== undefined, `Found created test found item ${testCase.status}`);
      assert(
        match.liveBadge.label === testCase.expected,
        `Found custody state maps to "${testCase.expected}" (got: "${match.liveBadge.label}")`
      );
      assert(
        match.liveBadge.color === testCase.color,
        `Found custody state maps to color "${testCase.color}"`
      );

      await FoundItem.findByIdAndDelete(item._id);
    }

    // 3. Claim Badges
    const claimStates = [
      { status: "PENDING", expected: "Pending Review", color: "cyan", actionable: false },
      {
        status: "REJECTED",
        expected: "Rejected",
        color: "rose",
        actionable: false,
        reason: "Serial number did not match owner documentation",
      },
      {
        status: "HANDOVER_COMPLETE",
        expected: "Handover Complete",
        color: "emerald",
        actionable: false,
      },
    ];

    for (const testCase of claimStates) {
      const claimDoc = await ClaimRequest.create({
        itemType: "FOUND",
        itemId: staffFoundItem._id,
        claimantId: bob._id,
        counterpartyUserId: staffRamos._id,
        status: testCase.status,
        rejectionReason: testCase.reason || "",
      });

      (globalThis as any).__TEST_CURRENT_USER__ = bob;
      const req = new NextRequest("http://localhost:3000/api/user/operations?tab=claims");
      const res = await GET(req);
      const json = await res.json();
      const match = json.data.claims.find((c: any) => c._id === claimDoc._id.toString());

      assert(match !== undefined, `Found test claim ${testCase.status}`);
      assert(
        match.liveBadge.label === testCase.expected,
        `Claim state ${testCase.status} maps to "${testCase.expected}" (got: "${match.liveBadge.label}")`
      );
      assert(
        match.liveBadge.color === testCase.color,
        `Claim state ${testCase.status} maps to color "${testCase.color}"`
      );
      assert(
        match.liveBadge.actionable === testCase.actionable,
        `Claim actionable flag is ${testCase.actionable}`
      );
      if (testCase.reason) {
        assert(
          match.rejectionReason === testCase.reason,
          `Rejection reason properly preserved: "${match.rejectionReason}"`
        );
      }

      await ClaimRequest.findByIdAndDelete(claimDoc._id);
    }
  }

  // ------------------------------------------------------------------
  // CLEANUP & TEARDOWN
  // ------------------------------------------------------------------
  console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
  console.log("✨ Ephemeral database dropped and mongoose disconnected cleanly.");

  console.log("\n========================================================");
  console.log(`🎉 ALL TESTS COMPLETED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

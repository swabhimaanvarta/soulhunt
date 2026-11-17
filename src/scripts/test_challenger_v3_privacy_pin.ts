/**
 * AIEM HUNT — Adversarial Empirical Challenge Suite: Privacy Invariants & PIN Concealment
 * Role: Challenger 1 (Adversarial Privacy & PIN Challenger)
 * 
 * Invariants Under Empirical Probe:
 * 1. GET /api/user/profile?username=...
 *    - Unauthenticated visitors & authenticated non-owners can NEVER extract:
 *      email, phoneNumber, studentId, trustScore, trustTier, coins, role.
 *    - IdentityMode pseudonymity & anonymity enforcement.
 *    - Leaderboard privacy gating (level, xp, stats suppression).
 *    - Classified dossier protection (profileHidden: true, 0 leakage even if identityMode is PUBLIC).
 * 2. GET /api/claims
 *    - handoverCode is NEVER projected or delivered in general bulk listings across all filter combinations.
 * 3. GET /api/claims/[id]
 *    - Single-ticket PIN delivery is strictly restricted to approved claimants (FOUND) or counterparties (LOST).
 *    - Denied to depositors/finders, unapproved claims, rejected claims, completed claims, third-party students, and unauthenticated callers.
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { User, LostItem, FoundItem, ClaimRequest, CampusLocation } from "../models";
import { GET as getProfileRoute } from "../app/api/user/profile/route";
import { GET as getClaimsRoute } from "../app/api/claims/route";
import { GET as getClaimByIdRoute } from "../app/api/claims/[id]/route";

const RUN_ID = `aiem_hunt_test_adversarial_privacy_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

let totalProbes = 0;
let passedProbes = 0;
let failedProbes = 0;

function probeAssert(condition: boolean, description: string, details?: any) {
  totalProbes++;
  if (condition) {
    passedProbes++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    failedProbes++;
    console.error(`  ❌ [FAIL] ${description}`);
    if (details !== undefined) {
      console.error(`     Details:`, details);
    }
  }
}

async function runAdversarialPrivacyAndPinChallenges() {
  console.log("================================================================================");
  console.log("🔥 ADVERSARIAL PRIVACY INVARIANTS & PIN CONCEALMENT CHALLENGE SUITE");
  console.log(`   Database Target: ${TEST_DB_URI}`);
  console.log("================================================================================\n");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`📦 Connected to isolated challenge database: ${RUN_ID}\n`);

  try {
    // -------------------------------------------------------------------------
    // FIXTURE SEEDING
    // -------------------------------------------------------------------------
    const location = await CampusLocation.create({
      name: "Main Campus Hub",
      code: "MAIN-HUB",
      zoneType: "SAFE_DESK",
      description: "Central Campus Plaza",
      coordinates: { lat: 15.2, lng: 73.9, mapX: 50, mapY: 50 },
      floors: ["Ground"],
      isSafeDesk: true,
      operatingHours: "08:00 AM - 08:00 PM",
      isActive: true,
    });

    // 1. High-Privilege Admin User with sensitive PII and coins
    const targetAdmin = await User.create({
      email: "director_boss@aiemgoa.ac.in",
      passwordHash: "hash_admin_123",
      username: "director_boss",
      displayName: "Dr. Vikram Sarabhai",
      role: "ADMIN",
      department: "Directorate",
      yearOfStudy: 5,
      coins: 9999,
      xp: 8888,
      level: 15,
      rankTitle: "Grandmaster Sentinel",
      trustScore: 995,
      trustTier: "ELITE_INVESTIGATOR",
      phoneNumber: "+919876543210",
      studentId: "AIEM-ADMIN-001",
      identityMode: "PUBLIC",
      isProfilePublic: true,
      isLeaderboardPublic: true,
      stats: {
        recoveriesCount: 42,
        safeDeskDepositsCount: 18,
        questsCompleted: 50,
        cluesSolved: 120,
        visitedBlocks: ["ADMIN", "LABS", "LIBRARY"], // Sensitive internal stat
      },
    });

    // 2. Pseudonymous Student User
    const targetPseudonymous = await User.create({
      email: "karan_student@aiemgoa.ac.in",
      passwordHash: "hash_student_123",
      username: "karan_hunter",
      displayName: "Karan Johar",
      role: "STUDENT",
      department: "Mechanical Engineering",
      yearOfStudy: 2,
      coins: 450,
      xp: 1200,
      level: 3,
      rankTitle: "Junior Pathfinder",
      trustScore: 680,
      trustTier: "TRUSTED_HUNTER",
      phoneNumber: "+919111122222",
      studentId: "AIEM2023ME099",
      identityMode: "PSEUDONYMOUS",
      isProfilePublic: true,
      isLeaderboardPublic: true,
    });

    // 3. Anonymous Student User
    const targetAnonymous = await User.create({
      email: "sneha_anon@aiemgoa.ac.in",
      passwordHash: "hash_student_123",
      username: "sneha_shadow",
      displayName: "Sneha Roy",
      role: "STUDENT",
      department: "Civil Engineering",
      yearOfStudy: 1,
      coins: 100,
      xp: 250,
      level: 1,
      rankTitle: "Rookie Seeker",
      trustScore: 500,
      trustTier: "NEW_HUNTER",
      phoneNumber: "+919333344444",
      studentId: "AIEM2024CV010",
      identityMode: "ANONYMOUS",
      avatarPreset: "shadow",
      avatarUrl: "/avatars/shadow.png",
      isProfilePublic: true,
      isLeaderboardPublic: true,
    });

    // 4. Classified (Private) Profile with identityMode PUBLIC
    const targetClassifiedPublicMode = await User.create({
      email: "covert_op@aiemgoa.ac.in",
      passwordHash: "hash_student_123",
      username: "covert_ghost",
      displayName: "Major Somnath Sharma",
      role: "STUDENT",
      department: "Computer Engineering",
      yearOfStudy: 4,
      coins: 1500,
      xp: 3200,
      level: 7,
      rankTitle: "Master Sleuth",
      trustScore: 920,
      trustTier: "ELITE_INVESTIGATOR",
      phoneNumber: "+919555566666",
      studentId: "AIEM2021CS088",
      identityMode: "PUBLIC", // Adversarial case: Public mode BUT profile set to private!
      isProfilePublic: false,
      isLeaderboardPublic: false,
    });

    // 5. User with Hidden Leaderboard
    const targetHiddenLeaderboard = await User.create({
      email: "modest_seeker@aiemgoa.ac.in",
      passwordHash: "hash_student_123",
      username: "modest_seeker",
      displayName: "Modest Seeker",
      role: "STUDENT",
      department: "Electrical Engineering",
      yearOfStudy: 3,
      coins: 800,
      xp: 4500,
      level: 9,
      rankTitle: "Silent Sentinel",
      trustScore: 840,
      trustTier: "TRUSTED_HUNTER",
      identityMode: "PUBLIC",
      isProfilePublic: true,
      isLeaderboardPublic: false, // Leaderboard hidden
    });

    // 6. Adversary / Peer Student (Authenticated non-owner, non-admin)
    const peerStudent = await User.create({
      email: "adversary_peer@aiemgoa.ac.in",
      passwordHash: "hash_peer_123",
      username: "adversary_peer",
      displayName: "Adversarial Student",
      role: "STUDENT",
      department: "Information Technology",
      yearOfStudy: 2,
      coins: 50,
      level: 1,
      rankTitle: "Curious Operative",
    });

    // 7. Safe-Desk Staff User
    const staffUser = await User.create({
      email: "staff_desk@aiemgoa.ac.in",
      passwordHash: "hash_staff_123",
      username: "staff_desk",
      displayName: "Safe-Desk Operator",
      role: "SAFE_DESK_STAFF",
      department: "Campus Security",
      yearOfStudy: 4,
    });

    // Seed Lost and Found Items for Director Boss to test activity leakage
    await LostItem.create({
      reporterId: targetAdmin._id,
      title: "Encrypted Directorate USB Drive",
      publicDescription: "Kingston 64GB black USB flash drive with metallic ring",
      category: "ELECTRONICS",
      status: "ACTIVE",
      lostAt: new Date(),
      lastKnownLocationId: location._id,
      spotDetails: "TOP_SECRET_DESK_CABINET_B4",
    });

    await FoundItem.create({
      finderId: targetAdmin._id,
      title: "Gold Parker Pen",
      shortTitle: "Gold Pen",
      publicDescription: "Gold plated Parker rollerball pen",
      category: "ACCESSORIES",
      status: "ACTIVE",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      foundAt: new Date(),
      foundLocationId: location._id,
      currentCustodyLocationId: location._id,
      spotDetails: "CONFERENCE_ROOM_A_CHAIR_3",
    });

    // -------------------------------------------------------------------------
    // CHALLENGE AREA 1: GET /api/user/profile ADVERSARIAL FIELD LEAKAGE
    // -------------------------------------------------------------------------
    console.log("─── Challenge 1: GET /api/user/profile Adversarial Probes ───");

    const SENSITIVE_FIELDS = [
      "email",
      "phoneNumber",
      "studentId",
      "trustScore",
      "trustTier",
      "coins",
      "role",
    ];

    // Probe 1.1: Unauthenticated visitor querying public admin profile
    {
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=director_boss");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(res.status === 200, "1.1.1: Unauthenticated request to public profile returns 200");
      probeAssert(Boolean(json.isOwnProfile) === false, "1.1.2: isOwnProfile evaluates to false for unauthenticated visitor");

      const p = json.profile || {};
      for (const field of SENSITIVE_FIELDS) {
        probeAssert(
          p[field] === undefined,
          `1.1.3: Sensitive field '${field}' strictly absent from unauthenticated visitor payload`,
          p[field]
        );
      }

      // Root JSON checks
      for (const field of SENSITIVE_FIELDS) {
        probeAssert(
          json[field] === undefined,
          `1.1.4: Sensitive field '${field}' strictly absent from root response object`
        );
      }

      // Activity isolation
      probeAssert(
        json.activities.lostItems.length === 0 &&
        json.activities.foundItems.length === 0 &&
        json.activities.claims.length === 0,
        "1.1.5: Activity ledger arrays (lostItems, foundItems, claims) are strictly empty [] for visitor"
      );

      // Fine-grained stats isolation
      probeAssert(
        p.stats?.visitedBlocks === undefined,
        "1.1.6: Fine-grained internal stats (visitedBlocks) stripped from coarse stats"
      );
    }

    // Probe 1.2: Authenticated non-owner peer student querying public admin profile
    {
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=director_boss");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(res.status === 200, "1.2.1: Authenticated peer student request returns 200");
      probeAssert(json.isOwnProfile === false, "1.2.2: isOwnProfile is false for peer student");

      const p = json.profile || {};
      for (const field of SENSITIVE_FIELDS) {
        probeAssert(
          p[field] === undefined,
          `1.2.3: Sensitive field '${field}' strictly absent for authenticated non-owner peer`,
          p[field]
        );
      }
      probeAssert(
        json.activities.lostItems.length === 0 &&
        json.activities.foundItems.length === 0 &&
        json.activities.claims.length === 0,
        "1.2.4: Activity ledger strictly empty for authenticated peer student"
      );
    }

    // Probe 1.3: Adversarial Query-Parameter Injection & Privilege Spoofing
    {
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent;
      // Adversary attempts query parameter pollution to trick server into thinking caller is owner or admin
      const maliciousUrl =
        "http://localhost:3000/api/user/profile?username=director_boss&isOwnProfile=true&isAdmin=true&role=ADMIN&select=+email+coins+trustScore";
      const req = new NextRequest(maliciousUrl);
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(json.isOwnProfile === false, "1.3.1: Query parameter spoofing ('isOwnProfile=true') rejected by server");
      for (const field of SENSITIVE_FIELDS) {
        probeAssert(
          json.profile?.[field] === undefined,
          `1.3.2: Malicious field projection injection ('${field}') blocked by server redaction`
        );
      }
    }

    // Probe 1.4: Pseudonymous Profile Masking Check
    {
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=karan_hunter");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(
        json.profile.displayName === "@karan_hunter",
        `1.4.1: Pseudonymous displayName correctly masked to '@karan_hunter' (was '${json.profile.displayName}')`
      );
      probeAssert(
        !JSON.stringify(json).includes("Karan Johar"),
        "1.4.2: Real display name 'Karan Johar' nowhere present in serialized response"
      );
    }

    // Probe 1.5: Anonymous Profile Masking & Avatar Coercion Check
    {
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=sneha_shadow");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(
        json.profile.displayName === "Anonymous Hunter",
        `1.5.1: Anonymous displayName masked to 'Anonymous Hunter' (was '${json.profile.displayName}')`
      );
      probeAssert(
        json.profile.avatarPreset === "recon",
        `1.5.2: Anonymous avatarPreset coerced to built-in 'recon' (was '${json.profile.avatarPreset}')`
      );
      probeAssert(
        json.profile.avatarUrl === "/avatars/recon.png",
        `1.5.3: Anonymous avatarUrl coerced to '/avatars/recon.png' (was '${json.profile.avatarUrl}')`
      );
      probeAssert(
        !JSON.stringify(json).includes("Sneha Roy"),
        "1.5.4: Real display name 'Sneha Roy' nowhere present in serialized response"
      );
    }

    // Probe 1.6: Classified Profile with identityMode PUBLIC — Real Name Leak Defense
    {
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=covert_ghost");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(json.profileHidden === true, "1.6.1: profileHidden is true for classified profile");
      probeAssert(
        json.profile.displayName === "@covert_ghost",
        `1.6.2: Classified profile with identityMode PUBLIC forced to handle mask '@covert_ghost' (was '${json.profile.displayName}')`
      );
      probeAssert(
        !JSON.stringify(json).includes("Major Somnath Sharma"),
        "1.6.3: CRITICAL DEFENSE: Real name 'Major Somnath Sharma' NOT leaked on classified profile"
      );
      probeAssert(
        json.profile.level === undefined && json.profile.xp === undefined,
        "1.6.4: Level and XP completely stripped from classified profile"
      );
      probeAssert(
        json.profile.stats === undefined,
        "1.6.5: Stats object completely stripped from classified profile"
      );
    }

    // Probe 1.7: Hidden Leaderboard Profile Gating
    {
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=modest_seeker");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(
        json.profile.level === undefined && json.profile.xp === undefined,
        "1.7.1: Level and XP omitted when isLeaderboardPublic is false"
      );
      probeAssert(
        json.profile.rankTitle === "Unranked Operative",
        `1.7.2: rankTitle replaced with 'Unranked Operative' (was '${json.profile.rankTitle}')`
      );
      probeAssert(
        Object.keys(json.profile.stats || {}).length === 0,
        "1.7.3: Stats object is strictly empty {} when leaderboard is private"
      );
    }

    // Probe 1.8: Non-Existent User Query returns accessible 404
    {
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      const req = new NextRequest("http://localhost:3000/api/user/profile?username=ghost_user_404_x");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(res.status === 404, "1.8.1: Query for non-existent operative returns 404 status");
      probeAssert(json.error?.code === "USER_NOT_FOUND", "1.8.2: Error code is 'USER_NOT_FOUND'");
    }

    // Probe 1.9: Authenticated Owner Profile Query returns legitimate dossier & scrubs spotDetails
    {
      (globalThis as any).__TEST_CURRENT_USER__ = targetAdmin;
      const req = new NextRequest("http://localhost:3000/api/user/profile");
      const res = await getProfileRoute(req);
      const json = await res.json();

      probeAssert(json.isOwnProfile === true, "1.9.1: isOwnProfile is true for authentic owner");
      probeAssert(json.profile.email === "director_boss@aiemgoa.ac.in", "1.9.2: Authentic owner receives their own email");
      probeAssert(json.profile.coins === 9999, "1.9.3: Authentic owner receives their own Hunter Coins");
      probeAssert(json.profile.role === "ADMIN", "1.9.4: Authentic owner receives their own role");
      probeAssert(json.activities.lostItems.length === 1, "1.9.5: Authentic owner receives their lost item history");

      // Verify spotDetails is stripped from owner ledger items (defense-in-depth)
      const lostItem = json.activities.lostItems[0];
      probeAssert(
        lostItem.spotDetails === undefined,
        "1.9.6: Sensitive spotDetails ('TOP_SECRET_DESK_CABINET_B4') stripped from owner activity ledger"
      );
    }

    // -------------------------------------------------------------------------
    // CHALLENGE AREA 2: GET /api/claims BULK LISTING PIN OMISSION
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 2: GET /api/claims Bulk PIN Concealment ───");

    // Seed multiple claims with various statuses and plaintext handover codes
    const claimCodes = ["718293", "123456", "987654", "555555", "333444"];

    const claim1 = await ClaimRequest.create({
      claimantId: peerStudent._id,
      counterpartyUserId: targetAdmin._id,
      itemType: "FOUND",
      itemId: new Types.ObjectId(),
      status: "APPROVED",
      handoverCode: claimCodes[0],
      handoverCodeHash: "hash_code_0",
      submittedAnswer: "My initials are engraved on the back",
    });

    const claim2 = await ClaimRequest.create({
      claimantId: peerStudent._id,
      counterpartyUserId: targetPseudonymous._id,
      itemType: "FOUND",
      itemId: new Types.ObjectId(),
      status: "PENDING",
      handoverCode: claimCodes[1],
      handoverCodeHash: "hash_code_1",
      submittedAnswer: "Secret scratch on bottom left",
    });

    const claim3 = await ClaimRequest.create({
      claimantId: peerStudent._id,
      counterpartyUserId: targetAdmin._id,
      itemType: "FOUND",
      itemId: new Types.ObjectId(),
      status: "HANDOVER_COMPLETE",
      handoverCode: claimCodes[2],
      handoverCodeHash: "hash_code_2",
    });

    const claim4 = await ClaimRequest.create({
      claimantId: targetPseudonymous._id,
      counterpartyUserId: peerStudent._id,
      itemType: "LOST",
      itemId: new Types.ObjectId(),
      status: "APPROVED",
      handoverCode: claimCodes[3],
      handoverCodeHash: "hash_code_3",
    });

    // Probe 2.1: Unauthenticated request to /api/claims is denied
    {
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      const req = new NextRequest("http://localhost:3000/api/claims?role=all");
      const res = await getClaimsRoute(req);
      probeAssert(res.status === 401, "2.1.1: Unauthenticated request to /api/claims returns 401 UNAUTHORIZED");
    }

    // Probe 2.2: Authenticated bulk queries across all status and role permutations
    const queryPermutations = [
      "?role=all",
      "?role=claimant",
      "?role=counterparty",
      "?status=APPROVED",
      "?status=PENDING",
      "?status=HANDOVER_COMPLETE",
      "?role=all&status=APPROVED&select=+handoverCode+handoverCodeHash",
    ];

    (globalThis as any).__TEST_CURRENT_USER__ = peerStudent;

    for (let i = 0; i < queryPermutations.length; i++) {
      const q = queryPermutations[i];
      const req = new NextRequest(`http://localhost:3000/api/claims${q}`);
      const res = await getClaimsRoute(req);
      const json = await res.json();

      probeAssert(res.status === 200, `2.2.${i + 1}a: GET /api/claims${q} returns 200`);
      probeAssert(Array.isArray(json.data), `2.2.${i + 1}b: GET /api/claims${q} returns array of claims`);

      if (Array.isArray(json.data)) {
        for (const item of json.data) {
          probeAssert(
            item.handoverCode === undefined,
            `2.2.${i + 1}c: Claim '${item._id}' handoverCode is undefined in bulk listing`,
            item.handoverCode
          );
          probeAssert(
            item.handoverCodeHash === undefined,
            `2.2.${i + 1}d: Claim '${item._id}' handoverCodeHash is undefined in bulk listing`
          );
        }

        const serialized = JSON.stringify(json.data);
        for (const code of claimCodes) {
          probeAssert(
            !serialized.includes(code),
            `2.2.${i + 1}e: Plaintext PIN '${code}' does not appear anywhere in serialized response for ${q}`
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // CHALLENGE AREA 3: GET /api/claims/[id] AUTHORIZED SINGLE-TICKET PIN DELIVERY
    // -------------------------------------------------------------------------
    console.log("\n─── Challenge 3: GET /api/claims/[id] Single-Ticket PIN Retrieval & Scoping ───");

    // Case A: FOUND item, APPROVED status -> Claimant is recovering owner
    // Expected: Claimant receives PIN; Counterparty (finder) receives NO PIN; Unrelated student receives 403
    {
      const targetClaimId = claim1._id.toString();

      // Probe 3.1: Approved claimant retrieves PIN
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent; // peerStudent is claimantId
      {
        const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
        const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
        const json = await res.json();

        probeAssert(res.status === 200, "3.1.1: Approved claimant retrieves claim with 200");
        probeAssert(json.data?.isClaimant === true, "3.1.2: isClaimant is true for claimant");
        probeAssert(
          json.data?.handoverCode === claimCodes[0],
          `3.1.3: Approved claimant successfully receives valid handoverCode '${claimCodes[0]}'`,
          json.data?.handoverCode
        );
        probeAssert(
          json.data?.safeDeskInstructions !== null,
          "3.1.4: Safe-Desk presentation instructions provided to approved claimant"
        );
      }

      // Probe 3.2: Counterparty (the finder) queries the same approved claim
      // Counterparty must NOT receive claimant's secret PIN!
      (globalThis as any).__TEST_CURRENT_USER__ = targetAdmin; // targetAdmin is counterpartyUserId
      {
        const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
        const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
        const json = await res.json();

        probeAssert(res.status === 200, "3.2.1: Counterparty can view claim summary (200)");
        probeAssert(json.data?.isCounterparty === true, "3.2.2: isCounterparty is true");
        probeAssert(
          json.data?.handoverCode === undefined,
          `3.2.3: CRITICAL PIN CONCEALMENT: Counterparty (finder) denied claimant's handoverCode (was '${json.data?.handoverCode}')`
        );
        probeAssert(
          !JSON.stringify(json).includes(claimCodes[0]),
          "3.2.4: Plaintext PIN nowhere present in serialized payload delivered to counterparty"
        );
      }

      // Probe 3.3: Unrelated student (third-party hunter) attempts to query claim
      (globalThis as any).__TEST_CURRENT_USER__ = targetPseudonymous; // neither claimant nor counterparty
      {
        const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
        const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
        const json = await res.json();

        probeAssert(res.status === 403, `3.3.1: Unrelated student query rejected with 403 FORBIDDEN (status was ${res.status})`);
        probeAssert(json.error?.code === "FORBIDDEN", "3.3.2: Error code is 'FORBIDDEN'");
        probeAssert(!JSON.stringify(json).includes(claimCodes[0]), "3.3.3: Zero PIN leakage to third party");
      }

      // Probe 3.4: Unauthenticated visitor attempts to query claim
      (globalThis as any).__TEST_CURRENT_USER__ = null;
      {
        const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
        const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
        probeAssert(res.status === 401, `3.4.1: Unauthenticated request rejected with 401 UNAUTHORIZED (status was ${res.status})`);
      }
    }

    // Case B: FOUND item, PENDING status -> PIN must NOT be revealed yet even to claimant
    {
      const targetClaimId = claim2._id.toString();
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent; // claimant
      const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
      const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
      const json = await res.json();

      probeAssert(res.status === 200, "3.5.1: Claimant queries pending claim with 200");
      probeAssert(json.data?.status === "PENDING", "3.5.2: Status is PENDING");
      probeAssert(
        json.data?.handoverCode === undefined,
        `3.5.3: PIN is withheld while claim is PENDING (was '${json.data?.handoverCode}')`
      );
      probeAssert(
        !JSON.stringify(json).includes(claimCodes[1]),
        "3.5.4: Plaintext PIN is completely absent for PENDING claim"
      );
    }

    // Case C: FOUND item, HANDOVER_COMPLETE status -> PIN must NOT be revealed (already redeemed)
    {
      const targetClaimId = claim3._id.toString();
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent; // claimant
      const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
      const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
      const json = await res.json();

      probeAssert(res.status === 200, "3.6.1: Claimant queries completed claim with 200");
      probeAssert(
        json.data?.handoverCode === undefined,
        `3.6.2: PIN is withheld for COMPLETED claim (was '${json.data?.handoverCode}')`
      );
      probeAssert(
        !JSON.stringify(json).includes(claimCodes[2]),
        "3.6.3: Completed PIN is completely absent from payload"
      );
    }

    // Case D: LOST item, APPROVED status -> Counterparty is the recovering owner
    // Expected: Counterparty receives PIN; Claimant (finder/custody) receives NO PIN
    {
      const targetClaimId = claim4._id.toString();

      // Probe 3.7: Counterparty (recovering owner) retrieves PIN in LOST item flow
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent; // peerStudent is counterpartyUserId
      {
        const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
        const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
        const json = await res.json();

        probeAssert(res.status === 200, "3.7.1: Counterparty in LOST flow retrieves claim with 200");
        probeAssert(json.data?.isCounterparty === true, "3.7.2: isCounterparty is true");
        probeAssert(
          json.data?.handoverCode === claimCodes[3],
          `3.7.3: Counterparty in LOST flow successfully receives handoverCode '${claimCodes[3]}'`,
          json.data?.handoverCode
        );
      }

      // Probe 3.8: Claimant in LOST flow queries the same claim
      (globalThis as any).__TEST_CURRENT_USER__ = targetPseudonymous; // claimantId in claim4
      {
        const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
        const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
        const json = await res.json();

        probeAssert(res.status === 200, "3.8.1: Claimant in LOST flow queries claim with 200");
        probeAssert(
          json.data?.handoverCode === undefined,
          `3.8.2: Claimant in LOST flow is denied counterparty's PIN (was '${json.data?.handoverCode}')`
        );
        probeAssert(!JSON.stringify(json).includes(claimCodes[3]), "3.8.3: Zero PIN leak to claimant in LOST flow");
      }
    }

    // Case E: Safe-Desk Staff user queries claim
    // Staff verifies PIN via bcrypt counter endpoint, but GET /api/claims/[id] does NOT broadcast plaintext PIN to staff
    {
      const targetClaimId = claim1._id.toString();
      (globalThis as any).__TEST_CURRENT_USER__ = staffUser;
      const req = new NextRequest(`http://localhost:3000/api/claims/${targetClaimId}`);
      const res = await getClaimByIdRoute(req, { params: Promise.resolve({ id: targetClaimId }) });
      const json = await res.json();

      probeAssert(res.status === 200, "3.9.1: Safe-Desk staff authorized to view claim ticket (200)");
      probeAssert(json.data?.isStaff === true, "3.9.2: isStaff is true");
      probeAssert(
        json.data?.handoverCode === undefined,
        `3.9.3: SAFE-DESK SECURITY: Staff does NOT receive plaintext PIN from GET endpoint (must verify at counter)`
      );
    }

    // Case F: Invalid and Non-Existent Claim IDs
    {
      (globalThis as any).__TEST_CURRENT_USER__ = peerStudent;

      // Malformed ID
      const reqMalformed = new NextRequest("http://localhost:3000/api/claims/not-a-valid-id-123");
      const resMalformed = await getClaimByIdRoute(reqMalformed, { params: Promise.resolve({ id: "not-a-valid-id-123" }) });
      probeAssert(resMalformed.status === 400, "3.10.1: Malformed claim ID returns 400 INVALID_ID");

      // Non-existent ID
      const fakeId = new Types.ObjectId().toString();
      const reqNonExistent = new NextRequest(`http://localhost:3000/api/claims/${fakeId}`);
      const resNonExistent = await getClaimByIdRoute(reqNonExistent, { params: Promise.resolve({ id: fakeId }) });
      probeAssert(resNonExistent.status === 404, "3.10.2: Non-existent claim ID returns 404 NOT_FOUND");
    }

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log(`📊 ADVERSARIAL CHALLENGE EXECUTION SUMMARY`);
    console.log(`   Total Probes Executed: ${totalProbes}`);
    console.log(`   Probes Passed:         ${passedProbes}`);
    console.log(`   Probes Failed:         ${failedProbes}`);
    console.log("================================================================================");

    if (failedProbes > 0) {
      throw new Error(`Adversarial challenge suite encountered ${failedProbes} failure(s).`);
    } else {
      console.log("🎉 ALL ADVERSARIAL PRIVACY & PIN PROBES PASSED WITH ZERO LEAKAGE (100% VERIFIED)");
    }
  } finally {
    (globalThis as any).__TEST_CURRENT_USER__ = null;
    console.log(`\n🧹 Dropping ephemeral challenge database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral challenge database cleanly dropped.");
  }
}

runAdversarialPrivacyAndPinChallenges().catch((err) => {
  console.error("\n💥 ADVERSARIAL CHALLENGE RUNNER TERMINATED WITH ERROR:", err);
  process.exit(1);
});

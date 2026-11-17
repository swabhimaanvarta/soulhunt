import mongoose from "mongoose";
import crypto from "crypto";
import { User, LostItem, FoundItem, ClaimRequest, Achievement, UserAchievement, CampusLocation } from "../models";
import { GET as getProfileRoute } from "../app/api/user/profile/route";
import { GET as getClaimsRoute } from "../app/api/claims/route";
import { signSessionToken } from "../lib/jwt";
import { NextRequest } from "next/server";

const RUN_ID = `aiem_hunt_test_profile_audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

async function runProfilePrivacyLeakAudit() {
  console.log("========================================================");
  console.log("🔒 AIEM HUNT — PROFILE PRIVACY & LEAK AUDIT TEST");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`📦 Connected to ephemeral test database: ${RUN_ID}`);

  try {
    const campusLoc = await CampusLocation.create({
      name: "Admin & BSH Complex",
      code: "ADMIN-BSH",
      zoneType: "ACADEMIC_BLOCK",
      description: "Main administrative and basic science building",
      coordinates: { lat: 15.2, lng: 73.9, mapX: 45, mapY: 55 },
      floors: ["Ground", "First", "Second"],
      isSafeDesk: true,
      operatingHours: "08:00 AM - 06:00 PM",
      isActive: true,
    });
    const dummyLocationId = campusLoc._id;

    // 1. Seed test users
    const publicUser = await User.create({
      email: "public_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "agent_alpha",
      displayName: "Rahul Sharma",
      role: "ADMIN",
      department: "Computer Engineering",
      yearOfStudy: 3,
      coins: 750,
      xp: 1250,
      level: 3,
      rankTitle: "Eagle Eye",
      trustScore: 890,
      trustTier: "ELITE_INVESTIGATOR",
      phoneNumber: "+919876543210",
      studentId: "AIEM2023CS042",
      identityMode: "PSEUDONYMOUS",
      isProfilePublic: true,
      isLeaderboardPublic: true,
      stats: {
        recoveriesCount: 7,
        safeDeskDepositsCount: 4,
        questsCompleted: 12,
        cluesSolved: 25,
      },
    });

    const anonymousUser = await User.create({
      email: "shadow_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "shadow_99",
      displayName: "Vikram Das",
      role: "STUDENT",
      department: "Mechanical Engineering",
      yearOfStudy: 2,
      coins: 200,
      xp: 400,
      level: 1,
      rankTitle: "Rookie Seeker",
      trustScore: 500,
      trustTier: "NEW_HUNTER",
      identityMode: "ANONYMOUS",
      avatarPreset: "shadow",
      isProfilePublic: true,
      isLeaderboardPublic: true,
    });

    const privateUser = await User.create({
      email: "private_operative@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "classified_operative",
      displayName: "Classified Officer",
      role: "STUDENT",
      department: "Civil Engineering",
      yearOfStudy: 4,
      coins: 999,
      xp: 3500,
      level: 7,
      rankTitle: "Campus Guardian",
      trustScore: 950,
      trustTier: "ELITE_INVESTIGATOR",
      identityMode: "PSEUDONYMOUS",
      isProfilePublic: false,
      isLeaderboardPublic: false,
    });

    // A user with identityMode PUBLIC whose profile is set to private
    const privatePublicModeUser = await User.create({
      email: "secret_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "secret_agent",
      displayName: "Secret Real Name",
      role: "STUDENT",
      department: "Mechanical Engineering",
      yearOfStudy: 3,
      coins: 100,
      xp: 500,
      level: 1,
      rankTitle: "Shadow Hunter",
      identityMode: "PUBLIC", // Would normally show real name, but profile is private!
      isProfilePublic: false,
      isLeaderboardPublic: false,
    });

    const unrankedUser = await User.create({
      email: "unranked_student@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "quiet_seeker",
      displayName: "Quiet Seeker",
      role: "STUDENT",
      department: "Electronics & Computer Engineering",
      yearOfStudy: 1,
      coins: 50,
      xp: 800,
      level: 2,
      rankTitle: "Lead Decoder",
      identityMode: "PUBLIC",
      isProfilePublic: true,
      isLeaderboardPublic: false, // Leaderboard hidden
    });

    // Seed private records for publicUser
    await LostItem.create({
      reporterId: publicUser._id,
      title: "Confidential Engineering Notebook",
      category: "BOOKS_NOTES",
      publicDescription: "Spiral bound notebook with engineering diagrams",
      secretIdentifiers: "Notes on page 42",
      lastKnownLocationId: dummyLocationId,
      status: "ACTIVE",
      lostAt: new Date(),
      spotDetails: "Internal locker row B",
    });

    await FoundItem.create({
      finderId: publicUser._id,
      title: "Blue Scientific Calculator",
      shortTitle: "Calculator",
      category: "ELECTRONICS",
      publicDescription: "Casio scientific calculator",
      foundLocationId: dummyLocationId,
      status: "ACTIVE",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      foundAt: new Date(),
      spotDetails: "Near lab desk 14",
    });

    await ClaimRequest.create({
      claimantId: publicUser._id,
      counterpartyUserId: anonymousUser._id,
      itemType: "LOST",
      itemId: new mongoose.Types.ObjectId(),
      status: "APPROVED",
      handoverCode: "456789",
      handoverCodeHash: "hashed",
    });

    // ─── Test Suite 1: Visitor Query on Public Pseudonymous Profile ───
    console.log("\n─── Suite 1: Visitor Query on Public Pseudonymous Profile ───");
    {
      const req = new NextRequest(`http://localhost:3000/api/user/profile?username=agent_alpha`);
      const res = await getProfileRoute(req);
      const json = await res.json();

      if (!json.success) {
        console.error("GET profile error response:", res.status, json);
        throw new Error("Expected public profile query to succeed.");
      }
      const p = json.profile;

      // Assert private fields are strictly omitted
      const forbiddenFields = [
        "email",
        "phoneNumber",
        "studentId",
        "trustScore",
        "trustTier",
        "coins",
        "role",
      ];
      for (const field of forbiddenFields) {
        if (p[field] !== undefined) {
          throw new Error(`LEAK DETECTED: Field '${field}' was found in public visitor payload! Value: ${p[field]}`);
        }
      }
      console.log("  ✅ PASSED: email, phoneNumber, studentId, trustScore, trustTier, coins, and role are completely absent from public JSON response");

      // Assert pseudonymity: displayName masked to @username
      if (p.displayName !== "@agent_alpha") {
        throw new Error(`PSEUDONYMITY FAILED: Expected displayName '@agent_alpha' for PSEUDONYMOUS mode, got '${p.displayName}'`);
      }
      console.log("  ✅ PASSED: displayName correctly masked to '@agent_alpha' for PSEUDONYMOUS mode");

      // Assert private activities are completely empty
      if (json.activities.lostItems.length !== 0 || json.activities.foundItems.length !== 0 || json.activities.claims.length !== 0) {
        throw new Error("LEAK DETECTED: Private reporting/claims activity leaked to visitor!");
      }
      console.log("  ✅ PASSED: activities.lostItems, foundItems, and claims are strictly empty arrays []");

      // Assert coarse stats only
      if (p.stats.recoveriesCount !== 7 || p.stats.questsCompleted !== 12 || p.stats.visitedBlocks !== undefined) {
        throw new Error("LEAK DETECTED: Fine-grained user stats or visitedBlocks leaked!");
      }
      console.log("  ✅ PASSED: Only coarse aggregated stats returned without private block history");
    }

    // ─── Test Suite 2: Visitor Query on Anonymous Hunter Profile ───
    console.log("\n─── Suite 2: Visitor Query on Anonymous Hunter Profile ───");
    {
      const req = new NextRequest(`http://localhost:3000/api/user/profile?username=shadow_99`);
      const res = await getProfileRoute(req);
      const json = await res.json();
      const p = json.profile;

      if (p.displayName !== "Anonymous Hunter") {
        throw new Error(`ANONYMITY FAILED: Expected 'Anonymous Hunter', got '${p.displayName}'`);
      }
      console.log("  ✅ PASSED: displayName is masked to 'Anonymous Hunter' for ANONYMOUS mode");

      if (p.avatarPreset !== "recon" || !p.avatarUrl.includes("recon.png")) {
        throw new Error(`ANONYMOUS AVATAR FAILED: Expected fallback to 'recon', got preset='${p.avatarPreset}'`);
      }
      console.log("  ✅ PASSED: avatarPreset & avatarUrl safely defaulted to 'recon' for anonymous hunter");
    }

    // ─── Test Suite 3: Visitor Query on Leaderboard-Private Profile ───
    console.log("\n─── Suite 3: Visitor Query on Leaderboard-Private Profile ───");
    {
      const req = new NextRequest(`http://localhost:3000/api/user/profile?username=quiet_seeker`);
      const res = await getProfileRoute(req);
      const json = await res.json();
      const p = json.profile;

      if (p.level !== undefined || p.xp !== undefined) {
        throw new Error(`LEADERBOARD PRIVACY FAILED: level/xp was leaked! level=${p.level}, xp=${p.xp}`);
      }
      console.log("  ✅ PASSED: level and xp strictly omitted when isLeaderboardPublic is false");

      if (p.rankTitle !== "Unranked Operative") {
        throw new Error(`LEADERBOARD PRIVACY FAILED: Expected rankTitle 'Unranked Operative', got '${p.rankTitle}'`);
      }
      console.log("  ✅ PASSED: rankTitle safely masked to 'Unranked Operative'");

      if (Object.keys(p.stats).length !== 0) {
        throw new Error("LEADERBOARD PRIVACY FAILED: stats should be empty when leaderboard is private!");
      }
      console.log("  ✅ PASSED: public recovery stats suppressed when leaderboard is private");
    }

    // ─── Test Suite 4: Visitor Query on Classified (Private) Profile ───
    console.log("\n─── Suite 4: Visitor Query on Classified (Private) Profile ───");
    {
      const req = new NextRequest(`http://localhost:3000/api/user/profile?username=classified_operative`);
      const res = await getProfileRoute(req);
      const json = await res.json();

      if (!json.profileHidden) {
        throw new Error("PROFILE PRIVACY FAILED: Expected profileHidden: true for private profile.");
      }
      console.log("  ✅ PASSED: profileHidden is true for private operative");

      if (json.profile.level !== undefined || json.profile.stats !== undefined) {
        throw new Error("PROFILE PRIVACY FAILED: Level or stats leaked on private profile!");
      }
      console.log("  ✅ PASSED: Zero stats, level, or achievements leaked on private profile");

      // Test private user with identityMode: PUBLIC to ensure real displayName is NOT leaked
      const req2 = new NextRequest(`http://localhost:3000/api/user/profile?username=secret_agent`);
      const res2 = await getProfileRoute(req2);
      const json2 = await res2.json();

      if (!json2.profileHidden) {
        throw new Error("PROFILE PRIVACY FAILED: Expected profileHidden: true for secret_agent.");
      }
      if (json2.profile.displayName === "Secret Real Name") {
        throw new Error("CRITICAL PRIVACY LEAK: Private profile leaked user's real name 'Secret Real Name' because identityMode was PUBLIC!");
      }
      if (json2.profile.displayName !== "@secret_agent") {
        throw new Error(`MASKED HANDLE FAILED: Expected '@secret_agent', got '${json2.profile.displayName}'`);
      }
      console.log("  ✅ PASSED: Private profile with identityMode PUBLIC strictly masks to '@secret_agent' without leaking real name");
    }

    // ─── Test Suite 5: Authenticated Owner Profile Query ───
    console.log("\n─── Suite 5: Authenticated Owner Profile Query ───");
    {
      (globalThis as any).__TEST_CURRENT_USER__ = publicUser;

      const req = new NextRequest(`http://localhost:3000/api/user/profile`);
      const res = await getProfileRoute(req);
      const json = await res.json();

      if (!json.isOwnProfile) {
        throw new Error("OWNER VERIFICATION FAILED: isOwnProfile should be true.");
      }

      const p = json.profile;
      if (p.email !== "public_agent@aiemgoa.ac.in" || p.coins !== 750 || p.trustScore !== 890 || p.role !== "ADMIN") {
        throw new Error("OWNER DOSSIER FAILED: Owner was denied their authorized profile fields!");
      }
      console.log("  ✅ PASSED: Authenticated owner successfully receives full private dossier with credentials and coins");

      if (json.activities.lostItems.length !== 1 || json.activities.foundItems.length !== 1) {
        throw new Error("OWNER ACTIVITIES FAILED: Owner was denied their personal report history!");
      }
      console.log("  ✅ PASSED: Authenticated owner successfully receives personal reporting ledger");

      // Assert spotDetails is stripped and coarse location name is populated
      const lostItem = json.activities.lostItems[0];
      const foundItem = json.activities.foundItems[0];
      if (lostItem.spotDetails !== undefined || foundItem.spotDetails !== undefined) {
        throw new Error("SECURITY LEAK: Sensitive spotDetails leaked over the wire in ledger API response!");
      }
      if (!lostItem.lastKnownLocationId || lostItem.lastKnownLocationId.name !== "Admin & BSH Complex") {
        throw new Error(`LOCATION POPULATION FAILED: Expected coarse location 'Admin & BSH Complex', got: ${JSON.stringify(lostItem.lastKnownLocationId)}`);
      }
      console.log("  ✅ PASSED: Sensitive spotDetails stripped from reporting ledger; coarse location successfully populated");
    }

    // ─── Test Suite 6: Handover PIN Bulk Listing Omission ───
    console.log("\n─── Suite 6: Handover PIN Bulk Listing Omission ───");
    {
      (globalThis as any).__TEST_CURRENT_USER__ = publicUser;

      const req = new NextRequest(`http://localhost:3000/api/claims?role=all`);
      const res = await getClaimsRoute(req);
      const json = await res.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("CLAIMS FETCH FAILED: Expected claims list.");
      }

      for (const claim of json.data) {
        if (claim.handoverCode !== undefined) {
          throw new Error(`CRITICAL PIN LEAK: Plaintext handoverCode '${claim.handoverCode}' was broadcast in bulk GET /api/claims!`);
        }
      }
      console.log("  ✅ PASSED: handoverCode is strictly absent from all claims in bulk listing endpoint");

      (globalThis as any).__TEST_CURRENT_USER__ = null;
    }

    console.log("\n========================================================");
    console.log("🎉 ALL PROFILE PRIVACY LEAK AUDIT TESTS PASSED (100%)");
    console.log("========================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
  }
}

runProfilePrivacyLeakAudit().catch((err) => {
  console.error("❌ PROFILE PRIVACY LEAK AUDIT FAILED:", err);
  process.exit(1);
});

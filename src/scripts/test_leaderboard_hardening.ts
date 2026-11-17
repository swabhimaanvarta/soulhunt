import mongoose from "mongoose";
import crypto from "crypto";
import { User, Squad, SquadMember } from "../models";
import { GET as getLeaderboardRoute } from "../app/api/leaderboard/route";
import { NextRequest } from "next/server";

const RUN_ID = `aiem_hunt_test_lb_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runLeaderboardHardeningTests() {
  console.log("========================================================");
  console.log("🛡️  AIEM HUNT — LEADERBOARD HARDENING & PRIVACY TEST");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`📦 Connected to ephemeral test database: ${RUN_ID}`);

  try {
    // 1. Seed a test Squad
    const squadAlpha = await Squad.create({
      name: "Cyber Vanguard",
      tag: "VANG",
      description: "Elite campus recovery syndicate",
      emblemIcon: "ShieldAlert",
      leaderId: new mongoose.Types.ObjectId(),
      squadXp: 5000,
      squadLevel: 4,
      completedHuntsCount: 15,
      memberCap: 8,
      weeklyScore: 1200,
    });

    // 2. Seed Test Users with different identityModes, departments, and scores
    const pseudoHunter = await User.create({
      email: "pseudo_operative@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "ghost_runner",
      displayName: "Rohan Varma",
      role: "STUDENT",
      department: "Computer Engineering",
      yearOfStudy: 3,
      xp: 3200,
      level: 6,
      rankTitle: "Elite Tracker",
      weeklyScore: 850,
      trustScore: 880,
      trustTier: "ELITE_INVESTIGATOR",
      identityMode: "PSEUDONYMOUS",
      avatarPreset: "sleuth",
      equippedTitle: "Lead Decoder",
      equippedFrame: "frame-cyan-matrix",
      equippedTheme: "theme-cyber-cyan",
      accountStatus: "ACTIVE",
      isLeaderboardPublic: true,
      squadId: squadAlpha._id,
      stats: {
        recoveriesCount: 8,
        questsCompleted: 14,
        safeDeskDepositsCount: 3,
        cluesSolved: 20,
      },
    });

    const anonHunter = await User.create({
      email: "anon_hunter@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "phantom_operative",
      displayName: "Aarav Naik",
      role: "STUDENT",
      department: "Mechanical Engineering",
      yearOfStudy: 2,
      xp: 2500,
      level: 5,
      rankTitle: "Campus Sleuth",
      weeklyScore: 920,
      trustScore: 720,
      trustTier: "TRUSTED_HUNTER",
      identityMode: "ANONYMOUS",
      avatarPreset: "shadow", // Should be masked to 'recon'
      equippedTitle: "The Campus Phantom",
      equippedFrame: "frame-obsidian",
      equippedTheme: "theme-obsidian-grid",
      accountStatus: "ACTIVE",
      isLeaderboardPublic: true,
      stats: {
        recoveriesCount: 5,
        questsCompleted: 9,
      },
    });

    const publicHunter = await User.create({
      email: "public_hunter@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "sunil_tech",
      displayName: "Sunil Shenoy",
      role: "STUDENT",
      department: "Electronics & Computer Engineering",
      yearOfStudy: 4,
      xp: 4500,
      level: 8,
      rankTitle: "Campus Legend",
      weeklyScore: 600,
      trustScore: 950,
      trustTier: "ELITE_INVESTIGATOR",
      identityMode: "PUBLIC",
      avatarPreset: "vanguard",
      equippedTitle: "Campus Pathfinder",
      equippedFrame: "frame-emerald-pulse",
      equippedTheme: "theme-emerald-recon",
      accountStatus: "ACTIVE",
      isLeaderboardPublic: true,
      stats: {
        recoveriesCount: 12,
        questsCompleted: 22,
      },
    });

    const privateHunter = await User.create({
      email: "hidden_seeker@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "silent_fox",
      displayName: "Secret Seeker",
      role: "STUDENT",
      department: "Computer Engineering",
      yearOfStudy: 1,
      xp: 9999, // Super high xp, but opted out
      level: 10,
      rankTitle: "Ghost",
      weeklyScore: 5000,
      trustScore: 500,
      trustTier: "ACTIVE_HUNTER",
      identityMode: "PSEUDONYMOUS",
      accountStatus: "ACTIVE",
      isLeaderboardPublic: false, // Opted out of public leaderboard
    });

    // Seed SquadMembers for squadAlpha
    squadAlpha.leaderId = pseudoHunter._id;
    await squadAlpha.save();

    await SquadMember.create({
      squadId: squadAlpha._id,
      userId: pseudoHunter._id,
      role: "LEADER",
    });
    await SquadMember.create({
      squadId: squadAlpha._id,
      userId: publicHunter._id,
      role: "MEMBER",
    });

    console.log("\n─── Suite 1: Public Leaderboard Internal Moderation Leak Check ───");
    {
      const req = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const res = await getLeaderboardRoute(req);
      const json = await res.json();

      assert(json.success === true, "Leaderboard GET returned success: true");
      const hunters = json.data.hunters;
      assert(Array.isArray(hunters), "Hunters payload is an array");
      assert(hunters.length === 3, `Expected 3 public hunters, got ${hunters.length}`);

      for (const h of hunters) {
        assert(h.trustTier === undefined, `LEAK DETECTED: trustTier found in hunter payload for ${h.username}`);
        assert(h.trustScore === undefined, `LEAK DETECTED: trustScore found in hunter payload for ${h.username}`);
      }
      console.log("  ✅ PASSED: trustTier and trustScore are strictly omitted from public leaderboard payload");
    }

    console.log("\n─── Suite 2: Server-Side identityMode Masking ───");
    {
      const req = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const res = await getLeaderboardRoute(req);
      const json = await res.json();
      const hunters = json.data.hunters;

      const pseudo = hunters.find((h: any) => h.username === "ghost_runner");
      assert(pseudo !== undefined, "Found pseudonymous hunter");
      assert(pseudo.displayName === "@ghost_runner", `Expected '@ghost_runner', got '${pseudo.displayName}'`);
      assert(pseudo.avatarPreset === "sleuth", `Expected 'sleuth', got '${pseudo.avatarPreset}'`);
      console.log("  ✅ PASSED: PSEUDONYMOUS mode correctly masked displayName to @username");

      const anon = hunters.find((h: any) => h.username === "phantom_operative");
      assert(anon !== undefined, "Found anonymous hunter");
      assert(anon.displayName === "Anonymous Hunter", `Expected 'Anonymous Hunter', got '${anon.displayName}'`);
      assert(anon.avatarPreset === "recon", `Expected 'recon', got '${anon.avatarPreset}'`);
      console.log("  ✅ PASSED: ANONYMOUS mode correctly masked displayName to 'Anonymous Hunter' & defaulted avatarPreset to 'recon'");

      const pub = hunters.find((h: any) => h.username === "sunil_tech");
      assert(pub !== undefined, "Found public hunter");
      assert(pub.displayName === "Sunil Shenoy", `Expected 'Sunil Shenoy', got '${pub.displayName}'`);
      assert(pub.avatarPreset === "vanguard", `Expected 'vanguard', got '${pub.avatarPreset}'`);
      console.log("  ✅ PASSED: PUBLIC mode displays full user displayName");
    }

    console.log("\n─── Suite 3: Projections & Required Fields ───");
    {
      const req = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const res = await getLeaderboardRoute(req);
      const json = await res.json();
      const pseudo = json.data.hunters.find((h: any) => h.username === "ghost_runner");

      assert(pseudo.identityMode === "PSEUDONYMOUS", "identityMode is projected");
      assert(pseudo.equippedTitle === "Lead Decoder", "equippedTitle is projected");
      assert(pseudo.equippedFrame === "frame-cyan-matrix", "equippedFrame is projected");
      assert(pseudo.equippedTheme === "theme-cyber-cyan", "equippedTheme is projected");
      assert(pseudo.department === "Computer Engineering", "department is projected");
      assert(pseudo.level === 6, "level is projected");
      assert(pseudo.rankTitle === "Elite Tracker", "rankTitle is projected");
      assert(pseudo.xp === 3200, "xp is projected");
      assert(pseudo.weeklyScore === 850, "weeklyScore is projected");
      assert(pseudo.stats.recoveriesCount === 8, "stats.recoveriesCount is projected");
      assert(pseudo.stats.questsCompleted === 14, "stats.questsCompleted is projected");
      assert(pseudo.squadId && pseudo.squadId.tag === "VANG", "populated squadId with tag is projected");
      console.log("  ✅ PASSED: All tactical gaming cosmetics, stats, and squad affiliations projected cleanly");
    }

    console.log("\n─── Suite 4: Department Filtering ───");
    {
      const reqCE = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&department=Computer%20Engineering");
      const resCE = await getLeaderboardRoute(reqCE);
      const jsonCE = await resCE.json();
      assert(jsonCE.data.hunters.length === 1, `Expected 1 CE hunter, got ${jsonCE.data.hunters.length}`);
      assert(jsonCE.data.hunters[0].username === "ghost_runner", "Filtered to ghost_runner");

      const reqMech = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&department=Mechanical%20Engineering");
      const resMech = await getLeaderboardRoute(reqMech);
      const jsonMech = await resMech.json();
      assert(jsonMech.data.hunters.length === 1, `Expected 1 Mech hunter, got ${jsonMech.data.hunters.length}`);
      assert(jsonMech.data.hunters[0].username === "phantom_operative", "Filtered to phantom_operative");

      const reqAll = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&department=ALL");
      const resAll = await getLeaderboardRoute(reqAll);
      const jsonAll = await resAll.json();
      assert(jsonAll.data.hunters.length === 3, "ALL returns all 3 public hunters");
      console.log("  ✅ PASSED: Optional department filter accurately filters operatives view");
    }

    console.log("\n─── Suite 5: Deterministic Sorting (All-Time vs Weekly) ───");
    {
      // All-Time sort: xp: -1, level: -1, createdAt: 1, _id: 1
      const reqAllTime = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const resAllTime = await getLeaderboardRoute(reqAllTime);
      const jsonAllTime = await resAllTime.json();
      const huntersAT = jsonAllTime.data.hunters;
      assert(huntersAT[0].username === "sunil_tech", "#1 All-Time is sunil_tech with 4500 XP");
      assert(huntersAT[1].username === "ghost_runner", "#2 All-Time is ghost_runner with 3200 XP");
      assert(huntersAT[2].username === "phantom_operative", "#3 All-Time is phantom_operative with 2500 XP");
      console.log("  ✅ PASSED: Deterministic All-Time sorting (XP desc, Level desc)");

      // Weekly sort: weeklyScore: -1, xp: -1, level: -1, createdAt: 1, _id: 1
      const reqWeekly = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=WEEKLY");
      const resWeekly = await getLeaderboardRoute(reqWeekly);
      const jsonWeekly = await resWeekly.json();
      const huntersW = jsonWeekly.data.hunters;
      assert(huntersW[0].username === "phantom_operative", "#1 Weekly is phantom_operative with 920 weeklyScore");
      assert(huntersW[1].username === "ghost_runner", "#2 Weekly is ghost_runner with 850 weeklyScore");
      assert(huntersW[2].username === "sunil_tech", "#3 Weekly is sunil_tech with 600 weeklyScore");
      console.log("  ✅ PASSED: Deterministic Weekly Season sorting (weeklyScore desc)");
    }

    console.log("\n─── Suite 6: Squads Real Dynamic Member Count, Default memberCap & Leader Identity ───");
    {
      const req = new NextRequest("http://localhost:3000/api/leaderboard?category=SQUADS");
      const res = await getLeaderboardRoute(req);
      const json = await res.json();
      assert(json.success === true, "Squads GET returned success");
      const squads = json.data.squads;
      assert(squads.length === 1, "Squads list has 1 squad");

      const s = squads[0];
      assert(s.memberCount === 2, `Expected real memberCount of 2, got ${s.memberCount}`);
      assert(s.memberCap === 8, `Expected memberCap of 8, got ${s.memberCap}`);
      assert(s.leaderId !== null && s.leaderId !== undefined, "Squad leader is populated");
      assert(s.leaderId.displayName === "@ghost_runner", `Squad leader displayName masked to @username (got ${s.leaderId.displayName})`);
      console.log("  ✅ PASSED: Real dynamic squad member count (2), projected memberCap (8, NOT 50), and leader identityMode masking");
    }

    console.log("\n─── Suite 7: Authenticated Viewer Standing HUD Projection ───");
    {
      (globalThis as any).__TEST_CURRENT_USER__ = pseudoHunter;

      // 7.1: Global rank (no department filter)
      const req = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const res = await getLeaderboardRoute(req);
      const json = await res.json();
      const vp = json.data.viewerPosition;

      assert(vp !== null, "viewerPosition is present for authenticated user");
      assert(vp.userId === pseudoHunter._id.toString(), "viewerPosition matches current user id");
      assert(vp.rank === 2, `Expected rank 2 for ghost_runner (behind sunil_tech), got ${vp.rank}`);
      assert(vp.xp === 3200, "viewerPosition includes xp");
      assert(vp.percentile !== null, "percentile calculated");

      // 7.2: Department rank when current user matches filter (Computer Engineering)
      const reqCE = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&department=Computer%20Engineering");
      const resCE = await getLeaderboardRoute(reqCE);
      const jsonCE = await resCE.json();
      const vpCE = jsonCE.data.viewerPosition;
      assert(vpCE.rank === 1, `Expected rank 1 in own department (Computer Engineering), got ${vpCE.rank}`);

      // 7.3: Fallback to global rank when viewing another department (Mechanical Engineering)
      const reqMech = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&department=Mechanical%20Engineering");
      const resMech = await getLeaderboardRoute(reqMech);
      const jsonMech = await resMech.json();
      const vpMech = jsonMech.data.viewerPosition;
      assert(vpMech.rank === 2, `Expected fallback to global rank 2 when viewing other department, got ${vpMech.rank}`);
      assert(vpMech.isLeaderboardPublic === true, "isLeaderboardPublic remains true across department filter");

      // 7.4: Opted out user standing check
      (globalThis as any).__TEST_CURRENT_USER__ = privateHunter;
      const reqPrivate = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS");
      const resPrivate = await getLeaderboardRoute(reqPrivate);
      const jsonPrivate = await resPrivate.json();
      const vpPrivate = jsonPrivate.data.viewerPosition;

      assert(vpPrivate !== null, "viewerPosition returned for private user");
      assert(vpPrivate.rank === null, "Opted out user rank is null");
      assert(vpPrivate.isLeaderboardPublic === false, "isLeaderboardPublic is false");

      delete (globalThis as any).__TEST_CURRENT_USER__;
      console.log("  ✅ PASSED: Authenticated viewer real-time standing HUD correctly calculated, masked, and preserves global rank across filters");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL LEADERBOARD HARDENING TESTS PASSED (100%)");
    console.log("========================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.");
  }
}

runLeaderboardHardeningTests().catch((err) => {
  console.error("❌ LEADERBOARD HARDENING TEST FAILED:", err);
  process.exit(1);
});

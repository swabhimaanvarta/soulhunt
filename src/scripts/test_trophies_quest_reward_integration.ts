import mongoose from "mongoose";
import crypto from "crypto";
import { User, Squad, Quest, Clue, Investigation, Transaction, CampusLocation } from "../models";
import { POST as recoverRoute } from "../app/api/investigations/[id]/recover/route";
import { GET as getMeRoute } from "../app/api/auth/me/route";
import { GET as getProfileRoute } from "../app/api/user/profile/route";
import { GET as getLeaderboardRoute } from "../app/api/leaderboard/route";
import { NextRequest } from "next/server";

const RUN_ID = `aiem_hunt_test_trophies_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTrophiesIntegrationTests() {
  console.log("========================================================");
  console.log("🏆 AIEM HUNT — TROPHIES SYSTEM & QUEST REWARD TEST SUITE");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`📦 Connected to ephemeral test database: ${RUN_ID}`);

  try {
    // 0. Seed Campus Location
    const location = await CampusLocation.create({
      name: "Central Library Quad",
      code: "LIB-QUAD",
      zoneType: "LIBRARY",
      building: "Library Block",
      coordinates: {
        lat: 15.2993,
        lng: 73.8567,
        mapX: 50,
        mapY: 50,
      },
    });

    // 1. Seed Squad
    const testSquad = await Squad.create({
      name: "Challenger Syndicate",
      tag: "CHAL",
      description: "Tactical Investigation Unit",
      emblemIcon: "ShieldAlert",
      leaderId: new mongoose.Types.ObjectId(),
      squadXp: 1000,
      squadLevel: 2,
      trophies: 100,
      weeklyScore: 100,
      completedHuntsCount: 2,
      memberCap: 8,
    });

    // 2. Seed Test Users
    const soloHunter = await User.create({
      email: "solo_hunter@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "soloSleuth",
      displayName: "Solo Sleuth",
      role: "STUDENT",
      department: "Computer Engineering",
      yearOfStudy: 2,
      xp: 500,
      level: 2,
      coins: 100,
      trophies: 50,
      weeklyScore: 50,
      accountStatus: "ACTIVE",
      isLeaderboardPublic: true,
      identityMode: "PUBLIC",
    });

    const squadHunter = await User.create({
      email: "squad_hunter@aiemgoa.ac.in",
      passwordHash: "hash123",
      username: "squadVanguard",
      displayName: "Squad Vanguard",
      role: "STUDENT",
      department: "Electronics Engineering",
      yearOfStudy: 3,
      xp: 800,
      level: 3,
      coins: 150,
      trophies: 80,
      weeklyScore: 80,
      squadId: testSquad._id,
      accountStatus: "ACTIVE",
      isLeaderboardPublic: true,
      identityMode: "PUBLIC",
    });

    testSquad.leaderId = squadHunter._id as mongoose.Types.ObjectId;
    await testSquad.save();

    // 3. Seed Quests with trophyReward
    const soloQuest = await Quest.create({
      questCode: "QUEST-SOLO-01",
      title: "The Cryptic Library Archive",
      description: "Decipher encrypted manuscripts in the basement library.",
      questType: "CAMPUS_TREASURE",
      difficulty: 3,
      targetLocationId: location._id,
      xpReward: 150,
      coinReward: 75,
      trophyReward: 45, // Explicit trophy reward
      status: "ACTIVE",
    });

    const squadQuest = await Quest.create({
      questCode: "QUEST-SQUAD-01",
      title: "Operation Iron Vault",
      description: "Syndicate-level breach simulation in the server rooms.",
      questType: "SQUAD_HUNT",
      difficulty: 4,
      targetLocationId: location._id,
      xpReward: 300,
      coinReward: 120,
      squadXpReward: 100,
      trophyReward: 60, // Squad trophy reward
      status: "ACTIVE",
    });

    // 4. Seed Clues
    const soloClue = await Clue.create({
      questId: soloQuest._id,
      stageOrder: 1,
      title: "First Archive Clue",
      clueText: "Locate shelf 42B.",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "42b",
      unlockedBreadcrumbText: "Found the hidden manuscript.",
    });

    const squadClue = await Clue.create({
      questId: squadQuest._id,
      stageOrder: 1,
      title: "Vault Access Clue",
      clueText: "Crack cipher node Alpha.",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "alpha7",
      unlockedBreadcrumbText: "Server room clearance granted.",
    });

    console.log("\n─── Suite 1: Solo Quest Completion & Trophies Payout ───");
    {
      // Create completed investigation ready for recovery
      const soloInvestigation = await Investigation.create({
        questId: soloQuest._id,
        userId: soloHunter._id,
        currentStage: 2,
        progressPct: 90,
        status: "READY_FOR_RECOVERY",
        solvedClues: [
          {
            clueId: soloClue._id,
            stageOrder: 1,
            solvedByUserId: soloHunter._id,
            solvedByName: soloHunter.displayName,
            solvedAt: new Date(),
          },
        ],
        participatingUserIds: [soloHunter._id],
      });

      (globalThis as any).__TEST_CURRENT_USER__ = soloHunter;

      const req = new NextRequest(
        `http://localhost:3000/api/investigations/${soloInvestigation._id}/recover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const res = await recoverRoute(req, {
        params: Promise.resolve({ id: soloInvestigation._id.toString() }),
      });
      const json = await res.json();

      assert(json.success === true, "Recovery endpoint succeeded");
      assert(json.data.status === "COMPLETED", "Investigation marked COMPLETED");
      assert(json.data.rewards.trophies === 45, `Expected 45 trophies, got ${json.data.rewards.trophies}`);

      // Verify DB update
      const updatedSoloHunter = await User.findById(soloHunter._id);
      assert(
        updatedSoloHunter?.trophies === 50 + 45,
        `Expected user trophies to be 95, got ${updatedSoloHunter?.trophies}`
      );
      assert(
        updatedSoloHunter?.weeklyScore === 50 + 45,
        `Expected user weeklyScore to be 95, got ${updatedSoloHunter?.weeklyScore}`
      );

      // Verify transaction record
      const tx = await Transaction.findOne({
        userId: soloHunter._id,
        referenceType: "QUEST",
        referenceId: soloQuest._id,
      });
      assert(tx !== null, "Transaction created for quest");
      assert(tx?.deltaTrophies === 45, `Expected deltaTrophies of 45 in transaction, got ${tx?.deltaTrophies}`);

      console.log("  ✅ PASSED: Solo quest completed and awarded 45 Trophies atomically to user and transaction ledger.");
    }

    console.log("\n─── Suite 2: Squad Quest Completion & Syndicate Trophies ───");
    {
      const squadInvestigation = await Investigation.create({
        questId: squadQuest._id,
        userId: squadHunter._id,
        squadId: testSquad._id,
        isSquadInvestigation: true,
        currentStage: 2,
        progressPct: 90,
        status: "READY_FOR_RECOVERY",
        solvedClues: [
          {
            clueId: squadClue._id,
            stageOrder: 1,
            solvedByUserId: squadHunter._id,
            solvedByName: squadHunter.displayName,
            solvedAt: new Date(),
          },
        ],
        participatingUserIds: [squadHunter._id],
      });

      (globalThis as any).__TEST_CURRENT_USER__ = squadHunter;

      const req = new NextRequest(
        `http://localhost:3000/api/investigations/${squadInvestigation._id}/recover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const res = await recoverRoute(req, {
        params: Promise.resolve({ id: squadInvestigation._id.toString() }),
      });
      const json = await res.json();

      assert(json.success === true, "Squad recovery succeeded");
      assert(json.data.status === "COMPLETED", "Squad investigation marked COMPLETED");
      assert(json.data.rewards.trophies === 60, `Expected 60 trophies, got ${json.data.rewards.trophies}`);

      // Verify User update
      const updatedSquadHunter = await User.findById(squadHunter._id);
      assert(
        (updatedSquadHunter?.trophies ?? 0) >= 80 + 60,
        `Expected hunter trophies >= 140, got ${updatedSquadHunter?.trophies}`
      );

      // Verify Squad update
      const updatedSquad = await Squad.findById(testSquad._id);
      assert(
        updatedSquad?.trophies === 100 + 60,
        `Expected squad trophies to be 160, got ${updatedSquad?.trophies}`
      );
      assert(
        updatedSquad?.weeklyScore === 100 + 60,
        `Expected squad weeklyScore to be 160, got ${updatedSquad?.weeklyScore}`
      );

      console.log("  ✅ PASSED: Squad quest completed and credited Trophies to both operative and syndicate.");
    }

    console.log("\n─── Suite 3: Auth / Me & Profile Dossier Trophies Projection ───");
    {
      const updatedSoloHunter = await User.findById(soloHunter._id);
      (globalThis as any).__TEST_CURRENT_USER__ = updatedSoloHunter;

      // GET /api/auth/me
      const meRes = await getMeRoute();
      const meJson = await meRes.json();
      assert(meJson.success === true, "GET /api/auth/me succeeded");
      assert(meJson.data.trophies === 95, `Expected me.trophies to be 95, got ${meJson.data.trophies}`);

      // GET /api/user/profile?username=soloSleuth
      const profileReq = new NextRequest("http://localhost:3000/api/user/profile?username=soloSleuth");
      const profileRes = await getProfileRoute(profileReq);
      const profileJson = await profileRes.json();
      assert(profileJson.success === true, "GET /api/user/profile succeeded");
      assert(profileJson.profile.trophies === 95, `Expected profile.trophies to be 95, got ${profileJson.profile?.trophies}`);

      console.log("  ✅ PASSED: /api/auth/me and /api/user/profile correctly return authentic trophies.");
    }

    console.log("\n─── Suite 4: Leaderboard Trophies Projection & Standings ───");
    {
      const lbReq = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const lbRes = await getLeaderboardRoute(lbReq);
      const lbJson = await lbRes.json();
      assert(lbJson.success === true, "GET /api/leaderboard succeeded");

      const hunters = lbJson.data.hunters;
      const foundSolo = hunters.find((h: any) => h.username === "solosleuth");
      assert(foundSolo !== undefined, "solosleuth listed on leaderboard");
      assert(foundSolo.trophies === 95, `Expected leaderboard solosleuth trophies 95, got ${foundSolo?.trophies}`);

      const vp = lbJson.data.viewerPosition;
      assert(vp !== null, "viewerPosition present");
      assert(vp.trophies === 95, `Expected viewerPosition.trophies 95, got ${vp.trophies}`);

      // Squad leaderboard check
      const sqLbReq = new NextRequest("http://localhost:3000/api/leaderboard?category=SQUADS&timeframe=ALL_TIME");
      const sqLbRes = await getLeaderboardRoute(sqLbReq);
      const sqLbJson = await sqLbRes.json();
      assert(sqLbJson.success === true, "GET /api/leaderboard SQUADS succeeded");
      const foundSquad = sqLbJson.data.squads.find((s: any) => s.tag === "CHAL");
      assert(foundSquad !== undefined, "Challenger Syndicate listed on leaderboard");
      assert(foundSquad.trophies === 160, `Expected squad trophies 160, got ${foundSquad.trophies}`);

      console.log("  ✅ PASSED: Leaderboard operative and syndicate rosters correctly project and sort by Trophies.");
    }

    delete (globalThis as any).__TEST_CURRENT_USER__;

    console.log("\n========================================================");
    console.log("🎉 ALL TROPHIES SYSTEM INTEGRATION TESTS PASSED (100%)");
    console.log("========================================================");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly.");
  }
}

runTrophiesIntegrationTests().catch((err) => {
  console.error("❌ TROPHIES INTEGRATION TEST FAILED:", err);
  process.exit(1);
});

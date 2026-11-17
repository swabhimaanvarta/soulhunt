import mongoose from "mongoose";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { User, Squad, Quest, Clue, Investigation, Transaction, CampusLocation } from "../models";
import { GET, POST } from "../app/api/quests/[id]/complete/route";
import { GET as getQuestCompleteStatus, POST as completeQuestRoute } from "../app/api/quests/[id]/complete/route";

const RUN_ID = `aiem_hunt_pr1_challenge_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

function assertStandardEnvelope(json: any, expectedSuccess: boolean, contextStr: string) {
  assert(
    typeof json === "object" && json !== null,
    `${contextStr}: Response must be an object. Got: ${typeof json}`
  );
  assert(
    json.success === expectedSuccess,
    `${contextStr}: Expected json.success to be ${expectedSuccess}, got ${json.success}`
  );

  if (expectedSuccess) {
    assert(
      typeof json.data === "object" && json.data !== null,
      `${contextStr}: Success envelope must include non-null 'data' object. Got: ${JSON.stringify(json)}`
    );
    assert(
      json.error === undefined,
      `${contextStr}: Success envelope should not include 'error'. Got: ${JSON.stringify(json.error)}`
    );
  } else {
    assert(
      typeof json.code === "string" && json.code.length > 0,
      `${contextStr}: Error envelope must include top-level 'code' string. Got: ${JSON.stringify(json)}`
    );
    assert(
      typeof json.error === "object" && json.error !== null,
      `${contextStr}: Error envelope must include nested 'error' object. Got: ${JSON.stringify(json)}`
    );
    assert(
      typeof json.error.message === "string" && json.error.message.length > 0,
      `${contextStr}: Error envelope must include 'error.message'. Got: ${JSON.stringify(json)}`
    );
  }
}

async function verifyImportsAcrossProject() {
  console.log("\n📦 Check 1: Scanning static imports across src/ and src/scripts/...");
  const srcDir = path.resolve(__dirname, "..");
  let scannedFiles = 0;
  let verifiedImports = 0;

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next") {
          scanDir(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        scannedFiles++;
        const content = fs.readFileSync(fullPath, "utf-8");
        // Regex to find relative imports and @/ imports
        const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([.@][^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          let resolvedPath: string | null = null;

          if (importPath.startsWith("@/")) {
            resolvedPath = path.join(srcDir, importPath.slice(2));
          } else if (importPath.startsWith("./") || importPath.startsWith("../")) {
            resolvedPath = path.resolve(path.dirname(fullPath), importPath);
          }

          if (resolvedPath) {
            const candidates = [
              resolvedPath,
              resolvedPath + ".ts",
              resolvedPath + ".tsx",
              resolvedPath + ".js",
              resolvedPath + ".mjs",
              path.join(resolvedPath, "index.ts"),
              path.join(resolvedPath, "index.tsx"),
              path.join(resolvedPath, "index.js"),
              path.join(resolvedPath, "route.ts"),
              path.join(resolvedPath, "page.tsx"),
            ];
            const exists = candidates.some((cand) => fs.existsSync(cand));
            if (!exists) {
              throw new Error(`Broken import found in ${fullPath}: '${importPath}' resolved to '${resolvedPath}' which does not exist.`);
            }
            verifiedImports++;
          }
        }
      }
    }
  }

  scanDir(srcDir);
  console.log(`  ✅ PASSED: Scanned ${scannedFiles} source files, verified ${verifiedImports} local imports without broken references.`);
}

async function runAdversarialRouteTests() {
  console.log("========================================================");
  console.log("🛡️ EMPIRICAL CHALLENGER: QUEST COMPLETE ROUTE SUITE");
  console.log(`   Database: ${TEST_DB_URI}`);
  console.log("========================================================");

  // 1. Verify Imports and Function Signatures
  console.log("\n📦 Check 2: Verifying Direct and Alias Route Function Signatures...");
  assert(typeof GET === "function", "GET export is a function");
  assert(typeof POST === "function", "POST export is a function");
  assert(typeof getQuestCompleteStatus === "function", "Alias getQuestCompleteStatus is a function");
  assert(typeof completeQuestRoute === "function", "Alias completeQuestRoute is a function");
  assert(GET === getQuestCompleteStatus, "GET and getQuestCompleteStatus reference identical function");
  assert(POST === completeQuestRoute, "POST and completeQuestRoute reference identical function");
  console.log("  ✅ PASSED: GET and POST imports and aliases function seamlessly.");

  // Connect to ephemeral DB
  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`\n📦 Connected to ephemeral DB: ${RUN_ID}`);

  try {
    // Seed Location
    const loc = await CampusLocation.create({
      name: "Challenger Testing Lab",
      code: "LAB-CHAL",
      zoneType: "ACADEMIC_BLOCK",
      building: "Engineering Block",
      coordinates: { lat: 15.299, lng: 73.856, mapX: 20, mapY: 30 },
    });

    // Seed Squad
    const squad = await Squad.create({
      name: "Adversarial Testers",
      tag: "TEST",
      description: "Automated Verification Unit",
      emblemIcon: "ShieldCheck",
      leaderId: new mongoose.Types.ObjectId(),
      squadXp: 500,
      squadLevel: 1,
      trophies: 50,
      weeklyScore: 50,
      completedHuntsCount: 0,
      memberCap: 5,
    });

    // Seed Users
    const userSolo = await User.create({
      username: `challenger_solo_${Date.now()}`,
      email: `solo_${Date.now()}@aiemgoa.ac.in`,
      displayName: "Challenger Solo",
      passwordHash: "hash",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 200,
      level: 1,
      coins: 50,
      trophies: 20,
      weeklyScore: 20,
      claimedLevelRewards: [],
    });

    const userSquad = await User.create({
      username: `challenger_squad_${Date.now()}`,
      email: `squad_${Date.now()}@aiemgoa.ac.in`,
      displayName: "Challenger Squad",
      passwordHash: "hash",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 300,
      level: 1,
      coins: 60,
      trophies: 30,
      weeklyScore: 30,
      squadId: squad._id,
      claimedLevelRewards: [],
    });

    squad.leaderId = userSquad._id;
    await squad.save();

    // Seed Active and Draft Quests
    const activeQuest = await Quest.create({
      questCode: `Q-ACT-${Date.now()}`,
      title: "Active Challenge Quest",
      description: "Active quest for empirical verification.",
      questType: "CAMPUS_TREASURE",
      difficulty: 2,
      xpReward: 100,
      coinReward: 20,
      trophyReward: 30,
      squadXpReward: 0,
      targetLocationId: loc._id,
      status: "ACTIVE",
    });

    const draftQuest = await Quest.create({
      questCode: `Q-DFT-${Date.now()}`,
      title: "Draft Inactive Quest",
      description: "Draft quest that should reject completion.",
      questType: "CAMPUS_TREASURE",
      difficulty: 1,
      xpReward: 50,
      coinReward: 10,
      trophyReward: 15,
      squadXpReward: 0,
      targetLocationId: loc._id,
      status: "DRAFT",
    });

    const squadQuest = await Quest.create({
      questCode: `Q-SQD-${Date.now()}`,
      title: "Squad Syndicate Quest",
      description: "Squad hunt for empirical verification.",
      questType: "SQUAD_HUNT",
      difficulty: 3,
      xpReward: 200,
      coinReward: 40,
      trophyReward: 50,
      squadXpReward: 80,
      targetLocationId: loc._id,
      status: "ACTIVE",
    });

    // ─── Scenario A: Unauthenticated Calls ──────────────────────────────
    console.log("\n─── Scenario A: Unauthenticated Calls ───");
    (globalThis as any).__TEST_CURRENT_USER__ = null;

    // A1: POST without auth -> 401
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: activeQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 401, `Unauth POST expected HTTP 401, got ${res.status}`);
      assertStandardEnvelope(json, false, "Unauth POST");
      assert(json.code === "UNAUTHORIZED", `Expected code UNAUTHORIZED, got ${json.code}`);
      console.log("  ✅ A1 PASSED: Unauthenticated POST returns standard 401 UNAUTHORIZED envelope.");
    }

    // A2: GET without auth on existing quest -> 200 with completed=false
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "GET",
      });
      const res = await GET(req, { params: Promise.resolve({ id: activeQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 200, `Unauth GET expected HTTP 200, got ${res.status}`);
      assertStandardEnvelope(json, true, "Unauth GET existing quest");
      assert(json.data.isCompletedByUser === false, "isCompletedByUser must be false");
      assert(json.data.isCompletedBySquad === false, "isCompletedBySquad must be false");
      console.log("  ✅ A2 PASSED: Unauthenticated GET returns standard 200 envelope with false completion status.");
    }

    // A3: GET without auth on non-existent quest -> 404
    {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const req = new NextRequest(`http://localhost:3000/api/quests/${fakeId}/complete`, {
        method: "GET",
      });
      const res = await GET(req, { params: Promise.resolve({ id: fakeId }) });
      const json = await res.json();
      assert(res.status === 404, `Unauth GET missing quest expected HTTP 404, got ${res.status}`);
      assertStandardEnvelope(json, false, "Unauth GET missing quest");
      assert(json.code === "NOT_FOUND", `Expected NOT_FOUND, got ${json.code}`);
      console.log("  ✅ A3 PASSED: Unauthenticated GET on non-existent quest returns standard 404 NOT_FOUND envelope.");
    }

    // ─── Scenario B: Non-Existent or Inactive Quests (Authenticated) ─────
    console.log("\n─── Scenario B: Non-Existent or Inactive Quests ───");
    (globalThis as any).__TEST_CURRENT_USER__ = userSolo;

    // B1: POST to non-existent quest -> 404 QUEST_NOT_FOUND
    {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const req = new NextRequest(`http://localhost:3000/api/quests/${fakeId}/complete`, {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: fakeId }) });
      const json = await res.json();
      assert(res.status === 404, `POST missing quest expected HTTP 404, got ${res.status}`);
      assertStandardEnvelope(json, false, "POST missing quest");
      assert(json.code === "QUEST_NOT_FOUND", `Expected QUEST_NOT_FOUND, got ${json.code}`);
      console.log("  ✅ B1 PASSED: POST to non-existent quest returns 404 QUEST_NOT_FOUND envelope.");
    }

    // B2: POST to draft / inactive quest -> 404 QUEST_NOT_FOUND
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${draftQuest._id}/complete`, {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: draftQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 404, `POST draft quest expected HTTP 404, got ${res.status}`);
      assertStandardEnvelope(json, false, "POST draft quest");
      assert(json.code === "QUEST_NOT_FOUND", `Expected QUEST_NOT_FOUND, got ${json.code}`);
      console.log("  ✅ B2 PASSED: POST to inactive/draft quest returns 404 QUEST_NOT_FOUND envelope.");
    }

    // ─── Scenario C: Quest Not Accepted ──────────────────────────────────
    console.log("\n─── Scenario C: Quest Not Accepted ───");
    // C1: Active quest exists, but user has never started an investigation for it
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await POST(req, { params: Promise.resolve({ id: activeQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 400, `POST unaccepted quest expected HTTP 400, got ${res.status}`);
      assertStandardEnvelope(json, false, "POST unaccepted quest");
      assert(json.code === "NOT_ACCEPTED", `Expected NOT_ACCEPTED, got ${json.code}`);
      console.log("  ✅ C1 PASSED: POST to unaccepted quest returns 400 NOT_ACCEPTED envelope.");
    }

    // ─── Scenario D: Malformed / Empty Request Body Resilience ───────────
    console.log("\n─── Scenario D: Request Body Resilience ───");
    // Create active investigation for userSolo
    const soloInv = await Investigation.create({
      questId: activeQuest._id,
      userId: userSolo._id,
      currentStage: 1,
      progressPct: 80,
      status: "IN_PROGRESS",
      participatingUserIds: [userSolo._id],
    });

    // D1: POST with non-JSON or malformed body
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "NOT_JSON_BODY",
      });
      // Should not throw, should process gracefully
      const res = await POST(req, { params: Promise.resolve({ id: activeQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 200, `POST with malformed body should succeed gracefully, got ${res.status}`);
      assertStandardEnvelope(json, true, "POST malformed body");
      assert(json.data.status === "COMPLETED", "Marked COMPLETED");
      console.log("  ✅ D1 PASSED: POST safely handles malformed body without crash and completes quest.");
    }

    // ─── Scenario E: Status & Payout Verification ────────────────────────
    console.log("\n─── Scenario E: Reward Payout & Status Reflection ───");
    {
      // E1: Verify GET now reports completed
      const req = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "GET",
      });
      const res = await GET(req, { params: Promise.resolve({ id: activeQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 200, `GET completed quest expected HTTP 200, got ${res.status}`);
      assertStandardEnvelope(json, true, "GET completed quest");
      assert(json.data.isCompletedByUser === true, "isCompletedByUser must be true");
      assert(json.data.isCompletedBySquad === false, "isCompletedBySquad must be false");

      // Verify DB updates
      const updatedUser = await User.findById(userSolo._id);
      assert(updatedUser?.trophies === 20 + 30, `Expected 50 trophies, got ${updatedUser?.trophies}`);
      // 50 initial + 20 quest reward + 50 level-up bonus (level 1 -> level 2 = 25*2) = 120 coins
      assert(updatedUser?.coins === 120, `Expected 120 coins, got ${updatedUser?.coins}`);
      assert(updatedUser?.level === 2, `Expected level 2, got ${updatedUser?.level}`);
      assert(updatedUser?.stats?.questsCompleted === 1, `Expected questsCompleted === 1`);
      console.log("  ✅ E1 PASSED: GET accurately reflects isCompletedByUser=true and rewards are credited.");
    }

    // ─── Scenario F: Repeat & Concurrent Double-Completion Attacks ───────
    console.log("\n─── Scenario F: Idempotency & Concurrency Stress ───");
    // F1: Immediate repeat POST on completed quest
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await POST(req, { params: Promise.resolve({ id: activeQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 400, `Repeat POST expected HTTP 400, got ${res.status}`);
      assertStandardEnvelope(json, false, "Repeat POST");
      assert(json.code === "ALREADY_COMPLETED", `Expected ALREADY_COMPLETED, got ${json.code}`);
      console.log("  ✅ F1 PASSED: Repeat completion rejected with 400 ALREADY_COMPLETED envelope.");
    }

    // F2: Concurrency race condition simulation
    {
      // Create new quest and fresh investigation
      const raceQuest = await Quest.create({
        questCode: `Q-RACE-${Date.now()}`,
        title: "Race Condition Stress Quest",
        description: "Stress test concurrency guard.",
        questType: "CAMPUS_TREASURE",
        difficulty: 1,
        xpReward: 50,
        coinReward: 10,
        trophyReward: 10,
        squadXpReward: 0,
        targetLocationId: loc._id,
        status: "ACTIVE",
      });

      await Investigation.create({
        questId: raceQuest._id,
        userId: userSolo._id,
        currentStage: 1,
        progressPct: 90,
        status: "IN_PROGRESS",
        participatingUserIds: [userSolo._id],
      });

      // Fire 5 simultaneous POST requests
      const promises = Array.from({ length: 5 }, () => {
        const req = new NextRequest(`http://localhost:3000/api/quests/${raceQuest._id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return POST(req, { params: Promise.resolve({ id: raceQuest._id.toString() }) });
      });

      const results = await Promise.all(promises);
      const responses = await Promise.all(results.map((r) => r.json()));

      const successCount = responses.filter((r) => r.success === true).length;
      const alreadyCompletedCount = responses.filter((r) => r.code === "ALREADY_COMPLETED").length;

      assert(successCount === 1, `Exactly 1 request must succeed in race condition. Got ${successCount}`);
      assert(alreadyCompletedCount === 4, `Exactly 4 requests must fail with ALREADY_COMPLETED. Got ${alreadyCompletedCount}`);
      console.log("  ✅ F2 PASSED: Concurrency stress (5 parallel requests) strictly yields exactly 1 success and 4 ALREADY_COMPLETED rejections.");
    }

    // ─── Scenario G: Squad Quest Completion ──────────────────────────────
    console.log("\n─── Scenario G: Squad Quest Completion ───");
    (globalThis as any).__TEST_CURRENT_USER__ = userSquad;

    const squadInv = await Investigation.create({
      questId: squadQuest._id,
      userId: userSquad._id,
      squadId: squad._id,
      isSquadInvestigation: true,
      currentStage: 1,
      progressPct: 90,
      status: "IN_PROGRESS",
      participatingUserIds: [userSquad._id],
    });

    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${squadQuest._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await POST(req, { params: Promise.resolve({ id: squadQuest._id.toString() }) });
      const json = await res.json();
      assert(res.status === 200, `Squad POST expected HTTP 200, got ${res.status}`);
      assertStandardEnvelope(json, true, "Squad POST");
      assert(json.data.status === "COMPLETED", "Marked COMPLETED");

      // Verify GET reports both isCompletedByUser and isCompletedBySquad
      const getReq = new NextRequest(`http://localhost:3000/api/quests/${squadQuest._id}/complete`, {
        method: "GET",
      });
      const getRes = await GET(getReq, { params: Promise.resolve({ id: squadQuest._id.toString() }) });
      const getJson = await getRes.json();
      assert(getRes.status === 200, "Squad GET expected 200");
      assertStandardEnvelope(getJson, true, "Squad GET");
      assert(getJson.data.isCompletedByUser === true, "isCompletedByUser must be true");
      assert(getJson.data.isCompletedBySquad === true, "isCompletedBySquad must be true");

      // Verify squad trophies updated
      const updatedSquad = await Squad.findById(squad._id);
      assert(updatedSquad?.trophies === 50 + 50, `Expected 100 squad trophies, got ${updatedSquad?.trophies}`);
      console.log("  ✅ G1 PASSED: Squad quest completes cleanly, credits squad trophies, and GET reflects isCompletedBySquad=true.");
    }

    // ─── Scenario H: Malformed ObjectId Route Params ─────────────────────
    console.log("\n─── Scenario H: Malformed ObjectId Route Params ───");
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/not-a-valid-hex-id/complete`, {
        method: "POST",
      });
      const res = await POST(req, { params: Promise.resolve({ id: "not-a-valid-hex-id" }) });
      const json = await res.json();
      assert(res.status === 500, `Expected HTTP 500 for CastError, got ${res.status}`);
      assertStandardEnvelope(json, false, "POST CastError");
      assert(json.code === "SERVER_ERROR", `Expected SERVER_ERROR, got ${json.code}`);
      console.log("  ✅ H1 PASSED: Malformed ObjectId param in POST returns standard 500 SERVER_ERROR envelope.");
    }
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/not-a-valid-hex-id/complete`, {
        method: "GET",
      });
      const res = await GET(req, { params: Promise.resolve({ id: "not-a-valid-hex-id" }) });
      const json = await res.json();
      assert(res.status === 500, `Expected HTTP 500 for CastError, got ${res.status}`);
      assertStandardEnvelope(json, false, "GET CastError");
      assert(json.code === "SERVER_ERROR", `Expected SERVER_ERROR, got ${json.code}`);
      console.log("  ✅ H2 PASSED: Malformed ObjectId param in GET returns standard 500 SERVER_ERROR envelope.");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY (100%)");
    console.log("========================================================\n");
  } finally {
    console.log(`🧹 Cleaning up test database ${RUN_ID}...`);
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Ephemeral database dropped.");
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }
}

async function main() {
  await verifyImportsAcrossProject();
  await runAdversarialRouteTests();
}

main().catch((err) => {
  console.error("❌ CHALLENGER FAILED:", err);
  process.exit(1);
});

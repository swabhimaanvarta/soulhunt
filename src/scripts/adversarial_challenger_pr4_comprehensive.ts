import fs from "fs";
import path from "path";
import crypto from "crypto";
import React from "react";
import ReactDOMServer from "react-dom/server";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { User, Quest, Investigation, CampusLocation, Squad } from "../models";
import { GET, POST } from "../app/api/quests/[id]/complete/route";

const CHALLENGE_RUN_ID = `aiem_hunt_pr4_challenger_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${CHALLENGE_RUN_ID}`;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[CHALLENGER FAILURE]: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// GATE 1: Route Segment Exports Compliance Across ALL API Routes
// -----------------------------------------------------------------------------
async function auditAllApiRouteExports(): Promise<number> {
  console.log("\n========================================================");
  console.log("🛡️ GATE 1: APP ROUTER ROUTE EXPORT COMPLIANCE AUDIT");
  console.log("========================================================");

  const apiDir = path.resolve(__dirname, "../app/api");
  const ALLOWED_EXPORTS = new Set([
    // HTTP Methods
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
    // Next.js Route Segment Configs
    "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime",
    "preferredRegion", "maxDuration", "generateStaticParams"
  ]);

  let routeCount = 0;
  let auditedExports = 0;

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name === "route.ts") {
        routeCount++;
        const content = fs.readFileSync(fullPath, "utf-8");

        // Match export function / export async function / export const
        const exportRegex = /export\s+(?:async\s+)?(?:function|const|let|var)\s+([a-zA-Z0-9_$]+)/g;
        let match;
        while ((match = exportRegex.exec(content)) !== null) {
          const exportName = match[1];
          auditedExports++;
          assert(
            ALLOWED_EXPORTS.has(exportName),
            `FORBIDDEN NAMED EXPORT '${exportName}' in App Router route: ${fullPath}. Only HTTP methods and route segment configs are permitted.`
          );
        }

        // Check for export { ... } blocks
        const exportBlockRegex = /export\s+\{([^}]+)\}/g;
        while ((match = exportBlockRegex.exec(content)) !== null) {
          const block = match[1];
          const items = block.split(",").map(s => s.trim().split(/\s+as\s+/)[0].trim());
          for (const item of items) {
            if (item && !item.startsWith("type ")) {
              auditedExports++;
              assert(
                ALLOWED_EXPORTS.has(item),
                `FORBIDDEN NAMED EXPORT '${item}' in export block in: ${fullPath}`
              );
            }
          }
        }
      }
    }
  }

  scan(apiDir);
  console.log(`  ✅ Audited ${routeCount} App Router API route files (${auditedExports} named exports). ZERO illegal exports found!`);
  return routeCount;
}

// -----------------------------------------------------------------------------
// GATE 2: Quests Complete Route Adversarial Stress
// -----------------------------------------------------------------------------
async function runQuestsCompleteAdversarialStress(): Promise<void> {
  console.log("\n========================================================");
  console.log("🛡️ GATE 2: QUEST COMPLETE ROUTE ADVERSARIAL STRESS SUITE");
  console.log(`   Ephemeral DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);

  try {
    // Seed Location
    const loc = await CampusLocation.create({
      name: "Challenger Engineering Hub",
      code: "ENG-HUB",
      zoneType: "ACADEMIC_BLOCK",
      building: "Main Complex",
      coordinates: { lat: 15.3, lng: 73.8, mapX: 10, mapY: 20 },
    });

    // Seed Squad
    const testSquad = await Squad.create({
      name: "Challenger Brigade",
      tag: "CHAL",
      description: "Adversarial Stress Squad",
      emblemIcon: "Zap",
      leaderId: new Types.ObjectId(),
      squadXp: 1000,
      squadLevel: 2,
      trophies: 100,
      weeklyScore: 100,
      completedHuntsCount: 1,
      memberCap: 6,
    });

    // Seed Test Operative
    const hunter = await User.create({
      username: `hunter_${Date.now()}`,
      email: `hunter_${Date.now()}@aiemgoa.ac.in`,
      displayName: "Stress Hunter",
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 150,
      level: 1,
      coins: 80,
      trophies: 40,
      weeklyScore: 40,
      claimedLevelRewards: [],
    });

    // Seed Active Quest
    const activeQuest = await Quest.create({
      questCode: `Q-PR4-${Date.now()}`,
      title: "PR4 Adversarial Challenge Quest",
      description: "Stress test for route integrity.",
      questType: "CAMPUS_TREASURE",
      difficulty: 2,
      xpReward: 120,
      coinReward: 35,
      trophyReward: 25,
      squadXpReward: 0,
      targetLocationId: loc._id,
      status: "ACTIVE",
    });

    // Seed Draft Quest
    const draftQuest = await Quest.create({
      questCode: `Q-DFT-${Date.now()}`,
      title: "Draft Status Quest",
      description: "Should never complete.",
      questType: "CAMPUS_TREASURE",
      difficulty: 1,
      xpReward: 50,
      coinReward: 10,
      trophyReward: 10,
      squadXpReward: 0,
      targetLocationId: loc._id,
      status: "DRAFT",
    });

    // 1. Unauthenticated Attacks
    console.log("  ── Probing Unauthenticated Access ──");
    (globalThis as any).__TEST_CURRENT_USER__ = null;

    // POST without auth
    const unauthPost = await POST(
      new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, { method: "POST" }),
      { params: Promise.resolve({ id: activeQuest._id.toString() }) }
    );
    const unauthPostJson = await unauthPost.json();
    assert(unauthPost.status === 401, `Expected 401 for unauth POST, got ${unauthPost.status}`);
    assert(unauthPostJson.code === "UNAUTHORIZED", `Expected UNAUTHORIZED, got ${unauthPostJson.code}`);
    console.log("  ✅ Unauthenticated POST strictly returns 401 UNAUTHORIZED");

    // GET without auth on non-existent quest
    const fakeId = new Types.ObjectId().toString();
    const unauthGetMissing = await GET(
      new NextRequest(`http://localhost:3000/api/quests/${fakeId}/complete`, { method: "GET" }),
      { params: Promise.resolve({ id: fakeId }) }
    );
    const unauthGetMissingJson = await unauthGetMissing.json();
    assert(unauthGetMissing.status === 404, `Expected 404 for missing quest, got ${unauthGetMissing.status}`);
    assert(unauthGetMissingJson.code === "NOT_FOUND", `Expected NOT_FOUND, got ${unauthGetMissingJson.code}`);
    console.log("  ✅ Unauthenticated GET for missing quest strictly returns 404 NOT_FOUND");

    // 2. Malformed Route Params
    console.log("  ── Probing Malformed Route Parameters ──");
    const malformedIds = [
      "not-an-object-id",
      "../../../etc/passwd",
      "%00%00nullbyte",
      "507f1f77bcf86cd79943901z", // invalid hex char 'z'
      "12345",
      "'; DROP TABLE quests; --",
      "<script>alert(1)</script>",
    ];

    for (const badId of malformedIds) {
      // POST with malformed id
      const postRes = await POST(
        new NextRequest(`http://localhost:3000/api/quests/${encodeURIComponent(badId)}/complete`, { method: "POST" }),
        { params: Promise.resolve({ id: badId }) }
      );
      // Unauthenticated -> 401, Authenticated -> 500 (CastError)
      assert(
        postRes.status === 401 || postRes.status === 500,
        `Malformed ID '${badId}' expected 401 or 500, got ${postRes.status}`
      );

      // GET with malformed id
      const getRes = await GET(
        new NextRequest(`http://localhost:3000/api/quests/${encodeURIComponent(badId)}/complete`, { method: "GET" }),
        { params: Promise.resolve({ id: badId }) }
      );
      assert(
        getRes.status === 500,
        `GET malformed ID '${badId}' expected 500 (CastError), got ${getRes.status}`
      );
    }
    console.log(`  ✅ Probed ${malformedIds.length} malformed params: All handled gracefully without unhandled crashes.`);

    // 3. Authenticated Inactive & Non-Existent Quest Probes
    console.log("  ── Probing Authenticated Non-Existent & Inactive Quests ──");
    (globalThis as any).__TEST_CURRENT_USER__ = hunter;

    // Non-existent quest ID
    const notFoundPost = await POST(
      new NextRequest(`http://localhost:3000/api/quests/${fakeId}/complete`, { method: "POST" }),
      { params: Promise.resolve({ id: fakeId }) }
    );
    const notFoundPostJson = await notFoundPost.json();
    assert(notFoundPost.status === 404, `Expected 404 for not found quest, got ${notFoundPost.status}`);
    assert(notFoundPostJson.code === "QUEST_NOT_FOUND", `Expected QUEST_NOT_FOUND, got ${notFoundPostJson.code}`);
    console.log("  ✅ Authenticated POST to non-existent quest returns 404 QUEST_NOT_FOUND");

    // Inactive (DRAFT) quest
    const draftPost = await POST(
      new NextRequest(`http://localhost:3000/api/quests/${draftQuest._id}/complete`, { method: "POST" }),
      { params: Promise.resolve({ id: draftQuest._id.toString() }) }
    );
    const draftPostJson = await draftPost.json();
    assert(draftPost.status === 404, `Expected 404 for draft quest, got ${draftPost.status}`);
    assert(draftPostJson.code === "QUEST_NOT_FOUND", `Expected QUEST_NOT_FOUND, got ${draftPostJson.code}`);
    console.log("  ✅ Authenticated POST to DRAFT quest returns 404 QUEST_NOT_FOUND");

    // 4. Quest Not Accepted Guard
    console.log("  ── Probing Unaccepted Quest Guard ──");
    const unacceptedPost = await POST(
      new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, { method: "POST" }),
      { params: Promise.resolve({ id: activeQuest._id.toString() }) }
    );
    const unacceptedJson = await unacceptedPost.json();
    assert(unacceptedPost.status === 400, `Expected 400 for unaccepted quest, got ${unacceptedPost.status}`);
    assert(unacceptedJson.code === "NOT_ACCEPTED", `Expected NOT_ACCEPTED, got ${unacceptedJson.code}`);
    console.log("  ✅ Authenticated POST without active investigation returns 400 NOT_ACCEPTED");

    // 5. Normal Quest Completion & Ledger Audit
    console.log("  ── Probing Normal Quest Completion & Balance Delta ──");
    const investigation = await Investigation.create({
      questId: activeQuest._id,
      userId: hunter._id,
      currentStage: 1,
      progressPct: 75,
      status: "IN_PROGRESS",
      participatingUserIds: [hunter._id],
    });

    const initialCoins = hunter.coins;
    const initialTrophies = hunter.trophies || 0;

    const validComplete = await POST(
      new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Completed successfully" }),
      }),
      { params: Promise.resolve({ id: activeQuest._id.toString() }) }
    );
    const validCompleteJson = await validComplete.json();
    assert(validComplete.status === 200, `Expected 200 for valid complete, got ${validComplete.status}`);
    assert(validCompleteJson.success === true, "Expected success: true");
    assert(validCompleteJson.data.status === "COMPLETED", "Expected data.status: COMPLETED");

    // Check user state in DB
    const refreshedHunter = await User.findById(hunter._id);
    assert(!!refreshedHunter, "Hunter must exist in DB");
    assert(
      refreshedHunter.trophies === initialTrophies + 25,
      `Expected trophies to increase by 25, got ${refreshedHunter.trophies}`
    );
    console.log(`  ✅ Quest completed cleanly. Trophies updated: ${initialTrophies} -> ${refreshedHunter.trophies}`);

    // 6. Double-Completion Idempotency Attack
    console.log("  ── Probing Double-Completion Replay Attack ──");
    const replayPost = await POST(
      new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}/complete`, { method: "POST" }),
      { params: Promise.resolve({ id: activeQuest._id.toString() }) }
    );
    const replayJson = await replayPost.json();
    assert(replayPost.status === 400, `Expected 400 for replay completion, got ${replayPost.status}`);
    assert(replayJson.code === "ALREADY_COMPLETED", `Expected ALREADY_COMPLETED, got ${replayJson.code}`);
    console.log("  ✅ Immediate replay POST returns 400 ALREADY_COMPLETED");

    // 7. High-Concurrency Blast Attack (10 simultaneous completion requests)
    console.log("  ── Probing High-Concurrency Blast (10 Simultaneous POSTs) ──");
    const blastQuest = await Quest.create({
      questCode: `Q-BLAST-${Date.now()}`,
      title: "Concurrency Blast Quest",
      description: "Testing race condition mitigation.",
      questType: "CAMPUS_TREASURE",
      difficulty: 1,
      xpReward: 60,
      coinReward: 20,
      trophyReward: 15,
      squadXpReward: 0,
      targetLocationId: loc._id,
      status: "ACTIVE",
    });

    await Investigation.create({
      questId: blastQuest._id,
      userId: hunter._id,
      currentStage: 1,
      progressPct: 80,
      status: "IN_PROGRESS",
      participatingUserIds: [hunter._id],
    });

    const coinsBeforeBlast = (await User.findById(hunter._id))!.coins;
    const trophiesBeforeBlast = (await User.findById(hunter._id))!.trophies || 0;

    const blastPromises = Array.from({ length: 10 }, () => {
      const req = new NextRequest(`http://localhost:3000/api/quests/${blastQuest._id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return POST(req, { params: Promise.resolve({ id: blastQuest._id.toString() }) });
    });

    const blastResults = await Promise.all(blastPromises);
    const blastJsons = await Promise.all(blastResults.map(r => r.json()));

    const successCount = blastJsons.filter(j => j.success === true).length;
    const alreadyCompletedCount = blastJsons.filter(j => j.code === "ALREADY_COMPLETED").length;

    assert(
      successCount === 1,
      `CRITICAL CONCURRENCY BUG: Expected exactly 1 success out of 10 concurrent requests, got ${successCount}`
    );
    assert(
      alreadyCompletedCount === 9,
      `Expected 9 ALREADY_COMPLETED rejections, got ${alreadyCompletedCount}`
    );

    const coinsAfterBlast = (await User.findById(hunter._id))!.coins;
    const trophiesAfterBlast = (await User.findById(hunter._id))!.trophies || 0;

    assert(
      trophiesAfterBlast === trophiesBeforeBlast + 15,
      `CRITICAL OVERPAYMENT BUG: Expected +15 trophies, got +${trophiesAfterBlast - trophiesBeforeBlast}`
    );
    console.log(`  ✅ Concurrency Blast: Exactly 1 success, 9 ALREADY_COMPLETED, rewards paid exactly once.`);

  } finally {
    console.log(`🧹 Dropping ephemeral DB: ${CHALLENGE_RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral DB cleanly dropped.");
  }
}

// -----------------------------------------------------------------------------
// GATE 3: Redirects and Security Headers Evaluation
// -----------------------------------------------------------------------------
async function runRedirectsAndHeadersChallenge(): Promise<void> {
  console.log("\n========================================================");
  console.log("🛡️ GATE 3: REDIRECTS AND SECURITY HEADERS CHALLENGE");
  console.log("========================================================");

  const nextConfigModule = await import("../../next.config.mjs");
  const nextConfig = nextConfigModule.default;

  // 1. Redirects
  assert(typeof nextConfig.redirects === "function", "nextConfig.redirects must be a function");
  const redirects = await nextConfig.redirects();

  const requiredRedirects = [
    { source: "/signup", destination: "/register" },
    { source: "/signin", destination: "/login" },
    { source: "/inventory", destination: "/profile?tab=locker" },
    { source: "/items/lost", destination: "/lost-and-found/report-lost" },
    { source: "/items/found", destination: "/lost-and-found/report-found" },
    { source: "/staff/intake", destination: "/staff" },
    { source: "/admin/operations", destination: "/admin" },
  ];

  for (const req of requiredRedirects) {
    const entry = redirects.find((r: any) => r.source === req.source);
    assert(!!entry, `Missing redirect for '${req.source}'`);
    assert(
      entry.destination === req.destination,
      `Redirect '${req.source}' points to '${entry.destination}', expected '${req.destination}'`
    );
    assert(
      entry.permanent === false,
      `Redirect '${req.source}' must be temporary (permanent: false), got ${entry.permanent}`
    );
    console.log(`  ✅ Redirect ${req.source} -> ${req.destination} (permanent: false) verified.`);
  }

  // 2. Security Headers
  assert(typeof nextConfig.headers === "function", "nextConfig.headers must be a function");
  const headers = await nextConfig.headers();
  const globalHeader = headers.find((h: any) => h.source === "/:path*");
  assert(!!globalHeader, "Missing global header rule for /:path*");

  const headerMap = new Map(globalHeader.headers.map((h: any) => [h.key, h.value]));
  assert(headerMap.get("X-Frame-Options") === "DENY", "X-Frame-Options must be DENY");
  assert(headerMap.get("X-Content-Type-Options") === "nosniff", "X-Content-Type-Options must be nosniff");
  assert(headerMap.get("Referrer-Policy") === "strict-origin-when-cross-origin", "Referrer-Policy must be strict-origin-when-cross-origin");
  assert(typeof headerMap.get("Strict-Transport-Security") === "string", "HSTS must be configured");

  console.log("  ✅ Global security headers verified (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS).");
}

// -----------------------------------------------------------------------------
// GATE 4: Error Boundaries Adversarial Injection Stress
// -----------------------------------------------------------------------------
async function runErrorBoundariesStress(): Promise<void> {
  console.log("\n========================================================");
  console.log("🛡️ GATE 4: ERROR BOUNDARIES ADVERSARIAL SSR STRESS");
  console.log("========================================================");

  // 1. Item Detail Error Boundary
  const itemErrorMod = await import("../app/items/[id]/error");
  const ItemDetailError = itemErrorMod.default;

  // SSR with XSS payload in digest
  const xssDigestError: Error & { digest?: string } = new Error("XSS Probe");
  xssDigestError.digest = "<script>alert('XSS_PAYLOAD')</script>";
  const htmlXss = ReactDOMServer.renderToString(
    React.createElement(ItemDetailError, { error: xssDigestError, reset: () => {} })
  );
  assert(!htmlXss.includes("<script>alert("), "CRITICAL XSS VULNERABILITY: Raw script tag injected into DOM!");
  assert(htmlXss.includes("&lt;script&gt;alert("), "React properly encoded XSS digest string");
  console.log("  ✅ ItemDetailError safely encodes malicious XSS digest string in SSR.");

  // SSR with empty error message
  const emptyError = new Error("");
  const htmlEmpty = ReactDOMServer.renderToString(
    React.createElement(ItemDetailError, { error: emptyError, reset: () => {} })
  );
  assert(
    htmlEmpty.includes("The requested belonging record could not be retrieved"),
    "ItemDetailError must display fallback message when error.message is empty"
  );
  console.log("  ✅ ItemDetailError displays fallback message when error.message is empty.");

  // 2. Staff Station Error Boundary
  const staffErrorMod = await import("../app/staff/error");
  const StaffStationError = staffErrorMod.default;

  const staffEmptyError: Error & { digest?: string } = new Error("");
  staffEmptyError.digest = "<b>StationDigestBold</b>";
  const htmlStaff = ReactDOMServer.renderToString(
    React.createElement(StaffStationError, { error: staffEmptyError, reset: () => {} })
  );
  assert(!htmlStaff.includes("<b>StationDigestBold</b>"), "StaffStationError must not render raw HTML in digest");
  assert(htmlStaff.includes("&lt;b&gt;StationDigestBold&lt;/b&gt;"), "StaffStationError properly escapes digest");
  assert(
    htmlStaff.includes("Failed to initialize custody queue"),
    "StaffStationError displays default fallback message"
  );
  assert(htmlStaff.includes("/dashboard"), "StaffStationError provides return to /dashboard link");
  console.log("  ✅ StaffStationError safely encodes digest and provides fallback & navigation.");

  // 3. Loading Skeleton
  const loadingMod = await import("../app/items/[id]/loading");
  const ItemDetailLoading = loadingMod.default;
  const htmlLoading = ReactDOMServer.renderToString(React.createElement(ItemDetailLoading));
  assert(htmlLoading.includes("animate-pulse"), "Loading skeleton has animate-pulse");
  assert(htmlLoading.includes("glass-panel"), "Loading skeleton has glass-panel");
  console.log("  ✅ ItemDetailLoading renders proper animate-pulse skeleton container.");
}

async function main() {
  console.log("================================================================================");
  console.log("🛡️ EMPIRICAL CHALLENGER PR-4: COMPREHENSIVE ROUTE, REDIRECT & ERROR HARNESS");
  console.log("================================================================================");

  const routeCount = await auditAllApiRouteExports();
  await runQuestsCompleteAdversarialStress();
  await runRedirectsAndHeadersChallenge();
  await runErrorBoundariesStress();

  console.log("\n================================================================================");
  console.log("🎉 ALL EMPIRICAL CHALLENGES PASSED! ZERO DEFECTS FOUND ACROSS ALL 4 GATES.");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("❌ CHALLENGER INTEGRITY FAILURE:", err);
  process.exit(1);
});

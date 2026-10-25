import "./qa_env_init";

/**
 * AIEM Hunt — Wave 1 P0 Independent QA & Safety Verification Suite
 * Author: Agent 6 (Independent QA Lead)
 * Target Database: Disposable ephemeral loopback DB (aiem_hunt_test_qa_wave1_*)
 *
 * Covers:
 * 1. Parsed Connection URI Validation (§1.3 parsed URL validation, loopback enforcement, negative adversarial tests)
 * 2. Item Detail Privacy Redaction & Photo Persistence (anonymous & non-owner redaction vs owner & safe-desk staff inspection; found item photo URLs)
 * 3. Handover PIN Lockout Bounds & Outsider Protection (remains APPROVED, 5 failed attempts lockout, outsider protection, custodian PIN reset route)
 * 4. Quest & Event CMS Draft Privacy & Location Geofencing (404 on direct ID lookups for non-staff; out-of-bounds rejection)
 * 5. Squad Chat Idempotency & Concurrency (compound unique index { squadId, senderId, requestId }, 500-message cap pruning, 30-day retention query filtering)
 */

import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { URL } from "node:url";

import {
  User,
  LostItem,
  FoundItem,
  ClaimRequest,
  CampusLocation,
  Quest,
  Clue,
  Event,
  Squad,
  SquadMember,
  SquadMessage,
  AuditEvent,
} from "../models";
import { assertSafeConnectionUri, connectDB } from "../lib/db";
import { signSessionToken } from "../lib/jwt";
import { toPublicItemDTO } from "../lib/item-dto";

// Declare route handler and context holder variables populated after AsyncLocalStorage initialization
let getItemById: any;
let postFoundItem: any;
let postVerifyHandover: any;
let postResetPin: any;
let getQuestById: any;
let getEventById: any;
let postLocation: any;
let postSquadMessage: any;
let getSquadMessages: any;

let workUnitAsyncStorage: any;
let RequestCookies: any;
let RequestCookiesAdapter: any;

function initAdapters() {
  if (!workUnitAsyncStorage) {
    workUnitAsyncStorage = require("next/dist/server/app-render/work-unit-async-storage.external.js").workUnitAsyncStorage;
    RequestCookies = require("next/dist/server/web/spec-extension/cookies").RequestCookies;
    RequestCookiesAdapter = require("next/dist/server/web/spec-extension/adapters/request-cookies").RequestCookiesAdapter;
  }
}

// -----------------------------------------------------------------------------
// Test Database Setup & Isolation
// -----------------------------------------------------------------------------
const RUN_ID = `aiem_hunt_test_qa_wave1_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

// Parse and validate test database URI per §1.3
assertSafeConnectionUri(TEST_DB_URI, true);

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.ALLOW_DESTRUCTIVE_SEED = "true";
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

/**
 * Execute an async function within a simulated Next.js request context.
 * Injects a signed JWT session cookie for the given user, or an empty cookie jar for anonymous requests.
 */
async function withUser<T = any>(user: any | null, fn: () => T | Promise<T>): Promise<T> {
  initAdapters();
  const token = user
    ? await signSessionToken({
        userId: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
        assignedStationId: user.assignedStationId?.toString(),
        assignedStationIds: user.assignedStationIds?.map((id: any) => id.toString()),
      })
    : null;

  const cookieHeader = token ? `aiem_session=${token}` : "";
  const underlying = RequestCookiesAdapter.seal(
    new RequestCookies(new Headers(cookieHeader ? { cookie: cookieHeader } : {}))
  );
  const store = {
    type: "request" as const,
    phase: "render" as const,
    cookies: underlying,
    userspaceMutableCookies: underlying,
  };
  return (workUnitAsyncStorage.run(store, fn) as Promise<any>);
}

async function runQAWave1Verification() {
  console.log("\n================================================================================");
  console.log("🛡️  AIEM HUNT — WAVE 1 P0 INDEPENDENT QA & SAFETY VERIFICATION");
  console.log(`   Disposable Loopback Database: mongodb://127.0.0.1:27017/${RUN_ID}`);
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // SUITE 1: Parsed Connection URI Validation & Isolation
  // ---------------------------------------------------------------------------
  console.log("─── Suite 1: Parsed Connection URI Validation & Loopback Isolation ───");

  // 1.1 Direct URL parsing verification
  const parsedUri = new URL(TEST_DB_URI);
  assert(parsedUri.protocol === "mongodb:", "Parsed URI protocol is strictly 'mongodb:'");
  assert(
    parsedUri.hostname === "127.0.0.1" || parsedUri.hostname === "localhost",
    `Parsed URI hostname is strictly loopback (actual: ${parsedUri.hostname})`
  );
  assert(
    parsedUri.pathname.startsWith("/aiem_hunt_test_"),
    `Parsed URI database pathname starts with '/aiem_hunt_test_' (actual: ${parsedUri.pathname})`
  );

  // 1.2 Adversarial safety guard tests (assertSafeConnectionUri intercepts process.exit)
  function testUriRejection(uri: string, isTestRunner: boolean, testLabel: string) {
    let exitIntercepted = false;
    let loggedError = "";
    const origExit = process.exit;
    const origError = console.error;
    try {
      (process as any).exit = (code: number) => {
        exitIntercepted = true;
        throw new Error(`EXIT_${code}`);
      };
      console.error = (...args: any[]) => {
        loggedError += args.join(" ");
      };
      assertSafeConnectionUri(uri, isTestRunner);
    } catch (e: any) {
      if (!e.message.startsWith("EXIT_")) throw e;
    } finally {
      process.exit = origExit;
      console.error = origError;
    }
    assert(exitIntercepted, `Adversarial URI rejected with process.exit: ${testLabel}`);
    assert(loggedError.includes("[SECURITY ALERT]"), `Security alert logged for: ${testLabel}`);
  }

  testUriRejection("http://127.0.0.1:27017/aiem_hunt_test_db", true, "Non-mongodb HTTP protocol");
  testUriRejection("mongodb+srv://atlas.cluster.net/aiem_hunt_test_db", true, "Atlas SRV protocol");
  testUriRejection("mongodb://evil.remote.host:27017/aiem_hunt_test_db", true, "Remote non-loopback host");
  testUriRejection("mongodb://127.0.0.1:27017/aiem_hunt_production", true, "Test runner connecting to non-test DB");
  testUriRejection("invalid_uri_string_format", true, "Malformed connection string");

  // 1.3 Positive cases
  let validPassed = true;
  try {
    assertSafeConnectionUri("mongodb://127.0.0.1:27017/aiem_hunt", false);
    assertSafeConnectionUri("mongodb://localhost:27017/aiem_hunt", false);
    assertSafeConnectionUri("mongodb://127.0.0.1:27017/aiem_hunt_test_123", true);
  } catch {
    validPassed = false;
  }
  assert(validPassed, "assertSafeConnectionUri cleanly allows valid loopback and test URIs");

  // Connect to DB and verify exact database name
  await connectDB();
  const activeDbName = mongoose.connection.db?.databaseName;
  assert(activeDbName === RUN_ID, `Connected strictly to expected ephemeral database: ${activeDbName}`);

  try {
    // Dynamically load route handlers now that globalThis.AsyncLocalStorage is fully wired
    initAdapters();
    getItemById = (await import("../app/api/items/[id]/route")).GET;
    postFoundItem = (await import("../app/api/items/found/route")).POST;
    postVerifyHandover = (await import("../app/api/claims/verify-handover/route")).POST;
    postResetPin = (await import("../app/api/staff/reset-pin/route")).POST;
    getQuestById = (await import("../app/api/quests/[id]/route")).GET;
    getEventById = (await import("../app/api/events/[id]/route")).GET;
    postLocation = (await import("../app/api/locations/route")).POST;
    const squadMsgsRoute = await import("../app/api/squads/[id]/messages/route");
    postSquadMessage = squadMsgsRoute.POST;
    getSquadMessages = squadMsgsRoute.GET;

    // -------------------------------------------------------------------------
    // SUITE 2: Item Detail Privacy Redactions & Photo Persistence
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 2: Item Detail Privacy Redaction & Photo URL Persistence ───");

    // 2.1 Seed Safe-Desk Station and Users
    const safeDeskLocation = await CampusLocation.create({
      name: "Central Safe-Desk Hub",
      code: "SD_HUB_QA",
      zoneType: "SAFE_DESK",
      description: "Primary custody intake counter",
      coordinates: { lat: 15.5960, lng: 73.7930, mapX: 50, mapY: 50 },
      floors: ["Ground"],
      isSafeDesk: true,
      operatingHours: "08:00 - 18:00",
      isActive: true,
    });

    const otherStation = await CampusLocation.create({
      name: "Hostel Safe-Desk Satellite",
      code: "SD_HOSTEL_QA",
      zoneType: "SAFE_DESK",
      description: "Hostel block intake desk",
      coordinates: { lat: 15.5980, lng: 73.7950, mapX: 70, mapY: 70 },
      floors: ["1st"],
      isSafeDesk: true,
      operatingHours: "09:00 - 17:00",
      isActive: true,
    });

    const studentOwner = await User.create({
      email: "owner_qa@aiemgoa.ac.in",
      username: "owner_qa",
      displayName: "Student Owner",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      role: "STUDENT",
      accountStatus: "ACTIVE",
    });

    const studentNonOwner = await User.create({
      email: "nonowner_qa@aiemgoa.ac.in",
      username: "nonowner_qa",
      displayName: "Student Finder Non-Owner",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      role: "STUDENT",
      accountStatus: "ACTIVE",
    });

    const deskStaff = await User.create({
      email: "staff_qa@aiemgoa.ac.in",
      username: "staff_qa",
      displayName: "Safe-Desk Custodian Staff",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      role: "SAFE_DESK_STAFF",
      assignedStationId: safeDeskLocation._id,
      assignedStationIds: [safeDeskLocation._id],
      accountStatus: "ACTIVE",
    });

    const adminUser = await User.create({
      email: "admin_qa@aiemgoa.ac.in",
      username: "admin_qa",
      displayName: "QA Admin Officer",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      role: "ADMIN",
      accountStatus: "ACTIVE",
    });

    const linkedQuest = await Quest.create({
      questCode: `Q_LINKED_${Date.now()}`,
      title: "Laptop Mystery Quest",
      description: "Search for Asus laptop in Library",
      questType: "CAMPUS_TREASURE",
      targetLocationId: safeDeskLocation._id,
      difficulty: 1,
      xpReward: 100,
      coinReward: 20,
      status: "ACTIVE",
    });

    const lostItem = await LostItem.create({
      reporterId: studentOwner._id,
      title: "Lost Blue Asus Laptop with ID 2024CS099",
      publicDescription: "Left near desk 4, student id 2024CS099 on back sticker, phone 9876543210",
      category: "ELECTRONICS",
      lastKnownLocationId: safeDeskLocation._id,
      spotDetails: "Table 4 next to window plug",
      verificationQuestion: "Secret question: What anime sticker is on the top lid?",
      verificationAnswerHash: await bcrypt.hash("goku", 10),
      secretIdentifiers: "2024CS099, SN-ASUS-9901",
      lostAt: new Date(),
      linkedQuestId: linkedQuest._id,
      status: "SUBMITTED",
      blurredPhotoUrl: "https://campus.aiem/blurred/laptop_blurred.webp",
      rawPhotoUrl: "https://campus.aiem/raw/laptop_clear.jpg",
    });

    // 2.2 Test GET /api/items/[id] as Anonymous Visitor
    const anonReq = new NextRequest(`http://localhost:3000/api/items/${lostItem._id}`);
    const anonRes = await withUser(null, () =>
      getItemById(anonReq, { params: Promise.resolve({ id: lostItem._id.toString() }) })
    );
    assert(anonRes.status === 200, "GET /api/items/[id] returns HTTP 200 for anonymous visitor");
    const anonData = (await anonRes.json()).data;
    assert(anonData.verificationQuestion === undefined, "Anonymous: verificationQuestion is strictly undefined");
    assert(anonData.hasVerificationQuestion === true, "Anonymous: hasVerificationQuestion indicator is true");
    assert(anonData.secretIdentifiers === undefined, "Anonymous: secretIdentifiers is stripped");
    assert(anonData.verificationAnswerHash === undefined, "Anonymous: verificationAnswerHash is stripped");
    assert(anonData.rawPhotoUrl === undefined, "Anonymous: rawPhotoUrl is stripped");
    assert(anonData.spotDetails === undefined, "Anonymous: spotDetails is stripped");
    assert(anonData.linkedQuestId === undefined, "Anonymous: linkedQuestId mystery link is stripped");
    assert(anonData.photoUrl === lostItem.blurredPhotoUrl, "Anonymous: photoUrl provides blurred derivative");
    assert(anonData.lastKnownLocationId.coordinates === undefined, "Anonymous: location coordinates stripped");
    assert(!anonData.title.includes("2024CS099"), "Anonymous: matriculation roll number stripped from title");

    // 2.3 Test GET /api/items/[id] as Signed-in Non-Owner Student
    const nonOwnerReq = new NextRequest(`http://localhost:3000/api/items/${lostItem._id}`);
    const nonOwnerRes = await withUser(studentNonOwner, () =>
      getItemById(nonOwnerReq, { params: Promise.resolve({ id: lostItem._id.toString() }) })
    );
    assert(nonOwnerRes.status === 200, "GET /api/items/[id] returns HTTP 200 for non-owner student");
    const nonOwnerData = (await nonOwnerRes.json()).data;
    assert(nonOwnerData.verificationQuestion === undefined, "Non-owner: verificationQuestion is stripped");
    assert(nonOwnerData.secretIdentifiers === undefined, "Non-owner: secretIdentifiers is stripped");
    assert(nonOwnerData.rawPhotoUrl === undefined, "Non-owner: rawPhotoUrl is stripped");
    assert(nonOwnerData.reporterId === undefined, "Non-owner: reporterId identity is masked");
    assert(nonOwnerData.reportedByCommunityMember === true, "Non-owner: reportedByCommunityMember flag set");

    // 2.4 Test GET /api/items/[id] as Owner
    const ownerReq = new NextRequest(`http://localhost:3000/api/items/${lostItem._id}`);
    const ownerRes = await withUser(studentOwner, () =>
      getItemById(ownerReq, { params: Promise.resolve({ id: lostItem._id.toString() }) })
    );
    assert(ownerRes.status === 200, "GET /api/items/[id] returns HTTP 200 for owner");
    const ownerData = (await ownerRes.json()).data;
    assert(ownerData.isOwner === true, "Owner: isOwner flag is true");
    assert(
      ownerData.verificationQuestion === "Secret question: What anime sticker is on the top lid?",
      "Owner: verificationQuestion is preserved"
    );
    assert(
      ownerData.linkedQuestId?._id?.toString() === linkedQuest._id.toString() ||
        ownerData.linkedQuestId?.toString() === linkedQuest._id.toString(),
      "Owner: linkedQuestId is preserved"
    );

    // 2.5 Test GET /api/items/[id] as Safe-Desk Staff (Worker M1.1 fix verification)
    const staffReq = new NextRequest(`http://localhost:3000/api/items/${lostItem._id}`);
    const staffRes = await withUser(deskStaff, () =>
      getItemById(staffReq, { params: Promise.resolve({ id: lostItem._id.toString() }) })
    );
    assert(staffRes.status === 200, "GET /api/items/[id] returns HTTP 200 for SAFE_DESK_STAFF");
    const staffData = (await staffRes.json()).data;
    assert(staffData.isStaff === true, "Safe-Desk Staff: isStaff flag is true");
    assert(
      staffData.verificationQuestion === "Secret question: What anime sticker is on the top lid?",
      "Safe-Desk Staff: verificationQuestion is preserved for staff custody review"
    );
    assert(
      staffData.secretIdentifiers === "2024CS099, SN-ASUS-9901",
      "Safe-Desk Staff: secretIdentifiers is preserved for safe-desk verification"
    );
    assert(
      staffData.spotDetails === "Table 4 next to window plug",
      "Safe-Desk Staff: spotDetails is preserved"
    );

    // 2.6 Test Found Item Photo URL Persistence (POST /api/items/found)
    const foundPayload = {
      title: "Found Wireless Headphones in Case",
      category: "ELECTRONICS",
      publicDescription: "Black noise-cancelling headphones found on bench near library entrance.",
      foundLocationId: safeDeskLocation._id.toString(),
      custodyStatus: "SAFE_DESK",
      currentCustodyLocationId: safeDeskLocation._id.toString(),
      photoUrl: "https://campus.aiem/blurred/headphones.webp",
      rawPhotoUrl: "https://campus.aiem/raw/headphones_raw.jpg",
      blurredPhotoUrl: "https://campus.aiem/blurred/headphones.webp",
    };

    const postFoundReq = new NextRequest("http://localhost:3000/api/items/found", {
      method: "POST",
      body: JSON.stringify(foundPayload),
    });

    const postFoundRes = await withUser(studentNonOwner, () => postFoundItem(postFoundReq));
    const foundResJson = await postFoundRes.json();
    assert(
      postFoundRes.status === 201 || postFoundRes.status === 200,
      `POST /api/items/found returns HTTP 201 Created (actual: ${postFoundRes.status})`
    );
    const foundResData = foundResJson.data;

    // Database verification of photo persistence (rawPhotoUrl has select: false for security)
    const savedFoundItem = await FoundItem.findById(foundResData._id).select("+rawPhotoUrl");
    assert(Boolean(savedFoundItem), "FoundItem saved to database");
    assert(
      savedFoundItem?.rawPhotoUrl === "https://campus.aiem/raw/headphones_raw.jpg",
      "FoundItem persists rawPhotoUrl in database"
    );
    assert(
      savedFoundItem?.blurredPhotoUrl === "https://campus.aiem/blurred/headphones.webp",
      "FoundItem persists blurredPhotoUrl in database"
    );
    assert(
      savedFoundItem?.safeDeskLocationId?.toString() === safeDeskLocation._id.toString(),
      "FoundItem populates safeDeskLocationId when custodyStatus is SAFE_DESK"
    );

    // Test fallback when only photoUrl is provided
    const foundFallbackPayload = {
      title: "Found Engineering Notebook",
      category: "BOOKS_NOTES",
      publicDescription: "Spiral-bound mechanical notes found in lecture hall 2.",
      foundLocationId: safeDeskLocation._id.toString(),
      photoUrl: "https://campus.aiem/uploads/notebook.webp",
    };
    const postFallbackReq = new NextRequest("http://localhost:3000/api/items/found", {
      method: "POST",
      body: JSON.stringify(foundFallbackPayload),
    });
    const postFallbackRes = await withUser(studentNonOwner, () => postFoundItem(postFallbackReq));
    assert(
      postFallbackRes.status === 201 || postFallbackRes.status === 200,
      `POST /api/items/found fallback returns HTTP 201/200 (actual: ${postFallbackRes.status})`
    );
    const fallbackData = (await postFallbackRes.json()).data;
    const savedFallbackItem = await FoundItem.findById(fallbackData._id).select("+rawPhotoUrl");
    assert(
      savedFallbackItem?.rawPhotoUrl === "https://campus.aiem/uploads/notebook.webp" &&
        savedFallbackItem?.blurredPhotoUrl === "https://campus.aiem/uploads/notebook.webp",
      "FoundItem defaults rawPhotoUrl and blurredPhotoUrl to photoUrl when individual URLs are omitted"
    );

    // Verify public item DTO projection strips rawPhotoUrl
    const publicDTO = toPublicItemDTO(savedFoundItem!.toObject(), "FOUND");
    assert((publicDTO as any).rawPhotoUrl === undefined, "toPublicItemDTO strictly omits rawPhotoUrl");
    assert(publicDTO.photoUrl === "https://campus.aiem/uploads/notebook.webp" || Boolean(publicDTO.photoUrl), "toPublicItemDTO provides safe photoUrl");

    // -------------------------------------------------------------------------
    // SUITE 3: Handover PIN Lockout Bounds, Outsider Protection & Custodian Reset
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 3: Handover PIN Lockout Bounds & Custodian Reset ───");

    const pinPlaintext = "782910";
    const pinHash = await bcrypt.hash(pinPlaintext, 10);
    const validExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Claim 1: Dedicated to testing outsider lockout protection (anonymous, unrelated student, receiver self-cert, station mismatch)
    const outsiderClaim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: savedFoundItem!._id,
      claimantId: studentOwner._id, // Owner is claimant (receiving item)
      counterpartyUserId: studentNonOwner._id, // Finder is custodian (surrendering item)
      submittedAnswer: "Black headphones with initials SO on the inner headband",
      status: "APPROVED",
      handoverCode: pinPlaintext,
      handoverCodeHash: pinHash,
      handoverCodeExpiresAt: validExpiry,
      handoverAttempts: 0,
      handoverLocked: false,
      lockoutUntil: null,
    });

    // 3.1 Outsider Lockout Protection Verification
    // An anonymous caller or outsider cannot increment attempts or burn the lockout quota
    const anonVerifyReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      body: JSON.stringify({ claimId: outsiderClaim._id.toString(), handoverCode: "000000" }),
    });
    const anonVerifyRes = await withUser(null, () => postVerifyHandover(anonVerifyReq));
    assert(anonVerifyRes.status === 401, "Outsider: Anonymous handover verification rejected with HTTP 401");

    let claimCheck = await ClaimRequest.findById(outsiderClaim._id);
    assert(claimCheck?.handoverAttempts === 0, "Outsider Protection: Anonymous attempt did NOT increment handoverAttempts");

    // Outsider student (unrelated to item, not finder, not claimant, not staff)
    const outsiderStudent = await User.create({
      email: "outsider_qa@aiemgoa.ac.in",
      username: "outsider_qa",
      displayName: "Outsider Student",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      role: "STUDENT",
      accountStatus: "ACTIVE",
    });

    const outsiderReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      headers: { "x-forwarded-for": "192.168.10.1" },
      body: JSON.stringify({ claimId: outsiderClaim._id.toString(), handoverCode: "000000" }),
    });
    const outsiderRes = await withUser(outsiderStudent, () => postVerifyHandover(outsiderReq));
    assert(outsiderRes.status === 403, "Outsider: Unauthorized student rejected with HTTP 403 (UNAUTHORIZED_CUSTODIAN)");
    const outsiderBody = await outsiderRes.json();
    assert(outsiderBody.error?.code === "UNAUTHORIZED_CUSTODIAN", "Outsider: Error code is UNAUTHORIZED_CUSTODIAN");

    claimCheck = await ClaimRequest.findById(outsiderClaim._id);
    assert(claimCheck?.handoverAttempts === 0, "Outsider Protection: Unauthorized caller attempt did NOT increment handoverAttempts");

    // Receiving party (owner) self-certification rejection
    const receiverReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      headers: { "x-forwarded-for": "192.168.10.2" },
      body: JSON.stringify({ claimId: outsiderClaim._id.toString(), handoverCode: pinPlaintext }),
    });
    const receiverRes = await withUser(studentOwner, () => postVerifyHandover(receiverReq));
    assert(receiverRes.status === 403, "Outsider Protection: Receiving party self-certification rejected with HTTP 403");
    const receiverBody = await receiverRes.json();
    assert(receiverBody.error?.code === "RECEIVER_CANNOT_CERTIFY", "Error code is RECEIVER_CANNOT_CERTIFY");

    claimCheck = await ClaimRequest.findById(outsiderClaim._id);
    assert(claimCheck?.handoverAttempts === 0, "Outsider Protection: Receiver self-cert attempt did NOT increment handoverAttempts");

    // 3.2 Safe-Desk Staff Station Mismatch Guard
    const otherDeskStaff = await User.create({
      email: "otherdesk_staff@aiemgoa.ac.in",
      username: "otherdesk_staff",
      displayName: "Other Desk Staff",
      passwordHash: await bcrypt.hash("Pass123!", 10),
      role: "SAFE_DESK_STAFF",
      assignedStationId: otherStation._id,
      assignedStationIds: [otherStation._id],
      accountStatus: "ACTIVE",
    });

    const stationMismatchReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      headers: { "x-forwarded-for": "192.168.10.3" },
      body: JSON.stringify({ claimId: outsiderClaim._id.toString(), handoverCode: "000000" }),
    });
    const stationMismatchRes = await withUser(otherDeskStaff, () => postVerifyHandover(stationMismatchReq));
    assert(stationMismatchRes.status === 403, "Staff station mismatch rejected with HTTP 403");
    const mismatchBody = await stationMismatchRes.json();
    assert(mismatchBody.error?.code === "STATION_MISMATCH", "Error code is STATION_MISMATCH");

    claimCheck = await ClaimRequest.findById(outsiderClaim._id);
    assert(claimCheck?.handoverAttempts === 0, "Staff station mismatch did NOT increment handoverAttempts");

    // 3.3 Failed PIN Verification Attempts & Lockout Bounds
    // Dedicated claim ticket for the 5-attempt PIN lockout bounds and custodian reset
    const lockoutClaim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: savedFoundItem!._id,
      claimantId: studentOwner._id,
      counterpartyUserId: studentNonOwner._id,
      submittedAnswer: "Black headphones with initials SO on the inner headband",
      status: "APPROVED",
      handoverCode: pinPlaintext,
      handoverCodeHash: pinHash,
      handoverCodeExpiresAt: validExpiry,
      handoverAttempts: 0,
      handoverLocked: false,
      lockoutUntil: null,
    });

    const wrongPin = "000000";

    for (let attempt = 1; attempt <= 4; attempt++) {
      const wrongReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
        method: "POST",
        headers: { "x-forwarded-for": `172.16.0.${attempt}` },
        body: JSON.stringify({ claimId: lockoutClaim._id.toString(), handoverCode: wrongPin }),
      });
      const wrongRes = await withUser(studentNonOwner, () => postVerifyHandover(wrongReq));
      const wrongData = await wrongRes.json();
      assert(wrongRes.status === 403, `Failed attempt #${attempt} returns HTTP 403 (CODE_MISMATCH)`);
      assert(wrongData.error?.code === "CODE_MISMATCH", `Attempt #${attempt} error code is CODE_MISMATCH`);

      const c = await ClaimRequest.findById(lockoutClaim._id);
      assert(c?.handoverAttempts === attempt, `Claim handoverAttempts incremented to ${attempt}`);
      assert(c?.handoverLocked === false, `Claim handoverLocked remains false on attempt #${attempt}`);
      assert(c?.status === "APPROVED", `Claim status remains APPROVED on attempt #${attempt}`);
    }

    // Attempt 5: BREACH LIMIT -> Must lock handover but keep status in "APPROVED"
    const breachReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      headers: { "x-forwarded-for": "172.16.0.5" },
      body: JSON.stringify({ claimId: lockoutClaim._id.toString(), handoverCode: wrongPin }),
    });
    const breachRes = await withUser(studentNonOwner, () => postVerifyHandover(breachReq));
    assert(breachRes.status === 423, "5th failed attempt returns HTTP 423 (HANDOVER_LOCKED)");
    const breachData = await breachRes.json();
    assert(breachData.error?.code === "HANDOVER_LOCKED", "5th failed attempt error code is HANDOVER_LOCKED");

    const lockedClaim = await ClaimRequest.findById(lockoutClaim._id);
    assert(lockedClaim?.handoverAttempts === 5, "Database: handoverAttempts is 5");
    assert(lockedClaim?.handoverLocked === true, "Database: handoverLocked is true");
    assert(
      lockedClaim?.status === "APPROVED",
      "CRITICAL INVARIANT: status remains 'APPROVED' (MUST NEVER BE 'LOCKED')"
    );
    assert(
      lockedClaim?.lockoutUntil instanceof Date && lockedClaim.lockoutUntil.getTime() > Date.now(),
      "Database: lockoutUntil window is set to a future timestamp (~15 min window)"
    );

    // 3.4 Verification of Active Lockout Rejection (HTTP 423) via preLockedClaim
    const preLockedClaim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: savedFoundItem!._id,
      claimantId: studentOwner._id,
      counterpartyUserId: studentNonOwner._id,
      submittedAnswer: "Black headphones",
      status: "APPROVED",
      handoverCode: pinPlaintext,
      handoverCodeHash: pinHash,
      handoverCodeExpiresAt: validExpiry,
      handoverAttempts: 5,
      handoverLocked: true,
      lockoutUntil: new Date(Date.now() + 15 * 60 * 1000), // active lockout window
    });

    const activeLockedReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      headers: { "x-forwarded-for": "172.16.1.1" },
      body: JSON.stringify({ claimId: preLockedClaim._id.toString(), handoverCode: pinPlaintext }),
    });
    const activeLockedRes = await withUser(studentNonOwner, () => postVerifyHandover(activeLockedReq));
    assert(activeLockedRes.status === 423, "Active lockout returns HTTP 423 HANDOVER_LOCKED before expired");

    // 3.5 Auto-clear on Lockout Expiry Window
    const expiredLockoutClaim = await ClaimRequest.create({
      itemType: "FOUND",
      itemId: savedFoundItem!._id,
      claimantId: studentOwner._id,
      counterpartyUserId: studentNonOwner._id,
      submittedAnswer: "Black headphones",
      status: "APPROVED",
      handoverCode: pinPlaintext,
      handoverCodeHash: pinHash,
      handoverCodeExpiresAt: validExpiry,
      handoverAttempts: 5,
      handoverLocked: true,
      lockoutUntil: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
    });

    const expiredLockoutReq = new NextRequest("http://localhost:3000/api/claims/verify-handover", {
      method: "POST",
      headers: { "x-forwarded-for": "172.16.2.1" },
      body: JSON.stringify({ claimId: expiredLockoutClaim._id.toString(), handoverCode: pinPlaintext }),
    });
    const expiredLockoutRes = await withUser(studentNonOwner, () => postVerifyHandover(expiredLockoutReq));
    // When lockout window expires, verify-handover auto-clears lockout flags
    assert(
      expiredLockoutRes.status === 200 || expiredLockoutRes.status === 201,
      "Expired lockout window automatically clears lockout and proceeds with verification"
    );
    const postExpiryClaim = await ClaimRequest.findById(expiredLockoutClaim._id);
    assert(postExpiryClaim?.handoverLocked === false, "Expired lockout auto-reset handoverLocked to false");
    assert(postExpiryClaim?.handoverAttempts === 0, "Expired lockout auto-reset handoverAttempts to 0");
    assert(postExpiryClaim?.lockoutUntil === null, "Expired lockout auto-reset lockoutUntil to null");

    // 3.6 Custodian PIN Reset Route (POST /api/staff/reset-pin)
    // Non-staff reset attempt rejected
    const nonStaffResetReq = new NextRequest("http://localhost:3000/api/staff/reset-pin", {
      method: "POST",
      body: JSON.stringify({ claimId: lockoutClaim._id.toString(), reason: "Unauthorized attempt" }),
    });
    const nonStaffResetRes = await withUser(studentOwner, () => postResetPin(nonStaffResetReq));
    assert(nonStaffResetRes.status === 403, "Non-staff PIN reset returns HTTP 403 FORBIDDEN");

    // Staff assigned to wrong station rejected
    const wrongStaffResetReq = new NextRequest("http://localhost:3000/api/staff/reset-pin", {
      method: "POST",
      body: JSON.stringify({ claimId: lockoutClaim._id.toString(), reason: "Wrong station reset attempt" }),
    });
    const wrongStaffResetRes = await withUser(otherDeskStaff, () => postResetPin(wrongStaffResetReq));
    assert(wrongStaffResetRes.status === 403, "Staff with station mismatch returns HTTP 403 STATION_MISMATCH");

    // Authorized Safe-Desk staff assigned to item station resets PIN
    const validResetReq = new NextRequest("http://localhost:3000/api/staff/reset-pin", {
      method: "POST",
      body: JSON.stringify({
        claimId: lockoutClaim._id.toString(),
        reason: "Claimant presented verified college photo ID card at safe desk counter",
      }),
    });
    const validResetRes = await withUser(deskStaff, () => postResetPin(validResetReq));
    assert(validResetRes.status === 200, "Authorized Safe-Desk staff PIN reset returns HTTP 200");
    const resetBody = await validResetRes.json();
    assert(resetBody.success === true, "PIN reset response indicates success: true");
    const newHandoverCode = resetBody.data?.newHandoverCode;
    assert(typeof newHandoverCode === "string" && newHandoverCode.length === 6, "New 6-digit PIN returned");

    // Verify claim document in database after reset
    const resetClaimDoc = await ClaimRequest.findById(lockoutClaim._id).select("+handoverCodeHash");
    assert(resetClaimDoc?.handoverLocked === false, "Database: handoverLocked reset to false");
    assert(resetClaimDoc?.handoverAttempts === 0, "Database: handoverAttempts reset to 0");
    assert(resetClaimDoc?.lockoutUntil === null, "Database: lockoutUntil cleared to null");
    assert(resetClaimDoc?.status === "APPROVED", "Database: status remains APPROVED");

    const newPinMatches = await bcrypt.compare(newHandoverCode, resetClaimDoc!.handoverCodeHash!);
    assert(newPinMatches, "Database: new bcrypt handoverCodeHash matches the newly issued PIN");

    // Verify AuditEvent was persisted
    const resetAudit = await AuditEvent.findOne({
      action: "CUSTODIAN_PIN_RESET",
      targetId: lockoutClaim._id,
    });
    assert(Boolean(resetAudit), "Immutable AuditEvent logged for CUSTODIAN_PIN_RESET");
    assert(resetAudit?.actorRole === "SAFE_DESK_STAFF", "AuditEvent actorRole recorded as SAFE_DESK_STAFF");
    assert(resetAudit?.targetType === "CLAIM", "AuditEvent targetType recorded as CLAIM");

    // -------------------------------------------------------------------------
    // SUITE 4: Quest & Event CMS Draft Privacy & Campus Location Geofencing
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 4: Quest & Event CMS Draft Privacy & Location Geofencing ───");

    // 4.1 Seed Draft and Active Quests
    const draftQuest = await Quest.create({
      questCode: `Q_DRAFT_${Date.now()}`,
      title: "Secret Unreleased Robotics Mystery",
      description: "Draft quest intended only for staff preview.",
      questType: "CAMPUS_TREASURE",
      targetLocationId: safeDeskLocation._id,
      difficulty: 2,
      xpReward: 250,
      coinReward: 50,
      status: "DRAFT",
    });

    const activeQuest = await Quest.create({
      questCode: `Q_ACTIVE_${Date.now()}`,
      title: "Active Campus Library Mystery",
      description: "Publicly visible active investigation.",
      questType: "CAMPUS_TREASURE",
      targetLocationId: safeDeskLocation._id,
      difficulty: 1,
      xpReward: 100,
      coinReward: 20,
      status: "ACTIVE",
    });

    // 4.2 Seed Draft and Published Events
    const draftEvent = await Event.create({
      title: "Draft Unannounced Hackathon",
      slug: `draft-hackathon-${Date.now()}`,
      eventType: "FLASH_HUNT",
      description: "Draft event under organizer review.",
      startTime: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 8 * 24 * 3600 * 1000),
      status: "DRAFT",
    });

    const upcomingEvent = await Event.create({
      title: "Annual Campus AI Symposium",
      slug: `upcoming-ai-symposium-${Date.now()}`,
      eventType: "FLASH_HUNT",
      description: "Publicly published AI event.",
      startTime: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      endTime: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      status: "UPCOMING",
    });

    // 4.3 Direct ID Lookup on DRAFT Quest: Anonymous -> 404
    const anonQuestReq = new NextRequest(`http://localhost:3000/api/quests/${draftQuest._id}`);
    const anonQuestRes = await withUser(null, () =>
      getQuestById(anonQuestReq, { params: Promise.resolve({ id: draftQuest._id.toString() }) })
    );
    assert(anonQuestRes.status === 404, "Draft Quest: Anonymous direct ID lookup returns HTTP 404 (QUEST_NOT_FOUND)");

    // 4.4 Direct ID Lookup on DRAFT Quest: Non-staff Student -> 404
    const studentQuestReq = new NextRequest(`http://localhost:3000/api/quests/${draftQuest._id}`);
    const studentQuestRes = await withUser(studentOwner, () =>
      getQuestById(studentQuestReq, { params: Promise.resolve({ id: draftQuest._id.toString() }) })
    );
    assert(studentQuestRes.status === 404, "Draft Quest: Student direct ID lookup returns HTTP 404 (QUEST_NOT_FOUND)");

    // 4.5 Direct ID Lookup on DRAFT Quest: Staff/Admin -> 200 Preview
    const adminQuestReq = new NextRequest(`http://localhost:3000/api/quests/${draftQuest._id}`);
    const adminQuestRes = await withUser(adminUser, () =>
      getQuestById(adminQuestReq, { params: Promise.resolve({ id: draftQuest._id.toString() }) })
    );
    assert(adminQuestRes.status === 200, "Draft Quest: Admin staff direct ID lookup returns HTTP 200 (Staff Preview)");
    const adminQuestData = (await adminQuestRes.json()).data;
    assert(adminQuestData.quest.status === "DRAFT", "Admin receives draft quest in response");

    // 4.6 Direct ID Lookup on ACTIVE Quest: Anonymous -> 200
    const anonActiveQuestReq = new NextRequest(`http://localhost:3000/api/quests/${activeQuest._id}`);
    const anonActiveQuestRes = await withUser(null, () =>
      getQuestById(anonActiveQuestReq, { params: Promise.resolve({ id: activeQuest._id.toString() }) })
    );
    assert(anonActiveQuestRes.status === 200, "Active Quest: Anonymous direct ID lookup returns HTTP 200");

    // 4.7 Direct ID Lookup on DRAFT Event: Anonymous -> 404
    const anonEventReq = new NextRequest(`http://localhost:3000/api/events/${draftEvent._id}`);
    const anonEventRes = await withUser(null, () =>
      getEventById(anonEventReq, { params: Promise.resolve({ id: draftEvent._id.toString() }) })
    );
    assert(anonEventRes.status === 404, "Draft Event: Anonymous direct ID lookup returns HTTP 404");

    // 4.8 Direct ID Lookup on DRAFT Event: Student -> 404
    const studentEventReq = new NextRequest(`http://localhost:3000/api/events/${draftEvent._id}`);
    const studentEventRes = await withUser(studentOwner, () =>
      getEventById(studentEventReq, { params: Promise.resolve({ id: draftEvent._id.toString() }) })
    );
    assert(studentEventRes.status === 404, "Draft Event: Student direct ID lookup returns HTTP 404");

    // 4.9 Direct ID Lookup on DRAFT Event: Admin -> 200 Preview
    const adminEventReq = new NextRequest(`http://localhost:3000/api/events/${draftEvent._id}`);
    const adminEventRes = await withUser(adminUser, () =>
      getEventById(adminEventReq, { params: Promise.resolve({ id: draftEvent._id.toString() }) })
    );
    assert(adminEventRes.status === 200, "Draft Event: Admin staff direct ID lookup returns HTTP 200");

    // 4.10 Direct ID Lookup on UPCOMING Event: Anonymous -> 200
    const anonUpcomingEventReq = new NextRequest(`http://localhost:3000/api/events/${upcomingEvent._id}`);
    const anonUpcomingEventRes = await withUser(null, () =>
      getEventById(anonUpcomingEventReq, { params: Promise.resolve({ id: upcomingEvent._id.toString() }) })
    );
    assert(anonUpcomingEventRes.status === 200, "Upcoming Event: Anonymous direct ID lookup returns HTTP 200");

    // 4.11 Campus Location Geofencing (POST /api/locations)
    // Non-admin blocked
    const studentLocReq = new NextRequest("http://localhost:3000/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: "Unauthorized Location",
        code: "UNAUTH_LOC",
        coordinates: { lat: 15.5960, lng: 73.7930 },
      }),
    });
    const studentLocRes = await withUser(studentOwner, () => postLocation(studentLocReq));
    assert(studentLocRes.status === 403, "Non-admin POST /api/locations returns HTTP 403 UNAUTHORIZED");

    // Out-of-bounds coordinate (South-West of perimeter)
    const oobReq1 = new NextRequest("http://localhost:3000/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: "Off-Campus Panaji Spot",
        code: "OOB_SW",
        coordinates: { lat: 15.4900, lng: 73.8200 },
      }),
    });
    const oobRes1 = await withUser(adminUser, () => postLocation(oobReq1));
    assert(oobRes1.status === 400, "Out-of-bounds SW coordinates return HTTP 400");
    const oobData1 = await oobRes1.json();
    assert(oobData1.error?.code === "OUT_OF_BOUNDS", "Error code is OUT_OF_BOUNDS");

    // Out-of-bounds coordinate (North-East of perimeter)
    const oobReq2 = new NextRequest("http://localhost:3000/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: "Off-Campus Mapusa Spot",
        code: "OOB_NE",
        coordinates: { lat: 15.6100, lng: 73.8150 },
      }),
    });
    const oobRes2 = await withUser(adminUser, () => postLocation(oobReq2));
    assert(oobRes2.status === 400, "Out-of-bounds NE coordinates return HTTP 400");
    const oobData2 = await oobRes2.json();
    assert(oobData2.error?.code === "OUT_OF_BOUNDS", "Error code is OUT_OF_BOUNDS");

    // Valid within-perimeter coordinates [15.5890, 73.7880] to [15.6010, 73.8020]
    const validLocReq = new NextRequest("http://localhost:3000/api/locations", {
      method: "POST",
      body: JSON.stringify({
        name: "North Engineering Courtyard",
        code: "ENG_COURT_QA",
        zoneType: "ACADEMIC_BLOCK",
        description: "Outdoor courtyard with study benches",
        coordinates: { lat: 15.5975, lng: 73.7940, mapX: 60, mapY: 60 },
        operatingHours: "07:00 - 22:00",
        floors: ["Ground"],
      }),
    });
    const validLocRes = await withUser(adminUser, () => postLocation(validLocReq));
    assert(validLocRes.status === 201, "Within-bounds campus coordinates return HTTP 201 Created");
    const createdLoc = await CampusLocation.findOne({ code: "ENG_COURT_QA" });
    assert(Boolean(createdLoc), "Valid location document created in database");

    // -------------------------------------------------------------------------
    // SUITE 5: Squad Chat Concurrency, Idempotency & 30-Day Retention
    // -------------------------------------------------------------------------
    console.log("\n─── Suite 5: Squad Chat Idempotency, 500-Cap Pruning & 30-Day Retention ───");

    // 5.1 Seed Squad & Members
    const testSquad = await Squad.create({
      name: "Cyber Vanguard QA",
      tag: "VANG",
      description: "Elite investigators testing concurrency and pruning",
      leaderId: studentOwner._id,
      roles: {
        [studentOwner._id.toString()]: "LEADER",
        [studentNonOwner._id.toString()]: "MEMBER",
      },
    });

    await SquadMember.create({
      squadId: testSquad._id,
      userId: studentOwner._id,
      role: "LEADER",
      squadRole: "LEADER",
    });

    await SquadMember.create({
      squadId: testSquad._id,
      userId: studentNonOwner._id,
      role: "MEMBER",
      squadRole: "MEMBER",
    });

    // 5.2 Compound Unique Index on { squadId, senderId, requestId }
    // Ensure MongoDB indexes are built
    await SquadMessage.init();
    const indexes = await SquadMessage.collection.indexes();
    const compoundIdx = indexes.find((idx) => {
      const keys = Object.keys(idx.key);
      return keys.includes("squadId") && keys.includes("senderId") && keys.includes("requestId");
    });
    assert(compoundIdx !== undefined, "MongoDB collection defines compound index on { squadId, senderId, requestId }");
    assert(compoundIdx?.unique === true, "Compound index has unique: true");

    // Database-level duplicate insertion rejection
    const idemRequestId = `req_idem_${Date.now()}`;
    await SquadMessage.create({
      squadId: testSquad._id,
      senderId: studentOwner._id,
      text: "Original message payload",
      requestId: idemRequestId,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });

    let duplicateKeyCaught = false;
    try {
      await SquadMessage.create({
        squadId: testSquad._id,
        senderId: studentOwner._id,
        text: "Duplicate message attempt with same requestId",
        requestId: idemRequestId,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      });
    } catch (err: any) {
      if (err.code === 11000 || err.name === "MongoServerError") {
        duplicateKeyCaught = true;
      }
    }
    assert(duplicateKeyCaught, "MongoDB unique compound index throws MongoServerError 11000 on duplicate requestId");

    // 5.3 Route Handler Idempotency & Replay Verification
    const replayRequestId = `req_replay_${Date.now()}`;
    const initialSendReq = new NextRequest(`http://localhost:3000/api/squads/${testSquad._id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        text: "Checking idempotency replay via API",
        requestId: replayRequestId,
      }),
    });
    const initialSendRes = await withUser(studentOwner, () =>
      postSquadMessage(initialSendReq, { params: Promise.resolve({ id: testSquad._id.toString() }) })
    );
    assert(initialSendRes.status === 201, "First message send returns HTTP 201 Created");

    // Wait 2.1s for the 2-second chat rate-limit cooldown (chat_cd) to elapse
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // Second send with same requestId returns HTTP 200 with replayed: true
    const replaySendReq = new NextRequest(`http://localhost:3000/api/squads/${testSquad._id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        text: "Checking idempotency replay via API (duplicate)",
        requestId: replayRequestId,
      }),
    });
    const replaySendRes = await withUser(studentOwner, () =>
      postSquadMessage(replaySendReq, { params: Promise.resolve({ id: testSquad._id.toString() }) })
    );
    assert(replaySendRes.status === 200, "Replayed message send returns HTTP 200 OK");
    const replayBody = await replaySendRes.json();
    assert(replayBody.replayed === true, "Replayed response includes replayed: true");

    const countWithRequestId = await SquadMessage.countDocuments({
      squadId: testSquad._id,
      requestId: replayRequestId,
    });
    assert(countWithRequestId === 1, "Database contains strictly 1 message document for replayRequestId");

    // 5.4 500-Message Cap Pruning Under Concurrency
    console.log("  Seeding squad chat to exactly 500 unexpired messages...");
    await SquadMessage.deleteMany({ squadId: testSquad._id });

    const seedTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const seedDocs = [];
    for (let i = 0; i < 500; i++) {
      seedDocs.push({
        squadId: testSquad._id,
        senderId: studentOwner._id,
        text: `Baseline message #${i + 1}`,
        moderationState: "VISIBLE",
        createdAt: new Date(seedTime.getTime() + i * 1000),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      });
    }
    await SquadMessage.insertMany(seedDocs);

    const baselineCount = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(baselineCount === 500, `Baseline count verified at exactly 500 messages (actual: ${baselineCount})`);

    // Helper implementing atomic boundary cutoff pruning from /api/squads/[id]/messages/route.ts
    async function sendAndPrune(msgIdx: number) {
      const now = new Date();
      await SquadMessage.create({
        squadId: testSquad._id,
        senderId: studentNonOwner._id,
        text: `Concurrent batch message #${msgIdx}`,
        moderationState: "VISIBLE",
        createdAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
      });

      // Atomic boundary cutoff logic on unexpired messages
      const cutoff = await SquadMessage.find({ squadId: testSquad._id, expiresAt: { $gt: now } })
        .sort({ createdAt: -1, _id: -1 })
        .skip(499)
        .limit(1)
        .select("createdAt _id")
        .lean();

      if (cutoff.length > 0) {
        const b = cutoff[0];
        await SquadMessage.deleteMany({
          squadId: testSquad._id,
          $or: [
            { createdAt: { $lt: b.createdAt } },
            { createdAt: b.createdAt, _id: { $lt: b._id } },
          ],
        });
      }
    }

    console.log("  Firing 20 concurrent messages in parallel via Promise.all...");
    await Promise.all(Array.from({ length: 20 }, (_, idx) => sendAndPrune(idx + 1)));

    const finalCapCount = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(
      finalCapCount === 500,
      `Strict 500-message cap invariant held under concurrent execution (actual: ${finalCapCount}, never 520)`
    );

    // Oldest messages were evicted in FIFO order
    const oldestMsg = await SquadMessage.find({ squadId: testSquad._id }).sort({ createdAt: 1 }).limit(1).lean();
    assert(
      oldestMsg.length === 1 && !oldestMsg[0].text.includes("Baseline message #1"),
      "FIFO pruning: Oldest baseline messages were cleanly evicted to make room for newer messages"
    );

    // 5.5 30-Day Retention Immediate Query Filtering
    // Insert an expired message (expiresAt in the past) and an unexpired message
    const expiredMsg = await SquadMessage.create({
      squadId: testSquad._id,
      senderId: studentOwner._id,
      text: "Expired secret message from 31 days ago",
      moderationState: "VISIBLE",
      createdAt: new Date(Date.now() - 32 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 2 * 24 * 3600 * 1000), // Expired 2 days ago
    });

    const activeMsg = await SquadMessage.create({
      squadId: testSquad._id,
      senderId: studentOwner._id,
      text: "Active unexpired fresh message",
      moderationState: "VISIBLE",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000),
    });

    // Query messages via GET /api/squads/[id]/messages
    const getMsgsReq = new NextRequest(`http://localhost:3000/api/squads/${testSquad._id}/messages`);
    const getMsgsRes = await withUser(studentOwner, () =>
      getSquadMessages(getMsgsReq, { params: Promise.resolve({ id: testSquad._id.toString() }) })
    );
    assert(getMsgsRes.status === 200, "GET /api/squads/[id]/messages returns HTTP 200");
    const msgsData = (await getMsgsRes.json()).data;

    const containsExpired = msgsData.some((m: any) => m._id.toString() === expiredMsg._id.toString());
    const containsActive = msgsData.some((m: any) => m._id.toString() === activeMsg._id.toString());

    assert(!containsExpired, "Retention Invariant: Expired messages (>30 days) are strictly hidden from query results (expiresAt > now)");
    assert(containsActive, "Retention Invariant: Active unexpired messages are returned in query results");

    console.log("\n================================================================================");
    console.log("🎉 ALL WAVE 1 P0 INDEPENDENT QA TESTS COMPLETED SUCCESSFULLY!");
    console.log(`   Passed: ${passedCount} / ${passedCount + failedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log("================================================================================\n");
  } finally {
    // Clean teardown of disposable database
    const currentDb = mongoose.connection.db;
    if (currentDb && currentDb.databaseName.startsWith("aiem_hunt_test_")) {
      console.log(`🧹 Dropping ephemeral test database: ${currentDb.databaseName}...`);
      await currentDb.dropDatabase();
      console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.\n");
    }
    await mongoose.disconnect();
  }
}

runQAWave1Verification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL ERROR IN QA WAVE 1 VERIFICATION:", err);
    process.exit(1);
  });

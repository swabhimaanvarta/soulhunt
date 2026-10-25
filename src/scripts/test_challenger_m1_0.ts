/**
 * AIEM Hunt — Milestone M1.0 Adversarial Empirical Challenge Suite
 * Author: Challenger 1 (Empirical Challenger)
 * Scope: assertSafeConnectionUri, apiSuccess/apiError, SquadMessageSchema unique index, schema enums
 */

import path from "node:path";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiServerError } from "../lib/api-response";
import { SquadMessage, ClaimRequest, SquadMember } from "../models";
import { assertSafeConnectionUri, connectDB } from "../lib/db";
import { middleware } from "../middleware";
import { signSessionToken } from "../lib/jwt";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASSED: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAILED: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// SUITE 1: assertSafeConnectionUri Adversarial & Edge Case Testing
// ---------------------------------------------------------------------------
interface SafetyGuardResult {
  exited: boolean;
  exitCode: number | null;
  loggedAlerts: string[];
}

function executeSafetyGuard(uri: string, isTestRunner: boolean): SafetyGuardResult {
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  let exitCode: number | null = null;
  let exited = false;
  const loggedAlerts: string[] = [];

  try {
    (process as any).exit = (code: number = 0) => {
      exited = true;
      exitCode = code;
      throw new Error(`PROCESS_EXIT_${code}`);
    };
    console.error = (...args: any[]) => {
      loggedAlerts.push(args.map(String).join(" "));
    };

    try {
      assertSafeConnectionUri(uri, isTestRunner);
    } catch (err: any) {
      if (!err.message?.startsWith("PROCESS_EXIT_")) {
        throw err;
      }
    }
  } finally {
    process.exit = originalExit;
    console.error = originalConsoleError;
  }

  return { exited, exitCode, loggedAlerts };
}

async function testSafetyGuard() {
  console.log("\n─── Suite 1: assertSafeConnectionUri Adversarial & Edge Cases ───");

  // Positive cases (Production / Normal mode: isTestRunner = false)
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/aiem_hunt", false);
    assert(!res.exited, "Valid loopback 127.0.0.1 prod URI accepted without exit");
  }
  {
    const res = executeSafetyGuard("mongodb://localhost:27017/aiem_hunt", false);
    assert(!res.exited, "Valid loopback localhost prod URI accepted without exit");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1/aiem_hunt", false);
    assert(!res.exited, "Valid loopback without explicit port accepted without exit");
  }
  {
    const res = executeSafetyGuard("mongodb://user:pass@127.0.0.1:27017/aiem_hunt", false);
    assert(!res.exited, "Valid loopback with user credentials accepted without exit");
  }

  // Positive cases (Test Runner mode: isTestRunner = true)
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/aiem_hunt_test_unit1", true);
    assert(!res.exited, "Valid test runner DB '/aiem_hunt_test_unit1' accepted without exit");
  }
  {
    const res = executeSafetyGuard("mongodb://localhost:27017/aiem_hunt_test_concurrency_123", true);
    assert(!res.exited, "Valid localhost test runner DB accepted without exit");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/aiem_hunt_test_", true);
    assert(!res.exited, "Exact prefix '/aiem_hunt_test_' accepted for test runner without exit");
  }

  // Adversarial: Malformed URIs
  {
    const res = executeSafetyGuard("not-a-valid-uri", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Invalid database URI format"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Malformed string rejected with exit 1 and '[SECURITY ALERT] Invalid database URI format'");
  }
  {
    const res = executeSafetyGuard("", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Invalid database URI format"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Empty string rejected with exit 1 and '[SECURITY ALERT] Invalid database URI format'");
  }
  {
    const res = executeSafetyGuard("://missing-protocol", false);
    assert(res.exited && res.exitCode === 1,
      "Missing protocol scheme rejected with exit 1");
  }

  // Adversarial: Protocol Bypass
  {
    const res = executeSafetyGuard("mongodb+srv://127.0.0.1:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Invalid protocol. Must be 'mongodb:'"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "mongodb+srv: protocol strictly rejected with exit 1 and '[SECURITY ALERT] Invalid protocol'");
  }
  {
    const res = executeSafetyGuard("http://127.0.0.1:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Invalid protocol"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "http: protocol rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("file:///etc/passwd", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Invalid protocol"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "file: protocol rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("ftp://localhost/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Invalid protocol"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "ftp: protocol rejected with exit 1");
  }

  // Adversarial: Remote Hosts & Host Spoofing
  {
    const res = executeSafetyGuard("mongodb://evil.com/aiem_hunt_test_db", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Remote host 'evil.com' rejected with exit 1 and '[SECURITY ALERT] Disallowed database host'");
  }
  {
    const res = executeSafetyGuard("mongodb://cluster0.mongodb.net/aiem_hunt_test_db", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Cloud Atlas host 'cluster0.mongodb.net' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://192.168.1.100:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "LAN private IP '192.168.1.100' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://0.0.0.0:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Binding address '0.0.0.0' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://localhost.attacker.com:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Subdomain spoofing 'localhost.attacker.com' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1.attacker.com:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Subdomain spoofing '127.0.0.1.attacker.com' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://localhost@evil.com:27017/aiem_hunt", false);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Userinfo confusion 'localhost@evil.com' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://[::1]:27017/aiem_hunt_test_db", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Disallowed database host"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "IPv6 loopback '[::1]' strictly rejected per 127.0.0.1/localhost policy");
  }

  // Adversarial: Test Runner Database Name Enforcements
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/aiem_hunt", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Test runner must connect to database starting with"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Test runner targeting production database '/aiem_hunt' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/aiem_hunt_prod", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Test runner must connect to database starting with"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Test runner targeting '/aiem_hunt_prod' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/other_test", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Test runner must connect to database starting with"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Test runner targeting non-compliant '/other_test' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Test runner must connect to database starting with"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Test runner with empty/root pathname '/' rejected with exit 1");
  }
  {
    const res = executeSafetyGuard("mongodb://127.0.0.1:27017/AIEM_HUNT_TEST_1", true);
    const hasAlert = res.loggedAlerts.some((l) => l.includes("Test runner must connect to database starting with"));
    assert(res.exited && res.exitCode === 1 && hasAlert,
      "Case mismatch pathname '/AIEM_HUNT_TEST_1' strictly rejected with exit 1");
  }
}

// ---------------------------------------------------------------------------
// SUITE 2: apiSuccess and apiError Response Constructors
// ---------------------------------------------------------------------------
async function testApiResponseConstructors() {
  console.log("\n─── Suite 2: apiSuccess and apiError Envelope Constructors ───");

  // 1. apiSuccess default status and envelope
  {
    const res = apiSuccess({ id: 101, username: "hunter" });
    assert(res.status === 200, "apiSuccess defaults to HTTP 200");
    const json = await res.json();
    assert(json.success === true, "apiSuccess returns success: true");
    assert(json.data.id === 101 && json.data.username === "hunter", "apiSuccess data payload matches");
    assert(!("meta" in json), "apiSuccess omits meta key when meta is not supplied");
  }

  // 2. apiSuccess custom status
  {
    const res = apiSuccess({ created: true }, 201);
    assert(res.status === 201, "apiSuccess respects custom status 201");
    const json = await res.json();
    assert(json.success === true && json.data.created === true, "apiSuccess 201 body matches");
  }

  // 3. apiSuccess with metadata
  {
    const meta = { page: 1, limit: 20, total: 100 };
    const res = apiSuccess(["item1", "item2"], 200, meta);
    const json = await res.json();
    assert(json.meta?.total === 100 && json.meta?.page === 1, "apiSuccess embeds meta object when provided");
  }

  // 4. apiSuccess falsy and edge-case data payloads
  {
    const resNull = apiSuccess(null);
    const jsonNull = await resNull.json();
    assert(jsonNull.data === null, "apiSuccess accepts null data");

    const resFalse = apiSuccess(false);
    const jsonFalse = await resFalse.json();
    assert(jsonFalse.data === false, "apiSuccess accepts boolean false data");

    const resZero = apiSuccess(0);
    const jsonZero = await resZero.json();
    assert(jsonZero.data === 0, "apiSuccess accepts numeric 0 data");

    const resEmptyStr = apiSuccess("");
    const jsonEmptyStr = await resEmptyStr.json();
    assert(jsonEmptyStr.data === "", "apiSuccess accepts empty string data");

    const resArr = apiSuccess([]);
    const jsonArr = await resArr.json();
    assert(Array.isArray(jsonArr.data) && jsonArr.data.length === 0, "apiSuccess accepts empty array data");
  }

  // 5. apiError default status (400) and structure
  {
    const res = apiError("BAD_REQUEST", "Invalid submission");
    assert(res.status === 400, "apiError defaults to HTTP 400");
    const json = await res.json();
    assert(json.success === false, "apiError returns success: false");
    assert(json.error.code === "BAD_REQUEST", "apiError error.code matches");
    assert(json.error.message === "Invalid submission", "apiError error.message matches");
    assert(!("requestId" in json.error), "apiError omits requestId when undefined");
    assert(!("details" in json.error), "apiError omits details when undefined");
  }

  // 6. apiError with custom status codes (401, 403, 404, 409, 422, 500)
  {
    const res401 = apiError("UNAUTHORIZED", "Login required", 401);
    assert(res401.status === 401, "apiError respects 401 status");

    const res403 = apiError("FORBIDDEN", "Staff role required", 403);
    assert(res403.status === 403, "apiError respects 403 status");

    const res404 = apiError("ITEM_NOT_FOUND", "Item does not exist", 404);
    assert(res404.status === 404, "apiError respects 404 status");

    const res409 = apiError("CONFLICT", "Already exists", 409);
    assert(res409.status === 409, "apiError respects 409 status");

    const res422 = apiError("UNPROCESSABLE_ENTITY", "Validation error", 422);
    assert(res422.status === 422, "apiError respects 422 status");
  }

  // 7. apiError with requestId and details
  {
    const res = apiError("VALIDATION_ERROR", "Invalid fields", 422, "req_abc_123", { field: "email", rule: "domain" });
    const json = await res.json();
    assert(json.error.requestId === "req_abc_123", "apiError includes requestId when provided");
    assert(json.error.details?.field === "email", "apiError includes details payload when provided");
  }

  // 8. apiServerError sanitization & stack hiding
  {
    const sensitiveErr = new Error("Connection failed: password=supersecret at mongodb://...");
    const res = apiServerError(sensitiveErr, "DATABASE_ERROR", "A database error occurred.", "req_err_999");
    assert(res.status === 500, "apiServerError returns HTTP 500");
    const json = await res.json();
    assert(json.success === false, "apiServerError returns success: false");
    assert(json.error.code === "DATABASE_ERROR", "apiServerError code matches");
    assert(json.error.message === "A database error occurred.", "apiServerError returns sanitized fallback message");
    assert(!JSON.stringify(json).includes("supersecret"), "apiServerError client payload does NOT leak internal exception or secrets");
    assert(json.error.requestId === "req_err_999", "apiServerError includes requestId");
  }

  // 9. apiServerError with non-Error thrown objects
  {
    const resStr = apiServerError("string failure");
    assert(resStr.status === 500, "apiServerError handles string errors gracefully");
    const resNull = apiServerError(null);
    assert(resNull.status === 500, "apiServerError handles null error safely");
  }
}

// ---------------------------------------------------------------------------
// SUITE 3: SquadMessageSchema Compound Unique Index & Idempotency
// ---------------------------------------------------------------------------
async function testSquadMessageIdempotencyIndex() {
  console.log("\n─── Suite 3: SquadMessageSchema Compound Unique Index & Idempotency ───");

  const testDbName = `aiem_hunt_test_challenger_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const testUri = `mongodb://127.0.0.1:27017/${testDbName}`;

  // Validate testUri through safety guard
  assertSafeConnectionUri(testUri, true);

  await mongoose.connect(testUri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  try {
    // 1. Ensure indexes are built in MongoDB
    await SquadMessage.init();
    const indexSpecs = await SquadMessage.collection.indexes();

    // Check that the compound unique index exists
    const compoundIndexSpec = indexSpecs.find((spec: any) => {
      const k = spec.key;
      return k && k.squadId === 1 && k.senderId === 1 && k.requestId === 1;
    });

    assert(Boolean(compoundIndexSpec), "Compound index { squadId: 1, senderId: 1, requestId: 1 } exists in MongoDB");

    if (compoundIndexSpec) {
      assert(compoundIndexSpec.unique === true, "Compound index is marked unique: true in index specifications");
      assert(
        Boolean(compoundIndexSpec.partialFilterExpression?.requestId),
        "Compound index specifies partialFilterExpression for requestId"
      );
    }

    const squad1 = new Types.ObjectId();
    const squad2 = new Types.ObjectId();
    const user1 = new Types.ObjectId();
    const user2 = new Types.ObjectId();
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 2. Insert original message with requestId
    const msg1 = await SquadMessage.create({
      squadId: squad1,
      senderId: user1,
      requestId: "msg_req_unique_001",
      text: "Initial squad message",
      expiresAt: futureDate,
    });
    assert(Boolean(msg1._id), "Successfully created initial squad message with requestId");

    // 3. Attempt duplicate insert with SAME squadId, SAME senderId, SAME requestId
    let duplicateRejected = false;
    let duplicateErrorCode: number | null = null;
    try {
      await SquadMessage.create({
        squadId: squad1,
        senderId: user1,
        requestId: "msg_req_unique_001", // duplicate
        text: "Duplicate squad message attempt",
        expiresAt: futureDate,
      });
    } catch (err: any) {
      duplicateRejected = true;
      duplicateErrorCode = err.code;
    }
    assert(duplicateRejected && duplicateErrorCode === 11000,
      `Duplicate { squadId, senderId, requestId } strictly rejected with Mongo duplicate key error 11000 (actual code: ${duplicateErrorCode})`);

    // 4. Same squad and user, DIFFERENT requestId -> must SUCCEED
    let differentReqIdSuccess = false;
    try {
      const msg2 = await SquadMessage.create({
        squadId: squad1,
        senderId: user1,
        requestId: "msg_req_unique_002", // different
        text: "Second distinct message",
        expiresAt: futureDate,
      });
      differentReqIdSuccess = Boolean(msg2._id);
    } catch (err) {
      differentReqIdSuccess = false;
    }
    assert(differentReqIdSuccess, "Different requestId for same squad and sender succeeds");

    // 5. Different sender, SAME squad and SAME requestId -> must SUCCEED
    let differentSenderSuccess = false;
    try {
      const msg3 = await SquadMessage.create({
        squadId: squad1,
        senderId: user2, // different sender
        requestId: "msg_req_unique_001",
        text: "Different sender reusing requestId string",
        expiresAt: futureDate,
      });
      differentSenderSuccess = Boolean(msg3._id);
    } catch (err) {
      differentSenderSuccess = false;
    }
    assert(differentSenderSuccess, "Different senderId with same squadId and requestId succeeds");

    // 6. Different squad, SAME sender and SAME requestId -> must SUCCEED
    let differentSquadSuccess = false;
    try {
      const msg4 = await SquadMessage.create({
        squadId: squad2, // different squad
        senderId: user1,
        requestId: "msg_req_unique_001",
        text: "Message to squad 2 with same requestId",
        expiresAt: futureDate,
      });
      differentSquadSuccess = Boolean(msg4._id);
    } catch (err) {
      differentSquadSuccess = false;
    }
    assert(differentSquadSuccess, "Different squadId with same senderId and requestId succeeds");

    // 7. CRITICAL STRESS TEST: Multiple messages WITHOUT requestId (undefined)
    // If partialFilterExpression was omitted or sparse was misconfigured on compound index,
    // multiple documents with missing requestId would conflict on null.
    let multiNoReqSuccess = true;
    try {
      const noReq1 = await SquadMessage.create({
        squadId: squad1,
        senderId: user1,
        // no requestId
        text: "Chat message without requestId 1",
        expiresAt: futureDate,
      });
      const noReq2 = await SquadMessage.create({
        squadId: squad1,
        senderId: user1,
        // no requestId
        text: "Chat message without requestId 2",
        expiresAt: futureDate,
      });
      const noReq3 = await SquadMessage.create({
        squadId: squad1,
        senderId: user1,
        // no requestId
        text: "Chat message without requestId 3",
        expiresAt: futureDate,
      });
      multiNoReqSuccess = Boolean(noReq1._id && noReq2._id && noReq3._id);
    } catch (err: any) {
      multiNoReqSuccess = false;
      console.error("Failed on missing requestId:", err.message);
    }
    assert(multiNoReqSuccess, "Multiple messages without requestId from same sender in same squad do NOT collide (sparse/partial index holds)");

  } finally {
    // Drop test database cleanly
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log(`  🧹 Ephemeral test DB ${testDbName} dropped cleanly.`);
  }
}

// ---------------------------------------------------------------------------
// SUITE 4: ClaimRequest & SquadMember Schema Enums and Field Hardening
// ---------------------------------------------------------------------------
async function testSchemaHardening() {
  console.log("\n─── Suite 4: ClaimRequest & SquadMember Schema Enums & Hardening ───");

  // 1. ClaimRequestSchema status enum
  const validStatuses = ["PENDING", "APPROVED", "HANDOVER_COMPLETE", "REJECTED", "DISPUTED"];
  for (const s of validStatuses) {
    const claim = new ClaimRequest({
      itemType: "LOST",
      itemId: new Types.ObjectId(),
      claimantId: new Types.ObjectId(),
      counterpartyUserId: new Types.ObjectId(),
      submittedAnswer: "test answer",
      status: s,
    });
    const err = claim.validateSync();
    assert(!err?.errors?.status, `ClaimRequest accepts canonical status '${s}'`);
  }

  // ClaimRequestSchema rejects "LOCKED"
  {
    const claimLocked = new ClaimRequest({
      itemType: "LOST",
      itemId: new Types.ObjectId(),
      claimantId: new Types.ObjectId(),
      counterpartyUserId: new Types.ObjectId(),
      submittedAnswer: "test answer",
      status: "LOCKED",
    });
    const err = claimLocked.validateSync();
    assert(Boolean(err?.errors?.status), "ClaimRequest rejects 'LOCKED' as a status enum variant");
  }

  // ClaimRequestSchema lockoutUntil field defaults to null and accepts Date
  {
    const claim = new ClaimRequest({
      itemType: "LOST",
      itemId: new Types.ObjectId(),
      claimantId: new Types.ObjectId(),
      counterpartyUserId: new Types.ObjectId(),
      submittedAnswer: "test answer",
      status: "PENDING",
    });
    assert(claim.lockoutUntil === null, "ClaimRequest.lockoutUntil defaults to null");
    assert(claim.handoverLocked === false, "ClaimRequest.handoverLocked defaults to false");

    const future = new Date(Date.now() + 60000);
    claim.lockoutUntil = future;
    claim.handoverLocked = true;
    const err = claim.validateSync();
    assert(!err?.errors?.lockoutUntil && !err?.errors?.handoverLocked, "ClaimRequest accepts lockoutUntil Date and handoverLocked boolean");
  }

  // 2. SquadMemberSchema role enum
  const validRoles = ["LEADER", "COLEADER", "ELDER", "MEMBER"];
  for (const r of validRoles) {
    const member = new SquadMember({
      squadId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      role: r,
    });
    const err = member.validateSync();
    assert(!err?.errors?.role, `SquadMember accepts canonical role '${r}'`);
  }

  // SquadMemberSchema rejects legacy "OFFICER"
  {
    const memberOfficer = new SquadMember({
      squadId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      role: "OFFICER",
    });
    const err = memberOfficer.validateSync();
    assert(Boolean(err?.errors?.role), "SquadMember rejects legacy 'OFFICER' role in schema enum");
  }
}

// ---------------------------------------------------------------------------
// SUITE 5: Middleware Route Protection and Structured Error Envelopes
// ---------------------------------------------------------------------------
async function testMiddlewareGuards() {
  console.log("\n─── Suite 5: Middleware Route Protection & Structured Error Envelopes ───");

  const studentToken = await signSessionToken({
    userId: new Types.ObjectId().toString(),
    email: "student1@aiemgoa.ac.in",
    username: "student1",
    role: "STUDENT",
  });

  const staffToken = await signSessionToken({
    userId: new Types.ObjectId().toString(),
    email: "staff1@aiemgoa.ac.in",
    username: "staff1",
    role: "SAFE_DESK_STAFF",
  });

  const moderatorToken = await signSessionToken({
    userId: new Types.ObjectId().toString(),
    email: "mod1@aiemgoa.ac.in",
    username: "mod1",
    role: "MODERATOR",
  });

  const adminToken = await signSessionToken({
    userId: new Types.ObjectId().toString(),
    email: "admin1@aiemgoa.ac.in",
    username: "admin1",
    role: "ADMIN",
  });

  // 1. Unauthenticated request to /api/staff
  {
    const req = new NextRequest("http://localhost:3000/api/staff/items");
    const res = await middleware(req);
    assert(res.status === 401, "Unauthenticated /api/staff request returns 401");
    const json = await res.json();
    assert(
      json.success === false && json.error?.code === "UNAUTHORIZED",
      "Unauthenticated /api/staff returns structured UNAUTHORIZED envelope"
    );
  }

  // 2. Unauthenticated request to /api/admin
  {
    const req = new NextRequest("http://localhost:3000/api/admin/users");
    const res = await middleware(req);
    assert(res.status === 401, "Unauthenticated /api/admin request returns 401");
    const json = await res.json();
    assert(
      json.success === false && json.error?.code === "UNAUTHORIZED",
      "Unauthenticated /api/admin returns structured UNAUTHORIZED envelope"
    );
  }

  // 3. STUDENT (non-operations) requesting /api/staff -> 403 FORBIDDEN
  {
    const req = new NextRequest("http://localhost:3000/api/staff/custody", {
      headers: { cookie: `aiem_session=${studentToken}` },
    });
    const res = await middleware(req);
    assert(res.status === 403, "Student requesting /api/staff returns 403");
    const json = await res.json();
    assert(
      json.success === false && json.error?.code === "FORBIDDEN",
      "Student requesting /api/staff returns structured FORBIDDEN envelope"
    );
  }

  // 4. STUDENT requesting /staff page -> redirects to /dashboard?error=unauthorized_role
  {
    const req = new NextRequest("http://localhost:3000/staff/intake", {
      headers: { cookie: `aiem_session=${studentToken}` },
    });
    const res = await middleware(req);
    assert(
      res.status === 307 || res.status === 302,
      "Student requesting /staff page redirects"
    );
    assert(
      Boolean(res.headers.get("location")?.includes("unauthorized_role")),
      "Student requesting /staff page redirected with unauthorized_role parameter"
    );
  }

  // 5. Unauthenticated request to /staff page -> redirects to login with redirect param
  {
    const req = new NextRequest("http://localhost:3000/staff/intake");
    const res = await middleware(req);
    assert(
      Boolean(res.headers.get("location")?.includes("/login?redirect=")),
      "Unauthenticated /staff request redirects to login"
    );
  }

  // 6. SAFE_DESK_STAFF requesting /api/staff -> allowed (NextResponse.next() status 200)
  {
    const req = new NextRequest("http://localhost:3000/api/staff/items", {
      headers: { cookie: `aiem_session=${staffToken}` },
    });
    const res = await middleware(req);
    assert(res.status === 200, "SAFE_DESK_STAFF authorized for /api/staff");
  }

  // 7. MODERATOR requesting /api/staff -> allowed
  {
    const req = new NextRequest("http://localhost:3000/api/staff/items", {
      headers: { cookie: `aiem_session=${moderatorToken}` },
    });
    const res = await middleware(req);
    assert(res.status === 200, "MODERATOR authorized for /api/staff");
  }

  // 8. ADMIN requesting /api/staff -> allowed
  {
    const req = new NextRequest("http://localhost:3000/api/staff/items", {
      headers: { cookie: `aiem_session=${adminToken}` },
    });
    const res = await middleware(req);
    assert(res.status === 200, "ADMIN authorized for /api/staff");
  }
}

// ---------------------------------------------------------------------------
// SUITE 6: connectDB Runtime Environment Variable Safety Check
// ---------------------------------------------------------------------------
async function testConnectDbGuard() {
  console.log("\n─── Suite 6: connectDB Runtime Enforcement ───");

  const originalUri = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = "mongodb://malicious-external-host.com:27017/aiem_hunt";
    const res = executeSafetyGuard(process.env.MONGODB_URI, false);
    assert(
      res.exited && res.exitCode === 1,
      "connectDB safety validation strictly intercepts malicious MONGODB_URI environment variable before connection"
    );
  } finally {
    process.env.MONGODB_URI = originalUri;
  }
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------
async function runAllChallengerTests() {
  console.log("========================================================");
  console.log("⚡ AIEM HUNT — CHALLENGER 1 ADVERSARIAL VERIFICATION");
  console.log("========================================================");

  try {
    await testSafetyGuard();
    await testApiResponseConstructors();
    await testSquadMessageIdempotencyIndex();
    await testSchemaHardening();
    await testMiddlewareGuards();
    await testConnectDbGuard();

    console.log("\n========================================================");
    console.log(`SUMMARY: ${passedTests}/${totalTests} PASSED, ${failedTests} FAILED`);
    console.log("========================================================");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error("\n💥 Unhandled error in Challenger test suite:", err);
    process.exit(1);
  }
}

runAllChallengerTests();

import mongoose, { Types } from "mongoose";
import * as crypto from "crypto";
import { NextRequest } from "next/server";
import { middleware, config as middlewareConfig } from "../middleware";
import { signSessionToken, UserRole } from "../lib/jwt";
import { ClaimRequest, SquadMember, SquadMessage } from "../models";
import { assertSafeConnectionUri, connectDB } from "../lib/db";
import { apiSuccess, apiError } from "../lib/api-response";

// Enforce parsed connection URI validation
const RUN_ID = `aiem_hunt_test_challenger2_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function createMockToken(role: UserRole): Promise<string> {
  return await signSessionToken({
    userId: new Types.ObjectId().toString(),
    email: `test_${role.toLowerCase()}@aiemgoa.ac.in`,
    username: `user_${role.toLowerCase()}`,
    role,
  });
}

function createRequest(path: string, token?: string): NextRequest {
  const url = `http://localhost:3000${path}`;
  const headers = new Headers();
  if (token) {
    headers.set("cookie", `aiem_session=${token}`);
  }
  return new NextRequest(url, { headers });
}

async function runChallengerTests() {
  console.log("\n========================================================");
  console.log("🛡️  CHALLENGER 2: EMPIRICAL STRESS TEST & VERIFICATION HARNESS");
  console.log(`   Target DB: mongodb://127.0.0.1:27017/[REDACTED_TEST_DB]`);
  console.log("========================================================\n");

  // =========================================================================
  // SUITE 1: MIDDLEWARE ROUTING, GUARDS & ERROR ENVELOPES
  // =========================================================================
  console.log("─── Suite 1: Middleware Routing, Guards & Error Envelopes ───");

  // 1.1 Matcher configuration
  assert(
    middlewareConfig.matcher.includes("/staff/:path*"),
    "Middleware config.matcher explicitly includes '/staff/:path*'"
  );
  assert(
    middlewareConfig.matcher.includes("/api/staff/:path*"),
    "Middleware config.matcher explicitly includes '/api/staff/:path*'"
  );

  // 1.2 Anonymous requests to /api/staff endpoints -> 401 with structured JSON envelope
  const anonApiReq1 = createRequest("/api/staff");
  const anonApiRes1 = await middleware(anonApiReq1);
  assert(anonApiRes1.status === 401, "Anonymous GET /api/staff returns HTTP 401");
  const anonApiJson1 = await anonApiRes1.json();
  assert(
    anonApiJson1.success === false &&
      anonApiJson1.error?.code === "UNAUTHORIZED" &&
      anonApiJson1.error?.message === "Authentication required.",
    "Anonymous /api/staff returns structured error envelope: { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }"
  );

  const anonApiReq2 = createRequest("/api/staff/handover/verify");
  const anonApiRes2 = await middleware(anonApiReq2);
  assert(anonApiRes2.status === 401, "Anonymous GET /api/staff/handover/verify returns HTTP 401");
  const anonApiJson2 = await anonApiRes2.json();
  assert(
    anonApiJson2.success === false && anonApiJson2.error?.code === "UNAUTHORIZED",
    "Subpath /api/staff/handover/verify returns structured 401 UNAUTHORIZED envelope"
  );

  // 1.3 Student role requests to /api/staff endpoints -> 403 with structured JSON envelope
  const studentToken = await createMockToken("STUDENT");
  const studentApiReq1 = createRequest("/api/staff", studentToken);
  const studentApiRes1 = await middleware(studentApiReq1);
  assert(studentApiRes1.status === 403, "Student GET /api/staff returns HTTP 403");
  const studentApiJson1 = await studentApiRes1.json();
  assert(
    studentApiJson1.success === false &&
      studentApiJson1.error?.code === "FORBIDDEN" &&
      studentApiJson1.error?.message === "Forbidden: Operations access required.",
    "Student /api/staff returns structured error envelope: { success: false, error: { code: 'FORBIDDEN', message: 'Forbidden: Operations access required.' } }"
  );

  const studentApiReq2 = createRequest("/api/staff/custody/receipts", studentToken);
  const studentApiRes2 = await middleware(studentApiReq2);
  assert(studentApiRes2.status === 403, "Student GET /api/staff/custody/receipts returns HTTP 403");
  const studentApiJson2 = await studentApiRes2.json();
  assert(
    studentApiJson2.success === false && studentApiJson2.error?.code === "FORBIDDEN",
    "Subpath /api/staff/custody/receipts returns structured 403 FORBIDDEN envelope"
  );

  // 1.4 Operations staff roles allowed through /api/staff
  const staffToken = await createMockToken("SAFE_DESK_STAFF");
  const staffApiReq = createRequest("/api/staff/queue", staffToken);
  const staffApiRes = await middleware(staffApiReq);
  assert(staffApiRes.status === 200, "Safe-Desk Staff GET /api/staff/queue allowed through (HTTP 200/next)");

  const modToken = await createMockToken("MODERATOR");
  const modApiReq = createRequest("/api/staff/queue", modToken);
  const modApiRes = await middleware(modApiReq);
  assert(modApiRes.status === 200, "Moderator GET /api/staff/queue allowed through (HTTP 200/next)");

  const adminToken = await createMockToken("ADMIN");
  const adminApiReq = createRequest("/api/staff/queue", adminToken);
  const adminApiRes = await middleware(adminApiReq);
  assert(adminApiRes.status === 200, "Admin GET /api/staff/queue allowed through (HTTP 200/next)");

  // 1.5 Anonymous requests to /staff -> Redirect to /login
  const anonPageReq1 = createRequest("/staff");
  const anonPageRes1 = await middleware(anonPageReq1);
  assert(
    anonPageRes1.status === 307 || anonPageRes1.status === 308,
    `Anonymous GET /staff redirects with status ${anonPageRes1.status}`
  );
  const redirectUrl1 = anonPageRes1.headers.get("location") || "";
  assert(
    redirectUrl1.includes("/login?redirect=%2Fstaff"),
    `Anonymous /staff redirects to login with return path: ${redirectUrl1}`
  );

  const anonPageReq2 = createRequest("/staff/custody/intake");
  const anonPageRes2 = await middleware(anonPageReq2);
  const redirectUrl2 = anonPageRes2.headers.get("location") || "";
  assert(
    redirectUrl2.includes("/login?redirect=%2Fstaff%2Fcustody%2Fintake"),
    `Anonymous /staff/custody/intake preserves subpath in login redirect: ${redirectUrl2}`
  );

  // 1.6 Student role requests to /staff -> Redirect to /dashboard?error=unauthorized_role
  const studentPageReq1 = createRequest("/staff", studentToken);
  const studentPageRes1 = await middleware(studentPageReq1);
  assert(
    studentPageRes1.status === 307 || studentPageRes1.status === 308,
    `Student GET /staff redirects with status ${studentPageRes1.status}`
  );
  const studentRedirect1 = studentPageRes1.headers.get("location") || "";
  assert(
    studentRedirect1.includes("/dashboard?error=unauthorized_role"),
    `Student /staff redirected to dashboard with unauthorized_role: ${studentRedirect1}`
  );

  const studentPageReq2 = createRequest("/staff/queue", studentToken);
  const studentPageRes2 = await middleware(studentPageReq2);
  const studentRedirect2 = studentPageRes2.headers.get("location") || "";
  assert(
    studentRedirect2.includes("/dashboard?error=unauthorized_role"),
    `Student /staff/queue redirected to dashboard with unauthorized_role: ${studentRedirect2}`
  );

  // 1.7 Operations staff roles allowed through /staff
  const staffPageReq = createRequest("/staff", staffToken);
  const staffPageRes = await middleware(staffPageReq);
  assert(staffPageRes.status === 200, "Safe-Desk Staff GET /staff allowed through (HTTP 200/next)");

  const modPageReq = createRequest("/staff/intake", modToken);
  const modPageRes = await middleware(modPageReq);
  assert(modPageRes.status === 200, "Moderator GET /staff/intake allowed through (HTTP 200/next)");

  const adminPageReq = createRequest("/staff", adminToken);
  const adminPageRes = await middleware(adminPageReq);
  assert(adminPageRes.status === 200, "Admin GET /staff allowed through (HTTP 200/next)");

  // 1.8 Adversarial: Malformed / Tampered JWT Cookie
  const badTokenReq1 = createRequest("/api/staff", "gibberish.invalid.jwt.token");
  const badTokenRes1 = await middleware(badTokenReq1);
  assert(badTokenRes1.status === 401, "Malformed JWT to /api/staff fails verification and returns HTTP 401");

  const badTokenReq2 = createRequest("/staff", "gibberish.invalid.jwt.token");
  const badTokenRes2 = await middleware(badTokenReq2);
  const badTokenRedirect = badTokenRes2.headers.get("location") || "";
  assert(
    badTokenRedirect.includes("/login?redirect=%2Fstaff"),
    "Malformed JWT to /staff redirects to login"
  );

  // =========================================================================
  // SUITE 2: CLAIM REQUEST SCHEMA VALIDATION & LOCKOUT ATTRIBUTES
  // =========================================================================
  console.log("\n─── Suite 2: ClaimRequestSchema Status Enum & Lockout Fields ───");

  const dummyItemId = new Types.ObjectId();
  const dummyClaimantId = new Types.ObjectId();
  const dummyCounterpartyId = new Types.ObjectId();

  const validBaseClaim = {
    itemType: "FOUND" as const,
    itemId: dummyItemId,
    claimantId: dummyClaimantId,
    counterpartyUserId: dummyCounterpartyId,
    submittedAnswer: "Blue leather case with initials VG",
  };

  // 2.1 Rejection of "LOCKED" as top-level status
  const lockedStatusClaim = new ClaimRequest({
    ...validBaseClaim,
    status: "LOCKED",
  });
  const lockedValidationError = lockedStatusClaim.validateSync();
  assert(
    Boolean(lockedValidationError?.errors["status"]),
    "ClaimRequestSchema synchronously rejects status 'LOCKED' with a ValidationError"
  );
  assert(
    lockedValidationError?.errors["status"]?.kind === "enum",
    "ClaimRequestSchema status error is strictly an enum rejection"
  );

  // 2.2 Acceptance of all 5 canonical statuses
  const canonicalStatuses = ["PENDING", "APPROVED", "HANDOVER_COMPLETE", "REJECTED", "DISPUTED"] as const;
  for (const status of canonicalStatuses) {
    const claim = new ClaimRequest({
      ...validBaseClaim,
      status,
    });
    const err = claim.validateSync();
    assert(!err?.errors["status"], `ClaimRequestSchema accepts canonical status '${status}'`);
  }

  // 2.3 Rejection of arbitrary unapproved status strings
  const arbitraryClaim = new ClaimRequest({
    ...validBaseClaim,
    status: "INVALID_STATUS_CODE",
  });
  const arbitraryErr = arbitraryClaim.validateSync();
  assert(
    Boolean(arbitraryErr?.errors["status"]),
    "ClaimRequestSchema rejects unknown status 'INVALID_STATUS_CODE'"
  );

  // 2.4 Lockout fields: lockoutUntil and handoverLocked
  const freshClaim = new ClaimRequest({
    ...validBaseClaim,
  });
  assert(freshClaim.handoverLocked === false, "handoverLocked defaults to false");
  assert(freshClaim.lockoutUntil === null, "lockoutUntil defaults to null");

  // 2.5 Verification of Brief §2 Invariant:
  // PIN lockout is tracked via independent fields (handoverLocked: true, lockoutUntil: Date) while status remains APPROVED
  const lockoutDate = new Date(Date.now() + 15 * 60 * 1000);
  const activeLockedClaim = new ClaimRequest({
    ...validBaseClaim,
    status: "APPROVED",
    handoverLocked: true,
    handoverAttempts: 5,
    lockoutUntil: lockoutDate,
  });
  const activeLockedErr = activeLockedClaim.validateSync();
  assert(
    activeLockedErr === undefined,
    "Claim with status: 'APPROVED', handoverLocked: true, and lockoutUntil Date validates cleanly"
  );
  assert(
    activeLockedClaim.lockoutUntil?.getTime() === lockoutDate.getTime(),
    "lockoutUntil accurately preserves timestamp value"
  );

  // 2.6 LockoutUntil type coercion & rejection of invalid types
  const badDateClaim = new ClaimRequest({
    ...validBaseClaim,
    lockoutUntil: "not-a-valid-date-string",
  });
  const badDateErr = badDateClaim.validateSync();
  assert(
    Boolean(badDateErr?.errors["lockoutUntil"]),
    "lockoutUntil rejects non-date string with CastError"
  );

  // =========================================================================
  // SUITE 3: SQUAD ROLE ENUM NORMALIZATION & SQUAD SCHEMAS
  // =========================================================================
  console.log("\n─── Suite 3: SquadRole Enum Normalization & Rejection of Legacy OFFICER ───");

  const dummySquadId = new Types.ObjectId();
  const dummyUserId = new Types.ObjectId();

  // 3.1 Rejection of "OFFICER" in SquadMemberSchema.role
  const officerMember = new SquadMember({
    squadId: dummySquadId,
    userId: dummyUserId,
    role: "OFFICER",
  });
  const officerErr = officerMember.validateSync();
  assert(
    Boolean(officerErr?.errors["role"]),
    "SquadMemberSchema.role synchronously rejects legacy role 'OFFICER' with ValidationError"
  );
  assert(
    officerErr?.errors["role"]?.kind === "enum",
    "SquadMemberSchema.role error is strictly an enum rejection"
  );

  // 3.2 Rejection of "OFFICER" in SquadMemberSchema.squadRole
  const officerSquadRoleMember = new SquadMember({
    squadId: dummySquadId,
    userId: dummyUserId,
    squadRole: "OFFICER",
  });
  const officerSquadRoleErr = officerSquadRoleMember.validateSync();
  assert(
    Boolean(officerSquadRoleErr?.errors["squadRole"]),
    "SquadMemberSchema.squadRole synchronously rejects legacy role 'OFFICER' with ValidationError"
  );
  assert(
    officerSquadRoleErr?.errors["squadRole"]?.kind === "enum",
    "SquadMemberSchema.squadRole error is strictly an enum rejection"
  );

  // 3.3 Acceptance of 4 Canonical Squad Roles
  const canonicalSquadRoles = ["LEADER", "COLEADER", "ELDER", "MEMBER"] as const;
  for (const r of canonicalSquadRoles) {
    const member = new SquadMember({
      squadId: dummySquadId,
      userId: dummyUserId,
      role: r,
      squadRole: r,
    });
    const err = member.validateSync();
    assert(
      !err?.errors["role"] && !err?.errors["squadRole"],
      `SquadMemberSchema accepts canonical role '${r}' on both role and squadRole paths`
    );
  }

  // 3.4 Default role values
  const defaultMember = new SquadMember({
    squadId: dummySquadId,
    userId: dummyUserId,
  });
  assert(defaultMember.role === "MEMBER", "SquadMemberSchema.role defaults to 'MEMBER'");
  assert(defaultMember.squadRole === "MEMBER", "SquadMemberSchema.squadRole defaults to 'MEMBER'");

  // 3.5 Rejection of unauthorized roles
  const badRoleMember = new SquadMember({
    squadId: dummySquadId,
    userId: dummyUserId,
    role: "SUPER_ADMIN",
  });
  const badRoleErr = badRoleMember.validateSync();
  assert(Boolean(badRoleErr?.errors["role"]), "SquadMemberSchema rejects unauthorized role 'SUPER_ADMIN'");

  // 3.6 SquadMessage unique compound index validation
  const messageIndexes = SquadMessage.schema.indexes();
  const compoundIdempotencyIndex = messageIndexes.find((idx) => {
    const keys = Object.keys(idx[0]);
    return keys.includes("squadId") && keys.includes("senderId") && keys.includes("requestId");
  });
  assert(
    compoundIdempotencyIndex !== undefined,
    "SquadMessageSchema defines compound index on { squadId, senderId, requestId }"
  );
  assert(
    compoundIdempotencyIndex?.[1]?.unique === true,
    "SquadMessage compound idempotency index has unique: true"
  );

  // =========================================================================
  // SUITE 4: DATABASE PERSISTENCE IN EPHEMERAL TEST DATABASE
  // =========================================================================
  console.log("\n─── Suite 4: MongoDB Persistence & Strict Validation on Mutation ───");

  await connectDB();
  const dbName = mongoose.connection.db?.databaseName;
  assert(
    Boolean(dbName && dbName.startsWith("aiem_hunt_test_")),
    `Connected strictly to disposable test database: ${dbName}`
  );

  // 4.1 Persistence of valid ClaimRequest with lockout fields
  const dbClaim = await ClaimRequest.create({
    ...validBaseClaim,
    status: "APPROVED",
    handoverLocked: true,
    handoverAttempts: 5,
    lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
  });
  assert(Boolean(dbClaim._id), "Successfully saved ClaimRequest with status 'APPROVED' and lockout fields");

  const fetchedClaim = await ClaimRequest.findById(dbClaim._id);
  assert(fetchedClaim?.status === "APPROVED", "Fetched claim retains status 'APPROVED'");
  assert(fetchedClaim?.handoverLocked === true, "Fetched claim retains handoverLocked === true");
  assert(fetchedClaim?.lockoutUntil instanceof Date, "Fetched claim retains lockoutUntil as Date instance");

  // 4.2 Database-level rejection on creation with status 'LOCKED'
  let dbLockedBlocked = false;
  try {
    await ClaimRequest.create({
      ...validBaseClaim,
      status: "LOCKED",
    });
  } catch (err: any) {
    dbLockedBlocked = err.name === "ValidationError";
  }
  assert(dbLockedBlocked, "Mongoose .create() strictly blocks status: 'LOCKED' at DB validation level");

  // 4.3 Database-level rejection on creation of SquadMember with role 'OFFICER'
  let dbOfficerBlocked = false;
  try {
    await SquadMember.create({
      squadId: dummySquadId,
      userId: dummyUserId,
      role: "OFFICER",
    });
  } catch (err: any) {
    dbOfficerBlocked = err.name === "ValidationError";
  }
  assert(dbOfficerBlocked, "Mongoose .create() strictly blocks role: 'OFFICER' at DB validation level");

  // 4.4 Database-level persistence of normalized COLEADER
  const coleaderMember = await SquadMember.create({
    squadId: dummySquadId,
    userId: dummyUserId,
    role: "COLEADER",
    squadRole: "COLEADER",
  });
  assert(coleaderMember.role === "COLEADER", "Successfully persisted normalized COLEADER member to database");

  // =========================================================================
  // SUITE 5: API RESPONSE STANDARDIZATION & PARSED URI VALIDATOR
  // =========================================================================
  console.log("\n─── Suite 5: API Response Standardization & Parsed URI Validator ───");

  // 5.1 apiSuccess
  const successRes = apiSuccess({ itemCode: "ABC-123" }, 201, { page: 1, total: 1 });
  assert(successRes.status === 201, "apiSuccess sets custom status code 201");
  const successBody = await successRes.json();
  assert(
    successBody.success === true &&
      successBody.data?.itemCode === "ABC-123" &&
      successBody.meta?.page === 1,
    "apiSuccess produces standardized envelope: { success: true, data, meta }"
  );

  // 5.2 apiError
  const errorRes = apiError("FORBIDDEN_ZONE", "Access to safe station restricted", 403, "req-999");
  assert(errorRes.status === 403, "apiError sets status code 403");
  const errorBody = await errorRes.json();
  assert(
    errorBody.success === false &&
      errorBody.error?.code === "FORBIDDEN_ZONE" &&
      errorBody.error?.message === "Access to safe station restricted" &&
      errorBody.error?.requestId === "req-999",
    "apiError produces standardized envelope: { success: false, error: { code, message, requestId } }"
  );

  // 5.3 assertSafeConnectionUri positive and negative testing
  let validPassed = false;
  try {
    assertSafeConnectionUri("mongodb://127.0.0.1:27017/aiem_hunt", false);
    assertSafeConnectionUri("mongodb://localhost:27017/aiem_hunt", false);
    assertSafeConnectionUri("mongodb://127.0.0.1:27017/aiem_hunt_test_run1", true);
    validPassed = true;
  } catch {
    validPassed = false;
  }
  assert(validPassed, "assertSafeConnectionUri accepts valid loopback URIs and test database prefixes");

  // Clean up disposable database
  console.log(`\n🧹 Dropping ephemeral test database: ${dbName}...`);
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
  console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.\n");

  console.log("========================================================");
  console.log(`🎉 EMPIRICAL VERIFICATION COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runChallengerTests().catch((err) => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});

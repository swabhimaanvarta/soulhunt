import "./qa_env_init";
import mongoose, { Types } from "mongoose";
import * as crypto from "crypto";
import { NextRequest } from "next/server";
import { User, CampusLocation, LostItem, FoundItem, ClaimRequest } from "../models";
import { assertSafeConnectionUri, connectDB } from "../lib/db";
import { signSessionToken } from "../lib/jwt";
import { GET as getAdminItems } from "../app/api/admin/items/route";
import { GET as getAdminQueues } from "../app/api/admin/queues/route";
import { GET as getStaffQueue } from "../app/api/staff/queue/route";

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
  return workUnitAsyncStorage.run(store, fn) as Promise<any>;
}

const RUN_ID = `aiem_hunt_test_pagination_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

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

async function runTests() {
  console.log("\n========================================================");
  console.log("📄 AIEM HUNT — DATABASE-LEVEL PAGINATION QA HARNESS");
  console.log(`   Target DB: mongodb://127.0.0.1:27017/${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  // Seed Users
  const adminUser = await User.create({
    displayName: "Admin Pagination Tester",
    username: "admin_paged",
    email: "admin_paged@aiemgoa.ac.in",
    passwordHash: "dummyhash",
    role: "ADMIN",
    accountStatus: "ACTIVE",
    department: "ADMINISTRATION",
  });

  const staffUser = await User.create({
    displayName: "Staff Pagination Tester",
    username: "staff_paged",
    email: "staff_paged@aiemgoa.ac.in",
    passwordHash: "dummyhash",
    role: "SAFE_DESK_STAFF",
    accountStatus: "ACTIVE",
    department: "OPERATIONS",
  });

  const studentUser = await User.create({
    displayName: "Student Pagination Tester",
    username: "student_paged",
    email: "student_paged@aiemgoa.ac.in",
    passwordHash: "dummyhash",
    role: "STUDENT",
    accountStatus: "ACTIVE",
    department: "CSE",
  });

  // Seed Campus Locations
  const stationA = await CampusLocation.create({
    name: "Safe-Desk Main A",
    code: "STA_PAGED_A",
    building: "Academic Core A",
    zoneType: "ACADEMIC_BLOCK",
    coordinates: { lat: 15.2993, lng: 73.98, mapX: 200, mapY: 300 },
    isSafeDesk: true,
    operatingHours: "08:00 AM - 06:00 PM",
  });

  // Assign staff to stationA
  staffUser.assignedStationId = stationA._id;
  await staffUser.save();

  function createReq(urlPath: string): NextRequest {
    return new NextRequest(`http://localhost:3000${urlPath}`);
  }

  // ─── Phase 1: Test Empty Database Behavior ───
  console.log("─── Phase 1: Empty Collections Aggregation Resilience ───");

  {
    const req = createReq("/api/admin/items?type=ALL&page=1&limit=10");
    const res = await withUser(adminUser, () => getAdminItems(req));
    assert(res.status === 200, "Admin items returns 200 on empty collection");
    const json = await res.json();
    assert(json.success === true, "Admin items returns success: true on empty database");
    assert(Array.isArray(json.data) && json.data.length === 0, "Admin items returns empty array when no items exist");
    assert(json.pagination?.total === 0, "Admin items reports total = 0");
    assert(json.pagination?.totalPages === 0, "Admin items reports totalPages = 0");
  }

  {
    const req = createReq("/api/admin/queues?queue=reports_review&page=1&limit=10");
    const res = await withUser(adminUser, () => getAdminQueues(req));
    assert(res.status === 200, "Admin reports_review returns 200 on empty collection");
    const json = await res.json();
    assert(json.success === true, "Admin reports_review returns success: true on empty database");
    assert(Array.isArray(json.data) && json.data.length === 0, "Admin reports_review returns empty array on empty database");
    assert(json.pagination?.total === 0, "Admin reports_review reports total = 0");
  }

  {
    const req = createReq("/api/staff/queue?page=1&limit=10");
    const res = await withUser(staffUser, () => getStaffQueue(req));
    assert(res.status === 200, "Staff queue returns 200 on empty collection");
    const json = await res.json();
    assert(json.success === true, "Staff queue returns success: true on empty database");
    assert(Array.isArray(json.data?.items) && json.data.items.length === 0, "Staff queue returns empty items on empty database");
    assert(json.data?.total === 0, "Staff queue reports total = 0");
  }

  // ─── Phase 2: Seed Test Items with Specific Timestamps ───
  console.log("\n─── Phase 2: Seed Test Items for Multi-Collection Pagination ───");

  const now = Date.now();

  // Create 3 Lost Items (staggered createdAt: 5m ago, 3m ago, 1m ago)
  const lost1 = await LostItem.create({
    reporterId: studentUser._id,
    title: "Oldest Lost Blue Backpack",
    shortTitle: "Blue Backpack",
    category: "BAGS_WALLETS",
    publicDescription: "A blue backpack with textbooks",
    lostAt: new Date(now - 300000),
    lastKnownLocationId: stationA._id,
    status: "SUBMITTED",
    createdAt: new Date(now - 300000),
  });

  const lost2 = await LostItem.create({
    reporterId: studentUser._id,
    title: "Middle Lost Silver Watch",
    shortTitle: "Silver Watch",
    category: "ACCESSORIES",
    publicDescription: "Analog silver wristwatch",
    lostAt: new Date(now - 180000),
    lastKnownLocationId: stationA._id,
    status: "SUBMITTED",
    createdAt: new Date(now - 180000),
  });

  const lost3 = await LostItem.create({
    reporterId: studentUser._id,
    title: "Newest Lost Black Laptop",
    shortTitle: "Black Laptop",
    category: "ELECTRONICS",
    publicDescription: "ThinkPad with stickers",
    lostAt: new Date(now - 60000),
    lastKnownLocationId: stationA._id,
    status: "UNDER_REVIEW",
    createdAt: new Date(now - 60000),
  });

  // Create 3 Found Items (staggered createdAt: 4m ago, 2m ago, 0m ago)
  const found1 = await FoundItem.create({
    finderId: studentUser._id,
    title: "Found Red Umbrella",
    shortTitle: "Red Umbrella",
    category: "OTHER",
    publicDescription: "Red fold-up umbrella near foyer",
    foundAt: new Date(now - 240000),
    foundLocationId: stationA._id,
    safeDeskLocationId: stationA._id,
    custodyStatus: "DEPOSITED_AT_SAFE_DESK",
    lockerReceiptCode: "REC-PAGED-001",
    status: "SUBMITTED",
    createdAt: new Date(now - 240000),
    updatedAt: new Date(now - 240000),
  });

  const found2 = await FoundItem.create({
    finderId: studentUser._id,
    title: "Found Calculator TI-84",
    shortTitle: "Graphing Calculator",
    category: "ELECTRONICS",
    publicDescription: "Black graphing calculator",
    foundAt: new Date(now - 120000),
    foundLocationId: stationA._id,
    safeDeskLocationId: stationA._id,
    custodyStatus: "DEPOSITED_AT_SAFE_DESK",
    lockerReceiptCode: "REC-PAGED-002",
    status: "SUBMITTED",
    createdAt: new Date(now - 120000),
    updatedAt: new Date(now - 120000),
  });

  const found3 = await FoundItem.create({
    finderId: studentUser._id,
    title: "Found Wireless Earbuds",
    shortTitle: "Earbuds Case",
    category: "ELECTRONICS",
    publicDescription: "White earbud charging case",
    foundAt: new Date(now),
    foundLocationId: stationA._id,
    safeDeskLocationId: stationA._id,
    custodyStatus: "DEPOSITED_AT_SAFE_DESK",
    lockerReceiptCode: "REC-PAGED-003",
    status: "SUBMITTED",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });

  // Interleaved timeline (newest to oldest):
  // 1. found3 (now)
  // 2. lost3   (now - 60s)
  // 3. found2 (now - 120s)
  // 4. lost2   (now - 180s)
  // 5. found1 (now - 240s)
  // 6. lost1   (now - 300s)

  assert(Boolean(lost1._id && found1._id), "Successfully seeded 3 LostItems and 3 FoundItems");

  // ─── Phase 3: Verify GET /api/admin/items Pagination ───
  console.log("\n─── Phase 3: GET /api/admin/items $unionWith & Page Boundaries ───");

  // Page 1 with limit 2: should return found3 and lost3
  {
    const req = createReq("/api/admin/items?type=ALL&page=1&limit=2");
    const res = await withUser(adminUser, () => getAdminItems(req));
    assert(res.status === 200, "GET /api/admin/items?type=ALL returns HTTP 200");
    const json = await res.json();
    assert(json.data.length === 2, `Page 1 returns exactly limit=2 items (actual: ${json.data.length})`);
    assert(json.pagination.total === 6, `Total count is 6 (actual: ${json.pagination.total})`);
    assert(json.pagination.totalPages === 3, `Total pages is 3 (actual: ${json.pagination.totalPages})`);
    assert(json.data[0]._id.toString() === found3._id.toString(), "Item 1 is newest item (found3)");
    assert(json.data[0].reportType === "FOUND", "Item 1 has reportType: 'FOUND'");
    assert(json.data[0].finderId?.displayName === "Student Pagination Tester", "Item 1 finderId is populated");
    assert(json.data[1]._id.toString() === lost3._id.toString(), "Item 2 is second newest item (lost3)");
    assert(json.data[1].reportType === "LOST", "Item 2 has reportType: 'LOST'");
    assert(json.data[1].reporterId?.displayName === "Student Pagination Tester", "Item 2 reporterId is populated");
  }

  // Page 2 with limit 2: should return found2 and lost2
  {
    const req = createReq("/api/admin/items?type=ALL&page=2&limit=2");
    const res = await withUser(adminUser, () => getAdminItems(req));
    const json = await res.json();
    assert(json.data.length === 2, `Page 2 returns exactly limit=2 items (actual: ${json.data.length})`);
    assert(json.data[0]._id.toString() === found2._id.toString(), "Page 2 Item 1 is found2");
    assert(json.data[1]._id.toString() === lost2._id.toString(), "Page 2 Item 2 is lost2");
  }

  // Page 3 with limit 2: should return found1 and lost1
  {
    const req = createReq("/api/admin/items?type=ALL&page=3&limit=2");
    const res = await withUser(adminUser, () => getAdminItems(req));
    const json = await res.json();
    assert(json.data.length === 2, `Page 3 returns exactly limit=2 items (actual: ${json.data.length})`);
    assert(json.data[0]._id.toString() === found1._id.toString(), "Page 3 Item 1 is found1");
    assert(json.data[1]._id.toString() === lost1._id.toString(), "Page 3 Item 2 is lost1");
  }

  // Page 4 with limit 2: beyond range -> returns empty array, preserves total
  {
    const req = createReq("/api/admin/items?type=ALL&page=4&limit=2");
    const res = await withUser(adminUser, () => getAdminItems(req));
    const json = await res.json();
    assert(json.data.length === 0, `Page 4 beyond range returns empty array (actual: ${json.data.length})`);
    assert(json.pagination.total === 6, "Page 4 beyond range retains correct total=6");
  }

  // Specific type filter type=LOST with limit 2
  {
    const req = createReq("/api/admin/items?type=LOST&page=1&limit=2");
    const res = await withUser(adminUser, () => getAdminItems(req));
    const json = await res.json();
    assert(json.data.length === 2, "type=LOST returns limit=2 items");
    assert(json.pagination.total === 3, "type=LOST reports total=3");
    assert(json.data.every((i: any) => i.reportType === "LOST"), "All returned items have reportType: 'LOST'");
  }

  // Specific type filter type=FOUND with limit 2
  {
    const req = createReq("/api/admin/items?type=FOUND&page=1&limit=2");
    const res = await withUser(adminUser, () => getAdminItems(req));
    const json = await res.json();
    assert(json.data.length === 2, "type=FOUND returns limit=2 items");
    assert(json.pagination.total === 3, "type=FOUND reports total=3");
    assert(json.data.every((i: any) => i.reportType === "FOUND"), "All returned items have reportType: 'FOUND'");
  }

  // Search filter across merged collections
  {
    const req = createReq("/api/admin/items?type=ALL&search=Laptop");
    const res = await withUser(adminUser, () => getAdminItems(req));
    const json = await res.json();
    assert(json.data.length === 1, `Search 'Laptop' returns 1 matching item (actual: ${json.data.length})`);
    assert(json.data[0].title === "Newest Lost Black Laptop", "Search accurately matched Black Laptop");
    assert(json.pagination.total === 1, "Search pagination reports total=1");
  }

  // ─── Phase 4: Verify GET /api/admin/queues Pagination ───
  console.log("\n─── Phase 4: GET /api/admin/queues reports_review Pagination ───");

  {
    // All 6 items have status SUBMITTED or UNDER_REVIEW
    const req = createReq("/api/admin/queues?queue=reports_review&page=1&limit=3");
    const res = await withUser(adminUser, () => getAdminQueues(req));
    assert(res.status === 200, "GET /api/admin/queues?queue=reports_review returns HTTP 200");
    const json = await res.json();
    assert(json.data.length === 3, `Page 1 of reports_review returns limit=3 items (actual: ${json.data.length})`);
    assert(json.pagination.total === 6, `reports_review reports total=6 (actual: ${json.pagination.total})`);
    assert(json.pagination.totalPages === 2, `reports_review reports totalPages=2`);

    // Verify sort order: newest first
    assert(json.data[0]._id.toString() === found3._id.toString(), "reports_review Item 1 is newest (found3)");
    assert(json.data[1]._id.toString() === lost3._id.toString(), "reports_review Item 2 is lost3");
    assert(json.data[2]._id.toString() === found2._id.toString(), "reports_review Item 3 is found2");
  }

  {
    // Page 2 of reports_review
    const req = createReq("/api/admin/queues?queue=reports_review&page=2&limit=3");
    const res = await withUser(adminUser, () => getAdminQueues(req));
    const json = await res.json();
    assert(json.data.length === 3, `Page 2 of reports_review returns 3 items (actual: ${json.data.length})`);
    assert(json.data[0]._id.toString() === lost2._id.toString(), "reports_review Page 2 Item 1 is lost2");
    assert(json.data[1]._id.toString() === found1._id.toString(), "reports_review Page 2 Item 2 is found1");
    assert(json.data[2]._id.toString() === lost1._id.toString(), "reports_review Page 2 Item 3 is lost1");
  }

  // ─── Phase 5: Verify GET /api/staff/queue DB Pagination ───
  console.log("\n─── Phase 5: GET /api/staff/queue DB Pagination ───");

  {
    // 3 items have custodyStatus: "DEPOSITED_AT_SAFE_DESK" for stationA
    const req = createReq(`/api/staff/queue?stationId=${stationA._id}&page=1&limit=2`);
    const res = await withUser(staffUser, () => getStaffQueue(req));
    assert(res.status === 200, "GET /api/staff/queue returns HTTP 200");
    const json = await res.json();
    assert(json.success === true, "Staff queue returns success: true");
    assert(json.data.items.length === 2, `Staff queue page 1 returns limit=2 items (actual: ${json.data.items.length})`);
    assert(json.data.total === 3, `Staff queue reports total=3 in custody (actual: ${json.data.total})`);
    assert(json.data.pagination?.totalPages === 2, `Staff queue pagination.totalPages = 2`);
    assert(json.data.items[0].lockerReceiptCode === "REC-PAGED-003", "Staff queue item 1 has lockerReceiptCode REC-PAGED-003");
  }

  {
    // Page 2
    const req = createReq(`/api/staff/queue?stationId=${stationA._id}&page=2&limit=2`);
    const res = await withUser(staffUser, () => getStaffQueue(req));
    const json = await res.json();
    assert(json.data.items.length === 1, `Staff queue page 2 returns remaining 1 item (actual: ${json.data.items.length})`);
    assert(json.data.items[0].lockerReceiptCode === "REC-PAGED-001", "Staff queue page 2 item has lockerReceiptCode REC-PAGED-001");
  }

  // Clean up
  console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
  await mongoose.connection.dropDatabase();
  console.log("✨ Ephemeral test database dropped cleanly with zero remaining records.\n");

  console.log("========================================================");
  console.log(`🎉 ALL PAGINATION TESTS PASSED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

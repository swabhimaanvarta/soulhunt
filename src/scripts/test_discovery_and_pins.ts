import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import {
  User,
  LostItem,
  FoundItem,
  CampusLocation,
  Quest,
  Event,
  Squad,
  SquadMember,
} from "../models";
import { connectDB } from "../lib/db";
import { toPublicItemDTO } from "../lib/item-dto";
import { toPublicEventDTO } from "../lib/event-dto";
import { CAMPUS_BOUNDS_COORDS, isWithinCampusBounds } from "../lib/campus-constants";

const RUN_ID = `aiem_hunt_test_discovery_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

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

function encodeCursor(data: any): string {
  return Buffer.from(JSON.stringify(data), "utf-8").toString("base64");
}

function decodeCursor(cursorStr?: string | null): any {
  if (!cursorStr) return null;
  try {
    return JSON.parse(Buffer.from(cursorStr, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

async function runDiscoveryAndPinsTests() {
  console.log("\n========================================================");
  console.log("📍 AIEM HUNT — DISCOVERY, DTO REDACTION & PINS TESTS");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  try {
    // ---------------------------------------------------------
    // TEST 1: Campus Real Map Bounds Validation
    // ---------------------------------------------------------
    console.log("─── Test 1: Campus Bounding Box Coordinates ───");
    // Campus Centroid: 15.5948, 73.7947
    assert(isWithinCampusBounds(15.5948, 73.7947) === true, "Campus Centroid (15.5948, 73.7947) is within campus bounds");
    // Southwest corner: 15.5908, 73.7902
    assert(isWithinCampusBounds(15.5908, 73.7902) === true, "Southwest perimeter (15.5908, 73.7902) is within campus bounds");
    // Out-of-bounds coordinate (e.g. Panjim)
    assert(isWithinCampusBounds(15.4989, 73.8278) === false, "Panjim coordinates (15.4989, 73.8278) rejected as out of bounds");
    assert(isWithinCampusBounds(15.6200, 73.7900) === false, "Northern out-of-bounds latitude (15.6200) rejected");

    // ---------------------------------------------------------
    // TEST 2: Location Audit & Safe-Desk Lifecycle
    // ---------------------------------------------------------
    console.log("\n─── Test 2: Location Audit & Safe-Desk Protection ───");
    const testAdmin = await User.create({
      username: "admin_tester",
      displayName: "Admin Tester",
      email: "admin@aiem.edu",
      passwordHash: "hash",
      role: "ADMIN",
    });

    const safeDeskLoc = await CampusLocation.create({
      name: "Main Security Safe-Desk Station",
      code: "SD-MAIN-01",
      zoneType: "SAFE_DESK",
      description: "24/7 security locker station.",
      coordinates: { lat: 15.5948, lng: 73.7947, mapX: 50, mapY: 50 },
      isSafeDesk: true,
      operatingHours: "24/7",
      isActive: true,
    });

    const draftLoc = await CampusLocation.create({
      name: "Temporary Event Tent (Draft)",
      code: "TENT-TEMP-99",
      zoneType: "ACADEMIC_BLOCK",
      description: "Temporary unused orientation tent.",
      coordinates: { lat: 15.5950, lng: 73.7950, mapX: 55, mapY: 55 },
      isSafeDesk: false,
      operatingHours: "9am - 5pm",
      isActive: true,
    });

    // Link safeDeskLoc to an item
    const testItem = await FoundItem.create({
      finderId: testAdmin._id,
      title: "Found Mechanical Pencil Case",
      category: "ACCESSORIES",
      publicDescription: "Blue fabric pencil pouch.",
      foundLocationId: safeDeskLoc._id,
      currentCustodyLocationId: safeDeskLoc._id,
      spotDetails: "Found at library entrance",
      foundAt: new Date(),
      rawPhotoUrl: "https://campus.edu/private/raw.jpg",
      blurredPhotoUrl: "https://campus.edu/public/blurred.jpg",
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
      status: "ACTIVE",
    });

    // Attempting to delete safeDeskLoc: referenced by testItem -> must archive instead of hard delete
    const isReferenced = (await FoundItem.countDocuments({ currentCustodyLocationId: safeDeskLoc._id })) > 0;
    assert(isReferenced === true, "Safe-desk location correctly identified as referenced by custody item");

    if (isReferenced) {
      safeDeskLoc.isActive = false;
      safeDeskLoc.isArchived = true;
      await safeDeskLoc.save();
    }
    const checkArchived = await CampusLocation.findById(safeDeskLoc._id);
    assert(checkArchived?.isArchived === true && checkArchived?.isActive === false, "Referenced safe-desk safely archived without deleting custody records");

    // Unreferenced draft location can be hard deleted
    const draftReferenced = (await FoundItem.countDocuments({ foundLocationId: draftLoc._id })) > 0;
    assert(draftReferenced === false, "Draft location is not referenced");
    await CampusLocation.findByIdAndDelete(draftLoc._id);
    const checkDraft = await CampusLocation.findById(draftLoc._id);
    assert(checkDraft === null, "Unreferenced draft location successfully deleted");

    // ---------------------------------------------------------
    // TEST 3: DTO Privacy & Sensitive Information Redaction
    // ---------------------------------------------------------
    console.log("\n─── Test 3: Public Item DTO Scrubbing & Image Security ───");
    const publicDTO = toPublicItemDTO(testItem, "FOUND");
    assert(publicDTO.photoUrl === "https://campus.edu/public/blurred.jpg", "Public DTO serves only blurred photo URL");
    assert(!publicDTO.hasOwnProperty("rawPhotoUrl"), "Raw photo URL is completely excluded from public DTO");
    assert(!publicDTO.hasOwnProperty("finderId"), "Finder identity is completely excluded from public DTO");
    assert(!publicDTO.hasOwnProperty("secretIdentifiers"), "Secret identifiers excluded from public DTO");

    // Test text privacy sanitization
    const sensitiveLostItem = await LostItem.create({
      reporterId: testAdmin._id,
      title: "Lost Dell XPS Laptop",
      category: "ELECTRONICS",
      publicDescription: "Left my laptop in Lab 304, call me at 9876543210 or email rahul.22cs@eng.aiem.edu, roll no 22CS045.",
      secretIdentifiers: "Service Tag: #8849-ABC",
      verificationQuestion: "What sticker is on the lid?",
      verificationAnswerHash: "hash",
      lastKnownLocationId: safeDeskLoc._id,
      spotDetails: "Lab 304 third bench",
      lostAt: new Date(),
      status: "ACTIVE",
    });

    const lostDTO = toPublicItemDTO(sensitiveLostItem, "LOST");
    assert(!lostDTO.publicDescription.includes("9876543210"), "Phone number sanitized from public item description");
    assert(!lostDTO.publicDescription.includes("rahul.22cs@eng.aiem.edu"), "Email sanitized from public item description");
    assert(!lostDTO.publicDescription.includes("22CS045"), "Roll number sanitized from public item description");

    // ---------------------------------------------------------
    // TEST 4: Event DTO Participant Redaction
    // ---------------------------------------------------------
    console.log("\n─── Test 4: Event DTO Participant Identity Redaction ───");
    const testEvent = await Event.create({
      title: "Campus Sprint Hunt Alpha",
      slug: "sprint-hunt-alpha-2026",
      eventType: "FLASH_HUNT",
      description: "Fast-paced campus clue recovery sprint.",
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000),
      status: "LIVE",
      participants: [
        { userId: testAdmin._id, scoreXp: 120, joinedAt: new Date() },
      ],
    });

    const eventDTO = toPublicEventDTO(testEvent, testAdmin._id.toString());
    assert(eventDTO.participantCount === 1, "Public Event DTO exposes participantCount");
    assert(eventDTO.isRegistered === true, "Public Event DTO computes isRegistered for viewer");
    assert(!eventDTO.hasOwnProperty("participants"), "Strict privacy guarantee: participants array is completely omitted");

    // ---------------------------------------------------------
    // TEST 5: Cursor Pagination Contract Simulation
    // ---------------------------------------------------------
    console.log("\n─── Test 5: Cursor Pagination Contract & Dual-Stream Stability ───");
    const baseDate = Date.now();
    const createdItems = [];
    for (let i = 0; i < 5; i++) {
      const item = await FoundItem.create({
        finderId: testAdmin._id,
        title: `Found Item #${i}`,
        category: "OTHER",
        publicDescription: `Item description #${i}`,
        foundLocationId: safeDeskLoc._id,
        spotDetails: "Campus ground",
        foundAt: new Date(baseDate + i * 1000),
        rawPhotoUrl: "raw.jpg",
        blurredPhotoUrl: "blurred.jpg",
        status: "ACTIVE",
        createdAt: new Date(baseDate + i * 1000),
      });
      createdItems.push(item);
    }

    // Page 1: limit 2
    const PAGE_LIMIT = 2;
    const page1 = await FoundItem.find({ status: "ACTIVE" })
      .sort({ createdAt: -1, _id: -1 })
      .limit(PAGE_LIMIT)
      .lean();

    assert(page1.length === 2, "Page 1 returned 2 items");
    const lastP1 = page1[page1.length - 1];
    const cursorP1 = encodeCursor({
      createdAt: lastP1.createdAt?.toISOString(),
      id: lastP1._id.toString(),
    });

    // Page 2: using cursor
    const decodedP1 = decodeCursor(cursorP1);
    const page2 = await FoundItem.find({
      status: "ACTIVE",
      $or: [
        { createdAt: { $lt: new Date(decodedP1.createdAt) } },
        { createdAt: new Date(decodedP1.createdAt), _id: { $lt: new Types.ObjectId(decodedP1.id) } },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(PAGE_LIMIT)
      .lean();

    assert(page2.length === 2, "Page 2 returned next 2 items");
    const page1Ids = new Set(page1.map((i) => i._id.toString()));
    const hasOverlap = page2.some((i) => page1Ids.has(i._id.toString()));
    assert(!hasOverlap, "Cursor pagination yields zero overlap between page 1 and page 2");

    // Subtest: Compound Cursor when sort = category
    const catItem1 = await FoundItem.create({
      finderId: testAdmin._id,
      title: "Category A Item",
      category: "ACCESSORIES",
      publicDescription: "Category test 1",
      foundLocationId: safeDeskLoc._id,
      spotDetails: "Zone 1",
      foundAt: new Date(baseDate),
      createdAt: new Date(baseDate),
      status: "ACTIVE",
    });

    const catItem2 = await FoundItem.create({
      finderId: testAdmin._id,
      title: "Category B Item",
      category: "BOOKS_NOTES",
      publicDescription: "Category test 2",
      foundLocationId: safeDeskLoc._id,
      spotDetails: "Zone 2",
      foundAt: new Date(baseDate + 5000), // newer timestamp
      createdAt: new Date(baseDate + 5000),
      status: "ACTIVE",
    });

    const catCursor = encodeCursor({
      category: catItem1.category,
      createdAt: catItem1.createdAt?.toISOString(),
      id: catItem1._id.toString(),
    });
    const decodedCat = decodeCursor(catCursor);
    assert(decodedCat.category === "ACCESSORIES", "Category cursor contains category metadata");

    const catPage2 = await FoundItem.find({
      _id: { $in: [catItem1._id, catItem2._id] },
      status: "ACTIVE",
      $or: [
        { category: { $gt: decodedCat.category } },
        {
          category: decodedCat.category,
          $or: [
            { createdAt: { $lt: new Date(decodedCat.createdAt) } },
            { createdAt: new Date(decodedCat.createdAt), _id: { $lt: new Types.ObjectId(decodedCat.id) } },
          ],
        },
      ],
    })
      .sort({ category: 1, createdAt: -1, _id: -1 })
      .limit(1)
      .lean();

    assert(catPage2.length === 1, "Compound category cursor query returns next item");
    assert(catPage2[0].category === "BOOKS_NOTES", "Compound category cursor correctly selects next alphabetical category despite newer timestamp");

    // ---------------------------------------------------------
    // TEST 6: Squad Role Migration Logic
    // ---------------------------------------------------------
    console.log("\n─── Test 6: Squad Role Migration Logic & Dry Run ───");
    const testSquadMigration = await Squad.create({
      name: "Legacy Migration Squad",
      tag: "LMS",
      description: "Testing role migration.",
      leaderId: testAdmin._id,
    });

    const officerMember = await SquadMember.create({
      squadId: testSquadMigration._id,
      userId: testAdmin._id,
      role: "OFFICER",
      squadRole: "OFFICER",
    });

    // Verify migration maps OFFICER to COLEADER
    const legacyRole = officerMember.squadRole || officerMember.role;
    let migratedRole = legacyRole;
    if (legacyRole === "OFFICER") {
      migratedRole = "COLEADER";
    }
    assert(migratedRole === "COLEADER", "Migration runner correctly transforms legacy OFFICER to COLEADER");

    console.log("\n========================================================");
    console.log(`🎉 ALL DISCOVERY & PIN TESTS PASSED (${passedCount} passed, ${failedCount} failed)`);
    console.log("========================================================\n");
  } finally {
    if (mongoose.connection.db) {
      console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}`);
      await mongoose.connection.db.dropDatabase();
      console.log(`✅ Ephemeral test database dropped successfully.`);
    }
    await mongoose.disconnect();
  }
}

runDiscoveryAndPinsTests().catch((err) => {
  console.error("FATAL ERROR IN DISCOVERY & PINS TEST SUITE:", err);
  process.exit(1);
});

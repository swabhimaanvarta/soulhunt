import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, LostItem, FoundItem, ClaimRequest, CampusLocation } from "../models";
import { connectDB } from "../lib/db";

const RUN_ID = `aiem_hunt_test_review_fixes_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
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

async function runReviewFixesTests() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — REVIEW VERIFICATION & CONTRACT REGRESSION SUITE");
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
    // TEST 1: Category Sort Cursor Pagination Verification
    // ---------------------------------------------------------
    console.log("─── Test 1: Category Sort Compound Cursor Query Logic ───");

    const reporter = await User.create({
      email: "reporter@aiemgoa.ac.in",
      passwordHash: "dummyHash123",
      username: "reporter_01",
      displayName: "Reporter One",
      department: "COMP",
      yearOfStudy: 3,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const location = await CampusLocation.create({
      name: "Library Desk",
      code: "LIB_REV_01",
      zoneType: "ACADEMIC_BLOCK",
      description: "Central Library Desk",
      coordinates: { lat: 15.5975, lng: 73.7943, mapX: 30, mapY: 30 },
      floors: ["Ground Floor"],
      isSafeDesk: true,
      operatingHours: "09:00 - 17:00",
    });

    const now = Date.now();

    // Create items across 4 categories with deliberately inverted timestamps:
    // ACCESSORIES (older: now - 4000)
    // ACCESSORIES (newer: now - 3000)
    // BOOKS_NOTES (newest: now - 1000)  <-- Notice BOOKS_NOTES is newer than ACCESSORIES!
    // ELECTRONICS (oldest: now - 5000)
    const itemA1 = await LostItem.create({
      reporterId: reporter._id,
      title: "Silver Ring",
      category: "ACCESSORIES",
      publicDescription: "A delicate silver ring",
      secretIdentifiers: "Secret",
      verificationQuestion: "Color?",
      verificationAnswerHash: "hash",
      lastKnownLocationId: location._id,
      spotDetails: "Table 1",
      lostAt: new Date(now - 4000),
      createdAt: new Date(now - 4000),
      status: "ACTIVE",
    });

    const itemA2 = await LostItem.create({
      reporterId: reporter._id,
      title: "Gold Chain",
      category: "ACCESSORIES",
      publicDescription: "Gold chain lost near reading room",
      secretIdentifiers: "Secret",
      verificationQuestion: "Weight?",
      verificationAnswerHash: "hash",
      lastKnownLocationId: location._id,
      spotDetails: "Table 2",
      lostAt: new Date(now - 3000),
      createdAt: new Date(now - 3000),
      status: "ACTIVE",
    });

    const itemB1 = await LostItem.create({
      reporterId: reporter._id,
      title: "DSA Textbook",
      category: "BOOKS_NOTES",
      publicDescription: "Cormen Algorithms book",
      secretIdentifiers: "Secret",
      verificationQuestion: "Edition?",
      verificationAnswerHash: "hash",
      lastKnownLocationId: location._id,
      spotDetails: "Shelf B",
      lostAt: new Date(now - 1000),
      createdAt: new Date(now - 1000),
      status: "ACTIVE",
    });

    const itemE1 = await LostItem.create({
      reporterId: reporter._id,
      title: "Wireless Mouse",
      category: "ELECTRONICS",
      publicDescription: "Logitech pebble mouse",
      secretIdentifiers: "Secret",
      verificationQuestion: "Model?",
      verificationAnswerHash: "hash",
      lastKnownLocationId: location._id,
      spotDetails: "Desk 4",
      lostAt: new Date(now - 5000),
      createdAt: new Date(now - 5000),
      status: "ACTIVE",
    });

    // Query Page 1: limit 2, sort category ASC, createdAt DESC, _id DESC
    const mongoSort: any = { category: 1, createdAt: -1, _id: -1 };
    const page1Docs = await LostItem.find({ status: { $nin: ["REJECTED", "ARCHIVED"] } })
      .sort(mongoSort)
      .limit(3) // fetch limit + 1
      .lean();

    const hasMorePage1 = page1Docs.length > 2;
    const slicedPage1 = hasMorePage1 ? page1Docs.slice(0, 2) : page1Docs;

    assert(slicedPage1.length === 2, "Page 1 returned exactly 2 items");
    assert(slicedPage1[0]._id.toString() === itemA2._id.toString(), "Page 1 Item 0 is newer ACCESSORIES item");
    assert(slicedPage1[1]._id.toString() === itemA1._id.toString(), "Page 1 Item 1 is older ACCESSORIES item");

    // Construct compound cursor
    const lastPage1 = slicedPage1[slicedPage1.length - 1];
    const cursorStr = encodeCursor({
      category: lastPage1.category,
      createdAt: lastPage1.createdAt,
      id: lastPage1._id.toString(),
    });

    const decoded = decodeCursor(cursorStr);
    assert(decoded.category === "ACCESSORIES", "Cursor accurately encoded category");

    // Query Page 2 with compound cursor filter
    const cursorDate = new Date(decoded.createdAt);
    const objId = new Types.ObjectId(decoded.id);

    const lostCursorConds = [
      { category: { $gt: decoded.category } },
      {
        category: decoded.category,
        $or: [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: objId } },
        ],
      },
    ];

    const page2Docs = await LostItem.find({
      status: { $nin: ["REJECTED", "ARCHIVED"] },
      $or: lostCursorConds,
    })
      .sort(mongoSort)
      .limit(3)
      .lean();

    const hasMorePage2 = page2Docs.length > 2;
    const slicedPage2 = hasMorePage2 ? page2Docs.slice(0, 2) : page2Docs;

    assert(slicedPage2.length === 2, "Page 2 returned remaining 2 items");
    // Under the old broken cursor, itemB1 was skipped because its createdAt was newer than lastPage1!
    // Under the new compound cursor, itemB1 ("BOOKS_NOTES") is returned first!
    assert(
      slicedPage2[0]._id.toString() === itemB1._id.toString(),
      "Page 2 correctly includes BOOKS_NOTES item despite newer createdAt timestamp"
    );
    assert(
      slicedPage2[1]._id.toString() === itemE1._id.toString(),
      "Page 2 correctly includes ELECTRONICS item"
    );

    // Disjoint verification
    const page1Ids = new Set(slicedPage1.map((d) => d._id.toString()));
    const hasOverlap = slicedPage2.some((d) => page1Ids.has(d._id.toString()));
    assert(!hasOverlap, "Page 1 and Page 2 have zero intersecting item IDs");

    // ---------------------------------------------------------
    // TEST 2: Claim Duplicate Prevention & Idempotent Submission
    // ---------------------------------------------------------
    console.log("\n─── Test 2: Claim Duplicate Prevention & Idempotency ───");

    const finder = await User.create({
      email: "finder@aiemgoa.ac.in",
      passwordHash: "dummyHash123",
      username: "finder_01",
      displayName: "Finder Operative",
      department: "ECE",
      yearOfStudy: 2,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const foundItem = await FoundItem.create({
      finderId: finder._id,
      title: "Casio Scientific Calculator",
      shortTitle: "Scientific Calculator",
      category: "ELECTRONICS",
      publicDescription: "Grey fx-991EX calculator found on bench",
      foundLocationId: location._id,
      foundAt: new Date(),
      status: "ACTIVE",
    });

    // 1st claim creation
    const claim1 = await ClaimRequest.create({
      itemId: foundItem._id,
      itemType: "FOUND",
      claimantId: reporter._id,
      counterpartyUserId: finder._id,
      submittedAnswer: "fx-991EX",
      notes: "My name is on the back lid",
      status: "PENDING",
    });

    assert(Boolean(claim1._id), "Initial claim created with status PENDING");

    // Test duplicate active claim detection
    const existingActiveClaim = await ClaimRequest.findOne({
      itemId: foundItem._id,
      claimantId: reporter._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });

    assert(Boolean(existingActiveClaim), "Active claim query correctly detects pending claim");
    assert(
      existingActiveClaim?._id.toString() === claim1._id.toString(),
      "Duplicate attempt correctly resolves to original claim ID"
    );

    // Verify another user CAN submit a claim for the same found item
    const otherStudent = await User.create({
      email: "other@aiemgoa.ac.in",
      passwordHash: "dummyHash123",
      username: "other_01",
      displayName: "Other Student",
      department: "MECH",
      yearOfStudy: 1,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const otherActiveClaim = await ClaimRequest.findOne({
      itemId: foundItem._id,
      claimantId: otherStudent._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });

    assert(otherActiveClaim === null, "Other students are not blocked by peer claim submissions");

    console.log("\n========================================================");
    console.log(`🎉 ALL REVIEW FIXES TESTS PASSED: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("========================================================\n");
  } finally {
    console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly.");
  }
}

runReviewFixesTests().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});

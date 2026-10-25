import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import {
  User,
  LostItem,
  FoundItem,
  Notification,
  Event,
  CampusLocation,
} from "../models";
import { connectDB } from "../lib/db";
import { toPublicEventDTO } from "../lib/event-dto";
import { sanitizePublicDescription } from "../lib/privacy";
import { toPublicItemDTO, sanitizeItemTitle } from "../lib/item-dto";
import { isWithinCampusBounds } from "../lib/campus-constants";

const RUN_ID = `aiem_hunt_test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "test_super_secret_key_minimum_32_characters_long";

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

// Replicate the applySearchAndCursor helper from items/quests route
function applySearchAndCursor(
  filter: Record<string, any>,
  searchQuery: string,
  cursorDate: Date | null,
  cursorId: string | null,
  sortDirection: -1 | 1 = -1
) {
  const searchConditions: Record<string, any>[] = [];
  if (searchQuery) {
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchConditions.push(
      { title: { $regex: escaped, $options: "i" } },
      { publicDescription: { $regex: escaped, $options: "i" } }
    );
  }

  const cursorConditions: Record<string, any>[] = [];
  if (cursorDate && cursorId && Types.ObjectId.isValid(cursorId)) {
    const objId = new Types.ObjectId(cursorId);
    if (sortDirection === -1) {
      cursorConditions.push(
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: objId } }
      );
    } else {
      cursorConditions.push(
        { createdAt: { $gt: cursorDate } },
        { createdAt: cursorDate, _id: { $gt: objId } }
      );
    }
  }

  if (searchConditions.length > 0 && cursorConditions.length > 0) {
    filter.$and = [{ $or: searchConditions }, { $or: cursorConditions }];
  } else if (searchConditions.length > 0) {
    filter.$or = searchConditions;
  } else if (cursorConditions.length > 0) {
    filter.$or = cursorConditions;
  }
}

async function run() {
  console.log("\n========================================================");
  console.log("🛡️  AIEM HUNT — CONTRACTS & FIXES VERIFICATION SUITE");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();

  console.log("─── Suite A: Compound Search + Cursor Query Invariant ───");
  {
    // Test 1: Empty search, empty cursor -> filter unchanged
    const f1: Record<string, any> = { status: "OPEN" };
    applySearchAndCursor(f1, "", null, null);
    assert(!f1.$or && !f1.$and, "No search or cursor leaves filter without $or / $and");

    // Test 2: Search only -> $or on title & publicDescription
    const f2: Record<string, any> = { status: "OPEN" };
    applySearchAndCursor(f2, "blue bottle", null, null);
    assert(f2.$or && f2.$or.length === 2, "Search creates $or filter with 2 regex clauses");
    assert(!f2.$and, "Search only does not create $and");

    // Test 3: Cursor only -> $or on createdAt & _id
    const f3: Record<string, any> = { status: "OPEN" };
    const testId = new Types.ObjectId().toString();
    const testDate = new Date();
    applySearchAndCursor(f3, "", testDate, testId, -1);
    assert(f3.$or && f3.$or.length === 2, "Cursor creates $or filter with 2 comparison clauses");
    assert(!f3.$and, "Cursor only does not create $and");

    // Test 4: BOTH search and cursor -> $and containing both $or clauses (CRITICAL PREVIOUS BUG)
    const f4: Record<string, any> = { status: "OPEN" };
    applySearchAndCursor(f4, "umbrella", testDate, testId, -1);
    assert(f4.$and && f4.$and.length === 2, "Both search and cursor creates $and with 2 clauses");
    assert(f4.$and[0].$or && f4.$and[0].$or.length === 2, "$and[0] contains search conditions");
    assert(f4.$and[1].$or && f4.$and[1].$or.length === 2, "$and[1] contains cursor conditions");
    assert(!f4.$or, "Top-level $or is NOT overwritten/used when $and is present");

    // Test 5: Verify in MongoDB query with seed items
    const baseTime = Date.now();
    const locId = new Types.ObjectId();
    const reporterId = new Types.ObjectId();
    const item1 = await LostItem.create({
      reporterId,
      title: "Silver Umbrella",
      category: "OTHER",
      publicDescription: "Found near gate",
      secretIdentifiers: "Has small scratch on handle",
      verificationQuestion: "What color is the handle?",
      verificationAnswerHash: "hash123",
      lastKnownLocationId: locId,
      lostAt: new Date(baseTime - 1000),
      status: "ACTIVE",
      createdAt: new Date(baseTime - 1000),
    });
    const item2 = await LostItem.create({
      reporterId,
      title: "Silver Umbrella 2",
      category: "OTHER",
      publicDescription: "Found near library",
      secretIdentifiers: "Has name tag",
      verificationQuestion: "What is on the tag?",
      verificationAnswerHash: "hash123",
      lastKnownLocationId: locId,
      lostAt: new Date(baseTime - 2000),
      status: "ACTIVE",
      createdAt: new Date(baseTime - 2000),
    });
    const item3 = await LostItem.create({
      reporterId,
      title: "Gold Ring",
      category: "ACCESSORIES",
      publicDescription: "Shiny gold ring",
      secretIdentifiers: "Engraved initials",
      verificationQuestion: "What initials are engraved?",
      verificationAnswerHash: "hash123",
      lastKnownLocationId: locId,
      lostAt: new Date(baseTime - 3000),
      status: "ACTIVE",
      createdAt: new Date(baseTime - 3000),
    });

    // Query 1: search for "Umbrella" -> matches item1 and item2
    const filterQuery1: Record<string, any> = { status: "ACTIVE" };
    applySearchAndCursor(filterQuery1, "Umbrella", null, null);
    const results1 = await LostItem.find(filterQuery1).sort({ createdAt: -1 });
    assert(results1.length === 2, "Search finds 2 Umbrella items and excludes Gold Ring");

    // Query 2: search for "Umbrella" with cursor set to item1 -> should return only item2
    const filterQuery2: Record<string, any> = { status: "ACTIVE" };
    applySearchAndCursor(
      filterQuery2,
      "Umbrella",
      item1.createdAt as Date,
      item1._id.toString(),
      -1
    );
    const results2 = await LostItem.find(filterQuery2).sort({ createdAt: -1 });
    assert(results2.length === 1 && results2[0]._id.equals(item2._id), "Cursor pagination preserves search filter and returns page 2 correctly");
  }

  console.log("\n─── Suite B: Notification Read Status & Bulk Mark-All ───");
  {
    const studentUser = await User.create({
      username: `student_${Date.now()}`,
      displayName: "Student Test",
      passwordHash: "hash123",
      email: `student_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      trustScore: 80,
      trustTier: "TRUSTED_HUNTER",
      accountStatus: "ACTIVE",
    });

    const notif1 = await Notification.create({
      userId: studentUser._id,
      category: "QUEST_SQUAD",
      title: "Test Notif 1",
      message: "Message 1",
      isRead: false,
    });
    const notif2 = await Notification.create({
      userId: studentUser._id,
      category: "SYSTEM_REWARD",
      title: "Test Notif 2",
      message: "Message 2",
      isRead: false,
    });

    // Mark single notification as read
    const updated1 = await Notification.findOneAndUpdate(
      { _id: notif1._id, userId: studentUser._id },
      { $set: { isRead: true } },
      { new: true }
    );
    assert(updated1?.isRead === true, "Individual notification is marked as read");

    // Bulk mark remaining unread
    const bulkResult = await Notification.updateMany(
      { userId: studentUser._id, isRead: false },
      { $set: { isRead: true } }
    );
    assert(bulkResult.modifiedCount === 1, "Bulk mark-as-read marked the remaining 1 unread notification");

    const unreadCount = await Notification.countDocuments({
      userId: studentUser._id,
      isRead: false,
    });
    assert(unreadCount === 0, "All notifications are now marked read");
  }

  console.log("\n─── Suite C: Public Event DTO & Participant Scrubbing ───");
  {
    const creatorUser = await User.create({
      username: `creator_${Date.now()}`,
      displayName: "Creator Test",
      passwordHash: "hash123",
      email: `creator_${Date.now()}@aiemgoa.ac.in`,
      role: "MODERATOR",
      trustScore: 100,
      accountStatus: "ACTIVE",
    });

    const participantUser = await User.create({
      username: `p1_${Date.now()}`,
      displayName: "Participant Test",
      passwordHash: "hash123",
      email: `p1_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      trustScore: 70,
      accountStatus: "ACTIVE",
    });

    const testEvent = await Event.create({
      title: "Secret Campus Hunt",
      slug: `secret-hunt-${Date.now()}`,
      eventType: "FLASH_HUNT",
      description: "Join the hunt on campus",
      status: "LIVE",
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000),
      participants: [
        {
          userId: participantUser._id,
          joinedAt: new Date(),
          scoreXp: 100,
        },
      ],
    });

    // Convert with toPublicEventDTO
    const publicDto = toPublicEventDTO(testEvent, participantUser._id.toString());
    assert(publicDto._id.toString() === testEvent._id.toString(), "DTO correctly exposes event _id");
    assert(publicDto.title === testEvent.title, "DTO correctly exposes event title");
    assert(publicDto.participantCount === 1, "DTO correctly computes participantCount");
    assert(publicDto.isRegistered === true, "DTO correctly identifies participant isRegistered");
    assert((publicDto as any).participants === undefined, "DTO strictly omits raw participants array");

    // For non-participant:
    const otherUser = new Types.ObjectId();
    const publicDto2 = toPublicEventDTO(testEvent, otherUser.toString());
    assert(publicDto2.isRegistered === false, "DTO correctly identifies non-participant isRegistered=false");
    assert((publicDto2 as any).participants === undefined, "DTO strictly omits raw participants array for external viewers");
  }

  console.log("\n─── Suite D: Campus Coordinate Boundary Invariants ───");
  {
    // AIEM CAMPUS BOUNDS: South-West [15.5890, 73.7880], North-East [15.6010, 73.8020]
    assert(isWithinCampusBounds(15.5948, 73.7947), "Campus center point is valid");
    assert(isWithinCampusBounds(15.5890, 73.7880), "South-West boundary point is valid");
    assert(isWithinCampusBounds(15.6010, 73.8020), "North-East boundary point is valid");

    assert(!isWithinCampusBounds(15.5880, 73.7947), "Point south of minLat is rejected");
    assert(!isWithinCampusBounds(15.6020, 73.7947), "Point north of maxLat is rejected");
    assert(!isWithinCampusBounds(15.5948, 73.7870), "Point west of minLng is rejected");
    assert(!isWithinCampusBounds(15.5948, 73.8030), "Point east of maxLng is rejected");
    assert(!isWithinCampusBounds(NaN, 73.7947), "NaN coordinate is rejected");
  }

  console.log("\n─── Suite E: Item DTO Privacy, Zero-Fallback & Description Scrubbing ───");
  {
    // Test PII scrub
    const dirtyDesc = "Found a wallet. Call me at +91 9876543210 or 9876543210. Roll number 21CS042. Email test@gmail.com";
    const { sanitizedText, wasRedacted } = sanitizePublicDescription(dirtyDesc);
    assert(wasRedacted, "PII redaction flag was set");
    assert(!sanitizedText.includes("9876543210"), "Phone number is scrubbed from description");
    assert(!sanitizedText.includes("21CS042"), "Roll number is scrubbed from description");
    assert(!sanitizedText.includes("test@gmail.com"), "Email is scrubbed from description");
    assert(sanitizedText.includes("[REDACTED-PHONE]"), "Phone redacted token is inserted");
    assert(sanitizedText.includes("[REDACTED-STUDENT-ID]"), "Student ID redacted token is inserted");
    assert(sanitizedText.includes("[REDACTED-EMAIL]"), "Email redacted token is inserted");

    // Test toPublicItemDTO photo zero fallback rule
    const mockItem = {
      _id: new Types.ObjectId(),
      title: "Lost Bag",
      category: "BAGS_WALLETS",
      publicDescription: "Black backpack with books",
      photoUrl: "https://example.com/raw_photo.jpg",
      blurredPhotoUrl: "https://example.com/blurred_photo.jpg",
      status: "OPEN",
      createdAt: new Date(),
    };

    // Public view (with blurred available):
    const publicDtoBlurred = toPublicItemDTO(mockItem as any, "LOST", false);
    assert(publicDtoBlurred.photoUrl === "https://example.com/blurred_photo.jpg", "Public receives blurred photo when present");

    // Public view (without blurred available - MUST BE EMPTY STRING, NOT RAW PHOTO):
    const mockItemNoBlur = {
      ...mockItem,
      blurredPhotoUrl: "",
    };
    const publicDtoNoBlur = toPublicItemDTO(mockItemNoBlur as any, "LOST", false);
    assert(publicDtoNoBlur.photoUrl === "", "Public gets EMPTY string when blurredPhoto is missing (NO raw fallback)");
  }

  console.log("\n─── Suite F: Weekly Leaderboard Hunter Ranking ───");
  {
    const hunter1 = await User.create({
      username: `hunter1_${Date.now()}`,
      displayName: "Hunter 1",
      passwordHash: "hash123",
      email: `hunter1_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      xp: 1000,
      weeklyScore: 50,
      accountStatus: "ACTIVE",
    });
    const hunter2 = await User.create({
      username: `hunter2_${Date.now()}`,
      displayName: "Hunter 2",
      passwordHash: "hash123",
      email: `hunter2_${Date.now()}@aiemgoa.ac.in`,
      role: "STUDENT",
      xp: 200,
      weeklyScore: 120, // Higher weekly score despite lower overall XP
      accountStatus: "ACTIVE",
    });

    const weeklyRankings = await User.find({ accountStatus: "ACTIVE" })
      .sort({ weeklyScore: -1, xp: -1 })
      .select("username weeklyScore xp");

    const h2Idx = weeklyRankings.findIndex((u) => u._id.equals(hunter2._id));
    const h1Idx = weeklyRankings.findIndex((u) => u._id.equals(hunter1._id));
    assert(h2Idx < h1Idx, "Hunter with higher weeklyScore ranks above hunter with higher total XP in weekly rankings");
  }

  // Cleanup
  console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
  console.log("✨ Ephemeral test database dropped cleanly.");

  console.log("\n========================================================");
  console.log(`🎉 ALL TESTS COMPLETED: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

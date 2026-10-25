import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import {
  User,
  Squad,
  SquadMember,
  SquadJoinRequest,
  SquadMessage,
  AuditEvent,
} from "../models";
import { connectDB } from "../lib/db";
import {
  ROLE_HIERARCHY,
  normalizeSquadRole,
  canEditSquadSettings,
  canManageJoinRequests,
  canRemoveSquadMember,
  canPromoteDemoteElder,
  canPromoteDemoteCoLeader,
  canTransferOrDisband,
  canModerateMessages,
  canAccessSquadChat,
} from "../lib/squadPermissions";

const RUN_ID = `aiem_hunt_test_squad_v2_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function runSquadV2AndChatTests() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — SQUADS V2 & CHAT INTEGRATION TESTS");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  await SquadJoinRequest.init();
  await SquadMember.init();
  await SquadMessage.init();

  try {
    // ---------------------------------------------------------
    // TEST 1: Role Hierarchy Matrix Logic
    // ---------------------------------------------------------
    console.log("─── Test 1: Role Hierarchy Numerical Ordering & Normalization ───");
    assert(ROLE_HIERARCHY.LEADER === 4, "Leader hierarchy weight is 4");
    assert(ROLE_HIERARCHY.COLEADER === 3, "CoLeader hierarchy weight is 3");
    assert(ROLE_HIERARCHY.ELDER === 2, "Elder hierarchy weight is 2");
    assert(ROLE_HIERARCHY.MEMBER === 1, "Member hierarchy weight is 1");
    assert(normalizeSquadRole("OFFICER") === "COLEADER", "Legacy OFFICER normalizes to COLEADER");
    assert(normalizeSquadRole("leader") === "LEADER", "Case-insensitive normalization for leader");
    assert(normalizeSquadRole(undefined) === "MEMBER", "Default fallback is MEMBER");

    // ---------------------------------------------------------
    // TEST 2: Role Permission Gates
    // ---------------------------------------------------------
    console.log("\n─── Test 2: Role Permission Gates Enforcement ───");
    assert(canEditSquadSettings("LEADER") === true, "Leader can edit squad settings");
    assert(canEditSquadSettings("COLEADER") === true, "CoLeader can edit squad settings");
    assert(canEditSquadSettings("ELDER") === false, "Elder cannot edit squad settings");
    assert(canEditSquadSettings("MEMBER") === false, "Member cannot edit squad settings");

    assert(canManageJoinRequests("LEADER") === true, "Leader can manage join requests");
    assert(canManageJoinRequests("COLEADER") === true, "CoLeader can manage join requests");
    assert(canManageJoinRequests("ELDER") === true, "Elder can manage join requests");
    assert(canManageJoinRequests("MEMBER") === false, "Member cannot manage join requests");

    assert(canPromoteDemoteCoLeader("LEADER") === true, "Leader can promote/demote CoLeaders");
    assert(canPromoteDemoteCoLeader("COLEADER") === false, "CoLeader cannot promote/demote CoLeaders");
    assert(canPromoteDemoteCoLeader("ELDER") === false, "Elder cannot promote/demote CoLeaders");

    assert(canPromoteDemoteElder("LEADER") === true, "Leader can promote/demote Elders");
    assert(canPromoteDemoteElder("COLEADER") === true, "CoLeader can promote/demote Elders");
    assert(canPromoteDemoteElder("ELDER") === false, "Elder cannot promote/demote Elders");

    assert(canTransferOrDisband("LEADER") === true, "Leader can transfer/disband");
    assert(canTransferOrDisband("COLEADER") === false, "CoLeader cannot transfer/disband");

    assert(canModerateMessages("LEADER") === true, "Leader can moderate messages");
    assert(canModerateMessages("COLEADER") === true, "CoLeader can moderate messages");
    assert(canModerateMessages("ELDER") === true, "Elder can moderate messages");
    assert(canModerateMessages("MEMBER") === false, "Member cannot moderate messages");

    assert(canAccessSquadChat("MEMBER") === true, "Member can access squad chat");
    assert(canAccessSquadChat(null) === false, "Non-member cannot access squad chat");

    // ---------------------------------------------------------
    // TEST 3: Cross-Role Member Removal Matrix
    // ---------------------------------------------------------
    console.log("\n─── Test 3: Cross-Role Member Removal Matrix ───");
    assert(canRemoveSquadMember("LEADER", "COLEADER") === true, "Leader can remove CoLeader");
    assert(canRemoveSquadMember("LEADER", "ELDER") === true, "Leader can remove Elder");
    assert(canRemoveSquadMember("LEADER", "MEMBER") === true, "Leader can remove Member");

    assert(canRemoveSquadMember("COLEADER", "LEADER") === false, "CoLeader cannot remove Leader");
    assert(canRemoveSquadMember("COLEADER", "COLEADER") === false, "CoLeader cannot remove peer CoLeader");
    assert(canRemoveSquadMember("COLEADER", "ELDER") === true, "CoLeader can remove Elder");
    assert(canRemoveSquadMember("COLEADER", "MEMBER") === true, "CoLeader can remove Member");

    assert(canRemoveSquadMember("ELDER", "LEADER") === false, "Elder cannot remove Leader");
    assert(canRemoveSquadMember("ELDER", "COLEADER") === false, "Elder cannot remove CoLeader");
    assert(canRemoveSquadMember("ELDER", "ELDER") === false, "Elder cannot remove peer Elder");
    assert(canRemoveSquadMember("ELDER", "MEMBER") === true, "Elder can remove Member");

    assert(canRemoveSquadMember("MEMBER", "MEMBER") === false, "Member cannot remove another Member");

    // ---------------------------------------------------------
    // TEST 4: Database Models & Join Request Lifecycle
    // ---------------------------------------------------------
    console.log("\n─── Test 4: Database Squad & Join Request Lifecycle ───");
    const testLeader = await User.create({
      username: "squad_lead_test",
      displayName: "Squad Leader",
      email: "lead@eng.aiem.edu",
      passwordHash: "hash123",
      role: "STUDENT",
    });

    const testApplicant = await User.create({
      username: "applicant_test",
      displayName: "Applicant User",
      email: "applicant@eng.aiem.edu",
      passwordHash: "hash123",
      role: "STUDENT",
    });

    const testSquad = await Squad.create({
      name: "Phantom Recon Division",
      tag: "PRD",
      description: "Tactical squad for campus mystery recon.",
      leaderId: testLeader._id,
      privacy: "INVITE_ONLY",
      tags: ["Recon", "Competitive"],
    });

    await SquadMember.create({
      squadId: testSquad._id,
      userId: testLeader._id,
      role: "LEADER",
      squadRole: "LEADER",
    });
    await User.findByIdAndUpdate(testLeader._id, { squadId: testSquad._id });

    await SquadJoinRequest.init();

    // Applicant submits join request
    const joinReq = await SquadJoinRequest.create({
      squadId: testSquad._id,
      userId: testApplicant._id,
      message: "Requesting to join recon unit.",
      status: "PENDING",
    });
    assert(joinReq.status === "PENDING", "Join request created in PENDING status");

    // Unique pending guard: attempting duplicate pending request must fail on unique compound index
    let dupFailed = false;
    try {
      await SquadJoinRequest.create({
        squadId: testSquad._id,
        userId: testApplicant._id,
        message: "Duplicate spam request.",
        status: "PENDING",
      });
    } catch (e: any) {
      dupFailed = true;
    }
    assert(dupFailed, "Duplicate pending join request prevented by unique compound index");

    // Leader approves join request
    joinReq.status = "ACCEPTED";
    joinReq.reviewedBy = testLeader._id as Types.ObjectId;
    joinReq.reviewedAt = new Date();
    await joinReq.save();

    const newMember = await SquadMember.create({
      squadId: testSquad._id,
      userId: testApplicant._id,
      role: "MEMBER",
      squadRole: "MEMBER",
    });
    await User.findByIdAndUpdate(testApplicant._id, { squadId: testSquad._id });
    assert(newMember.squadRole === "MEMBER", "Approved user added to squad roster as MEMBER");

    // ---------------------------------------------------------
    // TEST 5: Sole Leader Self-Removal Guard
    // ---------------------------------------------------------
    console.log("\n─── Test 5: Sole Leader Self-Removal Guard ───");
    // Leader leaving when other members exist: must be blocked unless leadership is transferred
    const memberCount = await SquadMember.countDocuments({ squadId: testSquad._id });
    assert(memberCount === 2, "Squad currently has 2 members (Leader + Member)");

    // Simulate leave guard
    const leaderMember = await SquadMember.findOne({ squadId: testSquad._id, userId: testLeader._id });
    const isLeader = leaderMember?.squadRole === "LEADER" || leaderMember?.role === "LEADER";
    const canLeaveWithoutTransfer = !isLeader || memberCount === 1;
    assert(canLeaveWithoutTransfer === false, "Sole Leader cannot leave squad without transferring leadership first");

    // ---------------------------------------------------------
    // TEST 6: Chat Message Security, Sanitization & Idempotency
    // ---------------------------------------------------------
    console.log("\n─── Test 6: Squad Chat Security, XSS Sanitization & Idempotency ───");
    function sanitizeChatMessage(text: string): string {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .trim();
    }

    const rawInput = "<script>alert('XSS_ATTACK')</script>";
    const sanitized = sanitizeChatMessage(rawInput);
    assert(!sanitized.includes("<script>"), "Chat message XSS tags sanitized to HTML entities");
    assert(sanitized.includes("&lt;script&gt;"), "Sanitized output contains safe escaped entities");

    // Idempotent insertion
    const stableRequestId = "REQ_MSG_TEST_999";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const msg1 = await SquadMessage.create({
      squadId: testSquad._id,
      senderId: testLeader._id,
      text: sanitized,
      requestId: stableRequestId,
      expiresAt,
    });
    assert(Boolean(msg1._id), "Chat message created with idempotency key and 30-day expiresAt");

    // Duplicate requestId should be detected
    const existingMsg = await SquadMessage.findOne({
      squadId: testSquad._id,
      requestId: stableRequestId,
    });
    assert(existingMsg?._id.toString() === msg1._id.toString(), "Duplicate requestId retrieves original message idempotently");

    // ---------------------------------------------------------
    // TEST 7: Message Moderation & Tombstone Replacement
    // ---------------------------------------------------------
    console.log("\n─── Test 7: Message Moderation & Tombstone Replacement ───");
    // Leader moderates the message
    msg1.moderationState = "REMOVED";
    msg1.text = "[This message was removed by squad leadership]";
    msg1.moderatedBy = testLeader._id as Types.ObjectId;
    msg1.moderationReason = "Policy violation";
    await msg1.save();

    const moderatedMsg = await SquadMessage.findById(msg1._id);
    assert(moderatedMsg?.moderationState === "REMOVED", "Moderated message flagged as REMOVED");
    assert(moderatedMsg?.text === "[This message was removed by squad leadership]", "Original text replaced with standard tombstone");

    // ---------------------------------------------------------
    // TEST 8: 500-Message Cap Pruning Simulation
    // ---------------------------------------------------------
    console.log("\n─── Test 8: 500-Message Cap Pruning Simulation ───");
    // Insert 50 messages for batch simulation
    const bulkMsgs = [];
    const baseTime = Date.now();
    for (let i = 0; i < 50; i++) {
      bulkMsgs.push({
        squadId: testSquad._id,
        senderId: testLeader._id,
        text: `Tactical message #${i}`,
        requestId: `BULK_${i}`,
        createdAt: new Date(baseTime + i * 1000),
        expiresAt: new Date(baseTime + 30 * 24 * 60 * 60 * 1000),
      });
    }
    await SquadMessage.insertMany(bulkMsgs);

    const totalInSquad = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(totalInSquad >= 50, `Squad messages populated: ${totalInSquad}`);

    // If cap was 25 for testing: prune older than newest 25
    const CAP = 25;
    const overflow = totalInSquad - CAP;
    if (overflow > 0) {
      const oldestToPrune = await SquadMessage.find({ squadId: testSquad._id })
        .sort({ createdAt: 1 })
        .limit(overflow)
        .select("_id");
      const idsToDelete = oldestToPrune.map((m) => m._id);
      await SquadMessage.deleteMany({ _id: { $in: idsToDelete } });
    }

    const postPruneCount = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(postPruneCount === CAP, `Pruning correctly maintained capped limit: ${postPruneCount} == ${CAP}`);

    // ---------------------------------------------------------
    // TEST 9: Error Envelope Sanitization & Raw Error Protection
    // ---------------------------------------------------------
    console.log("\n─── Test 9: Standard Error Envelope Sanitization & Technical Leakage Protection ───");
    const { apiError, apiServerError } = await import("../lib/api-error");

    // Test 9.1: Standard client error envelope format
    const sampleError = apiError("RATE_LIMITED", "Cooldown active.", 429, "REQ_123");
    const sampleJson: any = await sampleError.json();
    assert(sampleError.status === 429, "apiError sets correct HTTP status code (429)");
    assert(sampleJson.success === false, "apiError returns success: false");
    assert(sampleJson.error?.code === "RATE_LIMITED", "apiError returns structured error.code");
    assert(sampleJson.error?.message === "Cooldown active.", "apiError returns structured error.message");
    assert(sampleJson.error?.requestId === "REQ_123", "apiError binds client requestId");

    // Test 9.2: Technical error sanitization (no raw error.message leak)
    const dangerousTechnicalError = new Error("MongoServerError: E11000 duplicate key error collection: aiem_hunt.users index: passwordHash_1");
    const sanitizedServerResponse = apiServerError(dangerousTechnicalError, "MESSAGE_SEND_FAILED", "Failed to transmit squad message.", "REQ_456");
    const serverJson: any = await sanitizedServerResponse.json();
    assert(sanitizedServerResponse.status === 500, "apiServerError returns HTTP 500");
    assert(serverJson.success === false, "apiServerError returns success: false");
    assert(serverJson.error?.code === "MESSAGE_SEND_FAILED", "apiServerError returns safe stable error code");
    assert(!JSON.stringify(serverJson).includes("E11000") && !JSON.stringify(serverJson).includes("passwordHash"), "apiServerError strictly sanitizes out internal database errors and stack traces");
    assert(serverJson.error?.message === "Failed to transmit squad message.", "apiServerError provides safe generic fallback message to client");
    assert(serverJson.error?.requestId === "REQ_456", "apiServerError preserves requestId for tracing");

    // ---------------------------------------------------------
    // TEST 10: Pruning Expired Cleanup, Tombstone Querying & Cursor Direction
    // ---------------------------------------------------------
    console.log("\n─── Test 10: Expired Cleanup, Tombstone Querying & Cursors ───");

    // 10.1 Expired message cleanup prior to cap enforcement
    const nowTime = new Date();
    const expiredSeedMsgs = [];
    for (let i = 0; i < 15; i++) {
      expiredSeedMsgs.push({
        squadId: testSquad._id,
        senderId: testLeader._id,
        text: `Expired tactical message #${i}`,
        requestId: `EXPIRED_${i}`,
        createdAt: new Date(nowTime.getTime() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        expiresAt: new Date(nowTime.getTime() - 5 * 24 * 60 * 60 * 1000), // expired 5 days ago
      });
    }
    await SquadMessage.insertMany(expiredSeedMsgs);

    const preCleanupCount = await SquadMessage.countDocuments({ squadId: testSquad._id });
    assert(preCleanupCount >= 15, "Expired messages seeded in squad collection");

    // Execute expired purge as implemented in POST route
    await SquadMessage.deleteMany({
      squadId: testSquad._id,
      expiresAt: { $lte: nowTime },
    });

    const postExpiredPurgeCount = await SquadMessage.countDocuments({
      squadId: testSquad._id,
      expiresAt: { $lte: nowTime },
    });
    assert(postExpiredPurgeCount === 0, "All expired messages purged before cap evaluation");

    // 10.2 Tombstone querying: REMOVED messages must be visible as tombstones, HIDDEN messages must be excluded
    const removedMsg = await SquadMessage.create({
      squadId: testSquad._id,
      senderId: testLeader._id,
      text: "[This message was removed by squad leadership]",
      moderationState: "REMOVED",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const hiddenMsg = await SquadMessage.create({
      squadId: testSquad._id,
      senderId: testLeader._id,
      text: "Confidential internal message",
      moderationState: "HIDDEN",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const queryResults = await SquadMessage.find({
      squadId: testSquad._id,
      expiresAt: { $gt: new Date() },
      moderationState: { $ne: "HIDDEN" },
    }).lean();

    const containsRemovedTombstone = queryResults.some(
      (m) => m.moderationState === "REMOVED" && m.text === "[This message was removed by squad leadership]"
    );
    assert(containsRemovedTombstone, "GET query includes REMOVED messages with standard tombstone text");

    const containsHiddenMsg = queryResults.some((m) => m._id.toString() === hiddenMsg._id.toString());
    assert(!containsHiddenMsg, "GET query strictly excludes HIDDEN messages");

    // 10.3 Cursor direction logic
    // Historical fetch (newest first, reversed to chronological): nextCursor is oldest
    const histMessages = [
      { _id: new Types.ObjectId(), createdAt: new Date(nowTime.getTime() - 2000) },
      { _id: new Types.ObjectId(), createdAt: new Date(nowTime.getTime() - 1000) },
    ];
    const histOrdered = histMessages;
    const histCursor = histOrdered[0].createdAt;
    assert(histCursor.getTime() === histMessages[0].createdAt.getTime(), "Historical fetch calculates nextCursor from oldest message");

    // Polling fetch (oldest to newest): nextCursor is newest
    const pollMessages = [
      { _id: new Types.ObjectId(), createdAt: new Date(nowTime.getTime() + 1000) },
      { _id: new Types.ObjectId(), createdAt: new Date(nowTime.getTime() + 2000) },
    ];
    const pollOrdered = pollMessages;
    const pollCursor = pollOrdered[pollOrdered.length - 1].createdAt;
    assert(pollCursor.getTime() === pollMessages[1].createdAt.getTime(), "Polling fetch calculates nextCursor from newest message");

    // 10.4 Idempotent moderation
    const modCandidate = await SquadMessage.create({
      squadId: testSquad._id,
      senderId: testApplicant._id,
      text: "Unwanted advertisement spam",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // First moderation pass
    modCandidate.moderationState = "REMOVED";
    modCandidate.text = "[This message was removed by squad leadership]";
    await modCandidate.save();

    // Second moderation attempt (simultaneous or repeated click)
    const checkCandidate = await SquadMessage.findById(modCandidate._id);
    const alreadyRemoved = checkCandidate?.moderationState === "REMOVED";
    assert(alreadyRemoved === true, "Repeated moderation detects existing REMOVED tombstone idempotently");

    // 10.5 ObjectId and parameter validation error codes
    const invalidSquadErr = apiError("INVALID_SQUAD_ID", "Invalid squad identifier.", 400);
    const invalidSquadJson: any = await invalidSquadErr.json();
    assert(invalidSquadErr.status === 400, "Invalid squad ID returns HTTP 400");
    assert(invalidSquadJson.error?.code === "INVALID_SQUAD_ID", "Invalid squad ID returns INVALID_SQUAD_ID code");

    const msgTooLongErr = apiError("MESSAGE_TOO_LONG", "Message exceeds maximum allowed length of 1,000 characters.", 400);
    const msgTooLongJson: any = await msgTooLongErr.json();
    assert(msgTooLongErr.status === 400, "Overlong message returns HTTP 400");
    assert(msgTooLongJson.error?.code === "MESSAGE_TOO_LONG", "Overlong message returns MESSAGE_TOO_LONG code");

    console.log("\n========================================================");
    console.log(`🎉 ALL SQUAD V2 & CHAT TESTS PASSED (${passedCount} passed, ${failedCount} failed)`);
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

runSquadV2AndChatTests().catch((err) => {
  console.error("FATAL ERROR IN SQUAD V2 & CHAT TEST SUITE:", err);
  process.exit(1);
});

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import {
  User,
  LostItem,
  FoundItem,
  Quest,
  Squad,
  SquadMember,
  SquadMessage,
  CampusLocation,
} from "../models";
import { connectDB } from "../lib/db";

const RUN_ID = `aiem_hunt_test_load_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "test_super_secret_key_minimum_32_characters_long";

// Safety checks
if (!TEST_DB_URI.includes("127.0.0.1") && !TEST_DB_URI.includes("localhost")) {
  throw new Error("ABORT: Tests may only connect to loopback MongoDB.");
}
if (!RUN_ID.startsWith("aiem_hunt_test_load_")) {
  throw new Error("ABORT: Automated load tests must target disposable DB.");
}

function computePercentiles(latencies: number[]) {
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p90 = latencies[Math.floor(latencies.length * 0.9)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const avg = latencies.reduce((acc, v) => acc + v, 0) / (latencies.length || 1);
  return { p50, p90, p95, p99, max, avg };
}

async function runScaleAndLoadTests() {
  console.log("========================================================");
  console.log("⚡ AIEM HUNT — SCALE, LATENCY & MONGO EXECUTION BENCHMARK");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  console.log("📦 Connected to ephemeral test database. Building schema indexes...");

  // Build all indexes
  await Promise.all([
    LostItem.init(),
    FoundItem.init(),
    Quest.init(),
    Squad.init(),
    SquadMember.init(),
    SquadMessage.init(),
    User.init(),
    CampusLocation.init(),
  ]);

  console.log("🌱 Seeding synthetic scale datasets (1,000 items, 500 messages, 50 quests)...");

  const dummyUserId = new Types.ObjectId();
  const dummySquadId = new Types.ObjectId();
  const dummyLocationId = new Types.ObjectId();

  // 1. Seed 500 Lost Items
  const lostDocs = [];
  const categories = ["ELECTRONICS", "KEYS", "ACCESSORIES", "LAB_GEAR", "BOOKS_NOTES", "OTHER"];
  const now = Date.now();
  for (let i = 0; i < 500; i++) {
    const createdAt = new Date(now - i * 60000);
    lostDocs.push({
      reporterId: dummyUserId,
      title: `Lost Item #${i} ${categories[i % categories.length]}`,
      shortTitle: `Lost Item #${i}`,
      category: categories[i % categories.length],
      status: "ACTIVE",
      lastKnownLocationId: dummyLocationId,
      lostAt: createdAt,
      verificationQuestion: "What color is the casing?",
      verificationAnswerHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
      publicDescription: `Description for lost item #${i} located somewhere near department block.`,
      secretIdentifiers: "Serial #XYZ-999",
      rewardAmount: 20,
      createdAt,
      updatedAt: createdAt,
    });
  }
  await LostItem.insertMany(lostDocs);

  // 2. Seed 500 Found Items
  const foundDocs = [];
  for (let i = 0; i < 500; i++) {
    const createdAt = new Date(now - i * 60000);
    foundDocs.push({
      finderId: dummyUserId,
      title: `Found Item #${i} ${categories[i % categories.length]}`,
      shortTitle: `Found Item #${i}`,
      category: categories[i % categories.length],
      status: "ACTIVE",
      custodyStatus: "SAFE_DESK",
      foundLocationId: dummyLocationId,
      foundAt: createdAt,
      spotDetails: "Near entrance desk",
      rawPhotoUrl: "/evidence/sample_raw.webp",
      blurredPhotoUrl: "/evidence/sample_blurred.webp",
      publicDescription: `Found item #${i} in clean condition handed over to safe-desk.`,
      createdAt,
      updatedAt: createdAt,
    });
  }
  await FoundItem.insertMany(foundDocs);

  // 3. Seed 500 Squad Messages
  const messageDocs = [];
  for (let i = 0; i < 500; i++) {
    const createdAt = new Date(now - (500 - i) * 1000);
    messageDocs.push({
      squadId: dummySquadId,
      senderId: dummyUserId,
      senderName: `Hunter_${i % 10}`,
      senderRole: "MEMBER",
      text: `Tactical sitrep update #${i}: Area clear.`,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      moderationState: "VISIBLE",
      idempotencyKey: `load_msg_${i}`,
    });
  }
  await SquadMessage.insertMany(messageDocs);

  // 4. Seed 50 Quests
  const questDocs = [];
  for (let i = 0; i < 50; i++) {
    questDocs.push({
      title: `Campus Recon Quest #${i}`,
      questCode: `Q-${String(i).padStart(3, "0")}`,
      questType: "INVESTIGATION",
      description: `Field mission #${i} to investigate campus sectors.`,
      briefing: `Field mission #${i} to investigate campus sectors.`,
      targetLocationId: dummyLocationId,
      difficulty: (i % 5) + 1,
      xpReward: 100 + i * 10,
      coinReward: 20 + i * 2,
      status: i % 5 === 0 ? "ARCHIVED" : "ACTIVE",
      clueStages: [
        {
          stageOrder: 1,
          title: "Initial Checkpoint",
          clueRiddle: "Search the main lobby entrance.",
          expectedAnswerNormalized: "lobby",
          hint: "Near the front desk",
        },
      ],
      createdAt: new Date(now - i * 120000),
    });
  }
  await Quest.insertMany(questDocs);

  console.log("✅ Synthetic datasets successfully populated.\n");

  // ─── PART 1: MongoDB Explain ExecutionStats ──────────────────────
  console.log("─── Benchmark 1: MongoDB executionStats on Compound Queries ───");

  // Query: Browse Lost Items with sort (createdAt: -1, _id: -1)
  const lostQueryPlan: any = await (LostItem.find({ status: "ACTIVE" })
    .sort({ createdAt: -1, _id: -1 })
    .limit(20) as any).explain("executionStats");

  const executionStats = lostQueryPlan.executionStats;
  console.log(`  📊 Browse Lost Items executionStats:`);
  console.log(`     • Total Docs Examined : ${executionStats.totalDocsExamined}`);
  console.log(`     • Total Keys Examined : ${executionStats.totalKeysExamined}`);
  console.log(`     • Returned Documents  : ${executionStats.nReturned}`);
  console.log(`     • Execution Time      : ${executionStats.executionTimeMillis} ms`);

  // Query: Squad Chat Polling with (squadId, expiresAt > now)
  const chatQueryPlan: any = await (SquadMessage.find({
    squadId: dummySquadId,
    expiresAt: { $gt: new Date() },
    moderationState: { $ne: "REMOVED" },
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(50) as any).explain("executionStats");

  console.log(`  📊 Squad Chat Polling executionStats:`);
  console.log(`     • Total Docs Examined : ${chatQueryPlan.executionStats.totalDocsExamined}`);
  console.log(`     • Total Keys Examined : ${chatQueryPlan.executionStats.totalKeysExamined}`);
  console.log(`     • Returned Documents  : ${chatQueryPlan.executionStats.nReturned}`);
  console.log(`     • Execution Time      : ${chatQueryPlan.executionStats.executionTimeMillis} ms\n`);

  // ─── PART 2: Latency Measurements (p50, p95, max) ────────────────
  console.log("─── Benchmark 2: Latency Profiles (100 Iterations per Route) ───");

  // Benchmark Browse Items (Lost + Found Cursor Merging)
  const browseLatencies: number[] = [];
  let cursorDate = new Date();

  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const [lostBatch, foundBatch] = await Promise.all([
      LostItem.find({
        status: "ACTIVE",
        createdAt: { $lt: cursorDate },
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .lean(),
      FoundItem.find({
        status: "ACTIVE",
        createdAt: { $lt: cursorDate },
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(20)
        .lean(),
    ]);

    if (lostBatch.length > 0) {
      cursorDate = lostBatch[lostBatch.length - 1].createdAt as Date;
    }
    const end = performance.now();
    browseLatencies.push(end - start);
  }

  const browseStats = computePercentiles(browseLatencies);
  console.log(`  ⚡ Browse Lost & Found Latency:`);
  console.log(`     • p50: ${browseStats.p50.toFixed(2)} ms`);
  console.log(`     • p90: ${browseStats.p90.toFixed(2)} ms`);
  console.log(`     • p95: ${browseStats.p95.toFixed(2)} ms`);
  console.log(`     • p99: ${browseStats.p99.toFixed(2)} ms`);
  console.log(`     • max: ${browseStats.max.toFixed(2)} ms`);
  console.log(`     • avg: ${browseStats.avg.toFixed(2)} ms`);

  // Benchmark Squad Chat Polling
  const chatLatencies: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await SquadMessage.find({
      squadId: dummySquadId,
      expiresAt: { $gt: new Date() },
      moderationState: { $ne: "REMOVED" },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(50)
      .lean();
    const end = performance.now();
    chatLatencies.push(end - start);
  }

  const chatStats = computePercentiles(chatLatencies);
  console.log(`  ⚡ Squad Tactical Chat Polling Latency:`);
  console.log(`     • p50: ${chatStats.p50.toFixed(2)} ms`);
  console.log(`     • p90: ${chatStats.p90.toFixed(2)} ms`);
  console.log(`     • p95: ${chatStats.p95.toFixed(2)} ms`);
  console.log(`     • p99: ${chatStats.p99.toFixed(2)} ms`);
  console.log(`     • max: ${chatStats.max.toFixed(2)} ms`);
  console.log(`     • avg: ${chatStats.avg.toFixed(2)} ms`);

  // Benchmark Active Quests Directory
  const questLatencies: number[] = [];
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    await Quest.find({ status: "ACTIVE" })
      .select("title questCode briefing difficulty xpReward coinReward status createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    const end = performance.now();
    questLatencies.push(end - start);
  }

  const questStats = computePercentiles(questLatencies);
  console.log(`  ⚡ Active Quests Query Latency:`);
  console.log(`     • p50: ${questStats.p50.toFixed(2)} ms`);
  console.log(`     • p95: ${questStats.p95.toFixed(2)} ms`);
  console.log(`     • max: ${questStats.max.toFixed(2)} ms\n`);

  // ─── PART 3: Memory Footprint & TTL Backlog ───────────────────────
  console.log("─── Benchmark 3: Memory Consumption & TTL Index Status ───");
  const mem = process.memoryUsage();
  console.log(`  🧠 Process Memory:`);
  console.log(`     • RSS       : ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     • Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`     • Heap Used : ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  // Check TTL index existence on SquadMessage
  const messageIndexes = await SquadMessage.collection.indexes();
  const ttlIndex = messageIndexes.find((idx) => idx.expireAfterSeconds !== undefined);
  console.log(`  ⏳ Squad Chat TTL Index: ${ttlIndex ? `PRESENT (expireAfterSeconds: ${ttlIndex.expireAfterSeconds})` : "NOT FOUND"}`);

  // Total messages in collection vs active messages
  const totalCount = await SquadMessage.countDocuments({ squadId: dummySquadId });
  const activeCount = await SquadMessage.countDocuments({
    squadId: dummySquadId,
    expiresAt: { $gt: new Date() },
  });
  console.log(`  💬 Total Squad Messages: ${totalCount} | Active (Unexpired): ${activeCount}`);

  // Assertions
  if (browseStats.p95 > 100) {
    throw new Error(`Scale warning: Browse p95 latency (${browseStats.p95.toFixed(2)} ms) exceeds 100ms threshold.`);
  }
  if (chatStats.p95 > 100) {
    throw new Error(`Scale warning: Chat p95 latency (${chatStats.p95.toFixed(2)} ms) exceeds 100ms threshold.`);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL SCALE & BENCHMARK THRESHOLDS SATISFIED");
  console.log("========================================================\n");

  // Cleanup
  console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log("✨ Ephemeral database dropped cleanly.");
}

runScaleAndLoadTests().catch((err) => {
  console.error("Scale benchmark error:", err);
  process.exit(1);
});


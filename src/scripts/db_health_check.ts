import fs from "fs";
import path from "path";

// Load .env.local natively if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {
  // ignore
}

import mongoose from "mongoose";
import { connectDB } from "../lib/db";

async function main() {
  const startTime = Date.now();
  console.log("========================================================");
  console.log("🩺 AIEM HUNT — DATABASE HEALTH & LATENCY INSPECTOR");
  console.log(`   Target DB URI: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt"}`);
  console.log("========================================================\n");

  const connStart = Date.now();
  await connectDB();
  const connDuration = Date.now() - connStart;

  console.log(`✅ Connection Established in ${connDuration}ms`);
  console.log(`   Host: ${mongoose.connection.host}`);
  console.log(`   Port: ${mongoose.connection.port}`);
  console.log(`   Database Name: ${mongoose.connection.name}`);
  console.log(`   ReadyState: ${mongoose.connection.readyState} (1 = connected)\n`);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Unable to obtain native MongoDB handle.");
  }

  // 1. Admin Ping & Build Info
  const pingStart = Date.now();
  await db.admin().ping();
  const pingLatency = Date.now() - pingStart;
  console.log(`📡 Ping Latency: ${pingLatency}ms`);

  const buildInfo = await db.admin().command({ buildInfo: 1 });
  console.log(`   Engine Version: MongoDB v${buildInfo.version}`);

  // 2. Replica Set / Standalone Status
  try {
    const isMaster = await db.admin().command({ isMaster: 1 });
    console.log(`   Cluster Topology: ${isMaster.setName ? `ReplicaSet '${isMaster.setName}'` : "Standalone"}`);
    if (isMaster.setName) {
      console.log(`   Primary Node: ${isMaster.primary || "N/A"}`);
      console.log(`   Is Writable Primary: ${isMaster.ismaster}`);
    }
  } catch {
    // Non-critical info
  }

  // 3. Write / Read Round-Trip Benchmark
  console.log("\n🧪 Running Ephemeral Write / Read Probe...");
  const probeCollection = db.collection("_db_health_probe");
  const testId = `probe_${Date.now()}`;

  const writeStart = Date.now();
  await probeCollection.insertOne({ _id: testId as any, timestamp: new Date() });
  const writeDuration = Date.now() - writeStart;

  const readStart = Date.now();
  const doc = await probeCollection.findOne({ _id: testId as any });
  const readDuration = Date.now() - readStart;

  await probeCollection.deleteOne({ _id: testId as any });

  console.log(`   Write Latency: ${writeDuration}ms`);
  console.log(`   Read Latency:  ${readDuration}ms`);
  console.log(`   Probe Success: ${doc ? "PASSED" : "FAILED"}`);

  // 4. Collection Inventory
  const collections = await db.listCollections().toArray();
  console.log(`\n📊 Active Collections Inventory (${collections.length} total):`);
  for (const c of collections) {
    const count = await db.collection(c.name).estimatedDocumentCount();
    console.log(`   • ${c.name.padEnd(28)} : ~${count} documents`);
  }

  const totalTime = Date.now() - startTime;
  console.log("\n========================================================");
  console.log(`🎉 DATABASE HEALTH CHECK: HEALTHY (Completed in ${totalTime}ms)`);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Database Health Check Failed:", err);
  process.exit(1);
});


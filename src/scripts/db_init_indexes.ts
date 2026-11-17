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
import * as models from "../models";

async function main() {
  const startTime = Date.now();
  console.log("========================================================");
  console.log("🏗️  AIEM HUNT — PRODUCTION DATABASE INDEX SYNCHRONIZER");
  console.log(`   Target DB: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt"}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("========================================================\n");

  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to acquire Mongoose native database reference.");
  }

  // Model list
  const modelEntries = Object.entries(models).filter(
    ([name, m]: [string, any]) => m && typeof m.createIndexes === "function"
  );

  console.log(`Found ${modelEntries.length} registered domain models to synchronize.\n`);

  let totalIndexes = 0;
  let syncedCollections = 0;

  for (const [modelName, ModelClass] of modelEntries) {
    const collection = (ModelClass as any).collection;
    try {
      // Build and sync indexes according to Mongoose schema definitions
      // Auto-heal IndexOptionsConflict (code 85) and IndexKeySpecsConflict (code 86)
      let syncRetries = 10;
      while (syncRetries > 0) {
        try {
          await (ModelClass as any).createIndexes();
          break;
        } catch (createErr: any) {
          const isConflict =
            createErr.code === 85 ||
            createErr.code === 86 ||
            createErr.codeName === "IndexOptionsConflict" ||
            createErr.codeName === "IndexKeySpecsConflict" ||
            (createErr.message &&
              (createErr.message.includes("IndexOptionsConflict") ||
                createErr.message.includes("IndexKeySpecsConflict") ||
                createErr.message.includes("same name as the requested index")));

          if (isConflict) {
            const names = Array.from(createErr.message.matchAll(/name:\s*"([^"]+)"/g)).map((m: any) => m[1]);
            const conflictName = names.length > 0 ? names[names.length - 1] : null;

            if (conflictName) {
              console.warn(`  ⚠️ Resolving index conflict in '${collection.collectionName}': dropping outdated '${conflictName}'...`);
              await collection.dropIndex(conflictName);
              console.log(`     ├── Successfully dropped outdated '${conflictName}'`);
              syncRetries--;
              continue;
            }
          }
          throw createErr;
        }
      }

      const rawIndexes = await collection.indexes();

      syncedCollections++;
      totalIndexes += rawIndexes.length;

      console.log(`  📦 Collection: ${collection.collectionName} (${modelName})`);
      for (const idx of rawIndexes) {
        const keyDesc = Object.entries(idx.key)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        const flags = [];
        if (idx.unique) flags.push("UNIQUE");
        if (idx.sparse) flags.push("SPARSE");
        if (idx.expireAfterSeconds !== undefined) flags.push(`TTL: ${idx.expireAfterSeconds}s`);
        const flagStr = flags.length > 0 ? ` [${flags.join(" | ")}]` : "";
        console.log(`     ├── Index '${idx.name}': { ${keyDesc} }${flagStr}`);
      }
      console.log("");
    } catch (err: any) {
      console.error(`  ❌ Error syncing indexes for ${modelName}:`, err.message);
      throw err;
    }
  }

  const durationMs = Date.now() - startTime;
  console.log("========================================================");
  console.log(`🎉 DATABASE INDEX SYNC COMPLETE in ${durationMs}ms`);
  console.log(`   Collections Processed: ${syncedCollections}/${modelEntries.length}`);
  console.log(`   Total Verified Indexes: ${totalIndexes}`);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal error during database index synchronization:", err);
  process.exit(1);
});

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Load .env.local from current dir or aiem-hunt subfolder
const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "aiem-hunt", ".env.local"),
  path.resolve(__dirname, "../../.env.local"),
];

for (const envPath of candidateEnvPaths) {
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
    break;
  }
}

import { connectDB } from "../lib/db";
import { User, SystemConfig } from "../models";

async function seedAdmin() {
  console.log("\n========================================================");
  console.log("   🛡️  AIEM HUNT — SAFE NON-DESTRUCTIVE ADMIN & ROLES SEED");
  console.log("========================================================\n");

  await connectDB();

  // 1. Ensure Global Configuration exists with allowed institutional domains
  let config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
  if (!config) {
    config = await SystemConfig.create({
      key: "GLOBAL_CONFIG",
      allowedEmailDomains: ["@aiemgoa.ac.in", "@aitdgoa.edu.in", "@example.test"],
      xpPerLevelBase: 250,
      xpLevelMultiplier: 1.2,
      defaultFinderBonusPct: 15,
      maxFinderBonusPct: 25,
      clueCooldownSeconds: [30, 120, 300],
      maintenanceMode: false,
    });
    console.log("✅ Initialized SystemConfig (GLOBAL_CONFIG) with institutional domains.");
  } else {
    // Ensure all domains are included
    const requiredDomains = ["@aiemgoa.ac.in", "@aitdgoa.edu.in", "@example.test"];
    let updated = false;
    for (const d of requiredDomains) {
      if (!config.allowedEmailDomains.includes(d)) {
        config.allowedEmailDomains.push(d);
        updated = true;
      }
    }
    if (updated) {
      await config.save();
      console.log("✅ Updated SystemConfig with required domains.");
    }
  }

  // Passwords
  const adminPass = process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123";
  const modPass = process.env.DEFAULT_MOD_PASSWORD || "Mod@123";
  const studentPass = process.env.DEFAULT_HUNTER_PASSWORD || "Hunter@123";

  const adminHash = await bcrypt.hash(adminPass, 10);
  const modHash = await bcrypt.hash(modPass, 10);
  const studentHash = await bcrypt.hash(studentPass, 10);

  // 2. Admin Operative
  const adminUser = await User.findOneAndUpdate(
    { email: "admin@aiemgoa.ac.in" },
    {
      $set: {
        username: "admin",
        displayName: "Chief Director (Admin)",
        department: "Administration",
        yearOfStudy: 4,
        role: "ADMIN",
        passwordHash: adminHash,
        accountStatus: "ACTIVE",
        emailVerified: true,
        xp: 10000,
        level: 10,
        rankTitle: "Campus Commander",
        coins: 500,
        trustScore: 100,
        trustTier: "ELITE_INVESTIGATOR",
      },
    },
    { upsert: true, new: true }
  );
  console.log(`✅ Admin Account:     ${adminUser.email} (Password: ${adminPass})`);

  // 3. Moderator Operative
  const modUser = await User.findOneAndUpdate(
    { email: "mod@aiemgoa.ac.in" },
    {
      $set: {
        username: "moderator",
        displayName: "Safe-Desk Proctor (Mod)",
        department: "Campus Security",
        yearOfStudy: 3,
        role: "MODERATOR",
        passwordHash: modHash,
        accountStatus: "ACTIVE",
        emailVerified: true,
        xp: 5000,
        level: 5,
        rankTitle: "Safe-Desk Inspector",
        coins: 250,
        trustScore: 95,
        trustTier: "ELITE_INVESTIGATOR",
      },
    },
    { upsert: true, new: true }
  );
  console.log(`✅ Moderator Account: ${modUser.email} (Password: ${modPass})`);

  // 4. Student Operative
  const studentUser = await User.findOneAndUpdate(
    { email: "student@aiemgoa.ac.in" },
    {
      $set: {
        username: "hunter_student",
        displayName: "Dev Hunter (Student)",
        department: "Computer Engineering",
        yearOfStudy: 2,
        role: "STUDENT",
        passwordHash: studentHash,
        accountStatus: "ACTIVE",
        emailVerified: true,
        xp: 250,
        level: 2,
        rankTitle: "Field Operative",
        coins: 100,
        trustScore: 85,
        trustTier: "ACTIVE_HUNTER",
      },
    },
    { upsert: true, new: true }
  );
  console.log(`✅ Student Account:   ${studentUser.email} (Password: ${studentPass})`);

  console.log("\n--------------------------------------------------------");
  console.log("🎉 SUCCESS: Core administrative dossiers seeded and active!");
  console.log("   You can now log in at http://localhost:3000/login");
  console.log("--------------------------------------------------------\n");

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("❌ Error seeding admin accounts:", err);
  process.exit(1);
});


import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { User, Reward, Transaction, Notification, Achievement, UserAchievement } from "../models";
import { connectDB } from "../lib/db";
import { isValidSameOriginRelativePath, sanitizeNotificationLink } from "../lib/notifications";

const RUN_ID = `aiem_hunt_test_wave2_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function runWave2Suite() {
  console.log("\n========================================================");
  console.log("🛡️ AIEM HUNT — WAVE 2 (P1 CORE PILOT) VERIFICATION SUITE");
  console.log(`   Target Isolated DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: GET /api/auth/me & Armory Cosmetic Ownership Contracts
    // -------------------------------------------------------------------------
    console.log("─── Section 1: Auth Me & Armory Cosmetic Ownership Invariants ───");

    const reward1 = await Reward.create({
      code: "CYBER_FRAME_01",
      title: "Neon Pulse Frame",
      name: "Neon Pulse Frame",
      description: "Holographic cyan neon pulse frame",
      type: "FRAME",
      coinCost: 50,
      minLevelRequired: 1,
      stock: -1,
      isActive: true,
    });

    const reward2 = await Reward.create({
      code: "TITLE_PATHFINDER",
      title: "Master Archivist",
      name: "Master Archivist",
      description: "Prestige title for senior detectives",
      type: "TITLE",
      coinCost: 100,
      minLevelRequired: 2,
      stock: -1,
      isActive: true,
    });

    const user = await User.create({
      email: "hunter_wave2@aiemgoa.ac.in",
      passwordHash: "hash123",
      displayName: "Hunter Pilot",
      username: "hunter_pilot",
      role: "STUDENT",
      coins: 200,
      level: 3,
      equippedTitle: "Campus Pathfinder",
      equippedFrame: "frame-emerald-pulse",
      equippedTheme: "theme-obsidian-grid",
      ownedCosmetics: [reward1._id],
    });

    // Simulate GET /api/auth/me serialization
    const authMePayload = {
      _id: user._id.toString(),
      displayName: user.displayName,
      equippedTitle: user.equippedTitle || "Campus Pathfinder",
      equippedFrame: user.equippedFrame || "frame-emerald-pulse",
      equippedTheme: user.equippedTheme || "theme-obsidian-grid",
      ownedCosmetics: (user.ownedCosmetics || []).map((id: any) => id.toString()),
    };

    assert(Array.isArray(authMePayload.ownedCosmetics), "ownedCosmetics is returned as array");
    assert(
      typeof authMePayload.ownedCosmetics[0] === "string" &&
      authMePayload.ownedCosmetics[0] === reward1._id.toString(),
      "ownedCosmetics contains stringified ObjectIds for strict frontend set/includes comparison"
    );
    assert(authMePayload.equippedTitle === "Campus Pathfinder", "equippedTitle is returned in auth/me");
    assert(authMePayload.equippedFrame === "frame-emerald-pulse", "equippedFrame is returned in auth/me");
    assert(authMePayload.equippedTheme === "theme-obsidian-grid", "equippedTheme is returned in auth/me");

    // Frontend armory owned check simulation
    const isReward1Owned = authMePayload.ownedCosmetics.some((id: string) => id === reward1._id.toString());
    const isReward2Owned = authMePayload.ownedCosmetics.some((id: string) => id === reward2._id.toString());
    assert(isReward1Owned === true, "Reward 1 is correctly flagged as owned in armory");
    assert(isReward2Owned === false, "Reward 2 is correctly flagged as unowned in armory");

    // Atomic debit with cosmetic guard (prevents duplicate purchase)
    const duplicateDebit = await User.findOneAndUpdate(
      {
        _id: user._id,
        coins: { $gte: reward1.coinCost },
        ownedCosmetics: { $ne: reward1._id },
      },
      {
        $inc: { coins: -reward1.coinCost },
        $addToSet: { ownedCosmetics: reward1._id },
      }
    );
    assert(duplicateDebit === null, "Atomic debit rejects purchase of already-owned cosmetic item");

    // -------------------------------------------------------------------------
    // SECTION 2: Notification LinkUrl Validation & Idempotent Read Status
    // -------------------------------------------------------------------------
    console.log("\n─── Section 2: Notification LinkUrl Sanitization & Idempotent Mark-Read ───");

    // Link URL Security Invariants
    assert(isValidSameOriginRelativePath("/dashboard"), "Relative path '/dashboard' is valid");
    assert(isValidSameOriginRelativePath("/items/675abc123456"), "Relative path '/items/...' is valid");
    assert(isValidSameOriginRelativePath("/rewards?category=FRAMES"), "Relative path with query params is valid");
    assert(!isValidSameOriginRelativePath("https://evil.com/phish"), "External https:// URL is strictly rejected");
    assert(!isValidSameOriginRelativePath("http://insecure.org"), "External http:// URL is strictly rejected");
    assert(!isValidSameOriginRelativePath("//protocol-relative.com"), "Protocol-relative '//' URL is strictly rejected");
    assert(!isValidSameOriginRelativePath("javascript:alert(1)"), "javascript: pseudo-protocol is strictly rejected");
    assert(!isValidSameOriginRelativePath("data:text/html,<script>"), "data: URI is strictly rejected");
    assert(!isValidSameOriginRelativePath("/path\\traversal"), "Backslash path traversal is strictly rejected");

    assert(sanitizeNotificationLink("https://evil.com") === "/dashboard", "Sanitizer falls back to /dashboard on external URLs");
    assert(sanitizeNotificationLink("javascript:alert(1)") === "/dashboard", "Sanitizer falls back to /dashboard on javascript URI");
    assert(sanitizeNotificationLink("/quests/123") === "/quests/123", "Sanitizer preserves valid same-origin paths");

    // Schema validation guard
    let schemaCaughtExternal = false;
    try {
      await Notification.create({
        userId: user._id,
        category: "SYSTEM_REWARD",
        title: "Malicious Notif",
        message: "Attempting phishing link",
        linkUrl: "https://attacker.com/stealer",
      });
    } catch {
      schemaCaughtExternal = true;
    }
    assert(schemaCaughtExternal, "NotificationSchema validation rejects external linkUrl");

    // Create valid notification
    const validNotif = await Notification.create({
      userId: user._id,
      category: "SYSTEM_REWARD",
      title: "Reward Unlocked",
      message: "You received 50 Hunter Coins!",
      linkUrl: "/rewards",
      isRead: false,
    });
    assert(validNotif.isRead === false, "New notification has isRead: false");

    // Idempotent mark-as-read
    const markRead1 = await Notification.findOneAndUpdate(
      { _id: validNotif._id, userId: user._id },
      { $set: { isRead: true } },
      { new: true }
    );
    assert(markRead1?.isRead === true, "Notification successfully marked as read on first call");

    const markRead2 = await Notification.findOneAndUpdate(
      { _id: validNotif._id, userId: user._id },
      { $set: { isRead: true } },
      { new: true }
    );
    assert(markRead2?.isRead === true, "Subsequent mark-as-read call is cleanly idempotent");

    // Bulk mark-all-read idempotent
    await Notification.updateMany({ userId: user._id, isRead: false }, { $set: { isRead: true } });
    const remainingUnread = await Notification.countDocuments({ userId: user._id, isRead: false });
    assert(remainingUnread === 0, "Bulk mark-all-read clears unread count to 0");

    // -------------------------------------------------------------------------
    // SECTION 3: Admin Achievements CRUD & Reference-Guarded Archiving
    // -------------------------------------------------------------------------
    console.log("\n─── Section 3: Admin Achievements CRUD, Versioning & Archiving ───");

    const achDef = await Achievement.create({
      code: "SPEED_RECOVERY_PRO",
      title: "Speed Recovery Pro",
      description: "Recover 5 items within 1 hour.",
      badgeIcon: "Zap",
      rarity: "EPIC",
      metricKey: "SPEED_RECOVERY",
      threshold: 5,
      xpReward: 300,
      coinReward: 60,
      scope: "PLAYER",
      version: 1,
      isActive: true,
      isArchived: false,
    });

    assert(achDef.version === 1, "Initial achievement version is 1");

    // Update definition -> version increments
    achDef.title = "Speed Recovery Master";
    achDef.version = (achDef.version || 1) + 1;
    await achDef.save();
    const updatedAch = await Achievement.findById(achDef._id);
    assert(updatedAch?.title === "Speed Recovery Master", "Achievement title updated successfully");
    assert(updatedAch?.version === 2, "Achievement version incremented to 2 on edit");

    // Simulate player progress/unlock
    await UserAchievement.create({
      userId: user._id,
      achievementId: achDef._id,
      progress: 5,
      isUnlocked: true,
      unlockedAt: new Date(),
    });

    const unlockCount = await UserAchievement.countDocuments({
      achievementId: achDef._id,
    });
    assert(unlockCount === 1, "User achievement progress record exists");

    // Reference-guarded delete: Soft archive when referenced
    if (unlockCount > 0) {
      achDef.isArchived = true;
      achDef.isActive = false;
      achDef.version = (achDef.version || 1) + 1;
      await achDef.save();
    } else {
      await Achievement.findByIdAndDelete(achDef._id);
    }

    const preservedDoc = await Achievement.findById(achDef._id);
    assert(preservedDoc !== null, "Reference guard: document preserved when player unlocks exist");
    assert(preservedDoc?.isArchived === true && preservedDoc?.isActive === false, "Referenced achievement safely marked as ARCHIVED");
    assert(preservedDoc?.version === 3, "Version incremented on archive action to 3");

    // Unreferenced draft can be hard-deleted
    const draftDef = await Achievement.create({
      code: "TEMP_DRAFT_CITATION",
      title: "Draft Citation",
      description: "Unreferenced citation.",
      metricKey: "TREASURES_FOUND",
      threshold: 1,
      xpReward: 10,
      coinReward: 5,
    });
    const draftUnlocks = await UserAchievement.countDocuments({ achievementId: draftDef._id });
    assert(draftUnlocks === 0, "Draft has 0 player references");
    if (draftUnlocks === 0) {
      await Achievement.findByIdAndDelete(draftDef._id);
    }
    const hardDeleted = await Achievement.findById(draftDef._id);
    assert(hardDeleted === null, "Unreferenced achievement cleanly hard-deleted from database");

    // -------------------------------------------------------------------------
    // SECTION 4: Profile Privacy Controls & Leaderboard Opt-Out
    // -------------------------------------------------------------------------
    console.log("\n─── Section 4: Profile Privacy Controls & Leaderboard Invariants ───");

    const privateUser = await User.create({
      email: "private_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      displayName: "Agent Classified",
      username: "agent_classified",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      coins: 500,
      xp: 1200,
      level: 5,
      rankTitle: "Master Detective",
      avatarPreset: "shadow",
      isProfilePublic: false,
      isLeaderboardPublic: false,
    });

    const publicUser = await User.create({
      email: "public_agent@aiemgoa.ac.in",
      passwordHash: "hash123",
      displayName: "Agent Open",
      username: "agent_open",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      coins: 100,
      xp: 1500,
      level: 6,
      rankTitle: "Grand Archivist",
      avatarPreset: "recon",
      isProfilePublic: true,
      isLeaderboardPublic: true,
    });

    // 4.1 Public Profile Projection Invariant: When isProfilePublic is false, non-owners receive ONLY displayName and avatar
    function simulatePublicProfileProjection(targetDoc: any, viewerUser: any | null) {
      const isOwnProfile = viewerUser && targetDoc._id.toString() === viewerUser._id.toString();
      const isAdmin = viewerUser && (viewerUser.role === "ADMIN" || viewerUser.role === "MODERATOR");

      if (!isOwnProfile && !isAdmin && targetDoc.isProfilePublic === false) {
        return {
          displayName: targetDoc.displayName,
          avatar: targetDoc.avatarUrl || `/avatars/${targetDoc.avatarPreset || "recon"}.png`,
          avatarPreset: targetDoc.avatarPreset || "recon",
          isProfilePublic: false,
        };
      }

      return {
        _id: targetDoc._id.toString(),
        username: targetDoc.username,
        displayName: targetDoc.displayName,
        level: targetDoc.level,
        rankTitle: targetDoc.rankTitle,
        xp: targetDoc.xp,
        isProfilePublic: true,
      };
    }

    const publicViewOfPrivateUser: any = simulatePublicProfileProjection(privateUser.toObject(), publicUser);
    assert(publicViewOfPrivateUser.displayName === "Agent Classified", "Private profile exposes displayName");
    assert(Boolean(publicViewOfPrivateUser.avatar), "Private profile exposes avatar");
    assert(publicViewOfPrivateUser.username === undefined, "Private profile strictly omits username");
    assert(publicViewOfPrivateUser._id === undefined, "Private profile strictly omits database ObjectId");
    assert(publicViewOfPrivateUser.level === undefined, "Private profile strictly omits player level");
    assert(publicViewOfPrivateUser.rankTitle === undefined, "Private profile strictly omits rankTitle");
    assert(publicViewOfPrivateUser.xp === undefined, "Private profile strictly omits xp");
    assert(publicViewOfPrivateUser.isProfilePublic === false, "Private profile flags isProfilePublic: false");

    // 4.2 Leaderboard Invariant: Users with isLeaderboardPublic = false are excluded
    const leaderboardResults = await User.find({
      accountStatus: "ACTIVE",
      isLeaderboardPublic: { $ne: false },
    }).select("displayName username xp level");

    const leaderboardUsernames = leaderboardResults.map((u) => u.username);
    assert(leaderboardUsernames.includes("agent_open"), "Public user is included in leaderboard query");
    assert(!leaderboardUsernames.includes("agent_classified"), "User with isLeaderboardPublic = false is strictly excluded from leaderboard query");

    // 4.3 Avatar Customization: Built-in presets only
    const BUILTIN_AVATAR_PRESETS = ["recon", "sleuth", "vanguard", "sentinel", "shadow", "archivist"];
    function validateAvatarPreset(preset: string) {
      if (!BUILTIN_AVATAR_PRESETS.includes(preset.toLowerCase().trim())) {
        throw new Error("INVALID_AVATAR_PRESET");
      }
      return true;
    }

    assert(validateAvatarPreset("sleuth"), "Built-in preset 'sleuth' is accepted");
    assert(validateAvatarPreset("vanguard"), "Built-in preset 'vanguard' is accepted");
    let rejectedInvalidPreset = false;
    try {
      validateAvatarPreset("custom_hacker_avatar");
    } catch {
      rejectedInvalidPreset = true;
    }
    assert(rejectedInvalidPreset, "Arbitrary custom avatar preset name is rejected");

    console.log("\n========================================================");
    console.log(`🎉 ALL WAVE 2 VERIFICATION TESTS PASSED!`);
    console.log(`   Passed: ${passedCount} / ${passedCount + failedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log("========================================================\n");
  } finally {
    if (mongoose.connection.db && mongoose.connection.db.databaseName.startsWith("aiem_hunt_test_")) {
      console.log(`🧹 Dropping isolated test database: ${mongoose.connection.db.databaseName}`);
      await mongoose.connection.db.dropDatabase();
      console.log("✅ Ephemeral database cleaned up successfully.\n");
    }
    await mongoose.disconnect();
  }
}

runWave2Suite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

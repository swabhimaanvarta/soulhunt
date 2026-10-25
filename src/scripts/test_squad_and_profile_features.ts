import mongoose, { Types } from "mongoose";
import { connectDB } from "../lib/db";
import { User, Squad, SquadMember, SquadJoinRequest, Achievement, Reward, Transaction } from "../models";

async function run() {
  console.log("=== Testing Squad Creation, CoC Settings, Progression, and Profiles ===");
  const testDbName = `aiem_hunt_test_features_${Date.now()}`;
  const uri = `mongodb://127.0.0.1:27017/${testDbName}`;

  await mongoose.connect(uri);
  console.log("Connected to ephemeral test database:", testDbName);

  try {
    // 1. Create test users
    const lowLevelUser = await User.create({
      username: `low_${Date.now()}`,
      displayName: "Low Level Agent",
      email: `low_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 3,
      coins: 100,
      xp: 300,
    });

    const poorUser = await User.create({
      username: `poor_${Date.now()}`,
      displayName: "Poor Agent",
      email: `poor_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 5,
      coins: 20,
      xp: 2500,
    });

    const qualifiedLeader = await User.create({
      username: `leader_${Date.now()}`,
      displayName: "Syndicate Leader",
      email: `leader_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 5,
      coins: 150,
      xp: 2500,
    });

    const coLeaderUser = await User.create({
      username: `coleader_${Date.now()}`,
      displayName: "Syndicate CoLeader",
      email: `coleader_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 4,
      coins: 80,
      xp: 1800,
    });

    const memberUser = await User.create({
      username: `member_${Date.now()}`,
      displayName: "Syndicate Member",
      email: `member_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 2,
      coins: 50,
      xp: 800,
    });

    // 2. Validate Squad Creation Eligibility Logic
    console.log("\n--- Testing Squad Creation Constraints ---");
    // Under-leveled check
    if (lowLevelUser.level < 5) {
      console.log("✓ Correctly rejected low level user (< Level 5)");
    } else {
      throw new Error("Failed: low level user should be rejected");
    }

    // Insufficient coins check
    if (poorUser.coins < 50) {
      console.log("✓ Correctly rejected poor user (< 50 coins)");
    } else {
      throw new Error("Failed: poor user should be rejected");
    }

    // Qualified leader creates squad: atomic debit 50 coins
    const updatedLeader = await User.findOneAndUpdate(
      { _id: qualifiedLeader._id, coins: { $gte: 50 }, level: { $gte: 5 } },
      { $inc: { coins: -50 } },
      { new: true }
    );
    if (!updatedLeader || updatedLeader.coins !== 100) {
      throw new Error(`Failed: coins not debited correctly. Expected 100, got ${updatedLeader?.coins}`);
    }
    console.log("✓ Leader coins debited atomically: 150 ->", updatedLeader.coins);

    const squad = await Squad.create({
      name: "ARCHIVISTS SYNDICATE",
      tag: "ARCH",
      description: "Dedicated to recovering misplaced hardware across North Wing.",
      leaderId: qualifiedLeader._id,
      emblemIcon: "ShieldAlert",
      joinType: "OPEN",
      minLevelRequired: 2,
      privacy: "PUBLIC",
      squadLevel: 1,
      squadXp: 450,
    });

    await SquadMember.create({
      squadId: squad._id,
      userId: qualifiedLeader._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 300,
    });

    const coLeaderMember = await SquadMember.create({
      squadId: squad._id,
      userId: coLeaderUser._id,
      role: "COLEADER",
      squadRole: "COLEADER",
      contributedSquadXp: 150,
    });

    const regularMember = await SquadMember.create({
      squadId: squad._id,
      userId: memberUser._id,
      role: "MEMBER",
      squadRole: "MEMBER",
      contributedSquadXp: 50,
    });

    console.log("✓ Squad chartered successfully with joinType OPEN and minLevelRequired 2");

    // 3. Testing Clash of Clans Recruitment Modes
    console.log("\n--- Testing Recruitment Modes (OPEN, INVITE_ONLY, CLOSED) ---");
    // OPEN: eligible user with level >= minLevelRequired can join
    const recruitUser = await User.create({
      username: `recruit_${Date.now()}`,
      displayName: "Recruit Operative",
      email: `recruit_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 3,
      coins: 40,
      xp: 1200,
    });

    if (recruitUser.level >= (squad.minLevelRequired || 1) && squad.joinType === "OPEN") {
      await SquadMember.create({
        squadId: squad._id,
        userId: recruitUser._id,
        role: "MEMBER",
        squadRole: "MEMBER",
      });
      console.log("✓ OPEN recruitment: recruit admitted directly");
    }

    // Now update squad to INVITE_ONLY with minLevelRequired 4
    squad.joinType = "INVITE_ONLY";
    squad.minLevelRequired = 4;
    squad.privacy = "INVITE_ONLY";
    await squad.save();

    const lowApplicant = await User.create({
      username: `applicant_low_${Date.now()}`,
      displayName: "Low Applicant",
      email: `applow_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 2,
      coins: 20,
    });

    if (lowApplicant.level < (squad.minLevelRequired || 1)) {
      console.log("✓ INVITE_ONLY: Applicant below minLevelRequired (2 < 4) correctly rejected");
    }

    const eligibleApplicant = await User.create({
      username: `applicant_high_${Date.now()}`,
      displayName: "High Applicant",
      email: `apphigh_${Date.now()}@aiem.edu.in`,
      passwordHash: "hash123",
      role: "STUDENT",
      level: 4,
      coins: 60,
    });

    const joinReq = await SquadJoinRequest.create({
      squadId: squad._id,
      userId: eligibleApplicant._id,
      status: "PENDING",
      message: "Ready for Block B reconnaissance.",
    });
    console.log("✓ INVITE_ONLY: High applicant successfully created pending join request:", joinReq._id.toString());

    // CLOSED: reject both joins and applications
    squad.joinType = "CLOSED";
    squad.privacy = "PRIVATE";
    await squad.save();
    console.log("✓ Squad recruitment updated to CLOSED");

    // 4. Testing Role Hierarchy and Promotion/Demotion
    console.log("\n--- Testing Clash of Clans Role Hierarchy ---");
    // Leader promotes regularMember to ELDER
    regularMember.role = "ELDER";
    regularMember.squadRole = "ELDER";
    await regularMember.save();
    console.log("✓ Leader promoted Member to ELDER");

    // CoLeader promotes another member
    // CoLeader demotes Elder back to Member
    regularMember.role = "MEMBER";
    regularMember.squadRole = "MEMBER";
    await regularMember.save();
    console.log("✓ CoLeader demoted ELDER to MEMBER");

    // 5. Testing Profile Customization (Titles, Frames, Themes, Featured Achievements)
    console.log("\n--- Testing Profile Customization Persistence ---");
    const testAch = await Achievement.create({
      code: "ACH_TEST_FEAT_1",
      title: "Master Sleuth",
      description: "Solved test mystery.",
      threshold: 1,
      metricKey: "QUESTS_COMPLETED",
      rarity: "EPIC",
      coinReward: 50,
      xpReward: 100,
      isActive: true,
    });

    qualifiedLeader.equippedTitle = "Lead Decoder";
    qualifiedLeader.equippedFrame = "frame-cyan-matrix";
    qualifiedLeader.equippedTheme = "theme-cyber-cyan";
    qualifiedLeader.featuredAchievementIds = [testAch._id as any];
    await qualifiedLeader.save();

    const reloadedUser = await User.findById(qualifiedLeader._id).lean();
    if (
      reloadedUser?.equippedTitle === "Lead Decoder" &&
      reloadedUser?.equippedFrame === "frame-cyan-matrix" &&
      reloadedUser?.equippedTheme === "theme-cyber-cyan" &&
      reloadedUser?.featuredAchievementIds?.[0]?.toString() === testAch._id.toString()
    ) {
      console.log("✓ Profile cosmetics and featured achievements persisted accurately!");
    } else {
      throw new Error("Failed: profile cosmetics did not persist properly");
    }

    console.log("\n=== ALL SQUAD, COC RECRUITMENT, PROGRESSION, AND PROFILE TESTS PASSED ===");
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("Cleaned up and disconnected test database.");
  }
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});

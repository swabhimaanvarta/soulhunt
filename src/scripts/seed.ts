import bcrypt from "bcryptjs";
import { connectDB } from "../lib/db";
import {
  SystemConfig,
  CampusLocation,
  User,
  Squad,
  SquadMember,
  LostItem,
  FoundItem,
  ClaimRequest,
  Quest,
  Clue,
  Investigation,
  Achievement,
  Reward,
  Event,
  Notification,
} from "../models";

export async function runSeed() {
  await connectDB();
  console.log("🌱 Starting AIEM Hunt V1.0 Deterministic Database Seed...");

  await Promise.all([
    SystemConfig.deleteMany({}),
    CampusLocation.deleteMany({}),
    User.deleteMany({}),
    Squad.deleteMany({}),
    SquadMember.deleteMany({}),
    LostItem.deleteMany({}),
    FoundItem.deleteMany({}),
    ClaimRequest.deleteMany({}),
    Quest.deleteMany({}),
    Clue.deleteMany({}),
    Investigation.deleteMany({}),
    Achievement.deleteMany({}),
    Reward.deleteMany({}),
    Event.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  await SystemConfig.create({
    key: "GLOBAL_CONFIG",
    allowedEmailDomains: ["@student.aiem.edu", "@aiem.edu"],
    xpPerLevelBase: 250,
    xpLevelMultiplier: 1.2,
    defaultFinderBonusPct: 15,
    maxFinderBonusPct: 25,
    pairCollusionWindowDays: 30,
    pairCollusionMaxCount: 2,
    dailyReportLimitPerUser: 5,
    clueCooldownSeconds: [30, 120, 300],
    globalXpMultiplier: 1.0,
    globalCoinMultiplier: 1.0,
    maintenanceMode: false,
  });

  const locations = await CampusLocation.insertMany([
    {
      name: "Block A — Main Admin & CSE",
      code: "BLK-A",
      zoneType: "ACADEMIC_BLOCK",
      description: "Main administrative offices, seminar hall, and CSE labs.",
      coordinates: { lat: 22.9868, lng: 88.4312, mapX: 25, mapY: 30 },
      floors: ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"],
      isSafeDesk: false,
    },
    {
      name: "Block B — Electronics & Microprocessor Labs",
      code: "BLK-B",
      zoneType: "ACADEMIC_BLOCK",
      description: "ECE/EE department, VLSI lab, and Room B-204 Digital Lab.",
      coordinates: { lat: 22.9874, lng: 88.4321, mapX: 52, mapY: 28 },
      floors: ["Ground Floor", "1st Floor", "2nd Floor"],
      isSafeDesk: false,
    },
    {
      name: "Block C — Mechanical Workshop & CAD Studio",
      code: "BLK-C",
      zoneType: "ACADEMIC_BLOCK",
      description: "Heavy machinery bay, robotics arena, and drafting halls.",
      coordinates: { lat: 22.9881, lng: 88.4329, mapX: 78, mapY: 35 },
      floors: ["Ground Floor", "1st Floor"],
      isSafeDesk: false,
    },
    {
      name: "Central Library & Archives",
      code: "LIB-01",
      zoneType: "LIBRARY",
      description: "Three-tier reading hall, Section 823 fiction stacks, and digital archive.",
      coordinates: { lat: 22.9869, lng: 88.4318, mapX: 45, mapY: 55 },
      floors: ["Ground Reading Room", "1st Floor Stacks", "2nd Floor Archive"],
      isSafeDesk: false,
    },
    {
      name: "Main Campus Canteen",
      code: "CNT-01",
      zoneType: "CANTEEN",
      description: "Student dining hub and outdoor courtyard.",
      coordinates: { lat: 22.9862, lng: 88.4325, mapX: 65, mapY: 68 },
      floors: ["Ground Floor", "Terrace"],
      isSafeDesk: false,
    },
    {
      name: "Student Activity Center (SAC)",
      code: "SAC-01",
      zoneType: "SPORTS",
      description: "Club rooms, music studio, and indoor table tennis arena.",
      coordinates: { lat: 22.9859, lng: 88.4315, mapX: 30, mapY: 72 },
      floors: ["Ground Floor", "1st Floor"],
      isSafeDesk: false,
    },
    {
      name: "Main Gate Security Safe-Desk",
      code: "SAFE-GATE",
      zoneType: "SAFE_DESK",
      description: "24/7 verified campus lost & found custody lockers.",
      coordinates: { lat: 22.9855, lng: 88.4305, mapX: 15, mapY: 85 },
      floors: ["Ground Floor"],
      isSafeDesk: true,
      operatingHours: "24/7 Open",
    },
    {
      name: "Central Library Help Safe-Desk",
      code: "SAFE-LIB",
      zoneType: "SAFE_DESK",
      description: "Supervised handover counter at the Central Library entrance.",
      coordinates: { lat: 22.9870, lng: 88.4319, mapX: 48, mapY: 58 },
      floors: ["Ground Floor"],
      isSafeDesk: true,
      operatingHours: "08:30 AM - 07:00 PM",
    },
  ]);

  const [blkA, blkB, blkC, library, canteen, sac, safeGate, safeLib] = locations;

  const adminHash = await bcrypt.hash("Admin@123", 12);
  const modHash = await bcrypt.hash("Mod@123", 12);
  const hunterHash = await bcrypt.hash("Hunter@123", 12);

  const [adminUser, modUser, rahul, vishnu, aryan, priya] = await User.insertMany([
    {
      email: "admin@aiem.edu",
      passwordHash: adminHash,
      username: "commander_aiem",
      displayName: "Prof. S. Chatterjee (Admin)",
      department: "Administration & Security",
      yearOfStudy: 4,
      role: "ADMIN",
      xp: 5000,
      level: 20,
      rankTitle: "Grand Archivist of AIEM",
      coins: 950,
      trustScore: 1000,
      trustTier: "ELITE_INVESTIGATOR",
    },
    {
      email: "mod@aiem.edu",
      passwordHash: modHash,
      username: "warden_sen",
      displayName: "Anirban Sen (Safe-Desk Mod)",
      department: "Campus Security & Verification",
      yearOfStudy: 4,
      role: "MODERATOR",
      xp: 3200,
      level: 13,
      rankTitle: "Senior Detective",
      coins: 420,
      trustScore: 950,
      trustTier: "ELITE_INVESTIGATOR",
    },
    {
      email: "rahul@student.aiem.edu",
      passwordHash: hunterHash,
      username: "rahul_seeker",
      displayName: "Rahul Sharma",
      department: "Computer Science & Engineering",
      yearOfStudy: 3,
      role: "STUDENT",
      xp: 1850,
      level: 8,
      rankTitle: "Field Investigator",
      coins: 310,
      trustScore: 780,
      trustTier: "TRUSTED_HUNTER",
    },
    {
      email: "vishnu@student.aiem.edu",
      passwordHash: hunterHash,
      username: "vishnu_trace",
      displayName: "Vishnu Verma",
      department: "Electronics & Communication",
      yearOfStudy: 3,
      role: "STUDENT",
      xp: 1620,
      level: 7,
      rankTitle: "Field Investigator",
      coins: 245,
      trustScore: 710,
      trustTier: "TRUSTED_HUNTER",
    },
    {
      email: "aryan@student.aiem.edu",
      passwordHash: hunterHash,
      username: "aryan_falcon",
      displayName: "Aryan Das",
      department: "Mechanical Engineering",
      yearOfStudy: 2,
      role: "STUDENT",
      xp: 1390,
      level: 6,
      rankTitle: "Field Investigator",
      coins: 190,
      trustScore: 640,
      trustTier: "TRUSTED_HUNTER",
    },
    {
      email: "priya@student.aiem.edu",
      passwordHash: hunterHash,
      username: "priya_cipher",
      displayName: "Priya Mukherjee",
      department: "Information Technology",
      yearOfStudy: 2,
      role: "STUDENT",
      xp: 1740,
      level: 7,
      rankTitle: "Field Investigator",
      coins: 280,
      trustScore: 820,
      trustTier: "TRUSTED_HUNTER",
    },
  ]);

  const theSeekers = await Squad.create({
    name: "THE SEEKERS",
    tag: "SEEK",
    description: "AIEM's premier rapid-response deduction squad.",
    emblemIcon: "Compass",
    privacy: "PUBLIC",
    leaderId: rahul._id,
    squadXp: 1450,
    squadLevel: 5,
    completedHuntsCount: 12,
  });

  await User.updateMany(
    { _id: { $in: [rahul._id, vishnu._id, aryan._id] } },
    { $set: { squadId: theSeekers._id } }
  );

  const calcAnswerHash = await bcrypt.hash("fx991ex", 10);
  const lostCalc = await LostItem.create({
    reporterId: priya._id,
    title: "Casio FX-991EX Scientific Calculator",
    category: "ELECTRONICS",
    publicDescription: "Black solar scientific calculator lost between Block B and Main Canteen.",
    secretIdentifiers: "Engraved initials 'P.M. IT-24' on back cover.",
    verificationQuestion: "What sticker is inside the slide cover?",
    verificationAnswerHash: calcAnswerHash,
    lastKnownLocationId: blkB._id,
    spotDetails: "Block B Ground Corridor -> Main Canteen -> Room B-204",
    lostAt: new Date(Date.now() - 4 * 3600 * 1000),
    recoveryPreference: "HANDOVER_AT_SAFE_DESK",
    convertToQuest: true,
    status: "ACTIVE",
  });

  const quest024 = await Quest.create({
    questCode: "Quest #024",
    title: "The Missing Calculator",
    description: "Trace Priya's morning path across Block B and the Main Canteen to recover the missing Casio FX-991EX Scientific Calculator.",
    questType: "INVESTIGATION",
    difficulty: 3,
    linkedLostItemId: lostCalc._id,
    targetLocationId: blkB._id,
    restrictedRoomNote: "Room B-204 Microprocessor Lab (Unlocked after Clue 3)",
    isLocationRestricted: true,
    unlockLocationAtStage: 3,
    xpReward: 150,
    coinReward: 30,
    squadXpReward: 60,
    finderBonusXp: 25,
    status: "ACTIVE",
  });

  const q024Clues = await Clue.insertMany([
    {
      questId: quest024._id,
      stageOrder: 1,
      title: "Clue 1: The Morning Noticeboard",
      clueText: "Which noticeboard stands directly opposite the Block B Ground Floor staircase?",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "ieee student branch board",
      targetLocationId: blkB._id,
      hintText: "Look near the ECE HOD room.",
      hintCoinCost: 10,
      unlockedBreadcrumbText: "Witness saw the calculator heading toward the Main Canteen at 11:00 AM.",
    },
    {
      questId: quest024._id,
      stageOrder: 2,
      title: "Clue 2: The Canteen Receipt Trace",
      clueText: "Enter the 4-character table zone code printed on the North terrace pillar.",
      verificationType: "PASSCODE_QR",
      expectedAnswerNormalized: "cnt4",
      targetLocationId: canteen._id,
      hintText: "Check Pillar #4 facing Block B.",
      hintCoinCost: 10,
      unlockedBreadcrumbText: "Canteen staff confirmed she headed back to Block B 2nd Floor.",
    },
    {
      questId: quest024._id,
      stageOrder: 3,
      title: "Clue 3: The Microprocessor Bench",
      clueText: "What room number on the 2nd floor of Block B houses the Digital & Microprocessor Lab?",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "b204",
      targetLocationId: blkB._id,
      hintText: "Format: B204",
      hintCoinCost: 15,
      unlockedBreadcrumbText: "TARGET LOCATION UNLOCKED: Block B — Room B-204 Bench #7!",
    },
  ]);

  const inv = await Investigation.create({
    questId: quest024._id,
    squadId: theSeekers._id,
    isSquadInvestigation: true,
    currentStage: 4,
    progressPct: 80,
    participatingUserIds: [rahul._id, vishnu._id, aryan._id],
    solvedClues: [
      {
        clueId: q024Clues[0]._id,
        stageOrder: 1,
        solvedByUserId: rahul._id,
        solvedByName: "Rahul Sharma",
        usedHint: false,
        solvedAt: new Date(Date.now() - 95 * 60 * 1000),
      },
      {
        clueId: q024Clues[1]._id,
        stageOrder: 2,
        solvedByUserId: vishnu._id,
        solvedByName: "Vishnu Verma",
        usedHint: false,
        solvedAt: new Date(Date.now() - 50 * 60 * 1000),
      },
      {
        clueId: q024Clues[2]._id,
        stageOrder: 3,
        solvedByUserId: aryan._id,
        solvedByName: "Aryan Das",
        usedHint: false,
        solvedAt: new Date(Date.now() - 15 * 60 * 1000),
      },
    ],
    evidenceNodes: [
      {
        authorId: rahul._id,
        authorName: "Rahul Sharma",
        type: "MAP_PIN",
        title: "Block B Ground Corridor Check",
        content: "Checked the IEEE noticeboard opposite the stairs.",
        linkedStageOrder: 1,
        upvotes: [vishnu._id, aryan._id],
        createdAt: new Date(Date.now() - 90 * 60 * 1000),
      },
      {
        authorId: vishnu._id,
        authorName: "Vishnu Verma",
        type: "PHOTO",
        title: "Canteen Pillar #4 QR Marker",
        content: "Scanned code CNT4 on the North terrace.",
        linkedStageOrder: 2,
        upvotes: [rahul._id],
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        authorId: aryan._id,
        authorName: "Aryan Das",
        type: "THEORY",
        title: "Located in Room B-204 Lab Drawer #7!",
        content: "Solved Clue 3 (Room B-204). Lab technician confirmed the calculator is in the instructor drawer!",
        linkedStageOrder: 3,
        upvotes: [rahul._id, vishnu._id],
        createdAt: new Date(Date.now() - 12 * 60 * 1000),
      },
    ],
    status: "READY_FOR_RECOVERY",
  });

  console.log("✅ Seed complete! Investigation Room ID:", inv._id.toString());
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

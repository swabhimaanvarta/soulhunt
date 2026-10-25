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
  const uri = process.env.MONGODB_URI || "";
  const isProd =
    process.env.NODE_ENV === "production" ||
    uri.toLowerCase().includes("prod") ||
    uri.toLowerCase().includes("atlas");

  if (isProd || process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    const errorMsg =
      "🛑 SAFETY ABORT: Destructive seed is disabled by default to prevent accidental data loss. " +
      "Set ALLOW_DESTRUCTIVE_SEED=true to proceed in development or testing. " +
      "Destructive seed is strictly forbidden in production.";
    console.error(errorMsg);
    if (isProd) {
      throw new Error(errorMsg);
    }
    return;
  }

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
    allowedEmailDomains: ["@aiemgoa.ac.in", "@aitdgoa.edu.in"],
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
      name: "Admin & BSH Complex",
      code: "BLK-ADMIN",
      zoneType: "ACADEMIC_BLOCK",
      description: "Administration, Examination Cell, Principal's Office, and Basic Sciences & Humanities Department.",
      coordinates: { lat: 15.5950, lng: 73.7940, mapX: 28, mapY: 16 },
      floors: ["Ground Floor", "1st Floor", "2nd Floor"],
      isSafeDesk: false,
    },
    {
      name: "Computer Engineering & AI Center",
      code: "COMP-AI",
      zoneType: "ACADEMIC_BLOCK",
      description: "High-Performance Computing, AI/ML Labs, Cloud Computing Systems, and Room B-204 Digital Systems Lab.",
      coordinates: { lat: 15.5952, lng: 73.7938, mapX: 18, mapY: 23 },
      floors: ["Ground Floor", "1st Floor", "2nd Floor"],
      isSafeDesk: false,
    },
    {
      name: "Mechanical Workshop & Robotics Bay",
      code: "MECH-ROBOT",
      zoneType: "ACADEMIC_BLOCK",
      description: "Automation workshops, CAD/CAM Lab, Robotics Arena, and CNC Machining Bay.",
      coordinates: { lat: 15.5947, lng: 73.7935, mapX: 14, mapY: 34 },
      floors: ["Ground Floor", "1st Floor"],
      isSafeDesk: false,
    },
    {
      name: "Central Library & Digital Repository",
      code: "LIB-CENTRAL",
      zoneType: "LIBRARY",
      description: "Admin Block 2nd Floor — 400 sq. m open-access library, digital IEEE/NPTEL repository, and quiet study alcoves.",
      coordinates: { lat: 15.5949, lng: 73.7943, mapX: 33, mapY: 22 },
      floors: ["2nd Floor Reading Hall", "Digital Wing"],
      isSafeDesk: false,
    },
    {
      name: "Campus Cafeteria & Garden Courtyard",
      code: "CANTEEN-01",
      zoneType: "CANTEEN",
      description: "Student dining hub, shaded outdoor seating, and terrace patio.",
      coordinates: { lat: 15.5944, lng: 73.7945, mapX: 34, mapY: 48 },
      floors: ["Ground Floor", "Terrace"],
      isSafeDesk: false,
    },
    {
      name: "Sports Ground & Athletic Arena",
      code: "SPORTS-ARENA",
      zoneType: "SPORTS",
      description: "Football pitch, basketball and badminton courts, and outdoor athletic field.",
      coordinates: { lat: 15.5941, lng: 73.7958, mapX: 76, mapY: 60 },
      floors: ["Open Ground"],
      isSafeDesk: false,
    },
    {
      name: "Main Gate Security & Safe-Desk Locker #1",
      code: "SAFE-GATE",
      zoneType: "SAFE_DESK",
      description: "Assagao Main Entrance — 24/7 guarded security desk, visitor registration, and locked item deposit vaults.",
      coordinates: { lat: 15.5955, lng: 73.7945, mapX: 47, mapY: 13 },
      floors: ["Ground Checkpoint"],
      isSafeDesk: true,
      operatingHours: "24/7 Guarded Station",
    },
    {
      name: "Central Library Custody Safe-Desk #2",
      code: "SAFE-LIB",
      zoneType: "SAFE_DESK",
      description: "Supervised handover counter at the Central Library entrance (Admin Block 2nd Floor).",
      coordinates: { lat: 15.5949, lng: 73.7943, mapX: 33, mapY: 20 },
      floors: ["2nd Floor Entrance"],
      isSafeDesk: true,
      operatingHours: "08:30 AM - 06:30 PM",
    },
    {
      name: "Electronics & Computer Engineering (G-Block)",
      code: "ECE-G",
      zoneType: "ACADEMIC_BLOCK",
      description: "Embedded Systems, IoT Testbed, VLSI Design Lab, and G-Block Lecture Theatres.",
      coordinates: { lat: 15.5946, lng: 73.7941, mapX: 26, mapY: 33 },
      floors: ["Ground Floor", "1st Floor"],
      isSafeDesk: false,
    },
    {
      name: "Multi-Purpose Hall & Campus Auditorium",
      code: "AUD-MPH",
      zoneType: "ACADEMIC_BLOCK",
      description: "Major campus events, hackathons, seminars, and cultural festivals hall.",
      coordinates: { lat: 15.5936, lng: 73.7944, mapX: 36, mapY: 78 },
      floors: ["Ground Floor", "Balcony"],
      isSafeDesk: false,
    },
  ]);

  const [blkA, blkB, blkC, library, canteen, sac, safeGate, safeLib, eceG, audMph] = locations;

  const defaultAdminPass = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!defaultAdminPass) {
    throw new Error(
      "🛑 SECURITY VIOLATION: DEFAULT_ADMIN_PASSWORD is required in environment variables before seeding. Hardcoded fallbacks are strictly prohibited."
    );
  }
  const defaultModPass = process.env.DEFAULT_MOD_PASSWORD;
  if (!defaultModPass) {
    throw new Error(
      "🛑 SECURITY VIOLATION: DEFAULT_MOD_PASSWORD is required in environment variables before seeding. Hardcoded fallbacks are strictly prohibited."
    );
  }
  const defaultHunterPass = process.env.DEFAULT_HUNTER_PASSWORD;
  if (!defaultHunterPass) {
    throw new Error(
      "🛑 SECURITY VIOLATION: DEFAULT_HUNTER_PASSWORD is required in environment variables before seeding. Hardcoded fallbacks are strictly prohibited."
    );
  }

  const adminHash = await bcrypt.hash(defaultAdminPass, 12);
  const modHash = await bcrypt.hash(defaultModPass, 12);
  const hunterHash = await bcrypt.hash(defaultHunterPass, 12);

  const [adminUser, modUser, rahul, vishnu, aryan, priya] = await User.insertMany([
    {
      email: "admin@aiemgoa.ac.in",
      passwordHash: adminHash,
      username: "commander_aiem",
      displayName: "Prof. S. Chatterjee (Admin)",
      department: "Administration & Security",
      yearOfStudy: 4,
      role: "ADMIN",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 5000,
      level: 20,
      rankTitle: "Grand Archivist of AIEM",
      coins: 950,
      trustScore: 1000,
      trustTier: "ELITE_INVESTIGATOR",
      equippedTitle: "Grand Archivist",
      equippedFrame: "frame-amber-hud",
      equippedTheme: "theme-obsidian-grid",
      weeklyScore: 420,
    },
    {
      email: "mod@aiemgoa.ac.in",
      passwordHash: modHash,
      username: "warden_sen",
      displayName: "Anirban Sen (Safe-Desk Mod)",
      department: "Campus Security & Verification",
      yearOfStudy: 4,
      role: "MODERATOR",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 3200,
      level: 13,
      rankTitle: "Senior Detective",
      coins: 420,
      trustScore: 950,
      trustTier: "ELITE_INVESTIGATOR",
      equippedTitle: "Campus Custody Guardian",
      equippedFrame: "frame-cyan-matrix",
      equippedTheme: "theme-cyber-cyan",
      weeklyScore: 360,
    },
    {
      email: "rahul@aiemgoa.ac.in",
      passwordHash: hunterHash,
      username: "rahul_seeker",
      displayName: "Rahul Sharma",
      department: "Computer Science & Engineering",
      yearOfStudy: 3,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 2450,
      level: 9,
      rankTitle: "Lead Field Investigator",
      coins: 310,
      trustScore: 780,
      trustTier: "TRUSTED_HUNTER",
      equippedTitle: "Lead Deduction Specialist",
      equippedFrame: "frame-cyan-matrix",
      equippedTheme: "theme-cyber-cyan",
      weeklyScore: 540,
    },
    {
      email: "vishnu@aiemgoa.ac.in",
      passwordHash: hunterHash,
      username: "vishnu_trace",
      displayName: "Vishnu Verma",
      department: "Electronics & Communication",
      yearOfStudy: 3,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 1980,
      level: 8,
      rankTitle: "Field Investigator",
      coins: 245,
      trustScore: 710,
      trustTier: "TRUSTED_HUNTER",
      equippedTitle: "Tactical Operative",
      equippedFrame: "frame-amber-hud",
      equippedTheme: "theme-obsidian-grid",
      weeklyScore: 390,
    },
    {
      email: "aryan@aiemgoa.ac.in",
      passwordHash: hunterHash,
      username: "aryan_falcon",
      displayName: "Aryan Das",
      department: "Mechanical Engineering",
      yearOfStudy: 2,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 1420,
      level: 6,
      rankTitle: "Field Investigator",
      coins: 190,
      trustScore: 640,
      trustTier: "TRUSTED_HUNTER",
      equippedTitle: "Novice Seeker",
      equippedFrame: "frame-neon-emerald",
      weeklyScore: 210,
    },
    {
      email: "priya@aitdgoa.edu.in",
      passwordHash: hunterHash,
      username: "priya_cipher",
      displayName: "Priya Mukherjee",
      department: "Information Technology",
      yearOfStudy: 2,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 2890,
      level: 10,
      rankTitle: "Senior Detective",
      coins: 280,
      trustScore: 820,
      trustTier: "ELITE_INVESTIGATOR",
      equippedTitle: "Honorary Campus Guardian",
      equippedFrame: "frame-violet-ring",
      equippedTheme: "theme-violet-void",
      weeklyScore: 680,
    },
  ]);

  // Seed Squad 1: THE SEEKERS (Open)
  const theSeekers = await Squad.create({
    name: "THE SEEKERS",
    tag: "SEEK",
    description: "AIEM's premier rapid-response deduction squad.",
    emblemIcon: "Compass",
    privacy: "PUBLIC",
    joinType: "OPEN",
    minLevelRequired: 2,
    leaderId: rahul._id,
    squadXp: 1850,
    squadLevel: 6,
    memberCount: 3,
    weeklyScore: 720,
    completedHuntsCount: 14,
  });

  // Seed Squad 2: THE ARCHIVISTS (Invite Only)
  const theArchivists = await Squad.create({
    name: "THE ARCHIVISTS",
    tag: "ARCH",
    description: "Safe-Desk custody stewards and digital clue cryptographers.",
    emblemIcon: "Shield",
    privacy: "INVITE_ONLY",
    joinType: "INVITE_ONLY",
    minLevelRequired: 4,
    leaderId: priya._id,
    squadXp: 2600,
    squadLevel: 8,
    memberCount: 5,
    weeklyScore: 890,
    completedHuntsCount: 19,
  });

  // Seed Squad 3: NIGHT WATCH (Closed)
  const nightWatch = await Squad.create({
    name: "NIGHT WATCH",
    tag: "WATCH",
    description: "Specialized night perimeter reconnaissance and library surveillance unit.",
    emblemIcon: "Target",
    privacy: "PRIVATE",
    joinType: "CLOSED",
    minLevelRequired: 5,
    leaderId: modUser._id,
    squadXp: 3100,
    squadLevel: 10,
    memberCount: 8,
    weeklyScore: 1050,
    completedHuntsCount: 26,
  });

  await User.updateMany(
    { _id: { $in: [rahul._id, vishnu._id, aryan._id] } },
    { $set: { squadId: theSeekers._id } }
  );

  await User.updateOne(
    { _id: priya._id },
    { $set: { squadId: theArchivists._id } }
  );

  await User.updateOne(
    { _id: modUser._id },
    { $set: { squadId: nightWatch._id } }
  );

  await SquadMember.create([
    {
      squadId: theSeekers._id,
      userId: rahul._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 1100,
      cluesSolvedForSquad: 9,
      joinedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    },
    {
      squadId: theSeekers._id,
      userId: vishnu._id,
      role: "COLEADER",
      squadRole: "COLEADER",
      contributedSquadXp: 550,
      cluesSolvedForSquad: 4,
      joinedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
    },
    {
      squadId: theSeekers._id,
      userId: aryan._id,
      role: "MEMBER",
      squadRole: "MEMBER",
      contributedSquadXp: 200,
      cluesSolvedForSquad: 2,
      joinedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
    },
    {
      squadId: theArchivists._id,
      userId: priya._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 1500,
      cluesSolvedForSquad: 12,
      joinedAt: new Date(Date.now() - 40 * 24 * 3600 * 1000),
    },
    {
      squadId: nightWatch._id,
      userId: modUser._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 2100,
      cluesSolvedForSquad: 18,
      joinedAt: new Date(Date.now() - 60 * 24 * 3600 * 1000),
    },
  ]);

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

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (isDirectRun) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type UserRole = "STUDENT" | "MODERATOR" | "ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type TrustTier =
  | "RESTRICTED"
  | "NEW_HUNTER"
  | "ACTIVE_HUNTER"
  | "TRUSTED_HUNTER"
  | "ELITE_INVESTIGATOR";

export type ItemCategory =
  | "ELECTRONICS"
  | "ID_CARDS_DOCS"
  | "BOOKS_NOTES"
  | "ACCESSORIES"
  | "BAGS_WALLETS"
  | "KEYS"
  | "LAB_GEAR"
  | "OTHER";

export type ItemLifecycleState =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "ACTIVE"
  | "CLAIMED"
  | "VERIFICATION"
  | "RECOVERED"
  | "COMPLETED"
  | "REJECTED"
  | "DISPUTED"
  | "EXPIRED"
  | "ARCHIVED";

export type QuestType =
  | "QUICK_FIND"
  | "INVESTIGATION"
  | "MYSTERY"
  | "LEGENDARY"
  | "DAILY_HUNT"
  | "SQUAD_HUNT"
  | "CAMPUS_TREASURE"
  | "EVENT_HUNT";

export type ClueVerificationType =
  | "TEXT_RIDDLE"
  | "LOCATION_CHECKIN"
  | "PASSCODE_QR"
  | "EVIDENCE_UPLOAD";

export interface ISystemConfig extends Document {
  key: string;
  allowedEmailDomains: string[];
  xpPerLevelBase: number;
  xpLevelMultiplier: number;
  defaultFinderBonusPct: number;
  maxFinderBonusPct: number;
  pairCollusionWindowDays: number;
  pairCollusionMaxCount: number;
  dailyReportLimitPerUser: number;
  clueCooldownSeconds: number[];
  rankThresholds: { minLevel: number; title: string }[];
  globalXpMultiplier: number;
  globalCoinMultiplier: number;
  maintenanceMode: boolean;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: { type: String, default: "GLOBAL_CONFIG", unique: true },
    allowedEmailDomains: {
      type: [String],
      default: [
        "@aiemgoa.ac.in",
        "@aitdgoa.edu.in",
        "@student.aiem.edu",
        "@aiem.edu",
      ],
    },
    xpPerLevelBase: { type: Number, default: 250 },
    xpLevelMultiplier: { type: Number, default: 1.2 },
    defaultFinderBonusPct: { type: Number, default: 15 },
    maxFinderBonusPct: { type: Number, default: 25 },
    pairCollusionWindowDays: { type: Number, default: 30 },
    pairCollusionMaxCount: { type: Number, default: 2 },
    dailyReportLimitPerUser: { type: Number, default: 5 },
    clueCooldownSeconds: { type: [Number], default: [30, 120, 300] },
    rankThresholds: {
      type: [
        {
          minLevel: { type: Number, required: true },
          title: { type: String, required: true },
        },
      ],
      default: [
        { minLevel: 1, title: "Rookie Scout" },
        { minLevel: 3, title: "Campus Tracker" },
        { minLevel: 6, title: "Field Investigator" },
        { minLevel: 10, title: "Senior Detective" },
        { minLevel: 15, title: "Master Hunter" },
        { minLevel: 20, title: "Grand Archivist of AIEM" },
      ],
    },
    globalXpMultiplier: { type: Number, default: 1.0 },
    globalCoinMultiplier: { type: Number, default: 1.0 },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export interface ICampusLocation extends Document {
  name: string;
  code: string;
  zoneType: "ACADEMIC_BLOCK" | "LIBRARY" | "CANTEEN" | "HOSTEL" | "SPORTS" | "SAFE_DESK";
  description: string;
  coordinates: { lat: number; lng: number; mapX: number; mapY: number };
  floors: string[];
  isSafeDesk: boolean;
  operatingHours: string;
  isActive: boolean;
}

const CampusLocationSchema = new Schema<ICampusLocation>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    zoneType: {
      type: String,
      enum: ["ACADEMIC_BLOCK", "LIBRARY", "CANTEEN", "HOSTEL", "SPORTS", "SAFE_DESK"],
      required: true,
    },
    description: { type: String, default: "" },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      mapX: { type: Number, required: true },
      mapY: { type: Number, required: true },
    },
    floors: { type: [String], default: ["Ground Floor"] },
    isSafeDesk: { type: Boolean, default: false },
    operatingHours: { type: String, default: "08:00 AM - 06:00 PM" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  department: string;
  yearOfStudy: number;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  xp: number;
  level: number;
  rankTitle: string;
  coins: number;
  trustScore: number;
  trustTier: TrustTier;
  squadId?: Types.ObjectId | null;
  equippedTitle: string;
  equippedFrame: string;
  equippedTheme: string;
  ownedCosmetics: Types.ObjectId[];
  stats: {
    recoveriesCount: number;
    safeDeskDepositsCount: number;
    questsCompleted: number;
    investigationQuestsCompleted: number;
    mysteryQuestsNoHints: number;
    legendaryQuestsCompleted: number;
    cluesSolved: number;
    squadQuestsCompleted: number;
    treasuresFound: number;
    visitedBlocks: string[];
  };
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: "/avatars/default-hunter.png" },
    department: { type: String, default: "Computer Science & Engineering" },
    yearOfStudy: { type: Number, default: 2 },
    role: { type: String, enum: ["STUDENT", "MODERATOR", "ADMIN"], default: "STUDENT" },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
      default: "ACTIVE",
    },
    emailVerified: { type: Boolean, default: true },
    xp: { type: Number, default: 0, index: true },
    level: { type: Number, default: 1 },
    rankTitle: { type: String, default: "Rookie Scout" },
    coins: { type: Number, default: 50 },
    trustScore: { type: Number, default: 100, min: 0, max: 1000 },
    trustTier: {
      type: String,
      enum: [
        "RESTRICTED",
        "NEW_HUNTER",
        "ACTIVE_HUNTER",
        "TRUSTED_HUNTER",
        "ELITE_INVESTIGATOR",
      ],
      default: "NEW_HUNTER",
    },
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", default: null },
    equippedTitle: { type: String, default: "Campus Pathfinder" },
    equippedFrame: { type: String, default: "frame-emerald-pulse" },
    equippedTheme: { type: String, default: "theme-obsidian-grid" },
    ownedCosmetics: [{ type: Schema.Types.ObjectId, ref: "Reward" }],
    stats: {
      recoveriesCount: { type: Number, default: 0 },
      safeDeskDepositsCount: { type: Number, default: 0 },
      questsCompleted: { type: Number, default: 0 },
      investigationQuestsCompleted: { type: Number, default: 0 },
      mysteryQuestsNoHints: { type: Number, default: 0 },
      legendaryQuestsCompleted: { type: Number, default: 0 },
      cluesSolved: { type: Number, default: 0 },
      squadQuestsCompleted: { type: Number, default: 0 },
      treasuresFound: { type: Number, default: 0 },
      visitedBlocks: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

export interface ILostItem extends Document {
  reporterId: Types.ObjectId;
  title: string;
  category: ItemCategory;
  publicDescription: string;
  secretIdentifiers: string;
  verificationQuestion: string;
  verificationAnswerHash: string;
  lastKnownLocationId: Types.ObjectId;
  spotDetails: string;
  lostAt: Date;
  photos: string[];
  recoveryPreference: "HANDOVER_AT_SAFE_DESK" | "DIRECT_CAMPUS_MEETUP" | "MODERATOR_OFFICE";
  convertToQuest: boolean;
  linkedQuestId?: Types.ObjectId | null;
  currentClaimId?: Types.ObjectId | null;
  rewardOffered?: number;
  photoUrl?: string;
  status: ItemLifecycleState;
  stateHistory: {
    state: ItemLifecycleState;
    actorId: Types.ObjectId;
    note: string;
    timestamp: Date;
  }[];
}

const LostItemSchema = new Schema<ILostItem>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "ELECTRONICS",
        "ID_CARDS_DOCS",
        "BOOKS_NOTES",
        "ACCESSORIES",
        "BAGS_WALLETS",
        "KEYS",
        "LAB_GEAR",
        "OTHER",
      ],
      required: true,
    },
    publicDescription: { type: String, required: true },
    secretIdentifiers: { type: String, required: true, select: false },
    verificationQuestion: { type: String, required: true },
    verificationAnswerHash: { type: String, required: true, select: false },
    lastKnownLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      required: true,
    },
    spotDetails: { type: String, default: "" },
    lostAt: { type: Date, required: true },
    photos: { type: [String], default: [] },
    recoveryPreference: {
      type: String,
      enum: ["HANDOVER_AT_SAFE_DESK", "DIRECT_CAMPUS_MEETUP", "MODERATOR_OFFICE"],
      default: "HANDOVER_AT_SAFE_DESK",
    },
    convertToQuest: { type: Boolean, default: true },
    linkedQuestId: { type: Schema.Types.ObjectId, ref: "Quest", default: null },
    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "ACTIVE",
        "CLAIMED",
        "VERIFICATION",
        "RECOVERED",
        "COMPLETED",
        "REJECTED",
        "DISPUTED",
        "EXPIRED",
        "ARCHIVED",
      ],
      default: "SUBMITTED",
      index: true,
    },
    stateHistory: [
      {
        state: { type: String, required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User" },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export interface IFoundItem extends Document {
  finderId: Types.ObjectId;
  shortTitle: string;
  title?: string;
  category: ItemCategory;
  publicDescription: string;
  foundLocationId: Types.ObjectId;
  spotDetails: string;
  foundAt: Date;
  rawPhotoUrl: string;
  blurredPhotoUrl: string;
  photoUrl?: string;
  photoRequiresBlur?: boolean;
  isSensitiveRedacted: boolean;
  custodyStatus: "HELD_BY_FINDER" | "DEPOSITED_AT_SAFE_DESK" | "HANDED_TO_MODERATOR" | "SAFE_DESK" | "FINDER_HELD" | "ADMIN_OFFICE";
  safeDeskLocationId?: Types.ObjectId | null;
  currentCustodyLocationId?: Types.ObjectId | null;
  currentClaimId?: Types.ObjectId | null;
  lockerReceiptCode?: string;
  linkedQuestId?: Types.ObjectId | null;
  status: ItemLifecycleState;
  stateHistory: {
    state: ItemLifecycleState;
    actorId: Types.ObjectId;
    note: string;
    timestamp: Date;
  }[];
}

const FoundItemSchema = new Schema<IFoundItem>(
  {
    finderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    shortTitle: { type: String, default: "", trim: true },
    title: { type: String, default: "", trim: true },
    category: {
      type: String,
      enum: [
        "ELECTRONICS",
        "ID_CARDS_DOCS",
        "BOOKS_NOTES",
        "ACCESSORIES",
        "BAGS_WALLETS",
        "KEYS",
        "LAB_GEAR",
        "OTHER",
      ],
      required: true,
    },
    publicDescription: { type: String, required: true },
    foundLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      required: true,
    },
    spotDetails: { type: String, default: "" },
    foundAt: { type: Date, required: true },
    rawPhotoUrl: { type: String, default: "", select: false },
    blurredPhotoUrl: { type: String, default: "" },
    photoUrl: { type: String, default: "" },
    photoRequiresBlur: { type: Boolean, default: false },
    isSensitiveRedacted: { type: Boolean, default: false },
    custodyStatus: {
      type: String,
      enum: ["HELD_BY_FINDER", "DEPOSITED_AT_SAFE_DESK", "HANDED_TO_MODERATOR", "SAFE_DESK", "FINDER_HELD", "ADMIN_OFFICE"],
      default: "DEPOSITED_AT_SAFE_DESK",
    },
    safeDeskLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      default: null,
    },
    currentCustodyLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      default: null,
    },
    currentClaimId: {
      type: Schema.Types.ObjectId,
      ref: "ClaimRequest",
      default: null,
    },
    lockerReceiptCode: { type: String, default: "" },
    linkedQuestId: { type: Schema.Types.ObjectId, ref: "Quest", default: null },
    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "ACTIVE",
        "CLAIMED",
        "VERIFICATION",
        "RECOVERED",
        "COMPLETED",
        "REJECTED",
        "DISPUTED",
        "EXPIRED",
        "ARCHIVED",
      ],
      default: "SUBMITTED",
      index: true,
    },
    stateHistory: [
      {
        state: { type: String, required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User" },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export interface IClaimRequest extends Document {
  itemType: "LOST" | "FOUND";
  itemId: Types.ObjectId;
  claimantId: Types.ObjectId;
  counterpartyUserId: Types.ObjectId;
  submittedAnswer: string;
  proofPhotoUrl?: string;
  notes: string;
  handoverCode: string;
  status: "PENDING" | "APPROVED" | "HANDOVER_COMPLETE" | "REJECTED" | "DISPUTED";
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
}

const ClaimRequestSchema = new Schema<IClaimRequest>(
  {
    itemType: { type: String, enum: ["LOST", "FOUND"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true, index: true },
    claimantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    counterpartyUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedAnswer: { type: String, required: true },
    proofPhotoUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
    handoverCode: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "HANDOVER_COMPLETE", "REJECTED", "DISPUTED"],
      default: "PENDING",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export interface IQuest extends Document {
  questCode: string;
  title: string;
  description: string;
  questType: QuestType;
  difficulty: number;
  linkedLostItemId?: Types.ObjectId | null;
  linkedFoundItemId?: Types.ObjectId | null;
  eventId?: Types.ObjectId | null;
  targetLocationId: Types.ObjectId;
  restrictedRoomNote: string;
  isLocationRestricted: boolean;
  unlockLocationAtStage: number;
  xpReward: number;
  coinReward: number;
  squadXpReward: number;
  finderBonusXp: number;
  maxCompletions: number;
  currentCompletions: number;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED" | "DRAFT";
  expiresAt?: Date | null;
}

const QuestSchema = new Schema<IQuest>(
  {
    questCode: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    questType: {
      type: String,
      enum: [
        "QUICK_FIND",
        "INVESTIGATION",
        "MYSTERY",
        "LEGENDARY",
        "DAILY_HUNT",
        "SQUAD_HUNT",
        "CAMPUS_TREASURE",
        "EVENT_HUNT",
      ],
      required: true,
      index: true,
    },
    difficulty: { type: Number, required: true, min: 1, max: 5 },
    linkedLostItemId: { type: Schema.Types.ObjectId, ref: "LostItem", default: null },
    linkedFoundItemId: { type: Schema.Types.ObjectId, ref: "FoundItem", default: null },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    targetLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      required: true,
    },
    restrictedRoomNote: { type: String, default: "Exact Lab/Room locked until clues solved" },
    isLocationRestricted: { type: Boolean, default: true },
    unlockLocationAtStage: { type: Number, default: 3 },
    xpReward: { type: Number, required: true },
    coinReward: { type: Number, required: true },
    squadXpReward: { type: Number, default: 50 },
    finderBonusXp: { type: Number, default: 25 },
    maxCompletions: { type: Number, default: 1 },
    currentCompletions: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "EXPIRED", "DRAFT"],
      default: "ACTIVE",
      index: true,
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export interface IClue extends Document {
  questId: Types.ObjectId;
  stageOrder: number;
  title: string;
  clueText: string;
  verificationType: ClueVerificationType;
  expectedAnswerNormalized: string;
  targetLocationId?: Types.ObjectId | null;
  hintText: string;
  hintCoinCost: number;
  unlockedBreadcrumbText: string;
}

const ClueSchema = new Schema<IClue>(
  {
    questId: { type: Schema.Types.ObjectId, ref: "Quest", required: true, index: true },
    stageOrder: { type: Number, required: true },
    title: { type: String, required: true },
    clueText: { type: String, required: true },
    verificationType: {
      type: String,
      enum: ["TEXT_RIDDLE", "LOCATION_CHECKIN", "PASSCODE_QR", "EVIDENCE_UPLOAD"],
      required: true,
    },
    expectedAnswerNormalized: { type: String, required: true, select: false },
    targetLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      default: null,
    },
    hintText: { type: String, default: "" },
    hintCoinCost: { type: Number, default: 10 },
    unlockedBreadcrumbText: { type: String, default: "" },
  },
  { timestamps: true }
);
ClueSchema.index({ questId: 1, stageOrder: 1 }, { unique: true });

export interface IInvestigation extends Document {
  questId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  squadId?: Types.ObjectId | null;
  isSquadInvestigation: boolean;
  currentStage: number;
  progressPct: number;
  participatingUserIds: Types.ObjectId[];
  solvedClues: {
    clueId: Types.ObjectId;
    stageOrder: number;
    solvedByUserId: Types.ObjectId;
    solvedByName: string;
    usedHint: boolean;
    solvedAt: Date;
  }[];
  evidenceNodes: {
    _id?: Types.ObjectId;
    authorId: Types.ObjectId;
    authorName: string;
    type: "PHOTO" | "MAP_PIN" | "THEORY";
    title: string;
    content: string;
    mediaUrl?: string;
    linkedStageOrder?: number;
    upvotes: Types.ObjectId[];
    createdAt: Date;
  }[];
  failedAttemptsCount: number;
  cooldownUntil?: Date | null;
  status: "IN_PROGRESS" | "READY_FOR_RECOVERY" | "SUBMITTED_FOR_VERIFICATION" | "COMPLETED";
}

const InvestigationSchema = new Schema<IInvestigation>(
  {
    questId: { type: Schema.Types.ObjectId, ref: "Quest", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", default: null, index: true },
    isSquadInvestigation: { type: Boolean, default: false },
    currentStage: { type: Number, default: 1 },
    progressPct: { type: Number, default: 0 },
    participatingUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    solvedClues: [
      {
        clueId: { type: Schema.Types.ObjectId, ref: "Clue" },
        stageOrder: { type: Number, required: true },
        solvedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
        solvedByName: { type: String, required: true },
        usedHint: { type: Boolean, default: false },
        solvedAt: { type: Date, default: Date.now },
      },
    ],
    evidenceNodes: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        authorName: { type: String, required: true },
        type: { type: String, enum: ["PHOTO", "MAP_PIN", "THEORY"], required: true },
        title: { type: String, required: true },
        content: { type: String, required: true },
        mediaUrl: { type: String, default: "" },
        linkedStageOrder: { type: Number, default: 1 },
        upvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    failedAttemptsCount: { type: Number, default: 0 },
    cooldownUntil: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        "IN_PROGRESS",
        "READY_FOR_RECOVERY",
        "SUBMITTED_FOR_VERIFICATION",
        "COMPLETED",
      ],
      default: "IN_PROGRESS",
    },
  },
  { timestamps: true }
);

export interface ISquad extends Document {
  name: string;
  tag: string;
  description: string;
  emblemIcon: string;
  bannerGradient: string;
  privacy: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  leaderId: Types.ObjectId;
  squadXp: number;
  squadLevel: number;
  completedHuntsCount: number;
  memberCap: number;
}

const SquadSchema = new Schema<ISquad>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    tag: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    emblemIcon: { type: String, default: "ShieldAlert" },
    bannerGradient: { type: String, default: "from-emerald-900/60 via-slate-900 to-cyan-900/60" },
    privacy: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "INVITE_ONLY"],
      default: "PUBLIC",
    },
    leaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    squadXp: { type: Number, default: 0, index: true },
    squadLevel: { type: Number, default: 1 },
    completedHuntsCount: { type: Number, default: 0 },
    memberCap: { type: Number, default: 8 },
  },
  { timestamps: true }
);

export interface ISquadMember extends Document {
  squadId: Types.ObjectId;
  userId: Types.ObjectId;
  role: "LEADER" | "OFFICER" | "MEMBER";
  squadRole?: "LEADER" | "OFFICER" | "MEMBER";
  contributedSquadXp: number;
  cluesSolvedForSquad: number;
  joinedAt: Date;
}

const SquadMemberSchema = new Schema<ISquadMember>(
  {
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["LEADER", "OFFICER", "MEMBER"], default: "MEMBER" },
    squadRole: { type: String, enum: ["LEADER", "OFFICER", "MEMBER"], default: "MEMBER" },
    contributedSquadXp: { type: Number, default: 0 },
    cluesSolvedForSquad: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
SquadMemberSchema.index({ squadId: 1, userId: 1 }, { unique: true });

export interface IAchievement extends Document {
  code: string;
  title: string;
  description: string;
  badgeIcon: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  metricKey:
    | "QUESTS_COMPLETED"
    | "RECOVERIES_COUNT"
    | "VISITED_BLOCKS_COUNT"
    | "INVESTIGATION_QUESTS"
    | "MYSTERY_NO_HINTS"
    | "PLAYER_LEVEL"
    | "SPEED_RECOVERY"
    | "SAFE_DESK_DEPOSITS"
    | "SQUAD_QUESTS"
    | "SQUAD_LEVEL"
    | "LEGENDARY_QUESTS"
    | "TREASURES_FOUND";
  threshold: number;
  xpReward: number;
  coinReward: number;
  isActive: boolean;
}

const AchievementSchema = new Schema<IAchievement>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    badgeIcon: { type: String, default: "Award" },
    rarity: {
      type: String,
      enum: ["COMMON", "RARE", "EPIC", "LEGENDARY"],
      default: "COMMON",
    },
    metricKey: { type: String, required: true },
    threshold: { type: Number, required: true },
    xpReward: { type: Number, required: true },
    coinReward: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export interface IUserAchievement extends Document {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  progress: number;
  isUnlocked: boolean;
  unlockedAt?: Date | null;
}

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", required: true },
    progress: { type: Number, default: 0 },
    isUnlocked: { type: Boolean, default: false },
    unlockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

export interface IReward extends Document {
  code?: string;
  name?: string;
  title?: string;
  description: string;
  type: "FRAME" | "TITLE" | "THEME" | "BADGE" | "CANTEEN_COUPON" | "CAMPUS_PERK";
  coinCost: number;
  previewAsset?: string;
  minLevelRequired: number;
  stock?: number;
  metadata?: any;
  isActive: boolean;
}

const RewardSchema = new Schema<IReward>(
  {
    code: { type: String, default: "" },
    name: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ["FRAME", "TITLE", "THEME", "BADGE", "CANTEEN_COUPON", "CAMPUS_PERK"],
      required: true,
    },
    coinCost: { type: Number, required: true, min: 0 },
    previewAsset: { type: String, default: "" },
    minLevelRequired: { type: Number, default: 1 },
    stock: { type: Number, default: -1 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  squadId?: Types.ObjectId | null;
  deltaXp: number;
  deltaCoins: number;
  deltaTrust: number;
  reason: string;
  referenceType: "QUEST" | "RECOVERY" | "ACHIEVEMENT" | "SHOP_PURCHASE" | "HINT_UNLOCK" | "ADMIN_ADJUST";
  referenceId?: Types.ObjectId | null;
  counterpartyUserId?: Types.ObjectId | null;
  approvedBy?: Types.ObjectId | null;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", default: null },
    deltaXp: { type: Number, default: 0 },
    deltaCoins: { type: Number, default: 0 },
    deltaTrust: { type: Number, default: 0 },
    reason: { type: String, required: true },
    referenceType: {
      type: String,
      enum: [
        "QUEST",
        "RECOVERY",
        "ACHIEVEMENT",
        "SHOP_PURCHASE",
        "HINT_UNLOCK",
        "ADMIN_ADJUST",
      ],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    counterpartyUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export interface IEvent extends Document {
  title: string;
  slug: string;
  eventType:
    | "FLASH_HUNT"
    | "DAILY_SPRINT"
    | "INTER_DEPT"
    | "SQUAD_SHOWDOWN"
    | "FEST_TREASURE_HUNT"
    | "ORIENTATION_HUNT";
  description: string;
  rules: string[];
  bannerGradient: string;
  startTime: Date;
  endTime: Date;
  eligibleDepartments: string[];
  isSquadEvent: boolean;
  linkedQuestIds: Types.ObjectId[];
  participants: {
    userId: Types.ObjectId;
    scoreXp: number;
    joinedAt: Date;
  }[];
  rewardPool: {
    firstPlaceCoins: number;
    secondPlaceCoins: number;
    thirdPlaceCoins: number;
    exclusiveTitle: string;
  };
  status: "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    eventType: {
      type: String,
      enum: [
        "FLASH_HUNT",
        "DAILY_SPRINT",
        "INTER_DEPT",
        "SQUAD_SHOWDOWN",
        "FEST_TREASURE_HUNT",
        "ORIENTATION_HUNT",
      ],
      required: true,
    },
    description: { type: String, required: true },
    rules: { type: [String], default: [] },
    bannerGradient: { type: String, default: "from-violet-900/70 via-slate-900 to-emerald-900/60" },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    eligibleDepartments: { type: [String], default: ["ALL"] },
    isSquadEvent: { type: Boolean, default: false },
    linkedQuestIds: [{ type: Schema.Types.ObjectId, ref: "Quest" }],
    participants: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        scoreXp: { type: Number, default: 0 },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    rewardPool: {
      firstPlaceCoins: { type: Number, default: 250 },
      secondPlaceCoins: { type: Number, default: 150 },
      thirdPlaceCoins: { type: Number, default: 75 },
      exclusiveTitle: { type: String, default: "AIEM Vanguard" },
    },
    status: {
      type: String,
      enum: ["UPCOMING", "LIVE", "ENDED", "CANCELLED"],
      default: "LIVE",
    },
  },
  { timestamps: true }
);

export interface INotification extends Document {
  userId: Types.ObjectId;
  category: "QUEST_SQUAD" | "LOST_FOUND_MATCH" | "SYSTEM_REWARD" | "CLAIM_UPDATE" | "ACHIEVEMENT_UNLOCK";
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["QUEST_SQUAD", "LOST_FOUND_MATCH", "SYSTEM_REWARD", "CLAIM_UPDATE", "ACHIEVEMENT_UNLOCK"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    linkUrl: { type: String, default: "/dashboard" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export interface IFraudAlert extends Document {
  involvedUserIds: Types.ObjectId[];
  alertType: "PAIR_COLLUSION" | "RAPID_FARMING" | "DUPLICATE_REPORT" | "SUSPICIOUS_CLAIM";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
  referenceId?: Types.ObjectId | null;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED_PENALIZED" | "DISMISSED" | "RESOLVED";
  reviewedBy?: Types.ObjectId | null;
  reviewNotes?: string;
}

const FraudAlertSchema = new Schema<IFraudAlert>(
  {
    involvedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    alertType: {
      type: String,
      enum: ["PAIR_COLLUSION", "RAPID_FARMING", "DUPLICATE_REPORT", "SUSPICIOUS_CLAIM"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "HIGH",
    },
    details: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewNotes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["OPEN", "INVESTIGATING", "RESOLVED_PENALIZED", "DISMISSED", "RESOLVED"],
      default: "OPEN",
    },
  },
  { timestamps: true }
);

export const SystemConfig: Model<ISystemConfig> =
  mongoose.models.SystemConfig || mongoose.model<ISystemConfig>("SystemConfig", SystemConfigSchema);
export const CampusLocation: Model<ICampusLocation> =
  mongoose.models.CampusLocation || mongoose.model<ICampusLocation>("CampusLocation", CampusLocationSchema);
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
export const LostItem: Model<ILostItem> =
  mongoose.models.LostItem || mongoose.model<ILostItem>("LostItem", LostItemSchema);
export const FoundItem: Model<IFoundItem> =
  mongoose.models.FoundItem || mongoose.model<IFoundItem>("FoundItem", FoundItemSchema);
export const ClaimRequest: Model<IClaimRequest> =
  mongoose.models.ClaimRequest || mongoose.model<IClaimRequest>("ClaimRequest", ClaimRequestSchema);
export const Quest: Model<IQuest> =
  mongoose.models.Quest || mongoose.model<IQuest>("Quest", QuestSchema);
export const Clue: Model<IClue> =
  mongoose.models.Clue || mongoose.model<IClue>("Clue", ClueSchema);
export const Investigation: Model<IInvestigation> =
  mongoose.models.Investigation || mongoose.model<IInvestigation>("Investigation", InvestigationSchema);
export const Squad: Model<ISquad> =
  mongoose.models.Squad || mongoose.model<ISquad>("Squad", SquadSchema);
export const SquadMember: Model<ISquadMember> =
  mongoose.models.SquadMember || mongoose.model<ISquadMember>("SquadMember", SquadMemberSchema);
export const Achievement: Model<IAchievement> =
  mongoose.models.Achievement || mongoose.model<IAchievement>("Achievement", AchievementSchema);
export const UserAchievement: Model<IUserAchievement> =
  mongoose.models.UserAchievement || mongoose.model<IUserAchievement>("UserAchievement", UserAchievementSchema);
export const Reward: Model<IReward> =
  mongoose.models.Reward || mongoose.model<IReward>("Reward", RewardSchema);
export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);
export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);
export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
export const FraudAlert: Model<IFraudAlert> =
  mongoose.models.FraudAlert || mongoose.model<IFraudAlert>("FraudAlert", FraudAlertSchema);

import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type UserRole = "STUDENT" | "SAFE_DESK_STAFF" | "MODERATOR" | "ADMIN";
export type AccountStatus = "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "DEACTIVATED";
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
  building?: string;
  accessibleRouteNotes?: string;
  staffedHoursNotes?: string;
  contactChannel?: string;
  currentCapacity?: number;
  assignedStaffUserIds?: Types.ObjectId[];
  isArchived?: boolean;
  sortOrder?: number;
  updatedBy?: Types.ObjectId | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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
    building: { type: String, default: "" },
    accessibleRouteNotes: { type: String, default: "" },
    staffedHoursNotes: { type: String, default: "" },
    contactChannel: { type: String, default: "" },
    currentCapacity: { type: Number, default: 50 },
    assignedStaffUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    sortOrder: { type: Number, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isArchived: { type: Boolean, default: false },
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
  assignedStationId?: Types.ObjectId | null;
  assignedStationIds?: Types.ObjectId[];
  accountStatus: AccountStatus;
  emailVerified: boolean;
  emailVerificationCodeHash?: string;
  emailVerificationExpiresAt?: Date;
  emailVerificationAttempts?: number;
  emailVerificationResendAfter?: Date;
  passwordResetCodeHash?: string;
  passwordResetExpiresAt?: Date;
  passwordResetAttempts?: number;
  passwordResetResendAfter?: Date;
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
  bio?: string;
  phoneNumber?: string;
  studentId?: string;
  preferredContactMethod?: "EMAIL" | "PHONE" | "SAFE_DESK";
  avatarPreset?: string;
  isProfilePublic?: boolean;
  isLeaderboardPublic?: boolean;
  identityMode?: "PSEUDONYMOUS" | "ANONYMOUS" | "PUBLIC";
  publicAttributionPreference?: "HANDLE" | "ANONYMOUS";
  featuredAchievementIds?: Types.ObjectId[];
  weeklyScore?: number;
  lastWeeklyReset?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: "/avatars/default-hunter.png" },
    avatarPreset: { type: String, default: "recon" },
    bio: { type: String, default: "", maxlength: 300 },
    phoneNumber: { type: String, default: "", trim: true },
    studentId: { type: String, default: "", trim: true, uppercase: true },
    preferredContactMethod: {
      type: String,
      enum: ["EMAIL", "PHONE", "SAFE_DESK"],
      default: "SAFE_DESK",
    },
    department: { type: String, default: "Computer Science & Engineering" },
    yearOfStudy: { type: Number, default: 2 },
    role: {
      type: String,
      enum: ["STUDENT", "SAFE_DESK_STAFF", "MODERATOR", "ADMIN"],
      default: "STUDENT",
    },
    assignedStationId: { type: Schema.Types.ObjectId, ref: "CampusLocation", default: null },
    assignedStationIds: [{ type: Schema.Types.ObjectId, ref: "CampusLocation" }],
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "DEACTIVATED"],
      default: "PENDING_VERIFICATION",
    },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCodeHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date },
    emailVerificationAttempts: { type: Number, default: 0 },
    emailVerificationResendAfter: { type: Date },
    passwordResetCodeHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date },
    passwordResetAttempts: { type: Number, default: 0 },
    passwordResetResendAfter: { type: Date },
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
    isProfilePublic: { type: Boolean, default: true },
    isLeaderboardPublic: { type: Boolean, default: true },
    identityMode: {
      type: String,
      enum: ["PSEUDONYMOUS", "ANONYMOUS", "PUBLIC"],
      default: "PSEUDONYMOUS",
    },
    publicAttributionPreference: {
      type: String,
      enum: ["HANDLE", "ANONYMOUS"],
      default: "HANDLE",
    },
    featuredAchievementIds: [{ type: Schema.Types.ObjectId, ref: "Achievement" }],
    weeklyScore: { type: Number, default: 0 },
    lastWeeklyReset: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export interface ILostItem extends Document {
  reporterId: Types.ObjectId;
  title: string;
  category: ItemCategory;
  publicDescription: string;
  secretIdentifiers: string;
  verificationQuestion?: string;
  verificationAnswerHash?: string;
  lastKnownLocationId: Types.ObjectId;
  spotDetails: string;
  lostAt: Date;
  approximateTimeRange?: string;
  photos: string[];
  recoveryPreference: "HANDOVER_AT_SAFE_DESK" | "DIRECT_CAMPUS_MEETUP" | "MODERATOR_OFFICE";
  convertToQuest: boolean;
  linkedQuestId?: Types.ObjectId | null;
  currentClaimId?: Types.ObjectId | null;
  rewardOffered?: number;
  photoUrl?: string;
  rawPhotoUrl?: string;
  blurredPhotoUrl?: string;
  idempotencyKey?: string;
  status: ItemLifecycleState;
  stateHistory: {
    state: ItemLifecycleState;
    actorId: Types.ObjectId;
    note: string;
    timestamp: Date;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
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
    secretIdentifiers: { type: String, default: "", select: false },
    verificationQuestion: { type: String, default: "" },
    verificationAnswerHash: { type: String, default: "", select: false },
    lastKnownLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      required: true,
    },
    spotDetails: { type: String, default: "" },
    lostAt: { type: Date, required: true },
    approximateTimeRange: { type: String, default: "" },
    photos: { type: [String], default: [] },
    photoUrl: { type: String, default: "" },
    rawPhotoUrl: { type: String, default: "", select: false },
    blurredPhotoUrl: { type: String, default: "" },
    recoveryPreference: {
      type: String,
      enum: ["HANDOVER_AT_SAFE_DESK", "DIRECT_CAMPUS_MEETUP", "MODERATOR_OFFICE"],
      default: "HANDOVER_AT_SAFE_DESK",
    },
    rewardOffered: { type: Number, default: 0 },
    convertToQuest: { type: Boolean, default: false },
    linkedQuestId: { type: Schema.Types.ObjectId, ref: "Quest", default: null },
    idempotencyKey: { type: String, sparse: true, index: true },
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
LostItemSchema.index({ createdAt: -1, _id: -1 });
LostItemSchema.index({ category: 1, status: 1, createdAt: -1 });
LostItemSchema.index({ reporterId: 1, idempotencyKey: 1 }, { sparse: true });

export interface IFoundItem extends Document {
  finderId: Types.ObjectId;
  shortTitle: string;
  title?: string;
  category: ItemCategory;
  publicDescription: string;
  secretIdentifiers?: string;
  foundLocationId: Types.ObjectId;
  spotDetails: string;
  foundAt: Date;
  approximateTimeRange?: string;
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
  idempotencyKey?: string;
  status: ItemLifecycleState;
  stateHistory: {
    state: ItemLifecycleState;
    actorId: Types.ObjectId;
    note: string;
    timestamp: Date;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
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
    secretIdentifiers: { type: String, default: "", select: false },
    foundLocationId: {
      type: Schema.Types.ObjectId,
      ref: "CampusLocation",
      required: true,
    },
    spotDetails: { type: String, default: "" },
    foundAt: { type: Date, required: true },
    approximateTimeRange: { type: String, default: "" },
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
    idempotencyKey: { type: String, sparse: true, index: true },
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
FoundItemSchema.index({ createdAt: -1, _id: -1 });
FoundItemSchema.index({ category: 1, status: 1, createdAt: -1 });
FoundItemSchema.index({ finderId: 1, idempotencyKey: 1 }, { sparse: true });

export interface IClaimRequest extends Document {
  itemType: "LOST" | "FOUND";
  itemId: Types.ObjectId;
  claimantId: Types.ObjectId;
  counterpartyUserId: Types.ObjectId;
  submittedAnswer: string;
  answerMatched?: boolean;
  proofPhotoUrl?: string;
  notes: string;
  handoverCode?: string;
  handoverCodeHash?: string;
  handoverCodeExpiresAt?: Date;
  handoverAttempts: number;
  handoverLocked: boolean;
  lockoutUntil?: Date | null;
  settlementIdempotencyKey?: string;
  settlementStatus?: "PENDING" | "COMPLETED" | "FAILED_RETRYABLE";
  status:
    | "PENDING"
    | "APPROVED"
    | "HANDOVER_COMPLETE"
    | "REJECTED"
    | "DISPUTED"
    | "WITHDRAWN";
  rejectionReason?: string;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ClaimRequestSchema = new Schema<IClaimRequest>(
  {
    itemType: { type: String, enum: ["LOST", "FOUND"], required: true },
    itemId: { type: Schema.Types.ObjectId, required: true, index: true },
    claimantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    counterpartyUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedAnswer: { type: String, default: "" },
    answerMatched: { type: Boolean, default: false },
    proofPhotoUrl: { type: String, default: "" },
    notes: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    handoverCode: { type: String, select: false },
    handoverCodeHash: { type: String, select: false },
    handoverCodeExpiresAt: { type: Date },
    handoverAttempts: { type: Number, default: 0 },
    handoverLocked: { type: Boolean, default: false },
    lockoutUntil: { type: Date, default: null },
    settlementIdempotencyKey: { type: String, sparse: true, index: true },
    settlementStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED_RETRYABLE"],
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "HANDOVER_COMPLETE", "REJECTED", "DISPUTED", "WITHDRAWN"],
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
  status: "ACTIVE" | "COMPLETED" | "EXPIRED" | "DRAFT" | "ARCHIVED";
  isArchived?: boolean;
  revisions?: {
    editedBy: Types.ObjectId;
    editedByName: string;
    note: string;
    timestamp: Date;
  }[];
  expiresAt?: Date | null;
  generationSource?: "AI" | "TEMPLATE" | "ADMIN";
  dailyDate?: string | null;
  theme?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
    generationSource: {
      type: String,
      enum: ["AI", "TEMPLATE", "ADMIN"],
      default: "ADMIN",
    },
    dailyDate: { type: String, default: null, index: true },
    theme: { type: String, default: "" },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "EXPIRED", "DRAFT", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    isArchived: { type: Boolean, default: false, index: true },
    revisions: [
      {
        editedBy: { type: Schema.Types.ObjectId, ref: "User" },
        editedByName: { type: String, default: "" },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
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
  unlockedHintStages: number[];
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
    unlockedHintStages: { type: [Number], default: [] },
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

export type CanonicalSquadRole = "LEADER" | "COLEADER" | "ELDER" | "MEMBER";
export type SquadRole =
  | CanonicalSquadRole
  | ("OFFICER" & { /** @deprecated Legacy role normalized to COLEADER; retained for call-site compatibility */ });

export interface ISquad extends Document {
  name: string;
  tag: string;
  description: string;
  emblemIcon: string;
  bannerGradient: string;
  privacy: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  joinType?: "OPEN" | "INVITE_ONLY" | "CLOSED";
  minLevelRequired?: number;
  leaderId: Types.ObjectId;
  squadXp: number;
  squadLevel: number;
  completedHuntsCount: number;
  memberCap: number;
  tags?: string[];
  weeklyScore?: number;
  lastWeeklyReset?: Date;
  createdAt?: Date;
  updatedAt?: Date;
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
    joinType: {
      type: String,
      enum: ["OPEN", "INVITE_ONLY", "CLOSED"],
      default: "OPEN",
    },
    minLevelRequired: { type: Number, default: 1, min: 1, max: 10 },
    leaderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    squadXp: { type: Number, default: 0, index: true },
    squadLevel: { type: Number, default: 1 },
    completedHuntsCount: { type: Number, default: 0 },
    memberCap: { type: Number, default: 8 },
    tags: {
      type: [String],
      default: ["Casual", "Quest-focused"],
    },
    weeklyScore: { type: Number, default: 0 },
    lastWeeklyReset: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export interface ISquadMember extends Document {
  squadId: Types.ObjectId;
  userId: Types.ObjectId;
  role: SquadRole;
  squadRole?: SquadRole;
  contributedSquadXp: number;
  cluesSolvedForSquad: number;
  joinedAt: Date;
}

const SquadMemberSchema = new Schema<ISquadMember>(
  {
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["LEADER", "COLEADER", "ELDER", "MEMBER"],
      default: "MEMBER",
    },
    squadRole: {
      type: String,
      enum: ["LEADER", "COLEADER", "ELDER", "MEMBER"],
      default: "MEMBER",
    },
    contributedSquadXp: { type: Number, default: 0 },
    cluesSolvedForSquad: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
SquadMemberSchema.index({ squadId: 1, userId: 1 }, { unique: true });

export interface ISquadJoinRequest extends Document {
  squadId: Types.ObjectId;
  userId: Types.ObjectId;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";
  message?: string;
  createdAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: Types.ObjectId | null;
  decisionNote?: string;
}

const SquadJoinRequestSchema = new Schema<ISquadJoinRequest>(
  {
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"],
      default: "PENDING",
      index: true,
    },
    message: { type: String, default: "", maxlength: 300, trim: true },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decisionNote: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true }
);
SquadJoinRequestSchema.index(
  { squadId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

export interface ISquadMessage extends Document {
  squadId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  moderationState: "VISIBLE" | "HIDDEN" | "REMOVED";
  moderatedBy?: Types.ObjectId | null;
  moderationReason?: string;
  requestId?: string;
  expiresAt: Date;
  createdAt: Date;
}

const SquadMessageSchema = new Schema<ISquadMessage>(
  {
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 1000, trim: true },
    moderationState: {
      type: String,
      enum: ["VISIBLE", "HIDDEN", "REMOVED"],
      default: "VISIBLE",
      index: true,
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    moderationReason: { type: String, default: "" },
    requestId: { type: String, sparse: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
SquadMessageSchema.index({ squadId: 1, createdAt: -1, _id: -1 });
SquadMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SquadMessageSchema.index(
  { squadId: 1, senderId: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: "string" } } }
);

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
  scope?: "PLAYER" | "SQUAD";
  version?: number;
  isArchived?: boolean;
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
    scope: {
      type: String,
      enum: ["PLAYER", "SQUAD"],
      default: "PLAYER",
    },
    version: { type: Number, default: 1 },
    isArchived: { type: Boolean, default: false },
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
  referenceType: "QUEST" | "RECOVERY" | "ACHIEVEMENT" | "SHOP_PURCHASE" | "REWARD_PURCHASE" | "HINT_UNLOCK" | "ADMIN_ADJUST";
  referenceId?: Types.ObjectId | null;
  counterpartyUserId?: Types.ObjectId | null;
  approvedBy?: Types.ObjectId | null;
  idempotencyKey?: string;
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
        "REWARD_PURCHASE",
        "HINT_UNLOCK",
        "ADMIN_ADJUST",
      ],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    counterpartyUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, referenceId: 1, referenceType: 1, reason: 1 }, { unique: true, sparse: true });

export interface IRateLimitRecord extends Document {
  key: string;
  points: number;
  expireAt: Date;
}

const RateLimitRecordSchema = new Schema<IRateLimitRecord>({
  key: { type: String, required: true, unique: true },
  points: { type: Number, default: 1 },
  expireAt: { type: Date, required: true, expires: 0 },
});

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
  generationSource?: "AI" | "TEMPLATE" | "ADMIN";
  featuredBadge?: string;
  status: "DRAFT" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED" | "ARCHIVED";
  isArchived?: boolean;
  revisions?: {
    editedBy: Types.ObjectId;
    editedByName: string;
    note: string;
    timestamp: Date;
  }[];
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
    generationSource: {
      type: String,
      enum: ["AI", "TEMPLATE", "ADMIN"],
      default: "ADMIN",
    },
    featuredBadge: { type: String, default: "Award" },
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
      enum: ["DRAFT", "UPCOMING", "LIVE", "ENDED", "CANCELLED", "ARCHIVED"],
      default: "LIVE",
    },
    isArchived: { type: Boolean, default: false, index: true },
    revisions: [
      {
        editedBy: { type: Schema.Types.ObjectId, ref: "User" },
        editedByName: { type: String, default: "" },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
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
    linkUrl: {
      type: String,
      default: "/dashboard",
      validate: {
        validator: function (v: string) {
          if (!v) return true;
          const trimmed = v.trim();
          return (
            trimmed.startsWith("/") &&
            !trimmed.startsWith("//") &&
            !trimmed.includes("\\") &&
            !/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)
          );
        },
        message: "linkUrl must be a same-origin relative path only",
      },
    },
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
export const SquadJoinRequest: Model<ISquadJoinRequest> =
  mongoose.models.SquadJoinRequest || mongoose.model<ISquadJoinRequest>("SquadJoinRequest", SquadJoinRequestSchema);
export const SquadMessage: Model<ISquadMessage> =
  mongoose.models.SquadMessage || mongoose.model<ISquadMessage>("SquadMessage", SquadMessageSchema);
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
export const RateLimitRecord: Model<IRateLimitRecord> =
  mongoose.models.RateLimitRecord || mongoose.model<IRateLimitRecord>("RateLimitRecord", RateLimitRecordSchema);

export interface IEvidenceRecord extends Document {
  filename: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

const EvidenceRecordSchema = new Schema<IEvidenceRecord>(
  {
    filename: { type: String, required: true, unique: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

export const EvidenceRecord: Model<IEvidenceRecord> =
  mongoose.models.EvidenceRecord || mongoose.model<IEvidenceRecord>("EvidenceRecord", EvidenceRecordSchema);

export interface IAuditEvent extends Document {
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: "CLAIM" | "LOST_ITEM" | "FOUND_ITEM" | "QUEST" | "EVENT" | "LOCATION" | "USER" | "CONFIG" | "FRAUD_ALERT" | "REWARD" | "TRANSACTION" | "SQUAD" | "ACHIEVEMENT";
  targetId?: Types.ObjectId | null;
  targetLabel?: string;
  reason: string;
  beforeState?: any;
  afterState?: any;
  ipAddress?: string;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: {
      type: String,
      enum: ["CLAIM", "LOST_ITEM", "FOUND_ITEM", "QUEST", "EVENT", "LOCATION", "USER", "CONFIG", "FRAUD_ALERT", "REWARD", "TRANSACTION", "SQUAD", "ACHIEVEMENT"],
      required: true,
      index: true,
    },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    targetLabel: { type: String, default: "" },
    reason: { type: String, required: true },
    beforeState: { type: Schema.Types.Mixed, default: null },
    afterState: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: "" },
  },
  { timestamps: true }
);

AuditEventSchema.index({ createdAt: -1 });

export const AuditEvent: Model<IAuditEvent> =
  mongoose.models.AuditEvent || mongoose.model<IAuditEvent>("AuditEvent", AuditEventSchema);

export interface IHintUnlock extends Document {
  investigationId: Types.ObjectId;
  stageOrder: number;
  questId: Types.ObjectId;
  unlockedByUserId: Types.ObjectId;
  coinCost: number;
  unlockedAt: Date;
}

const HintUnlockSchema = new Schema<IHintUnlock>(
  {
    investigationId: { type: Schema.Types.ObjectId, ref: "Investigation", required: true, index: true },
    stageOrder: { type: Number, required: true },
    questId: { type: Schema.Types.ObjectId, ref: "Quest", required: true, index: true },
    unlockedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coinCost: { type: Number, default: 10 },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

HintUnlockSchema.index({ investigationId: 1, stageOrder: 1 }, { unique: true });

export const HintUnlock: Model<IHintUnlock> =
  mongoose.models.HintUnlock || mongoose.model<IHintUnlock>("HintUnlock", HintUnlockSchema);

export interface IHandoverMessage extends Document {
  claimId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  isPreset: boolean;
  presetCode?: string;
  isReported: boolean;
  reportedBy?: Types.ObjectId | null;
  reportReason?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HandoverMessageSchema = new Schema<IHandoverMessage>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: "ClaimRequest", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, maxlength: 500, trim: true },
    isPreset: { type: Boolean, default: false },
    presetCode: { type: String, default: "" },
    isReported: { type: Boolean, default: false },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reportReason: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

HandoverMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
HandoverMessageSchema.index({ claimId: 1, createdAt: 1 });

export const HandoverMessage: Model<IHandoverMessage> =
  mongoose.models.HandoverMessage || mongoose.model<IHandoverMessage>("HandoverMessage", HandoverMessageSchema);



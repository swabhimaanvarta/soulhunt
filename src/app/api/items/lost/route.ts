import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, Quest, Clue, SystemConfig, User, CampusLocation } from "@/models";
import { sanitizeSensitiveText } from "@/lib/privacy";
import { recordDailyQuestAction } from "@/lib/dailyQuests";

const LostItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Item title must be at least 3 characters")
    .max(120, "Item title cannot exceed 120 characters"),
  category: z.enum([
    "ELECTRONICS",
    "ID_CARDS_DOCS",
    "BOOKS_NOTES",
    "ACCESSORIES",
    "BAGS_WALLETS",
    "KEYS",
    "LAB_GEAR",
    "OTHER",
  ]),
  publicDescription: z
    .string()
    .trim()
    .min(10, "Public description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  secretIdentifiers: z.string().trim().max(500).optional().default(""),
  verificationQuestion: z.string().trim().max(300).optional().default(""),
  verificationAnswer: z.string().trim().max(200).optional().default(""),
  lastKnownLocationId: z.string().trim().min(1, "Please select the campus location last seen"),
  spotDetails: z.string().trim().max(200).optional().default(""),
  lostAt: z.string().optional(),
  approximateTimeRange: z.string().trim().max(50).optional().default(""),
  rewardOffered: z.number().int().min(0).max(1000).default(0),
  recoveryPreference: z
    .enum(["HANDOVER_AT_SAFE_DESK", "DIRECT_CAMPUS_MEETUP", "MODERATOR_OFFICE", "DIRECT_CONTACT_MODERATED"])
    .default("HANDOVER_AT_SAFE_DESK"),
  convertToQuest: z.boolean().default(false),
  photoUrl: z.string().trim().optional().default(""),
  clientRequestId: z.string().trim().max(128).optional(),
  idempotencyKey: z.string().trim().max(128).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to report a lost item." } },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNVERIFIED_ACCOUNT",
            message: "Please verify your institutional email before publishing reports.",
          },
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = LostItemSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join(".") || "Input";
      const message = `${field}: ${firstIssue?.message || "Invalid value"}`;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message,
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    await connectDB();

    const {
      title,
      category,
      publicDescription,
      secretIdentifiers,
      verificationQuestion,
      verificationAnswer,
      lastKnownLocationId,
      spotDetails,
      lostAt,
      approximateTimeRange,
      rewardOffered,
      recoveryPreference,
      convertToQuest,
      photoUrl,
      clientRequestId,
      idempotencyKey,
    } = parsed.data;

    const effectiveIdempotencyKey = idempotencyKey || clientRequestId;

    // 1. Server-Side Idempotency Replay Check (within 24 hours)
    if (effectiveIdempotencyKey) {
      const existingItem = await LostItem.findOne({
        reporterId: user._id,
        idempotencyKey: effectiveIdempotencyKey,
        createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
      }).lean();

      if (existingItem) {
        return NextResponse.json(
          {
            success: true,
            replayed: true,
            message: "Report already submitted.",
            data: {
              item: existingItem,
              quest: null,
              duplicateCandidate: null,
            },
          },
          { status: 200 }
        );
      }
    }

    // 2. Validate Campus Location
    if (!Types.ObjectId.isValid(lastKnownLocationId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_LOCATION", message: "Invalid campus location identifier." },
        },
        { status: 400 }
      );
    }

    const locationDoc = await CampusLocation.findOne({
      _id: new Types.ObjectId(lastKnownLocationId),
      isActive: true,
    }).lean();

    if (!locationDoc) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "LOCATION_NOT_FOUND", message: "Selected campus location was not found or is inactive." },
        },
        { status: 400 }
      );
    }

    // 3. Daily rate limit check
    const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
    const dailyLimit = config?.dailyReportLimitPerUser ?? 5;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countToday = await LostItem.countDocuments({
      reporterId: user._id,
      createdAt: { $gte: todayStart },
    });

    if (countToday >= dailyLimit && user.role === "STUDENT") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DAILY_LIMIT_EXCEEDED",
            message: `Daily reporting limit reached (${dailyLimit} reports per day).`,
          },
        },
        { status: 429 }
      );
    }

    // 4. Sanitize PII & Segregate Unique Identifiers
    let cleanDesc = publicDescription;
    let combinedSecret = secretIdentifiers || "";

    // If user mistakenly put serial, roll number, or barcode in public description, auto-isolate to private
    const sensitiveMatch = publicDescription.match(
      /(?:barcode|serial\s*(?:no|number|#)?|matriculation\s*id|roll\s*no)\s*[:#-]?\s*([A-Za-z0-9_-]+)/i
    );
    if (sensitiveMatch) {
      combinedSecret = combinedSecret
        ? `${combinedSecret} | Identifying Detail: ${sensitiveMatch[0]}`
        : `Identifying Detail: ${sensitiveMatch[0]}`;
      cleanDesc = cleanDesc.replace(sensitiveMatch[0], "[unique identifier withheld for privacy]");
    }

    const { sanitizedText } = sanitizeSensitiveText(cleanDesc);

    // 5. Optional verification challenge
    let verificationAnswerHash = "";
    if (verificationAnswer && verificationAnswer.trim().length > 0) {
      verificationAnswerHash = await bcrypt.hash(verificationAnswer.toLowerCase().trim(), 10);
    }

    // 6. Non-blocking duplicate detection within 48 hours
    let duplicateCandidate: any = null;
    try {
      const recentSimilar = await LostItem.findOne({
        category,
        lastKnownLocationId: new Types.ObjectId(lastKnownLocationId),
        status: { $in: ["SUBMITTED", "APPROVED", "ACTIVE"] },
        createdAt: { $gte: new Date(Date.now() - 48 * 3600 * 1000) },
        reporterId: { $ne: user._id },
      }).lean();

      if (recentSimilar) {
        duplicateCandidate = {
          id: recentSimilar._id,
          title: recentSimilar.title,
          note: "A similar lost item was reported recently in this campus sector.",
        };
      }
    } catch {
      // Non-blocking
    }

    // 7. Create LostItem Document
    const lostItem = await LostItem.create({
      reporterId: user._id,
      title,
      category,
      publicDescription: sanitizedText,
      secretIdentifiers: combinedSecret,
      verificationQuestion: verificationQuestion ? verificationQuestion.trim() : "",
      verificationAnswerHash,
      lastKnownLocationId: new Types.ObjectId(lastKnownLocationId),
      spotDetails: spotDetails || "",
      lostAt: lostAt ? new Date(lostAt) : new Date(),
      approximateTimeRange: approximateTimeRange || "",
      recoveryPreference,
      rewardOffered: Math.max(0, rewardOffered),
      convertToQuest,
      photoUrl: photoUrl || "/placeholder-item.png",
      idempotencyKey: effectiveIdempotencyKey || undefined,
      status: "ACTIVE",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: user._id,
          note: "Item reported lost by owner",
          timestamp: new Date(),
        },
      ],
    });

    await recordDailyQuestAction(user._id.toString(), "REPORT_LOST").catch((err) => {
      console.error("[DailyQuest] Failed to record lost report action:", err);
    });

    // 8. Opt-in Quest Creation
    let createdQuest = null;
    if (convertToQuest) {
      const questCount = await Quest.countDocuments();
      const questCode = `Quest #${String(questCount + 1).padStart(3, "0")}`;
      const locationName = locationDoc.name || "the designated campus sector";
      const locationCode = locationDoc.code || "SECTOR";
      const verificationCode = `${locationCode}-${Math.floor(100 + Math.random() * 900)}`;

      createdQuest = await Quest.create({
        questCode,
        title: `Recovery: ${title}`,
        description: `Field Investigation: Trace clues around ${locationName} to locate and secure ${title}.`,
        questType: "INVESTIGATION",
        difficulty: category === "ELECTRONICS" ? 3 : 2,
        linkedLostItemId: lostItem._id,
        targetLocationId: lostItem.lastKnownLocationId,
        isLocationRestricted: false,
        xpReward: 120 + rewardOffered * 2,
        coinReward: 25 + Math.floor(rewardOffered / 2),
        squadXpReward: 50,
        finderBonusXp: 20,
        status: "ACTIVE",
      });

      await Clue.create({
        questId: createdQuest._id,
        stageOrder: 1,
        title: "Initial Sighting Verification",
        clueText: `Inspect ${locationName} and verify the area checkpoint passcode (${verificationCode}).`,
        verificationType: "TEXT_RIDDLE",
        expectedAnswerNormalized: verificationCode.toLowerCase(),
        targetLocationId: lostItem.lastKnownLocationId,
        hintText: `Search the main notice board or entry portal at ${locationName}.`,
        hintCoinCost: 10,
        unlockedBreadcrumbText: `Initial report confirmed: investigation perimeter established at ${locationName}.`,
      });

      lostItem.linkedQuestId = createdQuest._id as Types.ObjectId;
      await lostItem.save();
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          item: {
            _id: lostItem._id,
            title: lostItem.title,
            category: lostItem.category,
            publicDescription: lostItem.publicDescription,
            lastKnownLocationId: lostItem.lastKnownLocationId,
            lostAt: lostAt ? new Date(lostAt) : lostItem.lostAt,
            approximateTimeRange: lostItem.approximateTimeRange,
            recoveryPreference: lostItem.recoveryPreference,
            rewardOffered: lostItem.rewardOffered,
            photoUrl: lostItem.photoUrl,
            status: lostItem.status,
            convertToQuest: lostItem.convertToQuest,
            hasVerificationQuestion: Boolean(lostItem.verificationQuestion),
          },
          quest: createdQuest,
          duplicateCandidate,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/items/lost] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "LOST_REPORT_FAILED", message: error.message || "Failed to submit lost item report." },
      },
      { status: 500 }
    );
  }
}

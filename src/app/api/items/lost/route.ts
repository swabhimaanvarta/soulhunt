import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, Quest, Clue, SystemConfig, User, CampusLocation } from "@/models";
import { sanitizeSensitiveText } from "@/lib/privacy";

const LostItemSchema = z.object({
  title: z.string().min(3).max(120),
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
  publicDescription: z.string().min(10).max(1000),
  secretIdentifiers: z.string().max(500).optional(),
  verificationQuestion: z.string().min(5).max(300),
  verificationAnswer: z.string().min(1).max(200),
  lastKnownLocationId: z.string(),
  spotDetails: z.string().max(200).optional(),
  lostAt: z.string().optional(),
  rewardOffered: z.number().int().min(0).max(1000).default(0),
  recoveryPreference: z.enum(["HANDOVER_AT_SAFE_DESK", "DIRECT_CONTACT_MODERATED"]).default("HANDOVER_AT_SAFE_DESK"),
  convertToQuest: z.boolean().default(true),
  photoUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to report a lost item." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = LostItemSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join(".") || "Input";
      const message = `${field}: ${firstIssue?.message || "Invalid value"}`;
      return NextResponse.json(
        { success: false, error: message, details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();
    const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
    const dailyLimit = config?.dailyReportLimitPerUser ?? 5;

    // Daily limit check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countToday = await LostItem.countDocuments({
      reporterId: user._id,
      createdAt: { $gte: todayStart },
    });

    if (countToday >= dailyLimit && user.role === "STUDENT") {
      return NextResponse.json(
        { success: false, error: `Daily reporting limit reached (${dailyLimit} reports per day).` },
        { status: 429 }
      );
    }

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
      rewardOffered,
      recoveryPreference,
      convertToQuest,
      photoUrl,
    } = parsed.data;

    // Sanitize PII
    let cleanDesc = publicDescription;
    let combinedSecret = secretIdentifiers || "";

    // If user mistakenly put serial or barcode in public description, segregate to private
    const sensitiveMatch = publicDescription.match(/(?:barcode|serial\s*(?:no|number|#)?|matriculation\s*id)\s*[:#-]?\s*([A-Za-z0-9_-]+)/i);
    if (sensitiveMatch) {
      combinedSecret = combinedSecret
        ? `${combinedSecret} | Identifying Detail: ${sensitiveMatch[0]}`
        : `Identifying Detail: ${sensitiveMatch[0]}`;
      cleanDesc = cleanDesc.replace(sensitiveMatch[0], "[unique identifier withheld for privacy]");
    }

    const { sanitizedText } = sanitizeSensitiveText(cleanDesc);
    const verificationAnswerHash = await bcrypt.hash(verificationAnswer.toLowerCase().trim(), 10);

    // Non-blocking duplicate detection within 48 hours
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
          note: "A similar item was reported recently at this location.",
        };
      }
    } catch {
      // Non-blocking check
    }

    const lostItem = await LostItem.create({
      reporterId: user._id,
      title,
      category,
      publicDescription: sanitizedText,
      secretIdentifiers: combinedSecret,
      verificationQuestion,
      verificationAnswerHash,
      lastKnownLocationId: new Types.ObjectId(lastKnownLocationId),
      spotDetails: spotDetails || "",
      lostAt: lostAt ? new Date(lostAt) : new Date(),
      recoveryPreference,
      rewardOffered,
      convertToQuest,
      photoUrl: photoUrl || "/placeholder-item.png",
      status: "ACTIVE",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: user._id,
          note: "Item reported lost by user",
          timestamp: new Date(),
        },
      ],
    });

    let createdQuest = null;
    if (convertToQuest) {
      const questCount = await Quest.countDocuments();
      const questCode = `Quest #${String(questCount + 1).padStart(3, "0")}`;

      const locationDoc = await CampusLocation.findById(lostItem.lastKnownLocationId).lean();
      const locationName = locationDoc?.name || "the designated campus sector";
      const locationCode = locationDoc?.code || "SECTOR";
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

      // Automatically create a starting clue without private spotDetails
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
          item: lostItem,
          quest: createdQuest,
          duplicateCandidate,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "LOST_REPORT_FAILED", message: "Failed to submit lost item report." },
      },
      { status: 500 }
    );
  }
}


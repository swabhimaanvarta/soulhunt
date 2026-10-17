import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, Quest, Clue, SystemConfig, User } from "@/models";
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
      return NextResponse.json(
        { success: false, error: "Validation error", details: parsed.error.flatten() },
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
    const { sanitizedText } = sanitizeSensitiveText(publicDescription);
    const verificationAnswerHash = await bcrypt.hash(verificationAnswer.toLowerCase().trim(), 10);

    const lostItem = await LostItem.create({
      reporterId: user._id,
      title,
      category,
      publicDescription: sanitizedText,
      secretIdentifiers: secretIdentifiers || "",
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

      createdQuest = await Quest.create({
        questCode,
        title: `Recovery: ${title}`,
        description: `Field Investigation: Trace clues around ${spotDetails || "the campus"} to locate and secure ${title}.`,
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

      // Automatically create a starting clue
      await Clue.create({
        questId: createdQuest._id,
        stageOrder: 1,
        title: "Initial Sighting Verification",
        clueText: `Inspect the area near ${spotDetails || "the reported location"} and verify the nearest campus landmark or noticeboard code.`,
        verificationType: "TEXT_RIDDLE",
        expectedAnswerNormalized: "verified",
        targetLocationId: lostItem.lastKnownLocationId,
        hintText: "Check the main entrance or notice area.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: `Initial report confirmed: item last seen near ${spotDetails || "the reported block"}.`,
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
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


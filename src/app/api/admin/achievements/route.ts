import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Achievement, UserAchievement } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

const CreateAchievementSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Code must consist of uppercase alphanumeric characters and underscores"),
  title: z.string().min(3).max(100),
  description: z.string().min(5).max(500),
  badgeIcon: z.string().default("Award"),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).default("COMMON"),
  metricKey: z.enum([
    "RECOVERIES_COUNT",
    "VISITED_BLOCKS_COUNT",
    "INVESTIGATION_QUESTS",
    "MYSTERY_NO_HINTS",
    "PLAYER_LEVEL",
    "SPEED_RECOVERY",
    "SAFE_DESK_DEPOSITS",
    "SQUAD_QUESTS",
    "SQUAD_LEVEL",
    "LEGENDARY_QUESTS",
    "TREASURES_FOUND",
  ]),
  threshold: z.number().int().positive(),
  xpReward: z.number().int().min(0).max(100000),
  coinReward: z.number().int().min(0).max(10000),
  scope: z.enum(["PLAYER", "SQUAD"]).default("PLAYER"),
  version: z.number().int().positive().default(1),
  requestId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json(
        { success: false, error: "Content management permissions required." },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");
    const rarity = searchParams.get("rarity");
    const status = searchParams.get("status"); // "ACTIVE", "ARCHIVED", "ALL"
    const search = (searchParams.get("search") || "")
      .trim()
      .slice(0, 60)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const query: any = {};

    if (scope && scope !== "ALL") query.scope = scope;
    if (rarity && rarity !== "ALL") query.rarity = rarity;

    if (status === "ACTIVE") {
      query.isActive = true;
      query.isArchived = { $ne: true };
    } else if (status === "ARCHIVED") {
      query.isArchived = true;
    }

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const achievements = await Achievement.find(query).sort({ threshold: 1, createdAt: -1 }).lean();

    // Enrich with unlockedCount
    const enriched = await Promise.all(
      achievements.map(async (ach) => {
        const unlockCount = await UserAchievement.countDocuments({
          achievementId: ach._id,
          isUnlocked: true,
        });
        return {
          ...ach,
          unlockCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enriched,
      count: enriched.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json(
        { success: false, error: "Content management permissions required." },
        { status: 403 }
      );
    }

    await connectDB();
    const body = await req.json();
    const parsed = CreateAchievementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate code
    const existing = await Achievement.findOne({ code: data.code });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Achievement with code ${data.code} already exists.`,
        },
        { status: 409 }
      );
    }

    const achievement = await Achievement.create({
      code: data.code,
      title: data.title,
      description: data.description,
      badgeIcon: data.badgeIcon,
      rarity: data.rarity,
      metricKey: data.metricKey,
      threshold: data.threshold,
      xpReward: data.xpReward,
      coinReward: data.coinReward,
      scope: data.scope,
      version: data.version,
      isActive: true,
      isArchived: false,
    });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName || user.username || "Admin",
      actorRole: user.role,
      action: "ACHIEVEMENT_CREATE",
      targetType: "ACHIEVEMENT",
      targetId: achievement._id,
      targetLabel: data.code,
      reason: `Created achievement definition ${data.code}`,
      afterState: achievement.toObject(),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Achievement ${achievement.title} created successfully.`,
        data: achievement,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

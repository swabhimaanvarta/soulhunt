import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User, Transaction } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiServerError } from "@/lib/api-error";

const CreateSquadSchema = z.object({
  name: z.string().min(3).max(30),
  tag: z.string().min(2).max(6).regex(/^[a-zA-Z0-9]+$/),
  description: z.string().max(200).optional(),
  emblemIcon: z.string().default("Shield"),
  privacy: z.enum(["PUBLIC", "INVITE_ONLY", "PRIVATE"]).optional(),
  joinType: z.enum(["OPEN", "INVITE_ONLY", "CLOSED"]).default("OPEN"),
  minLevelRequired: z.coerce.number().min(1).max(10).default(1),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const rawSearch = searchParams.get("search");

    const filter: any = {};
    if (rawSearch && rawSearch.trim()) {
      const sanitized = rawSearch.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitized, "i");
      filter.$or = [
        { name: searchRegex },
        { tag: searchRegex },
      ];
    }

    const squads = await Squad.find(filter)
      .populate("leaderId", "displayName username avatarUrl")
      .sort({ squadXp: -1 })
      .limit(50)
      .lean();

    // Enrich with member counts
    const squadIds = squads.map((s) => s._id);
    const memberCounts = await SquadMember.aggregate([
      { $match: { squadId: { $in: squadIds } } },
      { $group: { _id: "$squadId", count: { $sum: 1 } } },
    ]);

    const countMap = memberCounts.reduce((acc: any, cur: any) => {
      acc[cur._id.toString()] = cur.count;
      return acc;
    }, {});

    const enriched = squads.map((s) => ({
      ...s,
      memberCount: Math.max(1, countMap[s._id.toString()] || 1),
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    return apiServerError(error, "SQUADS_QUERY_FAILED", "Failed to query squads.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Please log in to create a squad.", 401);
    }

    await connectDB();
    const dbUser = await User.findById(user._id);
    if (!dbUser) {
      return apiError("UNAUTHORIZED", "User record not found.", 401);
    }

    if (dbUser.squadId) {
      return apiError("ALREADY_IN_SQUAD", "You are already in a squad. Leave your current squad first.", 400);
    }

    // Clash of Clans rule: Leader must be Level >= 5
    const userLevel = dbUser.level || 1;
    if (userLevel < 5) {
      return apiError(
        "INSUFFICIENT_LEVEL",
        `Squad charter requires Hunter Level 5 or higher (current: Level ${userLevel}). Complete investigation quests to level up!`,
        403
      );
    }

    // Clash of Clans rule: Charter costs 50 Hunter Coins
    const userCoins = dbUser.coins || 0;
    if (userCoins < 50) {
      return apiError(
        "INSUFFICIENT_COINS",
        `Squad charter requires 50 Hunter Coins (current balance: ${userCoins} coins). Turn in found items or solve clues to earn coins!`,
        400
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSquadSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Validation error: invalid squad name, tag, or parameters.", 400, undefined, parsed.error.flatten());
    }

    const { name, tag, description, emblemIcon, joinType, minLevelRequired } = parsed.data;

    const existing = await Squad.findOne({
      $or: [{ name: new RegExp(`^${name}$`, "i") }, { tag: tag.toUpperCase() }],
    });

    if (existing) {
      return apiError("SQUAD_EXISTS", "A squad with this name or tag already exists.", 409);
    }

    // Atomically debit 50 coins and verify level constraint in single atomic write
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, coins: { $gte: 50 }, level: { $gte: 5 } },
      { $inc: { coins: -50 } },
      { new: true }
    );

    if (!updatedUser) {
      return apiError("INSUFFICIENT_COINS", "Failed to debit squad charter fee (insufficient coins or level changed).", 400);
    }

    // Map Clash of Clans joinType to backward-compatible privacy enum
    const privacy = joinType === "OPEN" ? "PUBLIC" : joinType === "INVITE_ONLY" ? "INVITE_ONLY" : "PRIVATE";

    const squad = await Squad.create({
      name,
      tag: tag.toUpperCase(),
      description: description || "",
      emblemIcon,
      privacy,
      joinType,
      minLevelRequired: minLevelRequired || 1,
      leaderId: user._id,
      squadXp: 100,
      squadLevel: 1,
      completedHuntsCount: 0,
    });

    await SquadMember.create({
      squadId: squad._id,
      userId: user._id,
      role: "LEADER",
      squadRole: "LEADER",
      joinedAt: new Date(),
    });

    await User.findByIdAndUpdate(user._id, { $set: { squadId: squad._id } });

    // Record transaction ledger entry
    await Transaction.create({
      userId: user._id,
      type: "DEBIT",
      category: "SQUAD_CREATION",
      amount: 50,
      balanceAfter: updatedUser.coins,
      description: `Squad Charter Fee for [${tag.toUpperCase()}] ${name}`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Squad [${tag.toUpperCase()}] ${name} successfully chartered! 50 Hunter Coins debited.`,
      data: squad,
      newBalance: updatedUser.coins,
    }, { status: 201 });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_CREATE_FAILED", "Failed to create squad.");
  }
}


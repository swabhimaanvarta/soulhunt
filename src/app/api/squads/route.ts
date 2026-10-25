import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiServerError } from "@/lib/api-error";

const CreateSquadSchema = z.object({
  name: z.string().min(3).max(30),
  tag: z.string().min(2).max(6).regex(/^[a-zA-Z0-9]+$/),
  description: z.string().max(200).optional(),
  emblemIcon: z.string().default("Shield"),
  privacy: z.enum(["PUBLIC", "INVITE_ONLY"]).default("PUBLIC"),
});

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

    if (user.squadId) {
      return apiError("ALREADY_IN_SQUAD", "You are already in a squad. Leave your current squad first.", 400);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSquadSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Validation error: invalid squad name, tag, or parameters.", 400, undefined, parsed.error.flatten());
    }

    await connectDB();
    const { name, tag, description, emblemIcon, privacy } = parsed.data;

    const existing = await Squad.findOne({
      $or: [{ name: new RegExp(`^${name}$`, "i") }, { tag: tag.toUpperCase() }],
    });

    if (existing) {
      return apiError("SQUAD_EXISTS", "A squad with this name or tag already exists.", 409);
    }

    const squad = await Squad.create({
      name,
      tag: tag.toUpperCase(),
      description: description || "",
      emblemIcon,
      privacy,
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

    return NextResponse.json({ success: true, data: squad }, { status: 201 });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_CREATE_FAILED", "Failed to create squad.");
  }
}


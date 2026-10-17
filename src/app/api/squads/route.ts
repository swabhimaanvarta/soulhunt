import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";

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
    const search = searchParams.get("search");

    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { tag: new RegExp(search, "i") },
      ];
    }

    const squads = await Squad.find(filter)
      .populate("leaderId", "displayName username avatarUrl")
      .sort({ squadXp: -1 })
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to create a squad." }, { status: 401 });
    }

    if (user.squadId) {
      return NextResponse.json(
        { success: false, error: "You are already in a squad. Leave your current squad first." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = CreateSquadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();
    const { name, tag, description, emblemIcon, privacy } = parsed.data;

    const existing = await Squad.findOne({
      $or: [{ name: new RegExp(`^${name}$`, "i") }, { tag: tag.toUpperCase() }],
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A squad with this name or tag already exists." },
        { status: 409 }
      );
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
      squadRole: "LEADER",
      joinedAt: new Date(),
    });

    await User.findByIdAndUpdate(user._id, { $set: { squadId: squad._id } });

    return NextResponse.json({ success: true, data: squad }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


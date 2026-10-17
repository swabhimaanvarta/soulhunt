import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Investigation, Quest, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const my = searchParams.get("my") === "true";
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const query: any = {};

    if (my && user) {
      query.$or = [
        { participatingUserIds: user._id },
        ...(user.squadId ? [{ squadId: user.squadId }] : []),
      ];
    }

    if (status) {
      query.status = status;
    }

    const investigations = await Investigation.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate({
        path: "questId",
        select: "questCode title difficulty xpReward coinReward status linkedLostItemId targetLocationId",
      })
      .populate({
        path: "squadId",
        select: "name tag emblemIcon",
      })
      .lean();

    return NextResponse.json({
      success: true,
      investigations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch investigations" },
      { status: 500 }
    );
  }
}


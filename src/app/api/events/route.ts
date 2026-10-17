import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { getActiveCampusEvents } from "@/lib/content/contentEngine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";

    if (activeOnly) {
      const activeEvents = await getActiveCampusEvents();
      return NextResponse.json({ success: true, data: activeEvents });
    }

    await connectDB();
    const events = await Event.find()
      .populate("linkedQuestIds", "questCode title difficulty xpReward coinReward status")
      .sort({ startTime: -1 })
      .lean();

    return NextResponse.json({ success: true, data: events });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch events." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { success: false, error: "Only Admins and Event Organizers can publish events." },
        { status: 403 }
      );
    }

    const body = await req.json();
    await connectDB();

    const {
      title,
      description,
      eventType = "INTER_DEPT",
      rules = [],
      bannerGradient = "from-violet-900/80 via-slate-900 to-emerald-900/70",
      startTime,
      endTime,
      eligibleDepartments = ["ALL"],
      isSquadEvent = true,
      rewardPool,
    } = body;

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;

    const event = await Event.create({
      title,
      slug,
      eventType,
      description,
      rules: Array.isArray(rules) ? rules : [rules],
      bannerGradient,
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      eligibleDepartments,
      isSquadEvent,
      rewardPool: rewardPool || {
        firstPlaceCoins: 250,
        secondPlaceCoins: 150,
        thirdPlaceCoins: 75,
        exclusiveTitle: "AIEM Event Champion",
      },
      status: "LIVE",
      generationSource: "ADMIN",
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create event." },
      { status: 500 }
    );
  }
}


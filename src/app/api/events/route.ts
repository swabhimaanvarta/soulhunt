import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { getActiveCampusEvents } from "@/lib/content/contentEngine";
import { toPublicEventDTO } from "@/lib/event-dto";

function decodeCursor(cursorStr?: string | null): any {
  if (!cursorStr) return null;
  try {
    return JSON.parse(Buffer.from(cursorStr, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function encodeCursor(data: any): string {
  return Buffer.from(JSON.stringify(data), "utf-8").toString("base64");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";

    await connectDB();
    const user = await getCurrentUser();
    const currentUserId = user?._id?.toString() || null;

    if (activeOnly) {
      const activeEvents = await getActiveCampusEvents();
      const dtos = activeEvents.map((e) => toPublicEventDTO(e, currentUserId));
      return NextResponse.json({ success: true, data: dtos });
    }

    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    const status = searchParams.get("status") || "LIVE";
    const type = searchParams.get("type");
    const squadOnly = searchParams.get("squadOnly") === "true";
    const department = searchParams.get("department");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const filter: any = {};

    if (isStaff && status !== "ALL") {
      filter.status = status;
    } else if (!isStaff) {
      // Non-staff can see LIVE, UPCOMING, ENDED events; DRAFT is strictly private
      if (status !== "ALL" && ["LIVE", "UPCOMING", "ENDED"].includes(status)) {
        filter.status = status;
      } else {
        filter.status = { $in: ["LIVE", "UPCOMING", "ENDED"] };
      }
    }

    if (type && type !== "ALL") {
      filter.eventType = type;
    }

    if (squadOnly) {
      filter.isSquadEvent = true;
    }

    if (department && department !== "ALL") {
      filter.eligibleDepartments = { $in: [department, "ALL"] };
    }

    const decoded = decodeCursor(cursor);
    if (decoded && decoded.startTime && decoded.id) {
      const cursorDate = new Date(decoded.startTime);
      filter.$or = [
        { startTime: { $lt: cursorDate } },
        { startTime: cursorDate, _id: { $lt: decoded.id } },
      ];
    }

    const totalPromise = Event.countDocuments(filter);
    const eventsPromise = Event.find(filter)
      .populate("linkedQuestIds", "questCode title difficulty xpReward coinReward status")
      .sort({ startTime: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const [rawEvents, total] = await Promise.all([eventsPromise, totalPromise]);

    const hasMore = rawEvents.length > limit;
    const events = hasMore ? rawEvents.slice(0, limit) : rawEvents;

    let nextCursor: string | null = null;
    if (hasMore && events.length > 0) {
      const last = events[events.length - 1];
      nextCursor = encodeCursor({ startTime: last.startTime, id: last._id.toString() });
    }

    const dtos = events.map((e) => toPublicEventDTO(e, currentUserId));

    return NextResponse.json({
      success: true,
      data: dtos,
      pageInfo: {
        nextCursor,
        hasMore,
      },
      total,
    });
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

    if (!title || !description) {
      return NextResponse.json({ success: false, error: "Title and description are required." }, { status: 400 });
    }

    const start = startTime ? new Date(startTime) : new Date();
    const end = endTime ? new Date(endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (start >= end) {
      return NextResponse.json(
        { success: false, error: "Event start time must strictly be before event end time." },
        { status: 400 }
      );
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;

    const event = await Event.create({
      title,
      slug,
      eventType,
      description,
      rules: Array.isArray(rules) ? rules : [rules],
      bannerGradient,
      startTime: start,
      endTime: end,
      eligibleDepartments,
      isSquadEvent: Boolean(isSquadEvent),
      rewardPool: rewardPool || {
        firstPlaceCoins: 250,
        secondPlaceCoins: 150,
        thirdPlaceCoins: 75,
        exclusiveTitle: "AIEM Event Champion",
      },
      status: "LIVE",
      generationSource: "ADMIN",
    });

    const dto = toPublicEventDTO(event, user._id.toString());
    return NextResponse.json({ success: true, data: dto }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create event." },
      { status: 500 }
    );
  }
}

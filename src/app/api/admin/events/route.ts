import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Event } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (status) query.status = status;

    const [events, total] = await Promise.all([
      Event.find(query).sort({ startTime: -1 }).skip(skip).limit(limit).lean(),
      Event.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();

    const {
      title,
      description,
      eventType = "INTER_DEPT",
      rules = [],
      startTime,
      endTime,
      eligibleDepartments = ["ALL"],
      isSquadEvent = false,
      firstPlaceCoins = 300,
      secondPlaceCoins = 175,
      thirdPlaceCoins = 100,
      exclusiveTitle = "AIEM Vanguard",
      status = "DRAFT",
    } = body;

    if (!title || !description) {
      return NextResponse.json({ success: false, error: "Title and description are required." }, { status: 400 });
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now().toString(36)}`;

    const event = await Event.create({
      title: title.trim(),
      slug,
      eventType,
      description: description.trim(),
      rules: Array.isArray(rules) ? rules : [rules].filter(Boolean),
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      eligibleDepartments,
      isSquadEvent: Boolean(isSquadEvent),
      rewardPool: {
        firstPlaceCoins: Number(firstPlaceCoins),
        secondPlaceCoins: Number(secondPlaceCoins),
        thirdPlaceCoins: Number(thirdPlaceCoins),
        exclusiveTitle: exclusiveTitle || "AIEM Vanguard",
      },
      status: ["DRAFT", "UPCOMING", "LIVE"].includes(status) ? status : "DRAFT",
      generationSource: "ADMIN",
      revisions: [
        {
          editedBy: user._id,
          editedByName: user.displayName,
          note: `Initial event creation (${status})`,
          timestamp: new Date(),
        },
      ],
    });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: status === "LIVE" || status === "UPCOMING" ? "EVENT_PUBLISHED" : "EVENT_DRAFT_CREATED",
      targetType: "EVENT",
      targetId: event._id,
      targetLabel: event.title,
      reason: `Created event "${event.title}" (${status}).`,
      afterState: { slug, title: event.title, status: event.status },
    });

    return NextResponse.json({
      success: true,
      message: `Event "${event.title}" successfully created (${event.status}).`,
      data: event,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


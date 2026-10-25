import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Event, Quest } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const event = await Event.findById(id).lean();
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const {
      title,
      description,
      eventType,
      rules,
      startTime,
      endTime,
      firstPlaceCoins,
      secondPlaceCoins,
      thirdPlaceCoins,
      exclusiveTitle,
      status,
      revisionNote,
    } = body;

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const previousState = {
      title: event.title,
      status: event.status,
      eventType: event.eventType,
    };

    if (title) event.title = title.trim();
    if (description) event.description = description.trim();
    if (eventType) event.eventType = eventType;
    if (rules) event.rules = Array.isArray(rules) ? rules : [rules].filter(Boolean);
    if (startTime) event.startTime = new Date(startTime);
    if (endTime) event.endTime = new Date(endTime);
    if (firstPlaceCoins !== undefined) event.rewardPool.firstPlaceCoins = Number(firstPlaceCoins);
    if (secondPlaceCoins !== undefined) event.rewardPool.secondPlaceCoins = Number(secondPlaceCoins);
    if (thirdPlaceCoins !== undefined) event.rewardPool.thirdPlaceCoins = Number(thirdPlaceCoins);
    if (exclusiveTitle) event.rewardPool.exclusiveTitle = exclusiveTitle;
    if (status && ["DRAFT", "UPCOMING", "LIVE", "ENDED", "CANCELLED", "ARCHIVED"].includes(status)) {
      event.status = status;
    }

    if (!event.revisions) event.revisions = [];
    event.revisions.push({
      editedBy: user._id,
      editedByName: user.displayName,
      note: revisionNote || "Updated event parameters.",
      timestamp: new Date(),
    });

    await event.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "EVENT_EDITED",
      targetType: "EVENT",
      targetId: event._id,
      targetLabel: event.title,
      reason: revisionNote || "Updated event configuration.",
      beforeState: previousState,
      afterState: { title: event.title, status: event.status, eventType: event.eventType },
    });

    return NextResponse.json({
      success: true,
      message: `Event "${event.title}" successfully updated.`,
      data: event,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { targetStatus, reason } = body;

    if (!["DRAFT", "UPCOMING", "LIVE", "ENDED", "CANCELLED", "ARCHIVED"].includes(targetStatus)) {
      return NextResponse.json({ success: false, error: "Invalid target status." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "A valid audit reason is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const previousStatus = event.status;
    event.status = targetStatus;

    if (!event.revisions) event.revisions = [];
    event.revisions.push({
      editedBy: user._id,
      editedByName: user.displayName,
      note: `Status transition: ${previousStatus} -> ${targetStatus}. Reason: ${reason}`,
      timestamp: new Date(),
    });

    await event.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: targetStatus === "ARCHIVED" ? "EVENT_ARCHIVED" : "EVENT_STATUS_CHANGED",
      targetType: "EVENT",
      targetId: event._id,
      targetLabel: event.title,
      reason,
      beforeState: { status: previousStatus },
      afterState: { status: targetStatus },
    });

    return NextResponse.json({
      success: true,
      message: `Event status updated to ${targetStatus}.`,
      data: { eventId: event._id, status: event.status },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Duplicate event into a new DRAFT
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const source = await Event.findById(id).lean();
    if (!source) {
      return NextResponse.json({ success: false, error: "Source event not found." }, { status: 404 });
    }

    const newSlug = `${source.slug.slice(0, 30)}-copy-${Date.now().toString(36)}`;
    const duplicatedEvent = await Event.create({
      ...source,
      _id: undefined,
      slug: newSlug,
      title: `${source.title} (Draft Copy)`,
      status: "DRAFT",
      participants: [],
      generationSource: "ADMIN",
      createdAt: undefined,
      updatedAt: undefined,
      revisions: [
        {
          editedBy: user._id,
          editedByName: user.displayName,
          note: `Duplicated from event "${source.title}" (${source.slug})`,
          timestamp: new Date(),
        },
      ],
    });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "EVENT_DUPLICATED",
      targetType: "EVENT",
      targetId: duplicatedEvent._id,
      targetLabel: duplicatedEvent.title,
      reason: `Duplicated from ${source.slug}`,
      afterState: { slug: newSlug, title: duplicatedEvent.title },
    });

    return NextResponse.json({
      success: true,
      message: `Event successfully duplicated as draft: "${duplicatedEvent.title}".`,
      data: duplicatedEvent,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const linkedQuestsCount = await Quest.countDocuments({ eventId: event._id });
    const participantCount = event.participants?.length || 0;
    const isReferencedOrActive = participantCount > 0 || linkedQuestsCount > 0 || event.status !== "DRAFT";

    if (isReferencedOrActive) {
      event.status = "ARCHIVED";
      event.isArchived = true;
      if (!event.revisions) event.revisions = [];
      event.revisions.push({
        editedBy: user._id,
        editedByName: user.displayName,
        note: `Archived event via delete request (${participantCount} participants, ${linkedQuestsCount} linked quests).`,
        timestamp: new Date(),
      });
      await event.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "EVENT_ARCHIVED",
        targetType: "EVENT",
        targetId: event._id,
        targetLabel: event.title,
        reason: `Event has ${participantCount} participants and ${linkedQuestsCount} linked quests; archived instead of hard-deleted.`,
        beforeState: { status: event.status, isArchived: false },
        afterState: { status: "ARCHIVED", isArchived: true },
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Event "${event.title}" has participant records or linked quests; safely archived instead of hard deleted.`,
        data: { eventId: event._id, status: "ARCHIVED" },
      });
    }

    // Safe to hard delete unstarted empty draft
    await Event.findByIdAndDelete(event._id);

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "EVENT_DELETED",
      targetType: "EVENT",
      targetId: event._id,
      targetLabel: event.title,
      reason: `Permanently deleted unused draft event "${event.title}".`,
      beforeState: { slug: event.slug, title: event.title },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Unused draft event "${event.title}" permanently removed.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}



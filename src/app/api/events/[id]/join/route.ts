import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event, Notification } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Please sign in to register for this event." },
        { status: 401 }
      );
    }

    const { id: eventId } = await params;
    await connectDB();

    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found." },
        { status: 404 }
      );
    }

    if (event.status === "ENDED" || event.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Registration is closed for this event." },
        { status: 400 }
      );
    }

    const alreadyJoined = event.participants.some(
      (p: any) => p.userId?.toString() === user._id.toString()
    );

    if (alreadyJoined) {
      return NextResponse.json({
        success: true,
        message: "You are already registered for this event!",
        data: event,
      });
    }

    event.participants.push({
      userId: user._id,
      scoreXp: 0,
      joinedAt: new Date(),
    });
    await event.save();

    await Notification.create({
      userId: user._id,
      category: "QUEST_SQUAD",
      title: `Registered: ${event.title}`,
      message: `You are officially registered! Complete event quests to earn ranking points.`,
      linkUrl: `/events/${event._id}`,
    });

    return NextResponse.json({
      success: true,
      message: "Successfully registered for the event!",
      data: event,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to join event." },
      { status: 500 }
    );
  }
}


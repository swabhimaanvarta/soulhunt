import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Event } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { toPublicEventDTO } from "@/lib/event-dto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const user = await getCurrentUser();

    const event = await Event.findById(id).lean();
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found." },
        { status: 404 }
      );
    }

    const currentUserId = user?._id?.toString() || null;
    const dto = toPublicEventDTO(event, currentUserId);

    return NextResponse.json({
      success: true,
      data: dto,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch event." },
      { status: 500 }
    );
  }
}

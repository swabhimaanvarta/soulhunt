import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";

async function handleMarkAllRead(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const result = await Notification.updateMany(
      { userId: user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return handleMarkAllRead(req);
}

export async function POST(req: NextRequest) {
  return handleMarkAllRead(req);
}

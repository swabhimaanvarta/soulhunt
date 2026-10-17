import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Notification } from "@/models";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: user._id,
      isRead: false,
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id, markAllRead } = await req.json();

    if (markAllRead) {
      await Notification.updateMany({ userId: user._id, isRead: false }, { $set: { isRead: true } });
      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (id) {
      await Notification.findOneAndUpdate({ _id: id, userId: user._id }, { $set: { isRead: true } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Notification } from "@/models";

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const unreadOnly = searchParams.get("unread") === "true";
    const category = searchParams.get("category");
    const cursor = searchParams.get("cursor");

    const filter: any = { userId: user._id };
    if (unreadOnly) {
      filter.isRead = false;
    }
    if (category && category !== "ALL") {
      filter.category = category;
    }

    const decoded = decodeCursor(cursor);
    if (decoded && decoded.createdAt && decoded.id) {
      const cursorDate = new Date(decoded.createdAt);
      filter.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: decoded.id } },
      ];
    }

    const unreadCountPromise = Notification.countDocuments({
      userId: user._id,
      isRead: false,
    });

    const notifsPromise = Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const [rawNotifications, unreadCount] = await Promise.all([notifsPromise, unreadCountPromise]);

    const hasMore = rawNotifications.length > limit;
    const notifications = hasMore ? rawNotifications.slice(0, limit) : rawNotifications;

    let nextCursor: string | null = null;
    if (hasMore && notifications.length > 0) {
      const last = notifications[notifications.length - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt, id: last._id.toString() });
    }

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pageInfo: {
          nextCursor,
          hasMore,
        },
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

    const body = await req.json();
    const targetId = body.id || body.notificationId;
    const markAllRead = Boolean(body.markAllRead);

    if (markAllRead) {
      await Notification.updateMany({ userId: user._id, isRead: false }, { $set: { isRead: true } });
      return NextResponse.json({ success: true, message: "All notifications marked as read." });
    }

    if (targetId) {
      await Notification.findOneAndUpdate({ _id: targetId, userId: user._id }, { $set: { isRead: true } });
      return NextResponse.json({ success: true, message: "Notification marked as read." });
    }

    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Notification } from "@/models";
import { connectDB } from "@/lib/db";
import { isValidSameOriginRelativePath, sanitizeNotificationLink } from "@/lib/notifications";

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
    await connectDB();
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
    const sliced = hasMore ? rawNotifications.slice(0, limit) : rawNotifications;

    // Validate and sanitize all linkUrl fields to enforce same-origin relative paths
    const notifications = sliced.map((n) => ({
      ...n,
      linkUrl: sanitizeNotificationLink(n.linkUrl),
    }));

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

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, message, category, linkUrl, targetUserId } = body;

    if (!title || !message || !category) {
      return NextResponse.json(
        { success: false, error: "Validation failed: title, message, and category are required." },
        { status: 400 }
      );
    }

    // Strict validation of linkUrl: must be same-origin relative path only
    if (linkUrl !== undefined && linkUrl !== null && !isValidSameOriginRelativePath(linkUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed: linkUrl must be a same-origin relative path only. External domains and javascript: URIs are prohibited.",
        },
        { status: 400 }
      );
    }

    const safeLinkUrl = sanitizeNotificationLink(linkUrl);

    const recipientUserId = (user.role === "ADMIN" || user.role === "MODERATOR") && targetUserId
      ? targetUserId
      : user._id;

    const notif = await Notification.create({
      userId: recipientUserId,
      category,
      title: String(title).trim(),
      message: String(message).trim(),
      linkUrl: safeLinkUrl,
      isRead: false,
    });

    return NextResponse.json({ success: true, data: notif }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
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
      const updated = await Notification.findOneAndUpdate(
        { _id: targetId, userId: user._id },
        { $set: { isRead: true } },
        { new: true }
      );
      return NextResponse.json({
        success: true,
        message: "Notification marked as read.",
        data: updated ? { ...updated.toObject(), isRead: true } : null,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

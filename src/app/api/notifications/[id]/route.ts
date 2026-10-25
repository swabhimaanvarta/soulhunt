import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const notif = await Notification.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notif) {
      return NextResponse.json({ success: false, error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Notification marked as read.",
      data: notif,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

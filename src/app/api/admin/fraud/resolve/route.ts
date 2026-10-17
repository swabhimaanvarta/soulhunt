import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FraudAlert, User } from "@/models";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const { alertId, resolution, notes, deductTrustScore } = await req.json();
    await connectDB();

    const alert = await FraudAlert.findById(alertId);
    if (!alert) {
      return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 });
    }

    alert.status = resolution || "RESOLVED";
    alert.reviewedBy = user._id;
    alert.reviewNotes = notes || "Reviewed by Campus Security";
    await alert.save();

    if (deductTrustScore && alert.involvedUserIds.length > 0) {
      await User.updateMany(
        { _id: { $in: alert.involvedUserIds } },
        { $inc: { trustScore: -50 } }
      );
    }

    return NextResponse.json({ success: true, message: "Fraud alert updated." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


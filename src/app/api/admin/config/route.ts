import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SystemConfig } from "@/models";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ success: false, error: "Admin access required." }, { status: 403 });
    }

    await connectDB();
    const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" }).lean();
    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Only Admins can modify game economy settings." }, { status: 403 });
    }

    const body = await req.json();
    await connectDB();

    const allowedUpdates = [
      "allowedEmailDomains",
      "xpPerLevelBase",
      "xpLevelMultiplier",
      "defaultFinderBonusPct",
      "maxFinderBonusPct",
      "pairCollusionWindowDays",
      "pairCollusionMaxCount",
      "dailyReportLimitPerUser",
      "globalXpMultiplier",
      "globalCoinMultiplier",
      "maintenanceMode",
      "rankThresholds",
    ];

    const updateData: any = {};
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    const updated = await SystemConfig.findOneAndUpdate(
      { key: "GLOBAL_CONFIG" },
      { $set: updateData },
      { new: true, upsert: true }
    );

    const { logAuditEvent } = await import("@/lib/audit");
    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "CONFIG_UPDATE",
      targetType: "CONFIG",
      reason: body.reason || "Updated global system economy parameters.",
      afterState: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "System configuration and economy parameters successfully updated.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


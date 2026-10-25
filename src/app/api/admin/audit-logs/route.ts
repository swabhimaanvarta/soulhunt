import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { AuditEvent } from "@/models";
import { canAccessAdminPanel } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessAdminPanel(user)) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "";
    const targetType = searchParams.get("targetType") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (search) {
      query.$or = [
        { actorName: { $regex: search, $options: "i" } },
        { targetLabel: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actorId", "displayName username email role")
        .lean(),
      AuditEvent.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


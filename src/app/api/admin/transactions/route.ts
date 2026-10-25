import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Transaction } from "@/models";
import { canManageEconomy } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageEconomy(user)) {
      return NextResponse.json({ success: false, error: "Administrator privileges required." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const referenceType = searchParams.get("referenceType") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (referenceType) query.referenceType = referenceType;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "displayName username email department")
        .populate("approvedBy", "displayName username")
        .lean(),
      Transaction.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


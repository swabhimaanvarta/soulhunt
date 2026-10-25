import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem } from "@/models";
import { canAccessAdminPanel } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessAdminPanel(user)) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const itemType = searchParams.get("itemType") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (status) query.status = status;
    if (itemType) query.itemType = itemType;

    const [claims, total] = await Promise.all([
      ClaimRequest.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("claimantId", "displayName username email department trustScore")
        .populate("counterpartyUserId", "displayName username email department trustScore")
        .populate("reviewedBy", "displayName username")
        .lean(),
      ClaimRequest.countDocuments(query),
    ]);

    const enriched = await Promise.all(
      claims.map(async (c: any) => {
        const item =
          c.itemType === "LOST"
            ? await LostItem.findById(c.itemId).select("title category status lastKnownLocationId photos").lean()
            : await FoundItem.findById(c.itemId).select("title shortTitle category status custodyStatus safeDeskLocationId photoUrl blurredPhotoUrl").lean();
        return { ...c, itemDetails: item };
      })
    );

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


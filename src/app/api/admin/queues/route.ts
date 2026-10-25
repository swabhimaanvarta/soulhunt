import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, FoundItem, ClaimRequest, CampusLocation } from "@/models";
import { canAccessAdminPanel, canManageStationCustody } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessAdminPanel(user)) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const queue = searchParams.get("queue") || "reports_review";
    const stationId = searchParams.get("stationId") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    // Station scoping check for Safe-Desk staff
    const effectiveStationId = user.role === "SAFE_DESK_STAFF" ? user.assignedStationId?.toString() : stationId;

    if (queue === "reports_review") {
      const matchCriteria: any = {
        status: { $in: ["SUBMITTED", "UNDER_REVIEW"] },
      };
      if (search) {
        matchCriteria.$or = [
          { title: { $regex: search, $options: "i" } },
          { shortTitle: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ];
      }

      const [lostItems, foundItems] = await Promise.all([
        LostItem.find(matchCriteria)
          .sort({ createdAt: -1 })
          .populate("reporterId", "displayName username email department")
          .populate("lastKnownLocationId", "name code isSafeDesk")
          .lean(),
        FoundItem.find(matchCriteria)
          .sort({ createdAt: -1 })
          .populate("finderId", "displayName username email department")
          .populate("foundLocationId", "name code isSafeDesk")
          .populate("safeDeskLocationId", "name code")
          .lean(),
      ]);

      const merged = [
        ...lostItems.map((item: any) => ({ ...item, reportType: "LOST" })),
        ...foundItems.map((item: any) => ({ ...item, reportType: "FOUND" })),
      ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = merged.length;
      const paginated = merged.slice(skip, skip + limit);

      return NextResponse.json({
        success: true,
        data: paginated,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    if (queue === "claims_review" || queue === "approved_handovers" || queue === "disputes_overdue") {
      const statusFilter =
        queue === "claims_review"
          ? ["PENDING"]
          : queue === "approved_handovers"
          ? ["APPROVED"]
          : ["DISPUTED", "LOCKED"];

      const query: any = { status: { $in: statusFilter } };

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

      // Enrich claims with linked item details
      const enrichedClaims = await Promise.all(
        claims.map(async (c: any) => {
          const item =
            c.itemType === "LOST"
              ? await LostItem.findById(c.itemId).select("title category status lastKnownLocationId").lean()
              : await FoundItem.findById(c.itemId).select("title shortTitle category status custodyStatus safeDeskLocationId").lean();
          return { ...c, itemDetails: item };
        })
      );

      return NextResponse.json({
        success: true,
        data: enrichedClaims,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    if (queue === "station_custody") {
      const custodyQuery: any = {
        custodyStatus: { $in: ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"] },
        status: { $nin: ["COMPLETED", "RECOVERED", "ARCHIVED"] },
      };

      if (effectiveStationId) {
        custodyQuery.safeDeskLocationId = effectiveStationId;
      }
      if (search) {
        custodyQuery.$or = [
          { title: { $regex: search, $options: "i" } },
          { shortTitle: { $regex: search, $options: "i" } },
          { lockerReceiptCode: { $regex: search, $options: "i" } },
        ];
      }

      const [items, total] = await Promise.all([
        FoundItem.find(custodyQuery)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("finderId", "displayName username email")
          .populate("safeDeskLocationId", "name code building")
          .populate("currentClaimId")
          .lean(),
        FoundItem.countDocuments(custodyQuery),
      ]);

      if (user.role === "SAFE_DESK_STAFF" && !effectiveStationId) {
        return NextResponse.json(
          { success: false, error: { code: "STAFF_UNASSIGNED", message: "No active Safe-Desk station assigned to this account." } },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid queue specified." }, { status: 400 });
  } catch (error: any) {
    console.error("[Admin Queues Error]:", error);
    return NextResponse.json(
      { success: false, error: { code: "QUEUE_FETCH_FAILED", message: "Failed to load operations queue." } },
      { status: 500 }
    );
  }
}


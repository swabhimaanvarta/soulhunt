import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, FoundItem } from "@/models";
import { canAccessAdminPanel } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessAdminPanel(user)) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const itemType = searchParams.get("type") || "ALL"; // ALL, LOST, FOUND
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const baseFilter: any = {};
    if (status) baseFilter.status = status;
    if (category) baseFilter.category = category;
    if (search) {
      baseFilter.$or = [
        { title: { $regex: search, $options: "i" } },
        { shortTitle: { $regex: search, $options: "i" } },
        { publicDescription: { $regex: search, $options: "i" } },
        { lockerReceiptCode: { $regex: search, $options: "i" } },
      ];
    }

    let items: any[] = [];
    let total = 0;

    if (itemType === "LOST") {
      const [results, count] = await Promise.all([
        LostItem.find(baseFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("reporterId", "displayName username email department")
          .populate("lastKnownLocationId", "name code isSafeDesk")
          .lean(),
        LostItem.countDocuments(baseFilter),
      ]);
      items = results.map((i: any) => ({ ...i, reportType: "LOST" }));
      total = count;
    } else if (itemType === "FOUND") {
      const [results, count] = await Promise.all([
        FoundItem.find(baseFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("finderId", "displayName username email department")
          .populate("foundLocationId", "name code isSafeDesk")
          .populate("safeDeskLocationId", "name code building")
          .lean(),
        FoundItem.countDocuments(baseFilter),
      ]);
      items = results.map((i: any) => ({ ...i, reportType: "FOUND" }));
      total = count;
    } else {
      // Merged query with database-level pagination
      const [lostCount, foundCount] = await Promise.all([
        LostItem.countDocuments(baseFilter),
        FoundItem.countDocuments(baseFilter),
      ]);
      total = lostCount + foundCount;

      const pagedDocs = await LostItem.aggregate([
        { $match: baseFilter },
        { $addFields: { reportType: "LOST" } },
        {
          $unionWith: {
            coll: FoundItem.collection.name,
            pipeline: [
              { $match: baseFilter },
              { $addFields: { reportType: "FOUND" } },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]);

      const lostSubset = pagedDocs.filter((i: any) => i.reportType === "LOST");
      const foundSubset = pagedDocs.filter((i: any) => i.reportType === "FOUND");

      await Promise.all([
        lostSubset.length > 0
          ? LostItem.populate(lostSubset, [
              { path: "reporterId", select: "displayName username email department" },
              { path: "lastKnownLocationId", select: "name code isSafeDesk" },
            ])
          : Promise.resolve(),
        foundSubset.length > 0
          ? FoundItem.populate(foundSubset, [
              { path: "finderId", select: "displayName username email department" },
              { path: "foundLocationId", select: "name code isSafeDesk" },
              { path: "safeDeskLocationId", select: "name code building" },
            ])
          : Promise.resolve(),
      ]);

      items = pagedDocs;
    }

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


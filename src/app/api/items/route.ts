import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { LostItem, FoundItem } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "ALL"; // LOST, FOUND, ALL
    const category = searchParams.get("category");
    const locationId = searchParams.get("locationId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const user = await getCurrentUser();
    const isStaff = user && (user.role === "ADMIN" || user.role === "MODERATOR");

    const lostFilter: any = {};
    const foundFilter: any = {};

    if (category && category !== "ALL") {
      lostFilter.category = category;
      foundFilter.category = category;
    }

    if (locationId && locationId !== "ALL") {
      lostFilter.lastKnownLocationId = locationId;
      foundFilter.foundLocationId = locationId;
    }

    if (status && status !== "ALL") {
      lostFilter.status = status;
      foundFilter.status = status;
    } else {
      // By default show active/under review/claimed/recovered
      lostFilter.status = { $nin: ["REJECTED", "ARCHIVED"] };
      foundFilter.status = { $nin: ["REJECTED", "ARCHIVED"] };
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      lostFilter.$or = [{ title: searchRegex }, { publicDescription: searchRegex }];
      foundFilter.$or = [{ title: searchRegex }, { publicDescription: searchRegex }];
    }

    let lostItems: any[] = [];
    let foundItems: any[] = [];

    // Privacy-safe projection: Never leak secretIdentifiers or verificationAnswerHash
    const projection = isStaff
      ? ""
      : "-verificationAnswerHash -secretIdentifiers";

    if (type === "ALL" || type === "LOST") {
      lostItems = await LostItem.find(lostFilter)
        .select(projection)
        .populate("reporterId", "displayName username avatarUrl")
        .populate("lastKnownLocationId", "name code zoneType coordinates")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    if (type === "ALL" || type === "FOUND") {
      foundItems = await FoundItem.find(foundFilter)
        .select(projection)
        .populate("finderId", "displayName username avatarUrl")
        .populate("foundLocationId", "name code zoneType coordinates")
        .populate("currentCustodyLocationId", "name code isSafeDesk")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    }

    const items = [
      ...lostItems.map((item) => ({ ...item, itemType: "LOST" })),
      ...foundItems.map((item) => ({ ...item, itemType: "FOUND" })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


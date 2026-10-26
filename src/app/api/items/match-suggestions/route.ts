import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, FoundItem, CampusLocation } from "@/models";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sanitizePublicDescription } from "@/lib/privacy";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type")?.toUpperCase(); // "LOST" or "FOUND"
    const query = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim();
    const locationId = searchParams.get("locationId")?.trim();

    if (!type || !["LOST", "FOUND"].includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TYPE", message: "Parameter 'type' must be LOST or FOUND." } },
        { status: 400 }
      );
    }

    // Require at least 3 characters to search
    if (query.length < 3) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Rate limiting: max 30 match queries per minute
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(`match_suggest_${clientIp}`, 30, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Too many match suggestion requests. Please slow down." } },
        { status: 429 }
      );
    }

    await connectDB();
    const currentUser = await getCurrentUser();
    const safeRegex = new RegExp(escapeRegex(query), "i");

    const activeStatuses = ["SUBMITTED", "APPROVED", "ACTIVE", "UNDER_REVIEW"];

    let matches: any[] = [];

    if (type === "LOST") {
      // Reporter lost something -> search counterpart active FOUND items
      const filter: any = {
        status: { $in: activeStatuses },
        $or: [
          { title: safeRegex },
          { shortTitle: safeRegex },
          { publicDescription: safeRegex },
        ],
      };

      if (category && category !== "ALL") {
        filter.category = category;
      }
      if (locationId && Types.ObjectId.isValid(locationId)) {
        filter.foundLocationId = new Types.ObjectId(locationId);
      }
      if (currentUser?._id) {
        filter.finderId = { $ne: currentUser._id };
      }

      const foundResults = await FoundItem.find(filter)
        .select("_id title shortTitle category foundLocationId foundAt status createdAt")
        .populate("foundLocationId", "name zoneType building")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      matches = foundResults.map((item: any) => {
        const rawTitle = item.title || item.shortTitle || "Found Item";
        const loc = item.foundLocationId;
        const locationName = loc ? `${loc.name}${loc.building ? ` (${loc.building})` : ""}` : "Campus Ground";
        return {
          _id: item._id.toString(),
          title: sanitizePublicDescription(rawTitle).sanitizedText,
          category: item.category,
          locationName,
          date: item.foundAt || item.createdAt,
          itemType: "FOUND",
        };
      });
    } else {
      // Finder found something -> search counterpart active LOST items
      const filter: any = {
        status: { $in: activeStatuses },
        $or: [
          { title: safeRegex },
          { publicDescription: safeRegex },
        ],
      };

      if (category && category !== "ALL") {
        filter.category = category;
      }
      if (locationId && Types.ObjectId.isValid(locationId)) {
        filter.lastKnownLocationId = new Types.ObjectId(locationId);
      }
      if (currentUser?._id) {
        filter.reporterId = { $ne: currentUser._id };
      }

      const lostResults = await LostItem.find(filter)
        .select("_id title category lastKnownLocationId lostAt status createdAt")
        .populate("lastKnownLocationId", "name zoneType building")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      matches = lostResults.map((item: any) => {
        const rawTitle = item.title || "Lost Item";
        const loc = item.lastKnownLocationId;
        const locationName = loc ? `${loc.name}${loc.building ? ` (${loc.building})` : ""}` : "Campus Ground";
        return {
          _id: item._id.toString(),
          title: sanitizePublicDescription(rawTitle).sanitizedText,
          category: item.category,
          locationName,
          date: item.lostAt || item.createdAt,
          itemType: "LOST",
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: matches,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to search match suggestions." } },
      { status: 500 }
    );
  }
}

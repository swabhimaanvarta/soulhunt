import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { LostItem, FoundItem, CampusLocation } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { toPublicItemDTO } from "@/lib/item-dto";

const QuerySchema = z.object({
  type: z.enum(["LOST", "FOUND", "ALL"]).default("ALL"),
  category: z.string().optional(),
  locationId: z.string().optional(),
  status: z.string().optional(),
  custodyStatus: z.string().optional(),
  zoneType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().max(60).optional(),
  sort: z.enum(["newest", "oldest", "category"]).default("newest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  page: z.coerce.number().min(1).optional(), // backward compatibility
});

function decodeCursor(cursorStr?: string | null): any {
  if (!cursorStr) return null;
  try {
    const raw = Buffer.from(cursorStr, "base64").toString("utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function encodeCursor(data: any): string {
  return Buffer.from(JSON.stringify(data), "utf-8").toString("base64");
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const queryObj: Record<string, any> = {};
    for (const [key, val] of searchParams.entries()) {
      queryObj[key] = val;
    }

    const parsed = QuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_FILTERS", message: "Invalid query parameters.", details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }

    const {
      type,
      category,
      locationId,
      status,
      custodyStatus,
      zoneType,
      startDate,
      endDate,
      fromDate,
      toDate,
      search,
      sort,
      cursor,
      limit,
      page,
    } = parsed.data;

    const user = await getCurrentUser();
    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

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

    if (zoneType && zoneType !== "ALL") {
      const locsInZone = await CampusLocation.find({ zoneType }).select("_id").lean();
      const locIds = locsInZone.map((l) => l._id);
      lostFilter.lastKnownLocationId = { $in: locIds };
      foundFilter.foundLocationId = { $in: locIds };
    }

    const from = fromDate || startDate;
    const to = toDate || endDate;
    if (from || to) {
      const dateRange: any = {};
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) dateRange.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          dateRange.$lte = d;
        }
      }
      if (Object.keys(dateRange).length > 0) {
        lostFilter.createdAt = dateRange;
        foundFilter.createdAt = dateRange;
      }
    }

    if (status && status !== "ALL") {
      lostFilter.status = status;
      foundFilter.status = status;
    } else {
      lostFilter.status = { $nin: ["REJECTED", "ARCHIVED"] };
      foundFilter.status = { $nin: ["REJECTED", "ARCHIVED"] };
    }

    if (custodyStatus && custodyStatus !== "ALL") {
      foundFilter.custodyStatus = custodyStatus;
    }

    let lostSearchConds: any[] | undefined;
    let foundSearchConds: any[] | undefined;
    if (search && search.trim()) {
      const sanitized = search.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitized, "i");
      lostSearchConds = [{ title: searchRegex }, { publicDescription: searchRegex }];
      foundSearchConds = [{ title: searchRegex }, { shortTitle: searchRegex }, { publicDescription: searchRegex }];
    }

    function buildFilterWithCursor(baseFilter: Record<string, any>, searchConds?: any[], cursorConds?: any[]) {
      const filter = { ...baseFilter };
      if (searchConds && searchConds.length > 0 && cursorConds && cursorConds.length > 0) {
        filter.$and = [{ $or: searchConds }, { $or: cursorConds }];
      } else if (searchConds && searchConds.length > 0) {
        filter.$or = searchConds;
      } else if (cursorConds && cursorConds.length > 0) {
        filter.$or = cursorConds;
      }
      return filter;
    }

    const decoded = decodeCursor(cursor);

    let itemsDTO: any[] = [];
    let nextCursor: string | null = null;
    let hasMore = false;
    let total = 0;

    const sortOrder = sort === "oldest" ? 1 : -1;
    const mongoSort: any =
      sort === "category" ? { category: 1, createdAt: -1, _id: -1 } : { createdAt: sortOrder, _id: sortOrder };

    if (type === "LOST") {
      let lostCursorConds: any[] | undefined;
      let skipCount = 0;
      if (decoded && decoded.createdAt && decoded.id) {
        const cursorDate = new Date(decoded.createdAt);
        const objId = Types.ObjectId.isValid(decoded.id) ? new Types.ObjectId(decoded.id) : decoded.id;
        if (sort === "category" && decoded.category) {
          lostCursorConds = [
            { category: { $gt: decoded.category } },
            {
              category: decoded.category,
              $or: [
                { createdAt: { $lt: cursorDate } },
                { createdAt: cursorDate, _id: { $lt: objId } },
              ],
            },
          ];
        } else {
          const compOp = sort === "oldest" ? "$gt" : "$lt";
          lostCursorConds = [
            { createdAt: { [compOp]: cursorDate } },
            { createdAt: cursorDate, _id: { [compOp]: objId } },
          ];
        }
      } else if (page && page > 1) {
        // Fallback for page-based legacy requests
        skipCount = (page - 1) * limit;
      }
      const countFilter = buildFilterWithCursor(lostFilter, lostSearchConds);
      const queryFilter = buildFilterWithCursor(lostFilter, lostSearchConds, lostCursorConds);

      const countPromise = LostItem.countDocuments(countFilter);
      let query = LostItem.find(queryFilter)
        .select("-verificationAnswerHash -secretIdentifiers")
        .populate("reporterId", "displayName username avatarUrl")
        .populate("lastKnownLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
        .sort(mongoSort);

      if (skipCount > 0) {
        query = query.skip(skipCount);
      }

      const [items, totalCount] = await Promise.all([query.limit(limit + 1).lean(), countPromise]);
      total = totalCount;

      hasMore = items.length > limit;
      const sliced = hasMore ? items.slice(0, limit) : items;
      itemsDTO = sliced.map((item) => toPublicItemDTO(item, "LOST", isStaff));

      if (hasMore && sliced.length > 0) {
        const last = sliced[sliced.length - 1];
        nextCursor = encodeCursor({
          category: last.category,
          createdAt: last.createdAt,
          id: last._id.toString(),
        });
      }
    } else if (type === "FOUND") {
      let foundCursorConds: any[] | undefined;
      let skipCount = 0;
      if (decoded && decoded.createdAt && decoded.id) {
        const cursorDate = new Date(decoded.createdAt);
        const objId = Types.ObjectId.isValid(decoded.id) ? new Types.ObjectId(decoded.id) : decoded.id;
        if (sort === "category" && decoded.category) {
          foundCursorConds = [
            { category: { $gt: decoded.category } },
            {
              category: decoded.category,
              $or: [
                { createdAt: { $lt: cursorDate } },
                { createdAt: cursorDate, _id: { $lt: objId } },
              ],
            },
          ];
        } else {
          const compOp = sort === "oldest" ? "$gt" : "$lt";
          foundCursorConds = [
            { createdAt: { [compOp]: cursorDate } },
            { createdAt: cursorDate, _id: { [compOp]: objId } },
          ];
        }
      } else if (page && page > 1) {
        skipCount = (page - 1) * limit;
      }
      const countFilter = buildFilterWithCursor(foundFilter, foundSearchConds);
      const queryFilter = buildFilterWithCursor(foundFilter, foundSearchConds, foundCursorConds);

      const countPromise = FoundItem.countDocuments(countFilter);
      let query = FoundItem.find(queryFilter)
        .select("-rawPhotoUrl")
        .populate("finderId", "displayName username avatarUrl")
        .populate("foundLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
        .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
        .sort(mongoSort);

      if (skipCount > 0) {
        query = query.skip(skipCount);
      }

      const [items, totalCount] = await Promise.all([query.limit(limit + 1).lean(), countPromise]);
      total = totalCount;

      hasMore = items.length > limit;
      const sliced = hasMore ? items.slice(0, limit) : items;
      itemsDTO = sliced.map((item) => toPublicItemDTO(item, "FOUND", isStaff));

      if (hasMore && sliced.length > 0) {
        const last = sliced[sliced.length - 1];
        nextCursor = encodeCursor({
          category: last.category,
          createdAt: last.createdAt,
          id: last._id.toString(),
        });
      }
    } else {
      // type === "ALL": Combined query with dual stream cursors
      let lostCursorConds: any[] | undefined;
      if (decoded?.lost?.createdAt && decoded?.lost?.id) {
        const d = new Date(decoded.lost.createdAt);
        const objId = Types.ObjectId.isValid(decoded.lost.id) ? new Types.ObjectId(decoded.lost.id) : decoded.lost.id;
        if (sort === "category" && decoded.lost.category) {
          lostCursorConds = [
            { category: { $gt: decoded.lost.category } },
            {
              category: decoded.lost.category,
              $or: [
                { createdAt: { $lt: d } },
                { createdAt: d, _id: { $lt: objId } },
              ],
            },
          ];
        } else {
          const compOp = sort === "oldest" ? "$gt" : "$lt";
          lostCursorConds = [{ createdAt: { [compOp]: d } }, { createdAt: d, _id: { [compOp]: objId } }];
        }
      }

      let foundCursorConds: any[] | undefined;
      if (decoded?.found?.createdAt && decoded?.found?.id) {
        const d = new Date(decoded.found.createdAt);
        const objId = Types.ObjectId.isValid(decoded.found.id) ? new Types.ObjectId(decoded.found.id) : decoded.found.id;
        if (sort === "category" && decoded.found.category) {
          foundCursorConds = [
            { category: { $gt: decoded.found.category } },
            {
              category: decoded.found.category,
              $or: [
                { createdAt: { $lt: d } },
                { createdAt: d, _id: { $lt: objId } },
              ],
            },
          ];
        } else {
          const compOp = sort === "oldest" ? "$gt" : "$lt";
          foundCursorConds = [{ createdAt: { [compOp]: d } }, { createdAt: d, _id: { [compOp]: objId } }];
        }
      }

      const countLostFilter = buildFilterWithCursor(lostFilter, lostSearchConds);
      const queryLostFilter = buildFilterWithCursor(lostFilter, lostSearchConds, lostCursorConds);
      const countFoundFilter = buildFilterWithCursor(foundFilter, foundSearchConds);
      const queryFoundFilter = buildFilterWithCursor(foundFilter, foundSearchConds, foundCursorConds);

      const [lostCount, foundCount, rawLost, rawFound] = await Promise.all([
        LostItem.countDocuments(countLostFilter),
        FoundItem.countDocuments(countFoundFilter),
        LostItem.find(queryLostFilter)
          .select("-verificationAnswerHash -secretIdentifiers")
          .populate("reporterId", "displayName username avatarUrl")
          .populate("lastKnownLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
          .sort(mongoSort)
          .limit(limit + 1)
          .lean(),
        FoundItem.find(queryFoundFilter)
          .select("-rawPhotoUrl")
          .populate("finderId", "displayName username avatarUrl")
          .populate("foundLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
          .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
          .sort(mongoSort)
          .limit(limit + 1)
          .lean(),
      ]);

      total = lostCount + foundCount;

      const taggedLost = rawLost.map((i) => ({ ...toPublicItemDTO(i, "LOST", isStaff), _rawType: "LOST" as const }));
      const taggedFound = rawFound.map((i) => ({ ...toPublicItemDTO(i, "FOUND", isStaff), _rawType: "FOUND" as const }));

      const merged = [...taggedLost, ...taggedFound].sort((a, b) => {
        if (sort === "category") {
          const catDiff = (a.category || "").localeCompare(b.category || "");
          if (catDiff !== 0) return catDiff;
        }
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        const diff = sort === "oldest" ? timeA - timeB : timeB - timeA;
        if (diff !== 0) return diff;
        const idComp = b._id.toString().localeCompare(a._id.toString());
        return sort === "oldest" ? -idComp : idComp;
      });

      hasMore = merged.length > limit;
      const sliced = merged.slice(0, limit);
      itemsDTO = sliced.map(({ _rawType, ...rest }) => rest);

      if (hasMore && sliced.length > 0) {
        // Find last consumed positions in lost and found
        const lastLost = [...sliced].reverse().find((item) => (item as any).itemType === "LOST");
        const lastFound = [...sliced].reverse().find((item) => (item as any).itemType === "FOUND");

        nextCursor = encodeCursor({
          lost: lastLost
            ? { category: lastLost.category, createdAt: lastLost.createdAt, id: lastLost._id.toString() }
            : decoded?.lost,
          found: lastFound
            ? { category: lastFound.category, createdAt: lastFound.createdAt, id: lastFound._id.toString() }
            : decoded?.found,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: itemsDTO,
      pageInfo: {
        nextCursor,
        hasMore,
      },
      pagination: {
        page: page || 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      total,
    });
  } catch (error: any) {
    console.error("[Items API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "ITEMS_QUERY_FAILED", message: "Failed to retrieve items." },
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Quest, Clue, Investigation, SystemConfig } from "@/models";
import { getCurrentUser } from "@/lib/auth";

function decodeCursor(cursorStr?: string | null): any {
  if (!cursorStr) return null;
  try {
    return JSON.parse(Buffer.from(cursorStr, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function encodeCursor(data: any): string {
  return Buffer.from(JSON.stringify(data), "utf-8").toString("base64");
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const statusParam = searchParams.get("status") || "ACTIVE";
    const difficulty = searchParams.get("difficulty");
    const squadOnly = searchParams.get("squadOnly") === "true";
    const minReward = searchParams.get("minReward");
    const maxReward = searchParams.get("maxReward");
    const search = searchParams.get("search");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const filter: any = {};

    // Lifecycle status filter
    if (isStaff && statusParam !== "ALL") {
      filter.status = statusParam;
    } else if (!isStaff) {
      // Non-staff can only see ACTIVE quests (DRAFT and ARCHIVED are strictly private)
      filter.status = "ACTIVE";
    }

    if (type && type !== "ALL") {
      filter.questType = type;
    }

    if (difficulty && difficulty !== "ALL") {
      filter.difficulty = difficulty;
    }

    if (squadOnly) {
      filter.questType = "SQUAD_HUNT";
    }

    if (minReward || maxReward) {
      filter.coinReward = {};
      if (minReward) filter.coinReward.$gte = Number(minReward);
      if (maxReward) filter.coinReward.$lte = Number(maxReward);
    }

    let questSearchConds: any[] | undefined;
    if (search && search.trim()) {
      const sanitized = search.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitized, "i");
      questSearchConds = [{ title: searchRegex }, { description: searchRegex }, { questCode: searchRegex }];
    }

    let questCursorConds: any[] | undefined;
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.createdAt && decoded.id) {
      const cursorDate = new Date(decoded.createdAt);
      const qId = Types.ObjectId.isValid(decoded.id) ? new Types.ObjectId(decoded.id) : decoded.id;
      questCursorConds = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: qId } },
      ];
    }

    if (questSearchConds && questCursorConds) {
      filter.$and = [{ $or: questSearchConds }, { $or: questCursorConds }];
    } else if (questSearchConds) {
      filter.$or = questSearchConds;
    } else if (questCursorConds) {
      filter.$or = questCursorConds;
    }

    const totalPromise = Quest.countDocuments(filter);
    const questsPromise = Quest.find(filter)
      .populate("targetLocationId", "name code zoneType coordinates")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const [rawQuests, total] = await Promise.all([questsPromise, totalPromise]);

    const hasMore = rawQuests.length > limit;
    const quests = hasMore ? rawQuests.slice(0, limit) : rawQuests;

    let nextCursor: string | null = null;
    if (hasMore && quests.length > 0) {
      const last = quests[quests.length - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt, id: last._id.toString() });
    }

    // Include clue count for each quest
    const questIds = quests.map((q) => q._id);
    const clues = await Clue.find({ questId: { $in: questIds } }).select("questId stageOrder").lean();

    const clueCountMap = clues.reduce((acc: any, c: any) => {
      const qId = c.questId.toString();
      acc[qId] = (acc[qId] || 0) + 1;
      return acc;
    }, {});

    // User investigation state mapping (strictly decoupled for solo vs squad)
    const soloInvMap = new Map<string, any>();
    const squadInvMap = new Map<string, any>();
    if (user) {
      const [soloInvs, squadInvs] = await Promise.all([
        Investigation.find({
          questId: { $in: questIds },
          userId: user._id,
          isSquadInvestigation: false,
        })
          .select("questId status progressPct currentStage updatedAt")
          .sort({ updatedAt: -1 })
          .lean(),
        user.squadId
          ? Investigation.find({
              questId: { $in: questIds },
              squadId: user.squadId,
              isSquadInvestigation: true,
            })
              .select("questId status progressPct currentStage updatedAt")
              .sort({ updatedAt: -1 })
              .lean()
          : Promise.resolve([]),
      ]);

      for (const inv of soloInvs) {
        const qid = inv.questId.toString();
        const existing = soloInvMap.get(qid);
        if (!existing || inv.status === "COMPLETED") {
          soloInvMap.set(qid, inv);
        }
      }

      for (const inv of squadInvs) {
        const qid = inv.questId.toString();
        const existing = squadInvMap.get(qid);
        if (!existing || inv.status === "COMPLETED") {
          squadInvMap.set(qid, inv);
        }
      }
    }

    const enriched = quests.map((q: any) => {
      const loc = q.targetLocationId ? {
        _id: q.targetLocationId._id,
        name: q.targetLocationId.name,
        code: q.targetLocationId.code,
        zoneType: q.targetLocationId.zoneType,
        ...(isStaff && q.targetLocationId.coordinates
          ? { coordinates: q.targetLocationId.coordinates }
          : {}),
      } : undefined;

      const safeQuest: any = {
        _id: q._id,
        questCode: q.questCode,
        title: q.title,
        description: q.description,
        questType: q.questType,
        difficulty: q.difficulty,
        xpReward: q.xpReward,
        coinReward: q.coinReward,
        squadXpReward: q.squadXpReward,
        finderBonusXp: q.finderBonusXp,
        isLocationRestricted: q.isLocationRestricted,
        unlockLocationAtStage: q.unlockLocationAtStage,
        status: q.status,
        createdAt: q.createdAt,
        targetLocationId: loc,
        totalStages: clueCountMap[q._id.toString()] || 0,
      };

      const soloInv = soloInvMap.get(q._id.toString());
      const squadInv = squadInvMap.get(q._id.toString());

      let activeOrLatestInv = null;
      if (
        soloInv &&
        ["IN_PROGRESS", "READY_FOR_RECOVERY", "SUBMITTED_FOR_VERIFICATION"].includes(soloInv.status)
      ) {
        activeOrLatestInv = soloInv;
      } else if (
        squadInv &&
        ["IN_PROGRESS", "READY_FOR_RECOVERY", "SUBMITTED_FOR_VERIFICATION"].includes(squadInv.status)
      ) {
        activeOrLatestInv = squadInv;
      } else if (soloInv) {
        activeOrLatestInv = soloInv;
      } else if (squadInv && squadInv.status === "COMPLETED") {
        activeOrLatestInv = null;
      }

      safeQuest.isCompletedByUser = soloInv?.status === "COMPLETED";
      safeQuest.isCompletedBySquad = squadInv?.status === "COMPLETED";
      safeQuest.userInvestigationStatus = activeOrLatestInv?.status || (soloInv?.status) || "NOT_STARTED";
      safeQuest.userInvestigationId = activeOrLatestInv?._id?.toString() || null;
      safeQuest.userProgressPct = activeOrLatestInv?.progressPct || 0;
      safeQuest.soloInvestigation = soloInv || null;
      safeQuest.squadInvestigation = squadInv || null;
      safeQuest.soloInvestigationStatus = soloInv?.status || "NOT_STARTED";
      safeQuest.soloInvestigationId = soloInv?._id?.toString() || null;
      safeQuest.squadInvestigationStatus = squadInv?.status || "NOT_STARTED";
      safeQuest.squadInvestigationId = squadInv?._id?.toString() || null;

      // Sensitive operational fields only visible to staff
      if (isStaff) {
        safeQuest.linkedLostItemId = q.linkedLostItemId;
        safeQuest.linkedFoundItemId = q.linkedFoundItemId;
        safeQuest.restrictedRoomNote = q.restrictedRoomNote;
        safeQuest.revisions = q.revisions;
      }

      return safeQuest;
    });

    return NextResponse.json({
      success: true,
      data: enriched,
      pageInfo: {
        nextCursor,
        hasMore,
      },
      total,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "QUESTS_QUERY_FAILED", message: "Failed to retrieve quests." } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ success: false, error: "Only Admins and Moderators can create quests." }, { status: 403 });
    }

    const body = await req.json();
    await connectDB();

    const {
      title,
      description,
      questType = "CAMPUS_TREASURE",
      difficulty = "MEDIUM",
      targetLocationId,
      xpReward = 100,
      coinReward = 20,
      squadXpReward = 50,
      finderBonusXp = 25,
      isLocationRestricted = false,
      unlockLocationAtStage = 1,
      linkedLostItemId,
      linkedFoundItemId,
      restrictedRoomNote,
      status = "DRAFT",
    } = body;

    if (!title || !description) {
      return NextResponse.json({ success: false, error: "Quest title and brief description are required." }, { status: 400 });
    }

    const questCode = `Q-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const quest = await Quest.create({
      questCode,
      title,
      description,
      questType,
      difficulty,
      targetLocationId: targetLocationId || undefined,
      xpReward: Math.max(0, Number(xpReward)),
      coinReward: Math.max(0, Number(coinReward)),
      squadXpReward: Math.max(0, Number(squadXpReward)),
      finderBonusXp: Math.max(0, Number(finderBonusXp)),
      isLocationRestricted: Boolean(isLocationRestricted),
      unlockLocationAtStage: Number(unlockLocationAtStage) || 1,
      linkedLostItemId: linkedLostItemId || undefined,
      linkedFoundItemId: linkedFoundItemId || undefined,
      restrictedRoomNote: restrictedRoomNote || "",
      status: ["DRAFT", "ACTIVE", "ARCHIVED"].includes(status) ? status : "DRAFT",
      revisions: [
        {
          editedBy: user._id,
          editedByName: user.displayName,
          note: "Initial quest creation",
          timestamp: new Date(),
        },
      ],
    });

    return NextResponse.json({ success: true, data: quest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

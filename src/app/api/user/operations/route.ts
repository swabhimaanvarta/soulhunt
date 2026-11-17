import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, FoundItem, ClaimRequest, Investigation } from "@/models";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";

interface LiveBadge {
  label: string;
  color: "emerald" | "cyan" | "amber" | "rose" | "purple" | "slate";
  actionable?: boolean;
}

function getLostItemBadge(status: string, convertToQuest?: boolean, linkedQuestId?: any): LiveBadge {
  switch (status) {
    case "SUBMITTED":
      return { label: "Pending Triage", color: "amber" };
    case "UNDER_REVIEW":
      return { label: "Under Review", color: "cyan" };
    case "ACTIVE":
    case "APPROVED":
      if (convertToQuest && linkedQuestId) {
        return { label: "Active Bounty Quest", color: "purple" };
      }
      return { label: "Active Search", color: "emerald" };
    case "CLAIMED":
    case "VERIFICATION":
      return { label: "Match Verification", color: "amber" };
    case "RECOVERED":
    case "COMPLETED":
      return { label: "Recovered", color: "emerald" };
    case "REJECTED":
      return { label: "Rejected", color: "rose" };
    case "DISPUTED":
      return { label: "Disputed", color: "rose" };
    case "EXPIRED":
      return { label: "Expired", color: "slate" };
    case "ARCHIVED":
      return { label: "Archived", color: "slate" };
    default:
      return { label: status, color: "slate" };
  }
}

function getFoundItemBadge(status: string, custodyStatus: string): LiveBadge {
  if (status === "RECOVERED" || status === "COMPLETED") {
    return { label: "Returned to Owner", color: "emerald" };
  }
  if (status === "CLAIMED" || status === "VERIFICATION") {
    return { label: "Claim Verification", color: "amber" };
  }
  if (status === "REJECTED") {
    return { label: "Intake Rejected", color: "rose" };
  }
  if (custodyStatus === "SAFE_DESK" || custodyStatus === "DEPOSITED_AT_SAFE_DESK") {
    return { label: "In Safe-Desk Custody", color: "cyan" };
  }
  if (custodyStatus === "HELD_BY_FINDER" || custodyStatus === "FINDER_HELD") {
    return { label: "Finder Held (Pending Deposit)", color: "amber" };
  }
  if (custodyStatus === "ADMIN_OFFICE" || custodyStatus === "HANDED_TO_MODERATOR") {
    return { label: "In Moderator Custody", color: "cyan" };
  }
  return { label: "Intake Logged", color: "slate" };
}

function getClaimBadge(status: string, handoverLocked?: boolean): LiveBadge {
  switch (status) {
    case "PENDING":
      return { label: "Pending Review", color: "cyan", actionable: false };
    case "APPROVED":
      if (handoverLocked) {
        return { label: "PIN Locked (Max Tries)", color: "rose", actionable: false };
      }
      return { label: "Handover Ready", color: "amber", actionable: true };
    case "HANDOVER_COMPLETE":
      return { label: "Handover Complete", color: "emerald", actionable: false };
    case "REJECTED":
      return { label: "Rejected", color: "rose", actionable: false };
    case "DISPUTED":
      return { label: "Disputed", color: "rose", actionable: false };
    case "WITHDRAWN":
      return { label: "Withdrawn", color: "slate", actionable: false };
    default:
      return { label: status, color: "slate", actionable: false };
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Please log in to view your operations.", 401);
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "all";
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

    await connectDB();

    const userObjId = new Types.ObjectId(user._id.toString());

    // Execute queries in parallel
    const [
      lostTotal,
      foundTotal,
      claimsTotal,
      lostDocs,
      foundDocs,
      claimDocs,
      invDocs,
    ] = await Promise.all([
      LostItem.countDocuments({ reporterId: userObjId }),
      FoundItem.countDocuments({ finderId: userObjId }),
      ClaimRequest.countDocuments({ claimantId: userObjId }),

      LostItem.find({ reporterId: userObjId })
        .select("-secretIdentifiers -verificationAnswerHash -rawPhotoUrl")
        .populate("lastKnownLocationId", "name code isSafeDesk")
        .populate("linkedQuestId", "questCode title status")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      FoundItem.find({ finderId: userObjId })
        .select("-secretIdentifiers -rawPhotoUrl")
        .populate("foundLocationId", "name code")
        .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
        .populate("safeDeskLocationId", "name code")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      ClaimRequest.find({ claimantId: userObjId })
        .select("-handoverCode -handoverCodeHash")
        .populate("counterpartyUserId", "displayName username avatarUrl")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      Investigation.find({
        $or: [
          { "solvedClues.solvedByUserId": userObjId },
          { "evidenceNodes.authorId": userObjId },
        ],
      })
        .populate("questId", "questCode title difficulty targetLocationId")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    // Batch resolve polymorphic claim items
    const lostItemIds: Types.ObjectId[] = [];
    const foundItemIds: Types.ObjectId[] = [];

    for (const c of claimDocs) {
      if (c.itemType === "LOST") {
        lostItemIds.push(c.itemId);
      } else {
        foundItemIds.push(c.itemId);
      }
    }

    const [polymorphicLost, polymorphicFound] = await Promise.all([
      lostItemIds.length > 0
        ? LostItem.find({ _id: { $in: lostItemIds } })
            .select("title category status photoUrl blurredPhotoUrl spotDetails")
            .populate("lastKnownLocationId", "name code isSafeDesk")
            .lean()
        : [],
      foundItemIds.length > 0
        ? FoundItem.find({ _id: { $in: foundItemIds } })
            .select("title shortTitle category status photoUrl blurredPhotoUrl custodyStatus spotDetails lockerReceiptCode")
            .populate("foundLocationId", "name code")
            .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
            .populate("safeDeskLocationId", "name code")
            .lean()
        : [],
    ]);

    const lostMap = new Map(polymorphicLost.map((i: any) => [i._id.toString(), i]));
    const foundMap = new Map(polymorphicFound.map((i: any) => [i._id.toString(), i]));

    // Format Lost Items
    const formattedLost = (lostDocs as any[]).map((item) => {
      const location = item.lastKnownLocationId as any;
      const locationName = location?.name || item.spotDetails || "Campus Grounds";
      const linkedQuestDoc = item.linkedQuestId as any;
      const linkedQuest = linkedQuestDoc
        ? {
            id: linkedQuestDoc._id ? linkedQuestDoc._id.toString() : "",
            code: linkedQuestDoc.questCode || "QUEST",
            title: linkedQuestDoc.title || "Recovery Quest",
          }
        : undefined;

      const safePhoto = item.photoUrl || item.blurredPhotoUrl || (item.photos && item.photos[0]) || "";

      return {
        _id: item._id.toString(),
        title: item.title,
        category: item.category,
        status: item.status,
        liveBadge: getLostItemBadge(item.status, item.convertToQuest, item.linkedQuestId),
        locationName,
        rewardOffered: item.rewardOffered || 0,
        spotDetails: item.spotDetails || "",
        photoUrl: safePhoto,
        lostAt: item.lostAt ? item.lostAt.toISOString() : undefined,
        createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
        linkedQuest,
      };
    });

    // Format Found Items
    const formattedFound = (foundDocs as any[]).map((item) => {
      const custodyLoc = item.currentCustodyLocationId as any;
      const safeDeskLoc = item.safeDeskLocationId as any;
      const foundLoc = item.foundLocationId as any;

      const custodyLocationName =
        custodyLoc?.name || safeDeskLoc?.name || foundLoc?.name || "Campus Safe-Desk Station";

      const safePhoto = item.photoUrl || item.blurredPhotoUrl || "";

      return {
        _id: item._id.toString(),
        title: item.title || item.shortTitle || "Campus Found Item",
        shortTitle: item.shortTitle || item.title || "Found Belonging",
        category: item.category,
        status: item.status,
        custodyStatus: item.custodyStatus,
        lockerReceiptCode: item.lockerReceiptCode || undefined,
        custodyLocationName,
        liveBadge: getFoundItemBadge(item.status, item.custodyStatus),
        spotDetails: item.spotDetails || "",
        photoUrl: safePhoto,
        foundAt: item.foundAt ? item.foundAt.toISOString() : undefined,
        createdAt: item.createdAt ? item.createdAt.toISOString() : new Date().toISOString(),
      };
    });

    // Format Claims
    const formattedClaims = (claimDocs as any[]).map((c) => {
      const itemDoc: any =
        c.itemType === "LOST"
          ? lostMap.get(c.itemId.toString())
          : foundMap.get(c.itemId.toString());

      const itemTitle = itemDoc?.title || itemDoc?.shortTitle || "Campus Belonging";
      const category = itemDoc?.category || "OTHER";
      const stationName =
        itemDoc?.currentCustodyLocationId?.name ||
        itemDoc?.safeDeskLocationId?.name ||
        itemDoc?.lastKnownLocationId?.name ||
        itemDoc?.foundLocationId?.name ||
        "Campus Safe-Desk Station";

      const safePhoto =
        itemDoc?.photoUrl || itemDoc?.blurredPhotoUrl || c.proofPhotoUrl || "";

      const counterparty = c.counterpartyUserId
        ? {
            _id: c.counterpartyUserId._id?.toString() || "",
            displayName: c.counterpartyUserId.displayName || "Desk Attendant",
            username: c.counterpartyUserId.username || "staff",
            avatarUrl: c.counterpartyUserId.avatarUrl || "/avatars/default-hunter.png",
          }
        : undefined;

      return {
        _id: c._id.toString(),
        itemTitle,
        itemType: c.itemType,
        itemId: c.itemId.toString(),
        category,
        status: c.status,
        liveBadge: getClaimBadge(c.status, c.handoverLocked),
        counterparty,
        stationName,
        rejectionReason: c.rejectionReason || undefined,
        proofPhotoUrl: safePhoto,
        notes: c.notes || "",
        createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
        item: {
          _id: c.itemId.toString(),
          title: itemTitle,
          itemType: c.itemType,
          category,
          status: itemDoc?.status || "UNKNOWN",
          custodyLocation: stationName,
          location: stationName,
        },
      };
    });

    // Extract user-specific clues and evidence from investigations
    const clues: Array<{
      clueId: string;
      questId: string;
      questCode: string;
      questTitle: string;
      stageOrder: number;
      solvedAt: string;
      liveBadge: LiveBadge;
    }> = [];

    const evidence: Array<{
      _id: string;
      questCode: string;
      questTitle: string;
      type: "PHOTO" | "MAP_PIN" | "THEORY";
      title: string;
      content: string;
      upvotesCount: number;
      createdAt: string;
      liveBadge: LiveBadge;
    }> = [];

    for (const inv of invDocs as any[]) {
      const q = inv.questId as any;
      const questIdStr = q?._id ? q._id.toString() : inv.questId?.toString() || "";
      const questCode = q?.questCode || "QUEST";
      const questTitle = q?.title || "Investigation Quest";

      // User solved clues
      if (Array.isArray(inv.solvedClues)) {
        for (const solved of inv.solvedClues) {
          if (
            solved.solvedByUserId &&
            solved.solvedByUserId.toString() === userObjId.toString()
          ) {
            clues.push({
              clueId: solved.clueId ? solved.clueId.toString() : "",
              questId: questIdStr,
              questCode,
              questTitle,
              stageOrder: solved.stageOrder || 1,
              solvedAt: solved.solvedAt
                ? new Date(solved.solvedAt).toISOString()
                : new Date().toISOString(),
              liveBadge: { label: "Verified Deduction", color: "emerald" },
            });
          }
        }
      }

      // User evidence nodes
      if (Array.isArray(inv.evidenceNodes)) {
        for (const node of inv.evidenceNodes) {
          if (
            node.authorId &&
            node.authorId.toString() === userObjId.toString()
          ) {
            evidence.push({
              _id: node._id ? node._id.toString() : "",
              questCode,
              questTitle,
              type: node.type || "THEORY",
              title: node.title || "Field Evidence Note",
              content: node.content || "",
              upvotesCount: Array.isArray(node.upvotes) ? node.upvotes.length : 0,
              createdAt: node.createdAt
                ? new Date(node.createdAt).toISOString()
                : new Date().toISOString(),
              liveBadge: { label: "Active Case Board", color: "cyan" },
            });
          }
        }
      }
    }

    // Sort clues and evidence newest first
    clues.sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime());
    evidence.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const payload = {
      counts: {
        lostTotal,
        foundTotal,
        claimsTotal,
        cluesSolvedTotal: clues.length,
        evidenceTotal: evidence.length,
        lostActive: formattedLost.filter(
          (i) => i.status === "ACTIVE" || i.status === "APPROVED"
        ).length,
        foundInCustody: formattedFound.filter(
          (i) =>
            i.custodyStatus === "SAFE_DESK" ||
            i.custodyStatus === "DEPOSITED_AT_SAFE_DESK"
        ).length,
        claimsPending: formattedClaims.filter((c) => c.status === "PENDING").length,
        claimsReady: formattedClaims.filter((c) => c.status === "APPROVED").length,
      },
      lostItems: tab === "all" || tab === "lost" ? formattedLost : [],
      foundItems: tab === "all" || tab === "found" ? formattedFound : [],
      claims: tab === "all" || tab === "claims" ? formattedClaims : [],
      clues: tab === "all" || tab === "clues" ? clues : [],
      evidence: tab === "all" || tab === "clues" ? evidence : [],
    };

    return apiSuccess(payload);
  } catch (err: any) {
    console.error("GET /api/user/operations error:", err);
    return apiServerError(err.message || "Failed to retrieve personal operations ledger.");
  }
}

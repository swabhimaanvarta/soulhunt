import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { LostItem, FoundItem, ClaimRequest } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeItemTitle } from "@/lib/item-dto";
import { sanitizePublicDescription } from "@/lib/privacy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const user = await getCurrentUser();

    // Determine caller privilege level early (before DB query) so we can
    // select sensitive fields only when the caller is entitled to them.
    // Note: isOwner requires the populated reporter/finder ID which we get
    // after the query; we do a second pass to decide final privilege.

    const isStaff = Boolean(
      user && (user.role === "ADMIN" || user.role === "MODERATOR" || user.role === "SAFE_DESK_STAFF")
    );

    // ------------------------------------------------------------------
    // 1. Load LostItem — always select sensitive fields so owners / staff
    //    receive them; we strip them for non-privileged callers below.
    // ------------------------------------------------------------------
    let item: any = await LostItem.findById(id)
      .select("+secretIdentifiers +verificationAnswerHash")
      .populate("reporterId", "displayName username avatarUrl department")
      .populate("lastKnownLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
      .populate("linkedQuestId")
      .lean();

    let itemType = "LOST";

    if (!item) {
      // FoundItem: select rawPhotoUrl for owner / staff access
      item = await FoundItem.findById(id)
        .select("+rawPhotoUrl")
        .populate("finderId", "displayName username avatarUrl department")
        .populate("foundLocationId", "name code zoneType coordinates")
        .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
        .lean();
      itemType = "FOUND";
    }

    if (!item) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    const isOwner =
      user &&
      ((itemType === "LOST" && item.reporterId?._id?.toString() === user._id.toString()) ||
        (itemType === "FOUND" && item.finderId?._id?.toString() === user._id.toString()));

    // Sanitize title for all callers (PII strip on student IDs in title)
    item.title = sanitizeItemTitle(item.title || item.shortTitle);

    // ------------------------------------------------------------------
    // 2. Redact sensitive fields for anonymous visitors and non-owner
    //    signed-in users.  Owners and staff receive the full record.
    // ------------------------------------------------------------------
    if (!isOwner && !isStaff) {
      // Strip ALL secret / verification fields
      delete item.secretIdentifiers;
      delete item.verificationAnswerHash;
      delete item.lockerReceiptCode;
      delete item.rawPhotoUrl;
      delete item.spotDetails;

      // Sanitize public description for PII (phone, roll numbers, emails)
      item.publicDescription = sanitizePublicDescription(item.publicDescription || "").sanitizedText;

      // Photo rule: only serve approved blurred derivative; never raw uploads.
      // The `photos` array on LostItem may contain unreviewed raw upload paths —
      // replace both photos[] and photoUrl with the approved blurred image or empty.
      const safePhoto = item.blurredPhotoUrl || "";
      item.photoUrl = safePhoto;
      item.photos = safePhoto ? [safePhoto] : [];

      // Mask reporter and finder identities
      delete item.reporterId;
      delete item.finderId;
      item.reportedByCommunityMember = true;

      // Strip precise coordinates from location objects
      if (item.lastKnownLocationId?.coordinates) {
        delete item.lastKnownLocationId.coordinates;
      }
      if (item.foundLocationId?.coordinates) {
        delete item.foundLocationId.coordinates;
      }

      // Strip linked quest — prevents leaking mystery clues & answers
      delete item.linkedQuestId;

      // Signal whether a verification challenge exists (without revealing it)
      item.hasVerificationQuestion = Boolean(item.verificationQuestion);
      delete item.verificationQuestion;
    }

    // ------------------------------------------------------------------
    // 3. Claims visibility: owners/staff see all; claimants see their own
    // ------------------------------------------------------------------
    const allClaims = await ClaimRequest.find({ itemId: item._id })
      .populate("claimantId", "displayName username avatarUrl")
      .sort({ createdAt: -1 })
      .lean();

    let visibleClaims: any[] = [];
    if (isOwner || isStaff) {
      visibleClaims = allClaims;
    } else if (user) {
      visibleClaims = allClaims.filter(
        (c: any) => c.claimantId?._id?.toString() === user._id.toString()
      );
    }

    // ------------------------------------------------------------------
    // 4. Safe Community Match Suggestions (Never reveals secret clues)
    // ------------------------------------------------------------------
    let possibleMatches: any[] = [];
    try {
      if (itemType === "LOST") {
        const matches = await FoundItem.find({
          category: item.category,
          status: { $in: ["ACTIVE", "CLAIMED"] },
        })
          .select("title shortTitle category publicDescription photoUrl blurredPhotoUrl foundLocationId createdAt")
          .populate("foundLocationId", "name code")
          .sort({ createdAt: -1 })
          .limit(4)
          .lean();

        possibleMatches = matches.map((m: any) => ({
          _id: m._id,
          title: sanitizeItemTitle(m.title || m.shortTitle),
          category: m.category,
          locationName: m.foundLocationId?.name || "AIEM Campus",
          photoUrl: m.blurredPhotoUrl || m.photoUrl || "",
          createdAt: m.createdAt,
          itemType: "FOUND",
        }));
      } else {
        const matches = await LostItem.find({
          category: item.category,
          status: { $in: ["ACTIVE", "CLAIMED"] },
        })
          .select("title shortTitle category publicDescription photoUrl blurredPhotoUrl lastKnownLocationId createdAt")
          .populate("lastKnownLocationId", "name code")
          .sort({ createdAt: -1 })
          .limit(4)
          .lean();

        possibleMatches = matches.map((m: any) => ({
          _id: m._id,
          title: sanitizeItemTitle(m.title || m.shortTitle),
          category: m.category,
          locationName: m.lastKnownLocationId?.name || "AIEM Campus",
          photoUrl: m.blurredPhotoUrl || m.photoUrl || "",
          createdAt: m.createdAt,
          itemType: "LOST",
        }));
      }
    } catch {
      possibleMatches = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        itemType,
        claims: visibleClaims,
        possibleMatches,
        isOwner: Boolean(isOwner),
        isStaff: Boolean(isStaff),
        isAuthenticated: Boolean(user),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "ITEM_FETCH_FAILED", message: "Failed to retrieve item details." },
      },
      { status: 500 }
    );
  }
}

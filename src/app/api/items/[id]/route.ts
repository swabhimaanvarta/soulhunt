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

    // Check LostItem first
    let item: any = await LostItem.findById(id)
      .populate("reporterId", "displayName username avatarUrl department")
      .populate("lastKnownLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
      .populate("linkedQuestId")
      .lean();

    let itemType = "LOST";

    if (!item) {
      item = await FoundItem.findById(id)
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

    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    // Sanitize title for public viewing
    item.title = sanitizeItemTitle(item.title || item.shortTitle);

    // Mask secret identifiers, locker receipt codes, and raw photos if not owner and not staff
    if (!isOwner && !isStaff) {
      delete item.secretIdentifiers;
      delete item.verificationAnswerHash;
      delete item.lockerReceiptCode;
      delete item.rawPhotoUrl;
      delete item.spotDetails;

      // Sanitize description for PII (phone, roll numbers, emails)
      item.publicDescription = sanitizePublicDescription(item.publicDescription || "").sanitizedText;

      // Zero-fallback photo rule: only blurred photo or empty string
      const safePhoto = item.blurredPhotoUrl || "";
      item.photoUrl = safePhoto;
      item.photos = safePhoto ? [safePhoto] : [];

      // Mask reporter and finder identities from public/unauthorized view
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

      // Strip linked quest for non-owners and non-staff to prevent leaking mystery clues & answers
      delete item.linkedQuestId;

      // Non-owners (both anonymous and signed-in) must NEVER receive the secret verification challenge question
      item.hasVerificationQuestion = Boolean(item.verificationQuestion);
      delete item.verificationQuestion;
    }

    // Get claims: owner and staff see all; claimants see their own claim
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

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        itemType,
        claims: visibleClaims,
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


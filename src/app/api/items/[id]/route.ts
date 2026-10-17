import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { LostItem, FoundItem, ClaimRequest } from "@/models";
import { getCurrentUser } from "@/lib/auth";

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

    const isStaff = user && (user.role === "ADMIN" || user.role === "MODERATOR");

    // Mask secret identifiers if not owner and not staff
    if (!isOwner && !isStaff) {
      delete item.secretIdentifiers;
      delete item.verificationAnswerHash;
    }

    // Get any active claims
    const claims = await ClaimRequest.find({ itemId: item._id })
      .populate("claimantId", "displayName username avatarUrl")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        ...item,
        itemType,
        claims: isOwner || isStaff ? claims : [],
        isOwner,
        isStaff,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


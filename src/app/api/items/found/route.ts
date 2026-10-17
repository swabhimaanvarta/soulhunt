import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FoundItem, User } from "@/models";
import { sanitizeSensitiveText, requiresAutomaticPhotoBlur } from "@/lib/privacy";
import { grantUserRewards } from "@/lib/economy";

const FoundItemSchema = z.object({
  title: z.string().min(3).max(120),
  category: z.enum([
    "ELECTRONICS",
    "ID_CARDS_DOCS",
    "BOOKS_NOTES",
    "ACCESSORIES",
    "BAGS_WALLETS",
    "KEYS",
    "LAB_GEAR",
    "OTHER",
  ]),
  publicDescription: z.string().min(10).max(1000),
  foundLocationId: z.string(),
  spotDetails: z.string().max(200).optional(),
  foundAt: z.string().optional(),
  custodyStatus: z.enum(["SAFE_DESK", "FINDER_HELD", "ADMIN_OFFICE"]).default("SAFE_DESK"),
  currentCustodyLocationId: z.string().optional(),
  photoUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to report a found item." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = FoundItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();
    const {
      title,
      category,
      publicDescription,
      foundLocationId,
      spotDetails,
      foundAt,
      custodyStatus,
      currentCustodyLocationId,
      photoUrl,
    } = parsed.data;

    const { sanitizedText } = sanitizeSensitiveText(publicDescription);
    const photoRequiresBlur = requiresAutomaticPhotoBlur(category);

    const foundItem = await FoundItem.create({
      finderId: user._id,
      title,
      category,
      publicDescription: sanitizedText,
      foundLocationId: new Types.ObjectId(foundLocationId),
      spotDetails: spotDetails || "",
      foundAt: foundAt ? new Date(foundAt) : new Date(),
      custodyStatus,
      currentCustodyLocationId: currentCustodyLocationId
        ? new Types.ObjectId(currentCustodyLocationId)
        : new Types.ObjectId(foundLocationId),
      photoUrl: photoUrl || "/placeholder-item.png",
      photoRequiresBlur,
      status: "ACTIVE",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: user._id,
          note: `Item turned in / reported by finder (${custodyStatus})`,
          timestamp: new Date(),
        },
      ],
    });

    // Reward finder for ethical reporting
    const isSafeDesk = custodyStatus === "SAFE_DESK";
    await grantUserRewards({
      userId: user._id as Types.ObjectId,
      baseXp: isSafeDesk ? 80 : 40,
      baseCoins: isSafeDesk ? 20 : 10,
      deltaTrust: isSafeDesk ? 20 : 10,
      reason: `Ethical Found-Item Report (${title}) ${isSafeDesk ? "at Campus Safe-Desk" : ""}`,
      referenceType: "RECOVERY",
      referenceId: foundItem._id as Types.ObjectId,
    });

    if (isSafeDesk) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { "stats.safeDeskDepositsCount": 1 },
      });
    }

    return NextResponse.json({ success: true, data: foundItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


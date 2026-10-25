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
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join(".") || "Input";
      const message = `${field}: ${firstIssue?.message || "Invalid value"}`;
      return NextResponse.json(
        { success: false, error: message, details: parsed.error.flatten() },
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

    // Sanitize PII & isolate identifiers
    let cleanDesc = publicDescription;
    const sensitiveMatch = publicDescription.match(/(?:barcode|serial\s*(?:no|number|#)?|matriculation\s*id)\s*[:#-]?\s*([A-Za-z0-9_-]+)/i);
    if (sensitiveMatch) {
      cleanDesc = cleanDesc.replace(sensitiveMatch[0], "[unique identifier withheld for privacy]");
    }

    const { sanitizedText } = sanitizeSensitiveText(cleanDesc);
    const photoRequiresBlur = requiresAutomaticPhotoBlur(category);

    // Non-blocking duplicate detection within 48 hours
    let duplicateCandidate: any = null;
    try {
      const recentSimilar = await FoundItem.findOne({
        category,
        foundLocationId: new Types.ObjectId(foundLocationId),
        status: { $in: ["SUBMITTED", "APPROVED", "ACTIVE"] },
        createdAt: { $gte: new Date(Date.now() - 48 * 3600 * 1000) },
        finderId: { $ne: user._id },
      }).lean();

      if (recentSimilar) {
        duplicateCandidate = {
          id: recentSimilar._id,
          title: recentSimilar.title,
          note: "A similar found item was reported recently at this location.",
        };
      }
    } catch {
      // Non-blocking
    }

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

    // Economy integrity: Rewards are NOT awarded on self-report to prevent farming.
    // Full recovery XP, coins, and trust are granted when Safe-Desk staff confirms physical intake or verified handover.

    return NextResponse.json({
      success: true,
      data: {
        ...foundItem.toObject(),
        duplicateCandidate,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "FOUND_REPORT_FAILED", message: "Failed to submit found item report." } },
      { status: 500 }
    );
  }
}


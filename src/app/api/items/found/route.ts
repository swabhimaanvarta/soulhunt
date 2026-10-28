import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FoundItem, CampusLocation, User } from "@/models";
import { sanitizeSensitiveText, requiresAutomaticPhotoBlur } from "@/lib/privacy";

const FoundItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Item title must be at least 3 characters")
    .max(120, "Item title cannot exceed 120 characters"),
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
  publicDescription: z
    .string()
    .trim()
    .min(10, "Public description must be at least 10 characters")
    .max(1000, "Description cannot exceed 1000 characters"),
  secretIdentifiers: z.string().trim().max(500).optional().default(""),
  foundLocationId: z.string().trim().min(1, "Please select the campus location where the item was found"),
  spotDetails: z.string().trim().max(200).optional().default(""),
  foundAt: z.string().optional(),
  approximateTimeRange: z.string().trim().max(50).optional().default(""),
  custodyStatus: z
    .enum(["SAFE_DESK", "FINDER_HELD", "ADMIN_OFFICE", "DEPOSITED_AT_SAFE_DESK", "HELD_BY_FINDER", "HANDED_TO_MODERATOR"])
    .default("SAFE_DESK"),
  currentCustodyLocationId: z.string().trim().optional(),
  photoUrl: z.string().trim().optional().default(""),
  rawPhotoUrl: z.string().trim().optional().default(""),
  blurredPhotoUrl: z.string().trim().optional().default(""),
  clientRequestId: z.string().trim().max(128).optional(),
  idempotencyKey: z.string().trim().max(128).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to report a found item." } },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNVERIFIED_ACCOUNT",
            message: "Please verify your institutional email before turning in items.",
          },
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = FoundItemSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join(".") || "Input";
      const message = `${field}: ${firstIssue?.message || "Invalid value"}`;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message,
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    await connectDB();

    const {
      title,
      category,
      publicDescription,
      secretIdentifiers,
      foundLocationId,
      spotDetails,
      foundAt,
      approximateTimeRange,
      custodyStatus,
      currentCustodyLocationId,
      photoUrl,
      rawPhotoUrl,
      blurredPhotoUrl,
      clientRequestId,
      idempotencyKey,
    } = parsed.data;

    const effectiveIdempotencyKey = idempotencyKey || clientRequestId;

    // 1. Server-Side Idempotency Replay Check (within 24 hours)
    if (effectiveIdempotencyKey) {
      const existingItem = await FoundItem.findOne({
        finderId: user._id,
        idempotencyKey: effectiveIdempotencyKey,
        createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
      }).lean();

      if (existingItem) {
        return NextResponse.json(
          {
            success: true,
            replayed: true,
            message: "Found report already registered.",
            data: existingItem,
          },
          { status: 200 }
        );
      }
    }

    // 2. Validate Found Campus Location
    if (!Types.ObjectId.isValid(foundLocationId)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_LOCATION", message: "Invalid campus location identifier." },
        },
        { status: 400 }
      );
    }

    const foundLocDoc = await CampusLocation.findOne({
      _id: new Types.ObjectId(foundLocationId),
      isActive: true,
    }).lean();

    if (!foundLocDoc) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "LOCATION_NOT_FOUND", message: "Selected location was not found or is inactive." },
        },
        { status: 400 }
      );
    }

    // 3. Custody & Station Pairing Validation
    let normalizedCustody = custodyStatus;
    if (normalizedCustody === "SAFE_DESK") normalizedCustody = "DEPOSITED_AT_SAFE_DESK";
    if (normalizedCustody === "FINDER_HELD") normalizedCustody = "HELD_BY_FINDER";
    if (normalizedCustody === "ADMIN_OFFICE") normalizedCustody = "HANDED_TO_MODERATOR";

    let targetSafeDeskId: Types.ObjectId | null = null;
    let targetCustodyLocId: Types.ObjectId = new Types.ObjectId(foundLocationId);

    if (normalizedCustody === "DEPOSITED_AT_SAFE_DESK") {
      const custodyStationId = currentCustodyLocationId || foundLocationId;
      if (!Types.ObjectId.isValid(custodyStationId)) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_SAFE_DESK", message: "Please select a valid Safe-Desk station for deposit." },
          },
          { status: 400 }
        );
      }

      const safeDeskDoc = await CampusLocation.findOne({
        _id: new Types.ObjectId(custodyStationId),
        isSafeDesk: true,
        isActive: true,
      }).lean();

      if (!safeDeskDoc) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_SAFE_DESK",
              message: "Selected custody station is not an active campus Safe-Desk. Please select an authorized station.",
            },
          },
          { status: 400 }
        );
      }

      targetSafeDeskId = safeDeskDoc._id as Types.ObjectId;
      targetCustodyLocId = safeDeskDoc._id as Types.ObjectId;
    } else if (normalizedCustody === "HANDED_TO_MODERATOR") {
      if (currentCustodyLocationId && Types.ObjectId.isValid(currentCustodyLocationId)) {
        const officeDoc = await CampusLocation.findOne({
          _id: new Types.ObjectId(currentCustodyLocationId),
          isActive: true,
        }).lean();
        if (officeDoc) {
          targetCustodyLocId = officeDoc._id as Types.ObjectId;
        }
      }
    }

    // 4. Sanitize PII & Segregate Unique Identifiers
    let cleanDesc = publicDescription;
    let combinedSecret = secretIdentifiers || "";

    const sensitiveMatch = publicDescription.match(
      /(?:barcode|serial\s*(?:no|number|#)?|matriculation\s*id|roll\s*no)\s*[:#-]?\s*([A-Za-z0-9_-]+)/i
    );
    if (sensitiveMatch) {
      combinedSecret = combinedSecret
        ? `${combinedSecret} | Identifying Detail: ${sensitiveMatch[0]}`
        : `Identifying Detail: ${sensitiveMatch[0]}`;
      cleanDesc = cleanDesc.replace(sensitiveMatch[0], "[unique identifier withheld for privacy]");
    }

    const { sanitizedText } = sanitizeSensitiveText(cleanDesc);
    const photoRequiresBlur = requiresAutomaticPhotoBlur(category);

    // 5. Non-blocking duplicate detection within 48 hours
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
          title: recentSimilar.title || recentSimilar.shortTitle,
          note: "A similar found item was turned in recently in this campus sector.",
        };
      }
    } catch {
      // Non-blocking
    }

    const effectiveRawPhoto = rawPhotoUrl || photoUrl || "";
    const effectiveBlurredPhoto = blurredPhotoUrl || photoUrl || "";

    // 6. Describe State Note Accurately
    let auditNote = `Item reported found by ${user.displayName}`;
    if (normalizedCustody === "DEPOSITED_AT_SAFE_DESK") {
      auditNote = "Reported as deposited at Safe-Desk; awaiting staff physical intake confirmation";
    } else if (normalizedCustody === "HELD_BY_FINDER") {
      auditNote = "Reported found; item held in personal custody by finder awaiting verified owner claim";
    } else if (normalizedCustody === "HANDED_TO_MODERATOR") {
      auditNote = "Reported found; handed to department office awaiting staff confirmation";
    }

    // 7. Create FoundItem Document
    const foundItem = await FoundItem.create({
      finderId: user._id,
      title,
      shortTitle: title.slice(0, 50),
      category,
      publicDescription: sanitizedText,
      secretIdentifiers: combinedSecret,
      foundLocationId: new Types.ObjectId(foundLocationId),
      spotDetails: spotDetails || "",
      foundAt: foundAt ? new Date(foundAt) : new Date(),
      approximateTimeRange: approximateTimeRange || "",
      custodyStatus: normalizedCustody,
      currentCustodyLocationId: targetCustodyLocId,
      safeDeskLocationId: targetSafeDeskId,
      photoUrl: photoUrl || effectiveBlurredPhoto || "/placeholder-item.png",
      rawPhotoUrl: effectiveRawPhoto,
      blurredPhotoUrl: effectiveBlurredPhoto,
      photoRequiresBlur,
      idempotencyKey: effectiveIdempotencyKey || undefined,
      status: "ACTIVE",
      stateHistory: [
        {
          state: "ACTIVE",
          actorId: user._id,
          note: auditNote,
          timestamp: new Date(),
        },
      ],
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: foundItem._id,
          title: foundItem.title,
          category: foundItem.category,
          publicDescription: foundItem.publicDescription,
          foundLocationId: foundItem.foundLocationId,
          foundAt: foundItem.foundAt,
          approximateTimeRange: foundItem.approximateTimeRange,
          custodyStatus: foundItem.custodyStatus,
          currentCustodyLocationId: foundItem.currentCustodyLocationId,
          safeDeskLocationId: foundItem.safeDeskLocationId,
          photoUrl: foundItem.photoUrl,
          status: foundItem.status,
          duplicateCandidate,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[POST /api/items/found] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "FOUND_REPORT_FAILED", message: error.message || "Failed to submit found item report." },
      },
      { status: 500 }
    );
  }
}

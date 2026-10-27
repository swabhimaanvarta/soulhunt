import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EvidenceRecord, ClaimRequest, LostItem, FoundItem, Investigation } from "@/models";

const SAFE_FILENAME_REGEX = /^ev_[a-zA-Z0-9_-]+\.webp$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Strict regex validation preventing path traversal and non-WebP files
    if (!filename || !SAFE_FILENAME_REGEX.test(filename)) {
      return NextResponse.json(
        { success: false, error: "Invalid filename request." },
        { status: 400 }
      );
    }

    await connectDB();

    const safeEscapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // 1. Check if this file is published as a public listing photo on a Lost or Found item
    const [publicLost, publicFound] = await Promise.all([
      LostItem.exists({
        $or: [
          { photoUrl: { $regex: safeEscapedFilename } },
          { blurredPhotoUrl: { $regex: safeEscapedFilename } },
          { rawPhotoUrl: { $regex: safeEscapedFilename } },
          { photos: { $regex: safeEscapedFilename } },
        ],
      }),
      FoundItem.exists({
        $or: [
          { photoUrl: { $regex: safeEscapedFilename } },
          { blurredPhotoUrl: { $regex: safeEscapedFilename } },
          { rawPhotoUrl: { $regex: safeEscapedFilename } },
        ],
      }),
    ]);

    let isAuthorized = Boolean(publicLost || publicFound);

    // 2. If not a public listing photo, enforce strict authentication and ownership checks (e.g. private claim proofs)
    if (!isAuthorized) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Authentication required to view evidence." },
          { status: 401 }
        );
      }

      const userIdStr = user._id.toString();
      const isStaff = user.role === "ADMIN" || user.role === "MODERATOR" || user.role === "SAFE_DESK_STAFF";

      if (isStaff) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        // Check if user is the direct uploader
        const uploadRecord = await EvidenceRecord.findOne({ filename });
        if (uploadRecord && uploadRecord.uploadedBy.toString() === userIdStr) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        // Check if user is a participant in a Claim containing this photo
        const claim = await ClaimRequest.findOne({
          proofPhotoUrl: { $regex: filename },
          $or: [{ claimantId: user._id }, { counterpartyUserId: user._id }],
        });
        if (claim) isAuthorized = true;
      }

      if (!isAuthorized) {
        // Check if user reported the lost item or found item
        const [lost, found] = await Promise.all([
          LostItem.findOne({ photos: { $regex: filename }, reporterId: user._id }),
          FoundItem.findOne({
            $or: [{ rawPhotoUrl: { $regex: filename } }, { photoUrl: { $regex: filename } }],
            finderId: user._id,
          }),
        ]);
        if (lost || found) isAuthorized = true;
      }

      if (!isAuthorized) {
        // Check if user is participant in linked investigation
        const inv = await Investigation.findOne({
          "evidenceNodes.mediaUrl": { $regex: filename },
          participatingUserIds: user._id,
        });
        if (inv) isAuthorized = true;
      }

      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "Access denied. You are not authorized to view this evidence photo." },
          { status: 403 }
        );
      }
    }

    const storageDir = path.join(process.cwd(), "storage", "evidence");
    const filePath = path.join(storageDir, filename);

    // Guard against directory traversal outside storage/evidence
    const normalizedTarget = path.normalize(filePath);
    const normalizedBase = path.normalize(storageDir);
    if (!normalizedTarget.startsWith(normalizedBase)) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: "Evidence file not found." },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.promises.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Content-Disposition": 'inline; filename="evidence.webp"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load evidence file." },
      { status: 500 }
    );
  }
}

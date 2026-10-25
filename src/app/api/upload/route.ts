import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { connectDB } from "@/lib/db";
import { EvidenceRecord } from "@/models";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  if (isPng) return true;

  // WebP: RIFF .... WEBP
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (isWebp) return true;

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Please sign in to upload photos." },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        { success: false, error: "Please verify your institutional email before uploading evidence." },
        { status: 403 }
      );
    }

    // Rate limit: 20 uploads per 15 minutes per user
    const rateLimit = await checkRateLimit(`upload_${user._id}`, 20, 900);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Upload quota exceeded. Please wait a few minutes before uploading more photos." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided." },
        { status: 400 }
      );
    }

    // Limit raw upload to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Image size must be less than 10MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const rawBuffer = Buffer.from(bytes);

    // Validate magic bytes directly against binary header
    if (!isValidImageMagicBytes(rawBuffer)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file contents. Only authentic JPEG, PNG, or WebP images are permitted.",
        },
        { status: 400 }
      );
    }

    // Transcode through Sharp: Strips EXIF/geolocation tags, normalizes rotation, encodes to WebP
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(rawBuffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to process image. The file may be corrupted." },
        { status: 400 }
      );
    }

    // Store in secure private directory outside public/
    const storageDir = path.join(process.cwd(), "storage", "evidence");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filename = `ev_${crypto.randomUUID()}.webp`;
    const targetPath = path.join(storageDir, filename);

    await fs.promises.writeFile(targetPath, processedBuffer);

    // Record evidence upload ownership
    await connectDB();
    await EvidenceRecord.create({ filename, uploadedBy: user._id });

    // Controlled streaming endpoint URL
    const fileUrl = `/api/evidence/${filename}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      size: processedBuffer.length,
      format: "webp",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload image." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Investigation } from "@/models";

const EvidenceSchema = z.object({
  type: z.enum(["THEORY", "NOTE", "PHOTO", "MAP_PIN"]),
  title: z.string().min(2).max(100),
  content: z.string().min(3).max(1000),
  linkedStageOrder: z.number().int().optional(),
  photoUrl: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to add evidence." }, { status: 401 });
    }

    const body = await req.json();

    await connectDB();
    const investigation = await Investigation.findById(id);
    if (!investigation) {
      return NextResponse.json({ success: false, error: "Investigation not found" }, { status: 404 });
    }

    // Check if it's an upvote action
    if (body.action === "UPVOTE" && body.evidenceId) {
      const node = (investigation.evidenceNodes as any).id(body.evidenceId);
      if (!node) {
        return NextResponse.json({ success: false, error: "Evidence node not found" }, { status: 404 });
      }

      const upvotes = node.upvotes || [];
      const userIdx = upvotes.findIndex((uid: any) => uid.toString() === user._id.toString());
      if (userIdx >= 0) {
        upvotes.splice(userIdx, 1);
      } else {
        upvotes.push(user._id);
      }
      node.upvotes = upvotes;
      await investigation.save();

      return NextResponse.json({ success: true, data: investigation.evidenceNodes });
    }

    // New evidence creation
    const parsed = EvidenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
    }

    const { type, title, content, linkedStageOrder, photoUrl } = parsed.data;

    investigation.evidenceNodes.push({
      authorId: user._id,
      authorName: user.displayName,
      type,
      title,
      content,
      linkedStageOrder,
      photoUrl,
      upvotes: [user._id],
      createdAt: new Date(),
    } as any);

    // Add user to participating list if not already there
    if (!investigation.participatingUserIds.some((uid) => uid.toString() === user._id.toString())) {
      investigation.participatingUserIds.push(user._id);
    }

    await investigation.save();

    return NextResponse.json({
      success: true,
      data: investigation.evidenceNodes,
      message: "Evidence added to investigation corkboard.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


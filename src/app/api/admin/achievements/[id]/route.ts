import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Achievement, UserAchievement } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

const UpdateAchievementSchema = z.object({
  action: z.enum(["UPDATE", "ARCHIVE", "REACTIVATE"]).default("UPDATE"),
  title: z.string().min(3).max(100).optional(),
  description: z.string().min(5).max(500).optional(),
  badgeIcon: z.string().optional(),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
  threshold: z.number().int().positive().optional(),
  xpReward: z.number().int().min(0).max(100000).optional(),
  coinReward: z.number().int().min(0).max(10000).optional(),
  scope: z.enum(["PLAYER", "SQUAD"]).optional(),
  revisionNote: z.string().min(3).max(500).optional(),
  requestId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json(
        { success: false, error: "Content management permissions required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();

    const achievement = await Achievement.findById(id).lean();
    if (!achievement) {
      return NextResponse.json({ success: false, error: "Achievement not found." }, { status: 404 });
    }

    const unlockCount = await UserAchievement.countDocuments({
      achievementId: achievement._id,
      isUnlocked: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...achievement,
        unlockCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json(
        { success: false, error: "Content management permissions required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();

    const achievement = await Achievement.findById(id);
    if (!achievement) {
      return NextResponse.json({ success: false, error: "Achievement not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateAchievementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { action, revisionNote, requestId, ...updates } = parsed.data;
    const beforeState = achievement.toObject();

    if (action === "ARCHIVE") {
      achievement.isArchived = true;
      achievement.isActive = false;
      achievement.version = (achievement.version || 1) + 1;
      await achievement.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName || user.username || "Admin",
        actorRole: user.role,
        action: "ACHIEVEMENT_ARCHIVE",
        targetType: "ACHIEVEMENT",
        targetId: achievement._id,
        targetLabel: achievement.code,
        reason: revisionNote || `Archived achievement ${achievement.code}`,
        beforeState,
        afterState: achievement.toObject(),
      });

      return NextResponse.json({
        success: true,
        message: `Achievement ${achievement.code} archived successfully.`,
        data: achievement,
      });
    }

    if (action === "REACTIVATE") {
      achievement.isArchived = false;
      achievement.isActive = true;
      achievement.version = (achievement.version || 1) + 1;
      await achievement.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName || user.username || "Admin",
        actorRole: user.role,
        action: "ACHIEVEMENT_REACTIVATE",
        targetType: "ACHIEVEMENT",
        targetId: achievement._id,
        targetLabel: achievement.code,
        reason: revisionNote || `Reactivated achievement ${achievement.code}`,
        beforeState,
        afterState: achievement.toObject(),
      });

      return NextResponse.json({
        success: true,
        message: `Achievement ${achievement.code} reactivated successfully.`,
        data: achievement,
      });
    }

    // Default: UPDATE fields
    if (updates.title) achievement.title = updates.title;
    if (updates.description) achievement.description = updates.description;
    if (updates.badgeIcon) achievement.badgeIcon = updates.badgeIcon;
    if (updates.rarity) achievement.rarity = updates.rarity;
    if (updates.threshold !== undefined) achievement.threshold = updates.threshold;
    if (updates.xpReward !== undefined) achievement.xpReward = updates.xpReward;
    if (updates.coinReward !== undefined) achievement.coinReward = updates.coinReward;
    if (updates.scope) achievement.scope = updates.scope;

    achievement.version = (achievement.version || 1) + 1;
    await achievement.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName || user.username || "Admin",
      actorRole: user.role,
      action: "ACHIEVEMENT_UPDATE",
      targetType: "ACHIEVEMENT",
      targetId: achievement._id,
      targetLabel: achievement.code,
      reason: revisionNote || `Updated achievement ${achievement.code} (v${achievement.version})`,
      beforeState,
      afterState: achievement.toObject(),
    });

    return NextResponse.json({
      success: true,
      message: `Achievement ${achievement.code} updated successfully.`,
      data: achievement,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json(
        { success: false, error: "Content management permissions required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();

    const achievement = await Achievement.findById(id);
    if (!achievement) {
      return NextResponse.json({ success: false, error: "Achievement not found." }, { status: 404 });
    }

    // Reference check: if unlocked by any user, cannot hard delete -> soft archive instead
    const unlockedCount = await UserAchievement.countDocuments({
      achievementId: achievement._id,
    });

    if (unlockedCount > 0) {
      achievement.isArchived = true;
      achievement.isActive = false;
      await achievement.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName || user.username || "Admin",
        actorRole: user.role,
        action: "ACHIEVEMENT_ARCHIVE",
        targetType: "ACHIEVEMENT",
        targetId: achievement._id,
        targetLabel: achievement.code,
        reason: `Auto-archived referenced achievement (${unlockedCount} players have progress/unlocks)`,
        afterState: achievement.toObject(),
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Achievement has ${unlockedCount} player progress record(s). It was safely archived instead of deleted.`,
        data: achievement,
      });
    }

    // If completely unreferenced, allow clean deletion
    await Achievement.findByIdAndDelete(id);

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName || user.username || "Admin",
      actorRole: user.role,
      action: "ACHIEVEMENT_DELETE",
      targetType: "ACHIEVEMENT",
      targetId: achievement._id,
      targetLabel: achievement.code,
      reason: `Permanently deleted unused draft achievement ${achievement.code}`,
      beforeState: achievement.toObject(),
    });

    return NextResponse.json({
      success: true,
      message: `Achievement ${achievement.code} permanently deleted.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

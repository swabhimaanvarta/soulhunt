import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { User, Transaction } from "@/models";
import { canManageEconomy } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageEconomy(user)) {
      return NextResponse.json({ success: false, error: "Administrator privileges required." }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();
    const { targetUserId, deltaCoins = 0, deltaXp = 0, reason } = body;

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: "Target user ID is required." }, { status: 400 });
    }

    if (deltaCoins === 0 && deltaXp === 0) {
      return NextResponse.json({ success: false, error: "Delta coins or delta XP must be non-zero." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "A valid audit reason is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: "Target user not found." }, { status: 404 });
    }

    const beforeState = {
      coins: targetUser.coins,
      xp: targetUser.xp,
    };

    // Prevent negative balance
    const newCoins = Math.max(0, targetUser.coins + Number(deltaCoins));
    const newXp = Math.max(0, targetUser.xp + Number(deltaXp));

    targetUser.coins = newCoins;
    targetUser.xp = newXp;
    await targetUser.save();

    // Create reconciled transaction ledger record
    const idempotencyKey = `ADJUST_${targetUser._id}_${Date.now()}`;
    await Transaction.create({
      userId: targetUser._id,
      deltaCoins: Number(deltaCoins),
      deltaXp: Number(deltaXp),
      reason: `Manual Admin Adjustment by ${user.displayName}: ${reason}`,
      referenceType: "ADMIN_ADJUST",
      approvedBy: user._id,
      idempotencyKey,
    });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "ECONOMY_ADJUST",
      targetType: "USER",
      targetId: targetUser._id,
      targetLabel: `${targetUser.displayName} (${targetUser.email})`,
      reason,
      beforeState,
      afterState: { coins: newCoins, xp: newXp, deltaCoins, deltaXp },
    });

    return NextResponse.json({
      success: true,
      message: `Adjusted balances for ${targetUser.displayName}: Coins ${deltaCoins >= 0 ? "+" : ""}${deltaCoins}, XP ${deltaXp >= 0 ? "+" : ""}${deltaXp}.`,
      data: {
        userId: targetUser._id,
        coins: targetUser.coins,
        xp: targetUser.xp,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


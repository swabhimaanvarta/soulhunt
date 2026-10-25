import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Reward, User, Transaction } from "@/models";
import { getCurrentUser } from "@/lib/auth";

const PurchaseRequestSchema = z.object({
  rewardId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid reward ID format"),
  clientRequestId: z
    .string()
    .min(6)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "clientRequestId must be alphanumeric")
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to purchase rewards." } },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNVERIFIED", message: "Please verify your college email address before using campus currency." },
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = PurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid purchase payload." },
        },
        { status: 400 }
      );
    }

    const { rewardId, clientRequestId } = parsed.data;

    await connectDB();

    // Deterministic scoped idempotency key: strictly bound to (userId, rewardId, clientRequestId)
    const stableIdempotencyKey = clientRequestId
      ? `PURCHASE_${user._id}_${rewardId}_${clientRequestId}`
      : `PURCHASE_${user._id}_${rewardId}_${Date.now()}`;

    // 1. Idempotency check: if transaction with this key exists for this user, return previous success
    const existingTx = await Transaction.findOne({
      idempotencyKey: stableIdempotencyKey,
      userId: user._id,
    });

    if (existingTx) {
      const freshUser = await User.findById(user._id);
      return NextResponse.json({
        success: true,
        message: "Purchase already processed.",
        data: {
          coins: freshUser?.coins ?? user.coins,
          equippedTitle: freshUser?.equippedTitle,
          equippedFrame: freshUser?.equippedFrame,
          alreadyPurchased: true,
        },
      });
    }

    const reward = await Reward.findById(rewardId);
    if (!reward || !reward.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Reward item not found or currently unavailable." } },
        { status: 404 }
      );
    }

    if (["CANTEEN_COUPON", "CAMPUS_PERK"].includes(reward.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ITEM_DEPRECATED",
            message: "Physical campus reward vouchers have been retired in favor of virtual customizations.",
          },
        },
        { status: 400 }
      );
    }

    const rewardTitle = reward.title || reward.name || "Item";

    if (user.level < reward.minLevelRequired) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "LEVEL_TOO_LOW",
            message: `Requires Hunter Level ${reward.minLevelRequired}. You are Level ${user.level}.`,
          },
        },
        { status: 403 }
      );
    }

    const isCosmetic = ["FRAME", "TITLE", "THEME", "BADGE"].includes(reward.type);
    const hasFiniteStock = typeof reward.stock === "number" && reward.stock >= 0;

    // Check if user already owns cosmetic
    if (isCosmetic && user.ownedCosmetics?.some((id: any) => id.toString() === rewardId)) {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_OWNED", message: "You already own this cosmetic item." } },
        { status: 400 }
      );
    }

    // 2. Finite Stock Reservation (decrement stock first to prevent overselling)
    let stockReserved = false;
    if (hasFiniteStock) {
      const stockDec = await Reward.findOneAndUpdate(
        { _id: rewardId, stock: { $gt: 0 }, isActive: true },
        { $inc: { stock: -1 } },
        { new: true }
      );

      if (!stockDec) {
        return NextResponse.json(
          { success: false, error: { code: "OUT_OF_STOCK", message: "This item is sold out." } },
          { status: 400 }
        );
      }
      stockReserved = true;
    }

    // 3. Atomic user balance debit with cosmetic ownership guard
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        coins: { $gte: reward.coinCost },
        level: { $gte: reward.minLevelRequired },
        ...(isCosmetic ? { ownedCosmetics: { $ne: reward._id } } : {}),
      },
      {
        $inc: { coins: -reward.coinCost },
        $addToSet: { ownedCosmetics: reward._id },
      },
      { new: true }
    );

    if (!updatedUser) {
      // Rollback stock reservation immediately
      if (stockReserved) {
        await Reward.findByIdAndUpdate(rewardId, { $inc: { stock: 1 } });
      }

      const freshUser = await User.findById(user._id);
      if (freshUser && freshUser.coins < reward.coinCost) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INSUFFICIENT_FUNDS",
              message: `Insufficient Hunter Coins. Needed: ${reward.coinCost}, Available: ${freshUser.coins}.`,
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { code: "PURCHASE_FAILED", message: "Transaction could not be completed. Check balance and try again." },
        },
        { status: 400 }
      );
    }

    // 4. Auto-equip cosmetic if applicable
    let equippedTitle = updatedUser.equippedTitle;
    let equippedFrame = updatedUser.equippedFrame;

    if (reward.type === "TITLE") {
      equippedTitle = reward.metadata?.value || rewardTitle;
      await User.findByIdAndUpdate(user._id, { equippedTitle });
    } else if (reward.type === "FRAME") {
      equippedFrame = reward.metadata?.value || reward.previewAsset || "";
      await User.findByIdAndUpdate(user._id, { equippedFrame });
    } else if (reward.type === "THEME") {
      const equippedTheme = reward.metadata?.value || "theme-obsidian-grid";
      await User.findByIdAndUpdate(user._id, { equippedTheme });
    }

    // 5. Create immutable Transaction record with unique idempotencyKey
    try {
      await Transaction.create({
        userId: user._id,
        deltaCoins: -reward.coinCost,
        deltaXp: 0,
        deltaTrust: 0,
        reason: `Purchased Shop Item: ${rewardTitle}`,
        referenceType: "SHOP_PURCHASE",
        referenceId: reward._id as Types.ObjectId,
        idempotencyKey: stableIdempotencyKey,
      });
    } catch (txErr: any) {
      if (txErr.code === 11000) {
        // Concurrent race condition: another request with this idempotencyKey succeeded first.
        // Refund the duplicate coin debit and restore stock from this concurrent attempt!
        await User.findByIdAndUpdate(user._id, {
          $inc: { coins: reward.coinCost },
        });
        if (stockReserved) {
          await Reward.findByIdAndUpdate(rewardId, { $inc: { stock: 1 } });
        }
        const freshUser = await User.findById(user._id).select("coins equippedTitle equippedFrame").lean();
        return NextResponse.json({
          success: true,
          message: `Already purchased ${rewardTitle}.`,
          data: {
            coins: (freshUser as any)?.coins ?? updatedUser.coins,
            equippedTitle: (freshUser as any)?.equippedTitle ?? equippedTitle,
            equippedFrame: (freshUser as any)?.equippedFrame ?? equippedFrame,
          },
        });
      }

      // If error is NOT a duplicate key, durable ledger failed -> execute compensating rollback
      console.error("[CRITICAL] Ledger creation failed for purchase:", txErr);
      await User.findByIdAndUpdate(user._id, {
        $inc: { coins: reward.coinCost },
        $pull: { ownedCosmetics: reward._id },
      });
      if (stockReserved) {
        await Reward.findByIdAndUpdate(rewardId, { $inc: { stock: 1 } });
      }
      return NextResponse.json(
        {
          success: false,
          error: { code: "LEDGER_WRITE_FAILED", message: "Purchase could not be recorded in ledger. Coins refunded." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully acquired ${rewardTitle}!`,
      data: {
        coins: updatedUser.coins,
        equippedTitle,
        equippedFrame,
      },
    });
  } catch (error: any) {
    console.error("[Reward Purchase Error]:", error);
    return NextResponse.json(
      { success: false, error: { code: "PURCHASE_FAILED", message: "An unexpected error occurred during purchase." } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Reward, User, Transaction } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to purchase rewards." }, { status: 401 });
    }

    const { rewardId } = await req.json();
    await connectDB();

    const reward: any = await Reward.findById(rewardId);
    if (!reward || !reward.isActive) {
      return NextResponse.json({ success: false, error: "Reward not found or unavailable." }, { status: 404 });
    }

    if (user.level < reward.minLevelRequired) {
      return NextResponse.json(
        { success: false, error: `Requires Hunter Level ${reward.minLevelRequired}. You are Level ${user.level}.` },
        { status: 403 }
      );
    }

    if (user.coins < reward.coinCost) {
      return NextResponse.json(
        { success: false, error: `Insufficient Hunter Coins. Needed: ${reward.coinCost}, Available: ${user.coins}.` },
        { status: 400 }
      );
    }

    if (reward.stock === 0) {
      return NextResponse.json({ success: false, error: "This item is sold out." }, { status: 400 });
    }

    // Process purchase
    const userDoc = await User.findById(user._id);
    if (!userDoc) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    userDoc.coins -= reward.coinCost;
    if (!userDoc.ownedCosmetics.includes(reward._id as Types.ObjectId)) {
      userDoc.ownedCosmetics.push(reward._id as Types.ObjectId);
    }

    if (reward.type === "TITLE") {
      userDoc.equippedTitle = reward.metadata?.value || reward.title;
    } else if (reward.type === "FRAME") {
      userDoc.equippedFrame = reward.metadata?.value || "";
    }

    await userDoc.save();

    if (reward.stock > 0) {
      reward.stock -= 1;
      await reward.save();
    }

    await Transaction.create({
      userId: user._id,
      deltaCoins: -reward.coinCost,
      deltaXp: 0,
      deltaTrust: 0,
      reason: `Purchased Shop Item: ${reward.title}`,
      referenceType: "ADMIN_ADJUST",
      referenceId: reward._id as Types.ObjectId,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully acquired ${reward.title}!`,
      data: {
        coins: userDoc.coins,
        equippedTitle: userDoc.equippedTitle,
        equippedFrame: userDoc.equippedFrame,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

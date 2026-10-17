import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Reward } from "@/models";

export async function GET() {
  try {
    await connectDB();
    let rewards = await Reward.find({ isActive: true }).sort({ coinCost: 1 }).lean();

    // If database has no rewards yet, seed default tactical items
    if (rewards.length === 0) {
      const defaults = [
        {
          title: "The Campus Phantom",
          description: "Exclusive title badge for discreet night investigators.",
          type: "TITLE",
          coinCost: 60,
          minLevelRequired: 3,
          stock: -1,
          isActive: true,
          metadata: { value: "The Campus Phantom", color: "purple" },
        },
        {
          title: "Eagle Eye",
          description: "Recognition for hunters with rapid clue deduction.",
          type: "TITLE",
          coinCost: 100,
          minLevelRequired: 5,
          stock: -1,
          isActive: true,
          metadata: { value: "Eagle Eye", color: "emerald" },
        },
        {
          title: "Obsidian Core Frame",
          description: "Dark carbon-fiber tactical avatar frame with animated border.",
          type: "FRAME",
          coinCost: 120,
          minLevelRequired: 4,
          stock: -1,
          isActive: true,
          metadata: { value: "border-emerald-500 shadow-emerald-500/20" },
        },
        {
          title: "Neon Cyan Holo-Frame",
          description: "Cyberpunk-inspired luminous cyan frame.",
          type: "FRAME",
          coinCost: 180,
          minLevelRequired: 6,
          stock: -1,
          isActive: true,
          metadata: { value: "border-cyan-400 shadow-cyan-400/30" },
        },
        {
          title: "Canteen Hot Coffee Voucher",
          description: "Redeemable at the Main Campus Canteen counter.",
          type: "CANTEEN_COUPON",
          coinCost: 75,
          minLevelRequired: 2,
          stock: 45,
          isActive: true,
          metadata: { value: "AIEM-CAFE-HOT" },
        },
        {
          title: "Library Reserved Pod Pass",
          description: "4-hour priority quiet-zone study pod reservation.",
          type: "CAMPUS_PERK",
          coinCost: 150,
          minLevelRequired: 5,
          stock: 20,
          isActive: true,
          metadata: { value: "LIB-POD-PRIORITY" },
        },
      ];
      rewards = (await Reward.insertMany(defaults as any)) as any;
    }

    return NextResponse.json({ success: true, data: rewards });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Reward } from "@/models";

export async function GET() {
  try {
    await connectDB();

    // Deactivate legacy physical items if present without deleting historical purchase records
    await Reward.updateMany(
      { type: { $in: ["CANTEEN_COUPON", "CAMPUS_PERK"] }, isActive: true },
      { $set: { isActive: false } }
    );

    let rewards = await Reward.find({
      isActive: true,
      type: { $nin: ["CANTEEN_COUPON", "CAMPUS_PERK"] },
    })
      .sort({ coinCost: 1 })
      .lean();

    // If database has no rewards yet, seed default tactical virtual items
    if (rewards.length === 0) {
      const defaults = [
        {
          code: "TITLE_CAMPUS_PHANTOM",
          name: "The Campus Phantom",
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
          code: "TITLE_EAGLE_EYE",
          name: "Eagle Eye",
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
          code: "FRAME_OBSIDIAN_CORE",
          name: "Obsidian Core Frame",
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
          code: "FRAME_NEON_CYAN",
          name: "Neon Cyan Holo-Frame",
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
          code: "THEME_OBSIDIAN_GRID",
          name: "Obsidian Grid UI Theme",
          title: "Obsidian Grid UI Theme",
          description: "Tactical dark UI HUD with subtle neon grid overlays.",
          type: "THEME",
          coinCost: 200,
          minLevelRequired: 5,
          stock: -1,
          isActive: true,
          metadata: { value: "theme-obsidian-grid" },
        },
        {
          code: "BADGE_CAMPUS_HERO",
          name: "Campus Custody Guardian Badge",
          title: "Campus Custody Guardian Badge",
          description: "Virtual profile crest recognizing dedicated returners of lost belongings.",
          type: "BADGE",
          coinCost: 150,
          minLevelRequired: 4,
          stock: -1,
          isActive: true,
          metadata: { value: "badge-custody-guardian" },
        },
      ];
      rewards = (await Reward.insertMany(defaults as any)) as any;
    }

    return NextResponse.json({ success: true, data: rewards });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

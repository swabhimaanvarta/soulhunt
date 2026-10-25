import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Reward } from "@/models";

export const dynamic = "force-dynamic";

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

    const defaults = [
      {
        code: "TITLE_CAMPUS_PATHFINDER",
        name: "Campus Pathfinder",
        title: "Campus Pathfinder",
        description: "Standard operative title for active campus investigators.",
        type: "TITLE",
        coinCost: 40,
        minLevelRequired: 1,
        stock: -1,
        isActive: true,
        metadata: { value: "Campus Pathfinder", color: "emerald" },
      },
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
        code: "TITLE_LEAD_DECODER",
        name: "Lead Decoder",
        title: "Lead Decoder",
        description: "Prestige title recognizing rapid cryptogram and clue deduction.",
        type: "TITLE",
        coinCost: 80,
        minLevelRequired: 4,
        stock: -1,
        isActive: true,
        metadata: { value: "Lead Decoder", color: "cyan" },
      },
      {
        code: "TITLE_EAGLE_EYE",
        name: "Eagle Eye",
        title: "Eagle Eye",
        description: "Recognition for hunters with exceptional recovery observation.",
        type: "TITLE",
        coinCost: 100,
        minLevelRequired: 5,
        stock: -1,
        isActive: true,
        metadata: { value: "Eagle Eye", color: "amber" },
      },
      {
        code: "TITLE_TACTICAL_OPERATIVE",
        name: "Tactical Operative",
        title: "Tactical Operative",
        description: "Elite title for seasoned syndicate field operatives.",
        type: "TITLE",
        coinCost: 120,
        minLevelRequired: 5,
        stock: -1,
        isActive: true,
        metadata: { value: "Tactical Operative", color: "violet" },
      },
      {
        code: "FRAME_EMERALD_PULSE",
        name: "Emerald Cyber Pulse Frame",
        title: "Emerald Cyber Pulse Frame",
        description: "Luminous pulsing emerald energy border for your investigator avatar.",
        type: "FRAME",
        coinCost: 75,
        minLevelRequired: 2,
        stock: -1,
        isActive: true,
        metadata: { value: "frame-emerald-pulse" },
      },
      {
        code: "FRAME_OBSIDIAN_CORE",
        name: "Obsidian Core Frame",
        title: "Obsidian Core Frame",
        description: "Dark carbon-fiber tactical avatar frame with animated stealth border.",
        type: "FRAME",
        coinCost: 120,
        minLevelRequired: 4,
        stock: -1,
        isActive: true,
        metadata: { value: "frame-obsidian" },
      },
      {
        code: "FRAME_AMBER_HUD",
        name: "Tactical HUD Amber Frame",
        title: "Tactical HUD Amber Frame",
        description: "Tactical golden HUD holographic bracket ring.",
        type: "FRAME",
        coinCost: 140,
        minLevelRequired: 4,
        stock: -1,
        isActive: true,
        metadata: { value: "frame-amber-hud" },
      },
      {
        code: "FRAME_VIOLET_RING",
        name: "Void Violet Ring Frame",
        title: "Void Violet Ring Frame",
        description: "Mysterious radiant violet void boundary flare.",
        type: "FRAME",
        coinCost: 160,
        minLevelRequired: 5,
        stock: -1,
        isActive: true,
        metadata: { value: "frame-violet-ring" },
      },
      {
        code: "FRAME_NEON_CYAN",
        name: "Neon Cyan Holo-Frame",
        title: "Neon Cyan Holo-Frame",
        description: "Cyberpunk-inspired luminous cyan avatar matrix frame.",
        type: "FRAME",
        coinCost: 180,
        minLevelRequired: 6,
        stock: -1,
        isActive: true,
        metadata: { value: "frame-cyan-matrix" },
      },
      {
        code: "THEME_OBSIDIAN_GRID",
        name: "Obsidian Grid UI Theme",
        title: "Obsidian Grid UI Theme",
        description: "Tactical dark UI HUD with subtle neon grid overlays.",
        type: "THEME",
        coinCost: 120,
        minLevelRequired: 3,
        stock: -1,
        isActive: true,
        metadata: { value: "theme-obsidian-grid" },
      },
      {
        code: "THEME_EMERALD_RECON",
        name: "Emerald Recon UI Theme",
        title: "Emerald Recon UI Theme",
        description: "High-contrast emerald recon dossier backdrop for your profile space.",
        type: "THEME",
        coinCost: 150,
        minLevelRequired: 4,
        stock: -1,
        isActive: true,
        metadata: { value: "theme-emerald-recon" },
      },
      {
        code: "THEME_CYBER_CYAN",
        name: "Cyberpunk Cyan UI Theme",
        title: "Cyberpunk Cyan UI Theme",
        description: "Futuristic neon cyan matrix styling for your public identity card.",
        type: "THEME",
        coinCost: 180,
        minLevelRequired: 5,
        stock: -1,
        isActive: true,
        metadata: { value: "theme-cyber-cyan" },
      },
      {
        code: "THEME_VIOLET_VOID",
        name: "Void Violet UI Theme",
        title: "Void Violet UI Theme",
        description: "Deep galactic violet dossier ambiance reserved for senior detectives.",
        type: "THEME",
        coinCost: 220,
        minLevelRequired: 6,
        stock: -1,
        isActive: true,
        metadata: { value: "theme-violet-void" },
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

    if (rewards.length < defaults.length) {
      for (const d of defaults) {
        await Reward.updateOne({ code: d.code }, { $setOnInsert: d }, { upsert: true });
      }
      rewards = await Reward.find({
        isActive: true,
        type: { $nin: ["CANTEEN_COUPON", "CAMPUS_PERK"] },
      })
        .sort({ coinCost: 1 })
        .lean();
    }

    return NextResponse.json({ success: true, data: rewards });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

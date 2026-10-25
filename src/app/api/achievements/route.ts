import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Achievement, UserAchievement } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const user = await getCurrentUser();

    let achievements = await Achievement.find({ isActive: true }).sort({ threshold: 1 }).lean();

    const defaults = [
      {
        code: "ACH_FIRST_RECOVERY",
        title: "Campus Good Samaritan",
        description: "Complete your first verified Lost & Found item recovery.",
        metricKey: "RECOVERIES_COUNT",
        threshold: 1,
        xpReward: 100,
        coinReward: 25,
        badgeIcon: "ShieldCheck",
        rarity: "COMMON",
      },
      {
        code: "ACH_LEVEL_5",
        title: "Veteran Investigator",
        description: "Advance to Hunter Level 5 — unlocks the authority to charter syndicates.",
        metricKey: "PLAYER_LEVEL",
        threshold: 5,
        xpReward: 500,
        coinReward: 50,
        badgeIcon: "Award",
        rarity: "RARE",
      },
      {
        code: "ACH_SAFE_KEEPER",
        title: "Safe-Desk Custodian",
        description: "Handover 3 found items securely to campus Safe-Desks.",
        metricKey: "SAFE_DESK_DEPOSITS",
        threshold: 3,
        xpReward: 250,
        coinReward: 50,
        badgeIcon: "Lock",
        rarity: "RARE",
      },
      {
        code: "ACH_SAFE_DESK_LEGEND",
        title: "Senior Safe-Desk Custodian",
        description: "Handover 10 found items securely to campus Safe-Desks.",
        metricKey: "SAFE_DESK_DEPOSITS",
        threshold: 10,
        xpReward: 600,
        coinReward: 120,
        badgeIcon: "ShieldAlert",
        rarity: "EPIC",
      },
      {
        code: "ACH_MASTER_DECODER",
        title: "Master Decoder",
        description: "Successfully complete 5 campus investigation quests.",
        metricKey: "QUESTS_COMPLETED",
        threshold: 5,
        xpReward: 350,
        coinReward: 75,
        badgeIcon: "Compass",
        rarity: "EPIC",
      },
      {
        code: "ACH_CAMPUS_SLEUTH",
        title: "Lead Deduction Specialist",
        description: "Successfully complete 10 campus investigation quests.",
        metricKey: "QUESTS_COMPLETED",
        threshold: 10,
        xpReward: 750,
        coinReward: 150,
        badgeIcon: "Target",
        rarity: "EPIC",
      },
      {
        code: "ACH_10_RECOVERIES",
        title: "Honorary Campus Guardian",
        description: "Complete 10 verified Lost & Found property returns.",
        metricKey: "RECOVERIES_COUNT",
        threshold: 10,
        xpReward: 800,
        coinReward: 150,
        badgeIcon: "ShieldCheck",
        rarity: "EPIC",
      },
      {
        code: "ACH_SQUAD_TACTICIAN",
        title: "Squad Tactician",
        description: "Complete 3 cooperative squad investigation hunts.",
        metricKey: "SQUAD_QUESTS",
        threshold: 3,
        xpReward: 400,
        coinReward: 80,
        badgeIcon: "Users",
        rarity: "EPIC",
      },
      {
        code: "ACH_CAMPUS_EXPLORER",
        title: "All-Campus Navigator",
        description: "Check in or solve clues in at least 4 different campus academic blocks.",
        metricKey: "VISITED_BLOCKS_COUNT",
        threshold: 4,
        xpReward: 300,
        coinReward: 60,
        badgeIcon: "MapPin",
        rarity: "RARE",
      },
      {
        code: "ACH_LEGENDARY_SEEKER",
        title: "Grand Archivist's Legacy",
        description: "Achieve Hunter Level 10 and 1,000 Trust Score.",
        metricKey: "PLAYER_LEVEL",
        threshold: 10,
        xpReward: 1000,
        coinReward: 250,
        badgeIcon: "Award",
        rarity: "LEGENDARY",
      },
    ];

    if (achievements.length < defaults.length) {
      for (const d of defaults) {
        await Achievement.updateOne({ code: d.code }, { $setOnInsert: d }, { upsert: true });
      }
      achievements = await Achievement.find({ isActive: true }).sort({ threshold: 1 }).lean();
    }

    let userProgressMap: Record<string, { progress: number; isUnlocked: boolean; unlockedAt?: Date }> = {};

    if (user) {
      const userAchs = await UserAchievement.find({ userId: user._id }).lean();
      for (const ua of userAchs) {
        userProgressMap[ua.achievementId.toString()] = {
          progress: ua.progress,
          isUnlocked: ua.isUnlocked,
          unlockedAt: ua.unlockedAt || undefined,
        };
      }
    }

    const enriched = achievements.map((ach) => {
      const userState = userProgressMap[ach._id.toString()];
      return {
        ...ach,
        userProgress: userState ? userState.progress : 0,
        isUnlocked: userState ? userState.isUnlocked : false,
        unlockedAt: userState ? userState.unlockedAt : null,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

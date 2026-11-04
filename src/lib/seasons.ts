/**
 * AIEM Hunt — Seasonal Prestige Leagues & Soft Reset Engine
 *
 * Implements 12-week academic semester seasonal cycles, tier classification,
 * compressed trophy soft-reset decay formulas, and Prestige Shard token payouts.
 *
 * Specification: docs/FEATURE_ROADMAP.md Section 1
 */

export type SeasonalTier =
  | "BRONZE_SCOUT"
  | "SILVER_TRACKER"
  | "GOLD_SLEUTH"
  | "PLATINUM_SENTINEL"
  | "DIAMOND_VANGUARD"
  | "APEX_GRANDMASTER";

export interface SeasonalTierInfo {
  tier: SeasonalTier;
  title: string;
  minTrophies: number;
  maxTrophies: number;
  trophyFloor: number;
  shardPayout: number;
  badgeCode: string;
  badgeColor: string;
}

export interface SeasonInfo {
  id: string;
  name: string;
  subtitle: string;
  academicSemester: "FALL" | "SPRING" | "SUMMER" | "INTERMISSION";
  startMonth: number; // 0-indexed
  endMonth: number;
  isIntermission: boolean;
}

export const SEASONAL_TIERS: Record<SeasonalTier, SeasonalTierInfo> = {
  BRONZE_SCOUT: {
    tier: "BRONZE_SCOUT",
    title: "Bronze Scout",
    minTrophies: 0,
    maxTrophies: 999,
    trophyFloor: 0,
    shardPayout: 50,
    badgeCode: "tier-bronze",
    badgeColor: "#ca8a04", // Amber-600
  },
  SILVER_TRACKER: {
    tier: "SILVER_TRACKER",
    title: "Silver Tracker",
    minTrophies: 1000,
    maxTrophies: 1999,
    trophyFloor: 1000,
    shardPayout: 150,
    badgeCode: "tier-silver",
    badgeColor: "#94a3b8", // Slate-400
  },
  GOLD_SLEUTH: {
    tier: "GOLD_SLEUTH",
    title: "Gold Sleuth",
    minTrophies: 2000,
    maxTrophies: 3499,
    trophyFloor: 1400,
    shardPayout: 350,
    badgeCode: "tier-gold",
    badgeColor: "#eab308", // Yellow-500
  },
  PLATINUM_SENTINEL: {
    tier: "PLATINUM_SENTINEL",
    title: "Platinum Sentinel",
    minTrophies: 3500,
    maxTrophies: 4999,
    trophyFloor: 2000,
    shardPayout: 700,
    badgeCode: "tier-platinum",
    badgeColor: "#06b6d4", // Cyan-500
  },
  DIAMOND_VANGUARD: {
    tier: "DIAMOND_VANGUARD",
    title: "Diamond Vanguard",
    minTrophies: 5000,
    maxTrophies: 7499,
    trophyFloor: 2600,
    shardPayout: 1200,
    badgeCode: "tier-diamond",
    badgeColor: "#a855f7", // Purple-500
  },
  APEX_GRANDMASTER: {
    tier: "APEX_GRANDMASTER",
    title: "Apex Grandmaster",
    minTrophies: 7500,
    maxTrophies: Infinity,
    trophyFloor: 3600,
    shardPayout: 2500,
    badgeCode: "tier-apex",
    badgeColor: "#f59e0b", // Amber-500
  },
};

/**
 * Resolves the seasonal tier given a hunter's trophy count.
 */
export function getSeasonalTier(trophies = 0): SeasonalTierInfo {
  const safeTrophies = Math.max(0, Math.floor(Number(trophies) || 0));

  if (safeTrophies >= 7500) return SEASONAL_TIERS.APEX_GRANDMASTER;
  if (safeTrophies >= 5000) return SEASONAL_TIERS.DIAMOND_VANGUARD;
  if (safeTrophies >= 3500) return SEASONAL_TIERS.PLATINUM_SENTINEL;
  if (safeTrophies >= 2000) return SEASONAL_TIERS.GOLD_SLEUTH;
  if (safeTrophies >= 1000) return SEASONAL_TIERS.SILVER_TRACKER;

  return SEASONAL_TIERS.BRONZE_SCOUT;
}

export interface TrophyResetResult {
  oldTrophies: number;
  newTrophies: number;
  decayedTrophies: number;
  tier: SeasonalTier;
  tierTitle: string;
  floor: number;
  shardPayout: number;
}

/**
 * Calculates Compressed Trophy Soft Reset:
 * Trophies_New = TrophyFloor + floor((Trophies_Old - TrophyFloor) * 0.40)
 *
 * Invariant: Players below 1,000 trophies do not decay.
 */
export function calculateCompressedTrophyReset(trophies = 0): TrophyResetResult {
  const safeTrophies = Math.max(0, Math.floor(Number(trophies) || 0));
  const tierInfo = getSeasonalTier(safeTrophies);

  // Invariant: Below 1000 trophies (Bronze), no decay occurs
  if (safeTrophies < 1000) {
    return {
      oldTrophies: safeTrophies,
      newTrophies: safeTrophies,
      decayedTrophies: 0,
      tier: tierInfo.tier,
      tierTitle: tierInfo.title,
      floor: 0,
      shardPayout: tierInfo.shardPayout,
    };
  }

  const excess = safeTrophies - tierInfo.trophyFloor;
  const retainedExcess = Math.floor(excess * 0.40);
  const newTrophies = tierInfo.trophyFloor + retainedExcess;
  const decayedTrophies = safeTrophies - newTrophies;

  return {
    oldTrophies: safeTrophies,
    newTrophies,
    decayedTrophies,
    tier: tierInfo.tier,
    tierTitle: tierInfo.title,
    floor: tierInfo.trophyFloor,
    shardPayout: tierInfo.shardPayout,
  };
}

/**
 * Returns current season details based on Asia/Kolkata campus calendar.
 */
export function getCurrentSeason(now = new Date()): SeasonInfo {
  // Convert to Asia/Kolkata timezone
  const kolkataDateStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const kolkataDate = new Date(kolkataDateStr);
  const month = kolkataDate.getMonth(); // 0 = Jan, 11 = Dec
  const year = kolkataDate.getFullYear();

  // Fall Semester: Aug - Nov (Months 7 - 10)
  if (month >= 7 && month <= 10) {
    return {
      id: `season-alpha-${year}`,
      name: "Season Alpha",
      subtitle: "The Autumn Reconnaissance",
      academicSemester: "FALL",
      startMonth: 7,
      endMonth: 10,
      isIntermission: false,
    };
  }

  // Spring Semester: Jan - Apr (Months 0 - 3)
  if (month >= 0 && month <= 3) {
    return {
      id: `season-beta-${year}`,
      name: "Season Beta",
      subtitle: "The Midnight Protocol",
      academicSemester: "SPRING",
      startMonth: 0,
      endMonth: 3,
      isIntermission: false,
    };
  }

  // Summer Sprint: May - Jul (Months 4 - 6)
  if (month >= 4 && month <= 6) {
    return {
      id: `season-gamma-${year}`,
      name: "Season Gamma",
      subtitle: "The Solstice Syndicate",
      academicSemester: "SUMMER",
      startMonth: 4,
      endMonth: 6,
      isIntermission: false,
    };
  }

  // December: Intermission & Calibration Period
  return {
    id: `season-intermission-${year}`,
    name: "Season Intermission",
    subtitle: "Calibration & Ledger Audit",
    academicSemester: "INTERMISSION",
    startMonth: 11,
    endMonth: 11,
    isIntermission: true,
  };
}

/**
 * Calculates season-end payout tokens ("Prestige Shards") based on tier achieved.
 */
export function calculateSeasonPayout(trophies = 0): {
  shards: number;
  tier: SeasonalTier;
  tierTitle: string;
} {
  const tierInfo = getSeasonalTier(trophies);
  return {
    shards: tierInfo.shardPayout,
    tier: tierInfo.tier,
    tierTitle: tierInfo.title,
  };
}

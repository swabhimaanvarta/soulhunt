/**
 * Authoritative Cosmetics Catalogue and Ownership Engine for AIEM Hunt.
 * Provides canonical definitions of starter loadouts, unlockable items, shop purchasables,
 * and ownership resolution rules.
 */

export type CosmeticCategory =
  | "AVATAR"
  | "FRAME"
  | "BANNER"
  | "BANNER_FRAME"
  | "EFFECT"
  | "TITLE"
  | "DECORATION";

export type CosmeticRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type CosmeticUnlockType = "STARTER" | "LEVEL" | "ACHIEVEMENT" | "SHOP";

export interface UnlockRequirement {
  level?: number;
  achievementId?: string;
  coinCost?: number;
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  isStarter: boolean;
  unlockType: CosmeticUnlockType;
  unlockRequirement?: UnlockRequirement;
  description: string;
  previewUrl?: string;
  badgeSlug?: string;
}

export const COSMETIC_CATALOGUE: CosmeticItem[] = [
  // ---------------------------------------------------------------------------
  // STARTER LOADOUTS: Freely available to all users with zero paywalls
  // ---------------------------------------------------------------------------
  // Avatars
  {
    id: "recon",
    name: "Recon Scout",
    category: "AVATAR",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Default recon scout avatar for field detection and zone patrol.",
    previewUrl: "/avatars/recon.png",
  },
  {
    id: "scout",
    name: "Campus Scout",
    category: "AVATAR",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Mobile agility scout avatar for swift campus investigation.",
    previewUrl: "/avatars/scout.png",
  },
  {
    id: "infiltrator",
    name: "Silent Infiltrator",
    category: "AVATAR",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Tactical stealth avatar preset for covert reconnaissance.",
    previewUrl: "/avatars/infiltrator.png",
  },
  {
    id: "tactician",
    name: "Field Tactician",
    category: "AVATAR",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Strategic coordination avatar preset for syndicate squad leads.",
    previewUrl: "/avatars/tactician.png",
  },

  // Frames
  {
    id: "frame-emerald-pulse",
    name: "Emerald Cyber Pulse",
    category: "FRAME",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Luminous pulsing emerald energy border for your investigator avatar.",
  },
  {
    id: "frame-cyber-grid",
    name: "Cyber Grid Frame",
    category: "FRAME",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Tactical digital matrix border for active investigators.",
  },

  // Themes / Banners
  {
    id: "theme-obsidian-grid",
    name: "Obsidian Grid Theme",
    category: "BANNER",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Tactical dark UI HUD with subtle neon grid overlays.",
  },
  {
    id: "theme-cyber-dark",
    name: "Cyber Dark Banner",
    category: "BANNER",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Dark cyberpunk banner theme with minimalist cyber lines.",
  },

  // Titles
  {
    id: "Campus Pathfinder",
    name: "Campus Pathfinder",
    category: "TITLE",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Standard operative title for active campus investigators.",
  },
  {
    id: "Rookie Investigator",
    name: "Rookie Investigator",
    category: "TITLE",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Entry-level field investigator title awarded upon induction.",
  },

  // Decorations
  {
    id: "badge-verified-hunter",
    name: "Verified Hunter Badge",
    category: "DECORATION",
    rarity: "COMMON",
    isStarter: true,
    unlockType: "STARTER",
    description: "Official AIEM campus verified investigator badge.",
    badgeSlug: "badge-verified-hunter",
  },

  // ---------------------------------------------------------------------------
  // UNLOCKABLE COSMETICS (Progression & Achievements)
  // ---------------------------------------------------------------------------
  // Level Unlocks
  {
    id: "frame-neon-gold",
    name: "Neon Gold Apex Frame",
    category: "FRAME",
    rarity: "EPIC",
    isStarter: false,
    unlockType: "LEVEL",
    unlockRequirement: { level: 5 },
    description: "Prestige radiant gold avatar frame awarded at Level 5.",
  },
  {
    id: "Master Tracker",
    name: "Master Tracker",
    category: "TITLE",
    rarity: "RARE",
    isStarter: false,
    unlockType: "LEVEL",
    unlockRequirement: { level: 8 },
    description: "Elite field tracker title unlocked at Level 8.",
  },
  {
    id: "Apex Hunter",
    name: "Apex Hunter",
    category: "TITLE",
    rarity: "LEGENDARY",
    isStarter: false,
    unlockType: "LEVEL",
    unlockRequirement: { level: 15 },
    description: "Supreme campus investigator title unlocked at Level 15.",
  },

  // Achievement Unlocks
  {
    id: "Night Owl",
    name: "Night Owl",
    category: "TITLE",
    rarity: "RARE",
    isStarter: false,
    unlockType: "ACHIEVEMENT",
    unlockRequirement: { achievementId: "ach-night-ops" },
    description: "Prestige nocturnal title awarded for completing night operations.",
  },
  {
    id: "Dean's Honor Guard",
    name: "Dean's Honor Guard",
    category: "TITLE",
    rarity: "LEGENDARY",
    isStarter: false,
    unlockType: "ACHIEVEMENT",
    unlockRequirement: { achievementId: "ach-campus-sentinel" },
    description: "Title honoring campus sentinels with outstanding integrity.",
  },

  // ---------------------------------------------------------------------------
  // SHOP PURCHASABLE COSMETICS
  // ---------------------------------------------------------------------------
  {
    id: "frame-obsidian",
    name: "Obsidian Core Frame",
    category: "FRAME",
    rarity: "RARE",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 120 },
    description: "Dark carbon-fiber tactical avatar frame with animated stealth border.",
  },
  {
    id: "frame-cyan-matrix",
    name: "Neon Cyan Matrix Frame",
    category: "FRAME",
    rarity: "EPIC",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 180 },
    description: "Cyberpunk-inspired luminous cyan avatar matrix frame.",
  },
  {
    id: "frame-hologram",
    name: "Holographic Prism Frame",
    category: "FRAME",
    rarity: "LEGENDARY",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 200 },
    description: "Prismatic holographic border shimmering with dynamic refraction.",
  },
  {
    id: "banner-matrix-rain",
    name: "Matrix Rain Banner",
    category: "BANNER",
    rarity: "RARE",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 75 },
    description: "Cascading digital rain profile banner.",
  },
  {
    id: "banner-synthwave",
    name: "Synthwave Sunset Banner",
    category: "BANNER",
    rarity: "EPIC",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 100 },
    description: "Retro-futuristic neon synthwave profile banner.",
  },
  {
    id: "title-crypto-sleuth",
    name: "Crypto Sleuth",
    category: "TITLE",
    rarity: "RARE",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 50 },
    description: "Specialist cryptogram decoder title.",
  },
  {
    id: "effect-glitch",
    name: "Holo-Glitch Effect",
    category: "EFFECT",
    rarity: "EPIC",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 100 },
    description: "Animated holographic glitch distortion overlay.",
  },
  {
    id: "banner-frame-cyber",
    name: "Cyber Matrix Banner Frame",
    category: "BANNER_FRAME",
    rarity: "RARE",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 75 },
    description: "Digital circuit frame border for profile banners.",
  },
  {
    id: "badge-top-contributor",
    name: "Top Contributor Badge",
    category: "DECORATION",
    rarity: "RARE",
    isStarter: false,
    unlockType: "SHOP",
    unlockRequirement: { coinCost: 100 },
    description: "Distinguished badge recognizing top campus community contributors.",
    badgeSlug: "badge-top-contributor",
  },
];

/**
 * Returns all starter cosmetics freely available to all users with zero paywalls.
 */
export function getStarterCosmetics(): CosmeticItem[] {
  return COSMETIC_CATALOGUE.filter((item) => item.isStarter);
}

/**
 * Validates whether the given identifier or name matches an authoritative starter item.
 */
export function isStarterCosmetic(cosmeticId: string): boolean {
  if (!cosmeticId || typeof cosmeticId !== "string") return false;
  const clean = cosmeticId.trim().toLowerCase();
  if (!clean) return false;

  return COSMETIC_CATALOGUE.some(
    (item) =>
      item.isStarter &&
      (item.id.toLowerCase() === clean || item.name.toLowerCase() === clean)
  );
}

/**
 * Retrieves a cosmetic item from the authoritative catalogue by ID or name (case-insensitive).
 */
export function getCosmeticById(id: string): CosmeticItem | undefined {
  if (!id || typeof id !== "string") return undefined;
  const clean = id.trim().toLowerCase();
  if (!clean) return undefined;

  return COSMETIC_CATALOGUE.find(
    (item) =>
      item.id.toLowerCase() === clean || item.name.toLowerCase() === clean
  );
}

/**
 * Checks whether a user owns or has unlocked a cosmetic item.
 * - Starter cosmetics are always owned by all users with zero paywalls.
 * - Checks user.ownedCosmetics array (by string id, ObjectId, or populated Reward document properties).
 * - Checks level requirements or achievement unlock status against the authoritative catalogue.
 */
export function isCosmeticOwned(
  user: { ownedCosmetics?: any[]; level?: number },
  cosmeticId: string,
  userLevel?: number,
  userAchievements?: string[]
): boolean {
  if (!cosmeticId || typeof cosmeticId !== "string") return false;
  const cleanId = cosmeticId.trim();
  if (!cleanId) return false;

  // 1. Starter cosmetics are always owned by any user
  if (isStarterCosmetic(cleanId)) {
    return true;
  }

  // 2. Check if present in user.ownedCosmetics
  if (Array.isArray(user.ownedCosmetics) && user.ownedCosmetics.length > 0) {
    const isDirectlyOwned = user.ownedCosmetics.some((entry: any) => {
      if (!entry) return false;

      // Primitive string or ObjectId
      if (typeof entry === "string") {
        return entry === cleanId || entry.toLowerCase() === cleanId.toLowerCase();
      }
      if (typeof entry.toString === "function") {
        const str = entry.toString();
        if (str === cleanId || str.toLowerCase() === cleanId.toLowerCase()) {
          return true;
        }
      }

      // Populated Reward object
      if (typeof entry === "object") {
        const objId = entry._id ? entry._id.toString() : "";
        const objCode = entry.code || "";
        const objTitle = entry.title || "";
        const objName = entry.name || "";
        const objVal = entry.metadata?.value || "";

        return (
          objId === cleanId ||
          objCode.toLowerCase() === cleanId.toLowerCase() ||
          objTitle.toLowerCase() === cleanId.toLowerCase() ||
          objName.toLowerCase() === cleanId.toLowerCase() ||
          objVal.toLowerCase() === cleanId.toLowerCase()
        );
      }
      return false;
    });

    if (isDirectlyOwned) {
      return true;
    }
  }

  // 3. Check level or achievement requirement in authoritative catalogue
  const item = getCosmeticById(cleanId);
  if (item) {
    if (item.isStarter) {
      return true;
    }

    if (item.unlockType === "LEVEL" && item.unlockRequirement?.level !== undefined) {
      const currentLevel = userLevel ?? user.level ?? 1;
      if (currentLevel >= item.unlockRequirement.level) {
        return true;
      }
    }

    if (item.unlockType === "ACHIEVEMENT" && item.unlockRequirement?.achievementId) {
      const achievements = userAchievements ?? (user as any).achievements ?? [];
      if (Array.isArray(achievements) && achievements.includes(item.unlockRequirement.achievementId)) {
        return true;
      }
    }
  }

  return false;
}

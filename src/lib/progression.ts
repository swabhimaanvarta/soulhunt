/**
 * Authoritative non-linear progression curve formula and level calculations.
 * Pure math module safe for both server and client bundle imports (no DB or Node built-ins).
 */

/**
 * Incremental XP required to advance from Level L to Level L+1.
 * Authoritative non-linear progression curve formula:
 * XP_{step}(L) = floor(150 * L + 50 * L^1.35)
 *
 * @param level - The base level (integer >= 1)
 * @returns The step XP required to advance from level to level + 1
 */
export function getXpRequiredForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return Math.floor(150 * l + 50 * Math.pow(l, 1.35));
}

/**
 * Returns the step XP required to advance from currentLevel to currentLevel + 1.
 * Alias for getXpRequiredForLevel(currentLevel).
 *
 * @param currentLevel - The player's current level (>= 1)
 * @returns The step XP required for the next level
 */
export function getXpRequiredForNextLevel(currentLevel: number): number {
  return getXpRequiredForLevel(currentLevel);
}

/**
 * Total cumulative XP required to reach Level L starting at Level 1 with 0 XP.
 * cumulativeXp(1) = 0
 * cumulativeXp(L) = sum_{i=1}^{L-1} floor(150 * i + 50 * i^1.35) for L >= 2.
 *
 * @param level - The target level (integer >= 1)
 * @returns The cumulative XP threshold to achieve target level
 */
export function getCumulativeXpForLevel(level: number): number {
  const targetLevel = Math.max(1, Math.floor(level));
  if (targetLevel <= 1) return 0;
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += getXpRequiredForLevel(i);
  }
  return total;
}

/**
 * Calculate integer level (>= 1) from cumulative XP based on non-linear thresholds.
 * Level 1 begins at 0 XP.
 *
 * @param xp - Total cumulative XP
 * @returns Integer level >= 1
 */
export function calculateLevelFromXp(xp: number): number {
  if (!xp || isNaN(xp) || xp <= 0) return 1;
  let level = 1;
  let cumXp = 0;
  while (true) {
    const stepXp = getXpRequiredForLevel(level);
    if (xp >= cumXp + stepXp) {
      cumXp += stepXp;
      level++;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Get current XP progress within current level.
 * currentXpInLevel = xp - cumulativeXp(level)
 * xpRequiredForNextLevel = XP_{step}(level)
 * progressPercent = Math.min(100, Math.floor((currentXpInLevel / xpRequiredForNextLevel) * 100))
 *
 * @param xp - Total cumulative XP
 * @returns Object with currentXpInLevel, xpRequiredForNextLevel, and progressPercent
 */
export function getXpProgressInLevel(xp: number): {
  currentXpInLevel: number;
  xpRequiredForNextLevel: number;
  progressPercent: number;
} {
  const safeXp = Math.max(0, isNaN(xp) ? 0 : xp);
  const level = calculateLevelFromXp(safeXp);
  const baseCumXp = getCumulativeXpForLevel(level);
  const currentXpInLevel = safeXp - baseCumXp;
  const xpRequiredForNextLevel = getXpRequiredForLevel(level);
  const progressPercent =
    xpRequiredForNextLevel > 0
      ? Math.min(100, Math.max(0, Math.floor((currentXpInLevel / xpRequiredForNextLevel) * 100)))
      : 0;

  return {
    currentXpInLevel,
    xpRequiredForNextLevel,
    progressPercent,
  };
}

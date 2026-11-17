/**
 * AIEM Hunt — Live-Ops Community Mini-Events & Campus Telemetry Engine
 *
 * Implements "Rush Hour Recon" (1.5x XP Boost + 20 Bonus Coins during 08:30–09:30 & 16:30–17:30 IST),
 * "Tactical Syndicate Weekends" (2.0x Squad XP multiplier from Friday 18:00 to Sunday 23:59 IST),
 * and "Emergency Campus Beacon" critical item detection.
 *
 * Specification: docs/FEATURE_ROADMAP.md Section 5
 */

export interface RushHourStatus {
  isActive: boolean;
  windowName: "MORNING_RECON" | "EVENING_RECON" | null;
  minutesRemaining: number;
  xpMultiplier: number;
  bonusCoins: number;
  label: string;
}

export interface SyndicateWeekendStatus {
  isActive: boolean;
  squadXpMultiplier: number;
  hoursRemaining: number;
  label: string;
}

export interface EmergencyBeaconResult {
  isEmergencyBeacon: boolean;
  priorityMultiplier: number;
  badgeCode: string;
  reason: string | null;
}

/**
 * Returns current date and time normalized to Asia/Kolkata (IST).
 */
export function getKolkataDate(date = new Date()): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sun, 5 = Fri, 6 = Sat
  hours: number;
  minutes: number;
  totalMinutes: number;
} {
  const istString = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();

  return {
    year: istDate.getFullYear(),
    month: istDate.getMonth(),
    day: istDate.getDate(),
    dayOfWeek: istDate.getDay(),
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  };
}

/**
 * Checks if "Rush Hour Recon" is active (08:30–09:30 or 16:30–17:30 IST).
 */
export function isRushHourActive(now = new Date()): boolean {
  const { totalMinutes } = getKolkataDate(now);
  const morningStart = 8 * 60 + 30; // 08:30 (510 min)
  const morningEnd = 9 * 60 + 30;   // 09:30 (570 min)
  const eveningStart = 16 * 60 + 30; // 16:30 (990 min)
  const eveningEnd = 17 * 60 + 30;   // 17:30 (1050 min)

  return (
    (totalMinutes >= morningStart && totalMinutes < morningEnd) ||
    (totalMinutes >= eveningStart && totalMinutes < eveningEnd)
  );
}

/**
 * Detailed telemetry status for Rush Hour Recon.
 */
export function getRushHourStatus(now = new Date()): RushHourStatus {
  const { totalMinutes } = getKolkataDate(now);
  const morningStart = 8 * 60 + 30;
  const morningEnd = 9 * 60 + 30;
  const eveningStart = 16 * 60 + 30;
  const eveningEnd = 17 * 60 + 30;

  if (totalMinutes >= morningStart && totalMinutes < morningEnd) {
    return {
      isActive: true,
      windowName: "MORNING_RECON",
      minutesRemaining: morningEnd - totalMinutes,
      xpMultiplier: 1.5,
      bonusCoins: 20,
      label: "Morning Recon (08:30 - 09:30 IST)",
    };
  }

  if (totalMinutes >= eveningStart && totalMinutes < eveningEnd) {
    return {
      isActive: true,
      windowName: "EVENING_RECON",
      minutesRemaining: eveningEnd - totalMinutes,
      xpMultiplier: 1.5,
      bonusCoins: 20,
      label: "Evening Recon (16:30 - 17:30 IST)",
    };
  }

  return {
    isActive: false,
    windowName: null,
    minutesRemaining: 0,
    xpMultiplier: 1.0,
    bonusCoins: 0,
    label: "Recon Inactive (Next: 08:30 or 16:30 IST)",
  };
}

/**
 * Checks if "Tactical Syndicate Weekend" is active
 * (Friday 18:00 IST through Sunday 23:59:59 IST).
 */
export function isSyndicateWeekendActive(now = new Date()): boolean {
  const { dayOfWeek, hours } = getKolkataDate(now);

  // Friday starting at 18:00 IST
  if (dayOfWeek === 5 && hours >= 18) return true;
  // Saturday all day
  if (dayOfWeek === 6) return true;
  // Sunday all day (ends at midnight)
  if (dayOfWeek === 0) return true;

  return false;
}

/**
 * Detailed telemetry status for Tactical Syndicate Weekend.
 */
export function getSyndicateWeekendStatus(now = new Date()): SyndicateWeekendStatus {
  const { dayOfWeek, hours } = getKolkataDate(now);
  const active = isSyndicateWeekendActive(now);

  if (!active) {
    return {
      isActive: false,
      squadXpMultiplier: 1.0,
      hoursRemaining: 0,
      label: "Weekend Syndicate Inactive (Launches Friday 18:00 IST)",
    };
  }

  // Calculate approximate hours remaining until Sunday 23:59:59 IST
  let hoursRemaining = 0;
  if (dayOfWeek === 5) {
    // Friday: (24 - hours) + 24 (Sat) + 24 (Sun)
    hoursRemaining = (24 - hours) + 48;
  } else if (dayOfWeek === 6) {
    // Saturday: (24 - hours) + 24 (Sun)
    hoursRemaining = (24 - hours) + 24;
  } else if (dayOfWeek === 0) {
    // Sunday: (24 - hours)
    hoursRemaining = Math.max(1, 24 - hours);
  }

  return {
    isActive: true,
    squadXpMultiplier: 2.0,
    hoursRemaining,
    label: "Tactical Syndicate Weekend Active (2x Squad XP)",
  };
}

/**
 * Computes live-event reward adjustments taking Rush Hour and Weekend modifiers into account.
 */
export function applyLiveEventModifiers(params: {
  baseXp: number;
  baseCoins: number;
  isSquadQuest?: boolean;
  now?: Date;
}): {
  effectiveXp: number;
  effectiveCoins: number;
  isRushHour: boolean;
  isSyndicateWeekend: boolean;
  bonusXp: number;
  bonusCoins: number;
  modifiersDescription: string[];
} {
  const now = params.now || new Date();
  const rushHour = getRushHourStatus(now);
  const weekend = getSyndicateWeekendStatus(now);

  let effectiveXp = Math.max(0, params.baseXp);
  let effectiveCoins = Math.max(0, params.baseCoins);
  let bonusXp = 0;
  let bonusCoins = 0;
  const modifiersDescription: string[] = [];

  if (rushHour.isActive) {
    const boostedXp = Math.round(effectiveXp * rushHour.xpMultiplier);
    bonusXp += boostedXp - effectiveXp;
    effectiveXp = boostedXp;

    bonusCoins += rushHour.bonusCoins;
    effectiveCoins += rushHour.bonusCoins;

    modifiersDescription.push(`Rush Hour Recon (+50% XP, +${rushHour.bonusCoins} Coins)`);
  }

  if (params.isSquadQuest && weekend.isActive) {
    const squadBoostedXp = Math.round(effectiveXp * weekend.squadXpMultiplier);
    bonusXp += squadBoostedXp - effectiveXp;
    effectiveXp = squadBoostedXp;

    modifiersDescription.push("Tactical Syndicate Weekend (2.0x Squad XP)");
  }

  return {
    effectiveXp,
    effectiveCoins,
    isRushHour: rushHour.isActive,
    isSyndicateWeekend: weekend.isActive,
    bonusXp,
    bonusCoins,
    modifiersDescription,
  };
}

const CRITICAL_KEYWORDS = [
  "student id",
  "identity card",
  "id card",
  "hall ticket",
  "admit card",
  "inhaler",
  "prescription",
  "medication",
  "calculator",
  "scientific calculator",
  "hard drive",
  "ssd",
  "project report",
  "lab record",
];

/**
 * Detects whether an item qualifies for "Emergency Campus Beacon"
 * (ID cards, medical items, scientific equipment, admit cards)
 * awarding double bounty rewards and priority broadcast flags.
 */
export function getEmergencyBeaconPriority(item: {
  title?: string;
  category?: string;
  description?: string;
}): EmergencyBeaconResult {
  const text = `${item.title || ""} ${item.category || ""} ${item.description || ""}`.toLowerCase();

  for (const keyword of CRITICAL_KEYWORDS) {
    if (text.includes(keyword)) {
      return {
        isEmergencyBeacon: true,
        priorityMultiplier: 2.0,
        badgeCode: "beacon-emergency",
        reason: `Critical campus asset detected matching keyword '${keyword}'`,
      };
    }
  }

  return {
    isEmergencyBeacon: false,
    priorityMultiplier: 1.0,
    badgeCode: "standard",
    reason: null,
  };
}


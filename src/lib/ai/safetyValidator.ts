/**
 * AIEM Hunt — AI Safety, Educational Integrity & Ethical Constraints Validator
 * 
 * Enforces ethical boundaries:
 * 1. Physical Safety: Clues MUST NEVER direct students into restricted, hazardous, or off-limits campus areas
 *    (e.g., electrical substations, rooftops, server rack interiors, chemical storage).
 * 2. Property Integrity: Clues MUST NEVER encourage tampering with real personal belongings.
 * 3. Pedagogical Quality: Clues must have verifiable expected answers, hints, and explanations.
 * 4. Structural Integrity: Stage ordering must be strictly sequential, and rewards bounded within safety caps.
 */

const FORBIDDEN_KEYWORDS = [
  "high voltage",
  "transformer",
  "electrical panel",
  "substation",
  "rooftop",
  "roof access",
  "construction zone",
  "server rack interior",
  "hazardous chemical",
  "faculty residence",
  "dorm bedroom",
  "restroom interior",
  "tamper",
  "steal",
  "pickpocket",
  "hide someone",
  "withhold",
  "break into",
  "lockpick",
  "climb over fence",
  "switchgear",
  "generator room",
];

export interface SafetyValidationResult {
  isSafe: boolean;
  violations: string[];
  warnings: string[];
}

export interface QuestSafetyPayload {
  title: string;
  description: string;
  safetyRationale?: string;
  difficulty?: number;
  xpReward?: number;
  coinReward?: number;
  locationCode?: string;
  approvedLocationCodes?: string[];
  clues: Array<{
    stageOrder: number;
    title: string;
    clueText: string;
    verificationType?: string;
    expectedAnswer?: string;
    acceptableAnswers?: string[];
    hintText?: string;
    explanation?: string;
  }>;
}

export function validateQuestSafety(params: QuestSafetyPayload): SafetyValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // 1. Keyword Scan for Hazardous or Prohibited Campus Areas
  const textCorpus = [
    params.title || "",
    params.description || "",
    params.safetyRationale || "",
    ...params.clues.flatMap((c) => [
      c.title || "",
      c.clueText || "",
      c.hintText || "",
      c.explanation || "",
      c.expectedAnswer || "",
      ...(c.acceptableAnswers || []),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  for (const forbidden of FORBIDDEN_KEYWORDS) {
    if (textCorpus.includes(forbidden)) {
      violations.push(`Triggered forbidden safety constraint: "${forbidden}". Clues must not reference restricted or hazardous campus zones.`);
    }
  }

  // 2. Stage Ordering & Integrity Check
  if (!Array.isArray(params.clues) || params.clues.length === 0) {
    violations.push("Quest must contain at least 1 investigative clue stage.");
  } else {
    for (let i = 0; i < params.clues.length; i++) {
      const clue = params.clues[i];
      const expectedStage = i + 1;
      if (clue.stageOrder !== expectedStage) {
        violations.push(`Stage ordering violation at index ${i}: expected stageOrder ${expectedStage}, found ${clue.stageOrder}.`);
      }

      if (!clue.expectedAnswer || clue.expectedAnswer.trim().length === 0) {
        violations.push(`Stage ${clue.stageOrder} has an empty expected answer. Deterministic solution is required.`);
      } else if (clue.expectedAnswer.trim().length > 60) {
        warnings.push(`Stage ${clue.stageOrder} expected answer is quite long (${clue.expectedAnswer.length} chars). Prefer concise normalized answers.`);
      }

      if (!clue.clueText || clue.clueText.trim().length < 10) {
        violations.push(`Stage ${clue.stageOrder} clue text is too short or ambiguous.`);
      }
    }
  }

  // 3. Reward Bounding Safeguards
  if (params.xpReward !== undefined) {
    if (params.xpReward < 25 || params.xpReward > 1000) {
      violations.push(`XP reward (${params.xpReward}) exceeds safe campus bounds [25 - 1000].`);
    }
  }
  if (params.coinReward !== undefined) {
    if (params.coinReward < 0 || params.coinReward > 150) {
      violations.push(`Hunter Coin reward (${params.coinReward}) exceeds economy bounds [0 - 150].`);
    }
  }

  // 4. Approved Campus Location Verification
  if (params.locationCode && params.approvedLocationCodes && params.approvedLocationCodes.length > 0) {
    if (!params.approvedLocationCodes.includes(params.locationCode)) {
      warnings.push(`Location code "${params.locationCode}" is not in the course's approved location roster.`);
    }
  }

  return {
    isSafe: violations.length === 0,
    violations,
    warnings,
  };
}

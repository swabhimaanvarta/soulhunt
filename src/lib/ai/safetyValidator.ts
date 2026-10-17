/**
 * AIEM Hunt — AI Safety & Ethical Constraints Validator
 * 
 * Enforces ethical boundaries:
 * 1. Clues MUST NEVER direct students into restricted, hazardous, or off-limits campus areas
 *    (e.g., electrical substations, rooftops, server rack interiors, chemical storage).
 * 2. Clues MUST NEVER encourage tampering with real people's personal belongings.
 * 3. Gameplay remains purely discovery, clue deduction, and Safe-Desk verified recovery.
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
];

export interface SafetyValidationResult {
  isSafe: boolean;
  violations: string[];
}

export function validateQuestSafety(params: {
  title: string;
  description: string;
  clues: Array<{
    title: string;
    clueText: string;
    hintText?: string;
    expectedAnswer?: string;
  }>;
}): SafetyValidationResult {
  const violations: string[] = [];

  const textCorpus = [
    params.title,
    params.description,
    ...params.clues.flatMap((c) => [c.title, c.clueText, c.hintText || "", c.expectedAnswer || ""]),
  ]
    .join(" ")
    .toLowerCase();

  for (const forbidden of FORBIDDEN_KEYWORDS) {
    if (textCorpus.includes(forbidden)) {
      violations.push(`Triggered forbidden keyword or safety constraint: "${forbidden}"`);
    }
  }

  return {
    isSafe: violations.length === 0,
    violations,
  };
}


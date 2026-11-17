/**
 * AIEM Hunt — Course-Aligned AI Quest Synthesis & Provider Abstraction
 * 
 * Supports:
 * 1. Google Gemini API (gemini-1.5-flash or configurable via GEMINI_MODEL)
 * 2. OpenAI API (gpt-4o-mini or configurable via OPENAI_MODEL)
 * 3. Course-Aligned Deterministic Academic Generator (Zero-dependency syllabus fallback)
 */

import { z } from "zod";
import { validateQuestSafety, SafetyValidationResult } from "./safetyValidator";

// Strict Zod schema for structured output validation
export const GeneratedClueSchema = z.object({
  stageOrder: z.number().int().min(1),
  title: z.string().min(2),
  clueText: z.string().min(10),
  verificationType: z.enum([
    "TEXT_RIDDLE",
    "NUMERIC_CALCULATION",
    "MULTIPLE_CHOICE",
    "LOCATION_CHECKIN",
  ]).default("TEXT_RIDDLE"),
  expectedAnswer: z.string().min(1),
  acceptableAnswers: z.array(z.string()).optional(),
  numericTolerance: z.number().optional(),
  hintText: z.string().min(5),
  explanation: z.string().min(10),
  options: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    })
  ).optional(),
  correctOptionId: z.string().optional(),
  unlockedBreadcrumbText: z.string().min(5),
  variantTemplate: z.object({
    type: z.enum(["NUMERIC_PARAMETRIC", "MULTIPLE_CHOICE_SHUFFLE", "NONE"]).optional(),
    templateKey: z.string().optional(),
    templateText: z.string().optional(),
    parameterRanges: z.record(z.union([z.tuple([z.number(), z.number()]), z.array(z.number())])).optional(),
    formula: z.string().optional(),
    explanationTemplate: z.string().optional(),
  }).optional(),
});

export const GeneratedQuestDataSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(15),
  courseTopic: z.string().default("General Academic"),
  learningOutcome: z.string().default("Apply critical deduction"),
  expectedDurationMinutes: z.number().int().min(5).max(120).default(20),
  difficulty: z.number().int().min(1).max(5).default(3),
  locationCode: z.string().default("COMP-AI"),
  safetyRationale: z.string().default("All clue locations are publicly accessible campus academic facilities."),
  reviewerAssumptions: z.string().default("Assumes student has basic familiarity with course prerequisites."),
  xpReward: z.number().int().min(25).max(1000).default(200),
  coinReward: z.number().int().min(0).max(150).default(40),
  squadXpReward: z.number().int().min(0).max(200).default(50),
  clues: z.array(GeneratedClueSchema).min(1),
});

export type GeneratedClue = z.infer<typeof GeneratedClueSchema>;
export type GeneratedQuestData = z.infer<typeof GeneratedQuestDataSchema>;

export interface GenerateQuestOptions {
  theme?: string;
  difficulty?: number;
  questType?:
    | "CAMPUS_TREASURE"
    | "DAILY_HUNT"
    | "MYSTERY"
    | "LEGENDARY"
    | "SQUAD_HUNT"
    | "QUICK_FIND"
    | "INVESTIGATION";
  locationName?: string;
  locationCode?: string;
  stageCount?: number;
  prompt?: string;
  // Course-aligned fields
  courseId?: string;
  moduleNumber?: number;
  moduleId?: string;
  courseCode?: string;
  courseName?: string;
  semester?: number;
  moduleTitle?: string;
  topic?: string;
  learningOutcome?: string;
  approvedSyllabusText?: string;
  expectedDurationMinutes?: number;
  approvedLocations?: Array<{ code: string; name: string }>;
  approvedLocationCodes?: string[];
  // Operational provider selection
  preferredProvider?: "GEMINI" | "OPENAI" | "TEMPLATE" | "AUTO";
  disableFallback?: boolean;
}

export interface GeneratedQuestOutput {
  source: "AI_GEMINI" | "AI_OPENAI" | "TEMPLATE";
  data: GeneratedQuestData;
  modelName: string;
  safetyCheck: SafetyValidationResult;
  fallbackTriggered: boolean;
  fallbackReason?: string;
}

export async function generateCampusQuest(
  options: GenerateQuestOptions = {}
): Promise<GeneratedQuestOutput> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const preferred = options.preferredProvider || (process.env.AI_PRIMARY_PROVIDER as any) || "AUTO";

  const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  let lastError: string | undefined;

  // 1. If preferred is GEMINI or AUTO, attempt Gemini first
  if ((preferred === "GEMINI" || preferred === "AUTO") && geminiKey) {
    try {
      const result = await generateWithGemini(geminiKey, geminiModel, options);
      if (result) return result;
    } catch (err: any) {
      lastError = `Gemini failed: ${err.message || String(err)}`;
      console.warn("[AIGameMaster]", lastError);
      if (options.disableFallback) {
        throw new Error(lastError);
      }
    }
  }

  // 2. If preferred is OPENAI or fallback allowed, attempt OpenAI
  if ((preferred === "OPENAI" || preferred === "AUTO" || (preferred === "GEMINI" && !options.disableFallback)) && openAiKey) {
    try {
      const result = await generateWithOpenAI(openAiKey, openAiModel, options);
      if (result) {
        if (preferred === "GEMINI") {
          result.fallbackTriggered = true;
          result.fallbackReason = lastError || "Gemini unavailable; fell back to OpenAI.";
        }
        return result;
      }
    } catch (err: any) {
      lastError = `OpenAI failed: ${err.message || String(err)}`;
      console.warn("[AIGameMaster]", lastError);
      if (options.disableFallback) {
        throw new Error(lastError);
      }
    }
  }

  const approvedCodes =
    options.approvedLocationCodes ||
    (options.approvedLocations ? options.approvedLocations.map((l) => l.code) : []);

  // 3. Deterministic Course-Aligned Local Academic Generator (Zero-dependency fallback)
  const templateData = generateCourseAlignedTemplate({
    ...options,
    approvedLocationCodes: approvedCodes,
  });
  const safety = validateQuestSafety({
    title: templateData.title,
    description: templateData.description,
    safetyRationale: templateData.safetyRationale,
    difficulty: templateData.difficulty,
    xpReward: templateData.xpReward,
    coinReward: templateData.coinReward,
    locationCode: templateData.locationCode,
    approvedLocationCodes: approvedCodes,
    clues: templateData.clues,
  });

  return {
    source: "TEMPLATE",
    data: templateData,
    modelName: "deterministic-syllabus-engine-v2",
    safetyCheck: safety,
    fallbackTriggered: Boolean(geminiKey || openAiKey),
    fallbackReason: lastError || (preferred === "TEMPLATE" ? "Template provider selected explicitly." : "AI keys unavailable or models unreachable; deterministic academic syllabus engine utilized."),
  };
}

async function generateWithGemini(
  apiKey: string,
  modelName: string,
  options: GenerateQuestOptions
): Promise<GeneratedQuestOutput | null> {
  const prompt = buildStructuredQuestPrompt(options);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000); // 14s timeout

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4, // Lower temperature for curriculum factual rigor
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const msg = `Gemini HTTP ${res.status}: ${errorText}`;
      console.warn(`[AIGameMaster] ${msg}`);
      throw new Error(msg);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsedJson = JSON.parse(rawText);
    const validated = GeneratedQuestDataSchema.parse(parsedJson);

    const approvedCodes =
      options.approvedLocationCodes ||
      (options.approvedLocations ? options.approvedLocations.map((l) => l.code) : []);

    const safety = validateQuestSafety({
      title: validated.title,
      description: validated.description,
      safetyRationale: validated.safetyRationale,
      difficulty: validated.difficulty,
      xpReward: validated.xpReward,
      coinReward: validated.coinReward,
      locationCode: validated.locationCode,
      approvedLocationCodes: approvedCodes,
      clues: validated.clues,
    });

    if (!safety.isSafe) {
      console.warn("[AIGameMaster] Gemini generation rejected by safety filter:", safety.violations);
      return null;
    }

    return {
      source: "AI_GEMINI",
      data: validated,
      modelName,
      safetyCheck: safety,
      fallbackTriggered: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateWithOpenAI(
  apiKey: string,
  modelName: string,
  options: GenerateQuestOptions
): Promise<GeneratedQuestOutput | null> {
  const prompt = buildStructuredQuestPrompt(options);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are the AI Academic Game Master for AIEM Hunt. Generate educational campus quests strictly conforming to the provided course curriculum and approved syllabus material. Return strictly valid JSON adhering to the specified schema. Never invent nonexistent campus facilities or unsafe physical challenges.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const msg = `OpenAI HTTP ${res.status}: ${errorText}`;
      console.warn(`[AIGameMaster] ${msg}`);
      throw new Error(msg);
    }

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) return null;

    const parsedJson = JSON.parse(rawText);
    const validated = GeneratedQuestDataSchema.parse(parsedJson);

    const approvedCodes =
      options.approvedLocationCodes ||
      (options.approvedLocations ? options.approvedLocations.map((l) => l.code) : []);

    const safety = validateQuestSafety({
      title: validated.title,
      description: validated.description,
      safetyRationale: validated.safetyRationale,
      difficulty: validated.difficulty,
      xpReward: validated.xpReward,
      coinReward: validated.coinReward,
      locationCode: validated.locationCode,
      approvedLocationCodes: approvedCodes,
      clues: validated.clues,
    });

    if (!safety.isSafe) return null;

    return {
      source: "AI_OPENAI",
      data: validated,
      modelName,
      safetyCheck: safety,
      fallbackTriggered: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildStructuredQuestPrompt(options: GenerateQuestOptions): string {
  const stageCount = options.stageCount || (options.difficulty && options.difficulty > 3 ? 3 : 2);
  const difficulty = options.difficulty || 3;
  const locationCode = options.locationCode || "COMP-AI";
  const courseCode = options.courseCode || "CS201";
  const courseName = options.courseName || "Data Structures & Algorithms";
  const topic = options.topic || "Hashing & Collision Resolution";
  const outcome = options.learningOutcome || "Calculate hash table indices and analyze linear probing";
  const syllabus = options.approvedSyllabusText || "Standard university engineering syllabus principles.";
  const duration = options.expectedDurationMinutes || 20;

  return `
You are the AI Academic Game Master for AIEM Hunt. Generate a structured, course-aligned educational campus quest.

CURRICULUM SPECIFICATIONS:
- Course: ${courseCode} — ${courseName} (Semester ${options.semester || 3})
- Module: ${options.moduleTitle || "Core Module"}
- Specific Topic: ${topic}
- Target Learning Outcome: ${outcome}
- Approved Syllabus Material (ONLY use facts, definitions, and formulas from this excerpt):
"""
${syllabus}
"""
- Anchor Campus Location Code: ${locationCode}
- Difficulty: ${difficulty} (1 to 5)
- Number of Clue Stages: Exactly ${stageCount} sequential stages (stageOrder 1 to ${stageCount})
- Expected Duration: ${duration} minutes
${options.prompt ? `- Additional Admin Context: "${options.prompt.trim()}"` : ""}

CRITICAL DESIGN RULES:
1. Every clue must relate directly to the approved syllabus material and learning outcome.
2. Clues must have deterministic, unambiguous expected answers that can be verified automatically (concise calculation number, short normalized term, or multiple-choice option ID).
3. Provide a clear pedagogical explanation for each clue explaining why the answer is correct according to the syllabus.
4. For calculation questions, provide the exact numerical answer and include acceptable variations in acceptableAnswers.
5. All clues must take place in safe, publicly accessible campus academic buildings. No dangerous or off-limits areas.
6. Return valid JSON strictly matching this schema:

{
  "title": "Concise engaging title (e.g. 'Hash Collision Protocol in Sector B')",
  "description": "Student-friendly mission briefing explaining the academic mystery and what needs to be solved.",
  "courseTopic": "${topic}",
  "learningOutcome": "${outcome}",
  "expectedDurationMinutes": ${duration},
  "difficulty": ${difficulty},
  "locationCode": "${locationCode}",
  "safetyRationale": "Explicit statement of why this quest is physically safe on campus.",
  "reviewerAssumptions": "Notes for the faculty reviewer regarding assumptions and key formulas.",
  "xpReward": ${difficulty * 75},
  "coinReward": ${difficulty * 15},
  "squadXpReward": ${difficulty * 25},
  "clues": [
    {
      "stageOrder": 1,
      "title": "Stage 1: ...",
      "clueText": "The problem statement or puzzle based on the syllabus...",
      "verificationType": "TEXT_RIDDLE" | "NUMERIC_CALCULATION" | "MULTIPLE_CHOICE",
      "expectedAnswer": "normalized answer string (e.g. '4' or 'fifo')",
      "acceptableAnswers": ["4", "four"],
      "numericTolerance": 0,
      "hintText": "Guiding pedagogical hint for stuck students",
      "explanation": "Detailed step-by-step academic explanation of why this answer is correct",
      "options": [
        {"id": "opt_a", "text": "Option A"},
        {"id": "opt_b", "text": "Option B"}
      ],
      "correctOptionId": "opt_a",
      "unlockedBreadcrumbText": "Milestone coordinate unlocked for next stage"
    }
  ]
}
`;
}

/**
 * Deterministic Course-Aligned Local Academic Generator
 * Provides 100% reliable syllabus-grounded challenges when AI APIs are unavailable.
 */
function generateCourseAlignedTemplate(options: GenerateQuestOptions): GeneratedQuestData {
  const difficulty = options.difficulty || 3;
  const courseCode = options.courseCode || "CS201";
  const topic = options.topic || "Hashing & Collision Resolution";
  const outcome = options.learningOutcome || "Calculate hash indices and analyze linear probing";
  const approvedCodes =
    options.approvedLocationCodes ||
    (options.approvedLocations ? options.approvedLocations.map((l) => l.code) : []);
  let locationCode = options.locationCode || (approvedCodes.length > 0 ? approvedCodes[0] : "COMP-AI");
  if (approvedCodes.length > 0 && !approvedCodes.includes(locationCode)) {
    locationCode = approvedCodes[0];
  }
  const stageCount = options.stageCount || 2;
  const duration = options.expectedDurationMinutes || 20;

  // Domain-specific deterministic templates based on course code
  if (courseCode.startsWith("EC") || topic.toLowerCase().includes("sampling")) {
    // Electronics / DSP
    const fmax = 4000;
    const nyquistRate = 2 * fmax;
    return {
      title: "Nyquist Criterion & Spectral Reconnaissance",
      description: `A telemetry sensor in ${locationCode} recorded an analog audio signal with highest frequency component fmax = ${fmax} Hz. Solve the sampling stages to reconstruct the signal without aliasing.`,
      courseTopic: topic,
      learningOutcome: outcome,
      expectedDurationMinutes: duration,
      difficulty,
      locationCode,
      safetyRationale: "All investigation takes place in public computer engineering and electronics lab corridors.",
      reviewerAssumptions: "Applies standard Nyquist-Shannon Sampling Theorem fs >= 2 * fmax.",
      xpReward: difficulty * 75,
      coinReward: difficulty * 15,
      squadXpReward: difficulty * 25,
      clues: [
        {
          stageOrder: 1,
          title: "Stage 1: Minimum Sampling Frequency Calculation",
          clueText: `According to the Nyquist-Shannon sampling theorem, what is the theoretical MINIMUM sampling frequency fs (in Hz) required to prevent spectral aliasing for an analog signal with fmax = ${fmax} Hz? Enter the exact integer value.`,
          verificationType: "NUMERIC_CALCULATION",
          expectedAnswer: String(nyquistRate),
          acceptableAnswers: [String(nyquistRate), `${nyquistRate}hz`, `${nyquistRate} hz`],
          numericTolerance: 0,
          hintText: "Recall that Nyquist rate is defined as fs_min = 2 * fmax.",
          explanation: `The Nyquist rate is calculated as fs = 2 * fmax = 2 * ${fmax} = ${nyquistRate} Hz. Any lower rate causes spectral folding/aliasing.`,
          unlockedBreadcrumbText: "Sampling threshold confirmed. DSP ADC register calibration unlocked.",
          variantTemplate: {
            type: "NUMERIC_PARAMETRIC" as const,
            templateKey: "NYQUIST_SAMPLING",
            templateText: `According to the Nyquist-Shannon sampling theorem, what is the theoretical MINIMUM sampling frequency fs (in Hz) required to prevent spectral aliasing for an analog signal with fmax = {fmax} Hz? Enter the exact integer value.`,
            parameterRanges: { fmax: [2500, 3200, 4000, 4800, 5000, 6000, 7500, 8000] },
            formula: "2 * fmax",
            explanationTemplate: `The Nyquist rate is calculated as fs = 2 * fmax = 2 * {fmax} = {answer} Hz. Any lower rate causes spectral folding/aliasing.`,
          },
        },
        ...(stageCount > 1
          ? [
              {
                stageOrder: 2,
                title: "Stage 2: Anti-Aliasing Filter Cutoff",
                clueText: `To ensure no frequencies above ${fmax} Hz enter the ADC sampler, which analog low-pass filter topology is placed BEFORE the digitizer?`,
                verificationType: "MULTIPLE_CHOICE" as const,
                expectedAnswer: "opt_anti_aliasing",
                acceptableAnswers: ["opt_anti_aliasing", "anti-aliasing", "anti-aliasing filter"],
                hintText: "Consider the filter designed specifically to eliminate frequencies above the Nyquist bandwidth.",
                explanation: "An Anti-Aliasing Low-Pass Filter is placed prior to sampling to attenuate frequencies higher than half the sampling rate.",
                options: [
                  { id: "opt_bandstop", text: "Narrowband 50Hz Notch Filter" },
                  { id: "opt_anti_aliasing", text: "Anti-Aliasing Low-Pass Filter" },
                  { id: "opt_highpass", text: "Differentiator High-Pass Filter" },
                  { id: "opt_allpass", text: "Phase-Shift All-Pass Network" },
                ],
                correctOptionId: "opt_anti_aliasing",
                unlockedBreadcrumbText: "Filter specifications validated. Final telemetry decoded.",
                variantTemplate: {
                  type: "MULTIPLE_CHOICE_SHUFFLE" as const,
                  templateKey: "MC_SHUFFLE",
                },
              },
            ]
          : []),
      ],
    };
  } else if (courseCode.startsWith("MA") || topic.toLowerCase().includes("rsa") || topic.toLowerCase().includes("euclid")) {
    // Discrete Math & Cryptography
    const p = 7;
    const q = 11;
    const n = p * q;
    const phi = (p - 1) * (q - 1);
    return {
      title: "RSA Cryptographic Key Synthesis",
      description: `Security protocols in ${locationCode} require key derivation using modular arithmetic. Apply Euclidean totient principles to compute the cryptographic modulus and totient.`,
      courseTopic: topic,
      learningOutcome: outcome,
      expectedDurationMinutes: duration,
      difficulty,
      locationCode,
      safetyRationale: "Cryptographic theory deduction located in the main library study sectors.",
      reviewerAssumptions: "Uses standard Euler totient function phi(n) = (p-1)*(q-1) for prime numbers.",
      xpReward: difficulty * 75,
      coinReward: difficulty * 15,
      squadXpReward: difficulty * 25,
      clues: [
        {
          stageOrder: 1,
          title: "Stage 1: Modulus Computation",
          clueText: `An RSA key pair uses two prime numbers p = ${p} and q = ${q}. What is the public modulus n = p * q?`,
          verificationType: "NUMERIC_CALCULATION",
          expectedAnswer: String(n),
          acceptableAnswers: [String(n)],
          numericTolerance: 0,
          hintText: "Multiply the two prime numbers: n = p * q.",
          explanation: `The modulus is n = ${p} * ${q} = ${n}.`,
          unlockedBreadcrumbText: "Modulus n established. Proceeding to totient calculation.",
          variantTemplate: {
            type: "NUMERIC_PARAMETRIC" as const,
            templateKey: "RSA_MODULUS",
            templateText: `An RSA key pair uses two prime numbers p = {p} and q = {q}. What is the public modulus n = p * q?`,
            parameterRanges: { primePairIndex: [0, 1, 2, 3, 4, 5] },
            formula: "p * q",
            explanationTemplate: `The modulus is n = {p} * {q} = {answer}.`,
          },
        },
        ...(stageCount > 1
          ? [
              {
                stageOrder: 2,
                title: "Stage 2: Euler Totient Calculation",
                clueText: `Using Euler's totient function phi(n) = (p - 1) * (q - 1), calculate the totient value for p = ${p} and q = ${q}.`,
                verificationType: "NUMERIC_CALCULATION" as const,
                expectedAnswer: String(phi),
                acceptableAnswers: [String(phi)],
                numericTolerance: 0,
                hintText: `Calculate (${p} - 1) * (${q} - 1).`,
                explanation: `phi(n) = (${p} - 1) * (${q} - 1) = ${p - 1} * ${q - 1} = ${phi}.`,
                unlockedBreadcrumbText: "Totient verified. Public key exponent authorized.",
                variantTemplate: {
                  type: "NUMERIC_PARAMETRIC" as const,
                  templateKey: "RSA_TOTIENT",
                  templateText: `Using Euler's totient function phi(n) = (p - 1) * (q - 1), calculate the totient value for p = {p} and q = {q}.`,
                  parameterRanges: { primePairIndex: [0, 1, 2, 3, 4, 5] },
                  formula: "(p - 1) * (q - 1)",
                  explanationTemplate: `phi(n) = ({p} - 1) * ({q} - 1) = {answer}.`,
                },
              },
            ]
          : []),
      ],
    };
  } else {
    // Default: Computer Engineering / Data Structures (CS201)
    const tableSize = 7;
    const key = 19;
    const initialIndex = key % tableSize; // 5
    return {
      title: "Hash Table Probing & Collision Resolution",
      description: `Investigate the hash indexing table in ${locationCode}. Given a hash table of size m = ${tableSize} using hash function h(k) = k mod ${tableSize}, trace the collision resolution sequence.`,
      courseTopic: topic,
      learningOutcome: outcome,
      expectedDurationMinutes: duration,
      difficulty,
      locationCode,
      safetyRationale: "Investigation is hosted in academic Computer Center labs with standard seating.",
      reviewerAssumptions: "Follows division-modulo hashing with linear probing collision resolution.",
      xpReward: difficulty * 75,
      coinReward: difficulty * 15,
      squadXpReward: difficulty * 25,
      clues: [
        {
          stageOrder: 1,
          title: "Stage 1: Primary Hash Index Calculation",
          clueText: `For a hash table of capacity m = ${tableSize} and key k = ${key}, what is the initial hash index computed by h(k) = k mod ${tableSize}? Enter the single digit index.`,
          verificationType: "NUMERIC_CALCULATION",
          expectedAnswer: String(initialIndex),
          acceptableAnswers: [String(initialIndex), `index ${initialIndex}`, `slot ${initialIndex}`],
          numericTolerance: 0,
          hintText: `Compute remainder of ${key} divided by ${tableSize}: ${key} % ${tableSize}.`,
          explanation: `19 mod 7 = 5 because 7 * 2 = 14, remainder = 5. So initial slot is index ${initialIndex}.`,
          unlockedBreadcrumbText: "Primary slot verified. Probing algorithm unlocked.",
          variantTemplate: {
            type: "NUMERIC_PARAMETRIC" as const,
            templateKey: "HASH_DIVISION",
            templateText: `For a hash table of capacity m = 7 and key k = {key}, what is the initial hash index computed by h(k) = k mod 7? Enter the single digit index.`,
            parameterRanges: { key: [17, 19, 23, 25, 26, 29, 31, 33, 37, 41, 43] },
            formula: "key % 7",
            explanationTemplate: `The primary hash slot is h({key}) = {key} mod 7 = {answer}.`,
          },
        },
        ...(stageCount > 1
          ? [
              {
                stageOrder: 2,
                title: "Stage 2: Linear Probing Resolution",
                clueText: `If slot index ${initialIndex} is already occupied by an earlier entry, which index does linear probing h'(k, i) = (h(k) + i) mod ${tableSize} test on the FIRST collision step (i = 1)?`,
                verificationType: "NUMERIC_CALCULATION" as const,
                expectedAnswer: String((initialIndex + 1) % tableSize),
                acceptableAnswers: [String((initialIndex + 1) % tableSize)],
                numericTolerance: 0,
                hintText: `Compute (${initialIndex} + 1) mod ${tableSize}.`,
                explanation: `Linear probing steps to the next contiguous slot: (${initialIndex} + 1) mod 7 = ${(initialIndex + 1) % tableSize}.`,
                unlockedBreadcrumbText: "Collision resolved. Hash table insertion complete.",
                variantTemplate: {
                  type: "NUMERIC_PARAMETRIC" as const,
                  templateKey: "HASH_PROBING",
                  templateText: `If slot index {initialIndex} is already occupied by an earlier entry, which index does linear probing h'(k, i) = (h(k) + i) mod 7 test on the FIRST collision step (i = 1)?`,
                  parameterRanges: { key: [17, 19, 23, 25, 26, 29, 31, 33, 37, 41, 43] },
                  formula: "(key % 7 + 1) % 7",
                  explanationTemplate: `Linear probing steps to the next contiguous slot: ({initialIndex} + 1) mod 7 = {answer}.`,
                },
              },
            ]
          : []),
      ],
    };
  }
}

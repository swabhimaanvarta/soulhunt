/**
 * AIEM Hunt — AI Provider & Generation Engine
 * 
 * Multi-provider abstraction:
 * 1. Google Gemini API (if GEMINI_API_KEY is defined)
 * 2. OpenAI API (if OPENAI_API_KEY is defined)
 * 3. Deterministic Local Challenge Generator (Zero-dependency fallback)
 */

import {
  QuestTemplate,
  getRandomChallengeTemplate,
  CAMPUS_QUEST_TEMPLATES,
} from "@/lib/content/challengeTemplates";
import { validateQuestSafety } from "./safetyValidator";

export interface GenerateQuestOptions {
  theme?: string;
  difficulty?: number;
  questType?: "CAMPUS_TREASURE" | "DAILY_HUNT" | "MYSTERY" | "LEGENDARY" | "SQUAD_HUNT";
  locationName?: string;
  locationCode?: string;
  stageCount?: number;
}

export interface GeneratedQuestOutput {
  source: "AI_GEMINI" | "AI_OPENAI" | "TEMPLATE";
  template: QuestTemplate;
  modelName?: string;
}

export async function generateCampusQuest(
  options: GenerateQuestOptions = {}
): Promise<GeneratedQuestOutput> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  // 1. Try Google Gemini if configured
  if (geminiKey) {
    try {
      const result = await generateWithGemini(geminiKey, options);
      if (result) return result;
    } catch (err) {
      console.warn("[AIGameMaster] Gemini generation failed, trying fallbacks:", err);
    }
  }

  // 2. Try OpenAI if configured
  if (openAiKey) {
    try {
      const result = await generateWithOpenAI(openAiKey, options);
      if (result) return result;
    } catch (err) {
      console.warn("[AIGameMaster] OpenAI generation failed, trying fallbacks:", err);
    }
  }

  // 3. Deterministic Local Fallback (Guaranteed reliability)
  const template = getRandomChallengeTemplate(options.theme, options.difficulty);
  if (options.questType) template.questType = options.questType;
  if (options.locationCode) template.locationCode = options.locationCode;

  return {
    source: "TEMPLATE",
    template,
    modelName: "deterministic-campus-engine-v1",
  };
}

async function generateWithGemini(
  apiKey: string,
  options: GenerateQuestOptions
): Promise<GeneratedQuestOutput | null> {
  const prompt = buildQuestPrompt(options);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed: QuestTemplate = JSON.parse(rawText);
    const safety = validateQuestSafety(parsed);
    if (!safety.isSafe) {
      console.warn("[AIGameMaster] Gemini generation failed safety check:", safety.violations);
      return null;
    }

    return {
      source: "AI_GEMINI",
      template: parsed,
      modelName: "gemini-1.5-flash",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateWithOpenAI(
  apiKey: string,
  options: GenerateQuestOptions
): Promise<GeneratedQuestOutput | null> {
  const prompt = buildQuestPrompt(options);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are the AI Game Master for AIEM Hunt, an educational campus treasure hunt and mystery platform. Return strictly valid JSON conforming to the requested schema. Never reference real personal valuables or dangerous electrical/construction areas.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) return null;

    const parsed: QuestTemplate = JSON.parse(rawText);
    const safety = validateQuestSafety(parsed);
    if (!safety.isSafe) return null;

    return {
      source: "AI_OPENAI",
      template: parsed,
      modelName: "gpt-4o-mini",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildQuestPrompt(options: GenerateQuestOptions): string {
  const stageCount = options.stageCount || (options.difficulty && options.difficulty > 3 ? 3 : 2);
  const theme = options.theme || "CAMPUS_MYSTERY";
  const difficulty = options.difficulty || 3;
  const locationCode = options.locationCode || "LIB-01";

  return `
Create a compelling campus mystery quest for AIEM college students.
Theme: ${theme}
Target Difficulty: ${difficulty} (out of 5)
Location Code: ${locationCode}
Stage Count: ${stageCount}

JSON Schema required:
{
  "title": "string",
  "description": "string (engaging storyline briefing)",
  "theme": "${theme}",
  "questType": "${options.questType || "CAMPUS_TREASURE"}",
  "difficulty": ${difficulty},
  "locationCode": "${locationCode}",
  "xpReward": ${difficulty * 75},
  "coinReward": ${difficulty * 15},
  "squadXpReward": ${difficulty * 25},
  "clues": [
    {
      "stageOrder": 1,
      "title": "Stage 1: ...",
      "clueText": "Educational, cryptographic, campus lore, or math/science riddle",
      "verificationType": "TEXT_RIDDLE",
      "expectedAnswer": "concise lowercase single word or number (e.g. 'aiem' or '42')",
      "hintText": "Helpful guiding clue for stuck players",
      "hintCoinCost": 10,
      "unlockedBreadcrumbText": "Narrative milestone unlocked"
    }
  ]
}
Rules:
1. Answer must be normalized (1-2 words or digits, easy to verify).
2. Clues must be safe, friendly to college engineering students.
3. Absolutely NO references to tampering with real personal belongings or restricted areas.
`;
}


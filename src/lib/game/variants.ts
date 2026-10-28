/**
 * AIEM Hunt — Per-Player / Per-Squad Clue Variant Engine
 * 
 * Generates individualized question variants from approved curriculum templates:
 * 1. Cryptographically keyed seed derivation using HMAC-SHA256 with server-secret.
 *    - Squad investigations share identical team variants so squads can collaborate.
 *    - Solo investigations receive individual distinct variants.
 * 2. Uses structured variantTemplate data to generate prompts and answers together.
 *    - No brittle regex string guessing on arbitrary text.
 *    - Unconfigured or unsupported clues keep their original base text and answers.
 * 3. Randomizes multiple-choice option order per player/squad while grading by stable option identity.
 * 4. Keeps expected answers strictly server-side associated with the player's investigation.
 */

import crypto from "crypto";
import { Types } from "mongoose";

export interface StageVariantDoc {
  stageOrder: number;
  clueId: Types.ObjectId;
  customClueText: string;
  customExpectedAnswer: string;
  acceptableAnswers?: string[];
  numericTolerance?: number;
  options?: Array<{ id: string; text: string }>;
  explanation?: string;
}

export interface VariantContext {
  userId?: Types.ObjectId | string;
  investigationId?: Types.ObjectId | string;
  squadId?: Types.ObjectId | string | null;
  isSquadInvestigation?: boolean;
}

/**
 * Cryptographic server-secret keyed seed derivation using HMAC-SHA256.
 * Guarantees that seed derivation cannot be reverse-engineered by clients.
 */
export function deriveVariantSeed(
  context: VariantContext | string,
  clueId: string,
  secret = process.env.VARIANT_SECRET || process.env.JWT_SECRET || "aiem-hunt-server-variant-secret-seed-2026"
): number {
  let contextKey: string;
  if (typeof context === "string") {
    contextKey = context;
  } else if (context.isSquadInvestigation && context.squadId) {
    // Squad Investigation: All members of the squad share the exact same team variant
    // so they can collaborate on identical problem parameters.
    contextKey = `squad:${context.squadId.toString()}`;
  } else {
    // Solo Investigation: Individual student gets a unique variant seed keyed to their account.
    const userStr = context.userId ? context.userId.toString() : "anon";
    const invStr = context.investigationId ? `:${context.investigationId.toString()}` : "";
    contextKey = `solo:${userStr}${invStr}`;
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${contextKey}:${clueId}`);
  const digest = hmac.digest();
  // Read positive 32-bit unsigned integer from the HMAC-SHA256 digest
  return digest.readUInt32BE(0);
}

/**
 * Deterministic Fisher-Yates shuffle using pseudo-random linear congruential steps seeded by HMAC.
 */
function shuffleWithOptions<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let currentSeed = seed;
  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Creates per-player / per-squad variants for a given set of clues.
 */
export function createPlayerClueVariants(
  clues: any[],
  context: VariantContext | Types.ObjectId | string
): StageVariantDoc[] {
  const ctx: VariantContext =
    typeof context === "string" || context instanceof Types.ObjectId
      ? { userId: context }
      : context;

  const variants: StageVariantDoc[] = [];

  for (const clue of clues) {
    const clueIdStr = (clue._id || clue.id || "").toString();
    const seed = deriveVariantSeed(ctx, clueIdStr);
    const stageOrder = clue.stageOrder;

    let customClueText = clue.clueText;
    let customExpectedAnswer = clue.expectedAnswerNormalized || clue.expectedAnswer || "";
    let acceptableAnswers = Array.isArray(clue.acceptableAnswers) ? [...clue.acceptableAnswers] : [];
    let numericTolerance = clue.numericTolerance || 0;
    let options = clue.options ? [...clue.options] : [];
    let explanation = clue.explanation || "";

    const template = clue.variantTemplate;

    // 1. Structured Parameterized Numeric Calculations
    // Grounded strictly in structured variantTemplate data rather than brittle regex text guessing
    if (
      clue.verificationType === "NUMERIC_CALCULATION" &&
      template &&
      template.type === "NUMERIC_PARAMETRIC" &&
      template.templateKey
    ) {
      const templateKey = template.templateKey.toUpperCase();

      // Case A: Nyquist Sampling Frequency
      if (templateKey === "NYQUIST_SAMPLING") {
        const candidateFrequencies = [2500, 3200, 4000, 4800, 5000, 6000, 7500, 8000];
        const selectedFmax = candidateFrequencies[seed % candidateFrequencies.length];
        const nyquistRate = 2 * selectedFmax;

        const baseTemplate = template.templateText || clue.clueText;
        customClueText = baseTemplate.replace("{fmax}", String(selectedFmax));
        customExpectedAnswer = String(nyquistRate);
        acceptableAnswers = [String(nyquistRate), `${nyquistRate}hz`, `${nyquistRate} hz`];
        numericTolerance = 0;

        const explTemplate =
          template.explanationTemplate ||
          "The Nyquist rate is calculated as fs = 2 * fmax = 2 * {fmax} = {answer} Hz. Any lower rate causes spectral folding/aliasing.";
        explanation = explTemplate
          .replace("{fmax}", String(selectedFmax))
          .replace("{answer}", String(nyquistRate));
      }
      // Case B: Hash Table Modulo Indexing
      else if (templateKey === "HASH_DIVISION") {
        const candidateKeys = [17, 19, 23, 25, 26, 29, 31, 33, 37, 41, 43];
        const selectedKey = candidateKeys[seed % candidateKeys.length];
        const tableSize = 7;
        const initialIndex = selectedKey % tableSize;

        const baseTemplate = template.templateText || clue.clueText;
        customClueText = baseTemplate.replace("{key}", String(selectedKey));
        customExpectedAnswer = String(initialIndex);
        acceptableAnswers = [String(initialIndex), `index ${initialIndex}`, `slot ${initialIndex}`];
        numericTolerance = 0;

        const explTemplate =
          template.explanationTemplate ||
          "The primary hash slot is h({key}) = {key} mod 7 = {answer}.";
        explanation = explTemplate
          .replace("{key}", String(selectedKey))
          .replace("{answer}", String(initialIndex));
      }
      // Case C: Hash Table Linear Probing
      else if (templateKey === "HASH_PROBING") {
        const candidateKeys = [17, 19, 23, 25, 26, 29, 31, 33, 37, 41, 43];
        const selectedKey = candidateKeys[seed % candidateKeys.length];
        const tableSize = 7;
        const initialIndex = selectedKey % tableSize;
        const nextIndex = (initialIndex + 1) % tableSize;

        const baseTemplate = template.templateText || clue.clueText;
        customClueText = baseTemplate
          .replace("{initialIndex}", String(initialIndex))
          .replace("{key}", String(selectedKey));
        customExpectedAnswer = String(nextIndex);
        acceptableAnswers = [String(nextIndex), `index ${nextIndex}`, `slot ${nextIndex}`];
        numericTolerance = 0;

        const explTemplate =
          template.explanationTemplate ||
          "Linear probing steps to the next contiguous slot: ({initialIndex} + 1) mod 7 = {answer}.";
        explanation = explTemplate
          .replace("{initialIndex}", String(initialIndex))
          .replace("{answer}", String(nextIndex));
      }
      // Case D: RSA Modulus
      else if (templateKey === "RSA_MODULUS") {
        const primePairs = [
          [5, 11],
          [7, 11],
          [7, 13],
          [5, 13],
          [11, 13],
          [3, 17],
        ];
        const pair = primePairs[seed % primePairs.length];
        const p = pair[0];
        const q = pair[1];
        const n = p * q;

        const baseTemplate = template.templateText || clue.clueText;
        customClueText = baseTemplate.replace("{p}", String(p)).replace("{q}", String(q));
        customExpectedAnswer = String(n);
        acceptableAnswers = [String(n)];
        numericTolerance = 0;

        const explTemplate =
          template.explanationTemplate || "The RSA modulus is n = {p} * {q} = {answer}.";
        explanation = explTemplate
          .replace("{p}", String(p))
          .replace("{q}", String(q))
          .replace("{answer}", String(n));
      }
      // Case E: RSA Euler Totient
      else if (templateKey === "RSA_TOTIENT") {
        const primePairs = [
          [5, 11],
          [7, 11],
          [7, 13],
          [5, 13],
          [11, 13],
          [3, 17],
        ];
        const pair = primePairs[seed % primePairs.length];
        const p = pair[0];
        const q = pair[1];
        const phi = (p - 1) * (q - 1);

        const baseTemplate = template.templateText || clue.clueText;
        customClueText = baseTemplate.replace("{p}", String(p)).replace("{q}", String(q));
        customExpectedAnswer = String(phi);
        acceptableAnswers = [String(phi)];
        numericTolerance = 0;

        const explTemplate =
          template.explanationTemplate ||
          "Euler totient phi(n) = ({p} - 1) * ({q} - 1) = {answer}.";
        explanation = explTemplate
          .replace("{p}", String(p))
          .replace("{q}", String(q))
          .replace("{answer}", String(phi));
      }
    }

    // 2. Randomized Multiple Choice Option Ordering
    if (clue.verificationType === "MULTIPLE_CHOICE" && options.length > 0) {
      options = shuffleWithOptions(options, seed);
      if (clue.correctOptionId) {
        customExpectedAnswer = clue.correctOptionId;
        acceptableAnswers = [clue.correctOptionId];
      }
    }

    // 3. Clues without a supported variantTemplate remain unchanged as the base clue
    variants.push({
      stageOrder,
      clueId: clue._id as Types.ObjectId,
      customClueText,
      customExpectedAnswer,
      acceptableAnswers,
      numericTolerance,
      options,
      explanation,
    });
  }

  return variants;
}

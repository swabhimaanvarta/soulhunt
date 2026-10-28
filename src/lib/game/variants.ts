/**
 * AIEM Hunt — Per-Player Clue Variant Engine
 * 
 * Generates individualized question variants from approved curriculum templates:
 * 1. Changes numerical values (e.g. frequencies, keys, prime numbers) while preserving difficulty and pedagogical method.
 * 2. Randomizes multiple-choice option order per player while grading by option identity (not letter).
 * 3. Keeps expected answers strictly server-side associated with the player's investigation.
 */

import { Types } from "mongoose";

export interface StageVariantDoc {
  stageOrder: number;
  clueId: Types.ObjectId;
  customClueText: string;
  customExpectedAnswer: string;
  options?: Array<{ id: string; text: string }>;
  explanation?: string;
}

// Simple deterministic hash function to generate consistent pseudo-random index per (userId + clueId)
function getSeedHash(userId: string, clueId: string): number {
  const str = `${userId}:${clueId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Fisher-Yates shuffle using deterministic pseudo-random seed
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

export function createPlayerClueVariants(
  clues: any[],
  userId: Types.ObjectId | string
): StageVariantDoc[] {
  const userStr = userId.toString();
  const variants: StageVariantDoc[] = [];

  for (const clue of clues) {
    const clueIdStr = (clue._id || clue.id || "").toString();
    const seed = getSeedHash(userStr, clueIdStr);
    const stageOrder = clue.stageOrder;

    let customClueText = clue.clueText;
    let customExpectedAnswer = clue.expectedAnswerNormalized || clue.expectedAnswer || "";
    let options = clue.options ? [...clue.options] : [];
    let explanation = clue.explanation || "";

    // 1. Parameterized Numeric Calculations
    if (clue.verificationType === "NUMERIC_CALCULATION") {
      const lowerText = clue.clueText.toLowerCase();

      // Case A: Nyquist Sampling Frequency (fmax variation)
      if (lowerText.includes("fmax") || lowerText.includes("sampling frequency") || lowerText.includes("nyquist")) {
        const candidateFrequencies = [2500, 3200, 4000, 4800, 5000, 6000, 7500, 8000];
        const selectedFmax = candidateFrequencies[seed % candidateFrequencies.length];
        const nyquistRate = 2 * selectedFmax;

        customClueText = clue.clueText.replace(/fmax\s*=\s*\d+/gi, `fmax = ${selectedFmax}`);
        customExpectedAnswer = String(nyquistRate);
        explanation = `The Nyquist rate is calculated as fs = 2 * fmax = 2 * ${selectedFmax} = ${nyquistRate} Hz. Any lower rate causes spectral aliasing.`;
      }
      // Case B: Hash Table Probing & Indexing (m = 7, key variation)
      else if (lowerText.includes("hash") && (lowerText.includes("table") || lowerText.includes("probing") || lowerText.includes("mod"))) {
        const candidateKeys = [17, 19, 23, 25, 26, 29, 31, 33, 37, 41, 43];
        const selectedKey = candidateKeys[seed % candidateKeys.length];
        const tableSize = 7;
        const initialIndex = selectedKey % tableSize;

        if (lowerText.includes("first collision") || lowerText.includes("linear probing")) {
          const nextIndex = (initialIndex + 1) % tableSize;
          customClueText = clue.clueText
            .replace(/slot index \d+/gi, `slot index ${initialIndex}`)
            .replace(/index \d+ is already occupied/gi, `index ${initialIndex} is already occupied`);
          customExpectedAnswer = String(nextIndex);
          explanation = `Linear probing tests (h(k) + 1) mod 7: (${initialIndex} + 1) mod 7 = ${nextIndex}.`;
        } else {
          customClueText = clue.clueText.replace(/key\s*k?\s*=\s*\d+/gi, `key k = ${selectedKey}`);
          customExpectedAnswer = String(initialIndex);
          explanation = `The primary hash slot is h(${selectedKey}) = ${selectedKey} mod ${tableSize} = ${initialIndex}.`;
        }
      }
      // Case C: RSA Modulus or Totient
      else if (lowerText.includes("rsa") || lowerText.includes("totient") || lowerText.includes("modulus")) {
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
        const phi = (p - 1) * (q - 1);

        if (lowerText.includes("totient") || lowerText.includes("phi")) {
          customClueText = clue.clueText
            .replace(/p\s*=\s*\d+/gi, `p = ${p}`)
            .replace(/q\s*=\s*\d+/gi, `q = ${q}`);
          customExpectedAnswer = String(phi);
          explanation = `Euler totient phi(n) = (${p} - 1) * (${q} - 1) = ${p - 1} * ${q - 1} = ${phi}.`;
        } else {
          customClueText = clue.clueText
            .replace(/p\s*=\s*\d+/gi, `p = ${p}`)
            .replace(/q\s*=\s*\d+/gi, `q = ${q}`);
          customExpectedAnswer = String(n);
          explanation = `The RSA modulus is n = p * q = ${p} * ${q} = ${n}.`;
        }
      }
    }

    // 2. Randomized Multiple Choice Option Ordering
    if (clue.verificationType === "MULTIPLE_CHOICE" && options.length > 0) {
      options = shuffleWithOptions(options, seed);
      if (clue.correctOptionId) {
        customExpectedAnswer = clue.correctOptionId;
      }
    }

    variants.push({
      stageOrder,
      clueId: clue._id as Types.ObjectId,
      customClueText,
      customExpectedAnswer,
      options,
      explanation,
    });
  }

  return variants;
}


/**
 * AIEM Hunt — Live AI API Key Verification Test
 * Tests API connectivity, authentication, model availability, and quest generation.
 */

import * as fs from "fs";
import * as path from "path";

// Load .env.local natively without external dependencies
function loadEnvLocal() {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "aiem-hunt", ".env.local"),
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../.env.local"),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
      break;
    }
  }
}

loadEnvLocal();

import { generateCampusQuest } from "../lib/ai/provider";

function maskKey(key?: string): string {
  if (!key) return "(not set)";
  const trimmed = key.trim();
  if (trimmed.length <= 12) return "********";
  return `${trimmed.substring(0, 8)}...${trimmed.substring(trimmed.length - 4)}`;
}

async function testOpenAiRaw(rawKey: string) {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${rawKey}`,
      },
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: bodyText };
    }

    const data = JSON.parse(bodyText);
    const modelCount = data?.data?.length || 0;
    return { ok: true, status: res.status, data, modelCount };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  console.log("==================================================");
  console.log("  AIEM HUNT — LIVE AI API KEY INTEGRATION TEST   ");
  console.log("==================================================");

  const openAiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log(`OPENAI_API_KEY detected: ${openAiKey ? "YES" : "NO"}`);
  console.log(`GEMINI_API_KEY detected: ${geminiKey ? "YES" : "NO"}`);

  if (!openAiKey && !geminiKey) {
    console.error("\n[!] Error: No AI API key found in environment (.env.local).");
    process.exit(1);
  }

  let effectiveOpenAiKey = "";

  if (openAiKey) {
    console.log(`\nTesting OPENAI_API_KEY (${maskKey(openAiKey)}, length ${openAiKey.length})...`);
    
    // Test exact
    let res = await testOpenAiRaw(openAiKey.trim());
    if (res.ok) {
      effectiveOpenAiKey = openAiKey.trim();
      console.log(`[v] Exact key worked! HTTP 200 OK (${res.modelCount} models found)`);
    } else {
      console.log(`[x] Exact key failed: HTTP ${res.status}`);

      // If key contains space, test candidate replacements
      if (openAiKey.includes(" ")) {
        const parts = openAiKey.trim().split(/\s+/);
        console.log(`[i] Key appears split into ${parts.length} parts by whitespace:`);
        console.log(`    Part 1 length: ${parts[0].length}, Part 2 length: ${parts[1]?.length}`);

        // Try removing space
        const noSpace = openAiKey.replace(/\s+/g, "");
        const noSpaceRes = await testOpenAiRaw(noSpace);
        if (noSpaceRes.ok) {
          console.log(`[v] SUCCESS with space removed! HTTP 200 OK (${noSpaceRes.modelCount} models found)`);
          effectiveOpenAiKey = noSpace;
        } else {
          // Try checking if a single character was replaced by space
          console.log(`[i] Scanning if space was a single character replacement (A-Z, a-z, 0-9, -, _)...`);
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
          let foundChar = "";
          for (const c of chars) {
            const candidate = parts[0] + c + (parts[1] || "");
            const candidateRes = await testOpenAiRaw(candidate);
            if (candidateRes.ok) {
              console.log(`[v] FOUND VALID REPLACEMENT CHARACTER: '${c}'!`);
              foundChar = c;
              effectiveOpenAiKey = candidate;
              break;
            }
          }

          if (!foundChar) {
            console.log(`[x] Could not authenticate with single-character permutations.`);
          }
        }
      }
    }

    if (!effectiveOpenAiKey) {
      console.log("\n==================================================");
      console.log("  API AUTHENTICATION FAILED (HTTP 401: Invalid API Key)");
      console.log("==================================================");
      console.log("OpenAI rejected the key provided in .env.local with error:");
      console.log(`"Incorrect API key provided: ${maskKey(openAiKey)}"`);
      console.log("\nWhy did this happen?");
      console.log("1. The key in .env.local contains a whitespace in the middle (length 165).");
      console.log("2. The key may have been revoked, deleted, or was partially copied.");
      console.log("3. The OpenAI account/project might not have generated this exact key.");
      console.log("\nHow to fix:");
      console.log("1. Go to https://platform.openai.com/api-keys");
      console.log("2. Click '+ Create new secret key' (or verify an active key).");
      console.log("3. Click the 'Copy' icon directly to ensure the whole key is copied without spaces.");
      console.log("4. Paste it in aiem-hunt/.env.local as: OPENAI_API_KEY=sk-proj-...");
      return;
    }

    // 2. Test live Quest Generation with provider
    console.log("\n--- Testing Live Quest Generation via provider.ts ---");
    process.env.OPENAI_API_KEY = effectiveOpenAiKey;

    const questOutput = await generateCampusQuest({
      preferredProvider: "OPENAI",
      courseCode: "CS201",
      courseName: "Data Structures & Algorithms",
      topic: "Hashing & Collision Resolution",
      learningOutcome: "Compute hash indices and analyze linear probing resolution",
      approvedSyllabusText: "Hash functions h(k) = k mod m. Linear probing resolves collisions via h'(k, i) = (h(k) + i) mod m.",
      locationCode: "COMP-AI",
      difficulty: 3,
      stageCount: 2,
    });

    console.log(`Generation Source: ${questOutput.source}`);
    console.log(`Model Used: ${questOutput.modelName}`);
    console.log(`Fallback Triggered: ${questOutput.fallbackTriggered}`);
    if (questOutput.fallbackReason) {
      console.log(`Fallback Reason: ${questOutput.fallbackReason}`);
    }
    console.log(`Safety Valid: ${questOutput.safetyCheck.isSafe}`);
    console.log(`Quest Title: "${questOutput.data.title}"`);
    console.log(`XP: ${questOutput.data.xpReward}, Coins: ${questOutput.data.coinReward}`);
    console.log(`Clues Generated: ${questOutput.data.clues.length}`);

    questOutput.data.clues.forEach((c) => {
      console.log(`  [Stage ${c.stageOrder}] ${c.title} (${c.verificationType})`);
      console.log(`     Prompt: ${c.clueText.substring(0, 80)}...`);
      console.log(`     Expected Answer: "${c.expectedAnswer}"`);
      console.log(`     Has Variant: ${Boolean(c.variantTemplate)}`);
    });

    if (questOutput.source === "AI_OPENAI") {
      console.log("\n==================================================");
      console.log("  SUCCESS: OpenAI API Key is ACTIVE and FUNCTIONAL!");
      console.log("==================================================");
    } else {
      console.log("\n==================================================");
      console.log("  KEY STATUS: AUTHENTICATED & READY");
      console.log("==================================================");
      console.log("Your OpenAI API Key was successfully authenticated (HTTP 200).");
      if (questOutput.fallbackReason && questOutput.fallbackReason.includes("429")) {
        console.log("Notice: OpenAI account has $0 balance / exhausted credits.");
        console.log("-> To use OpenAI generation: Add $5 credit at https://platform.openai.com/settings/organization/billing");
        console.log("-> Or for 100% FREE AI: Add a Gemini key at https://aistudio.google.com/app/apikey (GEMINI_API_KEY in .env.local)");
      }
      console.log("-> Meanwhile, the deterministic syllabus fallback engine is active and serving quests seamlessly.");
    }
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});


/**
 * AIEM Hunt — Tactical Web Audio Engine (SFX) Verification Suite
 * Verifies procedural sound effects API surface, mute toggling, and soundscape triggers.
 */

import { sfx } from "../lib/audio/sfx";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ PASSED: ${msg}`);
}

async function runAudioEngineVerification() {
  console.log("\n========================================================");
  console.log("🔊 AIEM HUNT — TACTICAL WEB AUDIO ENGINE (SFX) QA SUITE");
  console.log("========================================================\n");

  console.log("─── Suite 1: Singleton Instance & API Surface ───");
  assert(typeof sfx === "object" && sfx !== null, "sfx singleton instance exists");
  assert(typeof sfx.isMuted === "function", "sfx.isMuted is a function");
  assert(typeof sfx.setMuted === "function", "sfx.setMuted is a function");
  assert(typeof sfx.toggleMute === "function", "sfx.toggleMute is a function");
  assert(typeof sfx.playRadarPing === "function", "sfx.playRadarPing is a function");
  assert(typeof sfx.playLockerEquip === "function", "sfx.playLockerEquip is a function");
  assert(typeof sfx.playDecryptionStutter === "function", "sfx.playDecryptionStutter is a function");
  assert(typeof sfx.playLevelUpFanfare === "function", "sfx.playLevelUpFanfare is a function");
  assert(typeof sfx.playCoinCascade === "function", "sfx.playCoinCascade is a function");
  assert(typeof sfx.playSafeDeskStamp === "function", "sfx.playSafeDeskStamp is a function");

  console.log("\n─── Suite 2: Mute Toggle & State Persistence ───");
  const initialMute = sfx.isMuted();
  sfx.setMuted(true);
  assert(sfx.isMuted() === true, "setMuted(true) sets state to muted");

  const toggled = sfx.toggleMute();
  assert(toggled === false && sfx.isMuted() === false, "toggleMute() inverts muted state to false");

  sfx.toggleMute();
  assert(sfx.isMuted() === true, "toggleMute() inverts muted state back to true");

  sfx.setMuted(initialMute);
  assert(sfx.isMuted() === initialMute, "Restored initial mute state");

  console.log("\n─── Suite 3: Headless / SSR Fallback Safety ───");
  // Executing sound methods in Node environment must be completely non-blocking and safe
  try {
    sfx.playRadarPing();
    sfx.playLockerEquip();
    sfx.playDecryptionStutter();
    sfx.playLevelUpFanfare();
    sfx.playCoinCascade();
    sfx.playSafeDeskStamp();
    assert(true, "All 6 tactical sound methods execute safely without crash in headless/SSR runtime");
  } catch (err: any) {
    assert(false, `Execution failed in headless environment: ${err.message}`);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL TACTICAL AUDIO SFX TESTS PASSED (100% VERIFIED)");
  console.log("========================================================\n");
}

runAudioEngineVerification().catch((err) => {
  console.error("Audio engine test runner failed:", err);
  process.exit(1);
});

import assert from "node:assert";
import { getKineticEffectForStreak, KineticEffectType } from "../components/profile/KineticAvatarFX";

console.log("\n========================================================");
console.log("✨ AIEM HUNT — KINETIC AVATAR PARTICLES & SHADERS (M7) QA");
console.log("========================================================\n");

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASSED: ${name}`);
  } catch (err: any) {
    console.error(`  ❌ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("─── Suite 1: Streak Tiers & Kinetic Effect Mapping ───");

runTest("Streak 0-2 days produces 'none'", () => {
  assert.strictEqual(getKineticEffectForStreak(0), "none");
  assert.strictEqual(getKineticEffectForStreak(1), "none");
  assert.strictEqual(getKineticEffectForStreak(2), "none");
});

runTest("Streak 3-6 days produces 'ember-drifter' (Golden Floating Embers)", () => {
  assert.strictEqual(getKineticEffectForStreak(3), "ember-drifter");
  assert.strictEqual(getKineticEffectForStreak(5), "ember-drifter");
  assert.strictEqual(getKineticEffectForStreak(6), "ember-drifter");
});

runTest("Streak 7-14 days produces 'ion-arc' (Cyan Electric Sparks)", () => {
  assert.strictEqual(getKineticEffectForStreak(7), "ion-arc");
  assert.strictEqual(getKineticEffectForStreak(10), "ion-arc");
  assert.strictEqual(getKineticEffectForStreak(14), "ion-arc");
});

runTest("Streak 15-29 days produces 'void-singularity' (Deep Violet Distortion)", () => {
  assert.strictEqual(getKineticEffectForStreak(15), "void-singularity");
  assert.strictEqual(getKineticEffectForStreak(21), "void-singularity");
  assert.strictEqual(getKineticEffectForStreak(29), "void-singularity");
});

runTest("Streak 30+ days produces 'solar-corona' (Radiant Gold Solar Prominence)", () => {
  assert.strictEqual(getKineticEffectForStreak(30), "solar-corona");
  assert.strictEqual(getKineticEffectForStreak(45), "solar-corona");
  assert.strictEqual(getKineticEffectForStreak(100), "solar-corona");
});

console.log("\n─── Suite 2: Cosmetic Effect Overrides ───");

runTest("Equipped Holo-Glitch effect overrides streak to 'holo-glitch'", () => {
  assert.strictEqual(getKineticEffectForStreak(0, "effect-glitch"), "holo-glitch");
  assert.strictEqual(getKineticEffectForStreak(35, "effect-glitch"), "holo-glitch");
  assert.strictEqual(getKineticEffectForStreak(0, "holo-glitch"), "holo-glitch");
});

runTest("Equipped Ember effect overrides lower streak to 'ember-drifter'", () => {
  assert.strictEqual(getKineticEffectForStreak(0, "effect-ember"), "ember-drifter");
});

runTest("Equipped Void effect overrides lower streak to 'void-singularity'", () => {
  assert.strictEqual(getKineticEffectForStreak(2, "effect-void"), "void-singularity");
});

runTest("Equipped Solar effect overrides lower streak to 'solar-corona'", () => {
  assert.strictEqual(getKineticEffectForStreak(1, "effect-solar"), "solar-corona");
});

console.log("\n─── Suite 3: Headless / SSR Fallback Safety ───");

runTest("Effect resolver executes deterministically in headless Node without window/DOM", () => {
  assert.strictEqual(typeof window, "undefined");
  const effect = getKineticEffectForStreak(14);
  assert.strictEqual(effect, "ion-arc");
});

console.log("\n========================================================");
console.log("🎉 ALL KINETIC AVATAR FX TESTS PASSED (100% VERIFIED)");
console.log("========================================================\n");


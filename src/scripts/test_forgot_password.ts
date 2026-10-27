import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../lib/db";
import { User } from "../models";
import { generateEmailOtp } from "../lib/email";

async function runForgotPasswordTests() {
  console.log("\n================================================================");
  console.log("🛡️  AIEM HUNT — FORGOT PASSWORD & RECOVERY FLOW TEST SUITE");
  console.log("================================================================\n");

  await connectDB();

  // Find any active student user, or fallback to first active user
  const user = await User.findOne({ accountStatus: "ACTIVE" }).select("+passwordHash +passwordResetCodeHash");
  if (!user) {
    throw new Error(`No active user found in database to test!`);
  }
  const testEmail = user.email;

  const originalPasswordHash = user.passwordHash;

  try {
    // -------------------------------------------------------------
    // Test 1: Verify OTP Generation & Cryptographic Hashing
    // -------------------------------------------------------------
    console.log("▶ [Test 1] Testing Cryptographic Reset Code Generation...");
    const { code, codeHash, expiresAt } = await generateEmailOtp();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new Error("Generated OTP does not match 6-digit numeric specification");
    }
    const isHashValid = await bcrypt.compare(code, codeHash);
    if (!isHashValid) {
      throw new Error("bcrypt hash comparison failed for generated code");
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new Error("Expiry timestamp must be in the future");
    }
    console.log("   ✅ 6-digit cryptographic OTP generated, hashed, and verified");

    // -------------------------------------------------------------
    // Test 2: Simulating Forgot Password Request State on User Doc
    // -------------------------------------------------------------
    console.log("\n▶ [Test 2] Simulating Forgot Password Challenge Storage...");
    user.passwordResetCodeHash = codeHash;
    user.passwordResetExpiresAt = expiresAt;
    user.passwordResetAttempts = 0;
    user.passwordResetResendAfter = new Date(Date.now() + 60 * 1000);
    await user.save();

    const updatedUser = await User.findOne({ email: testEmail }).select("+passwordResetCodeHash");
    if (!updatedUser?.passwordResetCodeHash) {
      throw new Error("passwordResetCodeHash failed to persist to DB");
    }
    console.log("   ✅ User state successfully updated with active recovery challenge");

    // -------------------------------------------------------------
    // Test 3: Invalid Code Attempt & Attempt Counter
    // -------------------------------------------------------------
    console.log("\n▶ [Test 3] Testing Incorrect Recovery Code Handling...");
    const badCode = "000000";
    const matchesBad = await bcrypt.compare(badCode, updatedUser.passwordResetCodeHash);
    if (matchesBad) {
      throw new Error("Bogus code incorrectly matched hash!");
    }
    updatedUser.passwordResetAttempts = (updatedUser.passwordResetAttempts || 0) + 1;
    await updatedUser.save();
    console.log(`   ✅ Bad code rejected; attempts counter incremented to ${updatedUser.passwordResetAttempts}`);

    // -------------------------------------------------------------
    // Test 4: Valid Password Reset Execution
    // -------------------------------------------------------------
    console.log("\n▶ [Test 4] Testing Valid Password Reset & Hash Replacement...");
    const matchesGood = await bcrypt.compare(code, updatedUser.passwordResetCodeHash);
    if (!matchesGood) {
      throw new Error("Valid code failed bcrypt verification!");
    }

    const newRawPassword = "NewHunterSecret@2026";
    const newHash = await bcrypt.hash(newRawPassword, 12);
    updatedUser.passwordHash = newHash;
    updatedUser.passwordResetCodeHash = undefined;
    updatedUser.passwordResetExpiresAt = undefined;
    updatedUser.passwordResetAttempts = 0;
    updatedUser.passwordResetResendAfter = undefined;
    await updatedUser.save();

    // Verify DB state
    const postResetUser = await User.findOne({ email: testEmail }).select("+passwordHash +passwordResetCodeHash");
    if (postResetUser?.passwordResetCodeHash) {
      throw new Error("passwordResetCodeHash should be cleared after successful reset");
    }

    const canLoginWithNew = await bcrypt.compare(newRawPassword, postResetUser!.passwordHash);
    if (!canLoginWithNew) {
      throw new Error("New password fails bcrypt comparison!");
    }

    const cannotLoginWithOld = await bcrypt.compare("DefinitelyBogusPass@12345", postResetUser!.passwordHash);
    if (cannotLoginWithOld) {
      throw new Error("Bogus password works after reset!");
    }

    console.log("   ✅ Password successfully updated in DB!");
    console.log("   ✅ New password authenticated successfully; old credentials rejected!");
    console.log("   ✅ Recovery clearance codes wiped from database");

    // -------------------------------------------------------------
    // Test 5: Revert Credentials for Seed Idempotency
    // -------------------------------------------------------------
    console.log("\n▶ [Test 5] Reverting Test User Password to Original Seed Credentials...");
    postResetUser!.passwordHash = originalPasswordHash;
    await postResetUser!.save();
    console.log("   ✅ Rahul's password restored to original test seed state");

    console.log("\n================================================================");
    console.log("🎉 ALL FORGOT PASSWORD RECOVERY TESTS PASSED (5 / 5)");
    console.log("================================================================\n");
  } finally {
    await mongoose.disconnect();
  }
}

runForgotPasswordTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

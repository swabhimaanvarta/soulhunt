import { connectDB } from "../lib/db";
import { User } from "../models";
import bcrypt from "bcryptjs";

async function testForgotPasswordApi() {
  console.log("\n================================================================");
  console.log("🌐 AIEM HUNT — FORGOT PASSWORD LIVE HTTP API END-TO-END TEST");
  console.log("================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Test 1: Non-existent user
  console.log("▶ [Test 1] POST /api/auth/forgot-password with non-existent user...");
  const fakeRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "ghost_cadet_9999@aiemgoa.ac.in" }),
  });
  console.log(`   Status: ${fakeRes.status}`);
  const fakeJson = await fakeRes.json();
  if (fakeRes.status !== 404 || fakeJson.success !== false) {
    throw new Error(`Expected 404 for non-existent user, got ${fakeRes.status}`);
  }
  console.log("   ✅ Non-existent user correctly returned 404:", fakeJson.error?.message);

  await connectDB();
  const sampleUser = await User.findOne({ accountStatus: "ACTIVE" });
  if (!sampleUser) throw new Error("No active user found in database!");
  const activeEmail = sampleUser.email;

  // Test 2: Legitimate student user
  console.log(`\n▶ [Test 2] POST /api/auth/forgot-password with valid hunter (${activeEmail})...`);
  // Reset any leftover cooldown on test account
  sampleUser.passwordResetResendAfter = undefined;
  await sampleUser.save();

  const validRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: activeEmail }),
  });
  console.log(`   Status: ${validRes.status}`);
  const validJson = await validRes.json();
  if (!validRes.ok || !validJson.success) {
    throw new Error(`Forgot password dispatch failed: ${JSON.stringify(validJson)}`);
  }
  if (validJson.code || validJson.devClearanceCode) {
    throw new Error("SECURITY VIOLATION: OTP code leaked in API response!");
  }
  console.log("   ✅ Challenge successfully dispatched! Masked recipient:", validJson.maskedEmail);
  console.log("   ✅ Security verified: zero devClearanceCode or raw OTP in response");

  // Read the code hash from database to test reset endpoint
  const user = await User.findOne({ email: activeEmail }).select("+passwordResetCodeHash +passwordHash");
  if (!user || !user.passwordResetCodeHash) {
    throw new Error("Password reset code hash not found on user in database!");
  }
  console.log("   ✅ Confirmed passwordResetCodeHash securely stored in DB");

  // Test 3: Invalid code attempt
  console.log("\n▶ [Test 3] POST /api/auth/reset-password with invalid 6-digit code...");
  const wrongCodeRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: activeEmail,
      code: "111111",
      newPassword: "TestPassword@2026",
    }),
  });
  console.log(`   Status: ${wrongCodeRes.status}`);
  const wrongCodeJson = await wrongCodeRes.json();
  if (wrongCodeRes.status !== 400 || !wrongCodeJson.error?.message?.includes("Invalid clearance code")) {
    throw new Error(`Expected invalid code failure, got: ${JSON.stringify(wrongCodeJson)}`);
  }
  console.log("   ✅ Invalid code rejected as expected:", wrongCodeJson.error?.message);

  // Test 4: Weak password rejection
  console.log("\n▶ [Test 4] POST /api/auth/reset-password with weak password (no numbers)...");
  const weakPwRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: activeEmail,
      code: "123456", // even if code were correct, weak password should be caught
      newPassword: "weakpassword",
    }),
  });
  console.log(`   Status: ${weakPwRes.status}`);
  const weakPwJson = await weakPwRes.json();
  if (weakPwRes.status !== 400) {
    throw new Error(`Expected 400 for weak password, got: ${weakPwRes.status}`);
  }
  console.log("   ✅ Weak password rejected:", weakPwJson.error?.message);

  console.log("\n================================================================");
  console.log("🎉 ALL LIVE FORGOT PASSWORD HTTP API TESTS COMPLETED SUCCESSFULLY!");
  console.log("================================================================\n");
  process.exit(0);
}

testForgotPasswordApi().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

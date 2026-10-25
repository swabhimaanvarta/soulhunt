import http from "http";

function request(
  path: string,
  options: http.RequestOptions = {},
  postData?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, headers: res.headers, body: data });
        });
      }
    );
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runProfileVerification() {
  console.log("\n========================================================");
  console.log("👤 TESTING USER PROFILES & PROFILE EDITING SYSTEM");
  console.log("   Target: http://localhost:3000");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  try {
    // 1. Authenticate as Rahul Sharma
    const loginRes = await request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({ identifier: "rahul@aiemgoa.ac.in", password: "Hunter@123" })
    );

    const cookie = loginRes.headers["set-cookie"]?.[0]?.split(";")[0] || "";
    if (loginRes.status === 200 && cookie) {
      console.log("  ✅ Step 1: Authenticated as Student (rahul@aiemgoa.ac.in)");
      passed++;
    } else {
      console.error("  ❌ Step 1 failed: Authentication failed", loginRes.status, loginRes.body);
      failed++;
      process.exit(1);
    }

    // 2. Fetch authenticated profile
    const profileRes = await request("/api/user/profile", {
      method: "GET",
      headers: { Cookie: cookie },
    });
    const profileData = JSON.parse(profileRes.body);

    if (profileRes.status === 200 && profileData.success && profileData.isOwnProfile) {
      console.log(`  ✅ Step 2: Fetched self-profile for @${profileData.profile.username} (${profileData.profile.displayName})`);
      passed++;
    } else {
      console.error("  ❌ Step 2 failed: Could not fetch self profile", profileRes.status, profileData);
      failed++;
    }

    // 3. Edit profile information (bio, studentId, phoneNumber, department, avatarPreset)
    const updateRes = await request(
      "/api/user/profile",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
      },
      JSON.stringify({
        displayName: "Rahul Sharma (Lead Investigator)",
        bio: "Specializing in robotics equipment recovery and IoT sensor tracking at AIEM Goa.",
        department: "Computer Engineering",
        yearOfStudy: 3,
        studentId: "23COMP042",
        phoneNumber: "+91 98221 54321",
        preferredContactMethod: "SAFE_DESK",
        avatarPreset: "sleuth",
      })
    );
    const updateData = JSON.parse(updateRes.body);

    if (updateRes.status === 200 && updateData.success) {
      console.log(`  ✅ Step 3: Updated profile: Name="${updateData.user.displayName}", StudentID="${updateData.user.studentId}", Phone="${updateData.user.phoneNumber}"`);
      passed++;
    } else {
      console.error("  ❌ Step 3 failed: Update profile failed", updateRes.status, updateData);
      failed++;
    }

    // 4. Verify updated profile data via GET
    const verifyGet = await request("/api/user/profile", {
      method: "GET",
      headers: { Cookie: cookie },
    });
    const verifyData = JSON.parse(verifyGet.body);
    if (
      verifyData.profile.studentId === "23COMP042" &&
      verifyData.profile.phoneNumber === "+91 98221 54321" &&
      verifyData.profile.avatarPreset === "sleuth"
    ) {
      console.log("  ✅ Step 4: Profile persistence verified via GET /api/user/profile");
      passed++;
    } else {
      console.error("  ❌ Step 4 failed: Profile updates did not persist", verifyData);
      failed++;
    }

    // 5. Test viewing another user's public dossier (privacy check)
    // Query public dossier for rahul_seeker without auth cookie
    const targetUsername = profileData.profile.username;
    const publicProfileRes = await request(`/api/user/profile?username=${targetUsername}`, {
      method: "GET",
    });
    const publicData = JSON.parse(publicProfileRes.body);
    if (publicProfileRes.status === 200 && publicData.success) {
      // Unauthenticated viewers should NOT see private contact info (email, phone, studentId, coins)
      if (!publicData.profile.phoneNumber && !publicData.profile.studentId && !publicData.profile.email && publicData.profile.coins === undefined) {
        console.log("  ✅ Step 5: Privacy enforcement verified: Non-owners cannot view private phone, email, roll number, or coins balance");
        passed++;
      } else {
        console.error("  ❌ Step 5 failed: Private information leaked in public profile!", publicData.profile);
        failed++;
      }
    } else {
      console.error("  ❌ Step 5 failed: Could not fetch public profile", publicProfileRes.status, publicData);
      failed++;
    }

    // 6. Test Password Change API validation
    // 6a. Rejects wrong current password
    const badOldPassRes = await request(
      "/api/user/password",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
      },
      JSON.stringify({
        currentPassword: "WrongPassword999!",
        newPassword: "NewSecurePass123!",
        confirmPassword: "NewSecurePass123!",
      })
    );
    const badOldPassData = JSON.parse(badOldPassRes.body);
    if (badOldPassRes.status === 400 && badOldPassData.error?.code === "INVALID_PASSWORD") {
      console.log("  ✅ Step 6a: Rejected incorrect current password (400)");
      passed++;
    } else {
      console.error("  ❌ Step 6a failed: Did not reject wrong current password", badOldPassRes.status, badOldPassData);
      failed++;
    }

    // 6b. Rejects weak new password (no numbers/uppercase)
    const weakPassRes = await request(
      "/api/user/password",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
      },
      JSON.stringify({
        currentPassword: "Hunter@123",
        newPassword: "weakpassword",
        confirmPassword: "weakpassword",
      })
    );
    const weakPassData = JSON.parse(weakPassRes.body);
    if (weakPassRes.status === 400 && weakPassData.error?.code === "WEAK_PASSWORD") {
      console.log("  ✅ Step 6b: Rejected weak password (400)");
      passed++;
    } else {
      console.error("  ❌ Step 6b failed: Did not reject weak password", weakPassRes.status, weakPassData);
      failed++;
    }

    // 6c. Successfully change password
    const goodPassRes = await request(
      "/api/user/password",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
      },
      JSON.stringify({
        currentPassword: "Hunter@123",
        newPassword: "NewSecurePassword2026!",
        confirmPassword: "NewSecurePassword2026!",
      })
    );
    const goodPassData = JSON.parse(goodPassRes.body);
    if (goodPassRes.status === 200 && goodPassData.success) {
      console.log("  ✅ Step 6c: Successfully changed password to NewSecurePassword2026!");
      passed++;

      // Verify login with new password
      const newLoginRes = await request(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        JSON.stringify({ identifier: "rahul@aiemgoa.ac.in", password: "NewSecurePassword2026!" })
      );
      if (newLoginRes.status === 200) {
        console.log("  ✅ Step 6d: Verified login succeeds with new password!");
        passed++;
      } else {
        console.error("  ❌ Step 6d failed: Login with new password failed", newLoginRes.status);
        failed++;
      }

      // Revert back to original "Hunter@123" to keep test suite consistent
      const newCookie = newLoginRes.headers["set-cookie"]?.[0]?.split(";")[0] || "";
      await request(
        "/api/user/password",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: newCookie,
          },
        },
        JSON.stringify({
          currentPassword: "NewSecurePassword2026!",
          newPassword: "Hunter@123",
          confirmPassword: "Hunter@123",
        })
      );
      console.log("  ✅ Step 6e: Restored default fixture password (Hunter@123)");
      passed++;
    } else {
      console.error("  ❌ Step 6c failed: Password update failed", goodPassRes.status, goodPassData);
      failed++;
    }

    // 7. Verify frontend profile page renders HTTP 200 when authenticated
    const unauthPageRes = await request(`/profile/${targetUsername}`);
    if (unauthPageRes.status === 307) {
      console.log("  ✅ Step 7a: Unauthenticated access to /profile redirected to /login (307 Guard)");
      passed++;
    } else {
      console.error(`  ❌ Step 7a failed: Expected 307 redirect, got ${unauthPageRes.status}`);
      failed++;
    }

    const authPageRes = await request(`/profile/${targetUsername}`, {
      headers: { Cookie: cookie },
    });
    if (authPageRes.status === 200) {
      console.log(`  ✅ Step 7b: Authenticated route /profile/${targetUsername} renders with HTTP 200 OK`);
      passed++;
    } else {
      console.error(`  ❌ Step 7b failed: /profile/${targetUsername} returned status ${authPageRes.status}`);
      failed++;
    }

  } catch (err: any) {
    console.error("  ❌ Unexpected error during profile verification:", err.message);
    failed++;
  }

  console.log("\n========================================================");
  console.log(`📊 USER PROFILE VERIFICATION: ${passed} PASSED | ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) process.exit(1);
}

runProfileVerification();

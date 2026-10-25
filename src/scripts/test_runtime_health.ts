import http from "http";

interface RouteCheck {
  path: string;
  expected: number[];
  category: "public" | "protected";
}

const ROUTES: RouteCheck[] = [
  // Public pages (should return 200 OK)
  { path: "/", expected: [200], category: "public" },
  { path: "/map", expected: [200], category: "public" },
  { path: "/lost-and-found", expected: [200], category: "public" },
  { path: "/quests", expected: [200], category: "public" },
  { path: "/leaderboard", expected: [200], category: "public" },
  { path: "/events", expected: [200], category: "public" },
  { path: "/login", expected: [200], category: "public" },
  { path: "/register", expected: [200], category: "public" },

  // Protected pages (should redirect with 307 to /login when unauthenticated)
  { path: "/lost-and-found/report-lost", expected: [307], category: "protected" },
  { path: "/lost-and-found/report-found", expected: [307], category: "protected" },
  { path: "/rewards", expected: [307], category: "protected" },
  { path: "/dashboard", expected: [307], category: "protected" },
  { path: "/admin", expected: [307], category: "protected" },
];

const API_ROUTES = [
  { path: "/api/locations", expected: [200] },
  { path: "/api/items", expected: [200] },
  { path: "/api/quests", expected: [200] },
  { path: "/api/rewards", expected: [200] },
  { path: "/api/leaderboard", expected: [200] },
];

async function request(path: string, options: http.RequestOptions = {}, postData?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; timeMs: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: data,
            timeMs: Date.now() - start,
          });
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out after 15000ms"));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runRuntimeAudit() {
  console.log("\n========================================================");
  console.log("🔍 AIEM HUNT — LIVE RUNTIME HEALTH & ROUTE AUDIT");
  console.log("   Target: http://localhost:3000");
  console.log("========================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  console.log("─── Step 1: Testing User Pages & Navigation Guards ───");
  for (const route of ROUTES) {
    try {
      const res = await request(route.path);
      const passed = route.expected.includes(res.status);
      if (passed) {
        totalPassed++;
        const tag = route.category === "protected" ? "[PROTECTED -> 307 REDIRECT]" : "[PUBLIC 200 OK]";
        console.log(`  ✅ [${res.status}] ${route.path.padEnd(32)} ${tag.padEnd(28)} (${res.timeMs}ms)`);
      } else {
        totalFailed++;
        console.error(`  ❌ [${res.status}] ${route.path.padEnd(32)} - Expected ${route.expected.join(", ")}`);
      }
    } catch (err: any) {
      totalFailed++;
      console.error(`  ❌ [ERR] ${route.path.padEnd(32)} - ${err.message}`);
    }
  }

  console.log("\n─── Step 2: Testing Public API Endpoints ───");
  for (const route of API_ROUTES) {
    try {
      const res = await request(route.path);
      const passed = route.expected.includes(res.status);
      if (passed) {
        totalPassed++;
        let preview = "";
        try {
          const parsed = JSON.parse(res.body);
          if (parsed.data) {
            if (Array.isArray(parsed.data)) preview = `Array(${parsed.data.length} items)`;
            else if (parsed.data.items) preview = `${parsed.data.items.length} items`;
            else if (parsed.data.quests) preview = `${parsed.data.quests.length} quests`;
            else if (parsed.data.locations) preview = `${parsed.data.locations.length} locations`;
            else preview = Object.keys(parsed.data).join(", ");
          } else {
            preview = Object.keys(parsed).join(", ");
          }
        } catch {
          preview = "Non-JSON response";
        }
        console.log(`  ✅ [${res.status}] ${route.path.padEnd(32)} (${res.timeMs}ms) — Data: ${preview}`);
      } else {
        totalFailed++;
        console.error(`  ❌ [${res.status}] ${route.path.padEnd(32)} - Expected ${route.expected.join(", ")}`);
      }
    } catch (err: any) {
      totalFailed++;
      console.error(`  ❌ [ERR] ${route.path.padEnd(32)} - ${err.message}`);
    }
  }

  console.log("\n─── Step 3: Auth Security & Institutional Domain Enforcement ───");
  try {
    // 3a. Reject personal email with full valid form payload
    const regRes = await request(
      "/api/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({
        email: "hacker@gmail.com",
        password: "Password123!",
        displayName: "Hacker Seeker",
        username: "hacker_seeker",
        department: "Computer Science",
        yearOfStudy: 3,
      })
    );

    const regJson = JSON.parse(regRes.body);
    if ((regRes.status === 400 || regRes.status === 403) && (regJson.error?.code === "DOMAIN_NOT_ALLOWED" || regJson.error?.code === "UNAUTHORIZED_DOMAIN")) {
      totalPassed++;
      console.log(`  ✅ Institutional domain policy strictly blocked '@gmail.com' (${regRes.status}): "${regJson.error.message}"`);
    } else {
      totalFailed++;
      console.error(`  ❌ Expected DOMAIN_NOT_ALLOWED for @gmail.com, got ${regRes.status}: ${regRes.body}`);
    }

    // 3b. Test login rejection with bad password
    const loginFailRes = await request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({
        identifier: "admin@aiemgoa.ac.in",
        password: "WrongPassword999!",
      })
    );

    if (loginFailRes.status === 401) {
      totalPassed++;
      console.log("  ✅ Login strictly rejected invalid password (401 Unauthorized)");
    } else {
      totalFailed++;
      console.error(`  ❌ Expected 401 for wrong credentials, got ${loginFailRes.status}: ${loginFailRes.body}`);
    }

    // 3c. Test authenticated session with seeded admin
    const loginOkRes = await request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({
        identifier: "admin@aiemgoa.ac.in",
        password: "Admin@123",
      })
    );

    if (loginOkRes.status === 200) {
      totalPassed++;
      console.log("  ✅ Admin login succeeded (200 OK)");

      const cookieHeader = loginOkRes.headers["set-cookie"];
      const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader || "";

      // 3d. Test /api/auth/me with session cookie
      const meRes = await request("/api/auth/me", {
        headers: { Cookie: cookieStr },
      });

      if (meRes.status === 200) {
        const meData = JSON.parse(meRes.body);
        if (meData.user?.role === "ADMIN" && meData.user?.email === "admin@aiemgoa.ac.in") {
          totalPassed++;
          console.log(`  ✅ Session authenticated: ${meData.user.displayName} (Role: ${meData.user.role}, Tier: ${meData.user.trustTier})`);
        } else {
          totalFailed++;
          console.error("  ❌ /api/auth/me did not return expected admin user");
        }
      } else {
        totalFailed++;
        console.error(`  ❌ /api/auth/me failed with status ${meRes.status}`);
      }

      // 3e. Test Admin Operations API with session cookie
      const adminOverviewRes = await request("/api/admin/overview", {
        headers: { Cookie: cookieStr },
      });

      if (adminOverviewRes.status === 200) {
        const overviewData = JSON.parse(adminOverviewRes.body);
        totalPassed++;
        console.log(`  ✅ Admin Operations Overview API accessible: Total Users: ${overviewData.stats?.totalUsers ?? 'N/A'}, Active Quests: ${overviewData.stats?.activeQuests ?? 'N/A'}`);
      } else {
        totalFailed++;
        console.error(`  ❌ /api/admin/overview failed with status ${adminOverviewRes.status}`);
      }

      // 3f. Test Admin Page with session cookie (should be 200 OK, not redirected)
      const adminPageRes = await request("/admin", {
        headers: { Cookie: cookieStr },
      });

      if (adminPageRes.status === 200) {
        totalPassed++;
        console.log(`  ✅ Authenticated access to /admin page granted (200 OK)`);
      } else {
        totalFailed++;
        console.error(`  ❌ /admin page returned ${adminPageRes.status} for authenticated admin`);
      }

      // 3g. Test Dashboard Page with session cookie (should be 200 OK, not redirected)
      const dashboardPageRes = await request("/dashboard", {
        headers: { Cookie: cookieStr },
      });

      if (dashboardPageRes.status === 200) {
        totalPassed++;
        console.log(`  ✅ Authenticated access to /dashboard page granted (200 OK)`);
      } else {
        totalFailed++;
        console.error(`  ❌ /dashboard page returned ${dashboardPageRes.status} for authenticated admin`);
      }

      // 3h. Test Student Login & Student Journey
      const studentLoginRes = await request(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        JSON.stringify({
          identifier: "rahul@aiemgoa.ac.in",
          password: "Hunter@123",
        })
      );

      if (studentLoginRes.status === 200) {
        totalPassed++;
        console.log("  ✅ Student login succeeded (Rahul Sharma - 200 OK)");

        const studentCookieHeader = studentLoginRes.headers["set-cookie"];
        const studentCookieStr = Array.isArray(studentCookieHeader) ? studentCookieHeader.join("; ") : studentCookieHeader || "";

        // 3i. Student trying to access /admin should be redirected to /dashboard?error=unauthorized_role
        const studentAdminRes = await request("/admin", {
          headers: { Cookie: studentCookieStr },
        });

        if (studentAdminRes.status === 307 && (studentAdminRes.headers.location || "").includes("unauthorized_role")) {
          totalPassed++;
          console.log("  ✅ Role enforcement: Student attempting to access /admin is redirected to /dashboard?error=unauthorized_role (307)");
        } else {
          totalFailed++;
          console.error(`  ❌ Expected redirect with unauthorized_role for student on /admin, got ${studentAdminRes.status}`);
        }

        // 3j. Student accessing /lost-and-found/report-lost should be 200 OK (authorized)
        const studentReportLostRes = await request("/lost-and-found/report-lost", {
          headers: { Cookie: studentCookieStr },
        });

        if (studentReportLostRes.status === 200) {
          totalPassed++;
          console.log("  ✅ Authenticated student access to /lost-and-found/report-lost granted (200 OK)");
        } else {
          totalFailed++;
          console.error(`  ❌ /lost-and-found/report-lost returned ${studentReportLostRes.status} for authenticated student`);
        }
      } else {
        totalFailed++;
        console.error(`  ❌ Student login failed with status ${studentLoginRes.status}`);
      }

    } else {
      totalFailed++;
      console.error(`  ❌ Admin login failed with status ${loginOkRes.status}: ${loginOkRes.body}`);
    }
  } catch (err: any) {
    totalFailed++;
    console.error(`  ❌ Auth security check error: ${err.message}`);
  }

  console.log("\n========================================================");
  console.log(`📊 LIVE AUDIT RESULTS: ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log("========================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runRuntimeAudit().catch((err) => {
  console.error("Fatal audit error:", err);
  process.exit(1);
});

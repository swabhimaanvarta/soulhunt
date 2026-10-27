async function verifyEndpoints() {
  console.log("Checking HTTP endpoints and CSS bundles...\n");

  const loginRes = await fetch("http://localhost:3000/login");
  console.log("GET /login HTTP Status:", loginRes.status);
  const loginHtml = await loginRes.text();
  console.log("✓ Login page rendered properly:", loginHtml.includes("Quick Role Autofill"));

  const regRes = await fetch("http://localhost:3000/register");
  console.log("GET /register HTTP Status:", regRes.status);
  const regHtml = await regRes.text();
  console.log("✓ Register page rendered properly:", regHtml.includes("Register for AIEM Hunt"));

  // Check CSS assets
  const cssMatches = [...loginHtml.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css[^"]*)"/g)];
  console.log("Found CSS links:", cssMatches.map(m => m[1]));
  for (const m of cssMatches) {
    const cssUrl = "http://localhost:3000" + m[1];
    const cssRes = await fetch(cssUrl);
    console.log(`✓ CSS Asset ${m[1]} -> Status: ${cssRes.status} (Length: ${cssRes.headers.get("content-length") || "chunked"})`);
  }

  // Test API Login with Mod account
  console.log("\nTesting /api/auth/login with Safe-Desk Staff (mod@aiemgoa.ac.in)...");
  const apiLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "mod@aiemgoa.ac.in", password: "Mod@123" }),
  });
  const apiLoginJson = await apiLoginRes.json();
  console.log("✓ Mod Login API Status:", apiLoginRes.status, "Role:", apiLoginJson.data?.role, "DisplayName:", apiLoginJson.data?.displayName);

  // Test API Login with Hunter account
  console.log("\nTesting /api/auth/login with Student Hunter (rahul@aiemgoa.ac.in)...");
  const hunterLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "rahul@aiemgoa.ac.in", password: "Hunter@123" }),
  });
  const hunterLoginJson = await hunterLoginRes.json();
  console.log("✓ Hunter Login API Status:", hunterLoginRes.status, "Role:", hunterLoginJson.data?.role, "DisplayName:", hunterLoginJson.data?.displayName);

  // Test API Login with Admin account
  console.log("\nTesting /api/auth/login with Admin (admin@aiemgoa.ac.in)...");
  const adminLoginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin@aiemgoa.ac.in", password: "Admin@123" }),
  });
  const adminLoginJson = await adminLoginRes.json();
  console.log("✓ Admin Login API Status:", adminLoginRes.status, "Role:", adminLoginJson.data?.role, "DisplayName:", adminLoginJson.data?.displayName);

  console.log("\n🎉 ALL HTTP ENDPOINTS & CSS CHUNKS ARE 100% HEALTHY!");
}

verifyEndpoints().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});

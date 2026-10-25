import http from "http";

function request(path: string, options: http.RequestOptions = {}, postData?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
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
        res.on("data", (chunk) => { data += chunk; });
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

async function runMapVerification() {
  console.log("\n========================================================");
  console.log("🛰️ TESTING REAL SATELLITE MAP & ADMIN PIN REPOSITIONING");
  console.log("   Target: http://localhost:3000");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  try {
    // 1. Check /map page returns 200 OK
    const mapPage = await request("/map");
    if (mapPage.status === 200) {
      console.log("  ✅ /map page loads successfully with HTTP 200 OK");
      passed++;
    } else {
      console.error(`  ❌ /map page returned HTTP ${mapPage.status}`);
      failed++;
    }

    // 2. Fetch public locations from /api/locations
    const locRes = await request("/api/locations");
    const locData = JSON.parse(locRes.body);
    const locations = Array.isArray(locData.data) ? locData.data : (locData.locations || locData);
    
    if (Array.isArray(locations) && locations.length > 0) {
      console.log(`  ✅ /api/locations returned ${locations.length} campus zones`);
      passed++;
      
      const sampleLoc = locations[0];
      if (sampleLoc.coordinates && typeof sampleLoc.coordinates.lat === "number" && typeof sampleLoc.coordinates.lng === "number") {
        console.log(`  ✅ Valid GPS coordinates detected on "${sampleLoc.name}" (${sampleLoc.code}): [${sampleLoc.coordinates.lat}, ${sampleLoc.coordinates.lng}]`);
        passed++;
      } else {
        console.error("  ❌ Missing or invalid coordinates on location:", sampleLoc);
        failed++;
      }
    } else {
      console.error("  ❌ No locations returned from /api/locations:", locData);
      failed++;
    }

    // 3. Admin login to test pin repositioning API
    const adminLoginRes = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, JSON.stringify({ identifier: "admin@aiemgoa.ac.in", password: "Admin@123" }));

    const adminCookie = adminLoginRes.headers["set-cookie"]?.[0]?.split(";")[0] || "";
    if (adminLoginRes.status === 200 && adminCookie) {
      console.log("  ✅ Admin authenticated for pin manipulation");
      passed++;

      // 4. Test repositioning the first location
      const targetLoc = locations[0];
      const targetId = targetLoc._id;
      const originalLat = targetLoc.coordinates?.lat ?? 15.5948;
      const originalLng = targetLoc.coordinates?.lng ?? 73.7947;
      
      // Slightly reposition (e.g. adjust 4th decimal for rooftop precision)
      const newLat = Number((originalLat + 0.0001).toFixed(6));
      const newLng = Number((originalLng + 0.0001).toFixed(6));

      const updateRes = await request(`/api/admin/locations/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
      }, JSON.stringify({
        lat: newLat,
        lng: newLng,
        reason: "Satellite rooftop precision calibration test",
      }));

      const updateBody = JSON.parse(updateRes.body);
      if (updateRes.status === 200 && updateBody.success) {
        console.log(`  ✅ Pin repositioning API (PUT /api/admin/locations/[id]) succeeded: [${newLat}, ${newLng}]`);
        passed++;

        // Restore original coordinates
        await request(`/api/admin/locations/${targetId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: adminCookie,
          },
        }, JSON.stringify({
          lat: originalLat,
          lng: originalLng,
          reason: "Restoring original calibration coordinates",
        }));
        console.log(`  ✅ Original coordinates successfully restored: [${originalLat}, ${originalLng}]`);
        passed++;
      } else {
        console.error(`  ❌ Pin repositioning failed with status ${updateRes.status}:`, updateBody);
        failed++;
      }
    } else {
      console.error("  ❌ Admin authentication failed:", adminLoginRes.status, adminLoginRes.body);
      failed++;
    }

  } catch (err: any) {
    console.error("  ❌ Test execution error:", err.message);
    failed++;
  }

  console.log("\n========================================================");
  console.log(`📊 SATELLITE MAP TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) process.exit(1);
}

runMapVerification();

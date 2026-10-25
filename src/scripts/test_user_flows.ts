import http from "http";

async function request(path: string, options: http.RequestOptions = {}, postData?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
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

function getCookieString(res: { headers: http.IncomingHttpHeaders }): string {
  const header = res.headers["set-cookie"];
  return Array.isArray(header) ? header.join("; ") : header || "";
}

async function runFlowTest() {
  console.log("\n========================================================");
  console.log("🚀 TESTING INTERACTIVE END-TO-END FLOWS ON RUNTIME");
  console.log("   Target: http://localhost:3000");
  console.log("========================================================\n");

  let passes = 0;
  let fails = 0;

  // 1. Login as Rahul (Student Seeker)
  const rahulLogin = await request(
    "/api/auth/login",
    { method: "POST", headers: { "Content-Type": "application/json" } },
    JSON.stringify({ identifier: "rahul@aiemgoa.ac.in", password: "Hunter@123" })
  );

  if (rahulLogin.status !== 200) {
    console.error("❌ Failed to log in as Rahul:", rahulLogin.body);
    fails++;
    return;
  }
  const rahulCookie = getCookieString(rahulLogin);
  passes++;
  console.log("  ✅ Step 1: Logged in as Rahul Sharma (rahul@aiemgoa.ac.in)");

  // 2. Fetch authentic AIEM campus locations
  const locRes = await request("/api/locations");
  const locJson = JSON.parse(locRes.body);
  const locations: any[] = locJson.data || [];
  if (locations.length < 5) {
    console.error("❌ Expected at least 5 campus locations, got:", locations.length);
    fails++;
    return;
  }
  const compLab = locations.find((l) => l.code === "COMP-AI") || locations[0];
  const safeLib = locations.find((l) => l.code === "SAFE-LIB") || locations[1];
  passes++;
  console.log(`  ✅ Step 2: Fetched AIEM locations: Comp Lab (${compLab.code}), Safe-Desk (${safeLib.code})`);

  // 3. Rahul reports a lost scientific calculator
  const reportLostRes = await request(
    "/api/items/lost",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: rahulCookie },
    },
    JSON.stringify({
      title: "Casio FX-991CW Scientific Calculator",
      category: "ELECTRONICS",
      publicDescription: "Black solar engineering scientific calculator with protective slide cover.",
      secretIdentifiers: "AIEM matriculation barcode ending in #8472 on back cover with small scratch near solar cell",
      verificationQuestion: "What is written on the tape beneath the battery lid?",
      verificationAnswer: "Batch 2024 AIEM",
      lastKnownLocationId: compLab._id,
      spotDetails: "Bench 14, 2nd row in Digital Systems Lab",
      rewardOffered: 40,
      recoveryPreference: "HANDOVER_AT_SAFE_DESK",
      convertToQuest: true,
    })
  );

  let createdLostItemId = "";
  if (reportLostRes.status === 201 || reportLostRes.status === 200) {
    passes++;
    const lostItemData = JSON.parse(reportLostRes.body);
    createdLostItemId = lostItemData.data?.item?._id || lostItemData.data?._id || lostItemData.item?._id;
    console.log(`  ✅ Step 3: Lost item reported successfully (ID: ${createdLostItemId})`);
  } else {
    fails++;
    console.error(`  ❌ Failed to report lost item (${reportLostRes.status}):`, reportLostRes.body);
  }

  // 4. Login as Priya (Student Finder)
  const priyaLogin = await request(
    "/api/auth/login",
    { method: "POST", headers: { "Content-Type": "application/json" } },
    JSON.stringify({ identifier: "priya@aitdgoa.edu.in", password: "Hunter@123" })
  );

  if (priyaLogin.status !== 200) {
    console.error("❌ Failed to log in as Priya:", priyaLogin.body);
    fails++;
    return;
  }
  const priyaCookie = getCookieString(priyaLogin);
  passes++;
  console.log("  ✅ Step 4: Logged in as Priya Mukherjee (priya@aitdgoa.edu.in)");

  // 5. Priya reports a found item handed into Safe-Desk
  const reportFoundRes = await request(
    "/api/items/found",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: priyaCookie },
    },
    JSON.stringify({
      title: "Blue Leatherette Keyring with ASSAGAO Tag",
      category: "KEYS",
      publicDescription: "Pair of brass dormitory keys with a blue Assagao tech campus keychain.",
      foundLocationId: safeLib._id,
      spotDetails: "Found on reading desk #07 in Central Library reference area",
      custodyStatus: "SAFE_DESK",
      currentCustodyLocationId: safeLib._id,
    })
  );

  let foundItemId = "";
  if (reportFoundRes.status === 201 || reportFoundRes.status === 200) {
    passes++;
    const foundData = JSON.parse(reportFoundRes.body);
    foundItemId = foundData.data?._id || foundData.item?._id;
    console.log(`  ✅ Step 5: Found item reported & Safe-Desk custody logged (ID: ${foundItemId})`);
  } else {
    fails++;
    console.error(`  ❌ Failed to report found item (${reportFoundRes.status}):`, reportFoundRes.body);
  }

  // 6. Rahul submits a claim on the found item
  if (foundItemId) {
    const claimRes = await request(
      `/api/items/${foundItemId}/claim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: rahulCookie },
      },
      JSON.stringify({
        answerProvided: "Keys verified by room supervisor",
        proofText: "These are my hostel room 104 keys, has a small dent on the secondary brass key.",
        handoverPreference: "SAFE_DESK",
      })
    );

    if (claimRes.status === 200 || claimRes.status === 201) {
      passes++;
      const claimJson = JSON.parse(claimRes.body);
      console.log(`  ✅ Step 6: Item claim submitted successfully (Status: ${claimJson.data?.status || 'PENDING'})`);
    } else {
      fails++;
      console.error(`  ❌ Failed to submit item claim (${claimRes.status}):`, claimRes.body);
    }
  }

  // 7. Verify items search endpoint
  const searchRes = await request("/api/items?search=Calculator&category=ELECTRONICS");
  if (searchRes.status === 200) {
    const searchJson = JSON.parse(searchRes.body);
    const searchItems = searchJson.data || searchJson.items || [];
    passes++;
    console.log(`  ✅ Step 7: Search filter verified: found ${searchItems.length} matching items`);
  } else {
    fails++;
    console.error(`  ❌ Failed to search items (${searchRes.status}):`, searchRes.body);
  }

  // Cleanup test artifacts so live database is not polluted
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt");
    }
    const db = mongoose.connection.db;
    if (createdLostItemId) {
      await db.collection("lostitems").deleteOne({ _id: new mongoose.Types.ObjectId(createdLostItemId) });
    }
    if (foundItemId) {
      await db.collection("founditems").deleteOne({ _id: new mongoose.Types.ObjectId(foundItemId) });
    }
    await mongoose.disconnect();
    console.log("  🧹 Test artifacts cleaned up successfully.");
  } catch {
    // Non-fatal cleanup
  }

  console.log("\n========================================================");
  console.log(`🎉 END-TO-END FLOW AUDIT: ${passes} PASSED | ${fails} FAILED`);
  console.log("========================================================\n");

  if (fails > 0) {
    process.exit(1);
  }
}

runFlowTest().catch((err) => {
  console.error("Flow test fatal error:", err);
  process.exit(1);
});

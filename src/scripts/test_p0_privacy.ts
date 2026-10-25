import http from "http";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? "✓" : "✗";
  console.log(`[${icon}] ${name}${!passed && error ? ` - FAIL: ${error}` : ""}`);
}

async function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; json: any; headers: any }> {
  try {
    const res = await fetch(`http://localhost:3000${path}`, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json, headers: Object.fromEntries(res.headers.entries()) };
  } catch (err: any) {
    return { status: 500, json: { error: err.message }, headers: {} };
  }
}

async function runPrivacyVerificationSuite() {
  console.log("===============================================================");
  console.log("  AIEM HUNT — P0 / P1 / P2 PRIVACY & SECURITY REGRESSION SUITE");
  console.log("===============================================================\n");

  try {
    // 1. Test Items list anonymous retrieval & pagination
    console.log("--- 1. Testing Items List API (Anonymous caller) ---");
    const itemsRes = await request("/api/items?limit=4");
    record("Items API responds with HTTP 200", itemsRes.status === 200, itemsRes.json?.error?.message);

    const items = itemsRes.json?.data || [];
    record("Items API respects combined pagination limit (<= 4 items)", Array.isArray(items) && items.length <= 4, `Received ${items.length} items`);

    let studentIdLeakFound = false;
    let reporterLeakFound = false;
    let coordinatesLeakFound = false;

    for (const item of items) {
      // Check for student roll number patterns like 23COMP042
      if (/\b[0-9]{2}[A-Z]{2,5}[0-9]{2,5}\b/i.test(item.title || "")) {
        studentIdLeakFound = true;
      }
      if (item.reporter || item.finder) {
        reporterLeakFound = true;
      }
      if (item.location?.coordinates) {
        coordinatesLeakFound = true;
      }
    }

    record("Items API does NOT leak student IDs in public titles", !studentIdLeakFound);
    record("Items API does NOT leak reporter/finder personal identities to anonymous callers", !reporterLeakFound);
    record("Items API does NOT leak fine-grained coordinates in public item locations", !coordinatesLeakFound);

    // 2. Test Item Details API privacy scrubbing
    console.log("\n--- 2. Testing Item Details API (Anonymous caller) ---");
    if (items.length > 0) {
      const sampleItem = items[0];
      const itemDetailRes = await request(`/api/items/${sampleItem._id}`);

      record("Item detail responds with HTTP 200", itemDetailRes.status === 200);

      const d = itemDetailRes.json?.data;
      if (d) {
        record("Item detail does NOT return verificationQuestion to anonymous callers", d.verificationQuestion === undefined || d.verificationQuestion === null, `Value: ${d.verificationQuestion}`);
        record("Item detail does NOT return spotDetails to anonymous callers", d.spotDetails === undefined || d.spotDetails === null, `Value: ${d.spotDetails}`);
        record("Item detail does NOT leak reporterId personal identity", d.reporterId === undefined || d.reporterId === null, `Value: ${JSON.stringify(d.reporterId)}`);
        record("Item detail does NOT leak finderId personal identity", d.finderId === undefined || d.finderId === null, `Value: ${JSON.stringify(d.finderId)}`);
        record("Item detail does NOT leak exact coordinates to anonymous callers", !d.lastKnownLocationId?.coordinates && !d.foundLocationId?.coordinates);
        record("Item detail correctly flags isAuthenticated: false for anonymous caller", d.isAuthenticated === false);
      } else {
        record("Item detail payload exists", false, "No data payload");
      }
    } else {
      console.log("No items available to test item detail");
    }

    // 3. Test Quests list privacy
    console.log("\n--- 3. Testing Quests List API (Anonymous caller) ---");
    const questsRes = await request("/api/quests");
    record("Quests API responds with HTTP 200", questsRes.status === 200);

    const quests = questsRes.json?.data || [];
    let linkedItemLeakInQuests = false;
    let restrictedRoomNoteLeak = false;

    for (const q of quests) {
      if (q.linkedLostItemId || q.linkedFoundItemId) {
        linkedItemLeakInQuests = true;
      }
      if (q.restrictedRoomNote) {
        restrictedRoomNoteLeak = true;
      }
    }

    record("Quests list does NOT leak linkedLostItemId to anonymous callers", !linkedItemLeakInQuests);
    record("Quests list does NOT leak restrictedRoomNote to anonymous callers", !restrictedRoomNoteLeak);

    // 4. Test Quest Detail Clue Stage Gating & Privacy
    console.log("\n--- 4. Testing Quest Detail API (Anonymous caller) ---");
    if (quests.length > 0) {
      const sampleQuest = quests[0];
      const questDetailRes = await request(`/api/quests/${sampleQuest._id}`);
      record("Quest detail responds with HTTP 200", questDetailRes.status === 200);

      const qData = questDetailRes.json?.data;
      if (qData) {
        record("Quest detail does NOT leak linkedLostItemId to anonymous caller", !qData.quest?.linkedLostItemId, `Value: ${qData.quest?.linkedLostItemId}`);
        record("Quest detail does NOT leak exact restrictedRoomNote before stage unlock", !qData.quest?.restrictedRoomNote || qData.quest?.restrictedRoomNote.includes("locked"));

        const clues = qData.clues || [];
        record("Quest detail does NOT return future clue stages (> stage 1) to unauthenticated visitor", clues.length <= 1, `Received ${clues.length} clues`);

        let answerLeak = false;
        let hintLeak = false;
        for (const c of clues) {
          if (c.expectedAnswerNormalized || c.expectedAnswer) answerLeak = true;
          if (c.hintText && c.hintText.trim().length > 0) hintLeak = true;
        }

        record("Quest detail does NOT leak expected answers to client", !answerLeak);
        record("Quest detail does NOT leak hint text to unauthenticated visitor", !hintLeak);
        record("Quest detail reports isAuthenticated: false for anonymous caller", qData.isAuthenticated === false);
      } else {
        record("Quest detail payload exists", false, "No data payload");
      }
    }

    // 5. Check Homepage HTML
    console.log("\n--- 5. Testing Homepage Rendered HTML ---");
    const homeRes = await request("/");
    record("Homepage responds with HTTP 200", homeRes.status === 200);
    const html = homeRes.json?.raw || "";
    record("Homepage does not contain student ID roll number patterns", !/\b[0-9]{2}COMP[0-9]{3}\b/i.test(html));

    // Summary
    console.log("\n===============================================================");
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log("===============================================================\n");

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

runPrivacyVerificationSuite();

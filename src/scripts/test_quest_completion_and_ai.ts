import http from "http";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  const icon = passed ? "✓" : "✗";
  console.log(`[${icon}] ${name}${!passed && error ? ` - FAIL: ${error}` : ""}`);
}

async function request(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; json: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:3000${path}`,
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve({ status: res.statusCode || 200, json, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode || 200, json: { raw: data }, headers: res.headers });
          }
        });
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function getCookieString(res: { headers: http.IncomingHttpHeaders }): string {
  const header = res.headers["set-cookie"];
  if (!header) return "";
  const cookies = Array.isArray(header) ? header : [header];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("  AIEM HUNT — QUEST COMPLETION & AI GENERATOR INTEGRATION SUITE");
  console.log("=================================================================\n");

  try {
    // 1. Authenticate as Rahul (Student)
    console.log("--- 1. Authenticating as Student (Rahul) ---");
    const rahulLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "rahul@aiemgoa.ac.in", password: "Hunter@123" }),
    });
    record("Rahul login succeeds (HTTP 200)", rahulLogin.status === 200, JSON.stringify(rahulLogin.json));
    const rahulCookie = getCookieString(rahulLogin);
    record("Received session cookie for Rahul", Boolean(rahulCookie));

    // 2. Authenticate as Admin
    console.log("\n--- 2. Authenticating as Admin ---");
    const adminLogin = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "admin@aiemgoa.ac.in", password: "Admin@123" }),
    });
    record("Admin login succeeds (HTTP 200)", adminLogin.status === 200, JSON.stringify(adminLogin.json));
    const adminCookie = getCookieString(adminLogin);
    record("Received session cookie for Admin", Boolean(adminCookie));

    // 3. Test AI Quest Generation in Admin CMS (Draft Mode)
    console.log("\n--- 3. Testing AI Quest Generation via Admin CMS ---");
    const aiGenRes = await request("/api/ai/generate-quest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        prompt: "Missing Digital Multimeter near Power Electronics Lab 202",
        theme: "TECHNICAL_ENGINEERING",
        difficulty: 4,
        questType: "CAMPUS_TREASURE",
        stageCount: 3,
        status: "DRAFT",
      }),
    });

    record("AI Quest Generator endpoint responds with HTTP 201", aiGenRes.status === 201, JSON.stringify(aiGenRes.json));
    const aiData = aiGenRes.json?.data;
    const generatedQuest = aiData?.quest;
    const generatedClues = aiData?.clues;

    record("Generated quest exists in response", Boolean(generatedQuest?._id));
    record("Generated quest has initial status 'DRAFT'", generatedQuest?.status === "DRAFT");
    record("Generated quest has requested difficulty 4", generatedQuest?.difficulty === 4);
    record("Generated quest has category CAMPUS_TREASURE", generatedQuest?.questType === "CAMPUS_TREASURE");
    record("Generated quest blueprint has exactly 3 clue stages", Array.isArray(generatedClues) && generatedClues.length === 3, `Count: ${generatedClues?.length}`);

    if (generatedClues && generatedClues.length > 0) {
      const clue1 = generatedClues[0];
      record("Clue stage 1 has title and prompt text", Boolean(clue1.title && clue1.clueText));
      record("Clue stage 1 provides expected answer to Admin", Boolean(clue1.expectedAnswer));
      record("Clue stage 1 provides guiding hint", Boolean(clue1.hintText));
      record("Clue stage 1 provides milestone breadcrumb", Boolean(clue1.unlockedBreadcrumbText));
    }

    // 4. Verify DRAFT quest is NOT visible on public /api/quests
    console.log("\n--- 4. Verifying DRAFT Quest Isolation from Public Board ---");
    const publicQuestsBeforePublish = await request("/api/quests?status=ACTIVE", {
      headers: { Cookie: rahulCookie },
    });
    const publicList1 = publicQuestsBeforePublish.json?.data || [];
    const draftFoundOnPublic = publicList1.some((q: any) => q._id === generatedQuest?._id);
    record("Draft quest is NOT visible on public active quest board", !draftFoundOnPublic);

    // 5. Test "Make Public" (Admin publishes quest to ACTIVE)
    console.log("\n--- 5. Testing Admin 'Make Public' (Publish Quest) ---");
    const publishRes = await request(`/api/admin/quests/${generatedQuest._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        targetStatus: "ACTIVE",
        reason: "Admin verified clues and published quest to campus board.",
      }),
    });
    record("Admin publish endpoint returns HTTP 200", publishRes.status === 200, JSON.stringify(publishRes.json));

    // 6. Verify quest is NOW visible to students on public board
    console.log("\n--- 6. Verifying Published Quest on Student Quest Board ---");
    const publicQuestsAfterPublish = await request(`/api/quests?status=ACTIVE&limit=50&search=${encodeURIComponent(generatedQuest.questCode)}`, {
      headers: { Cookie: rahulCookie },
    });
    const publicList2 = publicQuestsAfterPublish.json?.data || [];
    const publishedQuestOnBoard = publicList2.find((q: any) => q._id === generatedQuest?._id || q.questCode === generatedQuest?.questCode);
    record("Published quest is NOW visible on student quest board", Boolean(publishedQuestOnBoard));
    record("Quest on student board has isCompletedByUser: false", publishedQuestOnBoard?.isCompletedByUser === false);

    // 7. Test Student Starts the Quest
    console.log("\n--- 7. Testing Student Accepting / Starting Quest ---");
    const startRes = await request(`/api/quests/${generatedQuest._id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: rahulCookie,
      },
      body: JSON.stringify({ asSquad: false }),
    });
    record("Quest start returns HTTP 201 with investigationId", startRes.status === 201 && Boolean(startRes.json?.data?.investigationId), JSON.stringify(startRes.json));
    const invId = startRes.json?.data?.investigationId;

    // Verify calling start while IN_PROGRESS resumes room
    const resumeRes = await request(`/api/quests/${generatedQuest._id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: rahulCookie,
      },
      body: JSON.stringify({ asSquad: false }),
    });
    record("Resuming in-progress quest returns HTTP 200 with same investigationId", resumeRes.status === 200 && resumeRes.json?.data?.investigationId === invId);

    // 8. Test Solving Clues and Completing Quest
    console.log("\n--- 8. Solving Clues via AI Answer Keys and Completing Quest ---");
    for (const clue of generatedClues) {
      const solveRes = await request(`/api/quests/${generatedQuest._id}/solve-clue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: rahulCookie,
        },
        body: JSON.stringify({
          stageOrder: clue.stageOrder,
          submittedAnswer: clue.expectedAnswer,
          investigationId: invId,
        }),
      });
      record(`Solved clue Stage ${clue.stageOrder} with answer '${clue.expectedAnswer}'`, solveRes.status === 200, JSON.stringify(solveRes.json));
    }

    // Now submit recovery / safe handover to complete investigation
    const recoverRes = await request(`/api/investigations/${invId}/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: rahulCookie,
      },
      body: JSON.stringify({
        recoveryNotes: "Recovered test target and verified with lab officer.",
      }),
    });
    record("Recovery endpoint returns HTTP 200", recoverRes.status === 200, JSON.stringify(recoverRes.json));
    record("Recovery marks status as COMPLETED", recoverRes.json?.data?.status === "COMPLETED");

    // 9. CRITICAL TEST: Strict Multi-Entry Guard
    console.log("\n--- 9. Testing Strict Multi-Entry Prevention ---");
    const duplicateSoloStart = await request(`/api/quests/${generatedQuest._id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: rahulCookie,
      },
      body: JSON.stringify({ asSquad: false }),
    });
    record("Solo re-start on completed quest is REJECTED with HTTP 400", duplicateSoloStart.status === 400, JSON.stringify(duplicateSoloStart.json));
    record("Solo re-start returns code 'ALREADY_COMPLETED'", duplicateSoloStart.json?.code === "ALREADY_COMPLETED", JSON.stringify(duplicateSoloStart.json));
    record("Solo re-start returns multi-entry blocked message", typeof duplicateSoloStart.json?.error === "string" && duplicateSoloStart.json?.error.includes("already completed"), JSON.stringify(duplicateSoloStart.json));

    const duplicateSquadStart = await request(`/api/quests/${generatedQuest._id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: rahulCookie,
      },
      body: JSON.stringify({ asSquad: true }),
    });
    record("Squad re-start on completed quest is REJECTED with HTTP 400", duplicateSquadStart.status === 400, JSON.stringify(duplicateSquadStart.json));
    record("Squad re-start returns code 'ALREADY_COMPLETED'", duplicateSquadStart.json?.code === "ALREADY_COMPLETED", JSON.stringify(duplicateSquadStart.json));

    // Calling recover again on completed investigation is also blocked
    const duplicateRecover = await request(`/api/investigations/${invId}/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: rahulCookie,
      },
      body: JSON.stringify({ recoveryNotes: "Trying to claim again" }),
    });
    record("Duplicate reward recovery is REJECTED with HTTP 400 ALREADY_COMPLETED", duplicateRecover.status === 400 && duplicateRecover.json?.error?.code === "ALREADY_COMPLETED", JSON.stringify(duplicateRecover.json));

    // 10. Verify Completed Quest Reflects on /api/quests & Detail
    console.log("\n--- 10. Verifying Completed Quest Annotation & Separation ---");
    const questsListAfterCompletion = await request("/api/quests?status=ACTIVE", {
      headers: { Cookie: rahulCookie },
    });
    const completedOnList = (questsListAfterCompletion.json?.data || []).find((q: any) => q._id === generatedQuest._id);
    record("Quest is returned with isCompletedByUser: true", completedOnList?.isCompletedByUser === true);
    record("Quest is returned with userInvestigationStatus: 'COMPLETED'", completedOnList?.userInvestigationStatus === "COMPLETED");
    record("Quest provides userInvestigationId matching completed room", completedOnList?.userInvestigationId === invId);

    const questDetailAfter = await request(`/api/quests/${generatedQuest._id}`, {
      headers: { Cookie: rahulCookie },
    });
    const detailData = questDetailAfter.json?.data;
    record("Quest detail returns isCompletedByUser: true", detailData?.quest?.isCompletedByUser === true);
    record("Quest detail returns all completed clue stages for dossier review", Array.isArray(detailData?.clues) && detailData.clues.length === 3);

    console.log("\n=================================================================");
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log(`  FINAL RESULT: ${passedCount} / ${totalCount} TESTS PASSED`);
    console.log("=================================================================\n");

    if (passedCount === totalCount) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTestSuite();

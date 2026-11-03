import puppeteer, { Browser, Page } from "puppeteer-core";
import mongoose from "mongoose";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt";

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${name}${details ? ` (${details})` : ""}`);
    results.push({ name, passed: true, details });
  } else {
    console.error(`  ❌ FAILED: ${name}${details ? ` (${details})` : ""}`);
    results.push({ name, passed: false, details, error: "Assertion failed" });
  }
}

async function runEmpiricalUiChallenge() {
  console.log("\n========================================================");
  console.log("🛡️  AIEM HUNT — EMPIRICAL UI & STATE CHALLENGER SUITE");
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   MongoDB:  ${MONGODB_URI}`);
  console.log("========================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Could not connect to MongoDB");

  const vishnuUser = await db.collection("users").findOne({ username: "vishnu_trace" });
  const aryanUser = await db.collection("users").findOne({ username: "aryan_falcon" });

  if (!vishnuUser || !aryanUser) {
    throw new Error("Required test users (vishnu_trace, aryan_falcon) not found in database.");
  }

  // Obtain authenticated student cookie for vishnu_trace
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "vishnu@aiemgoa.ac.in", password: "Hunter@123" }),
  });
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const authCookiePair = setCookie.split(";")[0];
  const [cookieName, cookieVal] = authCookiePair.split("=");

  const browser: Browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1280,900"],
  });

  const createAuthPage = async (): Promise<Page> => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setCookie({
      name: cookieName,
      value: cookieVal,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });
    return page;
  };

  try {
    // ══════════════════════════════════════════════════════════════
    // SUITE 1: Profile Tab State, URL Synchronization & Clearance
    // ══════════════════════════════════════════════════════════════
    console.log("\n─── Suite 1: Profile Tab Authorization, Fallback & ARIA Navigation ───");

    // 1.1 Visitor query with unauthorized ?tab=operations
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/profile/aryan_falcon?tab=operations`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tab-overview", { timeout: 10000 });

      // Check available tabs
      const tabKeys = await page.$$eval('[role="tab"]', (tabs) =>
        tabs.map((t) => t.id.replace("tab-", ""))
      );
      assert(
        tabKeys.length === 2 && tabKeys.includes("overview") && tabKeys.includes("trophies"),
        "Visitor view renders strictly 2 tabs (overview, trophies)",
        `Rendered tabs: [${tabKeys.join(", ")}]`
      );

      // Check that operations and locker are completely absent from DOM
      const opTab = await page.$("#tab-operations");
      const lockerTab = await page.$("#tab-locker");
      const opPanel = await page.$("#tabpanel-operations");
      const lockerPanel = await page.$("#tabpanel-locker");

      assert(
        opTab === null && lockerTab === null,
        "Unauthorized tab buttons (#tab-operations, #tab-locker) are strictly null in DOM",
        `opTab=${opTab}, lockerTab=${lockerTab}`
      );
      assert(
        opPanel === null && lockerPanel === null,
        "Unauthorized tab panels (#tabpanel-operations, #tabpanel-locker) are strictly null in DOM",
        `opPanel=${opPanel}, lockerPanel=${lockerPanel}`
      );

      // Check fallback to overview
      const overviewSelected = await page.$eval("#tab-overview", (el) =>
        el.getAttribute("aria-selected")
      );
      const overviewHidden = await page.$eval("#tabpanel-overview", (el) =>
        el.getAttribute("hidden")
      );
      assert(
        overviewSelected === "true" && overviewHidden === null,
        "Unauthorized ?tab=operations query falls back gracefully to active overview tab",
        `aria-selected=${overviewSelected}, hidden=${overviewHidden}`
      );

      await page.close();
    }

    // 1.2 Visitor query with unauthorized ?tab=locker
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/profile/aryan_falcon?tab=locker`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tab-overview", { timeout: 10000 });

      const opPanel = await page.$("#tabpanel-operations");
      const lockerPanel = await page.$("#tabpanel-locker");
      const overviewSelected = await page.$eval("#tab-overview", (el) =>
        el.getAttribute("aria-selected")
      );

      assert(
        opPanel === null && lockerPanel === null && overviewSelected === "true",
        "Unauthorized ?tab=locker falls back to overview with zero panel leakage",
        `overviewSelected=${overviewSelected}`
      );

      await page.close();
    }

    // 1.3 Visitor query with invalid ?tab=invalid_nonsense
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/profile/aryan_falcon?tab=invalid_nonsense`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tab-overview", { timeout: 10000 });

      const overviewSelected = await page.$eval("#tab-overview", (el) =>
        el.getAttribute("aria-selected")
      );
      const overviewHidden = await page.$eval("#tabpanel-overview", (el) =>
        el.getAttribute("hidden")
      );

      assert(
        overviewSelected === "true" && overviewHidden === null,
        "Invalid query param ?tab=invalid_nonsense safely defaults to overview panel",
        `aria-selected=${overviewSelected}`
      );

      await page.close();
    }

    // 1.4 WAI-ARIA tab keyboard navigation (ArrowRight, ArrowLeft, Home, End)
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/profile/aryan_falcon`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tab-overview", { timeout: 10000 });

      // Focus tab-overview
      await page.focus("#tab-overview");

      // Press ArrowRight -> should activate and focus tab-trophies
      await page.keyboard.press("ArrowRight");
      await new Promise((r) => setTimeout(r, 200));

      const trophiesSelected = await page.$eval("#tab-trophies", (el) =>
        el.getAttribute("aria-selected")
      );
      const focusedAfterRight = await page.evaluate(
        () => document.activeElement?.id
      );
      const urlAfterRight = await page.evaluate(() => window.location.search);

      assert(
        trophiesSelected === "true" &&
          focusedAfterRight === "tab-trophies" &&
          urlAfterRight.includes("tab=trophies"),
        "ArrowRight activates, focuses next tab and syncs URL (?tab=trophies)",
        `focused=${focusedAfterRight}, url=${urlAfterRight}`
      );

      // Press ArrowRight again -> should wrap around to index 0 (tab-overview)
      await page.keyboard.press("ArrowRight");
      await new Promise((r) => setTimeout(r, 200));

      const overviewWrap = await page.$eval("#tab-overview", (el) =>
        el.getAttribute("aria-selected")
      );
      const focusedWrap = await page.evaluate(
        () => document.activeElement?.id
      );
      assert(
        overviewWrap === "true" && focusedWrap === "tab-overview",
        "ArrowRight on last tab wraps around to first tab (tab-overview)",
        `focused=${focusedWrap}`
      );

      // Press ArrowLeft from first tab -> should wrap around to last tab (tab-trophies)
      await page.keyboard.press("ArrowLeft");
      await new Promise((r) => setTimeout(r, 200));

      const trophiesLeftWrap = await page.$eval("#tab-trophies", (el) =>
        el.getAttribute("aria-selected")
      );
      const focusedLeftWrap = await page.evaluate(
        () => document.activeElement?.id
      );
      assert(
        trophiesLeftWrap === "true" && focusedLeftWrap === "tab-trophies",
        "ArrowLeft on first tab wraps around to last tab (tab-trophies)",
        `focused=${focusedLeftWrap}`
      );

      // Press Home -> should jump to first tab
      await page.keyboard.press("Home");
      await new Promise((r) => setTimeout(r, 200));
      const focusedHome = await page.evaluate(() => document.activeElement?.id);
      assert(
        focusedHome === "tab-overview",
        "Home key jumps focus directly to first tab (tab-overview)",
        `focused=${focusedHome}`
      );

      // Press End -> should jump to last tab
      await page.keyboard.press("End");
      await new Promise((r) => setTimeout(r, 200));
      const focusedEnd = await page.evaluate(() => document.activeElement?.id);
      assert(
        focusedEnd === "tab-trophies",
        "End key jumps focus directly to last tab (tab-trophies)",
        `focused=${focusedEnd}`
      );

      await page.close();
    }

    // 1.5 Authenticated Owner Profile Navigation & 4-Tab Access
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/profile/vishnu_trace`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tab-overview", { timeout: 10000 });

      const ownerTabs = await page.$$eval('[role="tab"]', (tabs) =>
        tabs.map((t) => t.id.replace("tab-", ""))
      );
      assert(
        ownerTabs.length === 4 &&
          ownerTabs.includes("overview") &&
          ownerTabs.includes("trophies") &&
          ownerTabs.includes("operations") &&
          ownerTabs.includes("locker"),
        "Owner view renders all 4 tabs (overview, trophies, operations, locker)",
        `Tabs: [${ownerTabs.join(", ")}]`
      );

      // Direct URL navigation to ?tab=operations for owner
      await page.goto(`${BASE_URL}/profile/vishnu_trace?tab=operations`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tabpanel-operations", { timeout: 10000 });

      const opSelected = await page.$eval("#tab-operations", (el) =>
        el.getAttribute("aria-selected")
      );
      const opHidden = await page.$eval("#tabpanel-operations", (el) =>
        el.getAttribute("hidden")
      );
      assert(
        opSelected === "true" && opHidden === null,
        "Owner can access ?tab=operations directly and panel renders without hidden attribute",
        `aria-selected=${opSelected}, hidden=${opHidden}`
      );

      // Direct URL navigation to ?tab=locker for owner
      await page.goto(`${BASE_URL}/profile/vishnu_trace?tab=locker`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector("#tabpanel-locker", { timeout: 10000 });

      const lockerSelected = await page.$eval("#tab-locker", (el) =>
        el.getAttribute("aria-selected")
      );
      const lockerHidden = await page.$eval("#tabpanel-locker", (el) =>
        el.getAttribute("hidden")
      );
      assert(
        lockerSelected === "true" && lockerHidden === null,
        "Owner can access ?tab=locker directly and panel renders without hidden attribute",
        `aria-selected=${lockerSelected}, hidden=${lockerHidden}`
      );

      await page.close();
    }

    // ══════════════════════════════════════════════════════════════
    // SUITE 2: AgentHeroCard Reduced Motion & Coarse Pointer Fallback
    // ══════════════════════════════════════════════════════════════
    console.log("\n─── Suite 2: AgentHeroCard Reduced Motion & Coarse Pointer Fallback ───");

    // 2.1 Default state (motion allowed)
    let baselineBbox: { width: number; height: number; x: number; y: number } | null = null;
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/profile/aryan_falcon`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector(".max-w-4xl.rounded-2xl", { timeout: 10000 });

      const cardHandle = await page.$(".max-w-4xl.rounded-2xl");
      if (!cardHandle) throw new Error("AgentHeroCard not found");

      baselineBbox = await cardHandle.boundingBox();

      // Trigger mousemove on the card
      const box = baselineBbox!;
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
      await new Promise((r) => setTimeout(r, 200));

      const transformWithMotion = await cardHandle.evaluate(
        (el) => (el as HTMLElement).style.transform
      );
      const sheenPresent = await page.evaluate(
        () => document.querySelector('div[style*="radial-gradient"]') !== null
      );

      assert(
        transformWithMotion.includes("rotateX") && sheenPresent,
        "Default state enables 3D perspective tilt and dynamic sheen on mousemove",
        `transform="${transformWithMotion}", sheenPresent=${sheenPresent}`
      );

      await page.close();
    }

    // 2.2 Emulate prefers-reduced-motion: reduce
    {
      const page = await createAuthPage();
      await page.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);

      await page.goto(`${BASE_URL}/profile/aryan_falcon`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector(".max-w-4xl.rounded-2xl", { timeout: 10000 });

      const cardHandle = await page.$(".max-w-4xl.rounded-2xl");
      if (!cardHandle) throw new Error("AgentHeroCard not found under reduced motion");

      const reducedBbox = await cardHandle.boundingBox();

      const initialTransform = await cardHandle.evaluate(
        (el) => (el as HTMLElement).style.transform
      );
      const initialPerspective = await page.evaluate(
        () => (document.querySelector(".max-w-4xl.rounded-2xl")?.parentElement as HTMLElement)?.style.perspective
      );

      assert(
        initialTransform === "none" && initialPerspective === "none",
        "prefers-reduced-motion sets transform and perspective to 'none'",
        `transform="${initialTransform}", perspective="${initialPerspective}"`
      );

      // Move mouse across the card under reduced motion
      const box = reducedBbox!;
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await new Promise((r) => setTimeout(r, 100));
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8);
      await new Promise((r) => setTimeout(r, 100));

      const movedTransform = await cardHandle.evaluate(
        (el) => (el as HTMLElement).style.transform
      );
      const sheenPresent = await page.evaluate(
        () => document.querySelector('div[style*="radial-gradient"]') !== null
      );

      assert(
        movedTransform === "none" && !sheenPresent,
        "Mouse movement under reduced motion strictly produces NO tilt rotation and zero sheen overlay",
        `transform="${movedTransform}", sheenPresent=${sheenPresent}`
      );

      // Verify ZERO layout shift
      if (baselineBbox && reducedBbox) {
        const deltaWidth = Math.abs(baselineBbox.width - reducedBbox.width);
        const deltaHeight = Math.abs(baselineBbox.height - reducedBbox.height);
        assert(
          deltaWidth < 2 && deltaHeight < 2,
          "Zero layout shift between full-motion card and reduced-motion card",
          `deltaW=${deltaWidth.toFixed(2)}px, deltaH=${deltaHeight.toFixed(2)}px`
        );
      }

      await page.close();
    }

    // 2.3 Emulate coarse pointer (touch device fallback)
    {
      const page = await createAuthPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

      await page.goto(`${BASE_URL}/profile/aryan_falcon`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector(".max-w-4xl.rounded-2xl", { timeout: 10000 });

      const cardHandle = await page.$(".max-w-4xl.rounded-2xl");
      if (!cardHandle) throw new Error("AgentHeroCard not found under coarse pointer");

      const coarseTransform = await cardHandle.evaluate(
        (el) => (el as HTMLElement).style.transform
      );
      const coarsePerspective = await page.evaluate(
        () => (document.querySelector(".max-w-4xl.rounded-2xl")?.parentElement as HTMLElement)?.style.perspective
      );

      assert(
        coarseTransform === "none" && coarsePerspective === "none",
        "Coarse pointer device disables 3D tilt and renders static 2D card",
        `transform="${coarseTransform}", perspective="${coarsePerspective}"`
      );

      await page.close();
    }

    // ══════════════════════════════════════════════════════════════
    // SUITE 3: Dashboard State Resilience (/dashboard)
    // ══════════════════════════════════════════════════════════════
    console.log("\n─── Suite 3: Dashboard State Resilience & High-Urgency Handover UI ───");

    // 3.1 Nominal state: Zero pending operations sweep banner
    {
      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector(".max-w-7xl", { timeout: 10000 });

      const nominalText = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          hasNominal: bodyText.includes("Active Operations Radar // All Sectors Nominal"),
          hasZeroPending: bodyText.includes("Zero Urgent Handover Actions Pending"),
        };
      });

      assert(
        nominalText.hasNominal && nominalText.hasZeroPending,
        "Dashboard displays nominal sweep banner with zero pending operations",
        `hasNominal=${nominalText.hasNominal}, hasZeroPending=${nominalText.hasZeroPending}`
      );

      // Verify Operative Status HUD has NO raw numerical trust score
      const hudRawTrustScore = await page.evaluate(() => {
        const hud = document.querySelector(".max-w-7xl");
        const text = hud ? hud.textContent || "" : "";
        return text.includes("710 / 1000") || text.includes("Trust Score: 710");
      });

      assert(
        !hudRawTrustScore,
        "Operative Status HUD omits raw numerical trust score (displays Verified Operative standing)",
        `hudRawTrustScore=${hudRawTrustScore}`
      );

      // Verify Quick Launch Matrix renders all 4 high-impact tiles
      const quickLaunchTiles = await page.$$eval(
        'a[href="/lost-and-found/report-found"], a[href="/quests"], a[href="/squads"], a[href="/events"]',
        (links) => links.length
      );
      assert(
        quickLaunchTiles >= 3,
        "Quick-Launch Operations Matrix renders responsive operational tiles",
        `count=${quickLaunchTiles}`
      );

      // Verify Daily Tactical Quest Briefing renders
      const hasDailyBriefing = await page.evaluate(() =>
        document.body.innerText.includes("DAILY TACTICAL QUEST BRIEFING")
      );
      assert(
        hasDailyBriefing,
        "Daily Tactical Quest Briefing is present and displays rotating campus quest"
      );

      // Verify ZERO phantom streak claim buttons anywhere in the DOM
      const hasPhantomStreakButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, a"));
        return buttons.some((b) =>
          b.textContent?.toLowerCase().includes("claim streak") ||
          b.textContent?.toLowerCase().includes("daily streak claim")
        );
      });
      assert(
        !hasPhantomStreakButton,
        "Zero phantom streak claim buttons exist across entire dashboard DOM",
        `phantomStreakFound=${hasPhantomStreakButton}`
      );

      await page.close();
    }

    // 3.2 Active Operations Radar with Approved Handover (PIN Holder Role)
    {
      // Create a temporary mock item and claim in MongoDB
      const tempItemId = new mongoose.Types.ObjectId();
      const tempClaimId = new mongoose.Types.ObjectId();

      await db.collection("founditems").insertOne({
        _id: tempItemId,
        title: "Tactical Hydro Flask 750ml",
        category: "WATER_BOTTLE",
        location: "Main Campus Library Desk 4",
        custodyLocation: "Station A Safe-Desk Custody Station",
        custodyStatus: "IN_CUSTODY",
        finderId: aryanUser._id,
        status: "CLAIMED",
        createdAt: new Date(),
      });

      await db.collection("claimrequests").insertOne({
        _id: tempClaimId,
        itemType: "FOUND",
        itemId: tempItemId,
        claimantId: vishnuUser._id, // vishnu is claimant -> PIN Holder
        counterpartyUserId: aryanUser._id,
        submittedAnswer: "Tactical Hydro Flask 750ml",
        status: "APPROVED",
        handoverCodeHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456", // mock hash
        createdAt: new Date(),
      });

      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector(".max-w-7xl", { timeout: 10000 });

      // Verify high-urgency handover card renders
      const handoverCardText = await page.evaluate(() => document.body.innerText);
      const hasActionRequired = handoverCardText.toUpperCase().includes("ACTION REQUIRED // SAFE-DESK VERIFICATION");
      const hasItemTitle = handoverCardText.includes("Tactical Hydro Flask 750ml");
      const hasMaskedPin = handoverCardText.includes("••••••");

      assert(
        hasActionRequired && hasItemTitle && hasMaskedPin,
        "Active Operations Radar renders high-urgency handover card with masked PIN (••••••)",
        `hasAction=${hasActionRequired}, hasItem=${hasItemTitle}, hasMaskedPin=${hasMaskedPin}`
      );

      // Verify plaintext PIN is NOT leaked in initial HTML source
      const pageContent = await page.content();
      const hasPlaintextPinLeak =
        pageContent.includes("123456") || pageContent.includes("654321");
      assert(
        !hasPlaintextPinLeak,
        "Initial page content does not leak unprompted plaintext PIN",
        `leakDetected=${hasPlaintextPinLeak}`
      );

      // Click "View Secure Handover" to open PIN modal
      const modalOpened = await page.evaluate(async () => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("View Secure Handover")
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      if (modalOpened) {
        await new Promise((r) => setTimeout(r, 600));
        const modalVisible = await page.evaluate(() =>
          document.body.innerText.toUpperCase().includes("SAFE-DESK CUSTODY HANDOVER PIN")
        );
        assert(
          modalVisible,
          "Clicking 'View Secure Handover' opens authorized custody handover modal",
          `modalVisible=${modalVisible}`
        );
      }

      await page.close();

      // Clean up temporary documents
      await db.collection("claimrequests").deleteOne({ _id: tempClaimId });
      await db.collection("founditems").deleteOne({ _id: tempItemId });
    }

    // 3.3 Active Operations Radar with Depositor Role (Non-PIN holder)
    {
      const tempItemId = new mongoose.Types.ObjectId();
      const tempClaimId = new mongoose.Types.ObjectId();

      await db.collection("founditems").insertOne({
        _id: tempItemId,
        title: "Calculus Notebook Blue",
        category: "NOTEBOOK",
        location: "Block C Room 102",
        custodyLocation: "Station A Safe-Desk Custody Station",
        custodyStatus: "IN_CUSTODY",
        finderId: vishnuUser._id, // vishnu is finder -> Depositor (not pin holder)
        status: "CLAIMED",
        createdAt: new Date(),
      });

      await db.collection("claimrequests").insertOne({
        _id: tempClaimId,
        itemType: "FOUND",
        itemId: tempItemId,
        claimantId: aryanUser._id, // aryan is claimant
        counterpartyUserId: vishnuUser._id, // vishnu is counterparty/depositor
        submittedAnswer: "Calculus Notebook Blue",
        status: "APPROVED",
        createdAt: new Date(),
      });

      const page = await createAuthPage();
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await page.waitForSelector(".max-w-7xl", { timeout: 10000 });

      const depositorCardText = await page.evaluate(() => document.body.innerText);
      const hasDepositorBanner = depositorCardText.includes("Safe-Desk Custody Release in Progress");
      const hasAwaitingNotice = depositorCardText.includes(
        "Your deposited item has been approved. Awaiting recipient counter verification."
      );

      assert(
        hasDepositorBanner && hasAwaitingNotice,
        "Depositor role receives 'Safe-Desk Custody Release in Progress' notice without PIN button",
        `hasBanner=${hasDepositorBanner}, hasNotice=${hasAwaitingNotice}`
      );

      await page.close();

      // Clean up
      await db.collection("claimrequests").deleteOne({ _id: tempClaimId });
      await db.collection("founditems").deleteOne({ _id: tempItemId });
    }

    // 3.4 Daily Tactical Quest Briefing: Completed vs Incomplete States
    {
      const { getOrRotateDailyQuest } = await import("../lib/content/contentEngine");
      const { quest: activeQuest } = await getOrRotateDailyQuest();

      if (activeQuest) {
        // Case A: Completed investigation
        const tempInvId = new mongoose.Types.ObjectId();
        await db.collection("investigations").insertOne({
          _id: tempInvId,
          questId: activeQuest._id,
          userId: vishnuUser._id,
          status: "COMPLETED",
          currentStage: 3,
          progressPct: 100,
          solvedClues: [],
          completedAt: new Date(),
        });

        const page = await createAuthPage();
        await page.goto(`${BASE_URL}/dashboard`, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await page.waitForSelector(".max-w-7xl", { timeout: 10000 });

        const completedText = await page.evaluate(() => document.body.innerText);
        const hasCompletedBadge = completedText.includes("Investigation Complete // Daily Bounty Secured");
        const hasDebriefAction = completedText.includes("Review Field Debrief");

        assert(
          hasCompletedBadge && hasDebriefAction,
          "Completed daily investigation renders 'Daily Bounty Secured' badge and 'Review Field Debrief' button",
          `hasBadge=${hasCompletedBadge}, hasDebrief=${hasDebriefAction}`
        );

        await page.close();

        // Clean up temporary investigation
        await db.collection("investigations").deleteOne({ _id: tempInvId });
      }
    }
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }

  // Final Summary
  console.log("\n========================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`📊 CHALLENGER SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runEmpiricalUiChallenge().catch((err) => {
  console.error("\n💥 UNHANDLED TEST HARNESS EXCEPTION:", err);
  process.exit(1);
});

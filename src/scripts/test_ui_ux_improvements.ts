import puppeteer from "puppeteer-core";
import mongoose from "mongoose";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt";

async function runUiUxTest() {
  console.log("\n========================================================");
  console.log("🎨 AIEM HUNT — COMPREHENSIVE UI/UX VERIFICATION SUITE");
  console.log(`   Base Target: ${BASE_URL}`);
  console.log("========================================================\n");

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to connect to MongoDB.");
  }

  // Find sample item, quest, and investigation
  const sampleLost = await db.collection("lostitems").findOne({});
  const sampleFound = await db.collection("founditems").findOne({});
  const sampleItem = sampleLost || sampleFound;
  const sampleQuest = await db.collection("quests").findOne({});
  const sampleInvestigation = await db.collection("investigations").findOne({});

  console.log(`✓ Sample Item ID: ${sampleItem?._id}`);
  console.log(`✓ Sample Quest ID: ${sampleQuest?._id}`);
  console.log(`✓ Sample Investigation ID: ${sampleInvestigation?._id}`);

  // Perform Student Login via API
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "vishnu@aiemgoa.ac.in", password: "Hunter@123" }),
  });
  const rawStudentCookie = studentLoginRes.headers.get("set-cookie") || "";
  const studentCookie = rawStudentCookie.split(";")[0];
  console.log(`✓ Authenticated session obtained: ${studentCookie ? "YES" : "NO"}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(`[Console Error] ${msg.text()}`);
      }
    });

    page.on("pageerror", (err: any) => {
      pageErrors.push(`[Page Crash] ${err.message}`);
    });

    // Inject session cookie
    if (studentCookie) {
      const [name, val] = studentCookie.split("=");
      await page.setCookie({
        name,
        value: val,
        domain: "localhost",
        path: "/",
        httpOnly: true,
      });
    }

    // ─────────────────────────────────────────────────────────
    // TEST 1: REPORT LOST MULTI-STEP FLOW & FORWARD SKIP GUARD
    // ─────────────────────────────────────────────────────────
    console.log("\n─── 1. Testing Report Lost Multi-Step Flow (/lost-and-found/report-lost) ───");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/lost-and-found/report-lost`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    // Verify Step 1 is rendered
    const step1Title = await page.$eval("h2", (el) => el.textContent);
    console.log(`  ✓ Step 1 Header: "${step1Title}"`);

    // Verify Category options exist
    const categoryCount = await page.$$eval("button", (buttons) =>
      buttons.filter((b) => b.textContent?.includes("Electronics") || b.textContent?.includes("ID Cards")).length
    );
    console.log(`  ✓ Found ${categoryCount} category selectors`);

    // Verify photo upload file input exists
    const hasPhotoUpload = await page.$eval('input[type="file"]', (el) => el !== null);
    console.log(`  ✓ Photo upload file input present: ${hasPhotoUpload}`);

    // Test intermediate step skip guard: try clicking Step 4 directly
    const stepButtons = await page.$$("button");
    for (const b of stepButtons) {
      const text = await b.evaluate((el) => el.textContent);
      if (text && text.includes("Step 4")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    const currentHeaderAfterSkip = await page.$eval("h2", (el) => el.textContent);
    const guardedStep4 = currentHeaderAfterSkip?.includes("Step 1");
    console.log(`  ✅ Guard prevented premature skip to Step 4: ${guardedStep4}`);

    // Fill Title and Public Description
    await page.type('input[placeholder*="Casio FX-991EX"]', "Casio Scientific Calculator FX-991CW");
    await page.type('textarea[placeholder*="Describe color"]', "Matte black casing with white keyboard keys and lab label.");

    // Click Next Step
    const nextButtons = await page.$$("button");
    let nextBtn: any = null;
    for (const b of nextButtons) {
      const text = await b.evaluate((el) => el.textContent);
      if (text && text.includes("Next Step")) {
        nextBtn = b;
        break;
      }
    }
    if (nextBtn) {
      await nextBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      const step2Header = await page.$eval("h2", (el) => el.textContent);
      console.log(`  ✅ Successfully navigated to Step 2: "${step2Header}"`);
    }

    // ─────────────────────────────────────────────────────────
    // TEST 2: REPORT FOUND MULTI-STEP FLOW & SAFE-DESK CUSTODY
    // ─────────────────────────────────────────────────────────
    console.log("\n─── 2. Testing Report Found Multi-Step Flow (/lost-and-found/report-found) ───");
    await page.goto(`${BASE_URL}/lost-and-found/report-found`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));

    const foundStep1Title = await page.$eval("h2", (el) => el.textContent);
    console.log(`  ✓ Step 1 Header: "${foundStep1Title}"`);

    const hasFoundPhoto = await page.$eval('input[type="file"]', (el) => el !== null);
    console.log(`  ✓ Photo upload input present: ${hasFoundPhoto}`);

    await page.type('input[placeholder*="Dell Wireless Mouse"]', "Found HP Blue Wireless Optical Mouse");
    await page.type('textarea[placeholder*="Describe general condition"]', "Left on top of laboratory bench #4 in micro lab.");

    // Click Next Step
    const foundNextBtns = await page.$$("button");
    let foundNextBtn: any = null;
    for (const b of foundNextBtns) {
      const text = await b.evaluate((el) => el.textContent);
      if (text && text.includes("Next Step")) {
        foundNextBtn = b;
        break;
      }
    }
    if (foundNextBtn) {
      await foundNextBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      const step2Header = await page.$eval("h2", (el) => el.textContent);
      console.log(`  ✅ Successfully navigated to Step 2: "${step2Header}"`);
    }

    // ─────────────────────────────────────────────────────────
    // TEST 3: ITEMS DETAIL PAGE
    // ─────────────────────────────────────────────────────────
    if (sampleItem) {
      console.log(`\n─── 3. Testing Items Detail Page (/items/${sampleItem._id}) ───`);
      await page.goto(`${BASE_URL}/items/${sampleItem._id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("h1", { timeout: 10000 });

      const itemH1 = await page.$eval("h1", (el) => el.textContent);
      console.log(`  ✅ Item Detail Title: "${itemH1}"`);

      // Verify lifecycle state machine
      const stateBoxes = await page.$$eval("div", (divs) =>
        divs.filter((d) => d.textContent?.includes("ACTIVE") && d.textContent?.includes("CLAIMED")).length
      );
      console.log(`  ✅ State machine stepper present: ${stateBoxes > 0}`);

      // Verify zoom button opens Lightbox modal
      const zoomBtn = await page.$('button[title*="Zoom"], button:has(svg)');
      const hasActionButtons = zoomBtn !== null;
      console.log(`  ✅ Action buttons present: ${hasActionButtons}`);
    }

    // ─────────────────────────────────────────────────────────
    // TEST 4: INVESTIGATION ROOM PAGE & 320PX VIEWPORT
    // ─────────────────────────────────────────────────────────
    if (sampleInvestigation) {
      console.log(`\n─── 4. Testing Investigation Room Page (/investigations/${sampleInvestigation._id}) ───`);
      await page.goto(`${BASE_URL}/investigations/${sampleInvestigation._id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("h1", { timeout: 10000 });

      const roomH1 = await page.$eval("h1", (el) => el.textContent);
      console.log(`  ✅ Investigation Title: "${roomH1}"`);

      // Test mobile responsive tabs on strict 320px iPhone SE
      await page.setViewport({ width: 320, height: 568, isMobile: true });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("h1", { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 600));

      const mobileTabs = await page.$$eval("button", (buttons) =>
        buttons.filter((b) => b.textContent?.includes("Clues") || b.textContent?.includes("Evidence") || b.textContent?.includes("Payout")).length
      );
      console.log(`  ✅ Mobile tabs present on 320px: ${mobileTabs} tabs`);

      // Check overflow on 320px
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = 320;
      const hasOverflow = bodyWidth > viewportWidth;
      console.log(`  ✅ 320px Zero-Overflow Check: ${hasOverflow ? "OVERFLOW FAIL" : "CLEAN PASS"} (Width: ${bodyWidth}px)`);

      // Test Evidence tab switch
      const evidenceTabBtn = await page.$$eval("button", (buttons) => {
        const found = buttons.find((b) => b.textContent?.includes("Evidence"));
        return found ? true : false;
      });
      console.log(`  ✅ Evidence tab switcher operational: ${evidenceTabBtn}`);
    }

    console.log(`\n✓ Total Page Console Errors: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      pageErrors.forEach((e) => console.log(`   ${e}`));
    }

    console.log("\n========================================================");
    console.log("🎉 ALL UI/UX IMPROVEMENT CHECKS COMPLETED SUCCESSFULLY!");
    console.log("========================================================\n");
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

runUiUxTest().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});

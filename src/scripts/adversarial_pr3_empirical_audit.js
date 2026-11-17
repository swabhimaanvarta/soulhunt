const puppeteer = require("puppeteer-core");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function runEmpiricalAudit() {
  console.log("====================================================================");
  console.log("🔬 EMPIRICAL CHALLENGER: PR-3 NARROW 320PX SCREEN & TOUCH TARGET AUDIT");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("====================================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const assertions = [];

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      assertions.push({ name, pass: true });
    } else {
      console.error(`  ❌ FAIL: ${name} -> ${details}`);
      assertions.push({ name, pass: false, details });
    }
  }

  try {
    const page = await browser.newPage();

    // ─────────────────────────────────────────────────────────────
    // PART 1: STRESS TEST /map AT 320px
    // ─────────────────────────────────────────────────────────────
    console.log("--- PART 1: Testing /map Sector Filter Pills at 320px ---");
    await page.setViewport({ width: 320, height: 568 });
    await page.goto(`${BASE_URL}/map`, { waitUntil: "networkidle2", timeout: 25000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length > 0, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    // Assert 0px horizontal overflow on /map
    const mapOverflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const bodyW = document.body.scrollWidth;
      return { docW, winW, bodyW, diff: Math.max(docW, bodyW) - winW };
    });
    assert(
      "/map initial 320px viewport has 0px horizontal overflow",
      mapOverflow.diff <= 0,
      `docW=${mapOverflow.docW}, winW=${mapOverflow.winW}, diff=${mapOverflow.diff}px`
    );

    // Find and audit the sector filter pills container
    const mapPillsData = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button")).filter((b) =>
        ["All Sectors", "Safe-Desks", "Hunts", "Lost/Found"].includes(b.textContent.trim())
      );
      if (buttons.length === 0) return null;
      const container = buttons[0].parentElement;
      const containerStyle = window.getComputedStyle(container);
      return {
        count: buttons.length,
        overflowX: containerStyle.overflowX,
        hasNoScrollbar: container.classList.contains("no-scrollbar"),
        buttons: buttons.map((b) => ({
          text: b.textContent.trim(),
          flexShrink: window.getComputedStyle(b).flexShrink,
          width: b.getBoundingClientRect().width,
          height: b.getBoundingClientRect().height,
        })),
      };
    });

    assert("/map sector pills found in DOM", mapPillsData !== null, "Buttons not found");
    if (mapPillsData) {
      assert(
        `/map sector pills count is 4`,
        mapPillsData.count === 4,
        `Found ${mapPillsData.count}`
      );
      assert(
        `/map sector pills container has overflow-x: auto`,
        mapPillsData.overflowX === "auto" || mapPillsData.overflowX === "scroll",
        `overflowX = ${mapPillsData.overflowX}`
      );
      assert(
        `/map sector pills container has 'no-scrollbar' class`,
        mapPillsData.hasNoScrollbar,
        "Missing no-scrollbar class"
      );
      for (const btn of mapPillsData.buttons) {
        assert(
          `/map pill '${btn.text}' has flex-shrink: 0 (shrink-0)`,
          btn.flexShrink === "0",
          `flexShrink = ${btn.flexShrink}`
        );
      }
    }

    // Interactively click through each sector pill and verify 0px overflow persists
    for (const pillLabel of ["Safe-Desks", "Hunts", "Lost/Found", "All Sectors"]) {
      const clicked = await page.evaluate((label) => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent.trim() === label
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, pillLabel);
      await new Promise((r) => setTimeout(r, 400));
      const postClickOverflow = await page.evaluate(() => {
        return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
      });
      assert(
        `/map remains 0px overflow after clicking '${pillLabel}'`,
        clicked && postClickOverflow <= 0,
        `diff = ${postClickOverflow}px`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // PART 2: STRESS TEST /lost-and-found AT 320px
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- PART 2: Testing /lost-and-found Mode Toggle Buttons at 320px ---");
    await page.goto(`${BASE_URL}/lost-and-found`, { waitUntil: "networkidle2", timeout: 25000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length > 0, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 800));

    const lfOverflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const bodyW = document.body.scrollWidth;
      return { docW, winW, bodyW, diff: Math.max(docW, bodyW) - winW };
    });
    assert(
      "/lost-and-found initial 320px viewport has 0px horizontal overflow",
      lfOverflow.diff <= 0,
      `docW=${lfOverflow.docW}, winW=${lfOverflow.winW}, diff=${lfOverflow.diff}px`
    );

    const lfModeData = await page.evaluate(() => {
      const labels = ["Unified Directory", "Lost Items", "Found at Safe-Desks", "Recovered Feed"];
      const buttons = Array.from(document.querySelectorAll("button")).filter((b) =>
        labels.includes(b.textContent.trim())
      );
      if (buttons.length === 0) return null;
      const container = buttons[0].parentElement;
      const containerStyle = window.getComputedStyle(container);
      return {
        count: buttons.length,
        overflowX: containerStyle.overflowX,
        hasNoScrollbar: container.classList.contains("no-scrollbar"),
        buttons: buttons.map((b) => ({
          text: b.textContent.trim(),
          flexShrink: window.getComputedStyle(b).flexShrink,
          whiteSpace: window.getComputedStyle(b).whiteSpace,
          width: b.getBoundingClientRect().width,
          height: b.getBoundingClientRect().height,
        })),
      };
    });

    assert("/lost-and-found mode toggle buttons found in DOM", lfModeData !== null, "Buttons not found");
    if (lfModeData) {
      assert(
        "/lost-and-found segmented control count is 4",
        lfModeData.count === 4,
        `Found ${lfModeData.count}`
      );
      assert(
        "/lost-and-found segmented container has overflow-x: auto",
        lfModeData.overflowX === "auto" || lfModeData.overflowX === "scroll",
        `overflowX = ${lfModeData.overflowX}`
      );
      assert(
        "/lost-and-found segmented container has 'no-scrollbar' class",
        lfModeData.hasNoScrollbar,
        "Missing no-scrollbar class"
      );
      for (const btn of lfModeData.buttons) {
        assert(
          `/lost-and-found mode button '${btn.text}' has flex-shrink: 0 (shrink-0)`,
          btn.flexShrink === "0",
          `flexShrink = ${btn.flexShrink}`
        );
        assert(
          `/lost-and-found mode button '${btn.text}' has whitespace: nowrap`,
          btn.whiteSpace === "nowrap",
          `whiteSpace = ${btn.whiteSpace}`
        );
      }
    }

    // Interactively click through each mode and verify 0px overflow persists
    for (const modeLabel of ["Lost Items", "Found at Safe-Desks", "Recovered Feed", "Unified Directory"]) {
      const clicked = await page.evaluate((label) => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent.trim() === label
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, modeLabel);
      await new Promise((r) => setTimeout(r, 400));
      const postClickOverflow = await page.evaluate(() => {
        return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
      });
      assert(
        `/lost-and-found remains 0px overflow after switching to '${modeLabel}'`,
        clicked && postClickOverflow <= 0,
        `diff = ${postClickOverflow}px`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // PART 3: STRESS TEST /quests/[id] AT 320px
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- PART 3: Testing /quests/[id] Briefing Buttons & Grid at 320px ---");
    await page.goto(`${BASE_URL}/quests`, { waitUntil: "networkidle2", timeout: 25000 });
    const questHref = await page.evaluate(() => {
      const link = document.querySelector('a[href^="/quests/"]');
      return link ? link.getAttribute("href") : null;
    });

    const targetQuestUrl = questHref ? `${BASE_URL}${questHref}` : `${BASE_URL}/quests/1`;
    console.log(`  Targeting Quest Briefing URL: ${targetQuestUrl}`);

    await page.goto(targetQuestUrl, { waitUntil: "networkidle2", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 1000));

    const questPageOverflow = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const bodyW = document.body.scrollWidth;
      return { docW, winW, bodyW, diff: Math.max(docW, bodyW) - winW };
    });
    assert(
      `/quests/[id] 320px viewport has 0px horizontal overflow`,
      questPageOverflow.diff <= 0,
      `docW=${questPageOverflow.docW}, winW=${questPageOverflow.winW}, diff=${questPageOverflow.diff}px`
    );

    // Audit the action button container flex-wrap
    const questButtonRowData = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button, a")).filter((el) => {
        const text = el.textContent.trim();
        return (
          text.includes("Solo Recon") ||
          text.includes("Squad Raid") ||
          text.includes("Sign in to Hunt") ||
          text.includes("Resume Active Room")
        );
      });
      if (buttons.length === 0) return null;
      const container = buttons[0].parentElement;
      const containerStyle = window.getComputedStyle(container);
      return {
        count: buttons.length,
        flexWrap: containerStyle.flexWrap,
        display: containerStyle.display,
        buttons: buttons.map((b) => ({
          text: b.textContent.trim(),
          width: b.getBoundingClientRect().width,
          right: b.getBoundingClientRect().right,
        })),
        windowWidth: window.innerWidth,
      };
    });

    if (questButtonRowData) {
      assert(
        `/quests/[id] action buttons container has flex-wrap: wrap`,
        questButtonRowData.flexWrap === "wrap",
        `flexWrap = ${questButtonRowData.flexWrap}`
      );
      for (const btn of questButtonRowData.buttons) {
        assert(
          `/quests/[id] button '${btn.text}' right edge (${btn.right}px) is within viewport (${questButtonRowData.windowWidth}px)`,
          btn.right <= questButtonRowData.windowWidth + 2,
          `btn.right=${btn.right}px`
        );
      }
    } else {
      console.log("  ℹ️ Action buttons not currently rendered (may require active investigation state)");
    }

    // Audit the rewards 5-item grid at 320px
    const rewardsGridData = await page.evaluate(() => {
      const trophyCard = Array.from(document.querySelectorAll("div")).find((d) =>
        d.textContent.includes("Trophies") && d.textContent.includes("+")
      );
      if (!trophyCard) return null;
      const grid = trophyCard.parentElement;
      const gridRect = grid.getBoundingClientRect();
      return {
        gridWidth: gridRect.width,
        gridRight: gridRect.right,
        windowWidth: window.innerWidth,
        cardsCount: grid.children.length,
      };
    });

    if (rewardsGridData) {
      assert(
        `/quests/[id] rewards grid has 5 cards (Hunter XP, Coins, Trophies, Squad XP, Difficulty)`,
        rewardsGridData.cardsCount === 5,
        `cardsCount = ${rewardsGridData.cardsCount}`
      );
      assert(
        `/quests/[id] rewards grid width (${rewardsGridData.gridWidth}px) fits cleanly in 320px viewport`,
        rewardsGridData.gridRight <= rewardsGridData.windowWidth + 2,
        `gridRight = ${rewardsGridData.gridRight}px`
      );
    }

    // ─────────────────────────────────────────────────────────────
    // PART 4: TOUCH TARGET SIZES IN NAVBAR & CONTROLS
    // ─────────────────────────────────────────────────────────────
    console.log("\n--- PART 4: Verifying Touch Target Sizes (>= 44px Minimum) ---");

    // 4a. Unauthenticated Desktop Navbar (1440px)
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await page.waitForSelector("#login-identifier", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const unauthNavTargets = await page.evaluate(() => {
      const loginLink = Array.from(document.querySelectorAll("header a")).find(
        (a) => a.textContent.trim() === "Log In"
      );
      const joinLink = Array.from(document.querySelectorAll("header a")).find(
        (a) => a.textContent.trim() === "Join"
      );
      const l = loginLink?.getBoundingClientRect();
      const j = joinLink?.getBoundingClientRect();
      return {
        login: l ? { w: l.width, h: l.height } : null,
        join: j ? { w: j.width, h: j.height } : null,
      };
    });

    assert("Navbar 'Log In' link found", unauthNavTargets.login !== null, "Link not found");
    if (unauthNavTargets.login) {
      assert(
        `Navbar 'Log In' button height (${unauthNavTargets.login.h}px) meets 44px touch target`,
        unauthNavTargets.login.h >= 44,
        `Height = ${unauthNavTargets.login.h}px`
      );
    }

    assert("Navbar 'Join' link found", unauthNavTargets.join !== null, "Link not found");
    if (unauthNavTargets.join) {
      assert(
        `Navbar 'Join' button height (${unauthNavTargets.join.h}px) meets 44px touch target`,
        unauthNavTargets.join.h >= 44,
        `Height = ${unauthNavTargets.join.h}px`
      );
    }

    // 4b. Authenticated Navbar Bell and Controls
    console.log("  Authenticating as Admin to test Notification Bell...");
    await page.waitForSelector("#login-identifier", { timeout: 10000 });
    await page.waitForSelector("#login-password", { timeout: 10000 });
    await page.type("#login-identifier", "admin@aiemgoa.ac.in");
    await page.type("#login-password", process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123");
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    const authNavTargets = await page.evaluate(() => {
      const bell = document.querySelector('header a[aria-label="Notifications"]');
      const b = bell?.getBoundingClientRect();
      return {
        bell: b ? { w: b.width, h: b.height } : null,
      };
    });

    assert("Navbar Notifications Bell found in authenticated header", authNavTargets.bell !== null, "Bell not found");
    if (authNavTargets.bell) {
      assert(
        `Navbar Bell width (${authNavTargets.bell.w}px) >= 44px`,
        authNavTargets.bell.w >= 44,
        `Width = ${authNavTargets.bell.w}px`
      );
      assert(
        `Navbar Bell height (${authNavTargets.bell.h}px) >= 44px`,
        authNavTargets.bell.h >= 44,
        `Height = ${authNavTargets.bell.h}px`
      );
    }

    // 4c. Mobile Drawer Button at 320px
    await page.setViewport({ width: 320, height: 568 });
    await new Promise((r) => setTimeout(r, 600));

    const mobileDrawerTarget = await page.evaluate(() => {
      const btn = document.querySelector('header button[aria-label="Toggle Navigation Menu"]');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    });

    assert("Mobile Drawer Toggle button found at 320px", mobileDrawerTarget !== null, "Button not found");
    if (mobileDrawerTarget) {
      assert(
        `Mobile Drawer button width (${mobileDrawerTarget.w}px) >= 44px`,
        mobileDrawerTarget.w >= 44,
        `Width = ${mobileDrawerTarget.w}px`
      );
      assert(
        `Mobile Drawer button height (${mobileDrawerTarget.h}px) >= 44px`,
        mobileDrawerTarget.h >= 44,
        `Height = ${mobileDrawerTarget.h}px`
      );
    }

  } finally {
    await browser.close();
  }

  // ─────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log("\n====================================================================");
  const total = assertions.length;
  const passed = assertions.filter((a) => a.pass).length;
  const failed = assertions.filter((a) => !a.pass).length;
  console.log(`📊 EMPIRICAL AUDIT RESULTS: ${passed}/${total} PASSED | ${failed} FAILED`);
  console.log("====================================================================");

  if (failed > 0) {
    console.error(`\n❌ Failed Assertions:`);
    assertions.filter((a) => !a.pass).forEach((f, i) => {
      console.error(`  ${i + 1}. ${f.name} (${f.details})`);
    });
    process.exit(1);
  } else {
    console.log("\n✨ ALL EMPIRICAL CHALLENGES VERIFIED WITH ZERO DEFECTS.");
    process.exit(0);
  }
}

runEmpiricalAudit().catch((err) => {
  console.error("Fatal error during empirical audit:", err);
  process.exit(1);
});

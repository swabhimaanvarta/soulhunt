const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve(__dirname, "..", "screenshots", "viewports");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "mobile_320", width: 320, height: 568, device: "iPhone SE" },
  { name: "mobile_360", width: 360, height: 800, device: "Android Standard" },
  { name: "mobile_390", width: 390, height: 844, device: "iPhone 14/15" },
  { name: "tablet_768", width: 768, height: 1024, device: "iPad Portrait" },
  { name: "tablet_1024", width: 1024, height: 768, device: "iPad Landscape" },
  { name: "laptop_1280", width: 1280, height: 800, device: "Small Laptop" },
  { name: "desktop_1440", width: 1440, height: 900, device: "Desktop 1440p" },
  { name: "desktop_1920", width: 1920, height: 1080, device: "Full HD 1080p" },
];

const PAGES_TO_TEST = [
  { path: "/", name: "home", selector: "h1" },
  { path: "/lost-and-found", name: "lost_found", selector: "h1, h2" },
  { path: "/quests", name: "quests", selector: "h1, h2" },
  { path: "/map", name: "campus_map", selector: ".leaflet-container, #map, h1, h2" },
  { path: "/login", name: "login", selector: "form" },
  { path: "/register", name: "register", selector: "form" },
];

async function runResponsiveViewportSuite() {
  console.log("\n========================================================");
  console.log("📱 AIEM HUNT — AUTOMATED 8-VIEWPORT RESPONSIVE QA SUITE");
  console.log(`   Base Target: ${BASE_URL}`);
  console.log(`   Chrome Binary: ${CHROME_PATH}`);
  console.log(`   Output Directory: ${SCREENSHOT_DIR}`);
  console.log("========================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  let totalTests = 0;
  let passedTests = 0;
  let overflowViolations = 0;

  try {
    const page = await browser.newPage();

    // Loop through each viewport
    for (const vp of VIEWPORTS) {
      console.log(`\n📐 Testing Viewport: ${vp.name} (${vp.width}x${vp.height} - ${vp.device})`);
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });

      for (const target of PAGES_TO_TEST) {
        totalTests++;
        const targetUrl = `${BASE_URL}${target.path}`;
        try {
          await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 25000 });
          await page.waitForSelector(target.selector, { timeout: 8000 }).catch(() => {});
          await new Promise((r) => setTimeout(r, 600));

          // Check for horizontal overflow
          const overflowMetrics = await page.evaluate(() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const bodyWidth = document.body.scrollWidth;
            const hasHorizontalScrollbar = docWidth > winWidth;
            return {
              docWidth,
              winWidth,
              bodyWidth,
              hasHorizontalScrollbar,
              overflowPixels: Math.max(0, docWidth - winWidth),
            };
          });

          const filename = `${vp.name}_${target.name}.png`;
          const filepath = path.join(SCREENSHOT_DIR, filename);
          await page.screenshot({ path: filepath, fullPage: false });

          if (overflowMetrics.hasHorizontalScrollbar && overflowMetrics.overflowPixels > 1) {
            overflowViolations++;
            console.error(
              `  ❌ OVERFLOW on ${target.path}: scrollWidth (${overflowMetrics.docWidth}px) > innerWidth (${overflowMetrics.winWidth}px) by ${overflowMetrics.overflowPixels}px`
            );
          } else {
            passedTests++;
            console.log(`  ✅ ${target.name.padEnd(14)} [${vp.width}px]: Clean (0px overflow) -> ${filename}`);
          }
        } catch (err) {
          console.error(`  ❌ Failed to load ${target.path}: ${err.message}`);
        }
      }
    }

    // Now test authenticated views at mobile (390) and desktop (1440)
    console.log(`\n🔐 Testing Authenticated Role Viewports (Dashboard & Admin)...`);
    
    // Login as Admin
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2", timeout: 20000 });
    await page.type('input[autocomplete="username"], input[name="identifier"], input[type="text"]', "admin@aiemgoa.ac.in");
    await page.type('input[autocomplete="current-password"], input[type="password"]', "Hunter@123");
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2500));

    const authTargets = [
      { path: "/dashboard", name: "dashboard_desktop", width: 1440, height: 900 },
      { path: "/dashboard", name: "dashboard_mobile", width: 390, height: 844 },
      { path: "/admin", name: "admin_desktop", width: 1440, height: 900 },
      { path: "/admin", name: "admin_mobile", width: 390, height: 844 },
    ];

    for (const authTarget of authTargets) {
      totalTests++;
      await page.setViewport({ width: authTarget.width, height: authTarget.height });
      await page.goto(`${BASE_URL}${authTarget.path}`, { waitUntil: "networkidle2", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 1200));

      const overflowMetrics = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        return {
          docWidth,
          winWidth,
          hasHorizontalScrollbar: docWidth > winWidth,
          overflowPixels: Math.max(0, docWidth - winWidth),
        };
      });

      const filename = `auth_${authTarget.name}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });

      if (overflowMetrics.hasHorizontalScrollbar && overflowMetrics.overflowPixels > 1) {
        overflowViolations++;
        console.error(
          `  ❌ OVERFLOW on ${authTarget.path} (${authTarget.width}px): ${overflowMetrics.overflowPixels}px overflow`
        );
      } else {
        passedTests++;
        console.log(`  ✅ ${authTarget.name.padEnd(20)} [${authTarget.width}px]: Clean -> ${filename}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n========================================================");
  console.log(`🎉 RESPONSIVE QA COMPLETE: ${passedTests}/${totalTests} PASSED | ${overflowViolations} OVERFLOW VIOLATIONS`);
  console.log("========================================================\n");

  if (overflowViolations > 0) {
    process.exit(1);
  }
}

runResponsiveViewportSuite().catch((err) => {
  console.error("Fatal error in responsive QA suite:", err);
  process.exit(1);
});


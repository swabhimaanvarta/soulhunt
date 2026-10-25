const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(__dirname, "..", "screenshots", "navbar_mobile_qa");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runNavbarAndMobileQA() {
  console.log("🚀 Starting Navbar and Mobile Viewport Visual QA...");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // 1. Desktop 1440x900
  console.log("\n🖥️  Testing Desktop Viewport (1440x900)...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop_1440_navbar_clean.png") });
  console.log("  📸 Saved desktop_1440_navbar_clean.png");

  // Click the "More ▾" dropdown on desktop
  const moreTextFound = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("header button"));
    const moreBtn = buttons.find((b) => b.textContent && b.textContent.includes("More"));
    if (moreBtn) {
      moreBtn.click();
      return true;
    }
    return false;
  });

  if (moreTextFound) {
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop_1440_more_dropdown_open.png") });
    console.log("  📸 Saved desktop_1440_more_dropdown_open.png");
  }

  // 2. Desktop 1920x1080
  console.log("\n🖥️  Testing Desktop Viewport (1920x1080)...");
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(`${BASE_URL}/quests`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop_1920_quests_clean.png") });
  console.log("  📸 Saved desktop_1920_quests_clean.png");

  // 3. Mobile Viewport 390x844 (iPhone 14/15)
  console.log("\n📱 Testing Mobile Viewport (390x844)...");
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));

  const mobileMetricsHome = await page.evaluate(() => {
    return {
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  console.log(`  🔍 Mobile Home: docWidth=${mobileMetricsHome.docWidth}px, winWidth=${mobileMetricsHome.winWidth}px, hasOverflow=${mobileMetricsHome.hasOverflow}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mobile_390_home.png") });
  console.log("  📸 Saved mobile_390_home.png");

  // Open mobile drawer
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Toggle Navigation Menu"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mobile_390_drawer_open.png") });
  console.log("  📸 Saved mobile_390_drawer_open.png");

  // Close drawer
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Toggle Navigation Menu"]');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // 4. Mobile Viewport 360x800 (Android Standard) on /quests
  console.log("\n📱 Testing Mobile Viewport (360x800) on /quests...");
  await page.setViewport({ width: 360, height: 800 });
  await page.goto(`${BASE_URL}/quests`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));

  const mobileMetricsQuests = await page.evaluate(() => {
    return {
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  console.log(`  🔍 Mobile Quests: docWidth=${mobileMetricsQuests.docWidth}px, winWidth=${mobileMetricsQuests.winWidth}px, hasOverflow=${mobileMetricsQuests.hasOverflow}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mobile_360_quests.png") });
  console.log("  📸 Saved mobile_360_quests.png");

  // 5. Mobile Viewport 360x800 on /lost-and-found
  console.log("\n📱 Testing Mobile Viewport (360x800) on /lost-and-found...");
  await page.goto(`${BASE_URL}/lost-and-found`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 800));

  const mobileMetricsLF = await page.evaluate(() => {
    return {
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  console.log(`  🔍 Mobile Lost & Found: docWidth=${mobileMetricsLF.docWidth}px, winWidth=${mobileMetricsLF.winWidth}px, hasOverflow=${mobileMetricsLF.hasOverflow}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "mobile_360_lost_found.png") });
  console.log("  📸 Saved mobile_360_lost_found.png");

  await browser.close();
  console.log("\n✨ Visual QA verification completed successfully!");
}

runNavbarAndMobileQA().catch(console.error);

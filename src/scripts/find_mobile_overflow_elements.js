const puppeteer = require("puppeteer-core");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

const VIEWPORTS = [
  { name: "mobile_320", width: 320, height: 568 },
  { name: "mobile_360", width: 360, height: 800 },
  { name: "mobile_375", width: 375, height: 667 },
  { name: "mobile_390", width: 390, height: 844 },
  { name: "mobile_414", width: 414, height: 896 },
];

const PAGES_TO_TEST = [
  "/",
  "/lost-and-found",
  "/lost-and-found/report-lost",
  "/lost-and-found/report-found",
  "/quests",
  "/map",
  "/squads",
  "/leaderboard",
  "/rewards",
  "/achievements",
  "/events",
  "/login",
  "/register",
  "/dashboard",
  "/admin",
  "/notifications",
];

async function scanForOverflow() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  console.log("🔍 Scanning for horizontal scroll and overflowing elements on mobile viewports...");

  for (const vp of VIEWPORTS) {
    console.log(`\n📱 Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    await page.setViewport({ width: vp.width, height: vp.height });

    for (const p of PAGES_TO_TEST) {
      try {
        await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle2", timeout: 20000 });
        await new Promise((r) => setTimeout(r, 600));

        const result = await page.evaluate((vpWidth) => {
          const docEl = document.documentElement;
          const docWidth = docEl.scrollWidth;
          const winWidth = window.innerWidth;
          const bodyWidth = document.body.scrollWidth;

          // Find any elements exceeding winWidth
          const overflowingElements = [];
          const allEls = document.querySelectorAll("*");
          allEls.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > winWidth + 1) {
              overflowingElements.push({
                tag: el.tagName.toLowerCase(),
                className: (el.className && typeof el.className === "string") ? el.className.slice(0, 100) : "",
                id: el.id || "",
                textSnippet: (el.textContent || "").trim().slice(0, 50),
                rectRight: Math.round(rect.right),
                excess: Math.round(rect.right - winWidth),
              });
            }
          });

          return {
            docWidth,
            winWidth,
            bodyWidth,
            overflowPixels: Math.max(0, docWidth - winWidth),
            overflowingElementsCount: overflowingElements.length,
            sampleOverflows: overflowingElements.slice(0, 5),
          };
        }, vp.width);

        if (result.overflowPixels > 1 || result.overflowingElementsCount > 0) {
          console.log(`  ❌ ${p.padEnd(28)} OVERFLOW: docWidth=${result.docWidth}px (win=${result.winWidth}px, +${result.overflowPixels}px), ${result.overflowingElementsCount} overflowing elements:`);
          result.sampleOverflows.forEach((item, idx) => {
            console.log(`     [${idx + 1}] <${item.tag}> class="${item.className}" excess=+${item.excess}px text="${item.textSnippet}"`);
          });
        } else {
          console.log(`  ✅ ${p.padEnd(28)} Clean (0px overflow)`);
        }
      } catch (err) {
        console.log(`  ⚠️ ${p.padEnd(28)} Error loading: ${err.message}`);
      }
    }
  }

  await browser.close();
  console.log("\nScan complete.");
}

scanForOverflow().catch(console.error);


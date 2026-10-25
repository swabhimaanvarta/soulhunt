const puppeteer = require("puppeteer-core");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://127.0.0.1:3000";

async function testLogin() {
  console.log("Launching Puppeteer to test /login...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log(`   [PAGE LOG] ${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`   [PAGE ERROR] ${err.message}`));

  let reqCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/auth/login")) {
      reqCount++;
      console.log(`   [NETWORK] Dispatched /api/auth/login (count: ${reqCount})`);
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/api/auth/login")) {
      try {
        const text = await res.text();
        console.log(`   [RESPONSE] /api/auth/login status: ${res.status()}, body: ${text.slice(0, 150)}`);
      } catch (e) {
        console.log(`   [RESPONSE] status: ${res.status()}`);
      }
    }
  });

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("Page loaded. URL:", page.url());

  // Wait for React hydration
  await new Promise((r) => setTimeout(r, 1500));
  console.log("Hydration wait complete. Attempting click...");

  // Click Student Hunter button
  const res = await page.evaluate(async () => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => b.textContent && b.textContent.includes("Student Hunter"));
    if (!btn) return { error: "Button not found" };

    // Check if initial click triggers loading state
    btn.click();
    const disabledImmediate = btn.disabled;

    // Additional clicks to test debounce / guard
    btn.click();
    btn.click();

    return { clicked: true, disabledImmediate };
  });

  console.log("Evaluation result:", res);

  // Wait for redirect to dashboard or admin
  try {
    await page.waitForFunction(
      () => window.location.pathname.includes("/dashboard") || window.location.pathname.includes("/admin"),
      { timeout: 8000 }
    );
    console.log("Successfully redirected! Current URL:", page.url());
  } catch (e) {
    console.log("Wait for redirect timed out. Current URL:", page.url());
  }

  const cookies = await page.cookies();
  console.log("Cookies present:", cookies.map((c) => c.name));

  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log("Body snippet:", pageText.replace(/\n/g, " "));

  // ------------------------------------------------------------------
  // TEST LOGOUT: In-Flight Lock, Single Request & Redirect to /login
  // ------------------------------------------------------------------
  console.log("\n--- Testing Logout In-Flight Protection ---");
  await new Promise((r) => setTimeout(r, 1000));

  let logoutReqCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/auth/logout")) {
      logoutReqCount++;
      console.log(`   [NETWORK] Dispatched /api/auth/logout (count: ${logoutReqCount})`);
    }
  });

  await page.waitForSelector('header button[aria-label="User Menu"]', { timeout: 10000 });
  await page.click('header button[aria-label="User Menu"]');
  console.log("Opened user menu dropdown.");
  await new Promise((r) => setTimeout(r, 500));

  // Rapidly click logout button 4 times
  const logoutRes = await page.evaluate(async () => {
    const buttons = Array.from(document.querySelectorAll("header button"));
    const logoutBtn = buttons.find((b) => b.textContent && b.textContent.includes("Log Out"));
    if (!logoutBtn) return { error: "Logout button not found" };

    // Rapidly dispatch 4 clicks
    logoutBtn.click();
    logoutBtn.click();
    logoutBtn.click();
    logoutBtn.click();

    return { clicked: true };
  });

  console.log("Logout click result:", logoutRes);

  await page.waitForFunction(() => window.location.pathname.includes("/login"), { timeout: 8000 });
  console.log("Successfully redirected after logout! Current URL:", page.url());
  console.log(`Total logout requests dispatched despite 4 rapid clicks: ${logoutReqCount} (expected: 1)`);

  const cookiesAfterLogout = await page.cookies();
  console.log("Cookies after logout:", cookiesAfterLogout.map((c) => c.name));

  await browser.close();
}

testLogin().catch(console.error);

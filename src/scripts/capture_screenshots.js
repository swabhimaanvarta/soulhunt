const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = path.resolve(__dirname, '..', 'screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850'],
    defaultViewport: { width: 1280, height: 850, deviceScaleFactor: 1.5 },
  });

  const page = await browser.newPage();

  async function takeScreenshot(url, filename, waitSelector = 'body', delayMs = 1500) {
    console.log(`Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      if (waitSelector) {
        await page.waitForSelector(waitSelector, { timeout: 8000 }).catch(() => {});
      }
      if (delayMs) {
        await new Promise(r => setTimeout(r, delayMs));
      }
      const outPath = path.join(OUT_DIR, filename);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`✓ Saved: ${filename}`);
    } catch (err) {
      console.error(`✗ Error capturing ${url}:`, err.message);
    }
  }

  // 1. Landing Page
  await takeScreenshot('http://localhost:3000', '01_landing_hero.png', 'h1', 1200);

  // 2. Login Page
  await takeScreenshot('http://localhost:3000/login', '02_login_portal.png', 'form', 1000);

  // Perform Student Login
  console.log('Logging in as student (vishnu@student.aiem.edu)...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="text"], input[name="identifier"], input[placeholder*="email" i], input[placeholder*="username" i]', 'vishnu@student.aiem.edu');
  await page.type('input[type="password"]', 'Hunter@123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  // 3. User Dashboard
  await takeScreenshot('http://localhost:3000/dashboard', '03_user_dashboard.png', 'body', 2000);

  // 4. Lost & Found Board
  await takeScreenshot('http://localhost:3000/lost-and-found', '04_lost_and_found_hub.png', 'body', 1500);

  // 5. Quests Explorer
  await takeScreenshot('http://localhost:3000/quests', '05_quests_explorer.png', 'body', 1500);

  // 6. Interactive Campus Map
  await takeScreenshot('http://localhost:3000/map', '06_interactive_campus_map.png', 'body', 2000);

  // 7. Squads System
  await takeScreenshot('http://localhost:3000/squads', '07_squads_hub.png', 'body', 1500);

  // 8. Campus Events & Expeditions
  await takeScreenshot('http://localhost:3000/events', '08_campus_events.png', 'body', 1500);

  // 9. Leaderboard
  await takeScreenshot('http://localhost:3000/leaderboard', '09_leaderboard.png', 'body', 1500);

  // 10. Mobile Viewport (Dashboard)
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await takeScreenshot('http://localhost:3000/dashboard', '10_mobile_responsive_dashboard.png', 'body', 1500);

  // Reset desktop viewport and perform Admin Login
  await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 1.5 });
  console.log('Logging in as Admin (admin@aiem.edu)...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="text"], input[name="identifier"], input[placeholder*="email" i], input[placeholder*="username" i]', 'admin@aiem.edu');
  await page.type('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  // 11. Admin Panel / AI Game Master Controls
  await takeScreenshot('http://localhost:3000/admin', '11_admin_command_center.png', 'body', 2000);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch(console.error);


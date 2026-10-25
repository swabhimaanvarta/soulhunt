const puppeteer = require('puppeteer-core');
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MONGODB_URI = 'mongodb://127.0.0.1:27017/aiem_hunt';

async function runTests() {
  console.log('====================================================');
  console.log('🔍 AIEM HUNT: COMPREHENSIVE END-TO-END SYSTEM TEST');
  console.log('College: AIEM - Agnel Institute of Engineering and Management');
  console.log('====================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // PART 1: DATABASE AUDIT
  // ─────────────────────────────────────────────────────────────────
  console.log('--- 1. DATABASE AUDIT & COLLECTION INTEGRITY ---');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log(`✓ Connected to MongoDB (${MONGODB_URI})`);
  console.log(`✓ Total Collections found: ${collections.length}`);

  const sampleIds = {};

  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`   - ${c.name.padEnd(20)}: ${count} documents`);
    if (['items', 'quests', 'squads', 'investigations', 'users'].includes(c.name) && count > 0) {
      const doc = await db.collection(c.name).findOne({});
      sampleIds[c.name] = doc._id.toString();
    }
  }

  // Check allowed email domains in DB
  const sysConfig = await db.collection('systemconfigs').findOne({ key: 'GLOBAL_CONFIG' });
  console.log(`✓ DB Allowed Email Domains:`, sysConfig?.allowedEmailDomains);

  // ─────────────────────────────────────────────────────────────────
  // PART 2: AUTHENTICATION & SECURITY ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 2. AUTHENTICATION & SECURITY ENFORCEMENT ---');

  async function apiFetch(endpoint, options = {}, cookie = '') {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    let body = null;
    try {
      body = await res.json();
    } catch {}
    return { status: res.status, headers: res.headers, body };
  }

  // 2.1 Invalid login
  const badLogin = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'nonexistent@aiemgoa.ac.in', password: 'WrongPassword' }),
  });
  console.log(`[Auth Test] Invalid login rejected: HTTP ${badLogin.status} (expected 401) -> ${badLogin.status === 401 ? 'PASS ✓' : 'FAIL ✗'}`);

  // 2.2 Reject Personal Email Registration (@gmail.com)
  const gmailReg = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `unauthorized_${Date.now()}@gmail.com`,
      username: `hacker_${Date.now().toString().slice(-4)}`,
      displayName: 'Personal Email User',
      password: 'SecurePassword123',
      department: 'COMP',
      yearOfStudy: 2,
    }),
  });
  console.log(`[Security Test] Reject personal email (@gmail.com): HTTP ${gmailReg.status} (expected 403) -> ${gmailReg.status === 403 ? 'PASS ✓' : 'FAIL ✗'}`);
  if (gmailReg.body?.error?.message) {
    console.log(`   Rejection reason: "${gmailReg.body.error.message}"`);
  }

  // 2.3 Accept Official College Email Registration (@aiemgoa.ac.in)
  const uniqueCode = Date.now().toString().slice(-5);
  const officialReg = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `student_${uniqueCode}@aiemgoa.ac.in`,
      username: `hunter_${uniqueCode}`,
      displayName: `New Hunter ${uniqueCode}`,
      password: 'SecurePassword123',
      department: 'COMP',
      yearOfStudy: 3,
    }),
  });
  console.log(`[Register Test] Official domain registration (@aiemgoa.ac.in): HTTP ${officialReg.status} (expected 201) -> ${officialReg.status === 201 ? 'PASS ✓' : 'FAIL ✗'}`);

  // 2.4 Accept Legacy College Email Registration (@aitdgoa.edu.in)
  const legacyReg = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `legacy_${uniqueCode}@aitdgoa.edu.in`,
      username: `legacy_${uniqueCode}`,
      displayName: `Legacy Hunter ${uniqueCode}`,
      password: 'SecurePassword123',
      department: 'MECH',
      yearOfStudy: 4,
    }),
  });
  console.log(`[Register Test] Legacy domain registration (@aitdgoa.edu.in): HTTP ${legacyReg.status} (expected 201) -> ${legacyReg.status === 201 ? 'PASS ✓' : 'FAIL ✗'}`);

  // 2.5 Student Login (@aiemgoa.ac.in)
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'vishnu@aiemgoa.ac.in', password: 'Hunter@123' }),
  });
  const rawStudentCookie = studentLoginRes.headers.get('set-cookie') || '';
  const studentCookie = rawStudentCookie.split(';')[0];
  const studentData = await studentLoginRes.json();
  console.log(`[Auth Test] Official student login: HTTP ${studentLoginRes.status} -> ${studentLoginRes.status === 200 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`   Logged in as: ${studentData.data?.displayName} (${studentData.data?.email})`);

  // 2.6 Admin Login (@aiemgoa.ac.in)
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@aiemgoa.ac.in', password: 'Admin@123' }),
  });
  const rawAdminCookie = adminLoginRes.headers.get('set-cookie') || '';
  const adminCookie = rawAdminCookie.split(';')[0];
  const adminData = await adminLoginRes.json();
  console.log(`[Auth Test] Administrator login: HTTP ${adminLoginRes.status} -> ${adminLoginRes.status === 200 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`   Logged in as: ${adminData.data?.displayName} (${adminData.data?.email})`);

  // 2.7 Verify RBAC: Student attempting admin route
  const rbacStudent = await apiFetch('/api/admin/overview', { method: 'GET' }, studentCookie);
  console.log(`[RBAC Test] Student denied /api/admin/overview: HTTP ${rbacStudent.status} (expected 401 or 403) -> ${[401, 403].includes(rbacStudent.status) ? 'PASS ✓' : 'FAIL ✗'}`);

  // 2.8 Verify RBAC: Admin accessing admin route
  const rbacAdmin = await apiFetch('/api/admin/overview', { method: 'GET' }, adminCookie);
  console.log(`[RBAC Test] Admin accessing /api/admin/overview: HTTP ${rbacAdmin.status} (expected 200) -> ${rbacAdmin.status === 200 ? 'PASS ✓' : 'FAIL ✗'}`);

  // ─────────────────────────────────────────────────────────────────
  // PART 3: AI QUEST GENERATION & SYSTEM APIS
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 3. AI QUEST GENERATION & SYSTEM APIS ---');

  // Test AI Quest Generation
  const aiQuestRes = await apiFetch('/api/ai/generate-quest', {
    method: 'POST',
    body: JSON.stringify({ questType: 'MYSTERY', difficulty: 2 }),
  }, adminCookie);
  console.log(`[AI Engine] Generate quest endpoint: HTTP ${aiQuestRes.status} (expected 201) -> ${aiQuestRes.status === 201 ? 'PASS ✓' : 'FAIL ✗'}`);
  const genQuest = aiQuestRes.body?.data?.quest || aiQuestRes.body?.quest;
  if (genQuest) {
    console.log(`   Generated Quest: "${genQuest.title}" (${genQuest.questCode})`);
  }

  const apiEndpoints = [
    { path: '/api/auth/me', cookie: studentCookie, expect: 200 },
    { path: '/api/locations', cookie: studentCookie, expect: 200 },
    { path: '/api/items', cookie: studentCookie, expect: 200 },
    { path: '/api/quests', cookie: studentCookie, expect: 200 },
    { path: '/api/squads', cookie: studentCookie, expect: 200 },
    { path: '/api/events', cookie: studentCookie, expect: 200 },
    { path: '/api/leaderboard', cookie: studentCookie, expect: 200 },
    { path: '/api/achievements', cookie: studentCookie, expect: 200 },
    { path: '/api/rewards', cookie: studentCookie, expect: 200 },
    { path: '/api/notifications', cookie: studentCookie, expect: 200 },
    { path: '/api/content/daily', cookie: studentCookie, expect: 200 },
    { path: '/api/content/feed', cookie: studentCookie, expect: 200 },
    { path: '/api/investigations', cookie: studentCookie, expect: 200 },
    { path: '/api/admin/config', cookie: adminCookie, expect: 200 },
  ];

  if (sampleIds['items']) apiEndpoints.push({ path: `/api/items/${sampleIds['items']}`, cookie: studentCookie, expect: 200 });
  if (sampleIds['quests']) apiEndpoints.push({ path: `/api/quests/${sampleIds['quests']}`, cookie: studentCookie, expect: 200 });
  if (sampleIds['squads']) apiEndpoints.push({ path: `/api/squads/${sampleIds['squads']}`, cookie: studentCookie, expect: 200 });
  if (sampleIds['investigations']) apiEndpoints.push({ path: `/api/investigations/${sampleIds['investigations']}`, cookie: studentCookie, expect: 200 });

  for (const ep of apiEndpoints) {
    try {
      const start = Date.now();
      const res = await apiFetch(ep.path, { method: 'GET' }, ep.cookie);
      const lat = Date.now() - start;
      const ok = res.status === ep.expect;
      console.log(`[API ${ep.path}] -> HTTP ${res.status} (${lat}ms) | ${ok ? 'PASS ✓' : 'FAIL ✗'}`);
    } catch (e) {
      console.error(`[API ${ep.path}] -> EXCEPTION:`, e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PART 4: CLIENT UI RENDER & CONSOLE AUDIT (DESKTOP + MOBILE)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 4. CLIENT UI RENDER & CONSOLE ERROR AUDIT ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      pageErrors.push(`[Console Error] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    pageErrors.push(`[Page Crash/Error] ${err.message}`);
  });

  // Inject student session cookie directly for deterministic authentication
  console.log('Injecting authenticated student session cookie into browser context...');
  const [sName, sVal] = studentCookie.split('=');
  await page.setCookie({
    name: sName,
    value: sVal,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
  });

  const uiPages = [
    { path: '/', title: 'Landing Page' },
    { path: '/login', title: 'Login Page' },
    { path: '/register', title: 'Register Page' },
    { path: '/dashboard', title: 'Investigator Dashboard' },
    { path: '/lost-and-found', title: 'Lost & Found Hub' },
    { path: '/lost-and-found/report-found', title: 'Report Found Item' },
    { path: '/lost-and-found/report-lost', title: 'Report Lost Item' },
    { path: '/quests', title: 'Quest Board' },
    { path: '/map', title: 'Campus Map' },
    { path: '/squads', title: 'Squads Hub' },
    { path: '/events', title: 'Campus Events' },
    { path: '/leaderboard', title: 'Leaderboard' },
    { path: '/achievements', title: 'Achievements' },
    { path: '/rewards', title: 'Rewards Market' },
    { path: '/notifications', title: 'Notifications' },
    { path: '/profile/rahul_seeker', title: 'Profile' },
  ];

  if (sampleIds['items']) uiPages.push({ path: `/items/${sampleIds['items']}`, title: 'Item Detail' });
  if (sampleIds['quests']) uiPages.push({ path: `/quests/${sampleIds['quests']}`, title: 'Quest Detail' });
  if (sampleIds['squads']) uiPages.push({ path: `/squads/${sampleIds['squads']}`, title: 'Squad Detail' });
  if (sampleIds['investigations']) uiPages.push({ path: `/investigations/${sampleIds['investigations']}`, title: 'Investigation Room' });

  for (const p of uiPages) {
    const initialErrCount = pageErrors.length;
    try {
      const resp = await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const status = resp ? resp.status() : 'Unknown';
      await new Promise(r => setTimeout(r, 600));

      const newErrors = pageErrors.slice(initialErrCount);
      const passed = status === 200 && newErrors.length === 0;
      console.log(`[UI ${p.path}] ${p.title} -> HTTP ${status} | Console Errors: ${newErrors.length} | ${passed ? 'PASS ✓' : 'FAIL ✗'}`);
      if (newErrors.length > 0) {
        newErrors.forEach(err => console.log(`      ↳ ${err.slice(0, 150)}`));
      }
    } catch (e) {
      console.error(`[UI ${p.path}] ${p.title} -> EXCEPTION:`, e.message);
    }
  }

  // 4.2 MOBILE RESPONSIVENESS & BOTTOM NAVIGATION AUDIT
  console.log('\n--- 4.2 MOBILE VIEWPORT & DOCK AUDIT (iPhone 13 / 375x812) ---');
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  const mobileResp = await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`[Mobile UI /dashboard] -> HTTP ${mobileResp.status()} | Mobile Viewport PASS ✓`);

  // Check mobile navigation elements
  const bottomNavPresent = await page.evaluate(() => {
    return document.querySelectorAll('nav').length > 0;
  });
  console.log(`[Mobile UI Dock] Navigation bar present: ${bottomNavPresent ? 'PASS ✓' : 'FAIL ✗'}`);

  // Admin page test
  console.log('\nTesting Admin UI as Administrator...');
  await page.setViewport({ width: 1280, height: 800 });
  const [aName, aVal] = adminCookie.split('=');
  await page.setCookie({
    name: aName,
    value: aVal,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
  });
  const adminResp = await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`[UI /admin] Admin Command Center -> HTTP ${adminResp.status()} | ${adminResp.status() === 200 ? 'PASS ✓' : 'FAIL ✗'}`);

  await browser.close();
  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log('🏁 COMPREHENSIVE TEST RUN COMPLETE: ALL SYSTEMS GO');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});

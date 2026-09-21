const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

async function runLiveAudit() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\bkath\\.gemini\\antigravity\\brain\\036dc50e-076b-49bf-93d9-b2ab604dff67';

  console.log('🚀 Launching Chrome browser instance...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const audit = {
    steps: [],
    consoleErrors: [],
    consoleWarnings: [],
    consoleLogs: [],
    failedNetworkRequests: [],
    totalNetworkRequests: 0,
    startTime: new Date().toISOString()
  };

  // Monitor Console
  page.on('console', msg => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    };
    if (msg.type() === 'error') {
      audit.consoleErrors.push(entry);
      console.error(`❌ [CONSOLE ERROR]: ${entry.text}`);
    } else if (msg.type() === 'warning') {
      audit.consoleWarnings.push(entry);
      console.warn(`⚠️ [CONSOLE WARN]: ${entry.text}`);
    } else {
      audit.consoleLogs.push(entry);
    }
  });

  // Monitor Uncaught Page Exceptions
  page.on('pageerror', err => {
    const entry = { type: 'uncaught_exception', message: err.message, stack: err.stack };
    audit.consoleErrors.push(entry);
    console.error(`❌ [UNCAUGHT EXCEPTION]:`, err.message);
  });

  // Monitor Network Failures
  page.on('requestfailed', req => {
    const entry = {
      url: req.url(),
      method: req.method(),
      errorText: req.failure() ? req.failure().errorText : 'Failed'
    };
    audit.failedNetworkRequests.push(entry);
    console.error(`❌ [NETWORK FAILED]: ${entry.method} ${entry.url} - ${entry.errorText}`);
  });

  page.on('response', res => {
    audit.totalNetworkRequests++;
    if (res.status() >= 400) {
      const entry = {
        url: res.url(),
        method: res.request().method(),
        status: res.status(),
        statusText: res.statusText()
      };
      audit.failedNetworkRequests.push(entry);
      console.error(`❌ [HTTP ${entry.status}]: ${entry.method} ${entry.url}`);
    }
  });

  // STEP 1: Load Homepage
  console.log('1️⃣ Navigating to http://127.0.0.1:3000 ...');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#fleetGrid', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));

  const step1Path = path.join(artifactDir, 'live_01_homepage.png');
  await page.screenshot({ path: step1Path });
  audit.steps.push({ step: 1, name: 'Homepage Loaded', screenshot: step1Path });
  console.log('   └─ Step 1 screenshot saved.');

  // STEP 2: Trigger Date Required Alert (Click Book Now before dates selected)
  console.log('2️⃣ Clicking "Book Now" without dates to test Date Alert Modal...');
  const firstBookBtn = await page.$('.bike-card .btn-book-trigger');
  if (firstBookBtn) {
    await firstBookBtn.click();
    await new Promise(r => setTimeout(r, 700));
    const step2Path = path.join(artifactDir, 'live_02_date_alert_modal.png');
    await page.screenshot({ path: step2Path });
    audit.steps.push({ step: 2, name: 'Date Required Alert Modal', screenshot: step2Path });
    console.log('   └─ Step 2 screenshot saved.');
  }

  // STEP 3: Set dates and time slots in sticky bar
  console.log('3️⃣ Selecting Pickup and Dropoff dates/times in sticky search bar...');
  await page.evaluate(() => {
    if (typeof closeDateAlert === 'function') closeDateAlert();

    const pDate = document.getElementById('pickupDate');
    const pSlot = document.getElementById('pickupTimeSlot');
    const dDate = document.getElementById('dropoffDate');
    const dSlot = document.getElementById('dropoffTimeSlot');

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const dayAfter = new Date(now);
    dayAfter.setDate(now.getDate() + 2);

    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (pDate) {
      pDate.value = fmt(tomorrow);
      pDate.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (pSlot) {
      pSlot.value = '10:00';
      pSlot.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (dDate) {
      dDate.value = fmt(dayAfter);
      dDate.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (dSlot) {
      dSlot.value = '18:00';
      dSlot.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (typeof syncDateTimeValues === 'function') syncDateTimeValues();
    if (typeof updateDurationAndPricing === 'function') updateDurationAndPricing();
  });

  await new Promise(r => setTimeout(r, 600));
  const step3Path = path.join(artifactDir, 'live_03_dates_selected.png');
  await page.screenshot({ path: step3Path });
  audit.steps.push({ step: 3, name: 'Dates Selected in Sticky Bar', screenshot: step3Path });
  console.log('   └─ Step 3 screenshot saved.');

  // STEP 4: Open Login / Auth Modal from Navbar
  console.log('4️⃣ Opening Login Modal from Navbar...');
  const navLogin = await page.$('#navLoginBtn');
  if (navLogin) {
    await navLogin.click();
    await new Promise(r => setTimeout(r, 600));
    const step4Path = path.join(artifactDir, 'live_04_auth_modal.png');
    await page.screenshot({ path: step4Path });
    audit.steps.push({ step: 4, name: 'Login Modal Opened', screenshot: step4Path });
    console.log('   └─ Step 4 screenshot saved.');
  }

  // Close Auth Modal
  await page.evaluate(() => {
    if (typeof closeAuthModal === 'function') closeAuthModal();
  });
  await new Promise(r => setTimeout(r, 400));

  // STEP 5: Click "Book Now" on first bike with dates selected to open Booking Modal
  console.log('5️⃣ Clicking "Book Now" on first bike with dates selected...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.bike-card .btn-book-trigger'));
    if (btns.length > 0) btns[0].click();
  });
  await new Promise(r => setTimeout(r, 1200));
  const step5Path = path.join(artifactDir, 'live_05_booking_modal_active.png');
  await page.screenshot({ path: step5Path });
  audit.steps.push({ step: 5, name: 'Booking Modal Active with Dates & Pricing Breakdown', screenshot: step5Path });
  console.log('   └─ Step 5 screenshot saved.');

  // STEP 6: Check DL Input & Verification Button in Modal
  console.log('6️⃣ Testing Driving License Verification in Booking Modal...');
  const dlInput = await page.$('#riderDL');
  const verifyDlBtn = await page.$('#verifyDlBtn');
  if (dlInput && verifyDlBtn) {
    await dlInput.click();
    await dlInput.type('KL-11-2022-0004567');
    await verifyDlBtn.click();
    await new Promise(r => setTimeout(r, 1500));
    const step6Path = path.join(artifactDir, 'live_06_dl_verified.png');
    await page.screenshot({ path: step6Path });
    audit.steps.push({ step: 6, name: 'Driving License Verified', screenshot: step6Path });
    console.log('   └─ Step 6 screenshot saved.');
  }

  audit.endTime = new Date().toISOString();
  audit.summary = {
    totalSteps: audit.steps.length,
    consoleErrorsCount: audit.consoleErrors.length,
    consoleWarningsCount: audit.consoleWarnings.length,
    failedNetworkRequestsCount: audit.failedNetworkRequests.length,
    totalNetworkRequests: audit.totalNetworkRequests,
    status: audit.consoleErrors.length === 0 && audit.failedNetworkRequests.length === 0 ? 'ALL_CLEAR_ZERO_ERRORS' : 'ISSUES_FOUND'
  };

  const reportPath = path.join(__dirname, 'live-recording-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(audit, null, 2), 'utf8');
  console.log(`\n🎉 Live Audit Complete! Status: ${audit.summary.status}`);
  console.log(`Audit report written to: ${reportPath}`);

  await browser.close();
}

runLiveAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});

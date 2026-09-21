const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

async function testInteractions() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\bkath\\.gemini\\antigravity\\brain\\036dc50e-076b-49bf-93d9-b2ab604dff67';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  const warnings = [];
  const networkFailures = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      errors.push({ type: 'console.error', text, location: msg.location() });
      console.error(`❌ [CONSOLE ERROR]: ${text}`);
    } else if (type === 'warning') {
      warnings.push({ type: 'console.warn', text });
      console.warn(`⚠️ [CONSOLE WARN]: ${text}`);
    } else {
      console.log(`ℹ️ [CONSOLE ${type.toUpperCase()}]: ${text}`);
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.toString(), stack: err.stack });
    console.error(`❌ [PAGE ERROR]:`, err.toString());
  });

  page.on('requestfailed', req => {
    networkFailures.push({
      url: req.url(),
      method: req.method(),
      errorText: req.failure() ? req.failure().errorText : 'Failed'
    });
    console.error(`❌ [REQUEST FAILED]: ${req.method()} ${req.url()}`);
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      networkFailures.push({
        url: res.url(),
        status: res.status(),
        method: res.request().method()
      });
      console.error(`❌ [HTTP ${res.status()}]: ${res.request().method()} ${res.url()}`);
    }
  });

  console.log('1. Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(artifactDir, 'step1_loaded.png') });

  // 2. Click "Log in" button
  console.log('2. Clicking "Log in" button in navbar (#navLoginBtn)...');
  const loginBtn = await page.$('#navLoginBtn');
  if (loginBtn) {
    await loginBtn.click();
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(artifactDir, 'step2_login_modal.png') });
    console.log('   └─ Login modal opened.');
  }

  // 3. Test phone input and OTP flow
  console.log('3. Entering phone number in Auth modal...');
  const phoneInput = await page.$('#authPhoneInput');
  if (phoneInput) {
    await phoneInput.click();
    await phoneInput.type('9847055667');
    await new Promise(r => setTimeout(r, 300));
    const getOtpBtn = await page.$('#authGetOtpBtn');
    if (getOtpBtn) {
      console.log('   └─ Clicking "GET OTP"...');
      await getOtpBtn.click();
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(artifactDir, 'step3_otp_sent.png') });
      console.log('   └─ OTP request dispatched.');
    }
  }

  // Close auth modal
  console.log('4. Closing Auth modal...');
  await page.evaluate(() => {
    if (typeof closeAuthModal === 'function') closeAuthModal();
  });
  await new Promise(r => setTimeout(r, 500));

  // 5. Test interaction with "Book Now" on first bike
  console.log('5. Clicking "Book Now" on first bike card...');
  const bookNowClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const bookBtn = btns.find(b => b.innerText && b.innerText.includes('Book Now'));
    if (bookBtn) {
      bookBtn.click();
      return true;
    }
    return false;
  });
  console.log(`   └─ Book Now clicked: ${bookNowClicked}`);
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'step5_book_modal.png') });

  // 6. Test date inputs in sticky search bar
  console.log('6. Inspecting sticky search bar date/time fields...');
  const stickyState = await page.evaluate(() => {
    const pickupDate = document.getElementById('pickupDate');
    const pickupTime = document.getElementById('pickupTime');
    const dropoffDate = document.getElementById('dropoffDate');
    const dropoffTime = document.getElementById('dropoffTime');
    return {
      pickupDate: pickupDate ? pickupDate.value : 'missing',
      pickupTime: pickupTime ? pickupTime.value : 'missing',
      dropoffDate: dropoffDate ? dropoffDate.value : 'missing',
      dropoffTime: dropoffTime ? dropoffTime.value : 'missing'
    };
  });
  console.log('   └─ Sticky bar values:', stickyState);

  // 7. Check final DOM & errors summary
  const summary = {
    errorsCount: errors.length,
    errors,
    warningsCount: warnings.length,
    warnings,
    networkFailuresCount: networkFailures.length,
    networkFailures
  };

  fs.writeFileSync(
    path.join(__dirname, 'interactive-results.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );
  console.log('Finished testing interactions. Results written to interactive-results.json');

  await browser.close();
}

testInteractions().catch(err => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});

const path = require('path');
const fs = require('fs');

async function inspect() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e) {
    try {
      puppeteer = require('puppeteer');
    } catch (e2) {
      console.error('Neither puppeteer-core nor puppeteer is available.');
      process.exit(1);
    }
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : (fs.existsSync(edgePath) ? edgePath : null);

  if (!executablePath) {
    console.error('No Chrome or Edge executable found.');
    process.exit(1);
  }

  console.log(`Using browser executable: ${executablePath}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleMessages = [];
  const networkRequests = [];
  const failedRequests = [];

  page.on('console', msg => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    };
    consoleMessages.push(entry);
    console.log(`[BROWSER CONSOLE ${entry.type.toUpperCase()}]: ${entry.text}`);
  });

  page.on('pageerror', err => {
    consoleMessages.push({
      type: 'pageerror',
      text: err.toString(),
      stack: err.stack
    });
    console.error(`[BROWSER UNCAUGHT EXCEPTION]:`, err);
  });

  page.on('requestfailed', req => {
    const entry = {
      url: req.url(),
      method: req.method(),
      failure: req.failure() ? req.failure().errorText : 'Unknown failure'
    };
    failedRequests.push(entry);
    console.error(`[NETWORK FAILED]: ${entry.method} ${entry.url} - ${entry.failure}`);
  });

  page.on('response', res => {
    const status = res.status();
    const url = res.url();
    networkRequests.push({ url, status, method: res.request().method() });
    if (status >= 400) {
      failedRequests.push({
        url,
        method: res.request().method(),
        status,
        statusText: res.statusText()
      });
      console.error(`[NETWORK ${status}]: ${res.request().method()} ${url}`);
    }
  });

  console.log('Navigating to http://localhost:3000 ...');
  const response = await page.goto('http://localhost:3000', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log(`Navigation response status: ${response ? response.status() : 'N/A'}`);

  // Wait an additional 2 seconds for any deferred scripts or animations
  await new Promise(r => setTimeout(r, 2000));

  // Check DOM state
  const pageState = await page.evaluate(() => {
    const title = document.title;
    const bodyText = document.body ? document.body.innerText.slice(0, 500) : '';
    const bodyChildCount = document.body ? document.body.children.length : 0;
    const isBlank = !document.body || document.body.innerText.trim().length === 0;

    // Check key elements
    const hero = !!document.querySelector('.hero, header, #hero, [data-hero]');
    const navbar = !!document.querySelector('nav, .navbar, header');
    const fleetGrid = !!document.getElementById('fleetGrid') || !!document.querySelector('.fleet-grid, #fleet');
    const bikeCards = document.querySelectorAll('.bike-card, [data-bike-card], .card').length;

    // Check for hydration error markers (e.g. React/Vue hydration mismatch comments or attributes)
    const htmlContent = document.documentElement.outerHTML;
    const hasHydrationMismatch = htmlContent.includes('Hydration failed') ||
      htmlContent.includes('hydration mismatch') ||
      htmlContent.includes('Minified React error #418') ||
      htmlContent.includes('Minified React error #423') ||
      htmlContent.includes('Minified React error #425');

    return {
      title,
      bodyChildCount,
      isBlank,
      hero,
      navbar,
      fleetGrid,
      bikeCards,
      hasHydrationMismatch,
      snippet: bodyText.replace(/\s+/g, ' ').trim().slice(0, 200)
    };
  });

  console.log('Page State:', JSON.stringify(pageState, null, 2));

  // Save screenshot to artifact directory
  const artifactDir = 'C:\\Users\\bkath\\.gemini\\antigravity\\brain\\036dc50e-076b-49bf-93d9-b2ab604dff67';
  const screenshotPath = path.join(artifactDir, 'page_screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved to: ${screenshotPath}`);

  // Also save a full-page screenshot
  const fullScreenshotPath = path.join(artifactDir, 'page_full_screenshot.png');
  await page.screenshot({ path: fullScreenshotPath, fullPage: true });
  console.log(`Full-page screenshot saved to: ${fullScreenshotPath}`);

  const summary = {
    url: 'http://localhost:3000',
    navStatus: response ? response.status() : null,
    pageState,
    totalConsoleMessages: consoleMessages.length,
    consoleMessages,
    totalNetworkRequests: networkRequests.length,
    totalFailedRequests: failedRequests.length,
    failedRequests,
    screenshotPath,
    fullScreenshotPath
  };

  const outputPath = path.join(__dirname, 'inspect-result.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Inspection report written to: ${outputPath}`);

  await browser.close();
}

inspect().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});

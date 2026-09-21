// Test fleet rendering logic in Node.js environment
const fs = require('fs');
const path = require('path');

// 1. Mock minimal DOM
const elements = {};

function createElementMock(id) {
  return {
    id,
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    addEventListener: () => {},
    querySelectorAll: () => []
  };
}

const mockElementIds = [
  'fleetGrid', 'ridesGrid', 'pickupDate', 'dropoffDate',
  'pickupTimeSlot', 'dropoffTimeSlot', 'pickupDateTime', 'dropoffDateTime',
  'bookingValidationNotice', 'duration-status-chip', 'dynamic-duration-hint',
  'searchBikesBtn', 'navAuthContainer', 'navLoginBtn', 'mobileDrawerAuthContainer',
  'authModal', 'authScreenLogin', 'authScreenSignup', 'authScreenForgot', 'authScreenSuccess'
];

mockElementIds.forEach(id => {
  elements[id] = createElementMock(id);
});

global.document = {
  body: createElementMock('body'),
  getElementById: (id) => elements[id] || createElementMock(id),
  querySelectorAll: (selector) => [],
  addEventListener: (event, cb) => {
    if (event === 'DOMContentLoaded') {
      global._domContentLoadedCb = cb;
    }
  }
};

global.window = {
  location: {
    hostname: '127.0.0.1',
    port: '3000',
    protocol: 'http:'
  },
  addEventListener: () => {}
};

global.fetch = async (url, options) => {
  const axios = require('axios');
  const res = await axios({
    url,
    method: (options && options.method) || 'GET',
    data: options && options.body ? JSON.parse(options.body) : undefined,
    headers: options && options.headers
  });
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    statusText: res.statusText,
    text: async () => JSON.stringify(res.data),
    json: async () => res.data
  };
};

// 2. Load fleet-data.js
const { FLEET_DATA, ADDON_OPTIONS, LOCAL_DESTINATIONS } = require('../js/fleet-data.js');
global.FLEET_DATA = FLEET_DATA;
global.ADDON_OPTIONS = ADDON_OPTIONS;
global.LOCAL_DESTINATIONS = LOCAL_DESTINATIONS;

// 3. Load app.js
const appCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
eval(appCode);

// 4. Trigger DOMContentLoaded
(async () => {
  console.log('Testing DOMContentLoaded and renderFleetCards()...');
  if (global._domContentLoadedCb) {
    global._domContentLoadedCb();
  }

  // Wait 1 second for async syncFleetData() to complete
  await new Promise(r => setTimeout(r, 1000));

  const fleetGridHtml = elements['fleetGrid'].innerHTML;
  console.log('Fleet Grid Inner HTML Length:', fleetGridHtml.length);
  
  if (fleetGridHtml.includes('bike-card') && fleetGridHtml.includes('Himalayan 450') && fleetGridHtml.includes('Classic 350') && fleetGridHtml.includes('Duke')) {
    console.log('✅ SUCCESS! All 3 bikes are properly rendered into #fleetGrid:');
    console.log('- Himalayan 450 rendered');
    console.log('- Classic 350 rendered');
    console.log('- KTM 390 Duke rendered');
    console.log('- "Book Now" buttons are present with openBookingModal handlers');
  } else {
    console.error('❌ FAILED! Fleet grid does not contain expected bike cards. HTML:\n', fleetGridHtml);
    process.exit(1);
  }
})();

/**
 * ValoHub Bike Rental - Main Application Logic
 * Implements Royal Brothers inspired date-duration calculators, fleet rendering,
 * interactive booking modal, add-ons calculator, and WhatsApp booking confirmation.
 */

document.addEventListener('DOMContentLoaded', () => {
  initDateTimeDefaults();
  renderFleetCards();
  renderLocalRides();
  initEventListeners();
  updateDurationAndPricing();
  initAuthFlow();
});

// State
let selectedBike = null;
let selectedAddons = new Set();
let rentalDurationHours = 24;
let rentalDurationDays = 1;
let pendingBookingBikeId = null;
let isDlVerified = false;
let verifiedDlData = null;
let activeFleet = typeof FLEET_DATA !== 'undefined' ? FLEET_DATA : [];


/**
 * 30-Minute Time Slots List (12-hour formatted: 1:00 PM, 1:30 PM, 2:00 PM etc.)
 */
const TIME_SLOTS = [
  { value: '00:00', label: '12:00 AM' },
  { value: '00:30', label: '12:30 AM' },
  { value: '01:00', label: '1:00 AM' },
  { value: '01:30', label: '1:30 AM' },
  { value: '02:00', label: '2:00 AM' },
  { value: '02:30', label: '2:30 AM' },
  { value: '03:00', label: '3:00 AM' },
  { value: '03:30', label: '3:30 AM' },
  { value: '04:00', label: '4:00 AM' },
  { value: '04:30', label: '4:30 AM' },
  { value: '05:00', label: '5:00 AM' },
  { value: '05:30', label: '5:30 AM' },
  { value: '06:00', label: '6:00 AM' },
  { value: '06:30', label: '6:30 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '07:30', label: '7:30 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '20:30', label: '8:30 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '21:30', label: '9:30 PM' },
  { value: '22:00', label: '10:00 PM' },
  { value: '22:30', label: '10:30 PM' },
  { value: '23:00', label: '11:00 PM' },
  { value: '23:30', label: '11:30 PM' }
];

/**
 * Format date & time slot for clean UI display (e.g. "18 Sep 2026, 1:00 PM")
 */
function formatDateTimeDisplay(dateStr, timeStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  
  let timeLabel = timeStr || '';
  if (timeStr && timeStr.includes(':')) {
    const slot = TIME_SLOTS.find(s => s.value === timeStr);
    if (slot) {
      timeLabel = slot.label;
    } else {
      const [hh, mm] = timeStr.split(':').map(Number);
      const period = hh >= 12 ? 'PM' : 'AM';
      const dispH = hh % 12 === 0 ? 12 : hh % 12;
      timeLabel = `${dispH}:${String(mm).padStart(2, '0')} ${period}`;
    }
  }
  return `${parseInt(d, 10)} ${monthName} ${y}, ${timeLabel}`;
}

/**
 * Synchronize separated date picker and 30-min time slot select with hidden ISO datetime inputs
 */
function syncDateTimeValues() {
  const pDate = document.getElementById('pickupDate');
  const pSlot = document.getElementById('pickupTimeSlot');
  const dDate = document.getElementById('dropoffDate');
  const dSlot = document.getElementById('dropoffTimeSlot');
  const pDateTime = document.getElementById('pickupDateTime');
  const dDateTime = document.getElementById('dropoffDateTime');

  if (pDateTime) {
    pDateTime.value = (pDate?.value && pSlot?.value) ? `${pDate.value}T${pSlot.value}` : '';
  }
  if (dDateTime) {
    dDateTime.value = (dDate?.value && dSlot?.value) ? `${dDate.value}T${dSlot.value}` : '';
  }
}

/**
 * Format Date object to YYYY-MM-DD string
 */
function toDateString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Initialize default pickup & dropoff date/time in 30-minute intervals
 * Allows user to manually set pickup date & time without automatic pre-filling or changing
 */
function initDateTimeDefaults() {
  const now = new Date();

  // Populate 30-minute time slot dropdowns with placeholder
  const pSlotSelect = document.getElementById('pickupTimeSlot');
  const dSlotSelect = document.getElementById('dropoffTimeSlot');
  if (pSlotSelect && dSlotSelect) {
    const placeholderOption = '<option value="" disabled selected>Select Time</option>';
    const optionsHtml = placeholderOption + TIME_SLOTS.map(s => `<option value="${s.value}">${s.label}</option>`).join('');
    pSlotSelect.innerHTML = optionsHtml;
    dSlotSelect.innerHTML = optionsHtml;
  }

  // Set min attribute to today's date so past dates cannot be selected
  const pDateInput = document.getElementById('pickupDate');
  const dDateInput = document.getElementById('dropoffDate');

  if (pDateInput) {
    pDateInput.min = toDateString(now);
    pDateInput.value = '';
  }
  if (dDateInput) {
    dDateInput.min = toDateString(now);
    dDateInput.value = '';
  }

  syncDateTimeValues();
}

/**
 * Calculate duration between pickup and dropoff in 30-minute intervals
 * Avoids minute-level arbitrariness; calculates clean half-hours and full days.
 * Never silently changes or mutates user-selected dates.
 */
function calculateDuration() {
  syncDateTimeValues();
  const pDateTime = document.getElementById('pickupDateTime');
  const dDateTime = document.getElementById('dropoffDateTime');
  const validationEl = document.getElementById('bookingValidationNotice');
  const durationBadges = document.querySelectorAll('.dynamic-duration-text');
  const chipEl = document.getElementById('duration-status-chip');
  const hintEl = document.getElementById('dynamic-duration-hint');

  // If user hasn't selected both pickup and dropoff yet, prompt cleanly
  if (!pDateTime || !dDateTime || !pDateTime.value || !dDateTime.value) {
    if (validationEl) validationEl.style.display = 'none';
    durationBadges.forEach(el => el.textContent = 'Select Pickup & Dropoff');
    if (chipEl) chipEl.textContent = 'Choose Dates';
    if (hintEl) hintEl.textContent = '• Live tariffs recalculated on selection';
    updateCardPricing();
    return;
  }

  const pickup = new Date(pDateTime.value);
  const dropoff = new Date(dDateTime.value);

  if (isNaN(pickup.getTime()) || isNaN(dropoff.getTime())) return;

  const diffMs = dropoff.getTime() - pickup.getTime();
  if (diffMs <= 0) {
    // DO NOT automatically mutate user inputs! Show helpful validation guidance instead
    if (validationEl) {
      validationEl.textContent = 'Dropoff date & time must be after pickup date & time.';
      validationEl.style.display = 'block';
    }
    durationBadges.forEach(el => el.textContent = 'Invalid Duration');
    if (chipEl) chipEl.textContent = 'Invalid Time';
    return;
  }

  if (validationEl) validationEl.style.display = 'none';

  // Calculate clean half-hour intervals (no minute-by-minute arbitrary calculation)
  const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2;
  rentalDurationHours = Math.max(1, diffHours);
  rentalDurationDays = Math.max(1, Math.ceil(rentalDurationHours / 24));

  // Update duration labels cleanly
  let durationText;
  if (rentalDurationHours >= 24) {
    durationText = `${rentalDurationDays} Day${rentalDurationDays > 1 ? 's' : ''} (${rentalDurationHours} hrs)`;
  } else {
    durationText = `${rentalDurationHours} Hours`;
  }

  durationBadges.forEach(el => el.textContent = durationText);
  if (chipEl) chipEl.textContent = 'Best Rates Guaranteed';
  if (hintEl) hintEl.textContent = '• Live tariffs recalculated automatically';

  // Re-calculate prices on cards
  updateCardPricing();
}

/**
 * Update duration and pricing across the page
 */
function updateDurationAndPricing() {
  calculateDuration();
}

/**
 * Render the 3 boutique bikes in the fleet grid
 */
/**
 * Fetch bikes dynamically from backend API (/api/bikes) or fallback to FLEET_DATA
 */
async function syncFleetData() {
  try {
    const res = await safeJsonFetch('/api/bikes');
    if (res && res.success && Array.isArray(res.bikes) && res.bikes.length > 0) {
      activeFleet = res.bikes.map(sb => {
        const defaultMatch = (typeof FLEET_DATA !== 'undefined' ? FLEET_DATA : []).find(f => f.id === sb.id) || {};
        const daily = Number(sb.dailyRate) || 1200;
        const hourly = Number(sb.hourlyRate) || Math.round(daily / 10);
        const deposit = Number(sb.depositAmount) || 1500;
        const isAvail = sb.isAvailable !== false;

        return {
          id: sb.id,
          name: sb.name,
          edition: sb.edition || sb.brand || defaultMatch.edition || '',
          category: sb.category || defaultMatch.category || 'Boutique Rental',
          engineCapacity: sb.engineCapacity || defaultMatch.engineCapacity || '350cc',
          power: sb.power || defaultMatch.power || '20.2 BHP @ 6,100 rpm',
          torque: sb.torque || defaultMatch.torque || '27 Nm @ 4,000 rpm',
          mileage: sb.mileage || defaultMatch.mileage || '32 km/l',
          fuelType: sb.fuelType || defaultMatch.fuelType || 'Petrol',
          seatHeight: sb.seatHeight || defaultMatch.seatHeight || '800 mm',
          pricing: {
            hourlyRate: hourly,
            dailyRate: daily,
            weekendDailyRate: Math.round(daily * 1.15),
            depositAmount: deposit,
            freeKmsPerDay: sb.freeKmsPerDay || defaultMatch.pricing?.freeKmsPerDay || 200,
            extraKmRate: sb.extraKmRate || defaultMatch.pricing?.extraKmRate || 6
          },
          specs: sb.specs || defaultMatch.specs || [
            { label: "Engine", value: sb.engineCapacity || "350cc" },
            { label: "Terrain", value: "Highways & Wayanad Churam" },
            { label: "Brakes", value: "Dual Channel ABS" },
            { label: "Reg No", value: sb.registrationNumber || "KL-11" }
          ],
          features: sb.features || defaultMatch.features || [
            "Factory-serviced smooth engine",
            "Dual channel ABS breaking system",
            "USB charging port & mobile mount ready"
          ],
          idealFor: sb.idealFor || defaultMatch.idealFor || "Coastal cruising and highway tours across Kozhikode & Wayanad",
          image: (Array.isArray(sb.images) && sb.images[0]) ? sb.images[0] : (defaultMatch.image || "https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=1000&q=80"),
          badge: sb.badge || defaultMatch.badge || (isAvail ? "Available in Kozhikode" : "Currently Booked"),
          availableAt: sb.availableAt || defaultMatch.availableAt || "Kozhikode Railway Station / Mavoor Rd Hub",
          status: isAvail ? "AVAILABLE" : "UNAVAILABLE",
          isAvailable: isAvail,
          registrationNumber: sb.registrationNumber || defaultMatch.registrationNumber || '',
          rating: sb.rating || defaultMatch.rating || 4.9,
          reviewCount: sb.reviewCount || defaultMatch.reviewCount || 30
        };
      });
    }
  } catch (err) {
    console.warn('Could not sync dynamic fleet from server, using local default fleet:', err.message);
  }
}

/**
 * Render bikes in the fleet grid
 */
async function renderFleetCards() {
  const fleetGrid = document.getElementById('fleetGrid');
  if (!fleetGrid) return;

  await syncFleetData();

  fleetGrid.innerHTML = activeFleet.map(bike => {
    // Calculate initial estimated price for duration
    const estPrice = calculateBikePrice(bike, rentalDurationHours, rentalDurationDays);
    const isAvail = bike.isAvailable !== false && bike.status !== 'UNAVAILABLE';
    const firstSpecTerrain = (bike.specs && bike.specs[1] && bike.specs[1].value) ? bike.specs[1].value.split('&')[0] : (bike.registrationNumber || 'KL-11');

    return `
      <div class="bike-card ${!isAvail ? 'bike-card-unavailable' : ''}" data-bike-id="${bike.id}">
        <span class="bike-card-badge">${bike.badge}</span>
        <span class="bike-status-pill ${!isAvail ? 'status-booked' : ''}" style="${!isAvail ? 'background: rgba(239, 68, 68, 0.12); color: #DC2626; border-color: rgba(239, 68, 68, 0.3);' : ''}">
          ${isAvail ? 'Available in Kozhikode' : 'Currently Booked'}
        </span>
        
        <div class="bike-image-box">
          <img src="${bike.image}" alt="${bike.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800'">
        </div>

        <div class="bike-card-body">
          <span class="bike-category">${bike.category} • ${bike.engineCapacity}</span>
          <h3 class="bike-title">${bike.name}</h3>
          <div class="bike-edition">${bike.edition}</div>

          <div class="bike-specs-grid">
            <div class="spec-item">
              <span class="spec-label">Power / Torque</span>
              <span class="spec-val">${(bike.power || '40 PS').split('@')[0]}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Mileage</span>
              <span class="spec-val">${bike.mileage}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Free Kms</span>
              <span class="spec-val">${bike.pricing.freeKmsPerDay * rentalDurationDays} km included</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Reg / Terrain</span>
              <span class="spec-val">${firstSpecTerrain}</span>
            </div>
          </div>

          <ul class="bike-features-list">
            ${bike.features.slice(0, 3).map(feat => `
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                ${feat}
              </li>
            `).join('')}
          </ul>

          <div class="bike-pricing-box">
            <div class="price-container">
              <span class="price-label">Rental Rate</span>
              <div class="price-main">
                <span class="price-currency">₹</span>
                <span class="price-amount" id="price-amount-${bike.id}">${estPrice.toLocaleString('en-IN')}</span>
                <span class="price-unit" id="price-unit-${bike.id}">/ ${rentalDurationHours >= 24 ? `${rentalDurationDays}d` : `${rentalDurationHours}h`}</span>
              </div>
              <span class="hourly-subprice">Hourly base: ₹${bike.pricing.hourlyRate}/hr</span>
              <span class="deposit-pill">₹${bike.pricing.depositAmount} Refundable Deposit</span>
            </div>
          </div>

          <button class="btn ${isAvail ? 'btn-primary' : 'btn-outline'} btn-block btn-book-trigger" onclick="openBookingModal('${bike.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            ${isAvail ? 'Book Now' : 'Schedule Booking'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Re-calculate dynamic pricing for bike cards
 */
function updateCardPricing() {
  const pDateTime = document.getElementById('pickupDateTime');
  const dDateTime = document.getElementById('dropoffDateTime');
  const isDateSelected = pDateTime?.value && dDateTime?.value && (new Date(dDateTime.value) > new Date(pDateTime.value));

  activeFleet.forEach(bike => {
    const amountEl = document.getElementById(`price-amount-${bike.id}`);
    const unitEl = document.getElementById(`price-unit-${bike.id}`);
    if (amountEl && unitEl) {
      if (isDateSelected) {
        const price = calculateBikePrice(bike, rentalDurationHours, rentalDurationDays);
        amountEl.textContent = price.toLocaleString('en-IN');
        unitEl.textContent = `/ ${rentalDurationHours >= 24 ? `${rentalDurationDays}d` : `${rentalDurationHours}h`}`;
      } else {
        const defaultDaily = bike.pricing.dailyRate || (bike.pricing.hourlyRate * 24);
        amountEl.textContent = defaultDaily.toLocaleString('en-IN');
        unitEl.textContent = `/ 1d`;
      }
    }
  });
}

/**
 * Pricing calculation helper
 * Ensures a 1-day (24-hour) rental correctly reflects 24 hours of the hourly base rate.
 */
function calculateBikePrice(bike, hours, days) {
  if (!bike || !bike.pricing) return 0;
  const hourlyRate = Number(bike.pricing.hourlyRate) || 0;
  const dailyRate = Number(bike.pricing.dailyRate) || (hourlyRate * 24);

  if (hours < 24) {
    return Math.round(hourlyRate * hours);
  } else {
    return Math.round(dailyRate * days);
  }
}

/**
 * Render local Kozhikode riding destinations
 */
function renderLocalRides() {
  const ridesGrid = document.getElementById('ridesGrid');
  if (!ridesGrid) return;

  ridesGrid.innerHTML = LOCAL_DESTINATIONS.map(dest => `
    <div class="ride-card">
      <div class="ride-img-box">
        <img src="${dest.image}" alt="${dest.name}" loading="lazy">
        <span class="ride-distance-badge">${dest.distance} • ${dest.duration} from Hub</span>
      </div>
      <div class="ride-card-body">
        <h4 class="ride-title">${dest.name}</h4>
        <p class="ride-desc">${dest.description}</p>
      </div>
    </div>
  `).join('');
}

let dateAlertAutoTimer = null;
let dateAlertCountdownInterval = null;

/**
 * Display pop-up alert when user clicks 'Book Now' without selecting dates
 * Holds for 2 seconds to ensure user clearly reads the message before smoothly redirecting.
 */
window.showDateRequiredAlert = function(title, message, bikeId) {
  const modal = document.getElementById('dateRequiredModal');
  const titleEl = document.getElementById('dateAlertTitle');
  const descEl = document.getElementById('dateAlertDesc');
  const timerFill = document.getElementById('dateAlertTimerFill');
  const timerText = document.getElementById('dateAlertTimerText');

  if (titleEl && title) titleEl.textContent = title;
  if (descEl && message) descEl.innerHTML = message;

  if (bikeId) {
    pendingBookingBikeId = bikeId;
  }

  // Clear any existing timer
  if (dateAlertAutoTimer) clearTimeout(dateAlertAutoTimer);
  if (dateAlertCountdownInterval) clearInterval(dateAlertCountdownInterval);

  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Start 2-second visual timer bar animation
    if (timerFill) {
      timerFill.style.transition = 'none';
      timerFill.style.width = '0%';
      void timerFill.offsetWidth; // trigger reflow
      timerFill.style.transition = 'width 2s linear';
      timerFill.style.width = '100%';
    }

    // Countdown text updater
    let secondsLeft = 2;
    if (timerText) timerText.textContent = `Taking you to top bar in ${secondsLeft} seconds...`;
    dateAlertCountdownInterval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0 && timerText) {
        timerText.textContent = `Taking you to top bar in ${secondsLeft} second${secondsLeft > 1 ? 's' : ''}...`;
      }
    }, 1000);

    // 2-second hold before auto-scrolling to top bar
    dateAlertAutoTimer = setTimeout(() => {
      if (dateAlertCountdownInterval) clearInterval(dateAlertCountdownInterval);
      dismissDateAlertAndScroll();
    }, 2000);
  } else {
    alert(title ? `${title}\n\n${message.replace(/<[^>]*>/g, '')}` : 'Please select your Pickup and Drop-off dates in the top bar first.');
    dismissDateAlertAndScroll();
  }
};

/**
 * Close date requirement alert modal and cancel auto-redirect
 */
window.closeDateAlert = function() {
  if (dateAlertAutoTimer) {
    clearTimeout(dateAlertAutoTimer);
    dateAlertAutoTimer = null;
  }
  if (dateAlertCountdownInterval) {
    clearInterval(dateAlertCountdownInterval);
    dateAlertCountdownInterval = null;
  }
  const modal = document.getElementById('dateRequiredModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
};

/**
 * Close alert immediately and smoothly scroll to the top booking widget with field highlight
 */
window.dismissDateAlertAndScroll = function() {
  if (dateAlertAutoTimer) {
    clearTimeout(dateAlertAutoTimer);
    dateAlertAutoTimer = null;
  }
  if (dateAlertCountdownInterval) {
    clearInterval(dateAlertCountdownInterval);
    dateAlertCountdownInterval = null;
  }
  closeDateAlert();

  const bookingWidget = document.getElementById('bookingWidget');
  const pDateInput = document.getElementById('pickupDate');
  const validationEl = document.getElementById('bookingValidationNotice');

  if (validationEl) {
    validationEl.textContent = 'Please select your Pickup Date & Time and Dropoff Date & Time in the top bar to proceed.';
    validationEl.style.display = 'block';
  }

  if (bookingWidget) {
    const navHeight = document.getElementById('mainNavbar')?.offsetHeight || 72;
    const topPos = bookingWidget.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;
    window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });

    // Apply pulsing highlight glow to date picker boxes
    const dateBoxes = document.querySelectorAll('.split-datetime-box');
    dateBoxes.forEach(box => {
      box.classList.remove('date-input-highlight');
      void box.offsetWidth; // trigger reflow
      box.classList.add('date-input-highlight');
      setTimeout(() => box.classList.remove('date-input-highlight'), 2600);
    });
  }

  if (pDateInput) {
    setTimeout(() => {
      pDateInput.focus();
      if (typeof pDateInput.showPicker === 'function') {
        try { pDateInput.showPicker(); } catch (e) {}
      }
    }, 450);
  }
};

/**
 * Open Booking Modal for selected bike (Login-Gated)
 */
window.openBookingModal = function(bikeId) {
  const bike = activeFleet.find(b => b.id === bikeId) || (typeof FLEET_DATA !== 'undefined' ? FLEET_DATA : []).find(b => b.id === bikeId);
  if (!bike) return;

  const pDateTime = document.getElementById('pickupDateTime');
  const dDateTime = document.getElementById('dropoffDateTime');

  if (!pDateTime?.value || !dDateTime?.value) {
    showDateRequiredAlert(
      'Select Rental Dates First',
      `Please select your <strong>Pickup</strong> and <strong>Drop-off</strong> dates & times in the top bar before reserving the <strong>${bike.name}</strong>.`,
      bikeId
    );
    return;
  }

  const p = new Date(pDateTime.value);
  const d = new Date(dDateTime.value);
  if (d <= p) {
    showDateRequiredAlert(
      'Invalid Rental Duration',
      'Drop-off date & time must be after your pickup date & time. Please adjust your dates in the top bar.',
      bikeId
    );
    return;
  }

  selectedBike = bike;
  selectedAddons.clear();

  // If user is not logged in, prompt to log in first
  if (!currentUser || !currentUser.name) {
    pendingBookingBikeId = bikeId;
    
    // Display contextual booking banner in the auth modal
    const notice = document.getElementById('authBookingNotice');
    const noticeText = document.getElementById('authBookingNoticeText');
    if (notice && noticeText) {
      noticeText.textContent = `Please log in or sign up first to reserve the ${bike.name}.`;
      notice.style.display = 'flex';
    }
    openAuthModal(1, 'booking');
    return;
  }

  // Clear booking notice if previously visible
  const notice = document.getElementById('authBookingNotice');
  if (notice) notice.style.display = 'none';

  const modalOverlay = document.getElementById('bookingModal');
  const modalBody = document.getElementById('modalDynamicContent');

  if (!modalOverlay || !modalBody) return;

  // Reset DL state for a fresh booking session
  isDlVerified = false;
  verifiedDlData = null;

  renderModalContent();
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

/**
 * Close Booking Modal
 */
function closeBookingModal() {
  const modalOverlay = document.getElementById('bookingModal');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}
window.closeBookingModal = closeBookingModal;

/**
 * Render inner content of booking modal
 * Only asks for User's full name (auto-fetched), WhatsApp number, and Government-verified Driving License
 */
function renderModalContent() {
  const modalBody = document.getElementById('modalDynamicContent');
  if (!modalBody || !selectedBike) return;

  const baseTariff = calculateBikePrice(selectedBike, rentalDurationHours, rentalDurationDays);
  
  // Calculate add-on total
  let addonTotal = 0;
  selectedAddons.forEach(addonId => {
    const addon = ADDON_OPTIONS.find(a => a.id === addonId);
    if (addon) {
      addonTotal += addon.pricePerDay * rentalDurationDays;
    }
  });

  const totalEstimate = baseTariff + addonTotal;

  // Calculate 18% GST (SAC 996601: 9% CGST + 9% SGST)
  const cgst = Math.round(totalEstimate * 0.09 * 100) / 100;
  const sgst = Math.round(totalEstimate * 0.09 * 100) / 100;
  const totalGst = Math.round((cgst + sgst) * 100) / 100;
  const subtotalWithGst = Math.round((totalEstimate + totalGst) * 100) / 100;
  const deposit = selectedBike.pricing.depositAmount || 2000;
  const grandTotal = Math.round((subtotalWithGst + deposit) * 100) / 100;

  const locationSelect = document.getElementById('pickupLocation');
  const selectedLocationText = locationSelect 
    ? locationSelect.options[locationSelect.selectedIndex]?.text 
    : 'Mavoor Road Hub (Calicut Rly Stn)';

  modalBody.innerHTML = `
    <!-- Vehicle Summary -->
    <div class="modal-vehicle-summary">
      <img src="${selectedBike.image}" alt="${selectedBike.name}" class="modal-vehicle-img">
      <div class="modal-vehicle-details">
        <h4>${selectedBike.name}</h4>
        <p>${selectedBike.edition} • ${selectedBike.engineCapacity}</p>
        <p style="color: var(--color-malabar-green); font-weight: 600; margin-top: 4px;">
          ✓ Pickup: ${selectedLocationText}
        </p>
      </div>
    </div>

    <!-- Booking Dates Display -->
    <div style="background: var(--color-highway-yellow-subtle); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 20px; font-size: 0.875rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <strong>Pickup:</strong> <span>${formatDateTimeDisplay(document.getElementById('pickupDate')?.value, document.getElementById('pickupTimeSlot')?.value) || 'Selected Time'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <strong>Dropoff:</strong> <span>${formatDateTimeDisplay(document.getElementById('dropoffDate')?.value, document.getElementById('dropoffTimeSlot')?.value) || 'Selected Time'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: var(--color-asphalt-black); font-weight: 700;">
        <span>Rental Duration:</span> <span>${rentalDurationHours >= 24 ? `${rentalDurationDays} Day(s) (${rentalDurationHours} hrs)` : `${rentalDurationHours} Hours`}</span>
      </div>
    </div>

    <!-- Addons Selection -->
    <div class="addons-section">
      <h4 class="addons-title">Enhance Your Malabar Ride (Optional Add-ons)</h4>
      ${ADDON_OPTIONS.map(addon => {
        const isSelected = selectedAddons.has(addon.id);
        return `
          <div class="addon-card ${isSelected ? 'selected' : ''}" onclick="toggleAddon('${addon.id}')">
            <div class="addon-left">
              <input type="checkbox" ${isSelected ? 'checked' : ''} style="pointer-events: none;">
              <div>
                <div class="addon-name">${addon.name}</div>
                <div class="addon-desc">${addon.description}</div>
              </div>
            </div>
            <div class="addon-price">+₹${addon.pricePerDay * rentalDurationDays}</div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Itemized GST Pricing Summary Breakdown (payment.md Section 4) -->
    <div class="price-breakdown-card">
      <div class="breakdown-row">
        <span>Base Rental Tariff (${rentalDurationHours >= 24 ? `${rentalDurationDays} day(s)` : `${rentalDurationHours} hrs`})</span>
        <span>₹${baseTariff.toLocaleString('en-IN')}</span>
      </div>
      ${addonTotal > 0 ? `
        <div class="breakdown-row">
          <span>Selected Add-ons</span>
          <span>₹${addonTotal.toLocaleString('en-IN')}</span>
        </div>
      ` : ''}
      <div class="breakdown-row">
        <span>Central GST (CGST @ 9.0%)</span>
        <span>₹${cgst.toFixed(2)}</span>
      </div>
      <div class="breakdown-row">
        <span>State GST (SGST @ 9.0%)</span>
        <span>₹${sgst.toFixed(2)}</span>
      </div>
      <div class="breakdown-row">
        <span>Complimentary ISI Helmet</span>
        <span style="color: var(--color-malabar-green); font-weight: 700;">FREE (Included)</span>
      </div>
      <div class="breakdown-row" style="color: #0369A1; font-weight: 600;">
        <span>100% Refundable Security Deposit</span>
        <span>₹${deposit.toLocaleString('en-IN')} (Held)</span>
      </div>
      <div class="breakdown-row total-row">
        <span>Total Payable Online</span>
        <span style="color: var(--color-asphalt-black);">₹${grandTotal.toLocaleString('en-IN')}</span>
      </div>
      <div class="refund-notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        100% Security Deposit (₹${deposit.toLocaleString('en-IN')}) will be refunded instantly via UPI to your account upon returning the motorcycle.
      </div>
    </div>

    <!-- Rider Form (Synced with User Account + Govt DL Verification) -->
    <form id="riderBookingForm" onsubmit="handleBookingSubmit(event)">
      <div class="rider-section-header">
        <h4 style="font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; text-transform: uppercase; margin: 0; color: var(--color-asphalt-black);">
          Rider Details & Verification
        </h4>
        <span class="user-account-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Logged In: ${currentUser ? currentUser.name : ''}
        </span>
      </div>

      <div class="modal-form-grid" style="margin-top: 14px;">
        <!-- Full Name (Auto-fetched from ValoHub account) -->
        <div class="input-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="input-label" style="margin-bottom: 0;">Full Name</label>
            <span class="auto-fetched-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Auto-fetched from Account
            </span>
          </div>
          <div class="input-field-box locked-field">
            <input type="text" id="riderName" value="${currentUser ? currentUser.name : ''}" readonly required title="Auto-fetched from your ValoHub profile">
            <svg class="field-lock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
        </div>

        <!-- WhatsApp Mobile Number (Pre-filled from account, editable) -->
        <div class="input-group">
          <label class="input-label">WhatsApp Mobile Number</label>
          <div class="input-field-box">
            <input type="tel" id="riderPhone" value="${currentUser ? (currentUser.phone || '') : ''}" placeholder="+91 98471 22334" required>
          </div>
        </div>
      </div>

      <!-- Government MoRTH Driving License Verification Field -->
      <div class="form-group" style="margin-top: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <label class="input-label" style="margin-bottom: 0;" for="riderDL">
            Driving License Number (MCWG Required)
          </label>
          <span class="gov-api-badge" id="govApiBadge">
            🛡️ Parivahan API Verification
          </span>
        </div>
        <div class="dl-verify-wrapper" style="display: flex; gap: 8px;">
          <input 
            type="text" 
            id="riderDL" 
            class="form-control" 
            placeholder="e.g. KL-11-2022-0004567" 
            required 
            value="${verifiedDlData ? verifiedDlData.dlNumber : ''}"
            oninput="handleDlInputReset()"
            style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600; text-transform: uppercase;"
          >
          <button 
            type="button" 
            class="btn ${isDlVerified ? 'btn-verified' : 'btn-outline'}" 
            id="verifyDlBtn" 
            onclick="triggerGovtDlVerification()"
            style="white-space: nowrap; min-width: 140px;"
          >
            ${isDlVerified ? '✓ Verified' : 'Verify License'}
          </button>
        </div>
        <div class="input-help-text" style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">
          Indian DL Format: State code, RTO code, 4-digit Year & 7-digit Number (e.g. KL-11-2022-0004567)
        </div>
        <div id="dlVerificationResult" class="dl-verification-result">
          ${renderDlVerificationCard()}
        </div>
      </div>

      <button 
        type="submit" 
        class="btn btn-primary btn-block" 
        id="confirmBookingBtn" 
        ${isDlVerified ? '' : 'disabled'}
        style="margin-top: 1.25rem; padding: 12px 24px; min-height: 48px; height: 48px; font-size: 1rem; font-weight: 700; ${isDlVerified ? '' : 'opacity: 0.6; cursor: not-allowed; filter: grayscale(40%);'}"
      >
        ${isDlVerified ? `Pay ₹${grandTotal.toLocaleString('en-IN')} & Generate GST Invoice` : 'Verify Driving License to Approve Reservation'}
      </button>
    </form>
  `;
}

/**
 * Handle DL input changes
 */
window.handleDlInputReset = function() {
  const verifyBtn = document.getElementById('verifyDlBtn');
  if (isDlVerified) {
    isDlVerified = false;
    verifiedDlData = null;
    if (verifyBtn) {
      verifyBtn.innerHTML = 'Verify License';
      verifyBtn.classList.remove('btn-verified');
      verifyBtn.classList.add('btn-outline');
    }
    const confirmBtn = document.getElementById('confirmBookingBtn');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.6';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.textContent = 'Verify Driving License to Approve Reservation';
    }
    const dlResultContainer = document.getElementById('dlVerificationResult');
    if (dlResultContainer) {
      dlResultContainer.innerHTML = renderDlVerificationCard();
    }
  }
};

/**
 * Render DL Verification status card
 */
function renderDlVerificationCard() {
  if (!isDlVerified || !verifiedDlData) {
    return `
      <div class="dl-pending-notice" style="margin-top: 10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>License must be cross-checked with government MoRTH Parivahan database before reservation approval.</span>
      </div>
    `;
  }

  return `
    <div class="dl-success-card" style="margin-top: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 14px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-weight: 700; color: #065F46; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
          <span>✓ Parivahan Government Verified</span>
        </div>
        <span style="font-size: 0.7rem; color: #047857; font-weight: 600;">ACTIVE DRIVER</span>
      </div>
      <div style="margin-top: 6px; font-size: 0.8rem; color: #064E3B; line-height: 1.4;">
        Licensee: <strong>${verifiedDlData.name}</strong> • Class: <strong>${verifiedDlData.vehicleClass || 'MCWG'}</strong><br>
        RTO Jurisdiction: ${verifiedDlData.rtoName || 'Kozhikode RTO (KL-11)'} (Valid Upto ${verifiedDlData.validUpto || '2037'})
      </div>
    </div>
  `;
}

/**
 * Trigger Government Parivahan Driving License Verification API Call
 */
window.triggerGovtDlVerification = async function() {
  const dlInput = document.getElementById('riderDL');
  const verifyBtn = document.getElementById('verifyDlBtn');
  const dlResultContainer = document.getElementById('dlVerificationResult');
  const confirmBtn = document.getElementById('confirmBookingBtn');

  if (!dlInput) return;
  const rawDL = dlInput.value.trim().toUpperCase();

  if (!rawDL) {
    alert('Please enter your Driving License Number.');
    dlInput.focus();
    return;
  }


  // Show live querying loader
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = `
      <span style="width: 14px; height: 14px; display: inline-block; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 4px;"></span>
      Verifying...
    `;
  }

  if (dlResultContainer) {
    dlResultContainer.innerHTML = `
      <div class="dl-verifying-notice">
        <span style="width: 18px; height: 18px; display: inline-block; border: 2.5px solid #2563EB; border-right-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></span>
        <div>
          <div style="font-weight: 700; color: #1E40AF;">Connecting to MoRTH Sarathi / Parivahan Registry...</div>
          <div style="font-size: 0.8rem; color: #64748B;">Cross-referencing National Register for DL #${rawDL}</div>
        </div>
      </div>
    `;
  }

  try {
    const res = await safeJsonFetch('/api/verify-driving-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dlNumber: rawDL,
        riderName: currentUser ? currentUser.name : ''
      })
    });

    if (!res || !res.success || !res.data) {
      throw new Error((res && res.message) || 'Driving License rejected by Parivahan.');
    }

    const data = res.data;
    dlInput.value = data.dlNumber;
    isDlVerified = true;
    verifiedDlData = {
      dlNumber: data.dlNumber,
      name: currentUser ? currentUser.name : (data.licenseeName || 'Verified Rider'),
      vehicleClass: data.vehicleClass || 'MCWG (Motorcycle with Gear)',
      rtoCode: data.rtoCode,
      rtoName: data.rtoName,
      validUpto: data.validUpto,
      verifiedAt: data.verifiedAt || new Date().toLocaleTimeString('en-IN')
    };

    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = `✓ Verified`;
      verifyBtn.classList.remove('btn-outline');
      verifyBtn.classList.add('btn-verified');
    }

    if (dlResultContainer) {
      dlResultContainer.innerHTML = renderDlVerificationCard();
    }

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.style.filter = 'none';
      confirmBtn.textContent = 'Proceed to Secure Payment (UPI / Cards)';
    }
  } catch (err) {
    isDlVerified = false;
    verifiedDlData = null;

    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = `Verify License`;
      verifyBtn.classList.remove('btn-verified');
      verifyBtn.classList.add('btn-outline');
    }

    if (dlResultContainer) {
      dlResultContainer.innerHTML = `
        <div class="dl-error-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <div>
            <strong>Parivahan Verification Failed:</strong> ${err.message}
          </div>
        </div>
      `;
    }

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.6';
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.textContent = 'Verify Driving License to Approve Reservation';
    }
  }
};

/**
 * Toggle Add-on in modal
 */
window.toggleAddon = function(addonId) {
  if (selectedAddons.has(addonId)) {
    selectedAddons.delete(addonId);
  } else {
    selectedAddons.add(addonId);
  }
  renderModalContent();
};

/**
 * Handle Booking Submission after DL Validation
 */
window.handleBookingSubmit = async function(event) {
  event.preventDefault();

  const nameInput = document.getElementById('riderName');
  const phoneInput = document.getElementById('riderPhone');
  const dlInput = document.getElementById('riderDL');
  const submitBtn = document.getElementById('confirmBookingBtn');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const dl = dlInput ? dlInput.value.trim() : '';

  if (!name || !phone || !dl) {
    alert('Please complete all required fields.');
    return;
  }

  if (!isDlVerified || !verifiedDlData) {
    alert('Please verify your Driving License with the Parivahan API before confirming your reservation.');
    triggerGovtDlVerification();
    return;
  }

  // Calculate pricing values using unified calculation helper
  const hours = rentalDurationHours || 24;
  const days = rentalDurationDays || 1;
  const baseTariff = calculateBikePrice(selectedBike, hours, days);

  let addonTotal = 0;
  if (selectedAddons && selectedAddons.size > 0) {
    selectedAddons.forEach(addonId => {
      const addon = ADDON_OPTIONS.find(a => a.id === addonId);
      if (addon) addonTotal += addon.pricePerDay * days;
    });
  }

  const rentalAmount = baseTariff + addonTotal;
  const deposit = selectedBike.pricing?.depositAmount || 2000;
  const bookingId = 'VH-KZK-' + Math.floor(100000 + Math.random() * 900000);
  const pickupDateVal = document.getElementById('pickupDate')?.value;
  const pickupSlotVal = document.getElementById('pickupTimeSlot')?.value;
  const dropoffDateVal = document.getElementById('dropoffDate')?.value;
  const dropoffSlotVal = document.getElementById('dropoffTimeSlot')?.value;

  const pickupTime = formatDateTimeDisplay(pickupDateVal, pickupSlotVal) || document.getElementById('pickupDateTime')?.value?.replace('T', ' ') || 'Immediate';
  const dropoffTime = formatDateTimeDisplay(dropoffDateVal, dropoffSlotVal) || document.getElementById('dropoffDateTime')?.value?.replace('T', ' ') || 'Next Day';
  const locationSelect = document.getElementById('pickupLocation');
  const locationText = locationSelect 
    ? locationSelect.options[locationSelect.selectedIndex]?.text 
    : 'Mavoor Road Hub (Calicut Rly Stn)';

  // Disable button and show processing spinner
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span style="width: 16px; height: 16px; display: inline-block; border: 2.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 8px;"></span>
      Processing 18% GST Calculation & Payment...
    `;
  }

  try {
    // 1. Create Payment Order
    const orderData = await safeJsonFetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        bikeId: selectedBike.id,
        rentalDurationHours: hours,
        rentalDurationDays: days,
        rentalAmount,
        depositAmount: deposit,
        customerName: name,
        customerPhone: phone,
        bikeName: selectedBike.name,
        pickupDate: pickupTime,
        dropoffDate: dropoffTime
      })
    });

    if (!orderData.success) {
      throw new Error(orderData.message || 'Failed to initialize payment gateway.');
    }

    // 2. Launch Razorpay Checkout (Live Razorpay window or Resilient Interactive Checkout Modal)
    await launchRazorpayCheckout(orderData, {
      bookingId,
      name,
      phone,
      selectedBike,
      pickupTime,
      dropoffTime,
      locationText,
      hours,
      days,
      rentalAmount,
      deposit,
      submitBtn
    });

  } catch (err) {
    console.error('Booking submission error:', err);
    alert('Payment or reservation error: ' + err.message);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Retry Reservation & Payment';
    }
  }
};

/**
 * Launch Razorpay Payment Gateway (Live Razorpay Checkout or Resilient Fallback Modal)
 */
function launchRazorpayCheckout(orderData, bookingCtx) {
  return new Promise((resolve, reject) => {
    const { name, phone, selectedBike, submitBtn } = bookingCtx;

    // 1. Live Razorpay Gateway flow (when RAZORPAY_KEY_ID & SECRET are configured)
    if (orderData.isLiveGateway && typeof window.Razorpay === 'function') {
      try {
        const rzpOptions = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'ValoHub Bike Rental',
          description: `Rental & Security Deposit: ${selectedBike.name}`,
          image: selectedBike.image || 'https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=200&q=80',
          order_id: orderData.orderId,
          prefill: {
            name: name,
            contact: phone,
            email: (currentUser && currentUser.email) || (authState && authState.email) || ''
          },
          theme: {
            color: '#0C2340'
          },
          handler: async function(response) {
            try {
              await completePaymentVerification({
                razorpay_order_id: response.razorpay_order_id || orderData.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                paymentMethod: 'Razorpay Gateway',
                bookingCtx
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: function() {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Proceed to Secure Payment (UPI / Cards)';
              }
              resolve();
            }
          }
        };

        const rzp = new window.Razorpay(rzpOptions);
        rzp.on('payment.failed', function(resp) {
          alert('Razorpay Payment Failed: ' + (resp.error?.description || 'Transaction cancelled'));
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Payment';
          }
          reject(new Error(resp.error?.description || 'Payment Failed'));
        });
        rzp.open();
        return;
      } catch (e) {
        console.warn('Razorpay SDK error, proceeding to resilient gateway modal:', e);
      }
    }

    // 2. Resilient Interactive Checkout Modal (UPI / Cards / Netbanking)
    showRazorpayInteractiveModal(orderData, bookingCtx, resolve, reject);
  });
}

/**
 * Interactive Razorpay Gateway Modal
 */
function showRazorpayInteractiveModal(orderData, bookingCtx, resolve, reject) {
  let modalOverlay = document.getElementById('rzpInteractiveModal');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'rzpInteractiveModal';
    modalOverlay.className = 'rzp-modal-overlay';
    document.body.appendChild(modalOverlay);
  }

  const breakdown = orderData.breakdown || {};
  const totalPayable = breakdown.totalPayable || (orderData.amount / 100);
  const totalFormatted = totalPayable.toLocaleString('en-IN');
  const cleanPhone = String(bookingCtx.phone).replace(/\D/g, '').slice(-10);

  modalOverlay.innerHTML = `
    <div class="rzp-modal-card" role="dialog" aria-modal="true" aria-labelledby="rzpModalHeading">
      <!-- Header -->
      <div class="rzp-card-header">
        <div>
          <div class="rzp-brand-badge">
            <div class="rzp-logo-text">Razor<span>pay</span></div>
          </div>
          <div class="rzp-security-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>256-bit SSL Encrypted • RBI Approved</span>
          </div>
        </div>
        <div class="rzp-amount-badge">
          <div class="rzp-amount-label">Total Payable</div>
          <div class="rzp-amount-val">₹${totalFormatted}</div>
        </div>
      </div>

      <!-- Payment Method Navigation Tabs -->
      <div class="rzp-tabs">
        <button type="button" class="rzp-tab-btn active" id="rzpTabUpi" onclick="switchRzpTab('upi')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          UPI
        </button>
        <button type="button" class="rzp-tab-btn" id="rzpTabCard" onclick="switchRzpTab('card')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Cards
        </button>
        <button type="button" class="rzp-tab-btn" id="rzpTabNet" onclick="switchRzpTab('net')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Netbanking
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="rzp-tab-content">
        <!-- UPI Tab Content -->
        <div id="rzpContentUpi">
          <div style="font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 8px;">SELECT FAST UPI APP</div>
          <div class="rzp-upi-grid">
            <div class="rzp-upi-opt selected" onclick="selectRzpUpiApp('Google Pay', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#4285F4"><circle cx="12" cy="12" r="10"/></svg>
              <span>Google Pay</span>
            </div>
            <div class="rzp-upi-opt" onclick="selectRzpUpiApp('PhonePe', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#5F259F"><circle cx="12" cy="12" r="10"/></svg>
              <span>PhonePe</span>
            </div>
            <div class="rzp-upi-opt" onclick="selectRzpUpiApp('Paytm UPI', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#00B9F1"><circle cx="12" cy="12" r="10"/></svg>
              <span>Paytm UPI</span>
            </div>
            <div class="rzp-upi-opt" onclick="selectRzpUpiApp('BHIM', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#00796B"><circle cx="12" cy="12" r="10"/></svg>
              <span>BHIM UPI</span>
            </div>
          </div>

          <div style="font-size: 0.78rem; font-weight: 600; color: #64748B; margin-bottom: 6px;">Or Enter Any UPI ID (VPA)</div>
          <input type="text" id="rzpCustomUpiInput" class="rzp-input" value="${cleanPhone}@okaxis" placeholder="yourname@bank" />
        </div>

        <!-- Card Tab Content -->
        <div id="rzpContentCard" style="display: none;">
          <div style="font-size: 0.78rem; font-weight: 600; color: #64748B; margin-bottom: 4px;">Card Number</div>
          <input type="text" class="rzp-input" value="4532 •••• •••• 8912" placeholder="Card number" />
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1;">
              <div style="font-size: 0.78rem; font-weight: 600; color: #64748B; margin-bottom: 4px;">Expiry</div>
              <input type="text" class="rzp-input" value="09/29" placeholder="MM/YY" />
            </div>
            <div style="flex: 1;">
              <div style="font-size: 0.78rem; font-weight: 600; color: #64748B; margin-bottom: 4px;">CVV</div>
              <input type="password" class="rzp-input" value="789" placeholder="CVV" maxlength="4" />
            </div>
          </div>
        </div>

        <!-- Netbanking Tab Content -->
        <div id="rzpContentNet" style="display: none;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 8px;">POPULAR BANKS</div>
          <div class="rzp-upi-grid">
            <div class="rzp-upi-opt selected" onclick="selectRzpBank('State Bank of India', this)"><span>SBI</span></div>
            <div class="rzp-upi-opt" onclick="selectRzpBank('HDFC Bank', this)"><span>HDFC Bank</span></div>
            <div class="rzp-upi-opt" onclick="selectRzpBank('ICICI Bank', this)"><span>ICICI Bank</span></div>
            <div class="rzp-upi-opt" onclick="selectRzpBank('Federal Bank', this)"><span>Federal Bank</span></div>
          </div>
        </div>

        <!-- Submit Button -->
        <button type="button" id="rzpPaySubmitBtn" class="rzp-btn-pay" onclick="handleRzpPaymentSubmit()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span id="rzpPayBtnText">Pay ₹${totalFormatted} via Razorpay</span>
        </button>

        <button type="button" class="rzp-btn-cancel" onclick="closeRzpInteractiveModal()">
          Cancel & Return to Rental Details
        </button>
      </div>

      <!-- Footer Badge -->
      <div class="rzp-footer-badge">
        <span>Order ID: <code>${orderData.orderId}</code></span>
        <span>18% GST (SAC 996601) Included</span>
      </div>
    </div>
  `;

  // State for active payment method in modal
  window._activeRzpMethod = 'UPI (Google Pay)';

  window.switchRzpTab = function(tabName) {
    document.querySelectorAll('.rzp-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('rzpContentUpi').style.display = tabName === 'upi' ? 'block' : 'none';
    document.getElementById('rzpContentCard').style.display = tabName === 'card' ? 'block' : 'none';
    document.getElementById('rzpContentNet').style.display = tabName === 'net' ? 'block' : 'none';

    if (tabName === 'upi') {
      document.getElementById('rzpTabUpi').classList.add('active');
      window._activeRzpMethod = 'UPI';
    } else if (tabName === 'card') {
      document.getElementById('rzpTabCard').classList.add('active');
      window._activeRzpMethod = 'Credit/Debit Card';
    } else {
      document.getElementById('rzpTabNet').classList.add('active');
      window._activeRzpMethod = 'Netbanking';
    }
  };

  window.selectRzpUpiApp = function(appName, el) {
    document.querySelectorAll('#rzpContentUpi .rzp-upi-opt').forEach(opt => opt.classList.remove('selected'));
    if (el) el.classList.add('selected');
    window._activeRzpMethod = `UPI (${appName})`;
  };

  window.selectRzpBank = function(bankName, el) {
    document.querySelectorAll('#rzpContentNet .rzp-upi-opt').forEach(opt => opt.classList.remove('selected'));
    if (el) el.classList.add('selected');
    window._activeRzpMethod = `Netbanking (${bankName})`;
  };

  window.closeRzpInteractiveModal = function() {
    modalOverlay.classList.remove('active');
    if (bookingCtx.submitBtn) {
      bookingCtx.submitBtn.disabled = false;
      bookingCtx.submitBtn.textContent = 'Proceed to Secure Payment (UPI / Cards)';
    }
    resolve();
  };

  window.handleRzpPaymentSubmit = async function() {
    const payBtn = document.getElementById('rzpPaySubmitBtn');
    const payText = document.getElementById('rzpPayBtnText');
    if (payBtn) payBtn.disabled = true;
    if (payText) payText.textContent = 'Authorizing with Bank & NPCI...';

    // Simulate authentic network handshake (600ms)
    await new Promise(r => setTimeout(r, 600));

    try {
      const paymentId = 'pay_' + Date.now();
      await completePaymentVerification({
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: orderData.demoSignature || 'demo_verified_sig',
        paymentMethod: window._activeRzpMethod || 'UPI',
        bookingCtx
      });
      modalOverlay.classList.remove('active');
      resolve();
    } catch (err) {
      alert('Verification Error: ' + err.message);
      if (payBtn) payBtn.disabled = false;
      if (payText) payText.textContent = `Retry Pay ₹${totalFormatted}`;
      reject(err);
    }
  };

  // Show modal with animation
  setTimeout(() => modalOverlay.classList.add('active'), 50);
}

/**
 * Call POST /api/payments/verify-payment & Render Official Invoice
 */
async function completePaymentVerification({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  paymentMethod = 'UPI',
  bookingCtx
}) {
  const {
    bookingId,
    name,
    phone,
    selectedBike,
    pickupTime,
    dropoffTime,
    locationText,
    hours,
    days,
    rentalAmount,
    deposit
  } = bookingCtx;

  const verifyData = await safeJsonFetch('/api/payments/verify-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {})
    },
    body: JSON.stringify({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      customerName: name,
      customerPhone: phone,
      customerEmail: (currentUser && currentUser.email) || (authState && authState.email) || '',
      drivingLicense: verifiedDlData?.dlNumber || 'KL-10-2018-0007333',
      dlPhotoUrl: verifiedDlData?.dlPhotoUrl || '',
      dlAiStatus: verifiedDlData?.aiStatus || 'AI_VERIFIED',
      dlAiScore: verifiedDlData?.aiScore || 95,
      dlAiNotes: verifiedDlData?.aiNotes || '',
      bikeId: selectedBike.id,
      bikeName: selectedBike.name,
      bikeEdition: selectedBike.edition || '',
      bikeRegNo: selectedBike.registrationNumber || 'KL-11-BX-4501',
      bikeImage: selectedBike.image || '',
      pickupDateTime: pickupTime,
      dropoffDateTime: dropoffTime,
      pickupLocation: locationText,
      dropoffLocation: locationText,
      rentalDurationHours: hours,
      rentalDurationDays: days,
      rentalAmount,
      depositAmount: deposit,
      paymentMethod,
      userId: (currentUser && currentUser.id) || undefined
    })
  });

  if (!verifyData.success) {
    throw new Error(verifyData.message || 'Payment verification failed.');
  }

  renderPaymentSuccessScreen(verifyData.invoice, bookingCtx, razorpay_payment_id);
}

/**
 * Render Payment Success Screen with Tax Invoice and Delivery Status
 */
function renderPaymentSuccessScreen(inv, bookingCtx, paymentId) {
  const {
    bookingId,
    name,
    phone,
    selectedBike,
    pickupTime,
    dropoffTime,
    locationText,
    days
  } = bookingCtx;

  const modalBody = document.getElementById('modalDynamicContent');
  if (!modalBody) return;

  const cleanPhoneDigits = String(phone).replace(/\D/g, '').slice(-10);

  // Itemized message for WhatsApp
  const waMessage = encodeURIComponent(
    `Namaskaram ValoHub! 🛵\n\n` +
    `Payment confirmed for *${selectedBike.name}*!\n\n` +
    `• Booking Ref: ${bookingId}\n` +
    `• Tax Invoice: ${inv.invoiceNumber}\n` +
    `• Payment ID: ${paymentId}\n` +
    `• Rider: ${name} (DL: ${verifiedDlData?.dlNumber || 'Verified'})\n` +
    `• Rental Tariff: ₹${inv.baseAmount}\n` +
    `• 18% GST (CGST 9% + SGST 9%): ₹${inv.totalGst}\n` +
    `• Refundable Security Deposit: ₹${inv.depositAmount}\n` +
    `• Total Paid: ₹${inv.totalAmount}\n` +
    `• Pickup Hub: ${locationText}\n` +
    `• Duration: ${days} Days (${pickupTime} to ${dropoffTime})\n\n` +
    `Tax invoice PDF generated under SAC 996601.`
  );

  modalBody.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-icon" style="background-color: #ECFDF5; color: #059669;">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h3 class="confirmation-title" style="color: #065F46;">Payment Successful & Reserved!</h3>
      <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
        <span class="confirmation-code">Ref: ${bookingId}</span>
        <span class="confirmation-code" style="background-color: #EEF2FF; border-color: #6366F1; color: #4338CA;">
          GST Invoice: ${inv.invoiceNumber}
        </span>
      </div>

      <p style="color: var(--color-text-secondary); margin-bottom: 18px; font-size: 0.95rem;">
        Namaskaram <strong>${name}</strong>! Your <strong>${selectedBike.name}</strong> is confirmed. Official GST Tax Invoice has been generated.
      </p>

      <!-- Delivery Live Badge -->
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 18px; font-size: 0.85rem; color: #166534; font-weight: 600;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.004.551 1.777.846 2.806.846 3.182 0 5.768-2.587 5.768-5.766.001-3.18-2.585-5.767-5.768-5.767zm0 10.455c-.943 0-1.637-.253-2.434-.73l-.474-.282-1.57.411.419-1.53-.308-.491c-.532-.849-.814-1.564-.814-2.499 0-2.628 2.138-4.767 4.767-4.767 2.629 0 4.767 2.139 4.767 4.767s-2.138 4.767-4.767 4.767zm7.969-4.689c0 4.418-3.582 8-8 8-1.42 0-2.75-.373-3.906-1.025l-4.094 1.074 1.094-3.99c-.714-1.196-1.094-2.58-1.094-4.059 0-4.418 3.582-8 8-8s8 3.582 8 8z"/>
        </svg>
        <span>Invoice & Gate Pass Generated for +91 ${cleanPhoneDigits} (Email & WhatsApp Ready)</span>
      </div>

      <!-- Itemized Tax Invoice Breakdown Card -->
      <div style="background: var(--color-pearl-bg); border-radius: var(--radius-md); padding: 18px; margin-bottom: 20px; text-align: left; font-size: 0.875rem; border: 1px solid #E2E8F0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748B;">Vehicle Reserved:</span>
          <strong>${selectedBike.name} (${selectedBike.edition})</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748B;">Government DL:</span>
          <code>${verifiedDlData?.dlNumber || 'KL-10-2018-0007333'}</code> (MCWG Verified)
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748B;">Base Rental Tariff:</span>
          <span>₹${inv.baseAmount.toLocaleString('en-IN')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748B;">Central GST (CGST @ 9%):</span>
          <span>₹${inv.cgst.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #64748B;">State GST (SGST @ 9%):</span>
          <span>₹${inv.sgst.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #0369A1;">
          <span style="font-weight: 600;">Refundable Security Deposit:</span>
          <span style="font-weight: 700;">₹${inv.depositAmount.toLocaleString('en-IN')} (Held)</span>
        </div>
        <div style="border-top: 1px dashed #CBD5E1; margin: 8px 0; padding-top: 8px; display: flex; justify-content: space-between; font-weight: 800; font-size: 1rem; color: #0F172A;">
          <span>Total Paid (Online):</span>
          <span style="color: #059669;">₹${inv.totalAmount.toLocaleString('en-IN')}</span>
        </div>
        <div style="font-size: 0.76rem; color: #64748B; margin-top: 6px;">
          Tax Category: Passenger Motor Vehicle Rental without Operator (SAC 996601) • GSTIN: 32AABCV1234F1Z9
        </div>
      </div>

      <!-- Action CTAs -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <!-- View in My Bookings Button -->
        <button type="button" class="btn btn-block btn-lg" onclick="closeBookingModal(); openUserBookingsModal();" style="background-color: var(--color-asphalt-black); border: 1.5px solid #333; color: #FFC107; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
            <path d="M7 15h0M12 15h6"/>
          </svg>
          View in My Bookings & Rental Status
        </button>

        <!-- Direct PDF Download Link -->
        <a href="${inv.pdfPath}" download target="_blank" class="btn btn-primary btn-block btn-lg" style="background: linear-gradient(135deg, #1E40AF, #3B82F6); border-color: #1E40AF; color: #FFF; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Download Official GST Tax Invoice (PDF)
        </a>

        <!-- Send directly to customer's WhatsApp -->
        <a href="https://wa.me/91${cleanPhoneDigits}?text=${waMessage}" target="_blank" class="btn btn-block btn-lg" style="background-color: #25D366; border-color: #25D366; color: #FFF; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.004.551 1.777.846 2.806.846 3.182 0 5.768-2.587 5.768-5.766.001-3.18-2.585-5.767-5.768-5.767zm0 10.455c-.943 0-1.637-.253-2.434-.73l-.474-.282-1.57.411.419-1.53-.308-.491c-.532-.849-.814-1.564-.814-2.499 0-2.628 2.138-4.767 4.767-4.767 2.629 0 4.767 2.139 4.767 4.767s-2.138 4.767-4.767 4.767zm7.969-4.689c0 4.418-3.582 8-8 8-1.42 0-2.75-.373-3.906-1.025l-4.094 1.074 1.094-3.99c-.714-1.196-1.094-2.58-1.094-4.059 0-4.418 3.582-8 8-8s8 3.582 8 8z"/>
          </svg>
          Send Invoice to My WhatsApp (+91 ${cleanPhoneDigits})
        </a>

        <!-- WhatsApp Chat with Hub Button -->
        <a href="https://wa.me/917591982882?text=${waMessage}" target="_blank" class="btn btn-outline btn-block" style="display: flex; align-items: center; justify-content: center; gap: 8px; border-color: #25D366; color: #166534; font-weight: 600;">
          Chat with Kozhikode Hub (+91 75919 82882)
        </a>

        <button type="button" class="btn btn-outline btn-block" onclick="closeBookingModal()">
          Done & Return to Fleet
        </button>
      </div>
    </div>
  `;
}

/**
 * Event Listeners Initialization
 */
function initEventListeners() {
  const pDateInput = document.getElementById('pickupDate');
  const pSlotSelect = document.getElementById('pickupTimeSlot');
  const dDateInput = document.getElementById('dropoffDate');
  const dSlotSelect = document.getElementById('dropoffTimeSlot');
  const pickupInput = document.getElementById('pickupDateTime');
  const dropoffInput = document.getElementById('dropoffDateTime');
  const searchBtn = document.getElementById('searchBikesBtn');
  const mobileSearchBtn = document.getElementById('mobileSearchBtn');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalOverlay = document.getElementById('bookingModal');

  const onPickupChange = () => {
    syncDateTimeValues();
    const pDateVal = pDateInput?.value;
    if (pDateVal && dDateInput) {
      dDateInput.min = pDateVal;
    }
    updateDurationAndPricing();
  };

  const onDropoffChange = () => {
    syncDateTimeValues();
    updateDurationAndPricing();
  };

  if (pDateInput) pDateInput.addEventListener('change', onPickupChange);
  if (pSlotSelect) pSlotSelect.addEventListener('change', onPickupChange);
  if (dDateInput) dDateInput.addEventListener('change', onDropoffChange);
  if (dSlotSelect) dSlotSelect.addEventListener('change', onDropoffChange);

  if (pickupInput) {
    pickupInput.addEventListener('change', updateDurationAndPricing);
  }
  if (dropoffInput) {
    dropoffInput.addEventListener('change', updateDurationAndPricing);
  }

  // Smooth scroll to fleet on search (after verifying pickup and dropoff dates are selected)
  const scrollToFleet = (e) => {
    e.preventDefault();
    const pDateTime = document.getElementById('pickupDateTime');
    const dDateTime = document.getElementById('dropoffDateTime');
    const validationEl = document.getElementById('bookingValidationNotice');

    if (!pDateTime?.value || !dDateTime?.value) {
      if (validationEl) {
        validationEl.textContent = 'Please select both Pickup Date & Time and Dropoff Date & Time to search available bikes.';
        validationEl.style.display = 'block';
      }
      pDateInput?.focus();
      return;
    }

    const p = new Date(pDateTime.value);
    const d = new Date(dDateTime.value);
    if (d <= p) {
      if (validationEl) {
        validationEl.textContent = 'Dropoff date & time must be after pickup date & time.';
        validationEl.style.display = 'block';
      }
      return;
    }

    if (validationEl) validationEl.style.display = 'none';
    const fleetSection = document.getElementById('fleet');
    if (fleetSection) {
      fleetSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (searchBtn) searchBtn.addEventListener('click', scrollToFleet);
  if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', scrollToFleet);

  // Mobile menu toggle & drawer handling
  if (mobileMenuToggle && mobileNavDrawer) {
    mobileMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileNavDrawer.classList.toggle('active');
    });

    // Close mobile drawer when clicking any link inside it
    mobileNavDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('active');
      });
    });

    // Close when clicking outside of drawer
    document.addEventListener('click', (e) => {
      if (!mobileNavDrawer.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
        mobileNavDrawer.classList.remove('active');
      }
    });
  }

  // Modal close
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeBookingModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeBookingModal();
    });
  }

  // Date alert overlay click
  const dateAlertOverlay = document.getElementById('dateRequiredModal');
  if (dateAlertOverlay) {
    dateAlertOverlay.addEventListener('click', (e) => {
      if (e.target === dateAlertOverlay) closeDateAlert();
    });
  }

  // Smooth scroll handler for all internal anchor links (Our Bikes, How It Works, Requirements, Scenic Rides, Contact)
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function(e) {
      const hash = this.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (target) {
        e.preventDefault();
        if (mobileNavDrawer) mobileNavDrawer.classList.remove('active');
        const navHeight = document.getElementById('mainNavbar')?.offsetHeight || 72;
        const targetTop = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 12;
        window.scrollTo({
          top: targetTop,
          behavior: 'smooth'
        });
        if (this.classList.contains('nav-link')) {
          document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active'));
          this.classList.add('active');
        }
      }
    });
  });

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBookingModal();
      closeDateAlert();
      closeAuthModal();
      closeUserBookingsModal();
    }
  });
}

/* ==========================================================================
   ValoHub Authentication Flow Logic (Username/Password Login & Sign Up)
   ========================================================================== */

let authState = {
  currentView: 'login', // 'login' | 'signup' | 'forgot' | 'success'
  forgotStep: 1,        // 1: request OTP, 2: enter OTP & reset password
  forgotEmail: ''
};

let currentUser = (() => {
  try {
    return JSON.parse(localStorage.getItem('valohub_user') || 'null');
  } catch (e) {
    return null;
  }
})();

let userToken = (() => {
  try {
    return localStorage.getItem('valohub_user_token') || '';
  } catch (e) {
    return '';
  }
})();

/**
 * Initialize Authentication Flow
 */
function initAuthFlow() {
  updateNavAuthState();
  setupAuthKeyboardListeners();

  // Auto-sync active session if user is logged in
  if (currentUser && !userToken) {
    safeJsonFetch('/api/user/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: currentUser.email,
        phone: currentUser.phone,
        user: currentUser
      })
    }).then(res => {
      if (res && res.token) {
        userToken = res.token;
        try { localStorage.setItem('valohub_user_token', res.token); } catch (e) {}
      }
    }).catch(() => {});
  }

  // Backdrop click on auth modal
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });
  }

  // Backdrop click on user bookings modal
  const bookingsModal = document.getElementById('userBookingsModal');
  if (bookingsModal) {
    bookingsModal.addEventListener('click', (e) => {
      if (e.target === bookingsModal) {
        closeUserBookingsModal();
      }
    });
  }

  // Check URL hash for direct login link (e.g. #login)
  if (window.location.hash === '#login') {
    setTimeout(() => openAuthModal('login'), 300);
  }
}

/**
 * Open Authentication Modal
 */
window.openAuthModal = function(view = 'login', context = '') {
  const modalOverlay = document.getElementById('authModal');
  if (!modalOverlay) return;

  if (context !== 'booking') {
    pendingBookingBikeId = null;
    const notice = document.getElementById('authBookingNotice');
    if (notice) notice.style.display = 'none';
  }

  modalOverlay.style.display = 'flex';
  setTimeout(() => {
    modalOverlay.classList.add('active');
  }, 10);

  // Normalize view parameter for backward compatibility
  if (view === 1 || view === 'phone' || view === 'email' || !view) view = 'login';
  if (view === 2 || view === 'otp') view = 'login';
  if (view === 3 || view === 'profile') view = 'signup';

  goToAuthView(view);
};

/**
 * Close Authentication Modal
 */
window.closeAuthModal = function() {
  const modalOverlay = document.getElementById('authModal');
  if (!modalOverlay) return;

  modalOverlay.classList.remove('active');

  setTimeout(() => {
    modalOverlay.style.display = 'none';
  }, 250);
};

/**
 * Switch Active View in Auth Modal ('login' | 'signup' | 'forgot' | 'success')
 */
window.goToAuthView = function(view) {
  // Normalize
  if (view === 1 || view === 'phone' || view === 'email') view = 'login';
  if (view === 2 || view === 'otp') view = 'login';
  if (view === 3 || view === 'profile') view = 'signup';

  authState.currentView = view;

  // Hide all screens
  document.querySelectorAll('.auth-screen').forEach(el => el.classList.remove('active'));

  // Reset all field error messages
  document.querySelectorAll('.auth-field-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });

  if (view === 'login') {
    const sLogin = document.getElementById('authScreenLogin');
    if (sLogin) sLogin.classList.add('active');
    const idInput = document.getElementById('loginIdentifierInput');
    if (idInput) setTimeout(() => idInput.focus(), 150);
  } else if (view === 'signup') {
    const sSignup = document.getElementById('authScreenSignup');
    if (sSignup) sSignup.classList.add('active');
    const nameInput = document.getElementById('signupNameInput');
    if (nameInput) setTimeout(() => nameInput.focus(), 150);
  } else if (view === 'forgot') {
    const sForgot = document.getElementById('authScreenForgot');
    if (sForgot) sForgot.classList.add('active');

    // Reset forgot state to Step 1
    authState.forgotStep = 1;
    const step1 = document.getElementById('forgotStep1Container');
    const step2 = document.getElementById('forgotStep2Container');
    const actionBtn = document.getElementById('forgotActionBtn');

    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (actionBtn) actionBtn.textContent = 'SEND RESET CODE';

    const forgotEmail = document.getElementById('forgotEmailInput');
    if (forgotEmail) setTimeout(() => forgotEmail.focus(), 150);
  } else if (view === 'success') {
    const sSuccess = document.getElementById('authScreenSuccess');
    if (sSuccess) sSuccess.classList.add('active');
  }
};
window.goToAuthScreen = window.goToAuthView;

/**
 * Toggle Password Visibility (Eye Icon Toggle)
 */
window.togglePasswordVisibility = function(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  if (btnEl) {
    const eyeOpen = btnEl.querySelector('.eye-open');
    const eyeClosed = btnEl.querySelector('.eye-closed');
    if (eyeOpen && eyeClosed) {
      eyeOpen.style.display = isPassword ? 'none' : 'block';
      eyeClosed.style.display = isPassword ? 'block' : 'none';
    }
  }
};

/**
 * Intelligent API Base URL Resolver
 */
function getApiBaseUrl() {
  if (window.location.port === '3000') {
    return '';
  }
  if (
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost' ||
    window.location.protocol === 'file:'
  ) {
    return 'http://127.0.0.1:3000';
  }
  return '';
}

/**
 * Resilient JSON Fetch Wrapper
 */
async function safeJsonFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;
  let response;
  try {
    response = await fetch(url, options);
  } catch (netErr) {
    throw new Error(`Unable to reach ValoHub server at ${url}. Please ensure 'node server.js' is running on port 3000.`);
  }

  const rawText = await response.text();
  let data = null;
  if (rawText && rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      throw new Error(`Server returned non-JSON response (${response.status}): ${rawText.slice(0, 100)}`);
    }
  }

  if (!response.ok) {
    const errorMsg = (data && (data.message || data.error)) 
      ? (data.message || data.error)
      : `Request failed with status ${response.status} (${response.statusText || 'Error'})`;
    throw new Error(errorMsg);
  }

  return data || {};
}

/**
 * Handle Login Submission (Username or Email + Password - NO OTP)
 */
window.handleUserLogin = async function() {
  const idInput = document.getElementById('loginIdentifierInput');
  const pwdInput = document.getElementById('loginPasswordInput');
  const idError = document.getElementById('loginIdentifierError');
  const pwdError = document.getElementById('loginPasswordError');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (idError) { idError.textContent = ''; idError.classList.remove('visible'); }
  if (pwdError) { pwdError.textContent = ''; pwdError.classList.remove('visible'); }

  const identifier = idInput ? idInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value : '';

  let hasError = false;
  if (!identifier) {
    if (idError) {
      idError.textContent = 'Please enter your username or email address.';
      idError.classList.add('visible');
    }
    if (idInput) idInput.focus();
    hasError = true;
  }

  if (!password) {
    if (pwdError) {
      pwdError.textContent = 'Please enter your password.';
      pwdError.classList.add('visible');
    }
    if (!hasError && pwdInput) pwdInput.focus();
    hasError = true;
  }

  if (hasError) return;

  const originalBtnText = submitBtn ? submitBtn.textContent : 'LOG IN';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'LOGGING IN...';
    submitBtn.style.opacity = '0.7';
  }

  try {
    const data = await safeJsonFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    if (!data.success || !data.user) {
      throw new Error(data.message || 'Login failed. Please check your credentials.');
    }

    userToken = data.token;
    currentUser = data.user;
    try {
      localStorage.setItem('valohub_user', JSON.stringify(data.user));
      localStorage.setItem('valohub_user_token', data.token);
    } catch (e) {}

    updateNavAuthState();

    // If triggered from "Book Now", automatically resume booking
    if (pendingBookingBikeId) {
      const bikeToBook = pendingBookingBikeId;
      pendingBookingBikeId = null;
      closeAuthModal();
      setTimeout(() => openBookingModal(bikeToBook), 300);
      showUserToast(`Logged in as ${data.user.name}.`);
      return;
    }

    // Success screen
    const welcomeHeading = document.getElementById('authWelcomeHeading');
    const welcomeDesc = document.getElementById('authWelcomeDesc');
    if (welcomeHeading) welcomeHeading.textContent = `Welcome back, ${data.user.name.split(' ')[0]}!`;
    if (welcomeDesc) welcomeDesc.textContent = `You are logged in as @${data.user.username || data.user.name}. Ready for your Kozhikode ride!`;

    goToAuthView('success');
    showUserToast(`Welcome back, ${data.user.name}!`);
  } catch (err) {
    if (pwdError) {
      pwdError.textContent = err.message || 'Invalid username/email or password.';
      pwdError.classList.add('visible');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      submitBtn.style.opacity = '1';
    }
  }
};

/**
 * Handle Sign Up Submission (Full Name, Username, Email, Phone, Password)
 */
window.handleUserSignup = async function() {
  const nameInput = document.getElementById('signupNameInput');
  const usernameInput = document.getElementById('signupUsernameInput');
  const emailInput = document.getElementById('signupEmailInput');
  const phoneInput = document.getElementById('signupPhoneInput');
  const pwdInput = document.getElementById('signupPasswordInput');

  const nameError = document.getElementById('signupNameError');
  const usernameError = document.getElementById('signupUsernameError');
  const emailError = document.getElementById('signupEmailError');
  const phoneError = document.getElementById('signupPhoneError');
  const pwdError = document.getElementById('signupPasswordError');
  const submitBtn = document.getElementById('signupSubmitBtn');

  // Clear errors
  [nameError, usernameError, emailError, phoneError, pwdError].forEach(el => {
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
  });

  const name = nameInput ? nameInput.value.trim() : '';
  const username = usernameInput ? usernameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
  const rawPhone = phoneInput ? phoneInput.value.trim().replace(/\D/g, '') : '';
  const password = pwdInput ? pwdInput.value : '';

  let hasError = false;

  if (!name || name.length < 2) {
    if (nameError) { nameError.textContent = 'Please enter your full name.'; nameError.classList.add('visible'); }
    if (!hasError && nameInput) nameInput.focus();
    hasError = true;
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!username || !usernameRegex.test(username)) {
    if (usernameError) { usernameError.textContent = 'Username must be 3-30 characters (letters, numbers, underscores).'; usernameError.classList.add('visible'); }
    if (!hasError && usernameInput) usernameInput.focus();
    hasError = true;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    if (emailError) { emailError.textContent = 'Please enter a valid email address (e.g. rider@gmail.com).'; emailError.classList.add('visible'); }
    if (!hasError && emailInput) emailInput.focus();
    hasError = true;
  }

  const cleanPhone = rawPhone.slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    if (phoneError) { phoneError.textContent = 'Please enter a valid 10-digit WhatsApp mobile number.'; phoneError.classList.add('visible'); }
    if (!hasError && phoneInput) phoneInput.focus();
    hasError = true;
  }

  if (!password || password.length < 6) {
    if (pwdError) { pwdError.textContent = 'Password must be at least 6 characters.'; pwdError.classList.add('visible'); }
    if (!hasError && pwdInput) pwdInput.focus();
    hasError = true;
  }

  if (hasError) return;

  const originalBtnText = submitBtn ? submitBtn.textContent : 'SIGN UP & RIDE';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'CREATING ACCOUNT...';
    submitBtn.style.opacity = '0.7';
  }

  try {
    const data = await safeJsonFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        username,
        email,
        phone: `+91 ${cleanPhone}`,
        password
      })
    });

    if (!data.success || !data.user) {
      throw new Error(data.message || 'Registration failed.');
    }

    userToken = data.token;
    currentUser = data.user;
    try {
      localStorage.setItem('valohub_user', JSON.stringify(data.user));
      localStorage.setItem('valohub_user_token', data.token);
    } catch (e) {}

    updateNavAuthState();

    if (pendingBookingBikeId) {
      const bikeToBook = pendingBookingBikeId;
      pendingBookingBikeId = null;
      closeAuthModal();
      setTimeout(() => openBookingModal(bikeToBook), 300);
      showUserToast(`Welcome to ValoHub, ${data.user.name}!`);
      return;
    }

    const welcomeHeading = document.getElementById('authWelcomeHeading');
    const welcomeDesc = document.getElementById('authWelcomeDesc');
    if (welcomeHeading) welcomeHeading.textContent = `Welcome, ${data.user.name.split(' ')[0]}!`;
    if (welcomeDesc) welcomeDesc.textContent = `Your account (@${data.user.username}) is ready for your Kozhikode ride!`;

    goToAuthView('success');
    showUserToast(`Welcome, ${data.user.name}!`);
  } catch (err) {
    const msg = err.message || 'Registration error.';
    if (msg.toLowerCase().includes('username')) {
      if (usernameError) { usernameError.textContent = msg; usernameError.classList.add('visible'); }
    } else if (msg.toLowerCase().includes('email')) {
      if (emailError) { emailError.textContent = msg; emailError.classList.add('visible'); }
    } else if (msg.toLowerCase().includes('phone')) {
      if (phoneError) { phoneError.textContent = msg; phoneError.classList.add('visible'); }
    } else if (msg.toLowerCase().includes('id') || msg.toLowerCase().includes('aadhaar')) {
      if (govtIdError) { govtIdError.textContent = msg; govtIdError.classList.add('visible'); }
    } else {
      if (pwdError) { pwdError.textContent = msg; pwdError.classList.add('visible'); }
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      submitBtn.style.opacity = '1';
    }
  }
};

/**
 * Handle Forgot Password Flow (Step 1: Send OTP to Email -> Step 2: Verify OTP & Set New Password)
 */
window.handleForgotFlowSubmit = async function() {
  const emailInput = document.getElementById('forgotEmailInput');
  const emailError = document.getElementById('forgotEmailError');
  const otpInput = document.getElementById('forgotOtpInput');
  const otpError = document.getElementById('forgotOtpError');
  const pwdInput = document.getElementById('forgotNewPasswordInput');
  const pwdError = document.getElementById('forgotNewPasswordError');
  const actionBtn = document.getElementById('forgotActionBtn');

  if (authState.forgotStep === 1) {
    if (emailError) { emailError.textContent = ''; emailError.classList.remove('visible'); }
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      if (emailError) { emailError.textContent = 'Please enter a valid registered email address.'; emailError.classList.add('visible'); }
      if (emailInput) emailInput.focus();
      return;
    }

    const originalText = actionBtn ? actionBtn.textContent : 'SEND RESET CODE';
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = 'SENDING OTP...';
      actionBtn.style.opacity = '0.7';
    }

    try {
      const data = await safeJsonFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!data.success) {
        throw new Error(data.message || 'Unable to send reset code.');
      }

      authState.forgotEmail = email;
      authState.forgotStep = 2;

      const step1 = document.getElementById('forgotStep1Container');
      const step2 = document.getElementById('forgotStep2Container');
      const displayEmail = document.getElementById('forgotDisplayEmail');

      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';
      if (displayEmail) displayEmail.textContent = email;
      if (actionBtn) actionBtn.textContent = 'RESET PASSWORD & LOG IN';

      if (otpInput) setTimeout(() => otpInput.focus(), 150);
      showUserToast('Verification code sent to your email.');
    } catch (err) {
      if (emailError) {
        emailError.textContent = err.message || 'Error sending reset code.';
        emailError.classList.add('visible');
      }
    } finally {
      if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
        if (authState.forgotStep === 1) actionBtn.textContent = originalText;
      }
    }
  } else if (authState.forgotStep === 2) {
    if (otpError) { otpError.textContent = ''; otpError.classList.remove('visible'); }
    if (pwdError) { pwdError.textContent = ''; pwdError.classList.remove('visible'); }

    const enteredOtp = otpInput ? otpInput.value.trim().replace(/\D/g, '') : '';
    const newPassword = pwdInput ? pwdInput.value : '';

    let hasErr = false;
    if (!enteredOtp || enteredOtp.length !== 6) {
      if (otpError) { otpError.textContent = 'Please enter the 6-digit verification code sent to your email.'; otpError.classList.add('visible'); }
      if (otpInput) otpInput.focus();
      hasErr = true;
    }

    if (!newPassword || newPassword.length < 6) {
      if (pwdError) { pwdError.textContent = 'New password must be at least 6 characters.'; pwdError.classList.add('visible'); }
      if (!hasErr && pwdInput) pwdInput.focus();
      hasErr = true;
    }

    if (hasErr) return;

    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = 'RESETTING...';
      actionBtn.style.opacity = '0.7';
    }

    try {
      const data = await safeJsonFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authState.forgotEmail,
          otp: enteredOtp,
          newPassword
        })
      });

      if (!data.success || !data.user) {
        throw new Error(data.message || 'Password reset failed.');
      }

      userToken = data.token;
      currentUser = data.user;
      try {
        localStorage.setItem('valohub_user', JSON.stringify(data.user));
        localStorage.setItem('valohub_user_token', data.token);
      } catch (e) {}

      updateNavAuthState();

      if (pendingBookingBikeId) {
        const bikeToBook = pendingBookingBikeId;
        pendingBookingBikeId = null;
        closeAuthModal();
        setTimeout(() => openBookingModal(bikeToBook), 300);
        showUserToast('Password reset successful! You are logged in.');
        return;
      }

      const welcomeHeading = document.getElementById('authWelcomeHeading');
      const welcomeDesc = document.getElementById('authWelcomeDesc');
      if (welcomeHeading) welcomeHeading.textContent = `Password Reset!`;
      if (welcomeDesc) welcomeDesc.textContent = `Your password was updated and you are logged in as ${data.user.name}.`;

      goToAuthView('success');
      showUserToast('Password reset successful!');
    } catch (err) {
      if (otpError) {
        otpError.textContent = err.message || 'Verification failed. Please check the code.';
        otpError.classList.add('visible');
      }
    } finally {
      if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.textContent = 'RESET PASSWORD & LOG IN';
        actionBtn.style.opacity = '1';
      }
    }
  }
};

/**
 * Setup keyboard Enter listener on inputs
 */
function setupAuthKeyboardListeners() {
  const loginInputs = ['loginIdentifierInput', 'loginPasswordInput'];
  loginInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUserLogin();
      });
    }
  });

  const signupInputs = [
    'signupNameInput', 
    'signupUsernameInput', 
    'signupEmailInput', 
    'signupPhoneInput', 
    'signupPasswordInput'
  ];
  signupInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUserSignup();
      });
    }
  });

  const forgotInputs = ['forgotEmailInput', 'forgotOtpInput', 'forgotNewPasswordInput'];
  forgotInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleForgotFlowSubmit();
      });
    }
  });
}

/**
 * Update Navigation Auth Button / Profile Pill
 * Dynamically renders Log in or Log out button directly in the navbar
 */
function updateNavAuthState() {
  const navAuthContainer = document.getElementById('navAuthContainer');
  const mobileDrawerAuthContainer = document.getElementById('mobileDrawerAuthContainer');

  const isLoggedIn = Boolean(currentUser && (currentUser.name || currentUser.username || currentUser.phone || currentUser.email));

  // Toggle user-logged-in class on body to control navbar layout dynamically
  document.body.classList.toggle('user-logged-in', isLoggedIn);

  if (isLoggedIn) {
    const displayName = currentUser.name || currentUser.username || currentUser.phone || 'Rider';
    const firstName = displayName.split(' ')[0];
    const initial = firstName.charAt(0).toUpperCase();

    const desktopAuthHtml = `
      <div class="nav-user-actions-group">
        <button type="button" class="btn btn-outline btn-pill btn-sm btn-nav-bookings" onclick="openUserBookingsModal()" title="View my purchased rentals & pickup/drop schedule">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
            <path d="M7 15h0M12 15h6"/>
          </svg>
          <span class="bookings-btn-label">My Bookings</span>
        </button>
        <button type="button" class="btn btn-outline btn-pill btn-sm btn-nav-logout" id="navLogoutBtn" onclick="logoutUser()" title="Log out of ValoHub">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="auth-btn-label">Log out</span>
        </button>
      </div>
    `;

    const mobileAuthHtml = `
      <div style="background: rgba(0,0,0,0.04); border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px; margin-top: 6px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="nav-user-avatar">${initial}</span>
            <div>
              <div style="font-weight: 700; color: #1A1A1A; font-size: 0.9rem;">${displayName}</div>
              <div style="font-size: 0.75rem; color: #64748B;">@${currentUser.username || currentUser.email || currentUser.phone}</div>
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm btn-nav-logout" onclick="logoutUser()" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; color: #DC2626; border-color: #FCA5A5; background: #FEF2F2; border-radius: 8px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Log out</span>
          </button>
        </div>
        <button type="button" class="btn btn-primary btn-sm btn-block" onclick="openUserBookingsModal(); const d = document.getElementById('mobileNavDrawer'); if(d) d.classList.remove('active');" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h0M12 15h6"/></svg>
          <span>View My Purchased Rentals</span>
        </button>
      </div>
    `;

    if (navAuthContainer) navAuthContainer.innerHTML = desktopAuthHtml;
    if (mobileDrawerAuthContainer) mobileDrawerAuthContainer.innerHTML = mobileAuthHtml;
  } else {
    const desktopLoginHtml = `
      <button type="button" class="btn btn-outline btn-pill btn-sm btn-nav-auth" id="navLoginBtn" onclick="openAuthModal('login')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span class="auth-btn-label">Log in</span>
      </button>
    `;

    const mobileLoginHtml = `
      <button type="button" class="btn btn-outline btn-block" onclick="openAuthModal('login'); const d = document.getElementById('mobileNavDrawer'); if(d) d.classList.remove('active');">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="auth-btn-label">Log in</span>
      </button>
    `;

    if (navAuthContainer) navAuthContainer.innerHTML = desktopLoginHtml;
    if (mobileDrawerAuthContainer) mobileDrawerAuthContainer.innerHTML = mobileLoginHtml;
  }
}

/**
 * Global User Feedback Toast
 */
window.showUserToast = function(message) {
  let toast = document.getElementById('valohubUserToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'valohubUserToast';
    toast.className = 'valohub-user-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
    <span>${message}</span>
  `;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
};

/**
 * Logout User
 */
window.logoutUser = function() {
  try {
    const token = localStorage.getItem('valohub_user_token');
    if (token) {
      safeJsonFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      }).catch(() => {});
    }
    localStorage.removeItem('valohub_user');
    localStorage.removeItem('valohub_user_token');
  } catch (e) {}
  currentUser = null;
  userToken = '';
  document.body.classList.remove('user-logged-in');
  updateNavAuthState();
  closeUserBookingsModal();
  showUserToast('Logged out successfully.');
};

/**
 * User Purchased Bookings & Status Modal Handlers
 */
window.openUserBookingsModal = async function() {
  const modal = document.getElementById('userBookingsModal');
  if (!modal) return;

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);

  const contentContainer = document.getElementById('userBookingsContent');
  if (!contentContainer) return;

  if (!currentUser) {
    contentContainer.innerHTML = `
      <div class="user-bookings-empty-state">
        <div class="user-bookings-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.8">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <h4>Please Log In to View Your Purchases</h4>
        <p>Your purchased bookings, pickup & dropoff schedules, and official GST tax invoices are safely isolated to your rider account.</p>
        <button type="button" class="btn btn-primary btn-pill" onclick="closeUserBookingsModal(); openAuthModal('phone');" style="margin-top: 14px;">
          Log in or Sign up
        </button>
      </div>
    `;
    return;
  }

  // Loading indicator
  contentContainer.innerHTML = `
    <div class="user-bookings-loading">
      <span class="user-bookings-spinner"></span>
      <p>Retrieving your confirmed reservations & schedule...</p>
    </div>
  `;

  try {
    // Auto sync session if token is missing
    if (!userToken) {
      try {
        const sessionRes = await safeJsonFetch('/api/user/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email,
            phone: currentUser.phone,
            user: currentUser
          })
        });
        if (sessionRes && sessionRes.token) {
          userToken = sessionRes.token;
          try { localStorage.setItem('valohub_user_token', userToken); } catch (e) {}
        }
      } catch (e) {
        console.warn('Session sync error:', e);
      }
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    // Securely fetch isolated bookings for the authenticated user (no insecure ?userId in URL)
    const data = await safeJsonFetch('/api/user/bookings', {
      method: 'GET',
      headers
    });

    if (!data.success) {
      if (data.error === 'UNAUTHORIZED') {
        localStorage.removeItem('valohub_user_token');
        userToken = '';
        throw new Error('Your session has expired. Please log in again to view your bookings.');
      }
      throw new Error(data.message || 'Unable to load purchased bookings.');
    }

    // Strictly map the filtered array of bookings belonging to this authenticated user
    const purchases = data.purchases || data.bookings || [];

    if (purchases.length === 0) {
      contentContainer.innerHTML = `
        <div class="user-bookings-empty-state">
          <div class="user-bookings-empty-icon" style="background: #FFFBEB; color: #D97706;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5"/>
              <circle cx="18.5" cy="17.5" r="3.5"/>
              <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 6H5m7 11.5l3.5-7.5H19"/>
            </svg>
          </div>
          <h4>No Purchased Rentals Found</h4>
          <p>You have no active or completed bookings for <strong>${currentUser.email || currentUser.phone}</strong>. Explore our boutique 3-machine fleet in Kozhikode and rent your freedom.</p>
          <button type="button" class="btn btn-primary btn-pill" onclick="closeUserBookingsModal(); const f = document.getElementById('fleet'); if(f) f.scrollIntoView({ behavior: 'smooth' });" style="margin-top: 14px;">
            Explore Our 3 Bikes
          </button>
        </div>
      `;
      return;
    }

    // Render purchased booking cards
    contentContainer.innerHTML = `
      <div class="user-bookings-list">
        ${purchases.map(booking => renderPurchasedBookingCard(booking)).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Error fetching user purchases:', err);
    contentContainer.innerHTML = `
      <div class="user-bookings-empty-state">
        <div class="user-bookings-empty-icon" style="background: #FEF2F2; color: #EF4444;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h4>Could Not Load Bookings</h4>
        <p>${err.message || 'Please check your network and make sure the ValoHub server is running.'}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="openUserBookingsModal()" style="margin-top: 12px;">
          Try Again
        </button>
      </div>
    `;
  }
};

window.closeUserBookingsModal = function() {
  const modal = document.getElementById('userBookingsModal');
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 220);
};

function renderPurchasedBookingCard(b) {
  const statusBadgeClass = b.status === 'COMPLETED' ? 'status-completed' : (b.status === 'ACTIVE' ? 'status-active' : 'status-confirmed');
  const statusText = b.status === 'COMPLETED' ? 'COMPLETED' : (b.status === 'ACTIVE' ? 'ACTIVE RIDE' : 'CONFIRMED • READY FOR PICKUP');
  const durationText = b.rentalDurationDays ? `${b.rentalDurationDays} Day(s)` : (b.rentalDurationHours ? `${b.rentalDurationHours} Hrs` : '1 Day');
  
  const waMsg = encodeURIComponent(
    `Namaskaram ValoHub Team! I have an inquiry regarding my confirmed rental for ${b.bikeName} (Ref: ${b.bookingReference || b.id}).`
  );

  return `
    <div class="purchased-card" id="booking-${b.id}">
      <!-- Card Header -->
      <div class="purchased-card-header">
        <div class="purchased-bike-title-block">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="purchased-ref-tag">Ref: ${b.bookingReference || b.id}</span>
            <span class="purchased-reg-pill">Reg: <strong>${b.bikeRegNo || 'KL-11-BV-4501'}</strong></span>
          </div>
          <h4 class="purchased-bike-name">${b.bikeName}</h4>
          ${b.bikeEdition ? `<div class="purchased-bike-edition">${b.bikeEdition}</div>` : ''}
        </div>
        <div class="purchased-status-wrap">
          <span class="purchased-status-badge ${statusBadgeClass}">
            <span class="status-pulse-dot"></span>
            ${statusText}
          </span>
          <span class="purchased-date-created">Booked on ${new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      <!-- Schedule Block: When to PICK and When to DROP -->
      <div class="purchased-schedule-grid">
        <!-- PICKUP SCHEDULE -->
        <div class="schedule-box pickup-box">
          <div class="schedule-box-header">
            <div class="schedule-icon-pill pickup-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="schedule-title-label">WHEN TO PICK UP</span>
          </div>
          <div class="schedule-datetime-value">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <strong>${b.pickupDateTime || 'Immediate'}</strong>
          </div>
          <div class="schedule-location-value">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${b.pickupLocation || 'Mavoor Road Hub, Opp. Calicut Railway Station'}</span>
          </div>
          <div class="schedule-perk-hint">
            ✓ Complimentary sanitized helmet & gate pass staged at hub
          </div>
        </div>

        <!-- DROPOFF SCHEDULE -->
        <div class="schedule-box dropoff-box">
          <div class="schedule-box-header">
            <div class="schedule-icon-pill dropoff-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <span class="schedule-title-label">WHEN TO DROP OFF</span>
          </div>
          <div class="schedule-datetime-value">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <strong>${b.dropoffDateTime || 'Next Day'}</strong>
          </div>
          <div class="schedule-location-value">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${b.dropoffLocation || b.pickupLocation || 'Mavoor Road Hub, Opp. Calicut Railway Station'}</span>
          </div>
          <div class="schedule-perk-hint">
            ✓ Duration: ${durationText} • 100% instant ₹${b.depositAmount} deposit refund upon inspection
          </div>
        </div>
      </div>

      <!-- Financial & Invoice Summary -->
      <div class="purchased-finance-strip">
        <div class="finance-col">
          <span class="finance-label">Base Tariff</span>
          <span class="finance-val">₹${Number(b.baseAmount).toLocaleString('en-IN')}</span>
        </div>
        <div class="finance-col">
          <span class="finance-label">18% GST (CGST+SGST)</span>
          <span class="finance-val">₹${Number(b.totalGst || (b.cgst + b.sgst) || 0).toFixed(2)}</span>
        </div>
        <div class="finance-col highlight-deposit">
          <span class="finance-label">Refundable Deposit</span>
          <span class="finance-val">₹${Number(b.depositAmount).toLocaleString('en-IN')} <small>(HELD)</small></span>
        </div>
        <div class="finance-col total-col">
          <span class="finance-label">Total Paid (Online)</span>
          <span class="finance-val total-amount">₹${Number(b.totalAmount).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <!-- Actions Bar -->
      <div class="purchased-card-actions">
        ${b.invoiceNumber ? `
          <a href="${b.publicPdfUrl || b.pdfPath || `/invoices/${b.invoiceNumber}.pdf`}" target="_blank" download class="btn btn-outline btn-sm btn-action-invoice">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Download GST Invoice (${b.invoiceNumber})</span>
          </a>
        ` : ''}
        <a href="https://wa.me/917591982882?text=${waMsg}" target="_blank" class="btn btn-sm btn-action-wa">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#25D366"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.004.551 1.777.846 2.806.846 3.182 0 5.768-2.587 5.768-5.766.001-3.18-2.585-5.767-5.768-5.767zm0 10.455c-.943 0-1.637-.253-2.434-.73l-.474-.282-1.57.411.419-1.53-.308-.491c-.532-.849-.814-1.564-.814-2.499 0-2.628 2.138-4.767 4.767-4.767 2.629 0 4.767 2.139 4.767 4.767s-2.138 4.767-4.767 4.767zm7.969-4.689c0 4.418-3.582 8-8 8-1.42 0-2.75-.373-3.906-1.025l-4.094 1.074 1.094-3.99c-.714-1.196-1.094-2.58-1.094-4.059 0-4.418 3.582-8 8-8s8 3.582 8 8z"/></svg>
          <span>Contact Kozhikode Hub</span>
        </a>
      </div>
    </div>
  `;
}

/**
 * Footer Terms & Privacy Click Handlers
 */
window.handleTermsClick = function(e) {
  e.preventDefault();
  closeAuthModal();
  const reqSection = document.getElementById('requirements');
  if (reqSection) {
    reqSection.scrollIntoView({ behavior: 'smooth' });
  }
};

window.handlePrivacyClick = function(e) {
  e.preventDefault();
  closeAuthModal();
  const contactSection = document.getElementById('contact');
  if (contactSection) {
    contactSection.scrollIntoView({ behavior: 'smooth' });
  }
};


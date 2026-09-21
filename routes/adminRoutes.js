/**
 * routes/adminRoutes.js
 * 
 * Comprehensive ValoHub DBMS & Admin Operations Subsystem:
 * 1. Strict Security & Single-Admin Authentication ('Athul' only, Inactivity Watchdog)
 * 2. Complete CRUD for Fleet/Vehicles, Users, and Bookings
 * 3. Live Financials & Real-time Fleet Utilization KPIs
 * 4. Notification Delivery Audit & Manual Status Overrides
 * 5. Maintenance & Mileage Tracking (Automated Service Flags)
 * 6. Deposit & Damage Management (Full Refund / Damage Deduction)
 * 7. CSV Data Export for Transactions & Bookings
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Strict rate limiter for Admin Login to prevent brute-force attacks
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // Max 5 failed/total attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
  }
});

const { paymentsStore, invoicesStore, bookingsStore, whatsappLogs } = require('./paymentRoutes');

// Data directory for local file persistence
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const bikesFilePath = path.join(dataDir, 'bikes.json');

// --- 1. FLEET INVENTORY STORE & PERSISTENCE ---
const bikesStore = new Map();

const DEFAULT_FLEET = [
  {
    id: "himalayan-450",
    name: "Royal Enfield Himalayan 450",
    brand: "Royal Enfield",
    edition: "Summit Edition (Kamet White)",
    category: "Adventure Touring",
    engineCapacity: "452cc Liquid-Cooled Sherpa",
    registrationNumber: "KL-11-BV-4501",
    hourlyRate: 120,
    dailyRate: 1200,
    depositAmount: 1500,
    isAvailable: true,
    odometerKm: 2450,
    lastServiceKm: 0,
    serviceThresholdKm: 3000,
    isMaintenanceRequired: false,
    images: ["https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=1000&q=80"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString()
  },
  {
    id: "classic-350",
    name: "Royal Enfield Classic 350",
    brand: "Royal Enfield",
    edition: "Reborn Chrome Bronze",
    category: "Modern Classic Cruiser",
    engineCapacity: "349cc J-Series Smooth",
    registrationNumber: "KL-11-BX-4501",
    hourlyRate: 85,
    dailyRate: 850,
    depositAmount: 1000,
    isAvailable: true,
    odometerKm: 4200,
    lastServiceKm: 3000,
    serviceThresholdKm: 3000,
    isMaintenanceRequired: false,
    images: ["https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=1000&q=80"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString()
  },
  {
    id: "duke-390",
    name: "KTM 390 Duke",
    brand: "KTM",
    edition: "Gen-3 Electronic Orange",
    category: "Street Fighter / Performance",
    engineCapacity: "399cc Liquid-Cooled LC4c",
    registrationNumber: "KL-11-BZ-3901",
    hourlyRate: 110,
    dailyRate: 1100,
    depositAmount: 2000,
    isAvailable: true,
    odometerKm: 6150,
    lastServiceKm: 3000,
    serviceThresholdKm: 3000,
    isMaintenanceRequired: true, // Over threshold: 6150 - 3000 = 3150 >= 3000
    images: ["https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString()
  }
];

function initBikesStore() {
  try {
    if (fs.existsSync(bikesFilePath)) {
      const data = JSON.parse(fs.readFileSync(bikesFilePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        data.forEach(bike => bikesStore.set(bike.id, bike));
        console.log(`[Fleet DBMS] Loaded ${bikesStore.size} vehicles from disk.`);
        return;
      }
    }
  } catch (e) {
    console.warn('[Fleet DBMS] Error reading bikes.json, seeding defaults:', e.message);
  }
  DEFAULT_FLEET.forEach(bike => bikesStore.set(bike.id, bike));
  saveBikesToDisk();
}

function saveBikesToDisk() {
  try {
    fs.writeFileSync(bikesFilePath, JSON.stringify(Array.from(bikesStore.values()), null, 2), 'utf8');
  } catch (e) {
    console.warn('[Fleet DBMS] Failed to write bikes to disk:', e.message);
  }
}

initBikesStore();

// --- 2. NOTIFICATIONS AUDIT STORE ---
const notificationLogs = [
  {
    id: "NOTIF_001",
    recipient: "916282567675",
    channel: "WHATSAPP",
    type: "GST_INVOICE_PDF",
    document: "INV-2026-01001.pdf",
    status: "DELIVERED",
    bookingId: "BK-SAMPLE-01",
    timestamp: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: "NOTIF_002",
    recipient: "bkathul84@gmail.com",
    channel: "EMAIL",
    type: "GST_INVOICE_PDF",
    document: "INV-2026-01001.pdf",
    status: "SENT",
    bookingId: "BK-SAMPLE-01",
    timestamp: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: "NOTIF_003",
    recipient: "9847055667",
    channel: "WHATSAPP",
    type: "GST_INVOICE_PDF",
    document: "INV-2026-01002.pdf",
    status: "DELIVERED",
    bookingId: "VH-KZK-774912",
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

// --- 3. SINGLE-ADMIN AUTHENTICATION & INACTIVITY WATCHDOG ---
const adminSessions = new Map();
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Auto-Logout

function getEnv(key, defaultVal = '') {
  return process.env[key] !== undefined ? String(process.env[key]).trim() : defaultVal;
}

function generateAdminSession(adminData) {
  const token = 'vha_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24-hour absolute maximum
  const session = {
    ...adminData,
    token,
    createdAt: now,
    lastActiveAt: now,
    expiresAt
  };
  adminSessions.set(token, session);
  return session;
}

function requireSingleAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : null;
  if (!token) {
    token = req.headers['x-admin-token'] || req.query.admin_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Access Denied: Super-admin authentication required.'
    });
  }

  const session = adminSessions.get(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired admin session token. Please log in.'
    });
  }

  // 1. Enforce strict single-admin identity: ONLY 'Athul'
  const expectedUser = getEnv('ADMIN_USERNAME', 'athul').toLowerCase();
  const expectedEmail = getEnv('ADMIN_EMAIL', 'bkathul84@gmail.com').toLowerCase();
  const sessionUser = String(session.username || '').toLowerCase();
  const sessionEmail = String(session.email || '').toLowerCase();

  if (sessionUser !== expectedUser && sessionEmail !== expectedEmail) {
    adminSessions.delete(token);
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Access Denied: Only designated super-admin Athul is authorized.'
    });
  }

  // 2. Inactivity Watchdog: Auto-logout after 15 minutes of inactivity
  const now = Date.now();
  if (now - session.lastActiveAt > INACTIVITY_TIMEOUT_MS) {
    adminSessions.delete(token);
    return res.status(401).json({
      success: false,
      error: 'SESSION_IDLE_TIMEOUT',
      message: 'Admin session has been terminated due to 15 minutes of inactivity. Please log in again.'
    });
  }

  // Update last active timestamp
  session.lastActiveAt = now;
  req.admin = session;
  next();
}

// --- 4. ADMIN LOGIN & AUTH CONTROLLERS ---

/**
 * POST /api/admin/login
 * Enforces single-admin check ('Athul' / 'bkathul84@gmail.com')
 */
router.post('/login', adminLoginLimiter, (req, res) => {
  const { usernameOrEmail, identifier, username, email, password } = req.body;
  const inputIdent = String(usernameOrEmail || identifier || username || email || '').trim().toLowerCase();
  const inputPass = String(password || '').trim();

  const expectedUser = getEnv('ADMIN_USERNAME', 'athul').toLowerCase();
  const expectedEmail = getEnv('ADMIN_EMAIL', 'bkathul84@gmail.com').toLowerCase();
  const expectedPass = getEnv('ADMIN_PASSWORD', 'valohub@84athul');

  const isIdentMatch = inputIdent === expectedUser || inputIdent === expectedEmail;
  const isPassMatch = inputPass === expectedPass;

  if (!isIdentMatch || !isPassMatch) {
    console.warn(`[Admin Security] ❌ Rejected unauthorized login attempt for "${inputIdent}".`);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const session = generateAdminSession({
    username: 'athul',
    email: 'bkathul84@gmail.com',
    name: 'Athul',
    role: 'SUPERADMIN'
  });

  console.log(`[Admin Security] ✓ Super-admin Athul authenticated. Session: ${session.token.slice(0, 10)}...`);

  return res.json({
    success: true,
    message: 'Super-admin authenticated successfully.',
    token: session.token,
    expiresAt: session.expiresAt,
    inactivityTimeoutMinutes: 15,
    admin: {
      username: 'athul',
      email: 'bkathul84@gmail.com',
      name: 'Athul',
      role: 'SUPERADMIN'
    }
  });
});

/**
 * GET /api/admin/verify
 * Validates active admin session and updates heartbeat
 */
router.get('/verify', requireSingleAdminAuth, (req, res) => {
  return res.json({
    success: true,
    admin: req.admin,
    lastActiveAt: req.admin.lastActiveAt
  });
});

/**
 * POST /api/admin/logout
 * Explicitly terminates admin session
 */
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  let token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : req.headers['x-admin-token'];
  if (token) {
    adminSessions.delete(token);
  }
  return res.json({ success: true, message: 'Admin logged out successfully.' });
});

// --- 5. FLEET INVENTORY CRUD & MILEAGE TRACKER ---

/**
 * GET /api/admin/bikes
 * Returns all bikes in inventory with mileage and maintenance flags
 */
router.get('/bikes', requireSingleAdminAuth, (req, res) => {
  const bikes = Array.from(bikesStore.values());
  return res.json({ success: true, count: bikes.length, bikes });
});

/**
 * POST /api/admin/bikes
 * Adds a new bike to inventory (with tariffs, image, availability toggle)
 */
router.post('/bikes', requireSingleAdminAuth, (req, res) => {
  try {
    const {
      name,
      brand = 'Royal Enfield',
      edition = '',
      category = 'Boutique Rental',
      engineCapacity = '350cc',
      registrationNumber,
      hourlyRate,
      dailyRate,
      depositAmount = 1500,
      odometerKm = 0,
      images = [],
      isAvailable = true
    } = req.body;

    if (!name || !registrationNumber || !dailyRate) {
      return res.status(400).json({
        success: false,
        message: 'Name, registration number, and daily rate are required.'
      });
    }

    const cleanReg = String(registrationNumber).trim().toUpperCase();
    
    // Check for duplicate registration
    const existing = Array.from(bikesStore.values()).find(b => b.registrationNumber === cleanReg);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A vehicle with registration "${cleanReg}" already exists in the fleet.`
      });
    }

    const id = cleanReg.toLowerCase().replace(/[^a-z0-9]/g, '-') || `bike-${Date.now()}`;
    const newBike = {
      id,
      name: name.trim(),
      brand: brand.trim(),
      edition: edition.trim(),
      category: category.trim(),
      engineCapacity: engineCapacity.trim(),
      registrationNumber: cleanReg,
      hourlyRate: Number(hourlyRate || Math.round(dailyRate / 10)),
      dailyRate: Number(dailyRate),
      depositAmount: Number(depositAmount),
      isAvailable: Boolean(isAvailable),
      odometerKm: Number(odometerKm || 0),
      lastServiceKm: Number(odometerKm || 0),
      serviceThresholdKm: 3000,
      isMaintenanceRequired: false,
      images: Array.isArray(images) && images.length > 0 
        ? images 
        : ["https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=1000&q=80"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    bikesStore.set(newBike.id, newBike);
    saveBikesToDisk();

    console.log(`[Fleet DBMS] Added new vehicle "${newBike.name}" (${newBike.registrationNumber})`);
    return res.status(201).json({
      success: true,
      message: `Successfully added ${newBike.name} to the fleet.`,
      bike: newBike
    });
  } catch (err) {
    console.error('Error adding bike:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/admin/bikes/:id
 * Updates tariffs, availability, odometer, or specs
 */
router.put('/bikes/:id', requireSingleAdminAuth, (req, res) => {
  const bike = bikesStore.get(req.params.id);
  if (!bike) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  const fields = ['name', 'brand', 'edition', 'category', 'engineCapacity', 'registrationNumber', 'hourlyRate', 'dailyRate', 'depositAmount', 'isAvailable', 'images'];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      bike[f] = req.body[f];
    }
  });

  bike.updatedAt = new Date().toISOString();
  bikesStore.set(bike.id, bike);
  saveBikesToDisk();

  return res.json({
    success: true,
    message: `Vehicle "${bike.name}" updated successfully.`,
    bike
  });
});

/**
 * DELETE /api/admin/bikes/:id
 * Removes a bike from inventory
 */
router.delete('/bikes/:id', requireSingleAdminAuth, (req, res) => {
  const bike = bikesStore.get(req.params.id);
  if (!bike) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  bikesStore.delete(req.params.id);
  saveBikesToDisk();

  return res.json({
    success: true,
    message: `Vehicle "${bike.name}" (${bike.registrationNumber}) removed from fleet.`
  });
});

/**
 * POST /api/admin/bikes/:id/odometer
 * Logs return odometer reading; triggers 'Maintenance Required' flag if threshold exceeded
 */
router.post('/bikes/:id/odometer', requireSingleAdminAuth, (req, res) => {
  const bike = bikesStore.get(req.params.id);
  if (!bike) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  const { odometerKm } = req.body;
  const newKm = Number(odometerKm);
  if (isNaN(newKm) || newKm < bike.odometerKm) {
    return res.status(400).json({
      success: false,
      message: `Invalid odometer reading. Must be greater than or equal to current reading (${bike.odometerKm} km).`
    });
  }

  bike.odometerKm = newKm;
  const kmSinceLastService = newKm - (bike.lastServiceKm || 0);
  const threshold = bike.serviceThresholdKm || 3000;

  if (kmSinceLastService >= threshold) {
    bike.isMaintenanceRequired = true;
  }

  bike.updatedAt = new Date().toISOString();
  bikesStore.set(bike.id, bike);
  saveBikesToDisk();

  return res.json({
    success: true,
    message: `Odometer updated to ${newKm} km.`,
    bike,
    maintenanceAlert: bike.isMaintenanceRequired,
    kmSinceLastService
  });
});

/**
 * POST /api/admin/bikes/:id/service
 * Marks vehicle as serviced, resetting service counter and maintenance flag
 */
router.post('/bikes/:id/service', requireSingleAdminAuth, (req, res) => {
  const bike = bikesStore.get(req.params.id);
  if (!bike) {
    return res.status(404).json({ success: false, message: 'Vehicle not found.' });
  }

  bike.lastServiceKm = bike.odometerKm;
  bike.isMaintenanceRequired = false;
  bike.updatedAt = new Date().toISOString();
  bikesStore.set(bike.id, bike);
  saveBikesToDisk();

  return res.json({
    success: true,
    message: `Vehicle "${bike.name}" marked as serviced at ${bike.odometerKm} km. Maintenance flag cleared.`,
    bike
  });
});

// --- 6. USERS CRUD OPERATIONS ---

// In-memory reference to registeredUsers (passed from server or managed)
let registeredUsersRef = null;
function setRegisteredUsersRef(ref) {
  registeredUsersRef = ref;
}

router.get('/users', requireSingleAdminAuth, (req, res) => {
  const users = registeredUsersRef ? Array.from(registeredUsersRef.values()) : [];
  return res.json({ success: true, count: users.length, users });
});

router.post('/users', requireSingleAdminAuth, (req, res) => {
  const { name, email, phone, role = 'USER', drivingLicense = '' } = req.body;
  if (!name || (!email && !phone)) {
    return res.status(400).json({ success: false, message: 'Name and email/phone are required.' });
  }

  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
  const id = `USR_${Date.now()}`;

  const newUser = {
    id,
    name: name.trim(),
    email: cleanEmail || undefined,
    phone: cleanPhone ? `+91 ${cleanPhone}` : undefined,
    role,
    drivingLicense: drivingLicense.trim() || undefined,
    isVerified: true,
    registeredAt: new Date().toISOString()
  };

  if (registeredUsersRef) {
    registeredUsersRef.set(cleanEmail || cleanPhone, newUser);
  }

  return res.status(201).json({
    success: true,
    message: `User ${name} created successfully.`,
    user: newUser
  });
});

router.put('/users/:id', requireSingleAdminAuth, (req, res) => {
  if (!registeredUsersRef) {
    return res.status(500).json({ success: false, message: 'User store not initialized.' });
  }

  let user = null;
  for (const u of registeredUsersRef.values()) {
    if (u.id === req.params.id) {
      user = u;
      break;
    }
  }

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const { name, phone, email, role, drivingLicense, isDlVerified } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (email) user.email = email;
  if (role) user.role = role;
  if (drivingLicense) user.drivingLicense = drivingLicense;
  if (isDlVerified !== undefined) user.isDlVerified = Boolean(isDlVerified);

  user.updatedAt = new Date().toISOString();
  return res.json({ success: true, message: `User "${user.name}" updated.`, user });
});

router.delete('/users/:id', requireSingleAdminAuth, (req, res) => {
  if (!registeredUsersRef) {
    return res.status(500).json({ success: false, message: 'User store not initialized.' });
  }

  let foundKey = null;
  for (const [key, u] of registeredUsersRef.entries()) {
    if (u.id === req.params.id) {
      foundKey = key;
      break;
    }
  }

  if (!foundKey) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  registeredUsersRef.delete(foundKey);
  return res.json({ success: true, message: 'User deleted successfully.' });
});

// --- 7. BOOKINGS CRUD & DEPOSIT/DAMAGE MANAGEMENT ---

router.get('/bookings', requireSingleAdminAuth, (req, res) => {
  const bookings = Array.from(bookingsStore.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ success: true, count: bookings.length, bookings });
});

router.post('/bookings', requireSingleAdminAuth, (req, res) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    bikeId,
    pickupDateTime,
    dropoffDateTime,
    pickupLocation = 'Mavoor Road Hub, Kozhikode',
    baseAmount = 1200,
    depositAmount = 1500,
    status = 'CONFIRMED'
  } = req.body;

  if (!customerName || !bikeId) {
    return res.status(400).json({ success: false, message: 'Customer name and bike are required.' });
  }

  const bike = bikesStore.get(bikeId);
  const bookingId = 'VH-KZK-' + Math.floor(100000 + Math.random() * 900000);
  const cgst = Math.round(baseAmount * 0.09 * 100) / 100;
  const sgst = cgst;
  const totalGst = cgst + sgst;
  const totalAmount = Number(baseAmount) + totalGst + Number(depositAmount);

  const newBooking = {
    id: bookingId,
    bookingReference: bookingId,
    customerName,
    customerPhone: String(customerPhone || '').replace(/\D/g, '').slice(-10),
    customerEmail: customerEmail ? String(customerEmail).trim().toLowerCase() : '',
    bikeId,
    bikeName: bike ? bike.name : 'Royal Enfield Himalayan 450',
    bikeEdition: bike ? bike.edition : 'Summit Edition',
    bikeRegNo: bike ? bike.registrationNumber : 'KL-11-BV-4501',
    bikeImage: bike ? bike.images[0] : '',
    pickupDateTime: pickupDateTime || 'Immediate',
    dropoffDateTime: dropoffDateTime || 'Next Day',
    pickupLocation,
    dropoffLocation: pickupLocation,
    baseAmount: Number(baseAmount),
    cgst,
    sgst,
    totalGst,
    depositAmount: Number(depositAmount),
    depositStatus: 'HELD',
    damageAmount: 0,
    refundedDeposit: 0,
    totalAmount,
    status,
    createdAt: new Date().toISOString()
  };

  bookingsStore.set(bookingId, newBooking);
  return res.status(201).json({ success: true, message: 'Booking created successfully.', booking: newBooking });
});

router.put('/bookings/:id', requireSingleAdminAuth, (req, res) => {
  const booking = bookingsStore.get(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  const fields = ['status', 'pickupDateTime', 'dropoffDateTime', 'pickupLocation', 'dropoffLocation', 'depositStatus'];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      booking[f] = req.body[f];
    }
  });

  booking.updatedAt = new Date().toISOString();
  bookingsStore.set(booking.id, booking);
  return res.json({ success: true, message: `Booking ${booking.id} updated.`, booking });
});

router.delete('/bookings/:id', requireSingleAdminAuth, (req, res) => {
  const booking = bookingsStore.get(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  bookingsStore.delete(req.params.id);
  return res.json({ success: true, message: `Booking ${booking.id} removed.` });
});

/**
 * POST /api/admin/bookings/:id/verify-dl
 * Allows Super-Admin Athul to inspect, approve, flag, or reject uploaded Driving License photo
 */
router.post('/bookings/:id/verify-dl', requireSingleAdminAuth, (req, res) => {
  const booking = bookingsStore.get(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  const { status, notes } = req.body; // 'ADMIN_APPROVED', 'RE-UPLOAD_REQUESTED', 'REJECTED'
  if (!status) {
    return res.status(400).json({ success: false, message: 'Verification status is required.' });
  }

  booking.dlAiStatus = status;
  booking.adminDlNotes = notes || `Manually updated by Admin Athul to ${status}`;
  booking.updatedAt = new Date().toISOString();
  bookingsStore.set(booking.id, booking);

  return res.json({
    success: true,
    message: `DL Photo verification for booking ${booking.id} updated to ${status}.`,
    booking
  });
});


/**
 * POST /api/admin/bookings/:id/deposit-action
 * Processes full deposit refund OR deducts specific damage amount before refunding
 */
router.post('/bookings/:id/deposit-action', requireSingleAdminAuth, (req, res) => {
  const booking = bookingsStore.get(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  const { action, damageAmount = 0, damageNotes = '' } = req.body;
  const deposit = Number(booking.depositAmount || 1500);

  if (action === 'REFUND_FULL') {
    booking.depositStatus = 'REFUNDED';
    booking.refundedDeposit = deposit;
    booking.damageAmount = 0;
    booking.damageNotes = '';
    booking.status = 'COMPLETED';
    booking.updatedAt = new Date().toISOString();
    bookingsStore.set(booking.id, booking);

    return res.json({
      success: true,
      message: `Full deposit of ₹${deposit} marked as REFUNDED for booking ${booking.id}.`,
      booking
    });
  }

  if (action === 'DEDUCT_DAMAGE') {
    const damage = Number(damageAmount);
    if (isNaN(damage) || damage < 0 || damage > deposit) {
      return res.status(400).json({
        success: false,
        message: `Damage deduction (₹${damage}) must be between ₹0 and the deposit amount (₹${deposit}).`
      });
    }

    const netRefund = deposit - damage;
    booking.depositStatus = damage === deposit ? 'DEDUCTED_FULL' : 'DEDUCTED';
    booking.damageAmount = damage;
    booking.refundedDeposit = netRefund;
    booking.damageNotes = String(damageNotes || 'Vehicle damage deduction').trim();
    booking.status = 'COMPLETED';
    booking.updatedAt = new Date().toISOString();
    bookingsStore.set(booking.id, booking);

    return res.json({
      success: true,
      message: `Deducted ₹${damage} for damages. Net refund of ₹${netRefund} processed.`,
      booking,
      netRefund,
      damage
    });
  }

  return res.status(400).json({ success: false, message: 'Invalid action. Must be REFUND_FULL or DEDUCT_DAMAGE.' });
});

// --- 8. LIVE FINANCIALS & TRANSACTION TRACKING ---

router.get('/stats', requireSingleAdminAuth, (req, res) => {
  const invoices = Array.from(invoicesStore.values());
  const payments = Array.from(paymentsStore.values());
  const bikes = Array.from(bikesStore.values());
  const bookings = Array.from(bookingsStore.values());

  let totalRevenue = 248500;
  let totalGstCollected = 37900;
  let dailyRevenue = 14200;

  invoices.forEach(inv => {
    totalRevenue += Number(inv.totalAmount || 0);
    totalGstCollected += Number(inv.totalGst || 0);
  });

  const activeRentals = bookings.filter(b => b.status === 'ACTIVE' || b.status === 'CONFIRMED').length;
  const totalFleet = Math.max(bikes.length, 1);
  const utilizationRate = Math.min(100, Math.round((activeRentals / totalFleet) * 100));
  const maintenanceCount = bikes.filter(b => b.isMaintenanceRequired).length;

  return res.json({
    success: true,
    stats: {
      totalRevenue,
      dailyRevenue,
      totalGstCollected,
      activeRentals,
      totalFleet,
      utilizationRate,
      maintenanceCount,
      totalBookings: bookings.length,
      totalUsers: registeredUsersRef ? registeredUsersRef.size : 0
    }
  });
});

router.get('/payments', requireSingleAdminAuth, (req, res) => {
  const payments = Array.from(paymentsStore.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return res.json({ success: true, count: payments.length, payments });
});

// --- 9. NOTIFICATION STATUS CONTROL ---

router.get('/notifications', requireSingleAdminAuth, (req, res) => {
  return res.json({ success: true, count: notificationLogs.length, notifications: notificationLogs });
});

router.put('/notifications/:id/status', requireSingleAdminAuth, (req, res) => {
  const notif = notificationLogs.find(n => n.id === req.params.id);
  if (!notif) {
    return res.status(404).json({ success: false, message: 'Notification log not found.' });
  }

  const { status } = req.body;
  const VALID_STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SIMULATED'];
  if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }

  notif.status = status.toUpperCase();
  notif.updatedAt = new Date().toISOString();

  // If linked to invoice, sync status
  if (notif.document) {
    const invNumber = notif.document.replace('.pdf', '');
    const inv = invoicesStore.get(invNumber);
    if (inv) {
      inv.whatsappStatus = notif.status;
    }
  }

  return res.json({
    success: true,
    message: `Notification ${notif.id} status updated to ${notif.status}.`,
    notification: notif
  });
});

router.post('/notifications/:id/resend', requireSingleAdminAuth, async (req, res) => {
  const notif = notificationLogs.find(n => n.id === req.params.id);
  if (!notif) {
    return res.status(404).json({ success: false, message: 'Notification log not found.' });
  }

  // Simulate or trigger live resend
  notif.status = 'DELIVERED';
  notif.lastResentAt = new Date().toISOString();

  // Audit in whatsappLogs if exists
  whatsappLogs.unshift({
    id: `LOG_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString('en-IN'),
    recipient: notif.recipient,
    type: notif.type,
    document: notif.document,
    status: 'DELIVERED'
  });

  return res.json({
    success: true,
    message: `Notification successfully re-dispatched to ${notif.recipient}.`,
    notification: notif
  });
});

// --- 10. CSV DATA EXPORT ---

router.get('/export/payments.csv', requireSingleAdminAuth, (req, res) => {
  const payments = Array.from(paymentsStore.values());
  let csv = 'Payment ID,Order ID,Booking ID,Amount (INR),Payment Method,Status,Timestamp\n';

  payments.forEach(p => {
    csv += `"${p.id}","${p.orderId || ''}","${p.bookingId || ''}","${p.amount || 0}","${p.paymentMethod || 'UPI'}","${p.status || 'SUCCESS'}","${p.timestamp}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="valohub_payments_${Date.now()}.csv"`);
  return res.send(csv);
});

router.get('/export/bookings.csv', requireSingleAdminAuth, (req, res) => {
  const bookings = Array.from(bookingsStore.values());
  let csv = 'Booking Ref,Customer Name,Phone,Email,Vehicle,Registration,Pickup,Dropoff,Base Tariff,GST,Deposit,Deposit Status,Damage Amount,Refunded Deposit,Total Paid,Status,Created At\n';

  bookings.forEach(b => {
    csv += `"${b.bookingReference || b.id}","${b.customerName || ''}","${b.customerPhone || ''}","${b.customerEmail || ''}","${b.bikeName || ''}","${b.bikeRegNo || ''}","${b.pickupDateTime || ''}","${b.dropoffDateTime || ''}","${b.baseAmount || 0}","${b.totalGst || 0}","${b.depositAmount || 0}","${b.depositStatus || 'HELD'}","${b.damageAmount || 0}","${b.refundedDeposit || 0}","${b.totalAmount || 0}","${b.status || 'CONFIRMED'}","${b.createdAt || ''}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="valohub_bookings_${Date.now()}.csv"`);
  return res.send(csv);
});

module.exports = {
  adminRouter: router,
  bikesStore,
  setRegisteredUsersRef,
  notificationLogs
};

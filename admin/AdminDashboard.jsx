import React, { useState, useEffect, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Watchdog

export default function AdminDashboard() {
  const [authToken, setAuthToken] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('fleet');

  // Login Form States
  const [loginIdent, setLoginIdent] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Data Stores
  const [stats, setStats] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);

  // Modals
  const [isAddBikeOpen, setIsAddBikeOpen] = useState(false);
  const [isOdoOpen, setIsOdoOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  // Modal Active Entities
  const [selectedBike, setSelectedBike] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [newOdometer, setNewOdometer] = useState(0);

  // Add Bike Form State
  const [newBike, setNewBike] = useState({
    name: '',
    brand: 'Royal Enfield',
    edition: '',
    category: 'Adventure Touring',
    registrationNumber: '',
    hourlyRate: 120,
    dailyRate: 1200,
    depositAmount: 1500,
    odometerKm: 0,
    isAvailable: true,
    imageUrl: ''
  });

  // Deposit Form State
  const [depositAction, setDepositAction] = useState('REFUND_FULL');
  const [damageAmount, setDamageAmount] = useState(0);
  const [damageNotes, setDamageNotes] = useState('');

  // --- INACTIVITY WATCHDOG ---
  const handleLogout = useCallback(async () => {
    if (authToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (e) {}
    }
    sessionStorage.removeItem('valohub_admin_token');
    localStorage.removeItem('valohub_admin_token');
    setAuthToken(null);
    setAdminUser(null);
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        alert('Session terminated: 15 minutes of inactivity detected.');
        handleLogout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [authToken, handleLogout]);

  // --- INITIAL VERIFY CHECK ---
  useEffect(() => {
    const savedToken = sessionStorage.getItem('valohub_admin_token') || localStorage.getItem('valohub_admin_token');
    if (!savedToken) return;

    fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.admin) {
          setAuthToken(savedToken);
          setAdminUser(data.admin);
        } else {
          sessionStorage.removeItem('valohub_admin_token');
          localStorage.removeItem('valohub_admin_token');
        }
      })
      .catch(() => {
        sessionStorage.removeItem('valohub_admin_token');
        localStorage.removeItem('valohub_admin_token');
      });
  }, []);

  // --- DATA REFRESH ---
  const fetchDashboardData = useCallback(async () => {
    if (!authToken) return;
    const headers = { Authorization: `Bearer ${authToken}` };

    try {
      const [statsRes, bikesRes, bookingsRes, paymentsRes, notifRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/bikes', { headers }),
        fetch('/api/admin/bookings', { headers }),
        fetch('/api/admin/payments', { headers }),
        fetch('/api/admin/notifications', { headers }),
        fetch('/api/admin/users', { headers })
      ]);

      if (statsRes.status === 401) {
        handleLogout();
        return;
      }

      const statsData = await statsRes.json();
      const bikesData = await bikesRes.json();
      const bookingsData = await bookingsRes.json();
      const paymentsData = await paymentsRes.json();
      const notifData = await notifRes.json();
      const usersData = await usersRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (bikesData.success) setFleet(bikesData.bikes);
      if (bookingsData.success) setBookings(bookingsData.bookings);
      if (paymentsData.success) setPayments(paymentsData.payments);
      if (notifData.success) setNotifications(notifData.notifications);
      if (usersData.success) setUsers(usersData.users);
    } catch (e) {
      console.error('Error fetching admin data:', e);
    }
  }, [authToken, handleLogout]);

  useEffect(() => {
    if (authToken) {
      fetchDashboardData();
    }
  }, [authToken, fetchDashboardData]);

  // --- LOGIN HANDLER ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: loginIdent, password: loginPass })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unauthorized access: Only super-admin Athul is permitted.');
      }

      sessionStorage.setItem('valohub_admin_token', data.token);
      localStorage.setItem('valohub_admin_token', data.token);
      setAuthToken(data.token);
      setAdminUser(data.admin);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // --- ACTIONS ---
  const handleAddBike = async (e) => {
    e.preventDefault();
    if (!authToken) return;

    try {
      const res = await fetch('/api/admin/bikes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newBike,
          images: newBike.imageUrl ? [newBike.imageUrl] : []
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsAddBikeOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleAvailability = async (id, isAvailable) => {
    if (!authToken) return;
    try {
      await fetch(`/api/admin/bikes/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAvailable })
      });
      fetchDashboardData();
    } catch (e) {}
  };

  const handleUpdateOdometer = async (e) => {
    e.preventDefault();
    if (!authToken || !selectedBike) return;

    try {
      const res = await fetch(`/api/admin/bikes/${selectedBike.id}/odometer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ odometerKm: newOdometer })
      });
      const data = await res.json();
      if (data.success) {
        setIsOdoOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkServiced = async () => {
    if (!authToken || !selectedBike) return;
    try {
      const res = await fetch(`/api/admin/bikes/${selectedBike.id}/service`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setIsOdoOpen(false);
        fetchDashboardData();
      }
    } catch (e) {}
  };

  const handleDepositAction = async (e) => {
    e.preventDefault();
    if (!authToken || !selectedBooking) return;

    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/deposit-action`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: depositAction,
          damageAmount,
          damageNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setIsDepositOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleNotificationOverride = async (id, status) => {
    if (!authToken) return;
    try {
      await fetch(`/api/admin/notifications/${id}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      fetchDashboardData();
    } catch (e) {}
  };

  const handleResendNotification = async (id) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/admin/notifications/${id}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchDashboardData();
      }
    } catch (e) {}
  };

  const handleExportCsv = (type) => {
    if (!authToken) return;
    window.open(`/api/admin/export/${type}.csv?admin_token=${encodeURIComponent(authToken)}`, '_blank');
  };

  // --- RENDER UNAUTHENTICATED LOGIN GATE ---
  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
              Restricted Single-Admin Gate
            </span>
            <h1 className="text-2xl font-black text-white">ValoHub <span className="text-amber-400">DBMS</span></h1>
            <p className="text-sm text-slate-400 mt-1">Super-admin Athul authorization required</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Super-Admin Identity</label>
              <input
                type="text"
                value={loginIdent}
                onChange={e => setLoginIdent(e.target.value)}
                placeholder="Enter Admin ID"
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold rounded-lg hover:opacity-90 transition-opacity text-sm mt-2 disabled:opacity-50"
            >
              {isAuthenticating ? 'Authenticating...' : 'Authenticate & Enter DBMS'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER AUTHENTICATED DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black text-white tracking-tight">VALOHUB <span className="text-amber-400">DBMS</span></h1>
          <span className="px-2.5 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold rounded-full">
            PORTAL
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            Auto-Logout: 15m idle
          </span>
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-[10px]">A</span>
            <span className="font-medium text-slate-200">{adminUser?.username || 'athul'}</span>
            <span className="text-amber-400 font-bold">• SUPERADMIN</span>
          </div>

          <button
            onClick={fetchDashboardData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
          >
            Sync
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-bold rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-xs font-bold uppercase text-slate-400">Total Revenue</p>
            <h2 className="text-2xl font-black text-white mt-1">₹{Number(stats?.totalRevenue || 0).toLocaleString('en-IN')}</h2>
            <p className="text-xs text-emerald-400 mt-1 font-medium">✓ Inclusive of 18% GST + Deposits</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-xs font-bold uppercase text-slate-400">Fleet Utilization</p>
            <h2 className="text-2xl font-black text-amber-400 mt-1">{stats?.utilizationRate || 0}%</h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">{stats?.activeRentals || 0} of {stats?.totalFleet || 3} Active Rentals</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-xs font-bold uppercase text-slate-400">GST Collected (18%)</p>
            <h2 className="text-2xl font-black text-white mt-1">₹{Number(stats?.totalGstCollected || 0).toLocaleString('en-IN')}</h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">SAC 996601 (9% CGST + 9% SGST)</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-xs font-bold uppercase text-slate-400">Maintenance Alerts</p>
            <h2 className={`text-2xl font-black mt-1 ${(stats?.maintenanceCount || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {stats?.maintenanceCount || 0} Bikes
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">Threshold: ≥ 3,000 km per service</p>
          </div>
        </div>

        {/* Tab & Export Navigation Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-3">
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
            {['fleet', 'bookings', 'payments', 'notifications', 'users'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab === 'fleet' && '🏍️ Fleet Inventory'}
                {tab === 'bookings' && '📅 Bookings & Deposits'}
                {tab === 'payments' && '💳 Transactions'}
                {tab === 'notifications' && '🔔 Notifications Audit'}
                {tab === 'users' && '👥 Registered Riders'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleExportCsv('payments')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors"
            >
              📥 Export Payments (CSV)
            </button>
            <button
              onClick={() => handleExportCsv('bookings')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors"
            >
              📥 Export Bookings (CSV)
            </button>
          </div>
        </div>

        {/* TAB 1: FLEET INVENTORY */}
        {activeTab === 'fleet' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Fleet Inventory Management (Kozhikode Hub)</h3>
              <button
                onClick={() => setIsAddBikeOpen(true)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
              >
                + Add New Vehicle
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Reg #</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Tariffs</th>
                    <th className="p-4">Deposit</th>
                    <th className="p-4">Odometer</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Service Alert</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fleet.map(bike => {
                    const kmSince = bike.odometerKm - bike.lastServiceKm;
                    const needsService = bike.isMaintenanceRequired || kmSince >= bike.serviceThresholdKm;

                    return (
                      <tr key={bike.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold text-white">
                          <div>{bike.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{bike.edition || bike.brand}</div>
                        </td>
                        <td className="p-4 font-mono text-slate-300">{bike.registrationNumber}</td>
                        <td className="p-4 text-slate-400">{bike.category}</td>
                        <td className="p-4">
                          <div>₹{bike.hourlyRate}/hr</div>
                          <div className="font-bold text-white">₹{bike.dailyRate}/day</div>
                        </td>
                        <td className="p-4 font-bold text-amber-400">₹{bike.depositAmount}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{bike.odometerKm.toLocaleString()} km</div>
                          <div className="text-[10px] text-slate-400">Last: {bike.lastServiceKm.toLocaleString()} km</div>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleAvailability(bike.id, !bike.isAvailable)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                              bike.isAvailable
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {bike.isAvailable ? 'Available' : 'Unavailable'}
                          </button>
                        </td>
                        <td className="p-4">
                          {needsService ? (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[10px] font-bold">
                              ⚠️ SERVICE DUE ({kmSince} km)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                              OK ({kmSince} km)
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => {
                              setSelectedBike(bike);
                              setNewOdometer(bike.odometerKm);
                              setIsOdoOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs font-semibold"
                          >
                            Mileage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKINGS & DEPOSITS */}
        {activeTab === 'bookings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Bookings & Deposit / Damage Management</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Booking Ref</th>
                    <th className="p-4">Rider</th>
                    <th className="p-4">Vehicle</th>
                    <th className="p-4">Rental Window</th>
                    <th className="p-4">Total Paid</th>
                    <th className="p-4">Deposit Status</th>
                    <th className="p-4">Damage</th>
                    <th className="p-4">Net Refund</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {bookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-white">{b.bookingReference || b.id}</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{b.customerName}</div>
                        <div className="text-[11px] text-slate-400">+91 {String(b.customerPhone).slice(-10)}</div>
                      </td>
                      <td className="p-4 text-slate-300">{b.bikeName}</td>
                      <td className="p-4 text-[11px] text-slate-400">
                        <div>{b.pickupDateTime}</div>
                        <div>{b.dropoffDateTime}</div>
                      </td>
                      <td className="p-4 font-bold text-white">₹{Number(b.totalAmount).toLocaleString('en-IN')}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-amber-400/10 text-amber-400 border border-amber-400/30 rounded text-[10px] font-bold">
                          {b.depositStatus}
                        </span>
                      </td>
                      <td className="p-4 text-red-400 font-semibold">₹{b.damageAmount || 0}</td>
                      <td className="p-4 text-emerald-400 font-bold">₹{b.refundedDeposit || 0}</td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedBooking(b);
                            setDepositAction('REFUND_FULL');
                            setDamageAmount(0);
                            setDamageNotes('');
                            setIsDepositOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs"
                        >
                          Manage Deposit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Captured Payment Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Payment ID</th>
                    <th className="p-4">Booking Ref</th>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-300">{p.id}</td>
                      <td className="p-4 font-bold text-white">{p.bookingId}</td>
                      <td className="p-4 font-mono text-slate-400">{p.orderId}</td>
                      <td className="p-4 font-bold text-white">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-slate-400">{p.paymentMethod}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{new Date(p.timestamp).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS AUDIT */}
        {activeTab === 'notifications' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Omnichannel Notification Logs & Manual Overrides</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Log ID</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4">Recipient</th>
                    <th className="p-4">Document / Type</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Manual Override</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {notifications.map(n => (
                    <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{n.id}</td>
                      <td className="p-4 font-bold text-white">{n.channel}</td>
                      <td className="p-4 text-slate-300">{n.recipient}</td>
                      <td className="p-4 text-slate-400">{n.document || n.type}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                          {n.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={n.status}
                          onChange={e => handleNotificationOverride(n.id, e.target.value)}
                          className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                        >
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="SENT">SENT</option>
                          <option value="PENDING">PENDING</option>
                          <option value="FAILED">FAILED</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleResendNotification(n.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs font-semibold"
                        >
                          ↻ Resend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: USERS */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Registered Riders Registry</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">User ID</th>
                    <th className="p-4">Identifier / Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{u.id}</td>
                      <td className="p-4 font-bold text-white">{u.email || u.identifier || '—'}</td>
                      <td className="p-4 text-slate-300">{u.phone || '—'}</td>
                      <td className="p-4 text-slate-400">{u.role}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                          {u.isVerified || u.isDlVerified ? 'VERIFIED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('en-IN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ADD BIKE */}
      {isAddBikeOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add New Vehicle to Fleet</h3>
            <form onSubmit={handleAddBike} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Vehicle Name</label>
                <input
                  type="text"
                  value={newBike.name}
                  onChange={e => setNewBike({ ...newBike, name: e.target.value })}
                  placeholder="Royal Enfield Shotgun 650"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Brand</label>
                  <input
                    type="text"
                    value={newBike.brand}
                    onChange={e => setNewBike({ ...newBike, brand: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Registration #</label>
                  <input
                    type="text"
                    value={newBike.registrationNumber}
                    onChange={e => setNewBike({ ...newBike, registrationNumber: e.target.value })}
                    placeholder="KL-11-XX-0000"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Hourly Tariff (₹)</label>
                  <input
                    type="number"
                    value={newBike.hourlyRate}
                    onChange={e => setNewBike({ ...newBike, hourlyRate: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Daily Tariff (₹)</label>
                  <input
                    type="number"
                    value={newBike.dailyRate}
                    onChange={e => setNewBike({ ...newBike, dailyRate: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Deposit (₹)</label>
                  <input
                    type="number"
                    value={newBike.depositAmount}
                    onChange={e => setNewBike({ ...newBike, depositAmount: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Odometer (km)</label>
                  <input
                    type="number"
                    value={newBike.odometerKm}
                    onChange={e => setNewBike({ ...newBike, odometerKm: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Image URL</label>
                <input
                  type="url"
                  value={newBike.imageUrl}
                  onChange={e => setNewBike({ ...newBike, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBikeOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold"
                >
                  Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ODOMETER & SERVICE */}
      {isOdoOpen && selectedBike && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">{selectedBike.name}</h3>
            <p className="text-xs text-slate-400 mb-4">
              Current: {selectedBike.odometerKm} km | Last Service: {selectedBike.lastServiceKm} km
            </p>

            <form onSubmit={handleUpdateOdometer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">New Odometer Reading (km)</label>
                <input
                  type="number"
                  value={newOdometer}
                  onChange={e => setNewOdometer(Number(e.target.value))}
                  min={selectedBike.odometerKm}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleMarkServiced}
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold"
                >
                  Mark Serviced
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOdoOpen(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-amber-400 text-slate-950 font-bold rounded text-xs"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DEPOSIT & DAMAGE */}
      {isDepositOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Manage Deposit & Damage</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedBooking.customerName} ({selectedBooking.bookingReference})</p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Security Deposit Held:</span>
                <span className="font-bold text-amber-400">₹{selectedBooking.depositAmount}</span>
              </div>
            </div>

            <form onSubmit={handleDepositAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Action</label>
                <select
                  value={depositAction}
                  onChange={e => setDepositAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                >
                  <option value="REFUND_FULL">Full Refund (No Damage)</option>
                  <option value="DEDUCT_DAMAGE">Deduct Damage & Refund Balance</option>
                </select>
              </div>

              {depositAction === 'DEDUCT_DAMAGE' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Damage Amount (₹)</label>
                    <input
                      type="number"
                      value={damageAmount}
                      onChange={e => setDamageAmount(Number(e.target.value))}
                      max={selectedBooking.depositAmount}
                      min={0}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notes</label>
                    <textarea
                      value={damageNotes}
                      onChange={e => setDamageNotes(e.target.value)}
                      placeholder="e.g. Broken mirror, scratch on tank..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      rows={2}
                    />
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    Net Refund: ₹{Math.max(0, selectedBooking.depositAmount - damageAmount)}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDepositOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-400 text-slate-950 font-bold rounded text-xs"
                >
                  Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

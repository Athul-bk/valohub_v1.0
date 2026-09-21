import React, { useState, useEffect, useCallback, useRef, FormEvent } from 'react';

// --- TYPESCRIPT INTERFACES ---
export interface Vehicle {
  id: string;
  name: string;
  brand: string;
  edition?: string;
  category: string;
  engineCapacity?: string;
  registrationNumber: string;
  hourlyRate: number;
  dailyRate: number;
  depositAmount: number;
  isAvailable: boolean;
  odometerKm: number;
  lastServiceKm: number;
  serviceThresholdKm: number;
  isMaintenanceRequired: boolean;
  images: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Booking {
  id: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  bikeId: string;
  bikeName: string;
  bikeEdition?: string;
  bikeRegNo?: string;
  bikeImage?: string;
  pickupDateTime: string;
  dropoffDateTime: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  baseAmount: number;
  cgst?: number;
  sgst?: number;
  totalGst: number;
  depositAmount: number;
  depositStatus: 'HELD' | 'REFUNDED' | 'DEDUCTED' | 'DEDUCTED_FULL';
  damageAmount: number;
  refundedDeposit: number;
  damageNotes?: string;
  totalAmount: number;
  status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  dlAiStatus?: 'ADMIN_APPROVED' | 'RE-UPLOAD_REQUESTED' | 'REJECTED' | 'PENDING' | string;
  adminDlNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentTransaction {
  id: string;
  bookingId: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  status: string;
  timestamp: string;
}

export interface NotificationLog {
  id: string;
  recipient: string;
  channel: 'WHATSAPP' | 'EMAIL';
  type: string;
  document: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SIMULATED';
  bookingId?: string;
  timestamp: string;
  lastResentAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  identifier?: string;
  email?: string;
  phone?: string;
  name?: string;
  role: string;
  drivingLicense?: string;
  isVerified: boolean;
  isDlVerified?: boolean;
  registeredAt: string;
  updatedAt?: string;
}

export interface AdminStats {
  totalRevenue: number;
  dailyRevenue?: number;
  totalGstCollected: number;
  activeRentals: number;
  totalFleet: number;
  utilizationRate: number;
  maintenanceCount: number;
  totalBookings: number;
  totalUsers?: number;
  invoicesGenerated?: number;
  whatsappDelivered?: number;
}

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes Inactivity Watchdog
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;  // 3 Minutes Keep-Alive Ping on Activity

const INITIAL_BIKE_STATE = {
  name: '',
  brand: 'Royal Enfield',
  edition: '',
  category: 'Adventure Touring',
  engineCapacity: '450cc',
  registrationNumber: '',
  hourlyRate: 120,
  dailyRate: 1200,
  depositAmount: 1500,
  odometerKm: 0,
  isAvailable: true,
  imageUrl: ''
};

const INITIAL_USER_STATE = {
  name: '',
  email: '',
  phone: '',
  role: 'USER',
  drivingLicense: ''
};

export default function AdminDashboard() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{ username: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'fleet' | 'bookings' | 'payments' | 'notifications' | 'users'>('fleet');
  const [searchQuery, setSearchQuery] = useState('');

  // Login Form States
  const [loginIdent, setLoginIdent] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Data Stores
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Modals
  const [isAddBikeOpen, setIsAddBikeOpen] = useState(false);
  const [isEditBikeOpen, setIsEditBikeOpen] = useState(false);
  const [isOdoOpen, setIsOdoOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isDlModalOpen, setIsDlModalOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Modal Active Entities
  const [selectedBike, setSelectedBike] = useState<Vehicle | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newOdometer, setNewOdometer] = useState<number>(0);

  // Add & Edit Bike Form State
  const [newBike, setNewBike] = useState(INITIAL_BIKE_STATE);
  const [editingBike, setEditingBike] = useState<Vehicle | null>(null);

  // Add User Form State
  const [newUser, setNewUser] = useState(INITIAL_USER_STATE);

  // Deposit Form State
  const [depositAction, setDepositAction] = useState<'REFUND_FULL' | 'DEDUCT_DAMAGE'>('REFUND_FULL');
  const [damageAmount, setDamageAmount] = useState<number>(0);
  const [damageNotes, setDamageNotes] = useState<string>('');

  // DL Verification Form State
  const [dlStatus, setDlStatus] = useState<'ADMIN_APPROVED' | 'RE-UPLOAD_REQUESTED' | 'REJECTED'>('ADMIN_APPROVED');
  const [dlNotes, setDlNotes] = useState('');

  // Ref to track last heartbeat ping
  const lastHeartbeatRef = useRef<number>(Date.now());

  // --- LOGOUT HANDLER ---
  const handleLogout = useCallback(async () => {
    if (authToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (e) {
        console.warn('Logout network error:', e);
      }
    }
    sessionStorage.removeItem('valohub_admin_token');
    localStorage.removeItem('valohub_admin_token');
    setAuthToken(null);
    setAdminUser(null);
  }, [authToken]);

  // --- CENTRALIZED API FETCH HELPER ---
  const adminFetch = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      if (!authToken) throw new Error('Not authenticated');

      const headers: Record<string, string> = {
        Authorization: `Bearer ${authToken}`,
        ...(options.headers as Record<string, string> || {})
      };

      if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(endpoint, { ...options, headers });

      if (res.status === 401) {
        handleLogout();
        throw new Error('Session expired or unauthorized. Please log in again.');
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
        return { success: true };
      }

      const data = await res.json();
      if (!res.ok && !data.success) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
      }

      return data;
    },
    [authToken, handleLogout]
  );

  // --- INACTIVITY & HEARTBEAT WATCHDOG ---
  useEffect(() => {
    if (!authToken) return;

    let timer: ReturnType<typeof setTimeout>;

    const handleActivity = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        alert('Session terminated: 15 minutes of inactivity detected.');
        handleLogout();
      }, INACTIVITY_TIMEOUT_MS);

      // Throttled heartbeat to keep server session active while user interacts
      const now = Date.now();
      if (now - lastHeartbeatRef.current > HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatRef.current = now;
        fetch('/api/admin/verify', {
          headers: { Authorization: `Bearer ${authToken}` }
        }).catch(() => {});
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    handleActivity();

    return () => {
      clearTimeout(timer);
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [authToken, handleLogout]);

  // --- INITIAL TOKEN VERIFY CHECK ---
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

  // --- DASHBOARD DATA REFRESH ---
  const fetchDashboardData = useCallback(async () => {
    if (!authToken) return;
    setIsLoadingData(true);

    try {
      const [statsData, bikesData, bookingsData, paymentsData, notifData, usersData] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/bikes'),
        adminFetch('/api/admin/bookings'),
        adminFetch('/api/admin/payments'),
        adminFetch('/api/admin/notifications'),
        adminFetch('/api/admin/users')
      ]);

      if (statsData?.success) setStats(statsData.stats);
      if (bikesData?.success) setFleet(bikesData.bikes || []);
      if (bookingsData?.success) setBookings(bookingsData.bookings || []);
      if (paymentsData?.success) setPayments(paymentsData.payments || []);
      if (notifData?.success) setNotifications(notifData.notifications || []);
      if (usersData?.success) setUsers(usersData.users || []);
    } catch (e: any) {
      console.error('Error fetching admin data:', e);
    } finally {
      setIsLoadingData(false);
    }
  }, [authToken, adminFetch]);

  useEffect(() => {
    if (authToken) {
      fetchDashboardData();
    }
  }, [authToken, fetchDashboardData]);

  // --- LOGIN HANDLER ---
  const handleLogin = async (e: FormEvent) => {
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
    } catch (err: any) {
      setLoginError(err.message || 'Failed to authenticate');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // --- FLEET ACTIONS ---
  const handleAddBike = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const data = await adminFetch('/api/admin/bikes', {
        method: 'POST',
        body: JSON.stringify({
          ...newBike,
          images: newBike.imageUrl ? [newBike.imageUrl] : []
        })
      });

      if (data.success) {
        setIsAddBikeOpen(false);
        setNewBike(INITIAL_BIKE_STATE);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to add bike');
      }
    } catch (err: any) {
      alert(err.message || 'Error adding bike');
    }
  };

  const handleEditBikeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBike) return;

    try {
      const data = await adminFetch(`/api/admin/bikes/${editingBike.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingBike.name,
          brand: editingBike.brand,
          edition: editingBike.edition,
          category: editingBike.category,
          engineCapacity: editingBike.engineCapacity,
          registrationNumber: editingBike.registrationNumber,
          hourlyRate: Number(editingBike.hourlyRate),
          dailyRate: Number(editingBike.dailyRate),
          depositAmount: Number(editingBike.depositAmount),
          isAvailable: editingBike.isAvailable,
          images: editingBike.images
        })
      });

      if (data.success) {
        setIsEditBikeOpen(false);
        setEditingBike(null);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to update vehicle');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating vehicle');
    }
  };

  const handleDeleteBike = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}" from the fleet?`)) return;

    try {
      const data = await adminFetch(`/api/admin/bikes/${id}`, {
        method: 'DELETE'
      });
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to delete vehicle');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting vehicle');
    }
  };

  const handleToggleAvailability = async (id: string, isAvailable: boolean) => {
    try {
      const data = await adminFetch(`/api/admin/bikes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable })
      });
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to toggle availability');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating availability');
    }
  };

  const handleUpdateOdometer = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBike) return;

    if (newOdometer < selectedBike.odometerKm) {
      alert(`New odometer reading (${newOdometer} km) cannot be lower than current reading (${selectedBike.odometerKm} km).`);
      return;
    }

    try {
      const data = await adminFetch(`/api/admin/bikes/${selectedBike.id}/odometer`, {
        method: 'POST',
        body: JSON.stringify({ odometerKm: newOdometer })
      });
      if (data.success) {
        setIsOdoOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to update odometer');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating odometer');
    }
  };

  const handleMarkServiced = async () => {
    if (!selectedBike) return;
    try {
      const data = await adminFetch(`/api/admin/bikes/${selectedBike.id}/service`, {
        method: 'POST'
      });
      if (data.success) {
        alert(data.message || 'Vehicle marked as serviced.');
        setIsOdoOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to record service');
      }
    } catch (err: any) {
      alert(err.message || 'Error marking vehicle as serviced');
    }
  };

  // --- BOOKING & DEPOSIT ACTIONS ---
  const handleDepositAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    if (depositAction === 'DEDUCT_DAMAGE') {
      if (damageAmount < 0 || damageAmount > selectedBooking.depositAmount) {
        alert(`Damage deduction must be between ₹0 and the deposit amount of ₹${selectedBooking.depositAmount}.`);
        return;
      }
    }

    try {
      const data = await adminFetch(`/api/admin/bookings/${selectedBooking.id}/deposit-action`, {
        method: 'POST',
        body: JSON.stringify({
          action: depositAction,
          damageAmount: depositAction === 'DEDUCT_DAMAGE' ? damageAmount : 0,
          damageNotes: depositAction === 'DEDUCT_DAMAGE' ? damageNotes : ''
        })
      });
      if (data.success) {
        alert(data.message || 'Deposit action processed successfully.');
        setIsDepositOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to process deposit action');
      }
    } catch (err: any) {
      alert(err.message || 'Error processing deposit action');
    }
  };

  const handleVerifyDlSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    try {
      const data = await adminFetch(`/api/admin/bookings/${selectedBooking.id}/verify-dl`, {
        method: 'POST',
        body: JSON.stringify({
          status: dlStatus,
          notes: dlNotes
        })
      });
      if (data.success) {
        alert(data.message || `DL status updated to ${dlStatus}`);
        setIsDlModalOpen(false);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to update DL status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating DL verification');
    }
  };

  const handleUpdateBookingStatus = async (id: string, status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    try {
      const data = await adminFetch(`/api/admin/bookings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to update booking status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating booking status');
    }
  };

  const handleDeleteBooking = async (id: string, ref: string) => {
    if (!window.confirm(`Are you sure you want to cancel and remove booking ${ref}?`)) return;

    try {
      const data = await adminFetch(`/api/admin/bookings/${id}`, {
        method: 'DELETE'
      });
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to delete booking');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting booking');
    }
  };

  // --- NOTIFICATION ACTIONS ---
  const handleNotificationOverride = async (id: string, status: string) => {
    try {
      const data = await adminFetch(`/api/admin/notifications/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to update notification status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating notification status');
    }
  };

  const handleResendNotification = async (id: string) => {
    try {
      const data = await adminFetch(`/api/admin/notifications/${id}/resend`, {
        method: 'POST'
      });
      if (data.success) {
        alert(data.message || 'Notification resent successfully.');
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to resend notification');
      }
    } catch (err: any) {
      alert(err.message || 'Error resending notification');
    }
  };

  // --- USER ACTIONS ---
  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const data = await adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      if (data.success) {
        setIsAddUserOpen(false);
        setNewUser(INITIAL_USER_STATE);
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to add user');
      }
    } catch (err: any) {
      alert(err.message || 'Error adding user');
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove rider "${name}"?`)) return;

    try {
      const data = await adminFetch(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
      if (data.success) {
        fetchDashboardData();
      } else {
        alert(data.message || 'Failed to delete user');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting user');
    }
  };

  // --- CSV EXPORT ---
  const handleExportCsv = (type: 'payments' | 'bookings') => {
    if (!authToken) return;
    const url = `/api/admin/export/${type}.csv?admin_token=${encodeURIComponent(authToken)}`;
    window.open(url, '_blank');
  };

  // --- FILTERED DATA SETS ---
  const q = searchQuery.toLowerCase().trim();

  const filteredFleet = fleet.filter(b =>
    !q ||
    b.name.toLowerCase().includes(q) ||
    b.registrationNumber.toLowerCase().includes(q) ||
    b.category.toLowerCase().includes(q) ||
    b.brand.toLowerCase().includes(q)
  );

  const filteredBookings = bookings.filter(b =>
    !q ||
    b.bookingReference.toLowerCase().includes(q) ||
    b.customerName.toLowerCase().includes(q) ||
    (b.customerPhone && b.customerPhone.includes(q)) ||
    b.bikeName.toLowerCase().includes(q) ||
    b.status.toLowerCase().includes(q)
  );

  const filteredPayments = payments.filter(p =>
    !q ||
    p.id.toLowerCase().includes(q) ||
    p.bookingId.toLowerCase().includes(q) ||
    p.orderId.toLowerCase().includes(q) ||
    p.paymentMethod.toLowerCase().includes(q) ||
    p.status.toLowerCase().includes(q)
  );

  const filteredNotifications = notifications.filter(n =>
    !q ||
    n.id.toLowerCase().includes(q) ||
    n.recipient.toLowerCase().includes(q) ||
    n.channel.toLowerCase().includes(q) ||
    n.document.toLowerCase().includes(q) ||
    n.status.toLowerCase().includes(q)
  );

  const filteredUsers = users.filter(u =>
    !q ||
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.phone && u.phone.includes(q)) ||
    u.role.toLowerCase().includes(q)
  );

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
                placeholder="Enter Admin ID or Email"
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
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black text-white tracking-tight">VALOHUB <span className="text-amber-400">DBMS</span></h1>
          <span className="px-2.5 py-0.5 bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold rounded-full">
            PORTAL
          </span>
          {isLoadingData && (
            <span className="text-xs text-amber-400 animate-pulse font-medium">Syncing...</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 hidden sm:inline-block">
            Auto-Logout: 15m idle
          </span>
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-xs">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-[10px]">A</span>
            <span className="font-medium text-slate-200">{adminUser?.username || 'athul'}</span>
            <span className="text-amber-400 font-bold">• SUPERADMIN</span>
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={isLoadingData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            ↻ Sync
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
            <p className="text-xs text-slate-400 mt-1 font-medium">{stats?.activeRentals || 0} of {stats?.totalFleet || 1} Active Rentals</p>
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

        {/* Tab & Search Navigation Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
            {(['fleet', 'bookings', 'payments', 'notifications', 'users'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab === 'fleet' && `🏍️ Fleet (${fleet.length})`}
                {tab === 'bookings' && `📅 Bookings (${bookings.length})`}
                {tab === 'payments' && `💳 Payments (${payments.length})`}
                {tab === 'notifications' && `🔔 Notifications (${notifications.length})`}
                {tab === 'users' && `👥 Users (${users.length})`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-full sm:w-48"
            />
            <button
              onClick={() => handleExportCsv('payments')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors whitespace-nowrap"
            >
              📥 Payments CSV
            </button>
            <button
              onClick={() => handleExportCsv('bookings')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors whitespace-nowrap"
            >
              📥 Bookings CSV
            </button>
          </div>
        </div>

        {/* TAB 1: FLEET INVENTORY */}
        {activeTab === 'fleet' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Fleet Inventory Management (Kozhikode Hub)</h3>
                <p className="text-xs text-slate-400">Total: {fleet.length} vehicles | Filtered: {filteredFleet.length}</p>
              </div>
              <button
                onClick={() => {
                  setNewBike(INITIAL_BIKE_STATE);
                  setIsAddBikeOpen(true);
                }}
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
                    <th className="p-4">Category / Engine</th>
                    <th className="p-4">Tariffs</th>
                    <th className="p-4">Deposit</th>
                    <th className="p-4">Odometer</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Service Alert</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredFleet.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No vehicles found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFleet.map(bike => {
                      const kmSince = bike.odometerKm - (bike.lastServiceKm || 0);
                      const needsService = bike.isMaintenanceRequired || kmSince >= (bike.serviceThresholdKm || 3000);

                      return (
                        <tr key={bike.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-white">
                            <div>{bike.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{bike.edition || bike.brand}</div>
                          </td>
                          <td className="p-4 font-mono text-slate-300">{bike.registrationNumber}</td>
                          <td className="p-4 text-slate-400">
                            <div>{bike.category}</div>
                            <div className="text-[10px] text-slate-500">{bike.engineCapacity || '—'}</div>
                          </td>
                          <td className="p-4">
                            <div>₹{bike.hourlyRate}/hr</div>
                            <div className="font-bold text-white">₹{bike.dailyRate}/day</div>
                          </td>
                          <td className="p-4 font-bold text-amber-400">₹{bike.depositAmount}</td>
                          <td className="p-4">
                            <div className="font-bold text-white">{bike.odometerKm.toLocaleString()} km</div>
                            <div className="text-[10px] text-slate-400">Last: {(bike.lastServiceKm || 0).toLocaleString()} km</div>
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
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[10px] font-bold whitespace-nowrap">
                                ⚠️ DUE ({kmSince} km)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold whitespace-nowrap">
                                OK ({kmSince} km)
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedBike(bike);
                                  setNewOdometer(bike.odometerKm);
                                  setIsOdoOpen(true);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs font-semibold"
                                title="Update Odometer / Service"
                              >
                                Mileage
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBike({ ...bike });
                                  setIsEditBikeOpen(true);
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs font-semibold"
                                title="Edit Vehicle Details"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteBike(bike.id, bike.name)}
                                className="px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded border border-red-500/30 text-xs font-semibold"
                                title="Remove Vehicle"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKINGS & DEPOSITS */}
        {activeTab === 'bookings' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white">Bookings, DL Verification & Security Deposits</h3>
                <p className="text-xs text-slate-400">Total: {bookings.length} | Filtered: {filteredBookings.length}</p>
              </div>
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
                    <th className="p-4">DL Status</th>
                    <th className="p-4">Booking Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No bookings found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map(b => (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-white">{b.bookingReference || b.id}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{b.customerName}</div>
                          <div className="text-[11px] text-slate-400">
                            {b.customerPhone ? `+91 ${String(b.customerPhone).replace(/\D/g, '').slice(-10)}` : '—'}
                          </div>
                        </td>
                        <td className="p-4 text-slate-300">
                          <div>{b.bikeName}</div>
                          <div className="text-[10px] text-slate-500">{b.bikeRegNo || '—'}</div>
                        </td>
                        <td className="p-4 text-[11px] text-slate-400">
                          <div>{b.pickupDateTime}</div>
                          <div>{b.dropoffDateTime}</div>
                        </td>
                        <td className="p-4 font-bold text-white">₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              b.depositStatus === 'REFUNDED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : b.depositStatus === 'DEDUCTED' || b.depositStatus === 'DEDUCTED_FULL'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                            }`}
                          >
                            {b.depositStatus}
                          </span>
                          {b.damageAmount > 0 && (
                            <div className="text-[10px] text-red-400 mt-0.5">-₹{b.damageAmount} dmg</div>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              b.dlAiStatus === 'ADMIN_APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : b.dlAiStatus === 'REJECTED'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                            }`}
                          >
                            {b.dlAiStatus || 'PENDING'}
                          </span>
                        </td>
                        <td className="p-4">
                          <select
                            value={b.status}
                            onChange={e => handleUpdateBookingStatus(b.id, e.target.value as any)}
                            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                          >
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedBooking(b);
                                setDepositAction('REFUND_FULL');
                                setDamageAmount(0);
                                setDamageNotes(b.damageNotes || '');
                                setIsDepositOpen(true);
                              }}
                              className="px-2 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs"
                              title="Process Deposit / Damage"
                            >
                              Deposit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedBooking(b);
                                setDlStatus((b.dlAiStatus as any) || 'ADMIN_APPROVED');
                                setDlNotes(b.adminDlNotes || '');
                                setIsDlModalOpen(true);
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs font-semibold"
                              title="Inspect DL Photo"
                            >
                              DL
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(b.id, b.bookingReference)}
                              className="px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded border border-red-500/30 text-xs font-semibold"
                              title="Delete Booking"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
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
              <p className="text-xs text-slate-400">Total: {payments.length} | Filtered: {filteredPayments.length}</p>
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
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No transactions found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map(p => {
                      const dateStr = p.timestamp && !isNaN(new Date(p.timestamp).getTime())
                        ? new Date(p.timestamp).toLocaleString('en-IN')
                        : '—';

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-mono text-slate-300">{p.id}</td>
                          <td className="p-4 font-bold text-white">{p.bookingId}</td>
                          <td className="p-4 font-mono text-slate-400">{p.orderId || '—'}</td>
                          <td className="p-4 font-bold text-white">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-slate-400">{p.paymentMethod || 'UPI'}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{dateStr}</td>
                        </tr>
                      );
                    })
                  )}
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
              <p className="text-xs text-slate-400">Total: {notifications.length} | Filtered: {filteredNotifications.length}</p>
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
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No notification logs found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map(n => (
                      <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono text-slate-400">{n.id}</td>
                        <td className="p-4 font-bold text-white">{n.channel}</td>
                        <td className="p-4 text-slate-300">{n.recipient}</td>
                        <td className="p-4 text-slate-400">{n.document || n.type}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              n.status === 'DELIVERED'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : n.status === 'FAILED'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                            }`}
                          >
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
                            <option value="SIMULATED">SIMULATED</option>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: USERS */}
        {activeTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white">Registered Riders Registry</h3>
                <p className="text-xs text-slate-400">Total: {users.length} | Filtered: {filteredUsers.length}</p>
              </div>
              <button
                onClick={() => {
                  setNewUser(INITIAL_USER_STATE);
                  setIsAddUserOpen(true);
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-colors"
              >
                + Register New Rider
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">User ID</th>
                    <th className="p-4">Name / Identifier</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Verification</th>
                    <th className="p-4">Registered</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No registered riders found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const regDate = u.registeredAt && !isNaN(new Date(u.registeredAt).getTime())
                        ? new Date(u.registeredAt).toLocaleDateString('en-IN')
                        : '—';

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-mono text-slate-400">{u.id}</td>
                          <td className="p-4 font-bold text-white">
                            <div>{u.name || 'Unnamed Rider'}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{u.email || u.identifier || '—'}</div>
                          </td>
                          <td className="p-4 text-slate-300">{u.phone || '—'}</td>
                          <td className="p-4 text-slate-400">{u.role || 'USER'}</td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                u.isVerified || u.isDlVerified
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                              }`}
                            >
                              {u.isVerified || u.isDlVerified ? 'VERIFIED' : 'PENDING'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{regDate}</td>
                          <td className="p-4">
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name || u.email || 'Rider')}
                              className="px-2.5 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded text-xs font-semibold"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
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
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category</label>
                  <select
                    value={newBike.category}
                    onChange={e => setNewBike({ ...newBike, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  >
                    <option value="Adventure Touring">Adventure Touring</option>
                    <option value="Modern Classic Cruiser">Modern Classic Cruiser</option>
                    <option value="Street Fighter / Performance">Street Fighter / Performance</option>
                    <option value="Boutique Rental">Boutique Rental</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Engine Capacity</label>
                  <input
                    type="text"
                    value={newBike.engineCapacity}
                    onChange={e => setNewBike({ ...newBike, engineCapacity: e.target.value })}
                    placeholder="450cc"
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
                    min={0}
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
                    min={0}
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
                    min={0}
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
                    min={0}
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

      {/* MODAL 1B: EDIT BIKE */}
      {isEditBikeOpen && editingBike && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Edit Vehicle — {editingBike.name}</h3>
            <form onSubmit={handleEditBikeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Vehicle Name</label>
                <input
                  type="text"
                  value={editingBike.name}
                  onChange={e => setEditingBike({ ...editingBike, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Brand</label>
                  <input
                    type="text"
                    value={editingBike.brand}
                    onChange={e => setEditingBike({ ...editingBike, brand: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Registration #</label>
                  <input
                    type="text"
                    value={editingBike.registrationNumber}
                    onChange={e => setEditingBike({ ...editingBike, registrationNumber: e.target.value })}
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
                    value={editingBike.hourlyRate}
                    onChange={e => setEditingBike({ ...editingBike, hourlyRate: Number(e.target.value) })}
                    required
                    min={0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Daily Tariff (₹)</label>
                  <input
                    type="number"
                    value={editingBike.dailyRate}
                    onChange={e => setEditingBike({ ...editingBike, dailyRate: Number(e.target.value) })}
                    required
                    min={0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Deposit Amount (₹)</label>
                  <input
                    type="number"
                    value={editingBike.depositAmount}
                    onChange={e => setEditingBike({ ...editingBike, depositAmount: Number(e.target.value) })}
                    required
                    min={0}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Availability</label>
                  <select
                    value={editingBike.isAvailable ? 'true' : 'false'}
                    onChange={e => setEditingBike({ ...editingBike, isAvailable: e.target.value === 'true' })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  >
                    <option value="true">Available for Rent</option>
                    <option value="false">Unavailable / Grounded</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditBikeOpen(false);
                    setEditingBike(null);
                  }}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold"
                >
                  Save Changes
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
              Current: {selectedBike.odometerKm} km | Last Service: {selectedBike.lastServiceKm || 0} km | Threshold: {selectedBike.serviceThresholdKm || 3000} km
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
                  ✓ Mark Serviced
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
                    Save Mileage
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

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Security Deposit Held:</span>
                <span className="font-bold text-amber-400">₹{selectedBooking.depositAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Deposit Status:</span>
                <span className="font-semibold text-white">{selectedBooking.depositStatus}</span>
              </div>
            </div>

            <form onSubmit={handleDepositAction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Action</label>
                <select
                  value={depositAction}
                  onChange={e => setDepositAction(e.target.value as any)}
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
                  Process Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DL VERIFICATION */}
      {isDlModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Verify Driving License</h3>
            <p className="text-xs text-slate-400 mb-4">{selectedBooking.customerName} ({selectedBooking.bookingReference})</p>

            <form onSubmit={handleVerifyDlSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Verification Decision</label>
                <select
                  value={dlStatus}
                  onChange={e => setDlStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                >
                  <option value="ADMIN_APPROVED">Approve (Verified Valid DL)</option>
                  <option value="RE-UPLOAD_REQUESTED">Request Re-Upload (Blurry / Incomplete)</option>
                  <option value="REJECTED">Reject (Invalid / Expired / Forged)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Admin Notes</label>
                <textarea
                  value={dlNotes}
                  onChange={e => setDlNotes(e.target.value)}
                  placeholder="e.g. DL photo clearly displays validity until 2030."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDlModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-400 text-slate-950 font-bold rounded text-xs"
                >
                  Save Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REGISTER NEW RIDER */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Register New Rider</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Rider Name"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="rider@example.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="9847012345"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                >
                  <option value="USER">Standard Rider (USER)</option>
                  <option value="VIP">VIP Rider (VIP)</option>
                  <option value="ADMIN">Administrator (ADMIN)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-400 text-slate-950 font-bold rounded text-xs"
                >
                  Register Rider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import {
  Package,
  Search,
  LogIn,
  UserPlus,
  LogOut,
  MapPin,
  Clock,
  User,
  LayoutDashboard,
  Truck,
  MessageSquare,
  FileText,
  Users,
  ShieldAlert,
  Calendar,
  DollarSign,
  TrendingUp,
  X,
  Bell,
  ArrowRight,
  Calculator,
  Compass,
  CheckCircle2,
  Phone
} from "lucide-react";

import { Parcel, TrackingHistory } from "./types";
import TrackingTimeline from "./components/TrackingTimeline";
import ShipForm from "./components/ShipForm";
import ChatComponent from "./components/ChatComponent";
import AdminUsers from "./components/AdminUsers";
import AdminParcels from "./components/AdminParcels";
import AdminChat from "./components/AdminChat";
import AdminReports from "./components/AdminReports";

// Simple state definitions for views
type ActiveTab = "landing" | "login" | "register" | "dashboard" | "ship" | "chat" | "profile" | "admin-login" | "admin-dashboard" | "admin-users" | "admin-parcels" | "admin-chat" | "admin-reports";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");

  // Auth States
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("fedex_token"));
  const [userRole, setUserRole] = useState<"user" | "admin" | null>(() => localStorage.getItem("fedex_role") as any);
  const [userProfile, setUserProfile] = useState<any>(() => {
    try {
      const u = localStorage.getItem("fedex_profile");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  // Client states
  const [myParcels, setMyParcels] = useState<Parcel[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);

  // Forms
  const [trackingInput, setTrackingInput] = useState("");
  const [trackedResult, setTrackedResult] = useState<{ parcel: Parcel; timeline: TrackingHistory[] } | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Authentication Fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Registration Fields
  const [regFullname, setRegFullname] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // Admin Statistics Workspace
  const [adminStats, setAdminStats] = useState<any>(null);

  // Real-time toast notifications list
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([]);

  // Socket instance client
  const socketRef = useRef<any>(null);

  // Push notifications helper
  const addToast = (message: string, type: string = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    if (token && userProfile) {
      if (userRole === "admin") {
        fetchAdminStats();
      } else {
        fetchMyParcels();
        fetchMyProfile();
      }

      // Hook up real-time listener
      const socket = io({
        transports: ["websocket", "polling"]
      });
      socketRef.current = socket;

      // Join client channels
      socket.emit("join", { userId: userProfile.id, role: userRole });

      // Live Checkpoints scans alerts broadcasted
      socket.on("notification", (data: { type: string; trackingNumber: string; message: string }) => {
        addToast(data.message, "notification");
        if (userRole === "user") {
          fetchMyParcels();
        }
      });

      socket.on("admin-notification", (data: { type: string; message: string }) => {
        if (userRole === "admin") {
          addToast(data.message, "success");
          fetchAdminStats();
        }
      });

      return () => {
        socket.off("notification");
        socket.off("admin-notification");
        socket.disconnect();
      };
    }
  }, [token, userRole]);

  // Sync to correct starting page
  useEffect(() => {
    if (token && userRole) {
      if (userRole === "admin") {
        setActiveTab("admin-dashboard");
      } else {
        setActiveTab("dashboard");
      }
    } else {
      setActiveTab("landing");
    }
  }, []);

  // --- API OPERATIONS ---

  const fetchMyParcels = async () => {
    try {
      const resp = await fetch("/api/user/parcels", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setMyParcels(data);
      }
    } catch {
      console.error("Parcels fetch issue.");
    }
  };

  const fetchMyProfile = async () => {
    try {
      const resp = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setMyProfile(data);
      }
    } catch {
      console.error("Profile fetch issue.");
    }
  };

  const fetchAdminStats = async () => {
    try {
      const resp = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setAdminStats(data);
      }
    } catch {
      console.error("Stats fetching error.");
    }
  };

  const handleTrackPackage = async (code: string) => {
    if (!code?.trim()) return;
    setTrackingLoading(true);
    setTrackingError("");
    setTrackedResult(null);
    try {
      const resp = await fetch(`/api/track/${code.trim().toUpperCase()}`);
      if (resp.ok) {
        const data = await resp.json();
        setTrackedResult(data);
      } else {
        setTrackingError("Tracking code not found. Please review and try again.");
      }
    } catch {
      setTrackingError("Server connection issue. Try later.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent, directRole: "user" | "admin" = "user") => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const endpoint = directRole === "admin" ? "/api/admin/login" : "/api/login";
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const body = await resp.json();
      if (!resp.ok) {
        setAuthError(body.error || "Authentication failed. Check your credential details.");
        return;
      }

      // Store in storage
      localStorage.setItem("fedex_token", body.token);
      localStorage.setItem("fedex_role", body.role);
      localStorage.setItem("fedex_profile", JSON.stringify(body.user));

      setToken(body.token);
      setUserRole(body.role);
      setUserProfile(body.user);

      addToast(`Welcome back, ${body.user.fullname}!`, "success");

      // Reset Form fields
      setLoginEmail("");
      setLoginPassword("");

      if (body.role === "admin") {
        setActiveTab("admin-dashboard");
      } else {
        setActiveTab("dashboard");
      }
    } catch {
      setAuthError("Server unavailable.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    setRegSuccess("");
    try {
      const resp = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullname: regFullname,
          email: regEmail,
          password: regPassword,
          phone: regPhone,
          company: regCompany
        })
      });

      const body = await resp.json();
      if (!resp.ok) {
        setAuthError(body.error || "Failed to submit registration.");
        return;
      }

      setRegSuccess("Sign-up request sent successfully! Note: Normal user access requires Admin verification. We seeded the OTP key details in your Dev logs.");
      addToast("Sign-up registered!", "success");

      // Clear register inputs
      setRegFullname("");
      setRegEmail("");
      setRegPassword("");
      setRegPhone("");
      setRegCompany("");
    } catch {
      setAuthError("Registration endpoint connection error.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogOut = () => {
    localStorage.removeItem("fedex_token");
    localStorage.removeItem("fedex_role");
    localStorage.removeItem("fedex_profile");

    setToken(null);
    setUserRole(null);
    setUserProfile(null);
    setTrackedResult(null);

    addToast("Logged out successfully.", "info");
    setActiveTab("landing");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative antialiased" id="fedex-app-shell">
      {/* Toast Notification Deck */}
      <div className="fixed top-4 right-4 z-50 pointer-events-none space-y-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-semibold flex justify-between items-center gap-2 animate-in slide-in-from-top-4 duration-300 ${
              t.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : t.type === "notification"
                ? "bg-[#660099] text-white border-purple-500"
                : "bg-slate-900 text-white border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-400 shrink-0" />
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((p) => p.id !== t.id))}
              className="text-white/70 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Primary Top Header Navigation Brand */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm" id="main-header">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex justify-between items-center">
          {/* Logo Brand: Purple Fed & Orange Ex */}
          <button
            onClick={() => setActiveTab(token ? (userRole === "admin" ? "admin-dashboard" : "dashboard") : "landing")}
            className="flex items-center text-3xl font-black focus:outline-none"
          >
            <span className="text-[#660099] tracking-tight">Fed</span>
            <span className="text-[#FF6600] tracking-tight">Ex</span>
            <span className="text-sm font-semibold text-slate-400 select-none ml-2 border border-slate-200/50 rounded px-1.5 py-0.5 uppercase bg-slate-50">
              Clone Hub
            </span>
          </button>

          {/* Flexible Menu Navigation links */}
          <nav className="hidden lg:flex items-center gap-1">
            {!token ? (
              <>
                <button
                  onClick={() => { setActiveTab("landing"); setTrackedResult(null); }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                    activeTab === "landing" ? "bg-purple-50 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Home / Track
                </button>
                <button
                  onClick={() => { setAuthError(""); setActiveTab("login"); }}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 font-bold text-sm"
                >
                  Member Login
                </button>
                <button
                  onClick={() => { setAuthError(""); setActiveTab("admin-login"); }}
                  className="px-4 py-2 rounded-lg text-gray-500 hover:text-gray-700 font-bold text-xs flex items-center gap-1"
                >
                  Admin Desk
                </button>
              </>
            ) : userRole === "admin" ? (
              <>
                <button
                  onClick={() => setActiveTab("admin-dashboard")}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "admin-dashboard" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Logistics Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("admin-users")}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "admin-users" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Registered Clients
                </button>
                <button
                  onClick={() => setActiveTab("admin-parcels")}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "admin-parcels" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Checkpoints Admin
                </button>
                <button
                  onClick={() => setActiveTab("admin-chat")}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "admin-chat" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Support Inbox
                </button>
                <button
                  onClick={() => setActiveTab("admin-reports")}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "admin-reports" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Reports Audit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setActiveTab("dashboard"); fetchMyParcels(); }}
                  className={`px-3.5 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "dashboard" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  My Shipments
                </button>
                <button
                  onClick={() => setActiveTab("ship")}
                  className={`px-3.5 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "ship" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Send Package
                </button>
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`px-3.5 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "chat" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Support Desk
                </button>
                <button
                  onClick={() => { setActiveTab("profile"); fetchMyProfile(); }}
                  className={`px-3.5 py-2 rounded-lg font-bold text-sm transition ${
                    activeTab === "profile" ? "bg-purple-100 text-[#660099]" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  My Profile
                </button>
              </>
            )}
          </nav>

          {/* Header Action Button Area */}
          <div className="flex items-center gap-3">
            {!token ? (
              <button
                onClick={() => { setAuthError(""); setRegSuccess(""); setActiveTab("register"); }}
                className="bg-[#660099] hover:bg-[#590086] text-white px-4 py-2 rounded-lg font-bold text-xs transition shadow-sm"
              >
                Create Account
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-800">{userProfile?.fullname}</p>
                  <p className="text-[10px] text-gray-400 font-medium capitalize">{userRole} Desk</p>
                </div>
                <button
                  onClick={handleLogOut}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 p-2 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Core Body Segment */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="core-interactive-panel">
        {/* VIEW 1: LANDING PAGE TRACKING */}
        {activeTab === "landing" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Custom FedEx Purple-themed Hero Box */}
            <div className="bg-[#660099] rounded-3xl p-8 sm:p-12 relative overflow-hidden text-white shadow-xl flex flex-col md:flex-row items-center gap-8 border border-purple-900">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-tr from-[#FF6600]/20 to-transparent rounded-full -mr-32 -mt-32"></div>

              <div className="space-y-6 relative z-10 md:w-3/5">
                <span className="inline-block text-[#FF6600] font-black text-xs uppercase tracking-widest border border-orange-500/30 px-2.5 py-1 rounded bg-orange-500/10">
                  Global Shipping & Supply Chain
                </span>
                <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight">
                  Logistics Tracking <br /> Made Dynamic.
                </h1>
                <p className="text-sm sm:text-base text-gray-200 leading-relaxed font-semibold">
                  Input your 12-digit FedEx tracking reference code below to query live scan milestones, customs, clearances, transit history logs, and estimated deliveries map.
                </p>

                {/* Instant Search Bar */}
                <div className="bg-white rounded-2xl p-2 w-full max-w-md shadow-lg flex items-center justify-between gap-1 mt-6 border-2 border-orange-500/20">
                  <div className="flex items-center gap-2 pl-3 flex-grow">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      className="w-full focus:outline-none text-slate-900 placeholder-slate-400 font-mono font-bold uppercase text-sm"
                      placeholder="e.g. FDX123456789"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTrackPackage(trackingInput)}
                    />
                  </div>
                  <button
                    onClick={() => handleTrackPackage(trackingInput)}
                    disabled={trackingLoading}
                    className="bg-[#FF6600] text-white hover:bg-[#E05300] px-5 py-3 rounded-xl font-bold text-xs transition shrink-0 active:scale-95"
                  >
                    {trackingLoading ? "Searching..." : "Track Pack"}
                  </button>
                </div>

                <div className="flex items-center gap-5 text-xs text-purple-200/90 pt-4 font-semibold">
                  <span>🚀 Next-Day Logistics</span>
                  <span>•</span>
                  <span>📦 Full Transit Ledger</span>
                </div>
              </div>

              {/* Quick Sample Database references */}
              <div className="md:w-2/5 w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-orange-400 flex items-center gap-1">
                  <Compass className="w-4 h-4" />
                  Test Live Tracking Sandbox
                </h3>
                <p className="text-xs text-gray-200">
                  We pre-seeded the local database with these sample tracking codes so you can try tracking immediately:
                </p>

                <div className="space-y-2 font-mono text-xs">
                  <button
                    onClick={() => { setTrackingInput("FDX123456789"); handleTrackPackage("FDX123456789"); }}
                    className="w-full flex justify-between items-center bg-white/5 hover:bg-white/10 p-2.5 rounded text-left border border-white/15 transition-transform active:scale-95"
                  >
                    <span className="text-[#FF6600] font-bold">FDX123456789</span>
                    <span className="bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      In Transit (John)
                    </span>
                  </button>

                  <button
                    onClick={() => { setTrackingInput("FDX987654321"); handleTrackPackage("FDX987654321"); }}
                    className="w-full flex justify-between items-center bg-white/5 hover:bg-white/10 p-2.5 rounded text-left border border-white/15 transition-transform active:scale-95"
                  >
                    <span className="text-emerald-400 font-bold">FDX987654321</span>
                    <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Delivered (John)
                    </span>
                  </button>

                  <button
                    onClick={() => { setTrackingInput("FDX456789123"); handleTrackPackage("FDX456789123"); }}
                    className="w-full flex justify-between items-center bg-white/5 hover:bg-white/10 p-2.5 rounded text-left border border-white/15 transition-transform active:scale-95"
                  >
                    <span className="text-indigo-400 font-bold">FDX456789123</span>
                    <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Pending (Mary)
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tracking Output Window */}
            {trackingError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium animate-in slide-in-from-bottom-2 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <span>{trackingError}</span>
              </div>
            )}

            {trackedResult && (
              <div className="animate-in zoom-in-95 duration-200">
                <TrackingTimeline
                  parcel={trackedResult.parcel}
                  timeline={trackedResult.timeline}
                />
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LOGIN OR REGISTRATION PAGES */}
        {(activeTab === "login" || activeTab === "admin-login") && (
          <div className="max-w-md mx-auto py-10 animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8" id="login-interface-card">
              <div className="text-center space-y-2 mb-6">
                <span className="text-[10px] font-black tracking-widest text-[#FF6600] uppercase">
                  {activeTab === "admin-login" ? "Core Logistics Control" : "FedEx Member Zone"}
                </span>
                <h2 className="text-2xl font-black text-gray-900">
                  {activeTab === "admin-login" ? "Admin Desk Authentication" : "Sign In to FedEx"}
                </h2>
                <p className="text-xs text-gray-500 font-semibold">
                  {activeTab === "admin-login" ? "Authorize credentials with SHA algorithm secure sync" : "Access shipments scheduling, billing metrics, and chats support"}
                </p>
              </div>

              {authError && (
                <div className="p-3 mb-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-semibold">
                  {authError}
                </div>
              )}

              <form onSubmit={(e) => handleLoginSubmit(e, activeTab === "admin-login" ? "admin" : "user")} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">E-mail Address *</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                    placeholder="e.g. john@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Passphrase Key *</label>
                  <input
                    type="password"
                    required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                    placeholder="Enter account password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-[#660099] hover:bg-[#4B0082] text-white font-bold rounded-lg transition-colors text-sm shadow-sm disabled:opacity-50"
                >
                  {authLoading ? "Synchronizing Credentials..." : "Authenticate Session"}
                </button>
              </form>

              {/* Preseeded login hints toggle */}
              <div className="bg-slate-50 border border-slate-100 p-4 mt-6 rounded-xl space-y-2 text-[11px] text-slate-500">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#FF6600]" />
                  Dev Environment Quick Login Keys:
                </p>
                {activeTab === "admin-login" ? (
                  <div>
                    <span className="font-semibold block text-slate-700">Admin Account:</span>
                    <code>admin@fedex.com</code> / <code>admin123</code>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div>
                      <span className="font-semibold block text-slate-700">Approved Normal Client:</span>
                      <code>john@example.com</code> / <code>password123</code>
                    </div>
                    <div>
                      <span className="font-semibold block text-slate-700">Pending Normal Client:</span>
                      <code>mary@example.com</code> / <code>password123</code>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
                  <button
                    onClick={() => setActiveTab(activeTab === "admin-login" ? "login" : "admin-login")}
                    className="text-[#660099] font-bold text-[10px]"
                  >
                    Switch to {activeTab === "admin-login" ? "User Sign In" : "Admin Desk"}
                  </button>
                  {activeTab !== "admin-login" && (
                    <button
                      onClick={() => setActiveTab("register")}
                      className="text-[#FF6600] font-bold text-[10px]"
                    >
                      Register New User
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REGISTER USER VIEW */}
        {activeTab === "register" && (
          <div className="max-w-md mx-auto py-4 animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8" id="register-interface-card">
              <div className="text-center space-y-2 mb-6">
                <span className="text-[10px] font-black tracking-widest text-[#FF6600] uppercase">
                  FedEx Customer Sign Up
                </span>
                <h2 className="text-2xl font-black text-gray-900">Request New Client Account</h2>
                <p className="text-xs text-gray-400 font-semibold">
                  Register coordinate profiles below. Submit to admin authorization pipelines.
                </p>
              </div>

              {authError && (
                <div className="p-3 mb-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-semibold">
                  {authError}
                </div>
              )}

              {regSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-150 text-green-800 rounded-xl text-xs font-medium leading-relaxed">
                    {regSuccess}
                  </div>
                  <button
                    onClick={() => setActiveTab("login")}
                    className="w-full py-3 bg-[#660099] hover:bg-[#4B0082] text-white font-bold text-sm rounded-lg transition"
                  >
                    Proceed to Login Screen
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                      placeholder="e.g. Johnathan Miller"
                      value={regFullname}
                      onChange={(e) => setRegFullname(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">E-mail Address *</label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                      placeholder="e.g. jmiller@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Secure Password Key *</label>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                      placeholder="Create complex passphrase"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Contact Phone Number *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                      placeholder="e.g. +65 9213 8472"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Company / Organization name (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099]"
                      placeholder="e.g. Globex Singapore Corp"
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#660099] hover:bg-[#4B0082] text-white font-bold rounded-lg transition-colors text-sm shadow-sm"
                  >
                    Submit Access Petition
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setActiveTab("login")}
                      className="text-xs text-slate-400 hover:text-[#660099] font-semibold"
                    >
                      Already registered? Proceed to Login
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: USER MEMBER LOGGED-IN DASHBOARD */}
        {activeTab === "dashboard" && token && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* User Intro Banner widget */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
              <div>
                <span className="text-[10px] font-bold text-[#FF6600] uppercase tracking-wider">FedEx Member Dashboard</span>
                <h2 className="text-2xl font-black text-gray-900 mt-0.5">Welcome Back, {userProfile?.fullname}</h2>
                <p className="text-xs text-gray-500 font-semibold mt-1">Book new domestic or global shipments and track transit routes instantly.</p>
              </div>
              <button
                onClick={() => setActiveTab("ship")}
                className="bg-[#FF6600] hover:bg-[#E05300] text-white font-bold text-xs px-5 py-3 rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                <Calculator className="w-4 h-4" />
                Dispatch New Package
              </button>
            </div>

            {/* Quick Track & Trace Input */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
              <span className="text-sm font-bold text-gray-700 shrink-0">Track Shipments:</span>
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#660099] uppercase font-mono"
                  placeholder="Enter 12-digit Tracking No (e.g. FDX123456789)"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleTrackPackage(trackingInput)}
                className="w-full sm:w-auto px-5 py-2 bg-[#660099] hover:bg-[#4B0082] text-white text-xs font-bold rounded-lg transition"
              >
                Trace Checkout
              </button>
            </div>

            {/* Tracking Output Render */}
            {trackedResult && (
              <div className="border border-purple-100 rounded-xl overflow-hidden p-1 bg-white animate-in zoom-in-95 duration-200 shadow-sm">
                <TrackingTimeline
                  parcel={trackedResult.parcel}
                  timeline={trackedResult.timeline}
                />
              </div>
            )}

            {/* Shipments Table List Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
                <Truck className="w-5 h-5 text-[#660099]" />
                Your Despatch Registry History
              </h3>

              {myParcels.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-medium text-xs">
                  You do not have any registered package items on file. Book a dispatch to generate tracking codes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-500">
                    <thead className="uppercase text-gray-400 text-[10px] font-black tracking-wider bg-gray-50/50 border-b border-gray-100">
                      <tr>
                        <th colSpan={1} className="px-4 py-3">Tracking Number</th>
                        <th colSpan={1} className="px-4 py-3">Recipient Address</th>
                        <th colSpan={1} className="px-4 py-3">Weight (kg)</th>
                        <th colSpan={1} className="px-4 py-3">Invoice Fee</th>
                        <th colSpan={1} className="px-4 py-3">Last Checkpoint</th>
                        <th colSpan={1} className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {myParcels.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-4 py-3.5 font-bold font-mono text-[#660099] select-all">
                            <button
                              onClick={() => { setTrackingInput(p.tracking_number); handleTrackPackage(p.tracking_number); }}
                              className="hover:underline text-left text-xs"
                            >
                              {p.tracking_number}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 max-w-[150px] truncate">{p.receiver_address}</td>
                          <td className="px-4 py-3.5 font-medium">{p.weight} kg</td>
                          <td className="px-4 py-3.5 font-bold font-mono text-[#FF6600]">${p.shipping_cost.toFixed(2)}</td>
                          <td className="px-4 py-3.5">{p.current_location}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                              p.status === "delivered"
                                ? "bg-green-100 text-green-700"
                                : p.status === "exception"
                                ? "bg-red-100 text-red-700"
                                : "bg-purple-100 text-[#660099]"
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: USER BOOK DISPATCH FORM */}
        {activeTab === "ship" && token && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <ShipForm
              token={token}
              onShipmentSuccess={(tn) => {
                addToast(`Package created successfully! Tracking Reference: ${tn}`, "success");
                setTrackingInput(tn);
                setActiveTab("dashboard");
                fetchMyParcels();
              }}
            />
          </div>
        )}

        {/* VIEW 5: USER CHAT SUPPORT PANEL */}
        {activeTab === "chat" && token && userProfile && (
          <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-300">
            <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm text-xs font-semibold text-gray-500">
               Support live chat room is synchronized with FedEx Socket Server instance on port 3000. Ask any logistics details now.
            </div>
            <ChatComponent
              token={token}
              userId={userProfile.id}
              userName={userProfile.fullname}
              role="user"
            />
          </div>
        )}

        {/* VIEW 6: USER PROFILE PREVIEW */}
        {activeTab === "profile" && token && (
          <div className="max-w-md mx-auto animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8" id="user-profile-card">
              <div className="text-center space-y-3 pb-6 border-b border-gray-100 mb-6">
                <div className="w-16 h-16 rounded-full bg-purple-100 text-[#660099] flex items-center justify-center font-bold text-2xl mx-auto">
                  {userProfile?.fullname[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{userProfile?.fullname}</h3>
                  <p className="text-xs text-gray-400 mt-1">E-mail on file: {userProfile?.email}</p>
                </div>
              </div>

              {myProfile ? (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold">Verification Clearance Status</span>
                    <span className="font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      {myProfile.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold">Assigned Corporate Persona</span>
                    <span className="font-bold text-gray-700">{myProfile.company || "Personal Customer ID"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold">Contact Phone Verified</span>
                    <span className="font-bold font-mono text-gray-700">{myProfile.phone}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400 font-semibold">Member Incorporation Date</span>
                    <span className="font-gray-500">{new Date(myProfile.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-400">Loading profile sync credentials...</p>
              )}
            </div>
          </div>
        )}

        {/* VIEW 7: ADMINISTRATIVE LOGISTICS MAIN DASHBOARD */}
        {activeTab === "admin-dashboard" && token && userRole === "admin" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest bg-orange-100 text-orange-850 px-2 py-0.5 rounded font-mono">
                  Administrative Center
                </span>
                <h2 className="text-2xl font-black text-gray-900 mt-1">Logistics Core Supervisor</h2>
                <p className="text-xs text-gray-500 font-medium">Verify registered accounts, scan dispatch packages locations, trace live logs and support chats.</p>
              </div>
              <button
                onClick={fetchAdminStats}
                className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 font-bold px-3 py-1.5 rounded transition"
              >
                Refresh Statistics
              </button>
            </div>

            {/* Admin Stats Grid Widgets */}
            {adminStats ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Registered Clients</span>
                    <p className="text-3xl font-black text-gray-950 font-mono">{adminStats.totalUsers}</p>
                    <span className="text-[10px] text-emerald-600 font-bold block">🛡️ SHA Authentication Verified</span>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Shipments Overall</span>
                    <p className="text-3xl font-black text-gray-950 font-mono">{adminStats.totalParcels}</p>
                    <span className="text-[10px] text-[#660099] font-bold block">📈 Generated in Ledger</span>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Transit Checkpoints Scans</span>
                    <p className="text-3xl font-black text-gray-950 font-mono">{adminStats.inTransit}</p>
                    <span className="text-[10px] text-orange-600 font-bold block">🚛 Logistics Coordinates Dynamic</span>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-2">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Successful Deliveries</span>
                    <p className="text-3xl font-black text-gray-950 font-mono">{adminStats.delivered}</p>
                    <span className="text-[10px] text-[#660099] font-bold block">✅ Scanned Destination Facility</span>
                  </div>
                </div>

                {/* SVG Visual Dashboard Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-sm mb-4">Daily Despatches Trends</h3>
                  {adminStats.dailyParcels && adminStats.dailyParcels.length > 0 ? (
                    <div className="h-64 flex flex-col justify-between">
                      {/* Responsive SVG Bar Visual representations */}
                      <div className="flex-1 flex items-end gap-6 border-b border-slate-200 pb-2">
                        {adminStats.dailyParcels.slice(0, 7).reverse().map((dp: any, idx: number) => {
                          const maxCount = Math.max(...adminStats.dailyParcels.map((d: any) => d.count), 1);
                          const heightPercent = (dp.count / maxCount) * 80 + 10; // min 10% height

                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                              <div className="text-xs font-bold text-gray-800 select-none opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white px-2 py-0.5 rounded -mt-6 absolute">
                                {dp.count} packs
                              </div>
                              <div
                                className="w-full bg-[#660099] rounded-t-lg group-hover:bg-[#FF6600] transition-all duration-300"
                                style={{ height: `${heightPercent}%` }}
                              ></div>
                              <span className="text-[9px] font-mono font-bold text-gray-400">{dp.day.split("-").slice(1).join("/")}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between items-center pt-2 text-xs text-slate-400 font-semibold">
                        <span>Checkpoints Timeline Analysis</span>
                        <span>Aggregate Daily Tracking Metrics</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm italic text-gray-400 py-10 text-center">No ship events loaded for graphical telemetry preview.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-gray-400 py-10">Synchronizing database metrics...</p>
            )}

            {/* Quick Actions Shortcuts links */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-3">Admin Quick Desks</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab("admin-users")}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 transition bg-white"
                >
                  <Users className="w-6 h-6 text-[#660099] mb-2" />
                  <span className="text-xs font-bold text-gray-800">Clients Accounts</span>
                </button>
                <button
                  onClick={() => setActiveTab("admin-parcels")}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 transition bg-white"
                >
                  <Truck className="w-6 h-6 text-[#660099] mb-2" />
                  <span className="text-xs font-bold text-gray-800">Scans logistics</span>
                </button>
                <button
                  onClick={() => setActiveTab("admin-chat")}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 transition bg-white"
                >
                  <MessageSquare className="w-6 h-6 text-[#660099] mb-2" />
                  <span className="text-xs font-bold text-gray-800">Helpdesk Tickets</span>
                </button>
                <button
                  onClick={() => setActiveTab("admin-reports")}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 transition bg-white"
                >
                  <FileText className="w-6 h-6 text-[#660099] mb-2" />
                  <span className="text-xs font-bold text-gray-800">CSV Spreadsheet</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 8: ADMIN SUBPANEL ROLES */}
        {activeTab === "admin-users" && token && userRole === "admin" && (
          <AdminUsers token={token} />
        )}

        {/* VIEW 9: ADMIN LOGISTICS PARCELS SCANS OFFICE */}
        {activeTab === "admin-parcels" && token && userRole === "admin" && (
          <AdminParcels token={token} />
        )}

        {/* VIEW 10: ADMIN CLIENT LIVE CHAT OVERVIEW INBOX */}
        {activeTab === "admin-chat" && token && userRole === "admin" && (
          <AdminChat token={token} />
        )}

        {/* VIEW 11: ADMIN AUDIT REPORT DOWNLOAD OFFICE */}
        {activeTab === "admin-reports" && token && userRole === "admin" && (
          <AdminReports token={token} />
        )}
      </main>

      {/* Primary Footer Section */}
      <footer className="bg-slate-900 border-t border-slate-800 py-10 text-white mt-12" id="main-footer">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center text-2xl font-black">
            <span className="text-purple-400">Fed</span>
            <span className="text-[#FF6600]">Ex</span>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase ml-2">Clone</span>
          </div>
          <p className="text-slate-500 text-xs">
            © 2026 FedEx Clone Network Services Singapore INC. All rights reserved.
          </p>
          <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
            <span>PORT: 3000</span>
            <span>•</span>
            <span>SQLite Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

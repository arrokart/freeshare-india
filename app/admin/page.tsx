"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { 
  Loader2, ArrowLeft, ShieldAlert, Flag, UserMinus, FileMinus, 
  CheckCircle2, ShieldCheck, Search, SlidersHorizontal, Users, 
  Settings, Check, X, ShieldX, ToggleLeft, ToggleRight, RotateCcw,
  Edit2, Heart, FileText, BarChart3, Send
} from "lucide-react";

type TabState = "queue" | "users" | "listings" | "settings" | "ngos" | "analytics" | "broadcast";

export default function AdminPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabState>("queue");

  const [reports, setReports] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters & Search for Queue
  const [queueSearch, setQueueSearch] = useState("");
  const [filterReason, setFilterReason] = useState("All");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = useState(10);

  // Users Directory States
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingTrustUserId, setEditingTrustUserId] = useState<string | null>(null);
  const [targetTrustScore, setTargetTrustScore] = useState("5.0");
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);

  // Listings Directory States
  const [listings, setListings] = useState<any[]>([]);
  const [listingSearch, setListingSearch] = useState("");
  const [listingSuggestions, setListingSuggestions] = useState<any[]>([]);
  const [showListingSuggestions, setShowListingSuggestions] = useState(false);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingPage, setListingPage] = useState(1);
  const [listingLimit, setListingLimit] = useState(10);
  const [totalListings, setTotalListings] = useState(0);

  // NGO Verification States
  const [ngoApps, setNgoApps] = useState<any[]>([]);
  const [ngoAppStatusFilter, setNgoAppStatusFilter] = useState("pending");
  const [loadingNgoApps, setLoadingNgoApps] = useState(false);
  const [actionLoadingNgoId, setActionLoadingNgoId] = useState<string | null>(null);
  const [ngoRejectReason, setNgoRejectReason] = useState("");
  const [rejectingNgoUserId, setRejectingNgoUserId] = useState<string | null>(null);

  // Settings States
  const [monthlyLimit, setMonthlyLimit] = useState("10");
  const [gracePeriod, setGracePeriod] = useState("24");
  const [trustThreshold, setTrustThreshold] = useState("4.5");
  const [campaignType, setCampaignType] = useState("none");
  const [campaignLimit, setCampaignLimit] = useState("20");
  const [campaignName, setCampaignName] = useState("");
  const [welcomeTrialEnabled, setWelcomeTrialEnabled] = useState(true);
  const [gaMeasurementId, setGaMeasurementId] = useState("");
  const [adsenseClientId, setAdsenseClientId] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Broadcast Panel States
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("");
  const [broadcastTargetType, setBroadcastTargetType] = useState<"all" | "city">("all");
  const [broadcastCity, setBroadcastCity] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

  // User Limit Override States
  const [editingLimitUserId, setEditingLimitUserId] = useState<string | null>(null);
  const [targetLimit, setTargetLimit] = useState("");

  useEffect(() => {
    const checkAdminStatus = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?next=/admin");
        return;
      }
      setUserId(data.user.id);

      // Verify is_admin column in DB users table
      const { data: profile } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", data.user.id)
        .single();

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadModerationData(data.user.id);
      setLoading(false);
    };

    checkAdminStatus();
  }, [router]);

  // Load User Search Suggestions
  useEffect(() => {
    if (userSearch.trim().length < 2 || !userId) {
      setUserSuggestions([]);
      setShowUserSuggestions(false);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?adminId=${userId}&search=${encodeURIComponent(userSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setUserSuggestions(data.users || []);
          setShowUserSuggestions(true);
        }
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [userSearch, userId]);

  // Load Listing Search Suggestions
  useEffect(() => {
    if (listingSearch.trim().length < 2 || !userId) {
      setListingSuggestions([]);
      setShowListingSuggestions(false);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/listings?adminId=${userId}&search=${encodeURIComponent(listingSearch)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setListingSuggestions(data.listings || []);
          setShowListingSuggestions(true);
        }
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(delayDebounce);
  }, [listingSearch, userId]);

  // Click outside to dismiss suggestions inside admin dashboard
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-search-container")) {
        setShowUserSuggestions(false);
      }
      if (!target.closest(".listing-search-container")) {
        setShowListingSuggestions(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  // Load Mod Queue
  const loadModerationData = async (adminUid: string) => {
    try {
      const res = await fetch(`/api/admin/moderation?adminId=${adminUid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports");
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Reports load failed.");
    }
  };

  // Load Users Directory
  const loadUsersDirectory = async (page: number = userPage, limit: number = userLimit) => {
    if (!userId) return;
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?adminId=${userId}&search=${encodeURIComponent(userSearch)}&page=${page}&limit=${limit}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users || []);
      setTotalUsers(data.totalCount || 0);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch users list.");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load Listings Directory
  const loadListingsDirectory = async (page: number = listingPage, limit: number = listingLimit) => {
    if (!userId) return;
    setLoadingListings(true);
    try {
      const res = await fetch(`/api/admin/listings?adminId=${userId}&search=${encodeURIComponent(listingSearch)}&page=${page}&limit=${limit}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load listings");
      setListings(data.listings || []);
      setTotalListings(data.totalCount || 0);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch listings list.");
    } finally {
      setLoadingListings(false);
    }
  };

  // Load Settings
  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok) {
        setMonthlyLimit(String(data.monthly_claim_limit ?? 10));
        setGracePeriod(String(data.grace_period_hours ?? 24));
        setTrustThreshold(String(data.auto_restore_threshold ?? 4.5));
        setCampaignType(data.campaign_type ?? "none");
        setCampaignLimit(String(data.campaign_limit ?? 20));
        setCampaignName(data.campaign_name ?? "");
        setWelcomeTrialEnabled(data.welcome_trial_enabled ?? true);
        setGaMeasurementId(data.ga_measurement_id ?? "");
        setAdsenseClientId(data.adsense_client_id ?? "");
      }
    } catch (err: any) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Analytics States
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const loadAnalyticsData = async () => {
    if (!userId) return;
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/admin/analytics?adminId=${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load admin stats");
      setAnalytics(data);
    } catch (err: any) {
      console.error("Analytics Load Error:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Load NGO applications
  const loadNgoApplications = async (status: string = ngoAppStatusFilter) => {
    if (!userId) return;
    setLoadingNgoApps(true);
    try {
      const res = await fetch(`/api/admin/ngos?adminId=${userId}&status=${status}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load NGO applications");
      setNgoApps(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch NGO applications.");
    } finally {
      setLoadingNgoApps(false);
    }
  };

  const handleNgoAction = async (targetUserId: string, action: "approve" | "reject", notes?: string) => {
    if (!userId) return;
    setActionLoadingNgoId(targetUserId);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/admin/ngos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: userId,
          targetUserId,
          action,
          adminNotes: notes || ""
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update NGO status");
      setSuccessMsg(`NGO application has been successfully ${action}d.`);
      await loadNgoApplications(ngoAppStatusFilter);
      setRejectingNgoUserId(null);
      setNgoRejectReason("");
    } catch (err: any) {
      setErrorMsg(err.message || "Action failed.");
    } finally {
      setActionLoadingNgoId(null);
    }
  };

  // Reload data when switching tabs
  useEffect(() => {
    if (isAdmin && userId) {
      if (activeTab === "queue") loadModerationData(userId);
      if (activeTab === "users") loadUsersDirectory(userPage, userLimit);
      if (activeTab === "listings") loadListingsDirectory(listingPage, listingLimit);
      if (activeTab === "ngos") loadNgoApplications(ngoAppStatusFilter);
      if (activeTab === "settings") loadSettings();
      if (activeTab === "analytics") loadAnalyticsData();
    }
  }, [activeTab, isAdmin, userId, userPage, userLimit, listingPage, listingLimit, ngoAppStatusFilter]);

  // Execute moderation actions
  const handleModerationAction = async (
    reportId: string | undefined,
    action: "ban_user" | "unban_user" | "remove_listing" | "approve_appeal" | "reject_appeal" | "dismiss" | "adjust_trust" | "grant_premium" | "revoke_premium" | "approve_event_appeal" | "reject_event_appeal",
    targetUserId?: string,
    targetListingId?: string,
    extraParams: any = {}
  ) => {
    if (!userId) return;
    if (reportId) setActionLoadingId(reportId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: userId,
          reportId,
          action,
          targetUserId,
          targetListingId,
          ...extraParams
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Moderation action failed");

      setSuccessMsg(`Action "${action}" applied successfully.`);
      
      // Reload current tab content
      if (activeTab === "queue") await loadModerationData(userId);
      if (activeTab === "users") await loadUsersDirectory();
      if (activeTab === "listings") await loadListingsDirectory();
    } catch (err: any) {
      setErrorMsg(err.message || "Moderation action failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBroadcasting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: userId,
          targetType: broadcastTargetType,
          city: broadcastTargetType === "city" ? broadcastCity : null,
          title: broadcastTitle,
          notifBody: broadcastBody,
          link: broadcastLink,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Broadcast request failed");

      setSuccessMsg(data.message || `Broadcast completed successfully! Sent to ${data.count} users.`);
      setBroadcastTitle("");
      setBroadcastBody("");
      setBroadcastLink("");
      setBroadcastCity("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send broadcast.");
    } finally {
      setBroadcasting(false);
    }
  };

  // Save Config Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSavingSettings(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: userId,
          monthly_claim_limit: monthlyLimit,
          grace_period_hours: gracePeriod,
          auto_restore_threshold: trustThreshold,
          campaign_type: campaignType,
          campaign_limit: campaignLimit,
          campaign_name: campaignName,
          welcome_trial_enabled: welcomeTrialEnabled,
          ga_measurement_id: gaMeasurementId,
          adsense_client_id: adsenseClientId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setSuccessMsg("System configuration settings updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update configurations.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Set Custom Claim Limit Override for a user
  const handleSetCustomLimit = async (targetUserId: string, limitVal: string) => {
    if (!userId) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: userId,
          targetUserId,
          action: "set_limit",
          custom_claim_limit: limitVal === "" ? null : parseInt(limitVal)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update limit override");
      setSuccessMsg("User custom claim limit updated successfully.");
      await loadUsersDirectory();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update limit override.");
    }
  };

  // Calculate frequency counts of listings reported
  const getListingReportCount = (listingId: string) => {
    return reports.filter((r) => r.reported_listing_id === listingId).length;
  };

  // Calculate frequency counts of users reported
  const getUserReportCount = (targetUid: string) => {
    return reports.filter((r) => r.reported_user_id === targetUid).length;
  };

  // Filtering Logic for Moderation Queue
  const filteredReports = reports.filter((rep) => {
    // Search
    const query = queueSearch.toLowerCase();
    const titleMatch = rep.reported_listing?.title?.toLowerCase().includes(query) || false;
    const reporterMatch = rep.reporter?.name?.toLowerCase().includes(query) || false;
    const userMatch = rep.reported_user?.email?.toLowerCase().includes(query) || false;
    const descMatch = rep.description?.toLowerCase().includes(query) || false;
    const searchMatch = !query || titleMatch || reporterMatch || userMatch || descMatch;

    // Reason filter (Handle virtual appeal reason)
    let reasonMatch = true;
    if (filterReason === "appeal") {
      reasonMatch = rep.reason === "other" && rep.description?.startsWith("[APPEAL]");
    } else if (filterReason !== "All") {
      reasonMatch = rep.reason === filterReason && !rep.description?.startsWith("[APPEAL]");
    }

    // Status filter
    const statusMatch = filterStatus === "All" || rep.status === filterStatus;

    return searchMatch && reasonMatch && statusMatch;
  });

  const paginatedReports = filteredReports.slice((queuePage - 1) * queueLimit, queuePage * queueLimit);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Checking administrator clearances...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <ShieldAlert size={48} className="text-red-500 animate-bounce" />
        <h2 className="text-lg font-black tracking-tight">Access Denied</h2>
        <p className="text-xs text-slate-500 max-w-sm text-center">You do not have administrative clearances to access this route.</p>
        <Link href="/" className="text-teal-400 hover:underline text-xs flex items-center gap-1 mt-2">
          <ArrowLeft size={14} /> Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-16 selection:bg-teal-500 selection:text-black">
      
      {/* Navigation Header */}
      <header className="max-w-6xl mx-auto px-4 pt-6 flex justify-between items-center">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-teal-400 font-bold bg-teal-500/5 px-3 py-1.5 rounded-full border border-teal-500/20">
          <ShieldCheck size={14} />
          Moderation Console
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        
        {/* Mod Responses */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
            {successMsg}
          </div>
        )}

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-slate-900 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("queue")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "queue"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flag size={14} />
            Moderation Queue
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "users"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users size={14} />
            User Directory
          </button>
          <button
            onClick={() => setActiveTab("listings")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "listings"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileMinus size={14} />
            Listing Directory
          </button>
          <button
            onClick={() => setActiveTab("ngos")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "ngos"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Heart size={14} />
            Charity Verifications
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "analytics"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 size={14} />
            Platform Stats
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "settings"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings size={14} />
            System Configs
          </button>
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "broadcast"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Send size={14} />
            Alert Broadcast
          </button>
        </div>

        {/* =====================================================================
            TAB 1: MODERATION QUEUE
            ===================================================================== */}
        {activeTab === "queue" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-100">Abuse Moderation Queue</h2>
                <p className="text-xs text-slate-500 mt-1">Review flagged listings, spam reports, or donor appeals.</p>
              </div>

              {/* Status Queue Tabs */}
              <div className="flex bg-slate-900/40 p-1 rounded-xl border border-slate-900 shrink-0 gap-1 text-[11px] font-bold">
                <button
                  onClick={() => { setFilterStatus("pending"); setQueuePage(1); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterStatus === "pending" ? "bg-teal-500 text-slate-950" : "text-slate-450 hover:text-slate-200"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => { setFilterStatus("action_taken"); setQueuePage(1); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterStatus === "action_taken" ? "bg-teal-500 text-slate-950" : "text-slate-450 hover:text-slate-200"
                  }`}
                >
                  Resolved
                </button>
                <button
                  onClick={() => { setFilterStatus("dismissed"); setQueuePage(1); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterStatus === "dismissed" ? "bg-teal-500 text-slate-950" : "text-slate-450 hover:text-slate-200"
                  }`}
                >
                  Dismissed
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/10 border border-slate-900/80 p-4 rounded-3xl">
              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search listings, emails, reasons..."
                  value={queueSearch}
                  onChange={(e) => { setQueueSearch(e.target.value); setQueuePage(1); }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Reason Category Filter */}
              <div className="relative">
                <select
                  value={filterReason}
                  onChange={(e) => { setFilterReason(e.target.value); setQueuePage(1); }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-350 focus:outline-none focus:border-teal-500 appearance-none"
                >
                  <option value="All">All Categories</option>
                  <option value="fake_listing">Fake Listing</option>
                  <option value="spam">Spam</option>
                  <option value="abuse">Abuse</option>
                  <option value="inappropriate">Inappropriate</option>
                  <option value="commercial_reselling">Commercial Reselling</option>
                  <option value="appeal">Appeals</option>
                  <option value="other">Other</option>
                </select>
                <SlidersHorizontal size={12} className="absolute right-3.5 top-4 text-slate-600 pointer-events-none" />
              </div>

              {/* Items Per Page selector */}
              <div className="relative">
                <select
                  value={queueLimit}
                  onChange={(e) => { setQueueLimit(Number(e.target.value)); setQueuePage(1); }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-350 focus:outline-none focus:border-teal-500 appearance-none"
                >
                  <option value={10}>10 items per page</option>
                  <option value={20}>20 items per page</option>
                  <option value={50}>50 items per page</option>
                  <option value={100}>100 items per page</option>
                </select>
                <SlidersHorizontal size={12} className="absolute right-3.5 top-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-4">
              {filteredReports.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl">
                  <CheckCircle2 className="mx-auto text-slate-700 mb-3" size={36} />
                  <p className="text-sm font-bold text-slate-400">All clean!</p>
                  <p className="text-xs text-slate-600 mt-1">No reports matching filters found.</p>
                </div>
              ) : (
                paginatedReports.map((rep) => {
                  const isAppeal = rep.reason === "other" && rep.description?.startsWith("[APPEAL]");
                  const isEventAppeal = rep.reason === "other" && rep.description?.startsWith("[EVENT_APPEAL]");
                  const reportsOnListing = rep.reported_listing_id ? getListingReportCount(rep.reported_listing_id) : 0;
                  const reportsOnUser = rep.reported_user_id ? getUserReportCount(rep.reported_user_id) : 0;

                  return (
                    <div key={rep.id} className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-4">
                      
                      {/* Header block */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-3">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded ${
                            (isAppeal || isEventAppeal) ? "bg-amber-500/10 text-amber-440 border border-amber-500/20" :
                            "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            <Flag size={10} />
                            {isEventAppeal ? "event appeal" : isAppeal ? "appeal" : rep.reason}
                          </span>
                          <span className="text-xs text-slate-500">
                            Reported by <span className="font-bold text-slate-400">{rep.reporter?.name || "Anonymous"}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                          ID: {rep.id.slice(0, 8)} | Status: {rep.status}
                        </span>
                      </div>

                      {/* Description comment */}
                      <div className="bg-slate-950/20 p-3.5 rounded-2xl border border-slate-900/60 overflow-hidden">
                        <p className="text-xs text-slate-300 leading-relaxed font-mono break-all whitespace-pre-wrap">
                          "{rep.description}"
                        </p>
                      </div>

                      {/* Associated details row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Target Item Details */}
                        {rep.reported_listing && (
                          <div className="space-y-2 border border-slate-900/60 bg-slate-950/10 p-3 rounded-2xl">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Target Item details</h4>
                              {reportsOnListing > 1 && (
                                <span className="text-[9px] font-extrabold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                                  ⚠️ Flagged {reportsOnListing} times
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                                <img src={rep.reported_listing.images?.[0]} alt="Listing preview" className="w-full h-full object-cover" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-xs font-bold text-slate-200 block truncate max-w-[200px]">{rep.reported_listing.title}</span>
                                <span className="text-[10px] text-slate-500 block">Status: {rep.reported_listing.status}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Target User Details */}
                        {rep.reported_user && (
                          <div className="space-y-2 border border-slate-900/60 bg-slate-950/10 p-3 rounded-2xl">
                            <div className="flex justify-between items-center">
                              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Target User details</h4>
                              {reportsOnUser > 1 && (
                                <span className="text-[9px] font-extrabold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                                  ⚠️ User reported {reportsOnUser} times
                                </span>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-slate-200 block">{rep.reported_user.name}</span>
                              <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">{rep.reported_user.email}</span>
                            </div>
                          </div>
                        )}
                      </div>

                       {rep.status === "pending" && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900/80">
                          {isEventAppeal ? (
                            <>
                              {rep.reported_user && (
                                <>
                                  <button
                                    disabled={actionLoadingId !== null}
                                    onClick={() => handleModerationAction(rep.id, "approve_event_appeal", rep.reported_user.id)}
                                    className="text-[11px] font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/5"
                                  >
                                    <Check size={13} strokeWidth={3} />
                                    Restore Event Privileges
                                  </button>
                                  <button
                                    disabled={actionLoadingId !== null}
                                    onClick={() => handleModerationAction(rep.id, "reject_event_appeal", rep.reported_user.id)}
                                    className="text-[11px] font-bold bg-slate-900 border border-slate-850 hover:bg-red-500/10 text-red-400 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                                  >
                                    <X size={13} />
                                    Reject Appeal
                                  </button>
                                </>
                              )}
                            </>
                          ) : isAppeal ? (
                            <>
                              {rep.reported_listing && (
                                <>
                                  <button
                                    disabled={actionLoadingId !== null}
                                    onClick={() => handleModerationAction(rep.id, "approve_appeal", undefined, rep.reported_listing.id)}
                                    className="text-[11px] font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/5"
                                  >
                                    <Check size={13} strokeWidth={3} />
                                    Approve & Relist Item
                                  </button>
                                  <button
                                    disabled={actionLoadingId !== null}
                                    onClick={() => handleModerationAction(rep.id, "reject_appeal", undefined, rep.reported_listing.id)}
                                    className="text-[11px] font-bold bg-slate-900 border border-slate-850 hover:bg-red-500/10 text-red-400 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                                  >
                                    <X size={13} />
                                    Reject Appeal
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {rep.reported_listing && rep.reported_listing.status !== "removed" && (
                                <button
                                  disabled={actionLoadingId !== null}
                                  onClick={() => handleModerationAction(rep.id, "remove_listing", undefined, rep.reported_listing.id)}
                                  className="text-[11px] font-bold bg-slate-900 border border-slate-850 hover:bg-red-500/10 text-red-400 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                                >
                                  <FileMinus size={13} />
                                  Remove Listing
                                </button>
                              )}
                              
                              {rep.reported_user && !rep.reported_user.is_banned && (
                                <button
                                  disabled={actionLoadingId !== null}
                                  onClick={() => handleModerationAction(rep.id, "ban_user", rep.reported_user.id)}
                                  className="text-[11px] font-bold bg-slate-900 border border-slate-850 hover:bg-red-500/10 text-red-400 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                                >
                                  <UserMinus size={13} />
                                  Ban User Account
                                </button>
                              )}
                            </>
                          )}

                          <button
                            disabled={actionLoadingId !== null}
                            onClick={() => handleModerationAction(rep.id, "dismiss")}
                            className="text-[11px] font-bold bg-slate-950 border border-slate-900 hover:bg-slate-900 text-slate-400 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors ml-auto"
                          >
                            <ShieldX size={13} />
                            Dismiss Report
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Queue Pagination */}
            {filteredReports.length > queueLimit && (
              <div className="flex items-center justify-between mt-4 bg-slate-900/10 border border-slate-900/60 p-3 rounded-2xl">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {(queuePage - 1) * queueLimit + 1} - {Math.min(queuePage * queueLimit, filteredReports.length)} of {filteredReports.length} reports
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={queuePage === 1}
                    onClick={() => setQueuePage((p) => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-350 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Previous
                  </button>
                  <button
                    disabled={queuePage * queueLimit >= filteredReports.length}
                    onClick={() => setQueuePage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-350 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 2: USER DIRECTORY
            ===================================================================== */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-100">User Directory</h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">Browse registered accounts, adjust trust scores, and manage bans.</p>
            </div>

            {/* Search & Limit Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:max-w-md user-search-container">
                <Search size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowUserSuggestions(true);
                  }}
                  onFocus={() => {
                    if (userSearch.trim().length >= 2) setShowUserSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setUserPage(1);
                      loadUsersDirectory(1, userLimit);
                      setShowUserSuggestions(false);
                    }
                  }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500"
                />
                {showUserSuggestions && userSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950/95 border border-slate-850 rounded-2xl p-2 shadow-2xl z-40 backdrop-blur-xl animate-in fade-in duration-150">
                    <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest px-3 py-1.5 pb-2 border-b border-slate-900">
                      User Search Matches
                    </div>
                    <div className="mt-1 space-y-0.5 max-h-52 overflow-y-auto">
                      {userSuggestions.map((usr: any) => (
                        <button
                          key={usr.id}
                          onClick={() => {
                            setUserSearch(usr.name || usr.email);
                            setUserPage(1);
                            setShowUserSuggestions(false);
                            // Directly fetch
                            setTimeout(() => {
                              fetch(`/api/admin/users?adminId=${userId}&search=${encodeURIComponent(usr.name || usr.email)}&page=1&limit=${userLimit}`)
                                .then(r => r.json())
                                .then(d => {
                                  setUsers(d.users || []);
                                  setTotalUsers(d.totalCount || 0);
                                });
                            }, 50);
                          }}
                          className="w-full text-left flex flex-col p-2 rounded-xl hover:bg-slate-900/60 transition-colors group/item"
                        >
                          <span className="text-xs font-bold text-slate-200 group-hover/item:text-teal-400 transition-colors">
                            {usr.name || "N/A"}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {usr.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative w-full sm:w-48 shrink-0">
                <select
                  value={userLimit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value);
                    setUserLimit(newLimit);
                    setUserPage(1);
                    loadUsersDirectory(1, newLimit);
                  }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-355 focus:outline-none focus:border-teal-500 appearance-none"
                >
                  <option value={10}>10 users per page</option>
                  <option value={20}>20 users per page</option>
                  <option value={50}>50 users per page</option>
                  <option value={100}>100 users per page</option>
                </select>
                <SlidersHorizontal size={12} className="absolute right-3.5 top-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/10 border border-slate-900/60 rounded-3xl overflow-hidden">
              {loadingUsers ? (
                <div className="text-center py-20 flex justify-center items-center gap-2">
                  <Loader2 className="animate-spin text-teal-400" size={24} />
                  <span className="text-xs text-slate-500">Fetching user directory...</span>
                </div>
              ) : users.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-10">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/20 text-slate-450 text-[10px] font-extrabold uppercase tracking-wider">
                        <th className="p-4">Name / Email</th>
                        <th className="p-4">City</th>
                        <th className="p-4">Trust Score</th>
                        <th className="p-4">Claim Limit</th>
                        <th className="p-4">Activity</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {users.map((u) => {
                        const isEditingTrust = editingTrustUserId === u.id;
                        const isEditingLimit = editingLimitUserId === u.id;
                        let customClaimLimit: number | undefined = undefined;
                        try {
                          const parsedBio = JSON.parse(u.bio || "{}");
                          if (parsedBio && typeof parsedBio === "object" && !Array.isArray(parsedBio)) {
                            customClaimLimit = parsedBio.custom_claim_limit;
                          }
                        } catch {}

                        return (
                          <tr key={u.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="p-4">
                              <div className="font-bold text-slate-200">{u.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{u.email}</div>
                            </td>
                            <td className="p-4 text-slate-350">{u.city || "N/A"}</td>
                            <td className="p-4">
                              {isEditingTrust ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="1.0"
                                    max="5.0"
                                    value={targetTrustScore}
                                    onChange={(e) => setTargetTrustScore(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 w-12 text-center text-xs"
                                  />
                                  <button
                                    onClick={() => {
                                      handleModerationAction(undefined, "adjust_trust", u.id, undefined, { trustScore: targetTrustScore });
                                      setEditingTrustUserId(null);
                                    }}
                                    className="p-1 text-teal-400 hover:text-teal-300"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingTrustUserId(null)}
                                    className="p-1 text-red-400 hover:text-red-350"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-slate-200">
                                  <span>★ {(u.trust_score || 5.0).toFixed(1)}</span>
                                  <button
                                    onClick={() => {
                                      setEditingTrustUserId(u.id);
                                      setTargetTrustScore(String(u.trust_score || 5.0));
                                    }}
                                    className="p-0.5 text-slate-500 hover:text-slate-300 ml-1"
                                    title="Edit Trust Score"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {isEditingLimit ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    placeholder="Clear"
                                    value={targetLimit}
                                    onChange={(e) => setTargetLimit(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 w-16 text-center text-xs font-mono"
                                  />
                                  <button
                                    onClick={() => {
                                      handleSetCustomLimit(u.id, targetLimit);
                                      setEditingLimitUserId(null);
                                    }}
                                    className="p-1 text-teal-400 hover:text-teal-300"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingLimitUserId(null)}
                                    className="p-1 text-red-400 hover:text-red-350"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-slate-200">
                                  <span>
                                    {customClaimLimit !== undefined
                                      ? (customClaimLimit === -1 ? "Unlimited" : `${customClaimLimit} items`)
                                      : "Default"}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingLimitUserId(u.id);
                                      setTargetLimit(customClaimLimit !== undefined ? String(customClaimLimit) : "");
                                    }}
                                    className="p-0.5 text-slate-500 hover:text-slate-300 ml-1"
                                    title="Edit Custom Claim Limit override (-1 for Unlimited, blank to reset)"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-4 text-slate-400 text-[10px]">
                              🎁 {u.total_donated || 0} donated | 🤝 {u.total_received || 0} claimed
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                  u.is_banned ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {u.is_banned ? "Banned" : "Active"}
                                </span>
                                {u.is_premium && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    ★ Premium
                                  </span>
                                )}
                                {u.is_ngo && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                    ♥ Verified NGO
                                  </span>
                                )}
                                {u.can_create_events === false && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                    ⚠️ Event Locked
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    if (!userId) return;
                                    setErrorMsg("");
                                    setSuccessMsg("");
                                    try {
                                      const res = await fetch("/api/admin/users", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          adminId: userId,
                                          targetUserId: u.id,
                                          action: "toggle_event_creation"
                                        })
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data.error || "Failed to toggle event privilege");
                                      setSuccessMsg(data.message);
                                      await loadUsersDirectory();
                                    } catch (err: any) {
                                      setErrorMsg(err.message || "Failed to toggle privilege.");
                                    }
                                  }}
                                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors border ${
                                    u.can_create_events !== false 
                                      ? "bg-slate-900 border-slate-800 text-red-400 hover:bg-red-500/10" 
                                      : "bg-teal-500 border-teal-500 text-slate-950 hover:bg-teal-400"
                                  }`}
                                  title={u.can_create_events !== false ? "Suspend event creation" : "Restore event creation"}
                                >
                                  {u.can_create_events !== false ? "Lock Events" : "Unlock Events"}
                                </button>

                                {u.is_premium ? (
                                  <button
                                    onClick={() => handleModerationAction(undefined, "revoke_premium", u.id)}
                                    className="text-[10px] bg-slate-900 border border-slate-800 text-amber-400 hover:bg-amber-500/10 font-bold px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                                    title="Downgrade user from premium status"
                                  >
                                    Downgrade
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleModerationAction(undefined, "grant_premium", u.id)}
                                    className="text-[10px] bg-slate-900 border border-slate-800 text-teal-400 hover:bg-teal-500/10 font-bold px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                                    title="Upgrade user to premium plan"
                                  >
                                    Upgrade Premium
                                  </button>
                                )}

                                {u.is_banned ? (
                                  <button
                                    onClick={() => handleModerationAction(undefined, "unban_user", u.id)}
                                    className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-400 transition-colors inline-flex items-center gap-1"
                                  >
                                    <RotateCcw size={10} />
                                    Unban
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleModerationAction(undefined, "ban_user", u.id)}
                                    className="text-[10px] bg-slate-900 border border-slate-800 text-red-450 hover:bg-red-550/10 font-bold px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                                  >
                                    <UserMinus size={10} />
                                    Ban
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Users Pagination */}
            {totalUsers > userLimit && (
              <div className="flex items-center justify-between mt-4 bg-slate-900/10 border border-slate-900/60 p-3 rounded-2xl">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {(userPage - 1) * userLimit + 1} - {Math.min(userPage * userLimit, totalUsers)} of {totalUsers} users
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={userPage === 1}
                    onClick={() => {
                      const prev = userPage - 1;
                      setUserPage(prev);
                      loadUsersDirectory(prev, userLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-350 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Previous
                  </button>
                  <button
                    disabled={userPage * userLimit >= totalUsers}
                    onClick={() => {
                      const next = userPage + 1;
                      setUserPage(next);
                      loadUsersDirectory(next, userLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-350 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 3: LISTING DIRECTORY
            ===================================================================== */}
        {activeTab === "listings" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-100">Listing Directory</h2>
              <p className="text-xs text-slate-500 mt-1">Audit listing status details and force-remove or relist any donations manually.</p>
            </div>

            {/* Search & Limit Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative w-full sm:max-w-md listing-search-container">
                <Search size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by listing title..."
                  value={listingSearch}
                  onChange={(e) => {
                    setListingSearch(e.target.value);
                    setShowListingSuggestions(true);
                  }}
                  onFocus={() => {
                    if (listingSearch.trim().length >= 2) setShowListingSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setListingPage(1);
                      loadListingsDirectory(1, listingLimit);
                      setShowListingSuggestions(false);
                    }
                  }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500"
                />
                {showListingSuggestions && listingSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950/95 border border-slate-850 rounded-2xl p-2 shadow-2xl z-40 backdrop-blur-xl animate-in fade-in duration-150">
                    <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest px-3 py-1.5 pb-2 border-b border-slate-900">
                      Listing Search Matches
                    </div>
                    <div className="mt-1 space-y-0.5 max-h-52 overflow-y-auto">
                      {listingSuggestions.map((lst: any) => (
                        <button
                          key={lst.id}
                          onClick={() => {
                            setListingSearch(lst.title);
                            setListingPage(1);
                            setShowListingSuggestions(false);
                            // Directly fetch matching
                            setTimeout(() => {
                              fetch(`/api/admin/listings?adminId=${userId}&search=${encodeURIComponent(lst.title)}&page=1&limit=${listingLimit}`)
                                .then(r => r.json())
                                .then(d => {
                                  setListings(d.listings || []);
                                  setTotalListings(d.totalCount || 0);
                                });
                            }, 50);
                          }}
                          className="w-full text-left flex items-center gap-3.5 p-2 rounded-xl hover:bg-slate-900/60 transition-colors group/item"
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                            <img src={lst.images?.[0]} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-200 group-hover/item:text-teal-400 transition-colors block truncate">
                              {lst.title}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate capitalize">
                              {lst.category} • {lst.condition}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative w-full sm:w-48 shrink-0">
                <select
                  value={listingLimit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value);
                    setListingLimit(newLimit);
                    setListingPage(1);
                    loadListingsDirectory(1, newLimit);
                  }}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-355 focus:outline-none focus:border-teal-500 appearance-none"
                >
                  <option value={10}>10 items per page</option>
                  <option value={20}>20 items per page</option>
                  <option value={50}>50 items per page</option>
                  <option value={100}>100 items per page</option>
                </select>
                <SlidersHorizontal size={12} className="absolute right-3.5 top-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            {/* Listings Grid */}
            {loadingListings ? (
              <div className="text-center py-20 flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-teal-400" size={24} />
                <span className="text-xs text-slate-500">Fetching listings...</span>
              </div>
            ) : listings.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">No listings found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((item) => (
                  <div key={item.id} className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 flex gap-4 justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                        <img src={item.images?.[0]} alt="listing photo" className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-sm text-slate-100 truncate max-w-[200px]">{item.title}</h4>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Donor: <span className="font-bold text-slate-400">{item.donor?.name || "N/A"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            item.status === "available" ? "bg-teal-500/10 text-teal-400" :
                            item.status === "reserved" ? "bg-amber-500/10 text-amber-450" :
                            "bg-slate-850 text-slate-500"
                          }`}>
                            {item.status}
                          </span>
                          {item.admin_removed && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              Suspended
                            </span>
                          )}
                          {item.is_flagged && (
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Flagged
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.status !== "removed" ? (
                        <button
                          onClick={() => handleModerationAction(undefined, "remove_listing", undefined, item.id)}
                          className="text-[10px] bg-slate-950 hover:bg-red-550/10 border border-slate-900 hover:border-red-500/30 text-red-400 font-bold px-2.5 py-1.5 rounded-xl transition-all"
                        >
                          Suspend Listing
                        </button>
                      ) : (
                        <button
                          onClick={() => handleModerationAction(undefined, "approve_appeal", undefined, item.id)}
                          className="text-[10px] bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-2.5 py-1.5 rounded-xl transition-all shadow-lg shadow-teal-500/5"
                        >
                          Relist Item
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Listings Pagination */}
            {totalListings > listingLimit && (
              <div className="flex items-center justify-between mt-4 bg-slate-900/10 border border-slate-900/60 p-3 rounded-2xl">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {(listingPage - 1) * listingLimit + 1} - {Math.min(listingPage * listingLimit, totalListings)} of {totalListings} listings
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={listingPage === 1}
                    onClick={() => {
                      const prev = listingPage - 1;
                      setListingPage(prev);
                      loadListingsDirectory(prev, listingLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-350 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Previous
                  </button>
                  <button
                    disabled={listingPage * listingLimit >= totalListings}
                    onClick={() => {
                      const next = listingPage + 1;
                      setListingPage(next);
                      loadListingsDirectory(next, listingLimit);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-350 hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 4: CONFIGURATION SETTINGS
            ===================================================================== */}
        {activeTab === "settings" && (
          <div className="max-w-xl bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-100">System Configurations</h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">Modify default rules, limitations, and threshold limits dynamically.</p>
            </div>

            {loadingSettings ? (
              <div className="py-10 text-center flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-teal-400" size={20} />
                <span className="text-xs text-slate-500">Loading configurations...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-5">
                {/* Monthly Claim Limit */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Monthly Claim Limit
                  </label>
                  <input
                    type="number"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">The total number of free listings a regular account can claim each month.</p>
                </div>

                {/* Grace Period Hours */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Grace Warning Period (Hours)
                  </label>
                  <input
                    type="number"
                    value={gracePeriod}
                    onChange={(e) => setGracePeriod(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">The time in hours allowed to edit mild-flagged items before automatic removal.</p>
                </div>

                {/* Auto Appeal Trust Threshold */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Auto-Appeal Trust Score Threshold
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={trustThreshold}
                    onChange={(e) => setTrustThreshold(e.target.value)}
                    required
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Minimum user trust score (★) needed to support instant listing auto-restores during appeal.</p>
                </div>

                {/* 30-Day Welcome Trial Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-800 rounded-2xl">
                  <div className="space-y-0.5 max-w-[80%]">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      30-Day Welcome Trial Pass
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-relaxed">
                      Enable 30 days of unlimited claims for newly registered neighbor profiles automatically.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWelcomeTrialEnabled(!welcomeTrialEnabled)}
                    className="text-teal-450 hover:text-teal-350 transition-colors shrink-0"
                  >
                    {welcomeTrialEnabled ? (
                      <ToggleRight size={36} strokeWidth={1.5} />
                    ) : (
                      <ToggleLeft size={36} strokeWidth={1.5} className="text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Analytics & Monetization Header */}
                <div className="pt-4 border-t border-slate-900">
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider mb-3">Analytics & Ads Integrations</h3>
                </div>

                {/* Google Analytics ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Google Analytics ID (GTAG)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. G-XXXXXXXXXX"
                    value={gaMeasurementId}
                    onChange={(e) => setGaMeasurementId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Google Analytics Measurement ID to track site visits and engagement behavior dynamically.</p>
                </div>

                {/* Google AdSense ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Google AdSense Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ca-pub-XXXXXXXXXXXXXXXX"
                    value={adsenseClientId}
                    onChange={(e) => setAdsenseClientId(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Google AdSense Publisher/Client ID to load third-party display advertisements dynamically.</p>
                </div>

                {/* Campaign Settings Header */}
                <div className="pt-4 border-t border-slate-900">
                  <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider mb-3">Promotional Campaign Settings</h3>
                </div>

                {/* Campaign Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                    Campaign Type
                  </label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="none">None (Regular Claims Cap)</option>
                    <option value="unlimited">Unlimited (Free for All)</option>
                    <option value="custom">Custom Limit (Override Monthly Limit)</option>
                  </select>
                  <p className="text-[10px] text-slate-500">Select standard default, unlimited free claims, or a custom monthly promotion cap.</p>
                </div>

                {/* Campaign Name */}
                {campaignType !== "none" && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Joy of Giving Week"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      required={campaignType !== "none"}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                    <p className="text-[10px] text-slate-500">The promotional campaign banner text displayed to users on the feed.</p>
                  </div>
                )}

                {/* Campaign Limit */}
                {campaignType === "custom" && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      Campaign Limit
                    </label>
                    <input
                      type="number"
                      value={campaignLimit}
                      onChange={(e) => setCampaignLimit(e.target.value)}
                      required={campaignType === "custom"}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-500">The customized maximum claims count limit applied to all users during campaign active period.</p>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg transition-all"
                >
                  {savingSettings ? "Saving Settings..." : "Save System Configs"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 5: NGO APPLICATIONS
            ===================================================================== */}
        {activeTab === "ngos" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-100">Charity Verifications</h2>
                <p className="text-xs text-slate-500 mt-1 font-sans">Audit and approve verification documentations from local NGOs.</p>
              </div>

              {/* Application Status Tabs */}
              <div className="flex bg-slate-900/40 p-1 rounded-xl border border-slate-900 shrink-0 gap-1 text-[11px] font-bold">
                <button
                  onClick={() => { setNgoAppStatusFilter("pending"); loadNgoApplications("pending"); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    ngoAppStatusFilter === "pending" ? "bg-teal-500 text-slate-950" : "text-slate-455 hover:text-slate-200"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => { setNgoAppStatusFilter("approved"); loadNgoApplications("approved"); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    ngoAppStatusFilter === "approved" ? "bg-teal-500 text-slate-950" : "text-slate-455 hover:text-slate-200"
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => { setNgoAppStatusFilter("rejected"); loadNgoApplications("rejected"); }}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    ngoAppStatusFilter === "rejected" ? "bg-teal-500 text-slate-950" : "text-slate-455 hover:text-slate-200"
                  }`}
                >
                  Declined
                </button>
              </div>
            </div>

            {loadingNgoApps ? (
              <div className="text-center py-20 flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-teal-400" size={24} />
                <span className="text-xs text-slate-500">Loading applications...</span>
              </div>
            ) : ngoApps.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl">
                <CheckCircle2 className="mx-auto text-slate-700 mb-3" size={36} />
                <p className="text-sm font-bold text-slate-400">All caught up!</p>
                <p className="text-xs text-slate-600 mt-1">No charity applications found in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ngoApps.map((app) => (
                  <div key={app.userId} className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-4">
                    <div className="flex justify-between items-start gap-3 border-b border-slate-900/60 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-200 text-sm">{app.org_name}</h4>
                        <span className="text-[10px] text-slate-500 block">Submitted: {new Date(app.submitted_at).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[9px] font-extrabold uppercase bg-teal-500/5 text-teal-400 border border-teal-500/10 px-2 py-0.5 rounded">
                        ID: {app.darpan_id || "No Darpan ID"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-350 font-mono">
                      <div><span className="text-slate-500 font-sans font-bold">REGISTRATION #:</span> {app.registration_number}</div>
                      <div><span className="text-slate-500 font-sans font-bold">APPLICANT EMAIL:</span> {app.email}</div>
                      <div className="pt-2 font-sans text-slate-400 italic">"{app.user_description || "No mission description provided."}"</div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-900/60">
                      <a
                        href={app.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850 px-3.5 py-2 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <FileText size={12} />
                        View Certificate
                      </a>

                      {ngoAppStatusFilter === "pending" && (
                        <>
                          <button
                            disabled={actionLoadingNgoId !== null}
                            onClick={() => handleNgoAction(app.userId, "approve")}
                            className="text-[10px] bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1 transition-colors ml-auto shadow-lg shadow-teal-500/5"
                          >
                            <Check size={12} strokeWidth={3} />
                            Approve
                          </button>
                          
                          <button
                            disabled={actionLoadingNgoId !== null}
                            onClick={() => setRejectingNgoUserId(app.userId)}
                            className="text-[10px] bg-slate-900 border border-slate-850 hover:bg-red-500/10 text-red-400 font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1 transition-colors"
                          >
                            <X size={12} />
                            Reject
                          </button>
                        </>
                      )}
                    </div>

                    {rejectingNgoUserId === app.userId && (
                      <div className="pt-3 border-t border-red-500/20 space-y-2 animate-in slide-in-from-top-1 duration-150">
                        <textarea
                          placeholder="Provide rejection reason..."
                          value={ngoRejectReason}
                          onChange={(e) => setNgoRejectReason(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-950/60 border border-red-550/30 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-red-500"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setRejectingNgoUserId(null)}
                            className="text-[10px] text-slate-450 hover:text-slate-200 px-3 py-1.5"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleNgoAction(app.userId, "reject", ngoRejectReason)}
                            className="text-[10px] bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg"
                          >
                            Confirm Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* =====================================================================
            TAB 6: PLATFORM ANALYTICS DASHBOARD
            ===================================================================== */}
        {activeTab === "analytics" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-100">Dashboard Analytics</h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">Interactive metrics showing system transaction velocity and category demands.</p>
            </div>

            {loadingAnalytics ? (
              <div className="text-center py-20 flex justify-center items-center gap-2">
                <Loader2 className="animate-spin text-teal-400" size={24} />
                <span className="text-xs text-slate-500">Compiling database metrics...</span>
              </div>
            ) : !analytics ? (
              <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl">
                <ShieldAlert className="mx-auto text-slate-700 mb-3" size={36} />
                <p className="text-sm font-bold text-slate-400">Failed to load statistics</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Cards Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Users */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-1.5 shadow-md">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Neighbors</span>
                    <span className="text-2xl font-black text-slate-100 font-mono block">{analytics.totalUsers}</span>
                  </div>

                  {/* Landfill Diversion Rate */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-1.5 shadow-md relative overflow-hidden">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Diversion Rate</span>
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl font-black text-teal-400 font-mono block">
                        {analytics.totalListings > 0 
                          ? Math.round((analytics.completedListings / analytics.totalListings) * 100)
                          : 0}%
                      </span>
                      <span className="text-[9px] text-slate-500 leading-none">items saved from landfills</span>
                    </div>
                  </div>

                  {/* Total Listed */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-1.5 shadow-md">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Shared Items</span>
                    <span className="text-2xl font-black text-slate-100 font-mono block">{analytics.totalListings}</span>
                  </div>

                  {/* Avg Pickup Time */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-1.5 shadow-md">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Avg. Fulfillment</span>
                    <span className="text-2xl font-black text-violet-400 font-mono block">
                      {analytics.averageFulfillmentHours > 0 
                        ? `${analytics.averageFulfillmentHours} hrs`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Distributions Progress Bars */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 sm:p-6 space-y-4">
                    <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">Item Category Distributions</h3>
                    
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                      {Object.keys(analytics.categoryDistribution || {}).length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-10 text-center">No categories registered yet.</p>
                      ) : (
                        Object.entries(analytics.categoryDistribution).map(([category, count]: any) => {
                          const percent = Math.min(100, Math.round((count / analytics.totalListings) * 100)) || 0;
                          return (
                            <div key={category} className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                <span>{category}</span>
                                <span className="text-teal-400">{count} ({percent}%)</span>
                              </div>
                              <div className="w-full bg-slate-950/60 rounded-full h-1.5 border border-slate-900/60 overflow-hidden">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full"
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 7-Day Upload Trend Area Chart */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 sm:p-6 space-y-4">
                    <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">7-Day Listing Upload Trends</h3>

                    {Array.isArray(analytics.uploadTrends) && analytics.uploadTrends.length > 0 ? (
                      (() => {
                        const trends = analytics.uploadTrends;
                        const maxCount = Math.max(...trends.map((t: any) => t.count), 5);
                        const width = 500;
                        const height = 150;
                        
                        const points = trends.map((t: any, idx: number) => {
                          const x = (idx / (trends.length - 1)) * (width - 40) + 20;
                          const y = height - (t.count / maxCount) * (height - 40) - 20;
                          return { x, y, ...t };
                        });

                        const pathData = points.reduce((acc: string, p: any, idx: number) => {
                          return acc + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
                        }, "");

                        const areaData = pathData + ` L ${points[points.length - 1].x} ${height - 20} L ${points[0].x} ${height - 20} Z`;

                        return (
                          <div className="pt-2">
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                              <defs>
                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25"/>
                                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.00"/>
                                </linearGradient>
                              </defs>
                              
                              {/* Draw Area */}
                              <path d={areaData} fill="url(#areaGrad)" />
                              
                              {/* Draw Line */}
                              <path d={pathData} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              
                              {/* Draw Points */}
                              {points.map((p: any, idx: number) => (
                                <g key={idx} className="group cursor-pointer">
                                  <circle cx={p.x} cy={p.y} r="4" className="fill-emerald-400 stroke-slate-950 stroke-2" />
                                  <text x={p.x} y={p.y - 10} textAnchor="middle" className="text-[10px] font-mono fill-teal-400 font-extrabold select-none opacity-0 group-hover:opacity-100 transition-opacity">
                                    {p.count}
                                  </text>
                                </g>
                              ))}

                              {/* X Axis Labels */}
                              {points.map((p: any, idx: number) => (
                                <text key={`lbl-${idx}`} x={p.x} y={height - 2} textAnchor="middle" className="text-[8px] font-extrabold fill-slate-500 font-sans uppercase">
                                  {p.date}
                                </text>
                              ))}
                            </svg>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-xs text-slate-500 italic py-10 text-center">No trend details loaded.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* =====================================================================
            TAB 7: GLOBAL ALERT BROADCAST PANEL
            ===================================================================== */}
        {activeTab === "broadcast" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-xl font-black text-slate-100">Global Alert Broadcast</h2>
              <p className="text-xs text-slate-500 mt-1">Send immediate push notifications and in-app alerts to your users.</p>
            </div>

            <form onSubmit={handleBroadcast} className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-5 max-w-2xl">
              {/* Target Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Target Audience</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      value="all"
                      checked={broadcastTargetType === "all"}
                      onChange={() => setBroadcastTargetType("all")}
                      className="accent-teal-500"
                    />
                    All Registered Users
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      value="city"
                      checked={broadcastTargetType === "city"}
                      onChange={() => setBroadcastTargetType("city")}
                      className="accent-teal-500"
                    />
                    Specific City
                  </label>
                </div>
              </div>

              {/* City Input (If targeting specific city) */}
              {broadcastTargetType === "city" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Target City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Patna, Delhi, Mumbai"
                    value={broadcastCity}
                    onChange={(e) => setBroadcastCity(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Notification Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FreeShare Bihar Campaign"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Notification Body */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Alert Content (Body)</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter the alert details to send to user devices..."
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              {/* Redirection Link */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Redirection Path (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. /events or /dashboard (defaults to /)"
                  value={broadcastLink}
                  onChange={(e) => setBroadcastLink(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Submit Broadcast */}
              <button
                type="submit"
                disabled={broadcasting}
                className="w-full sm:w-auto inline-flex items-center justify-center bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {broadcasting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={14} />
                    Broadcasting Alerts...
                  </>
                ) : (
                  <>
                    <Send className="mr-2" size={14} />
                    Send Broadcast Alert
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

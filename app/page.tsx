"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Search, Filter, Plus, User as UserIcon, LogOut, Loader2, Sparkles, MapPin, Grid, MessageSquare, Gift, AlertCircle, Bell, CheckCircle } from "lucide-react";
import dynamic from "next/dynamic";
import LocationPickerModal from "@/components/LocationPickerModal";
import { getTranslation, Language } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";

const ProximityMap = dynamic(() => import("@/components/ProximityMap"), {
  ssr: false,
});

const CATEGORIES = [
  "All", "Furniture", "Electronics", "Books", "Clothing", "Toys", 
  "Kitchen", "Appliances", "Sports", "Office", "Miscellaneous"
];

const CONDITIONS = ["All", "Like New", "Good", "Fair", "Needs Repair"];

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "new_claim":
      return <Gift className="w-4 h-4 text-teal-400" />;
    case "claim_accepted":
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case "new_message":
      return <MessageSquare className="w-4 h-4 text-blue-400" />;
    case "account_warning":
    case "listing_removed":
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400" />;
  }
};

export default function HomeFeed() {
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("All");

  // Geolocation & Proximity States
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState("All");
  const [detectingCoords, setDetectingCoords] = useState(false);

  // Advanced Location Picker States
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  // Premium Usage & Notifications
  const [claimCount, setClaimCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Translation Locale State
  const [lang, setLang] = useState<Language>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("freeshare_locale") as Language;
    if (stored) setLang(stored);

    const handleLanguageChange = () => {
      const updated = localStorage.getItem("freeshare_locale") as Language;
      if (updated) setLang(updated);
    };
    window.addEventListener("languageChanged", handleLanguageChange);
    return () => window.removeEventListener("languageChanged", handleLanguageChange);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-menu-container") && !target.closest(".notifications-container")) {
        setShowUserMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const t = (key: any) => getTranslation(key, lang);

  // Campaign & Limit States
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);

  const getUserData = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      // Query profile to get latest bio (custom claim limit overrides) and claim count
      const { data: profile } = await supabase
        .from("users")
        .select("id, email, name, is_admin, is_premium, is_ngo, bio, monthly_claim_count, created_at")
        .eq("id", authData.user.id)
        .single();

      setUser(profile || authData.user);
      setClaimCount(profile?.monthly_claim_count ?? authData.user.user_metadata?.monthly_claim_count ?? 0);

      // Check if welcome trial is enabled globally
      try {
        const settingsRes = await fetch("/api/admin/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.welcome_trial_enabled !== false && profile?.created_at) {
            const createdDate = new Date(profile.created_at);
            const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const remaining = 30 - diffDays;
            setTrialDaysLeft(remaining > 0 ? remaining : 0);
          } else {
            setTrialDaysLeft(0);
          }
        }
      } catch {
        setTrialDaysLeft(0);
      }
    }
  };

  const getClaimLimitLabel = () => {
    if (trialDaysLeft > 0) return "Unlimited";
    if (!systemSettings) return "";

    // 1. Check user override limit
    let customLimit: number | undefined = undefined;
    if (user?.bio) {
      try {
        const parsedBio = JSON.parse(user.bio);
        if (parsedBio && typeof parsedBio === "object" && !Array.isArray(parsedBio)) {
          customLimit = parsedBio.custom_claim_limit;
        }
      } catch {}
    }

    if (customLimit !== undefined) {
      if (customLimit === -1) return "Unlimited";
      return String(customLimit);
    }

    // 2. Check active campaign
    if (activeCampaign) {
      if (activeCampaign.campaign_type === "unlimited") {
        return "Unlimited";
      } else if (activeCampaign.campaign_type === "custom") {
        return String(activeCampaign.campaign_limit);
      }
    }

    // 3. Fallback to default
    return String(systemSettings.monthly_claim_limit ?? 10);
  };

  useEffect(() => {
    const initializeData = async () => {
      // Fetch settings first
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          setSystemSettings(data);
          if (data.campaign_type && data.campaign_type !== "none") {
            setActiveCampaign(data);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
      
      // Then fetch user data
      await getUserData();
    };

    initializeData();
  }, []);



  useEffect(() => {
    if (!user) return;

    fetchNotifications(user.id);

    // Subscribe to new notifications in real-time
    const notifChannel = supabase
      .channel(`realtime_notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotif = payload.new;
          if (newNotif.user_id !== user.id) return;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [user]);

  const fetchNotifications = async (uid: string) => {
    try {
      const res = await fetch(`/api/notifications?userId=${uid}`);
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Notifications fetch error:", err);
    }
  };

  const markNotificationsRead = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error("Mark notifications read error:", err);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Clear notifications error:", err);
    }
  };

  // Handles requesting geolocation coordinates on radius filter selection
  const handleRadiusChange = (radiusVal: string) => {
    setSelectedRadius(radiusVal);
    if (radiusVal !== "All" && !userCoords) {
      setDetectingCoords(true);

      const fallbackToIP = async () => {
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          if (data.latitude && data.longitude) {
            setUserCoords({ lat: data.latitude, lng: data.longitude });
          } else {
            setUserCoords({ lat: 28.6139, lng: 77.209 });
          }
        } catch {
          setUserCoords({ lat: 28.6139, lng: 77.209 });
        }
        setDetectingCoords(false);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setDetectingCoords(false);
          },
          () => {
            console.warn("Browser geolocation unavailable, falling back to IP-based detection");
            fallbackToIP();
          },
          { timeout: 5000 }
        );
      } else {
        fallbackToIP();
      }
    }
  };

  // Load saved location on mount
  useEffect(() => {
    const loc = localStorage.getItem("user_selected_location");
    if (loc) {
      try {
        const parsed = JSON.parse(loc);
        setSelectedLocation(parsed);
        if (parsed.lat && parsed.lng) {
          setUserCoords({ lat: parsed.lat, lng: parsed.lng });
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Pre-fill location from logged-in user profile if no manual selection is stored
  useEffect(() => {
    if (!user || selectedLocation) return;
    const userCity = user.user_metadata?.city;
    const userArea = user.user_metadata?.area;
    const userPincode = user.user_metadata?.pincode;

    if (userCity || userPincode) {
      const defaultLoc = {
        display_name: `${userArea ? `${userArea}, ` : ""}${userCity || ""}${userPincode ? ` (${userPincode})` : ""}`,
        city: userCity || "",
        postcode: userPincode || "",
        lat: 28.6139, // Default coordinates center
        lng: 77.209,
      };
      setSelectedLocation(defaultLoc);
      localStorage.setItem("user_selected_location", JSON.stringify(defaultLoc));
    }
  }, [user, selectedLocation]);

  const handleSelectLocation = (loc: any) => {
    setSelectedLocation(loc);
    localStorage.setItem("user_selected_location", JSON.stringify(loc));
    if (loc.lat && loc.lng) {
      setUserCoords({ lat: loc.lat, lng: loc.lng });
    } else {
      setUserCoords(null);
    }
  };

  // Fetch listings on filter change
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (searchTerm) queryParams.set("search", searchTerm);
        if (selectedCategory) queryParams.set("category", selectedCategory);
        if (selectedCondition) queryParams.set("condition", selectedCondition);
        
        if (userCoords && selectedRadius !== "All") {
          queryParams.set("latitude", userCoords.lat.toString());
          queryParams.set("longitude", userCoords.lng.toString());
          queryParams.set("radius", selectedRadius);
        } else if (selectedLocation) {
          if (selectedLocation.postcode) {
            queryParams.set("pincode", selectedLocation.postcode);
          } else if (selectedLocation.city) {
            queryParams.set("city", selectedLocation.city);
          }
        }

        const res = await fetch(`/api/listings?${queryParams.toString()}`);
        const data = await res.json();
        setListings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load listings:", err);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search query to prevent continuous API calls
    const delayDebounceFn = setTimeout(() => {
      fetchListings();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory, selectedCondition, userCoords, selectedRadius, selectedLocation]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    setUser(null);
    window.location.reload();
  };

  const trendingListings = [...listings]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 4);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-teal-500 selection:text-black">
      
      {/* Navigation Navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent select-none">
              {t("app_title")}
            </span>
            
            {/* Location selector trigger button */}
            <button
              onClick={() => setShowLocationPicker(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-slate-350 hover:text-teal-400 transition-all max-w-[160px] sm:max-w-[220px] shadow-inner"
            >
              <MapPin size={12} className="text-teal-400 shrink-0" />
              <span className="truncate">
                {selectedLocation ? selectedLocation.display_name.split(",")[0] : "Select Location"}
              </span>
              <span className="text-[8px] text-slate-500 font-normal">▼</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            {user ? (
              <>
                {/* Supporter Badge */}
                {user.user_metadata?.is_premium ? (
                  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/20 text-xs text-teal-400 font-bold shadow-sm shadow-teal-500/5">
                    <span>🌟 Supporter</span>
                  </div>
                ) : (
                  <div
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-medium"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span>
                      {trialDaysLeft > 0 || getClaimLimitLabel() === "Unlimited"
                        ? `🎁 ${claimCount} items claimed`
                        : `🎁 ${claimCount} of ${getClaimLimitLabel()} free items claimed`}
                    </span>
                  </div>
                )}
                      {/* Real-time Notifications Bell Dropdown */}
                <div className="relative notifications-container">
                  <button
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      if (!showNotifications && unreadCount > 0) {
                        markNotificationsRead();
                      }
                    }}
                    className="relative p-2 hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-slate-950 animate-pulse" />
                    )}
                  </button>

                  {/* Dropdown Box Panel */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 z-50">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-100 font-sans">Recent Alerts</span>
                        <div className="flex gap-2.5">
                          {unreadCount > 0 && (
                            <button
                              onClick={markNotificationsRead}
                              className="text-[10px] text-teal-600 hover:text-teal-500 font-semibold"
                            >
                              Mark read
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              onClick={clearAllNotifications}
                              className="text-[10px] text-red-500 hover:text-red-650 font-semibold"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2.5">
                        {notifications.length === 0 ? (
                          <p className="text-[10px] text-slate-400 text-center py-4">No recent alerts found.</p>
                        ) : (
                          notifications.map((n) => (
                            <Link
                              key={n.id}
                              href={n.link || "/dashboard"}
                              onClick={() => setShowNotifications(false)}
                              className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors ${
                                n.is_read ? "hover:bg-slate-950" : "bg-teal-500/10 hover:bg-teal-500/20 border-l-2 border-teal-500"
                              }`}
                            >
                              <div className="mt-0.5 shrink-0 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-slate-350">
                                {getNotificationIcon(n.type)}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p className="text-[11px] font-bold text-slate-100 line-clamp-1">{n.title}</p>
                                <p className="text-[10px] text-slate-350 line-clamp-2 leading-relaxed">{n.body}</p>
                                <span className="text-[8px] text-slate-400 block mt-1">{formatTimeAgo(n.created_at)}</span>
                              </div>
                              {!n.is_read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0 animate-pulse" />
                              )}
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Dropdown Menu */}
                <div className="relative user-menu-container">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-850"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 font-extrabold text-xs shadow-inner">
                      {user.name ? user.name[0].toUpperCase() : <UserIcon size={14} />}
                    </div>
                  </button>

                  {showUserMenu && (() => {
                    const getReferralStats = (bioString: string) => {
                      try {
                        const parsed = JSON.parse(bioString);
                        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                          const referred = Array.isArray(parsed.referred_users) ? parsed.referred_users : [];
                          return {
                            referredCount: referred.length,
                            bonusClaims: referred.length * 2
                          };
                        }
                      } catch {}
                      return { referredCount: 0, bonusClaims: 0 };
                    };

                    const { referredCount, bonusClaims } = getReferralStats(user.bio || "");
                    const refCode = `REF-${user.id.substring(0, 8).toUpperCase()}`;
                    const refLink = typeof window !== "undefined" ? `${window.location.origin}/register?ref=${user.id}` : "";

                    return (
                      <div className="absolute right-0 mt-3 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* User Summary Header */}
                        <Link
                          href={`/profile/${user.id}`}
                          onClick={() => setShowUserMenu(false)}
                          className="border-b border-slate-800 pb-3 flex items-center gap-3 group/header hover:opacity-90 transition-opacity block"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 font-black text-sm group-hover/header:border-teal-500/40 transition-colors">
                            {user.name ? user.name[0].toUpperCase() : <UserIcon size={16} />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-100 truncate group-hover/header:text-teal-600 transition-colors">{user.name || "User"}</h4>
                            <p className="text-[10px] text-slate-350 truncate">{user.email}</p>
                          </div>
                        </Link>
                        
                        {/* Navigation Options */}
                        <div className="space-y-1">
                          <Link
                            href={`/profile/${user.id}`}
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-teal-600 hover:bg-slate-950 transition-all font-semibold"
                          >
                            <UserIcon size={14} className="text-slate-400" />
                            <span>View Profile</span>
                          </Link>
                          <Link
                            href="/dashboard"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-teal-600 hover:bg-slate-950 transition-all font-semibold"
                          >
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>
                            <span>Dashboard</span>
                          </Link>
                          <Link
                            href="/donate"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-teal-600 hover:bg-slate-950 transition-all font-semibold"
                          >
                            <Plus size={14} className="text-slate-400" />
                            <span>Donate an Item</span>
                          </Link>
                        </div>

                        {/* Expandable Invite & Earn Block */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-extrabold text-slate-100 flex items-center gap-1.5">
                              🎁 Invite & Earn
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            </span>
                            <span className="text-slate-350 font-medium">Invites: <strong className="text-teal-600">{referredCount}</strong></span>
                          </div>
                          
                          <div className="text-[10px] text-slate-350 leading-normal">
                            Get <strong className="text-teal-600 font-bold">+2 claims</strong> for each friend referred.
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                readOnly
                                value={refLink}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[9px] text-slate-150 focus:outline-none select-all"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(refLink);
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 2000);
                                }}
                                className="bg-slate-900 hover:bg-slate-850 text-slate-100 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold transition-all shrink-0 cursor-pointer"
                              >
                                {copied ? "Copied" : "Copy"}
                              </button>
                            </div>
                            
                            <a
                              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                `Hey! Check out FreeShare India to claim free pre-loved goods in your city! Sign up using my link: ${refLink} or use referral code ${refCode}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-[#25D366] hover:bg-[#20ba59] text-black font-extrabold py-1 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all text-[9.5px] cursor-pointer text-center"
                            >
                              Share Invite
                            </a>
                          </div>
                        </div>

                        {/* Logout Option */}
                        <div className="border-t border-slate-800 pt-2 pb-1">
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              handleLogout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-500/10 transition-all font-semibold text-left cursor-pointer"
                          >
                            <LogOut size={14} />
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Active Campaign Banner */}
      {activeCampaign && (
        <div className="max-w-7xl mx-auto px-4 pt-4 animate-in slide-in-from-top-2 duration-300">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-500/10 border border-teal-500/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-teal-500/5 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 animate-pulse">
                <Sparkles size={18} />
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  🎉 {activeCampaign.campaign_name || "Special Campaign Active!"}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  {activeCampaign.campaign_type === "unlimited"
                    ? "Enjoy unlimited claims! Free for everyone, with no limits on sharing items."
                    : `Claim limits expanded to ${activeCampaign.campaign_limit} items this month!`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Hero Banner Section */}
      <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-6 text-center sm:text-left">
        <div className="absolute top-10 left-10 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Find Free Items <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Nearby</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-md">
              Reduce landfill waste. Declutter your home. Help your neighbors inside India's free sharing hub.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1 group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 group-focus-within:text-teal-400 transition-colors">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder={t("search_placeholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800/80 rounded-2xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/80 transition-all"
            />
          </div>

          {/* Condition Select Option */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800/80 rounded-2xl px-3 py-2">
            <span className="text-slate-500 text-xs pl-1">Condition:</span>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none text-slate-200 cursor-pointer [color-scheme:dark]"
            >
              {CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>{cond}</option>
              ))}
            </select>
          </div>

          {/* Distance Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800/80 rounded-2xl px-3 py-2">
            <span className="text-slate-500 text-xs pl-1">Distance:</span>
            <select
              value={selectedRadius}
              onChange={(e) => handleRadiusChange(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none text-slate-200 cursor-pointer [color-scheme:dark]"
              disabled={detectingCoords}
            >
              <option value="All">Anywhere</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
            {detectingCoords && <Loader2 className="animate-spin text-teal-400 w-3 h-3 ml-1" />}
          </div>
        </div>

        {/* Category horizontal scrolling bar */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar scroll-smooth">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? "bg-teal-500/10 border-teal-500/40 text-teal-400"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      {/* Proximity Map Section */}
      {selectedRadius !== "All" && userCoords && (
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <ProximityMap listings={listings} userLocation={userCoords} />
        </div>
      )}

      {/* Grid listing content */}
      <div className="max-w-7xl mx-auto px-4 mt-6 space-y-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-teal-400" size={36} />
            <p className="text-sm text-slate-500">Scanning local neighborhood...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl">
            <Grid className="mx-auto text-slate-700 mb-4" size={40} />
            <p className="text-base font-bold text-slate-400">{t("no_items_found")}</p>
            <p className="text-xs text-slate-600 mt-1">{t("no_items_desc")}</p>
          </div>
        ) : (
          <>
            {/* Trending Items Section */}
            {trendingListings.length > 0 && !searchTerm && selectedCategory === "All" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <Sparkles size={16} className="text-teal-400" />
                    {t("trending_items")}
                  </h2>
                  <span className="text-[10px] text-slate-500 font-semibold">Most viewed nearby</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {trendingListings.map((item) => (
                    <Link
                      key={`trending-${item.id}`}
                      href={`/listing/${item.id}`}
                      className="group bg-slate-900/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all hover:scale-[1.01] hover:-translate-y-0.5"
                    >
                      <div className="aspect-square relative overflow-hidden bg-slate-950">
                        <img
                          src={item.images?.[0]}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 text-[8px] sm:text-[9px] font-extrabold uppercase px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-black/60 backdrop-blur-md text-teal-400 tracking-wider">
                          {item.condition}
                        </span>
                      </div>
                      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1 sm:space-y-1.5">
                          <h3 className="font-bold text-[11px] sm:text-sm text-slate-100 group-hover:text-teal-400 transition-colors line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 hidden sm:block">
                            {item.description}
                          </p>
                        </div>
                        <div className="pt-2 sm:pt-4 mt-1.5 sm:mt-2 border-t border-slate-900/80 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500">
                          <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                            <MapPin size={10} className="shrink-0 text-slate-500" />
                            <span className="truncate max-w-[50px] sm:max-w-[80px]">{item.area}</span>
                            {item.distance_km !== undefined && item.distance_km !== null && (
                              <span className="text-[8px] sm:text-[9px] text-emerald-450 font-bold ml-1 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded-full shrink-0">
                                {item.distance_km} km
                              </span>
                            )}
                          </div>
                          <span className="shrink-0">🔥 {item.view_count || 0} <span className="hidden xs:inline">views</span></span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Fresh Listings Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider select-none">
                  {searchTerm || selectedCategory !== "All" ? "Filtered Results" : t("fresh_listings")}
                </h2>
                {selectedLocation && (
                  <span className="text-[10px] text-slate-500">
                    Showing items in {selectedLocation.city || "your area"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {listings.map((item) => (
                  <Link
                    key={item.id}
                    href={`/listing/${item.id}`}
                    className="group bg-slate-900/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all hover:scale-[1.01] hover:-translate-y-0.5"
                  >
                    <div className="aspect-square relative overflow-hidden bg-slate-950">
                      <img
                        src={item.images?.[0]}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 text-[8px] sm:text-[9px] font-extrabold uppercase px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-black/60 backdrop-blur-md text-teal-400 tracking-wider">
                        {item.condition}
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-1 sm:space-y-1.5">
                        <h3 className="font-bold text-[11px] sm:text-sm text-slate-100 group-hover:text-teal-400 transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 hidden sm:block">
                          {item.description}
                        </p>
                      </div>
                      <div className="pt-2 sm:pt-4 mt-1.5 sm:mt-2 border-t border-slate-900/80 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-500">
                        <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
                          <MapPin size={10} className="shrink-0 text-slate-500" />
                          <span className="truncate max-w-[50px] sm:max-w-[80px]">{item.area}</span>
                          {item.distance_km !== undefined && item.distance_km !== null && (
                            <span className="text-[8px] sm:text-[9px] text-emerald-450 font-bold ml-1 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded-full shrink-0">
                              {item.distance_km} km
                            </span>
                          )}
                        </div>
                        <span className="shrink-0">{new Date(item.created_at).toLocaleDateString(undefined, {month: "short", day: "numeric"})}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Location Picker Overlay Dialog */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={handleSelectLocation}
      />

    </div>
  );
}

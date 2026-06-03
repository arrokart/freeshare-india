"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Search, Filter, Plus, User as UserIcon, LogOut, Loader2, Sparkles, MapPin, Grid, MessageSquare, Gift, AlertCircle, Bell, CheckCircle, ArrowRight, Heart, Star, Smile, BookOpen, Smartphone, ShieldCheck, Award, Tv, Shirt, ToyBrick, Soup, Trophy, Quote, HeartHandshake } from "lucide-react";
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
  const [authLoading, setAuthLoading] = useState(true);

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
      setAuthLoading(true);
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
      try {
        await getUserData();
      } catch (err) {
        console.error(err);
      } finally {
        setAuthLoading(false);
      }
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-150 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Initializing FreeShare India...</p>
      </div>
    );
  }

  if (!user) {
    return <LandingPageView listings={listings} trendingListings={trendingListings} lang={lang} />;
  }

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

function LandingPageView({ listings, trendingListings, lang }: { listings: any[]; trendingListings: any[]; lang: Language }) {
  const t = (key: any) => getTranslation(key, lang);
  
  // Custom Smooth Scrolling helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const categories = [
    { name: "Furniture", icon: (
      <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h12M4 10h16M7 10v6m10-6v6M9 6h6m-7 12v2m8-2v2" />
      </svg>
    )},
    { name: "Electronics", icon: (
      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18V9a9 9 0 0118 0v9m-18 0a2 2 0 002 2h3a2 2 0 002-2V13a2 2 0 00-2-2H3m18 7a2 2 0 01-2 2h-3a2 2 0 01-2-2V13a2 2 0 012-2h3" />
      </svg>
    )},
    { name: "Books", icon: (
      <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { name: "Clothing", icon: (
      <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 0L14.828 12H9.172L9.172 9.172m5.656 0L18.364 5.636M9.172 9.172L5.636 5.636m0 0l3.536 3.536M12 12v9m-4-6h8" />
      </svg>
    )},
    { name: "Toys", icon: (
      <svg className="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="6" />
        <circle cx="8" cy="8" r="2" />
        <circle cx="16" cy="8" r="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v1m-2-1v.5a2 2 0 004 0v-.5" />
      </svg>
    )},
    { name: "Kitchen", icon: (
      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M4 8h16v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8zm0 4h16" />
      </svg>
    )},
    { name: "Sports", icon: (
      <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8" />
      </svg>
    )},
    { name: "Appliances", icon: (
      <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="6" r="1" />
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-teal-500 selection:text-black">
      {/* Sticky Navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent select-none flex items-center gap-1.5">
              <svg className="w-6 h-6 text-teal-400 fill-current" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 00-7.07 17.07L12 22l7.07-2.93A10 10 0 0012 2zm-1 14.5V13H8v-2h3V8.5a2.5 2.5 0 015 0V11h-2V8.5a.5.5 0 00-1 0V13h3v2h-3v1.5a.5.5 0 001 0v.5a1.5 1.5 0 01-3 0z" />
              </svg>
              {t("app_title")}
            </span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-[10px] font-bold text-slate-400 shadow-inner">
              <MapPin size={10} className="text-teal-400" />
              <span>Delhi</span>
              <span className="text-[7px]">▼</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-400">
            <button onClick={() => scrollToSection("how-it-works")} className="hover:text-teal-400 transition-colors cursor-pointer">How it Works</button>
            <button onClick={() => scrollToSection("explore-categories")} className="hover:text-teal-400 transition-colors cursor-pointer">Categories</button>
            <button onClick={() => scrollToSection("our-impact")} className="hover:text-teal-400 transition-colors cursor-pointer">Impact</button>
            <button onClick={() => scrollToSection("community-stories")} className="hover:text-teal-400 transition-colors cursor-pointer">Community</button>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link href="/login" className="text-xs font-bold text-slate-350 hover:text-teal-400 transition-colors px-3 py-2">
              Log in
            </Link>
            <Link href="/register" className="text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 px-4 py-2 rounded-xl transition-all shadow-md">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 pt-16 pb-12 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-emerald-400 tracking-wider uppercase">
              <Sparkles size={11} className="animate-pulse" />
              India's Free Sharing Network
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-slate-100">
              Give Things a <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 bg-clip-text text-transparent">Second Life</span> 🌱
            </h1>
            
            <p className="text-base text-slate-400 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Share what you don't need. <br className="xs:hidden" /> Find what you need for free. Build a better, greener community.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/10 active:scale-[0.98]">
                Start Sharing <ArrowRight size={14} />
              </Link>
              <button onClick={() => scrollToSection("available-items")} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-teal-400 hover:border-slate-700/80 font-bold text-xs uppercase tracking-wider px-7 py-3.5 rounded-xl transition-all cursor-pointer">
                <Search size={14} /> Browse Free Items
              </button>
            </div>

            {/* Avatars */}
            <div className="flex items-center justify-center lg:justify-start gap-3 pt-4 border-t border-slate-900/60 max-w-sm mx-auto lg:mx-0">
              <div className="flex -space-x-2">
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100" alt="User" />
              </div>
              <p className="text-[10px] text-slate-400 text-left">
                Join <strong className="text-slate-200 font-extrabold">12,000+</strong> people building a greener India 💚
              </p>
            </div>
          </div>

          {/* Hero Right Visual Column */}
          <div className="lg:col-span-6 flex justify-center items-center">
            <div className="relative w-full max-w-[420px] h-[360px] sm:h-[400px] flex items-center justify-center">
              {/* Circular backdrop glow */}
              <div className="absolute w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] bg-emerald-500/10 rounded-full blur-3xl -z-10" />
              
              {/* Modern Couch Backdrop Drawing */}
              <div className="absolute bottom-16 w-[310px] sm:w-[350px] h-[130px] sm:h-[150px] bg-teal-600/15 rounded-t-[40px] rounded-b-[20px] shadow-lg border border-teal-500/10 -z-10 flex flex-col justify-end p-4">
                <div className="w-full h-8 bg-slate-900 border-t border-slate-800 rounded-lg flex justify-around items-center opacity-80">
                  <div className="w-1.5 h-6 bg-slate-950 rounded-b" />
                  <div className="w-1.5 h-6 bg-slate-950 rounded-b" />
                </div>
              </div>
              
              {/* Cardboard Box */}
              <div className="absolute bottom-4 right-10 w-[110px] sm:w-[130px] h-[80px] sm:h-[90px] bg-amber-500/10 border-2 border-dashed border-amber-500/30 rounded-2xl flex flex-col justify-center items-center shadow-lg transform rotate-3 z-10">
                <Gift size={24} className="text-amber-500/80 animate-bounce" />
                <span className="text-[9px] font-black text-amber-500 mt-1 uppercase tracking-widest bg-amber-500/15 px-2 py-0.5 rounded-full">SHARE</span>
              </div>

              {/* Study Chair Card */}
              <div className="absolute top-4 right-2 w-[150px] sm:w-[170px] bg-slate-900 border border-slate-850 p-2.5 rounded-2xl shadow-xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 -rotate-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[10px] font-bold text-slate-100 truncate">Study Chair</h4>
                    <p className="text-[8px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> 2 km away</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-950 pt-2 text-[8px]">
                  <span className="font-extrabold uppercase text-emerald-450 bg-emerald-500/10 px-1.5 py-0.5 rounded">● Available</span>
                  <button className="text-slate-500 hover:text-red-500"><Heart size={9} className="fill-current" /></button>
                </div>
              </div>

              {/* Bicycle Card */}
              <div className="absolute top-28 left-2 w-[150px] sm:w-[170px] bg-slate-900 border border-slate-850 p-2.5 rounded-2xl shadow-xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 rotate-3 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[10px] font-bold text-slate-100 truncate">Bicycle</h4>
                    <p className="text-[8px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> 1.5 km away</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-950 pt-2 text-[8px]">
                  <span className="font-extrabold uppercase text-slate-450 bg-slate-800 px-1.5 py-0.5 rounded">✓ Claimed</span>
                  <button className="text-red-500"><Heart size={9} className="fill-current" /></button>
                </div>
              </div>

              {/* Books Card */}
              <div className="absolute bottom-20 right-2 w-[150px] sm:w-[170px] bg-slate-900 border border-slate-850 p-2.5 rounded-2xl shadow-xl transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 -rotate-1 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <BookOpen size={14} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[10px] font-bold text-slate-100 truncate">Books (Set of 8)</h4>
                    <p className="text-[8px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> 3 km away</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-950 pt-2 text-[8px]">
                  <span className="font-extrabold uppercase text-emerald-450 bg-emerald-500/10 px-1.5 py-0.5 rounded">● Available</span>
                  <button className="text-slate-500 hover:text-red-500"><Heart size={9} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Row Section */}
      <section className="bg-slate-900/40 border-y border-slate-900 py-10 my-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Items Shared</span>
              <span className="text-2xl sm:text-3xl font-black text-teal-400">12,000+</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Happy Members</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-200">3,200+</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cities Covered</span>
              <span className="text-2xl sm:text-3xl font-black text-slate-200">15+</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Waste Prevented</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">1.8 Tons</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 py-16 text-center scroll-mt-20">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
          How <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">FreeShare</span> Works?
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {/* Step 1 */}
          <div className="bg-slate-900 border border-slate-850 p-8 rounded-3xl space-y-4 hover:border-slate-750 transition-all flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/10 animate-pulse">
              <Smartphone size={24} />
            </div>
            <span className="inline-block text-[10px] font-black uppercase text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">1. List Item</span>
            <h3 className="font-bold text-slate-200 text-sm">Upload Pre-Loved Goods</h3>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Snap a picture, select a category, and post your item. It takes less than 60 seconds!
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900 border border-slate-850 p-8 rounded-3xl space-y-4 hover:border-slate-750 transition-all flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/10">
              <MessageSquare size={24} />
            </div>
            <span className="inline-block text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">2. Connect</span>
            <h3 className="font-bold text-slate-200 text-sm">Coordinate Nearby Pickup</h3>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Chat safely inside the application to verify details and set up a location for handoff.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-900 border border-slate-850 p-8 rounded-3xl space-y-4 hover:border-slate-750 transition-all flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-400 border border-violet-500/10">
              <Gift size={24} />
            </div>
            <span className="inline-block text-[10px] font-black uppercase text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">3. Exchange</span>
            <h3 className="font-bold text-slate-200 text-sm">Declutter & Help Neighbors</h3>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Meet up, pass along the item, earn reputation points, and reduce community waste!
            </p>
          </div>
        </div>
      </section>

      {/* Explore Popular Categories */}
      <section id="explore-categories" className="max-w-7xl mx-auto px-4 py-16 scroll-mt-20">
        <div className="flex justify-between items-end border-b border-slate-900 pb-3 mb-8">
          <h2 className="text-xl sm:text-2xl font-black text-slate-200">Explore Popular Categories</h2>
          <button onClick={() => scrollToSection("available-items")} className="text-xs font-bold text-teal-400 hover:underline flex items-center gap-1 cursor-pointer">
            View all categories <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4">
          {categories.map((cat) => (
            <Link key={cat.name} href="/register" className="bg-slate-900 border border-slate-850 hover:border-slate-750 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-inner text-center">
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-850 flex items-center justify-center">
                {cat.icon}
              </div>
              <span className="text-[10px] font-extrabold text-slate-350 uppercase tracking-wider">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Our Impact Together */}
      <section id="our-impact" className="max-w-7xl mx-auto px-4 py-12 scroll-mt-20">
        <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-500/10 border border-teal-500/20 rounded-3xl p-6 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-xl shadow-teal-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10" />
          
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left lg:max-w-md">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
              <HeartHandshake size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-200">Our Impact Together</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Small actions lead to massive ecological and community changes. Thank you for making a difference.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full lg:max-w-lg">
            <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex items-center gap-3 shadow-inner">
              <span className="text-xs">🌱</span>
              <div>
                <span className="text-xs text-slate-450 font-bold block">Waste Diverted</span>
                <span className="text-sm font-black text-slate-200">1.8 Tons</span>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex items-center gap-3 shadow-inner">
              <span className="text-xs">💨</span>
              <div>
                <span className="text-xs text-slate-450 font-bold block">CO2 Saved</span>
                <span className="text-sm font-black text-slate-200">650 kg</span>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex items-center gap-3 shadow-inner">
              <span className="text-xs">💧</span>
              <div>
                <span className="text-xs text-slate-450 font-bold block">Water Saved</span>
                <span className="text-sm font-black text-slate-200">15,000 Liters</span>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-2xl flex items-center gap-3 shadow-inner">
              <span className="text-xs">🤝</span>
              <div>
                <span className="text-xs text-slate-450 font-bold block">Successful Shares</span>
                <span className="text-sm font-black text-slate-200">8,500+</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badges & Stories Dual Grid */}
      <section id="community-stories" className="max-w-7xl mx-auto px-4 py-16 scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Reputation Badges Left */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-850 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="space-y-1 border-b border-slate-950 pb-3">
              <h3 className="text-sm font-extrabold uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                <Award size={15} className="text-teal-400" /> Earn Reputation Badges
              </h3>
              <p className="text-[10px] text-slate-400">Share items frequently to gain levels and recognition.</p>
            </div>
            <div className="space-y-3.5 pt-1.5">
              <div className="flex items-center gap-3 bg-slate-950/20 p-2.5 rounded-2xl border border-slate-850">
                <span className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs shrink-0">🌱</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-200">Green Starter</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">Awarded upon your first listed item.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-950/20 p-2.5 rounded-2xl border border-slate-850">
                <span className="w-7 h-7 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-xs shrink-0">♻️</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-200">Waste Warrior</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">Keep 5+ items out of local landfills.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-950/20 p-2.5 rounded-2xl border border-slate-850">
                <span className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs shrink-0">🌟</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-200">Eco Hero</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">Maintain a solid 4.8+ user feedback rating.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-950/20 p-2.5 rounded-2xl border border-slate-850">
                <span className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs shrink-0">🤝</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-200">Community Helper</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">Coordinate 10+ successful claims.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-950/20 p-2.5 rounded-2xl border border-slate-850">
                <span className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xs shrink-0">🏆</span>
                <div>
                  <h4 className="text-[11px] font-extrabold text-slate-200">Top Contributor</h4>
                  <p className="text-[9px] text-slate-400 mt-0.5">Reserved for our top 1% community builders.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Community Stories Right */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex justify-between items-end border-b border-slate-900 pb-3">
              <h3 className="text-base font-extrabold uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                <Quote size={15} className="text-teal-400" /> Stories from Our Community
              </h3>
              <Link href="/register" className="text-[10px] font-bold text-slate-400 hover:text-teal-400">View all</Link>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl space-y-3.5 shadow-lg relative">
                <p className="text-xs text-slate-350 leading-relaxed italic">
                  "I was moving into a college apartment and was extremely low on budget. A kind neighbor listed a study desk and chair for free. I claimed them and they helped me get through my exams!"
                </p>
                <div className="flex items-center gap-3">
                  <img className="w-8 h-8 rounded-full object-cover border border-slate-800" src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100" alt="Neha" />
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-100">Neha</h4>
                    <span className="text-[8.5px] text-slate-400 font-medium">Verified User, Delhi</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl space-y-3.5 shadow-lg relative">
                <p className="text-xs text-slate-350 leading-relaxed italic">
                  "When moving out, I didn't want my kitchen appliances to end up in the dump. I posted my old rice cooker and blender on FreeShare. Within 30 minutes, they were matched to someone who had just moved to town!"
                </p>
                <div className="flex items-center gap-3">
                  <img className="w-8 h-8 rounded-full object-cover border border-slate-800" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=100" alt="Arjun" />
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-100">Arjun</h4>
                    <span className="text-[8.5px] text-slate-400 font-medium">Verified Donor, Delhi</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Available Items Preview Section */}
      <section id="available-items" className="max-w-7xl mx-auto px-4 py-16 border-t border-slate-900/60 scroll-mt-20">
        <div className="flex justify-between items-end border-b border-slate-900 pb-2 mb-6">
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles size={14} className="text-teal-400" />
            Trending Free Items Nearby
          </h2>
          <span className="text-[9.5px] text-slate-450 font-bold uppercase">Log in to claim</span>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-900 rounded-3xl">
            <Gift className="mx-auto text-slate-700 mb-3" size={32} />
            <p className="text-xs text-slate-400">Scan complete. No active items in this neighborhood.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {listings.slice(0, 8).map((item) => (
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
                    </div>
                    <span className="font-bold text-teal-450 group-hover:underline">Claim Details</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA Banner Card */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-teal-900/60 to-emerald-950/60 border border-teal-500/20 rounded-3xl p-8 sm:p-12 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl -z-10" />
          <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight leading-[1.2]">
            Ready to Make a Difference?
          </h2>
          <p className="text-xs sm:text-sm text-slate-350 max-w-md mx-auto">
            Join thousands of Indians sharing pre-loved goods, decluttering their homes, and preventing waste from filling up our landfills.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto pt-2">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all shadow-md active:scale-[0.98]">
              Create Free Account
            </Link>
            <button onClick={() => scrollToSection("available-items")} className="w-full sm:w-auto inline-flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-200 hover:text-teal-450 hover:border-slate-700/80 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all cursor-pointer">
              Browse Items Near You
            </button>
          </div>
          
          {/* Footer Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-900/50 pt-8 mt-8 text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">
            <div className="flex items-center justify-center gap-1.5"><ShieldCheck size={13} className="text-teal-400" /> Verified Users</div>
            <div className="flex items-center justify-center gap-1.5"><Gift size={13} className="text-teal-400" /> 100% Free / No Hidden Costs</div>
            <div className="flex items-center justify-center gap-1.5"><MapPin size={13} className="text-teal-400" /> Proximity Sharing</div>
            <div className="flex items-center justify-center gap-1.5"><ShieldCheck size={13} className="text-teal-400" /> Secure & Trusted</div>
          </div>
        </div>
      </section>
    </div>
  );
}


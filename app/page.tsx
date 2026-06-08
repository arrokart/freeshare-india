"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Search, Filter, Plus, User as UserIcon, LogOut, Loader2, Sparkles, MapPin, Grid, MessageSquare, Gift, AlertCircle, Bell, CheckCircle, ArrowRight, Heart, Star, Smile, BookOpen, Smartphone, ShieldCheck, Award, Tv, Shirt, ToyBrick, Soup, Trophy, Quote, HeartHandshake, Calendar } from "lucide-react";
import dynamic from "next/dynamic";
import LocationPickerModal from "@/components/LocationPickerModal";
import { getTranslation, Language } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import { useBranding } from "@/components/BrandingContext";
import { parseCategory } from "@/lib/branding";

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
    case "new_event_comment":
      return <MessageSquare className="w-4 h-4 text-amber-400" />;
    case "new_event_message":
      return <MessageSquare className="w-4 h-4 text-orange-400" />;
    case "event_rsvp":
      return <Bell className="w-4 h-4 text-amber-400" />;
    case "account_warning":
    case "listing_removed":
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Bell className="w-4 h-4 text-slate-400" />;
  }
};


export default function HomeFeed() {
  const { appName, appShortName, appDescription, supportEmail, appDomain, itemCategories, brandLogoUrl, logoDisplayMode } = useBranding();
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof window !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("All");
  const [selectedListingType, setSelectedListingType] = useState<"all" | "item" | "skill">("all");

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
  const displayAppName = appName === "FreeShare India" ? t("app_title") : appName;

  // Campaign & Limit States
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);

  const getUserData = async (settingsData?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      // Set cookie helper for SSR / Next.js proxy token checks
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in || 3600}; SameSite=Lax; Secure`;

      // Query profile to get latest bio (custom claim limit overrides), location details, and claim count
      const { data: profile } = await supabase
        .from("users")
        .select("id, email, name, is_admin, is_premium, is_ngo, bio, monthly_claim_count, created_at, city, area, pincode")
        .eq("id", user.id)
        .single();

      setUser(profile || user);
      setClaimCount(profile?.monthly_claim_count ?? user.user_metadata?.monthly_claim_count ?? 0);

      // Check if welcome trial is enabled globally using passed settings or state
      const settings = settingsData || systemSettings;
      if (settings) {
        if (settings.welcome_trial_enabled !== false && profile?.created_at) {
          const createdDate = new Date(profile.created_at);
          const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const remaining = 30 - diffDays;
          setTrialDaysLeft(remaining > 0 ? remaining : 0);
        } else {
          setTrialDaysLeft(0);
        }
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
      
      // Clean up URL hash parameters (like #access_token=...) from OAuth redirect
      if (typeof window !== "undefined" && window.location.hash && window.location.hash.includes("access_token=")) {
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch (e) {
          console.error("Failed to clean OAuth hash parameters:", e);
        }
      }

      let fetchedSettings: any = null;
      // Parallel loading of system settings and user details initialization
      try {
        const [settingsRes] = await Promise.all([
          fetch("/api/admin/settings").catch(() => null)
        ]);

        if (settingsRes && settingsRes.ok) {
          fetchedSettings = await settingsRes.json();
          setSystemSettings(fetchedSettings);
          if (fetchedSettings.campaign_type && fetchedSettings.campaign_type !== "none") {
            setActiveCampaign(fetchedSettings);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
      
      // Then fetch user data with already-loaded settings to avoid duplicate network requests
      try {
        await getUserData(fetchedSettings);
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
    const userCity = user.city || user.user_metadata?.city;
    const userArea = user.area || user.user_metadata?.area;
    const userPincode = user.pincode || user.user_metadata?.pincode;

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

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCategory, selectedCondition, selectedListingType, userCoords, selectedRadius, selectedLocation]);

  // Fetch listings on filter or page change
  useEffect(() => {
    const fetchListings = async () => {
      if (page === 1) {
        setLoading(true);
      } else {
        setIsFetchingMore(true);
      }
      try {
        const queryParams = new URLSearchParams();
        if (searchTerm) queryParams.set("search", searchTerm);
        if (selectedCategory) queryParams.set("category", selectedCategory);
        if (selectedCondition) queryParams.set("condition", selectedCondition);
        if (selectedListingType !== "all") queryParams.set("listing_type", selectedListingType);
        
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

        queryParams.set("page", page.toString());
        queryParams.set("limit", "12");

        const res = await fetch(`/api/listings?${queryParams.toString()}`);
        const data = await res.json();
        
        if (data && Array.isArray(data.listings)) {
          setListings((prev) => (page === 1 ? data.listings : [...prev, ...data.listings]));
          setHasMore(data.hasMore ?? false);
        } else {
          setListings((prev) => (page === 1 ? [] : prev));
          setHasMore(false);
        }
      } catch (err) {
        console.error("Failed to load listings:", err);
      } finally {
        setLoading(false);
        setIsFetchingMore(false);
      }
    };

    // Debounce search query to prevent continuous API calls (only on page 1)
    const delayDebounceFn = setTimeout(() => {
      fetchListings();
    }, page === 1 ? 300 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory, selectedCondition, selectedListingType, userCoords, selectedRadius, selectedLocation, page]);

  // Intersection Observer for Infinite Scroll (pages 2 and 3)
  useEffect(() => {
    if (!hasMore || page >= 3 || loading || isFetchingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    const sentinel = document.getElementById("feed-sentinel");
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [hasMore, page, loading, isFetchingMore]);

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
        <p className="text-sm text-slate-500">Initializing {displayAppName}...</p>
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
          <div className="flex items-center gap-5">
            <Link href="/" className="select-none flex items-center gap-1.5 hover:opacity-90 transition-opacity">
              {logoDisplayMode === "text" ? null : brandLogoUrl ? (
                <Image
                  src={brandLogoUrl}
                  alt="Logo"
                  width={logoDisplayMode === "logo" ? 120 : 32}
                  height={logoDisplayMode === "logo" ? 40 : 32}
                  priority
                  className={`${logoDisplayMode === "logo" ? "h-10 w-auto" : "h-8 w-8"} object-contain shrink-0`}
                />
              ) : (
                <svg className="w-6 h-6 text-teal-400 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 00-7.07 17.07L12 22l7.07-2.93A10 10 0 0012 2zm-1 14.5V13H8v-2h3V8.5a2.5 2.5 0 015 0V11h-2V8.5a.5.5 0 00-1 0V13h3v2h-3v1.5a.5.5 0 001 0v.5a1.5 1.5 0 01-3 0z" />
                </svg>
              )}
              {logoDisplayMode !== "logo" && (
                <span className="text-xl font-black bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                  {displayAppName}
                </span>
              )}
            </Link>
            
            <Link
              href="/events"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-xs font-bold text-slate-350 hover:text-amber-400 transition-all cursor-pointer"
            >
              <Calendar size={13} className="text-amber-500" />
              <span>Events</span>
            </Link>
            
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

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>
            {user ? (
              <>
                {/* Donate Link Button */}
                <Link
                  href="/donate"
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-[10px] font-black text-slate-950 transition-all shadow-md shadow-teal-500/10 cursor-pointer uppercase tracking-wider shrink-0"
                >
                  <Plus size={11} strokeWidth={3} />
                  <span>Upload</span>
                </Link>

                {/* Direct Messages Icon Button */}
                <Link
                  href="/dashboard?tab=claims"
                  title="My Inbox & Chats"
                  className="hidden sm:block p-2 hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                >
                  <MessageSquare size={17} />
                </Link>
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
                        ? `🎁 ${claimCount} items`
                        : `🎁 ${claimCount} of ${getClaimLimitLabel()} free items`}
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
                    <div className="fixed md:absolute left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-0 mt-3 w-[calc(100vw-32px)] md:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                      <div className="fixed md:absolute left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-0 mt-3 w-[calc(100vw-32px)] md:w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                            href="/dashboard?tab=claims"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-teal-600 hover:bg-slate-950 transition-all font-semibold"
                          >
                            <MessageSquare size={14} className="text-slate-400" />
                            <span>Messages</span>
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
                                `Hey! Check out ${displayAppName} to claim free pre-loved goods in your city! Sign up using my link: ${refLink} or use referral code ${refCode}`
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
                          <div className="sm:hidden px-3 pb-2 border-b border-slate-800/50 mb-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Language</p>
                            <LanguageSelector />
                          </div>
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
              Find Free Items &amp; <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Skills Nearby</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-md">
              Reduce landfill waste. Declutter your home. Share your talent. Help your neighbors inside India's free sharing hub.
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

        {/* Listing type pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
          {(["all", "item", "skill"] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setSelectedListingType(type);
                setSelectedCategory("All");
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                selectedListingType === type
                  ? type === "skill"
                    ? "bg-violet-500/10 border-violet-500/40 text-violet-400"
                    : "bg-teal-500/10 border-teal-500/40 text-teal-400"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {type === "all" ? "🌐 All" : type === "item" ? "📦 Items" : "🎯 Skills"}
            </button>
          ))}
        </div>

        {/* Category horizontal scrolling bar — hidden when Skills only selected */}
        {selectedListingType !== "skill" && (
          <div className="relative w-full">
            {/* Visual fade overlays to indicate scrollability */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none z-10" />
            
            <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 no-scrollbar scroll-smooth">
              {["All", ...itemCategories].map((cat) => {
                const { emoji, name } = cat === "All" ? { emoji: "🌐", name: "All" } : parseCategory(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-teal-500/10 border-teal-500/40 text-teal-400"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Proximity Map Section */}
      {selectedRadius !== "All" && userCoords && (
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <ProximityMap listings={listings} userLocation={userCoords} />
        </div>
      )}

      {/* Grid listing content */}
      <div className="max-w-7xl mx-auto px-4 mt-6 space-y-12">
        {isOffline && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-3 text-amber-400 select-none animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <p className="text-xs font-semibold leading-none">Offline Mode — Showing Cached Neighborhood Items</p>
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">Cached</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="border border-slate-900 bg-slate-900/20 rounded-2xl overflow-hidden flex flex-col animate-pulse">
                <div className="aspect-square bg-slate-900 relative" />
                <div className="p-3 sm:p-4 flex-1 space-y-2">
                  <div className="h-4 bg-slate-900 rounded w-3/4" />
                  <div className="h-3 bg-slate-900/60 rounded w-1/2" />
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-5 w-5 bg-slate-900/80 rounded-full" />
                    <div className="h-3 bg-slate-900/40 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
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
                  {trendingListings.map((item) => {
                    const isSkill = item.listing_type === "skill";
                    return (
                    <Link
                      key={`trending-${item.id}`}
                      href={`/listing/${item.id}`}
                      className={`group border rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all hover:scale-[1.01] hover:-translate-y-0.5 ${
                        isSkill
                          ? "bg-violet-950/20 border-violet-900/40 hover:border-violet-700/50"
                          : "bg-slate-900/40 border-slate-900 hover:border-slate-800/80"
                      }`}
                    >
                      <div className="aspect-square relative overflow-hidden bg-slate-950">
                        {isSkill && (!item.images || item.images.length === 0 || !item.images[0]) ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-950/60 to-slate-950">
                            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-violet-500/30 mb-2">
                              {item.donor?.avatar_url
                                ? <img src={item.donor.avatar_url} alt={item.donor?.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-violet-900/50 flex items-center justify-center text-2xl">🎯</div>
                              }
                            </div>
                            <span className="text-[10px] text-violet-400 font-bold">{item.donor?.name?.split(" ")[0]}</span>
                          </div>
                        ) : (
                          <Image
                            src={item.images?.[0]}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        {item.status && item.status !== "available" && (
                          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex items-center justify-center z-10">
                            <span className={`text-[9px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${
                              item.status === "reserved"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-450 border-emerald-500/30"
                            }`}>
                              {item.status === "reserved" ? "Reserved" : "Completed"}
                            </span>
                          </div>
                        )}
                        <span className={`absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 text-[8px] sm:text-[9px] font-extrabold uppercase px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-black/60 backdrop-blur-md tracking-wider z-20 ${
                          isSkill ? "text-violet-400" : "text-teal-400"
                        }`}>
                          {isSkill ? (item.skill_duration || "Free") : item.condition}
                        </span>
                      </div>
                      <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1 sm:space-y-1.5">
                          <h3 className={`font-bold text-[11px] sm:text-sm text-slate-100 transition-colors line-clamp-1 ${
                            isSkill ? "group-hover:text-violet-400" : "group-hover:text-teal-400"
                          }`}>
                            {item.title}
                          </h3>
                          <p className="text-xs text-slate-400 line-clamp-2 hidden sm:block">
                            {item.description}
                          </p>
                          {isSkill && item.skill_tags?.length > 0 && (
                            <div className="hidden sm:flex flex-wrap gap-1 pt-0.5">
                              {item.skill_tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-[9px] font-semibold text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded-full border border-violet-500/20">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
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
                          {isSkill
                            ? <span className="shrink-0 text-violet-400 font-bold">🎯 Free Skill</span>
                            : <span className="shrink-0">🔥 {item.view_count || 0} <span className="hidden xs:inline">views</span></span>
                          }
                        </div>
                      </div>
                    </Link>
                    );
                  })}
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
                {listings.map((item) => {
                    const isSkill = item.listing_type === "skill";
                    return (
                  <Link
                    key={item.id}
                    href={`/listing/${item.id}`}
                    className={`group border rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all hover:scale-[1.01] hover:-translate-y-0.5 ${
                      isSkill
                        ? "bg-violet-950/20 border-violet-900/40 hover:border-violet-700/50"
                        : "bg-slate-900/40 border-slate-900 hover:border-slate-800/80"
                    }`}
                  >
                    <div className="aspect-square relative overflow-hidden bg-slate-950">
                      {isSkill && (!item.images || item.images.length === 0 || !item.images[0]) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-950/60 to-slate-950">
                          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-violet-500/30 mb-2">
                            {item.donor?.avatar_url
                              ? <img src={item.donor.avatar_url} alt={item.donor?.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full bg-violet-900/50 flex items-center justify-center text-2xl">🎯</div>
                            }
                          </div>
                          <span className="text-[10px] text-violet-400 font-bold">{item.donor?.name?.split(" ")[0]}</span>
                        </div>
                      ) : (
                        <Image
                          src={item.images?.[0]}
                          alt={item.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      {item.status && item.status !== "available" && (
                        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex items-center justify-center z-10">
                          <span className={`text-[9px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${
                            item.status === "reserved"
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-450 border-emerald-500/30"
                          }`}>
                            {item.status === "reserved" ? "Reserved" : "Completed"}
                          </span>
                        </div>
                      )}
                      <span className={`absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 text-[8px] sm:text-[9px] font-extrabold uppercase px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-black/60 backdrop-blur-md tracking-wider z-20 ${
                        isSkill ? "text-violet-400" : "text-teal-400"
                      }`}>
                        {isSkill ? (item.skill_duration || "Free") : item.condition}
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-1 sm:space-y-1.5">
                        <h3 className={`font-bold text-[11px] sm:text-sm text-slate-100 transition-colors line-clamp-1 ${
                          isSkill ? "group-hover:text-violet-400" : "group-hover:text-teal-400"
                        }`}>
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
                        {isSkill
                          ? <span className="shrink-0 text-violet-400 font-bold">🎯 Free Skill</span>
                          : <span className="shrink-0">{new Date(item.created_at).toLocaleDateString(undefined, {month: "short", day: "numeric"})}</span>
                        }
                      </div>
                    </div>
                  </Link>
                    );
                  })}
              </div>

              {/* Pagination controls & loading states */}
              <div className="pt-8 flex flex-col items-center justify-center gap-4">
                {/* Loader spinner during pagination fetch */}
                {isFetchingMore && (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="animate-spin text-teal-400 w-5 h-5" />
                    <span className="text-xs text-slate-500 font-medium animate-pulse">Loading next items...</span>
                  </div>
                )}

                {/* Sentinel div for Infinite Scroll (active when page < 3 and hasMore is true) */}
                {hasMore && page < 3 && !isFetchingMore && (
                  <div id="feed-sentinel" className="h-4 w-full" />
                )}

                {/* Manual Load More button (rendered when page >= 3 and hasMore is true) */}
                {hasMore && page >= 3 && !isFetchingMore && (
                  <button
                    type="button"
                    onClick={() => setPage((prev) => prev + 1)}
                    className="px-6 py-3 rounded-full bg-slate-900 border border-slate-800 text-slate-200 hover:text-teal-450 hover:border-slate-700/85 font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    Load More Listings
                  </button>
                )}

                {/* End of listings notice */}
                {!hasMore && listings.length > 0 && (
                  <p className="text-[10px] text-slate-600 italic font-semibold py-6">
                    🎉 You've seen all listings in your neighborhood!
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Section */}
      <footer className="border-t border-slate-900/60 bg-slate-950/20 py-8 px-4 text-center mt-12 mb-20 md:mb-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] sm:text-xs text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} {displayAppName}. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-6 font-semibold uppercase tracking-wider text-[9px] sm:text-[10px]">
            <Link href="/terms" className="hover:text-teal-400 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-teal-400 transition-colors">Privacy Policy</Link>
            <a href={`mailto:${supportEmail}`} className="hover:text-teal-400 transition-colors">Grievance Desk</a>
          </div>
        </div>
      </footer>

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
  const { appName, appShortName, appDescription, supportEmail, appDomain, brandLogoUrl, logoDisplayMode } = useBranding();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [previewTab, setPreviewTab] = useState<"all" | "item" | "skill">("all");
  const t = (key: any) => getTranslation(key, lang);
  const displayAppName = appName === "FreeShare India" ? t("app_title") : appName;
  
  // Custom Smooth Scrolling helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const categories = [{ name: "Furniture", icon: (
      <svg className="w-6 h-6 text-emerald-450" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h12M4 10h16M7 10v6m10-6v6M9 6h6m-7 12v2m8-2v2" />
      </svg>
    )},
    { name: "Electronics", icon: (
      <svg className="w-6 h-6 text-blue-450" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 18V9a9 9 0 0118 0v9m-18 0a2 2 0 002 2h3a2 2 0 002-2V13a2 2 0 00-2-2H3m18 7a2 2 0 01-2 2h-3a2 2 0 01-2-2V13a2 2 0 012-2h3" />
      </svg>
    )},
    { name: "Books", icon: (
      <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )},
    { name: "Clothing", icon: (
      <svg className="w-6 h-6 text-amber-450" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 0L14.828 12H9.172L9.172 9.172m5.656 0L18.364 5.636M9.172 9.172L5.636 5.636m0 0l3.536 3.536M12 12v9m-4-6h8" />
      </svg>
    )},
    { name: "Toys", icon: (
      <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="6" />
        <circle cx="8" cy="8" r="2" />
        <circle cx="16" cy="8" r="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14v1m-2-1v.5a2 2 0 004 0v-.5" />
      </svg>
    )},
    { name: "Kitchen", icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M4 8h16v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8zm0 4h16" />
      </svg>
    )},
    { name: "Sports", icon: (
      <svg className="w-6 h-6 text-orange-450" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8" />
      </svg>
    )},
    { name: "Appliances", icon: (
      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="6" r="1" />
      </svg>
    )},
  ];

  const filteredListings = listings.filter((item) => {
    if (previewTab === "all") return true;
    return item.listing_type === previewTab;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-teal-500 selection:text-black antialiased relative">
      {/* Mesh Gradients background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-500/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[130px]" />
      </div>

      {/* Sticky Navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/85 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="select-none flex items-center gap-1.5 cursor-pointer">
              {logoDisplayMode === "text" ? null : brandLogoUrl ? (
                <Image
                  src={brandLogoUrl}
                  alt="Logo"
                  width={logoDisplayMode === "logo" ? 120 : 32}
                  height={logoDisplayMode === "logo" ? 40 : 32}
                  priority
                  className={`${logoDisplayMode === "logo" ? "h-10 w-auto" : "h-8 w-8"} object-contain shrink-0`}
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-lg">
                  <Gift className="w-4 h-4 text-slate-950" strokeWidth={2.5} />
                </div>
              )}
              {logoDisplayMode !== "logo" && (
                <span className="text-lg font-black bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 bg-clip-text text-transparent tracking-tight">
                  {displayAppName}
                </span>
              )}
            </span>
            <div className="hidden md:flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-full px-3 py-1 text-[10px] font-bold text-slate-400 shadow-inner">
              <MapPin size={10} className="text-teal-400 animate-pulse" />
              <span>Delhi NCR</span>
              <span className="text-[7px] text-slate-500">▼</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <button onClick={() => scrollToSection("features")} className="hover:text-teal-400 transition-colors cursor-pointer relative py-1 group">
              Our Pillars
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-teal-400 transition-all group-hover:w-full" />
            </button>
            <button onClick={() => scrollToSection("how-it-works")} className="hover:text-teal-400 transition-colors cursor-pointer relative py-1 group">
              How it Works
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-teal-400 transition-all group-hover:w-full" />
            </button>
            <button onClick={() => scrollToSection("trending-preview")} className="hover:text-teal-400 transition-colors cursor-pointer relative py-1 group">
              Browse Live
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-teal-400 transition-all group-hover:w-full" />
            </button>
            <button onClick={() => scrollToSection("impact")} className="hover:text-teal-400 transition-colors cursor-pointer relative py-1 group">
              Impact Metrics
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-teal-400 transition-all group-hover:w-full" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <LanguageSelector />
            <Link href="/login" className="text-xs font-bold text-slate-350 hover:text-teal-400 transition-colors px-3 py-2">
              Log in
            </Link>
            <Link href="/register" className="text-xs font-bold bg-gradient-to-r from-teal-400 to-emerald-450 hover:from-teal-350 hover:to-emerald-400 text-slate-950 px-4 py-2 rounded-xl transition-all shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-95">
              Sign up
            </Link>
          </div>

          {/* Mobile Hamburger Menu button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="sm:hidden flex flex-col justify-center items-center w-10 h-10 rounded-xl text-slate-350 hover:text-teal-400 hover:bg-slate-900 transition-all gap-1.5 active:scale-95 border border-transparent hover:border-slate-800"
            aria-label="Open menu"
          >
            <span className="w-5 h-0.5 bg-current rounded-full" />
            <span className="w-5 h-0.5 bg-current rounded-full" />
            <span className="w-4 h-0.5 bg-current rounded-full self-start ml-[6px]" />
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[60] sm:hidden">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-900 rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto mb-6" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{displayAppName} Navigation</p>
            <div className="space-y-3">
              <Link
                href="/login"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-sm font-bold text-slate-200 hover:border-teal-500/40 hover:text-teal-450 transition-all active:scale-[0.98]"
              >
                Log in
                <ArrowRight size={16} className="text-slate-500" />
              </Link>
              <Link
                href="/register"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-450 text-slate-950 text-sm font-black shadow-lg shadow-teal-500/10 active:scale-[0.98] transition-all"
              >
                Create Free Account
                <ArrowRight size={16} />
              </Link>
              <div className="pt-2">
                <LanguageSelector />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 pt-20 pb-16 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500/10 to-violet-500/10 border border-teal-500/20 px-4 py-2 rounded-full text-xs font-bold text-teal-350 tracking-wide uppercase shadow-sm">
              <Sparkles size={12} className="animate-pulse text-teal-400" />
              <span>India's Premium Sharing & Skill Exchange Network</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08] text-slate-100">
              Pass On Unused Items, <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-teal-400 via-emerald-405 to-violet-400 bg-clip-text text-transparent">Share Skills, Host Drives</span>
            </h1>
            
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Why buy when you can share? Get items you need, learn new skills, and volunteer in local drives. All 100% free, powered by community trust and goodwill.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-450 to-emerald-450 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-8 py-4 rounded-xl transition-all shadow-xl shadow-teal-500/15 active:scale-95">
                Join Now (Free) <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
              <button onClick={() => scrollToSection("trending-preview")} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-teal-400 hover:border-slate-700/85 font-bold text-xs uppercase tracking-wider px-8 py-4 rounded-xl transition-all cursor-pointer">
                <Search size={14} /> Browse Nearby
              </button>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-3 pt-6 border-t border-slate-900 max-w-md mx-auto lg:mx-0">
              <div className="flex -space-x-2.5">
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" alt="User" />
                <img className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100" alt="User" />
              </div>
              <p className="text-[10px] text-slate-400 text-left leading-normal">
                Join <strong className="text-slate-200 font-extrabold">local changemakers</strong> building a sustainable & helpful India 💚
              </p>
            </div>
          </div>

          {/* Hero Right side interactive visualization */}
          <div className="lg:col-span-5 flex justify-center items-center relative">
            <div className="relative w-full max-w-[420px] h-[360px] sm:h-[400px] flex items-center justify-center">
              <div className="absolute w-[300px] h-[300px] bg-gradient-to-tr from-teal-500/10 to-violet-500/10 rounded-full blur-[70px] -z-10 animate-pulse" />
              
              {/* Stacked Interactive Cards showcasing features */}
              {/* Card 1: Free Goods */}
              <div className="absolute top-2 left-4 w-[200px] bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 -rotate-3 hover:z-20 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                    <Gift size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-slate-100 truncate">Sofa Couch Set</h4>
                    <p className="text-[8px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> 2.1 km away</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-950 pt-3 text-[9px]">
                  <span className="font-black text-teal-400 uppercase bg-teal-950/40 px-2 py-0.5 rounded tracking-wide border border-teal-900/20">● Like New</span>
                  <span className="text-slate-400">100% Free</span>
                </div>
              </div>

              {/* Card 2: Skill Share */}
              <div className="absolute top-[32%] right-2 w-[220px] bg-slate-900/95 border border-slate-800 p-4 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 rotate-2 hover:z-20 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-slate-100 truncate">Spoken English Class</h4>
                    <p className="text-[8px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> Online / Live</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-950 pt-3 text-[9px]">
                  <span className="font-black text-violet-400 uppercase bg-violet-950/40 px-2 py-0.5 rounded tracking-wide border border-violet-900/20">⚡ Skill Exchange</span>
                  <span className="text-slate-400">Free Mentor</span>
                </div>
              </div>

              {/* Card 3: Events & Drives */}
              <div className="absolute bottom-6 left-6 w-[210px] bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 -rotate-1 hover:z-20 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[11px] font-black text-slate-100 truncate">Book Collection Drive</h4>
                    <p className="text-[8px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> Lajpat Nagar</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-950 pt-3 text-[9px]">
                  <span className="font-black text-amber-500 uppercase bg-amber-950/40 px-2 py-0.5 rounded tracking-wide border border-amber-900/20">📅 Drive Campaign</span>
                  <span className="text-slate-350">12 RSVPed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Highlights metrics banner */}
      <section id="impact" className="bg-slate-900/40 border-y border-slate-900 py-12 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-8">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider bg-teal-500/10 px-3 py-1 rounded-full">Our Collective Target</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-100">Launch Goals we are achieving together</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center pt-2">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Goal: Items Gifted</span>
              <span className="text-2xl sm:text-4xl font-black text-teal-400">10,000+</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Goal: Skill Exchange</span>
              <span className="text-2xl sm:text-4xl font-black text-violet-400">1,000+ Hrs</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Goal: Drive Campaigns</span>
              <span className="text-2xl sm:text-4xl font-black text-amber-500">200+ Events</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Goal: Waste Diverted</span>
              <span className="text-2xl sm:text-4xl font-black text-emerald-450">5 Tons</span>
            </div>
          </div>
        </div>
      </section>

      {/* Three Core Pillars Presentation */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-20 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            One Platform. <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-violet-400 bg-clip-text text-transparent">Three Pillars of Sharing.</span>
          </h2>
          <p className="text-sm text-slate-400">
            FreeShare India unites sustainable action under three distinct sharing models. Build connections, reduce landfill footprint, and exchange value freely.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {/* Pillar 1: Free Items */}
          <div className="bg-slate-900/50 border border-slate-900 rounded-3xl p-8 space-y-5 hover:border-slate-800 hover:bg-slate-900/80 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Gift size={22} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 group-hover:text-teal-400 transition-colors">
                Share Free Items
                <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clean out your wardrobes, shelves, and garages. Gift books, clothes, furniture, or kitchenware directly to neighbors in need. Prevent environmental waste with local reuse.
              </p>
            </div>
            <ul className="text-[11px] text-slate-450 space-y-2.5 pt-2 border-t border-slate-900">
              <li className="flex items-center gap-2">✓ Dynamic radius-based searching</li>
              <li className="flex items-center gap-2">✓ Verified trust scores & mutual reviews</li>
              <li className="flex items-center gap-2">✓ Secure in-app privacy-first chat rooms</li>
            </ul>
          </div>

          {/* Pillar 2: Skill Share */}
          <div className="bg-slate-900/50 border border-slate-900 rounded-3xl p-8 space-y-5 hover:border-slate-800 hover:bg-slate-900/80 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Sparkles size={22} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 group-hover:text-violet-400 transition-colors">
                Empower with Skills
                <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lend your time and expertise. Share professional mentoring, coding classes, guitar tutorials, or kitchen garden advice. Help others grow without charging fees.
              </p>
            </div>
            <ul className="text-[11px] text-slate-450 space-y-2.5 pt-2 border-t border-slate-900">
              <li className="flex items-center gap-2">✓ Support for online and physically local sessions</li>
              <li className="flex items-center gap-2">✓ Flexible time slots & duration flags</li>
              <li className="flex items-center gap-2">✓ Dedicated review forms for learners</li>
            </ul>
          </div>

          {/* Pillar 3: Drives & NGO Events */}
          <div className="bg-slate-900/50 border border-slate-900 rounded-3xl p-8 space-y-5 hover:border-slate-800 hover:bg-slate-900/80 transition-all duration-300 relative group overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Calendar size={22} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 group-hover:text-amber-500 transition-colors">
                Organize Drives & Drives
                <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect with verified NGOs or initiate your own neighborhood campaigns. Organize food distributions, clothing collections, tree plantations, or cleanups.
              </p>
            </div>
            <ul className="text-[11px] text-slate-450 space-y-2.5 pt-2 border-t border-slate-900">
              <li className="flex items-center gap-2">✓ Real-time RSVP systems for drives</li>
              <li className="flex items-center gap-2">✓ Interactive maps pinning event coordinates</li>
              <li className="flex items-center gap-2">✓ Verified NGO-verified host badges</li>
            </ul>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 py-20 text-center scroll-mt-20">
        <div className="space-y-3 max-w-2xl mx-auto mb-16">
          <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider bg-teal-500/10 px-3 py-1 rounded-full">3 Easy Steps</span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-100">
            How {appShortName} Works
          </h2>
          <p className="text-xs text-slate-400">Join, upload, and start sharing with verified community members nearby.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-slate-900 border border-slate-900/60 p-8 rounded-3xl space-y-4 hover:border-slate-800 transition-all flex flex-col items-center shadow-md">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center text-teal-450">
              <Smartphone size={24} />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">1. Post in Seconds</h3>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Upload items you want to gift, describe a skill you want to teach, or pin a neighborhood cleanup event.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900 border border-slate-900/60 p-8 rounded-3xl space-y-4 hover:border-slate-800 transition-all flex flex-col items-center shadow-md">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center text-violet-400">
              <MessageSquare size={24} />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">2. Chat & Coordinate</h3>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Use our secure in-app messaging system to communicate, verify details, and choose an exchange point safely.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-900 border border-slate-900/60 p-8 rounded-3xl space-y-4 hover:border-slate-800 transition-all flex flex-col items-center shadow-md">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center text-amber-500">
              <HeartHandshake size={24} />
            </div>
            <h3 className="font-bold text-slate-100 text-sm">3. Swap & Earn Karma</h3>
            <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
              Complete the collection or session, rate each other, and unlock badges showing your positive green impact!
            </p>
          </div>
        </div>
      </section>

      {/* Explore Popular Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16 border-t border-slate-900/60">
        <div className="flex justify-between items-end pb-3 mb-8">
          <h2 className="text-lg sm:text-xl font-black text-slate-200">Explore Popular Categories</h2>
          <button onClick={() => scrollToSection("trending-preview")} className="text-xs font-bold text-teal-400 hover:underline flex items-center gap-1 cursor-pointer">
            View all categories <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.map((cat) => (
            <Link key={cat.name} href="/register" className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-inner text-center">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-900 flex items-center justify-center">
                {cat.icon}
              </div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Live Preview Feed Grid with Tabs Switcher */}
      <section id="trending-preview" className="max-w-7xl mx-auto px-4 py-20 border-t border-slate-900/60 scroll-mt-20">
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-900 pb-4 mb-8 gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-black text-slate-200 flex items-center gap-2 justify-center sm:justify-start">
              <Sparkles size={18} className="text-teal-400" />
              Live Sharing Preview
            </h2>
            <p className="text-xs text-slate-500">Real-time listings from the neighborhood. Sign up to claim or schedule.</p>
          </div>
          
          {/* Tab buttons */}
          <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl shrink-0">
            <button
              onClick={() => setPreviewTab("all")}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewTab === "all" ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Listings
            </button>
            <button
              onClick={() => setPreviewTab("item")}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewTab === "item" ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Items
            </button>
            <button
              onClick={() => setPreviewTab("skill")}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                previewTab === "skill" ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Skills
            </button>
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl">
            <Gift className="mx-auto text-slate-700 mb-3" size={36} />
            <p className="text-xs text-slate-400">Scan complete. No active {previewTab !== "all" ? previewTab + "s" : "listings"} in this location.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredListings.slice(0, 8).map((item) => {
              const isSkill = item.listing_type === "skill";
              return (
                <Link
                  key={item.id}
                  href={`/listing/${item.id}`}
                  className={`group border hover:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl transition-all hover:scale-[1.01] hover:-translate-y-0.5 ${
                    isSkill ? "bg-violet-950/15 border-violet-900/30" : "bg-slate-900/30 border-slate-900"
                  }`}
                >
                  <div className="aspect-square relative overflow-hidden bg-slate-950">
                    <Image
                      src={item.images?.[0]}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className={`absolute top-2.5 left-2.5 text-[9px] font-black uppercase px-2 py-1 rounded bg-black/75 backdrop-blur-md tracking-wider ${
                      isSkill ? "text-violet-400 border border-violet-800/40" : "text-teal-400 border border-teal-800/40"
                    }`}>
                      {isSkill ? (item.skill_duration || "Free Skill") : item.condition}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <h3 className={`font-black text-xs sm:text-sm transition-colors line-clamp-1 ${
                        isSkill ? "text-violet-300 group-hover:text-violet-400" : "text-slate-100 group-hover:text-teal-400"
                      }`}>
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-450 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1 min-w-0">
                        <MapPin size={11} className="shrink-0 text-slate-600" />
                        <span className="truncate max-w-[80px]">{item.area}</span>
                      </div>
                      <span className={`font-bold ${isSkill ? "text-violet-400" : "text-teal-450"} group-hover:underline`}>
                        {isSkill ? "Book Slot" : "Claim Item"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Badges and gamification */}
      <section className="max-w-7xl mx-auto px-4 py-16 scroll-mt-20 border-t border-slate-900/60">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 bg-slate-900/50 border border-slate-900 p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />
            <div className="space-y-2 border-b border-slate-950 pb-4">
              <h3 className="text-sm font-black uppercase text-slate-200 tracking-wider flex items-center gap-2">
                <Award size={16} className="text-teal-450" /> reputation levels & badges
              </h3>
              <p className="text-xs text-slate-450">Unlock exclusive status tiers by giving and participating in neighborhood campaigns.</p>
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-900">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm shrink-0">🌱</span>
                <div>
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wide">Green Starter</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Unlocked on your first successful upload.</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-900">
                <span className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-sm shrink-0">♻️</span>
                <div>
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wide">Waste Warrior</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Awarded after gifting 5+ items near you.</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-900">
                <span className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-sm shrink-0">⚡</span>
                <div>
                  <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-wide">Skill Mentor</h4>
                  <p className="text-[10px] text-slate-450 mt-0.5">Given to users teaching 10+ hours of workshops.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-violet-405 tracking-wider bg-violet-500/10 px-3 py-1 rounded-full">Community First</span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
                Stories from Certified Members
              </h3>
              <p className="text-xs text-slate-400">See how circular sharing makes an impact every day in people's lives.</p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl space-y-4 shadow-lg relative">
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "I was setting up my room near college and had almost zero savings. Through {appShortName}, a kind donor gifted me a study desk, lamp, and books. It saved me a lot of money and built my faith in the community."
                </p>
                <div className="flex items-center gap-3">
                  <img className="w-8 h-8 rounded-full object-cover border border-slate-800" src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100" alt="Neha" />
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-100">Neha</h4>
                    <span className="text-[9px] text-slate-500">College Student, Dwarka Delhi</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl space-y-4 shadow-lg relative">
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  `Instead of throwing away my old desktop and monitor, I listed it under items. A local NGO reached out to claim it for their evening study center. Seeing children use it to learn was the best reward.`
                </p>
                <div className="flex items-center gap-3">
                  <img className="w-8 h-8 rounded-full object-cover border border-slate-800" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=100" alt="Arjun" />
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-100">Arjun</h4>
                    <span className="text-[9px] text-slate-500">Verified Donor, Noida</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner Card */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-gradient-to-r from-teal-900/50 via-emerald-950/30 to-violet-950/50 border border-teal-500/20 rounded-3xl p-8 sm:p-16 text-center space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10" />
          <h2 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight leading-[1.2]">
            Ready to Start Sharing?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Join thousands of active users giving away goods, training others, and building cleaner neighborhoods.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center bg-gradient-to-r from-teal-400 to-emerald-450 hover:from-teal-350 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider px-8 py-4 rounded-xl transition-all shadow-lg active:scale-95">
              Create Your Account
            </Link>
            <button onClick={() => scrollToSection("trending-preview")} className="w-full sm:w-auto inline-flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-200 hover:text-teal-400 hover:border-slate-705 font-bold text-xs uppercase tracking-wider px-8 py-4 rounded-xl transition-all cursor-pointer">
              Explore Active Feed
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-900/80 pt-8 mt-8 text-[9px] text-slate-500 uppercase tracking-widest font-black">
            <div className="flex items-center justify-center gap-1.5"><ShieldCheck size={14} className="text-teal-400" /> Verified Accounts</div>
            <div className="flex items-center justify-center gap-1.5"><Gift size={14} className="text-teal-400" /> 100% Free Sharing</div>
            <div className="flex items-center justify-center gap-1.5"><MapPin size={14} className="text-teal-400" /> Proximity Maps</div>
            <div className="flex items-center justify-center gap-1.5"><ShieldCheck size={14} className="text-teal-400" /> Secure Messages</div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="border-t border-slate-900 bg-slate-950 py-10 px-4 text-center mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] sm:text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {displayAppName}. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-6 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">
            <Link href="/terms" className="hover:text-teal-400 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-teal-400 transition-colors">Privacy Policy</Link>
            <a href={`mailto:${supportEmail}`} className="hover:text-teal-400 transition-colors">Support Grievances</a>
          </div>
        </div>
      </footer>
    </div>
  );
}


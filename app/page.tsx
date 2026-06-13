"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import {
  Search, Plus, User as UserIcon, LogOut, Loader2, Sparkles, MapPin,
  Grid, MessageSquare, Gift, AlertCircle, Bell, CheckCircle, ArrowRight,
  Smartphone, ShieldCheck, Award, HeartHandshake, Calendar
} from "lucide-react";
import dynamic from "next/dynamic";
import LocationPickerModal from "@/components/LocationPickerModal";
import { getTranslation, Language } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import { useBranding } from "@/components/BrandingContext";
import { parseCategory } from "@/lib/branding";

const ProximityMap = dynamic(() => import("@/components/ProximityMap"), { ssr: false });

const CONDITIONS = ["All", "Like New", "Good", "Fair", "Needs Repair"];

/* ─── helpers ─────────────────────────────────────────────── */
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
};

const getNotificationIcon = (type: string) => {
  const cls = "w-4 h-4";
  switch (type) {
    case "new_claim":      return <Gift className={cls} style={{ color: "var(--teal)" }} />;
    case "claim_accepted": return <CheckCircle className={cls} style={{ color: "var(--sage)" }} />;
    case "new_message":    return <MessageSquare className={cls} style={{ color: "var(--teal)" }} />;
    case "new_event_comment":
    case "event_rsvp":    return <Bell className={cls} style={{ color: "var(--golden)" }} />;
    case "account_warning":
    case "listing_removed": return <AlertCircle className={cls} style={{ color: "var(--terracotta-dark)" }} />;
    default:               return <Bell className={cls} style={{ color: "var(--ink-soft)" }} />;
  }
};

const MEDIA_GRADIENTS = [
  "linear-gradient(135deg, var(--teal-soft), #BFE2DC)",
  "linear-gradient(135deg, var(--golden-soft), #F7D8A6)",
  "linear-gradient(135deg, var(--sage-soft), #CFE0B2)",
  "linear-gradient(135deg, var(--terracotta-soft), #F6C2AB)",
];

const getCondBadgeColor = (cond: string) => {
  if (cond === "Like New") return "var(--teal)";
  if (cond === "Good") return "#5C7240";
  return "#B5841E";
};

const CategoryIcon = ({ name, size = 24 }: { name: string; size?: number }) => {
  const s = { width: size, height: size, color: "var(--ink-soft)" };
  const n = name.toLowerCase();
  if (n.includes("furniture"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18h12M4 10h16M7 10v6m10-6v6M9 6h6m-7 12v2m8-2v2" /></svg>;
  if (n.includes("electronic"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 18V9a9 9 0 0118 0v9m-18 0a2 2 0 002 2h3a2 2 0 002-2V13a2 2 0 00-2-2H3m18 7a2 2 0 01-2 2h-3a2 2 0 01-2-2V13a2 2 0 012-2h3" /></svg>;
  if (n.includes("book"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
  if (n.includes("cloth"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10a2 2 0 002 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" /></svg>;
  if (n.includes("toy"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="8" r="2" /></svg>;
  if (n.includes("kitchen"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2M4 8h16v8a4 4 0 01-4 4H8a4 4 0 01-4-4V8zm0 4h16" /></svg>;
  if (n.includes("sport"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8" /></svg>;
  if (n.includes("appliance"))
    return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="6" r="1" /></svg>;
  // fallback
  return <svg style={s} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m-4-4v8" /></svg>;
};

const LogoMark = () => (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="23" fill="#FBD9C9"/>
    <path d="M14 22L24 14L34 22V33C34 34.1 33.1 35 32 35H16C14.9 35 14 34.1 14 33V22Z" fill="#E8744F"/>
    <path d="M19 35V27H29V35" fill="#FFFCF6"/>
  </svg>
);

/* ─── Listing Card ─────────────────────────────────────────── */
const ListingCard = ({ item, index }: { item: any; index: number }) => {
  const isSkill = item.listing_type === "skill";
  const bg = MEDIA_GRADIENTS[index % 4];
  const condBadgeColor = getCondBadgeColor(item.condition || "");
  const condLabel = isSkill ? (item.skill_duration || "Free Skill") : (item.condition || "");

  return (
    <Link href={`/listing/${item.id}`} className="card group flex flex-col" style={{ textDecoration: "none" }}>
      <div className="card-media" style={{ background: bg }}>
        <span className="badge" style={{ color: isSkill ? "var(--teal)" : condBadgeColor }}>
          {condLabel}
        </span>
        {item.images?.[0] ? (
          <Image
            src={item.images[0]}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <CategoryIcon name={item.category || ""} size={64} />
        )}
        {item.status && item.status !== "available" && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "rgba(74,58,46,0.65)", backdropFilter: "blur(1px)" }}>
            <span style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)", borderRadius: 999, padding: "4px 14px", fontSize: 11, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {item.status === "reserved" ? "Reserved" : "Completed"}
            </span>
          </div>
        )}
      </div>
      <div className="card-body">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="card-footer">
          <span className="loc">
            <MapPin size={12} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
            <span style={{ color: "var(--ink-soft)" }}>{item.area}</span>
            {item.distance_km != null && (
              <span style={{ background: "var(--sage-soft)", color: "#5C7240", border: "1px solid var(--sage)", borderRadius: 999, padding: "1px 8px", fontSize: 9, fontWeight: 700, marginLeft: 4 }}>
                {item.distance_km} km
              </span>
            )}
          </span>
          {isSkill ? (
            <span style={{ color: "var(--terracotta)", fontWeight: 700, fontSize: 11 }}>🎯 Free</span>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          )}
        </div>
      </div>
    </Link>
  );
};

const SkeletonCard = () => (
  <div className="card flex flex-col animate-pulse">
    <div style={{ height: 180, background: "var(--cream-deep)" }} />
    <div className="card-body" style={{ gap: 8 }}>
      <div style={{ height: 16, background: "var(--cream-deep)", borderRadius: 8, width: "75%" }} />
      <div style={{ height: 12, background: "var(--cream-deep)", borderRadius: 8, width: "50%" }} />
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   HOME FEED (logged-in)
══════════════════════════════════════════════════════════════ */
export default function HomeFeed() {
  const { appName, supportEmail, itemCategories, brandLogoUrl, logoDisplayMode } = useBranding();
  const [user, setUser] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof window !== "undefined" ? !navigator.onLine : false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCondition, setSelectedCondition] = useState("All");
  const [selectedListingType, setSelectedListingType] = useState<"all" | "item" | "skill">("all");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRadius, setSelectedRadius] = useState("All");
  const [detectingCoords, setDetectingCoords] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [claimCount, setClaimCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState<Language>("en");
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const up = () => setIsOffline(false);
    const down = () => setIsOffline(true);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("freeshare_locale") as Language;
    if (stored) setLang(stored);
    const handler = () => {
      const updated = localStorage.getItem("freeshare_locale") as Language;
      if (updated) setLang(updated);
    };
    window.addEventListener("languageChanged", handler);
    return () => window.removeEventListener("languageChanged", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".user-menu-container") && !t.closest(".notifications-container")) {
        setShowUserMenu(false);
        setShowNotifications(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const t = (key: any) => getTranslation(key, lang);
  const displayAppName = appName === "FreeShare India" ? t("app_title") : appName;

  const getUserData = async (settingsData?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user;
    if (u) {
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in || 3600}; SameSite=Lax; Secure`;
      const { data: profile } = await supabase.from("users")
        .select("id, email, name, is_admin, is_premium, is_ngo, bio, monthly_claim_count, created_at, city, area, pincode")
        .eq("id", u.id).single();
      setUser(profile || u);
      setClaimCount(profile?.monthly_claim_count ?? u.user_metadata?.monthly_claim_count ?? 0);
      const settings = settingsData || systemSettings;
      if (settings?.welcome_trial_enabled !== false && profile?.created_at) {
        const days = Math.ceil(Math.abs(Date.now() - new Date(profile.created_at).getTime()) / 86400000);
        setTrialDaysLeft(Math.max(0, 30 - days));
      }
    }
  };

  const getClaimLimitLabel = () => {
    if (trialDaysLeft > 0) return "Unlimited";
    if (!systemSettings) return "";
    if (user?.bio) {
      try {
        const p = JSON.parse(user.bio);
        if (p?.custom_claim_limit !== undefined) return p.custom_claim_limit === -1 ? "Unlimited" : String(p.custom_claim_limit);
      } catch {}
    }
    if (activeCampaign?.campaign_type === "unlimited") return "Unlimited";
    if (activeCampaign?.campaign_type === "custom") return String(activeCampaign.campaign_limit);
    return String(systemSettings.monthly_claim_limit ?? 10);
  };

  useEffect(() => {
    const init = async () => {
      setAuthLoading(true);
      if (typeof window !== "undefined" && window.location.hash?.includes("access_token=")) {
        try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
      }
      let fetchedSettings: any = null;
      try {
        const res = await fetch("/api/admin/settings").catch(() => null);
        if (res?.ok) {
          fetchedSettings = await res.json();
          setSystemSettings(fetchedSettings);
          if (fetchedSettings.campaign_type && fetchedSettings.campaign_type !== "none") setActiveCampaign(fetchedSettings);
        }
      } catch {}
      try { await getUserData(fetchedSettings); } catch {}
      finally { setAuthLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchNotifications(user.id);
    const ch = supabase.channel(`realtime_notifications:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        if (payload.new.user_id === user.id) setNotifications(prev => [payload.new, ...prev]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const fetchNotifications = async (uid: string) => {
    try {
      const data = await fetch(`/api/notifications?userId=${uid}`).then(r => r.json());
      setNotifications(Array.isArray(data) ? data : []);
    } catch {}
  };

  const markNotificationsRead = async () => {
    if (!user) return;
    const res = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    if (res.ok) setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    const res = await fetch(`/api/notifications?userId=${user.id}`, { method: "DELETE" });
    if (res.ok) setNotifications([]);
  };

  const handleRadiusChange = (radiusVal: string) => {
    setSelectedRadius(radiusVal);
    if (radiusVal !== "All" && !userCoords) {
      setDetectingCoords(true);
      const fallback = async () => {
        try {
          const d = await fetch("https://ipapi.co/json/").then(r => r.json());
          setUserCoords(d.latitude && d.longitude ? { lat: d.latitude, lng: d.longitude } : { lat: 28.6139, lng: 77.209 });
        } catch { setUserCoords({ lat: 28.6139, lng: 77.209 }); }
        setDetectingCoords(false);
      };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => { setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setDetectingCoords(false); },
          () => fallback(), { timeout: 5000 }
        );
      } else fallback();
    }
  };

  useEffect(() => {
    const loc = localStorage.getItem("user_selected_location");
    if (loc) try { const p = JSON.parse(loc); setSelectedLocation(p); if (p.lat && p.lng) setUserCoords({ lat: p.lat, lng: p.lng }); } catch {}
  }, []);

  useEffect(() => {
    if (!user || selectedLocation) return;
    const city = user.city || user.user_metadata?.city;
    const area = user.area || user.user_metadata?.area;
    const pincode = user.pincode || user.user_metadata?.pincode;
    if (city || pincode) {
      const loc = { display_name: `${area ? `${area}, ` : ""}${city || ""}${pincode ? ` (${pincode})` : ""}`, city: city || "", postcode: pincode || "", lat: 28.6139, lng: 77.209 };
      setSelectedLocation(loc);
      localStorage.setItem("user_selected_location", JSON.stringify(loc));
    }
  }, [user, selectedLocation]);

  const handleSelectLocation = (loc: any) => {
    setSelectedLocation(loc);
    localStorage.setItem("user_selected_location", JSON.stringify(loc));
    setUserCoords(loc.lat && loc.lng ? { lat: loc.lat, lng: loc.lng } : null);
  };

  useEffect(() => { setPage(1); }, [searchTerm, selectedCategory, selectedCondition, selectedListingType, userCoords, selectedRadius, selectedLocation]);

  useEffect(() => {
    const fetch_listings = async () => {
      page === 1 ? setLoading(true) : setIsFetchingMore(true);
      try {
        const q = new URLSearchParams();
        if (searchTerm) q.set("search", searchTerm);
        if (selectedCategory) q.set("category", selectedCategory);
        if (selectedCondition) q.set("condition", selectedCondition);
        if (selectedListingType !== "all") q.set("listing_type", selectedListingType);
        if (userCoords && selectedRadius !== "All") {
          q.set("latitude", userCoords.lat.toString()); q.set("longitude", userCoords.lng.toString()); q.set("radius", selectedRadius);
        } else if (selectedLocation) {
          if (selectedLocation.postcode) q.set("pincode", selectedLocation.postcode);
          else if (selectedLocation.city) q.set("city", selectedLocation.city);
        }
        q.set("page", page.toString()); q.set("limit", "12");
        const data = await fetch(`/api/listings?${q}`).then(r => r.json());
        if (data?.listings) {
          setListings(prev => page === 1 ? data.listings : [...prev, ...data.listings]);
          setHasMore(data.hasMore ?? false);
        } else { setListings(prev => page === 1 ? [] : prev); setHasMore(false); }
      } catch (err) { console.error(err); }
      finally { setLoading(false); setIsFetchingMore(false); }
    };
    const t = setTimeout(fetch_listings, page === 1 ? 300 : 0);
    return () => clearTimeout(t);
  }, [searchTerm, selectedCategory, selectedCondition, selectedListingType, userCoords, selectedRadius, selectedLocation, page]);

  useEffect(() => {
    if (!hasMore || page >= 3 || loading || isFetchingMore) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setPage(p => p + 1); }, { threshold: 0.1, rootMargin: "100px" });
    const el = document.getElementById("feed-sentinel");
    if (el) obs.observe(el);
    return () => { if (el) obs.unobserve(el); };
  }, [hasMore, page, loading, isFetchingMore]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    setUser(null);
    window.location.reload();
  };

  const trendingListings = [...listings].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 4);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  /* ── Loading screen ── */
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--cream)", color: "var(--ink)" }}>
        <Loader2 className="animate-spin" size={36} style={{ color: "var(--terracotta)" }} />
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Initializing {displayAppName}...</p>
      </div>
    );
  }

  if (!user) return <LandingPageView listings={listings} trendingListings={trendingListings} lang={lang} />;

  /* ── FEED NAVBAR ── */
  const refLink = typeof window !== "undefined" ? `${window.location.origin}/register?ref=${user.id}` : "";
  const refCode = `REF-${user.id?.substring(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen relative overflow-x-hidden pb-20" style={{ background: "var(--cream)", color: "var(--ink)", fontFamily: "'Quicksand', sans-serif" }}>
      {/* Decorative blobs */}
      <div className="absolute pointer-events-none -z-10" style={{ top: -120, right: -80, width: 320, height: 320, borderRadius: "50%", background: "var(--golden-soft)", filter: "blur(80px)", opacity: 0.65 }} />
      <div className="absolute pointer-events-none -z-10" style={{ top: 280, left: -100, width: 260, height: 260, borderRadius: "50%", background: "var(--sage-soft)", filter: "blur(80px)", opacity: 0.65 }} />
      <div className="absolute pointer-events-none -z-10" style={{ top: 60, right: "18%", width: 200, height: 200, borderRadius: "50%", background: "var(--teal-soft)", filter: "blur(80px)", opacity: 0.65 }} />

      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,252,246,0.88)" }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="select-none flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
              {logoDisplayMode !== "text" && (
                brandLogoUrl ? (
                  <Image src={brandLogoUrl} alt="Logo" width={logoDisplayMode === "logo" ? 120 : 32} height={logoDisplayMode === "logo" ? 40 : 32} priority
                    className={`${logoDisplayMode === "logo" ? "h-10 w-auto" : "h-8 w-8"} object-contain`} />
                ) : <LogoMark />
              )}
              {logoDisplayMode !== "logo" && (
                <span className="text-xl font-display font-bold" style={{ color: "var(--terracotta-dark)", letterSpacing: "-0.01em" }}>{displayAppName}</span>
              )}
            </Link>

            <Link href="/events" className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all" style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--terracotta)"; (e.currentTarget as HTMLElement).style.color = "var(--terracotta-dark)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}>
              <Calendar size={13} style={{ color: "var(--terracotta)" }} />Events
            </Link>

            <button onClick={() => setShowLocationPicker(true)} className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-2 transition-all max-w-[160px] sm:max-w-[200px]"
              style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
              <MapPin size={12} style={{ color: "var(--terracotta)", flexShrink: 0 }} />
              <span className="truncate">{selectedLocation ? selectedLocation.display_name.split(",")[0] : "Select Location"}</span>
              <span style={{ color: "var(--ink-soft)", fontSize: 8 }}>▼</span>
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LanguageSelector /></div>

            <Link href="/donate" className="hidden sm:flex items-center gap-1 px-4 py-2 rounded-full text-xs font-display font-semibold uppercase tracking-wider transition-all"
              style={{ background: "var(--terracotta)", color: "var(--paper)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta-dark)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta)"; }}>
              <Plus size={11} strokeWidth={3} />Upload
            </Link>

            <Link href="/dashboard?tab=claims" title="Messages" className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center transition-all"
              style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
              <MessageSquare size={16} />
            </Link>

            {/* Quota chip */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold" style={{ background: "var(--sage-soft)", color: "#5C7240" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sage)", display: "inline-block" }} />
              {trialDaysLeft > 0 || getClaimLimitLabel() === "Unlimited"
                ? `🎁 ${claimCount} items`
                : `🎁 ${claimCount} / ${getClaimLimitLabel()} free`}
            </div>

            {/* Notifications */}
            <div className="relative notifications-container">
              <button onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markNotificationsRead(); }}
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
                <Bell size={16} />
                {unreadCount > 0 && <span className="absolute" style={{ top: 9, right: 9, width: 8, height: 8, borderRadius: "50%", background: "var(--terracotta)", border: "2px solid var(--paper)" }} />}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-3xl shadow-xl z-50 overflow-hidden" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <div className="flex justify-between items-center px-4 pt-4 pb-2" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>Recent Alerts</span>
                    <div className="flex gap-3">
                      {unreadCount > 0 && <button onClick={markNotificationsRead} className="text-[10px] font-semibold" style={{ color: "var(--teal)" }}>Mark read</button>}
                      {notifications.length > 0 && <button onClick={clearAllNotifications} className="text-[10px] font-semibold" style={{ color: "var(--terracotta-dark)" }}>Clear all</button>}
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-64 p-2 space-y-1">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-[10px]" style={{ color: "var(--ink-soft)" }}>No recent alerts.</p>
                    ) : notifications.map(n => (
                      <Link key={n.id} href={n.link || "/dashboard"} onClick={() => setShowNotifications(false)}
                        className="flex items-start gap-3 p-2.5 rounded-xl transition-all"
                        style={{ background: n.is_read ? "transparent" : "rgba(78,156,151,0.08)", borderLeft: n.is_read ? "none" : "2px solid var(--teal)" }}>
                        <div className="mt-0.5 shrink-0 p-1.5 rounded-lg" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>{getNotificationIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold line-clamp-1" style={{ color: "var(--ink)" }}>{n.title}</p>
                          <p className="text-[10px] line-clamp-2" style={{ color: "var(--ink-soft)" }}>{n.body}</p>
                          <span className="text-[8px]" style={{ color: "var(--ink-soft)" }}>{formatTimeAgo(n.created_at)}</span>
                        </div>
                        {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--teal)", flexShrink: 0, marginTop: 6 }} />}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative user-menu-container">
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm"
                style={{ background: "linear-gradient(135deg, var(--teal), var(--sage))", color: "#fff", border: "2px solid var(--paper)" }}>
                {user.name ? user.name[0].toUpperCase() : <UserIcon size={14} />}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-72 rounded-3xl shadow-xl z-50 overflow-hidden" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
                  <div className="p-4 space-y-3">
                    <Link href={`/profile/${user.id}`} onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold"
                        style={{ background: "linear-gradient(135deg, var(--teal), var(--sage))", color: "#fff" }}>
                        {user.name ? user.name[0].toUpperCase() : <UserIcon size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>{user.name || "User"}</p>
                        <p className="text-[10px] truncate" style={{ color: "var(--ink-soft)" }}>{user.email}</p>
                      </div>
                    </Link>

                    {[
                      { href: `/profile/${user.id}`, label: "View Profile", icon: <UserIcon size={14} /> },
                      { href: "/dashboard?tab=claims", label: "Messages", icon: <MessageSquare size={14} /> },
                      { href: "/dashboard", label: "Dashboard", icon: <Grid size={14} /> },
                      { href: "/donate", label: "Donate an Item", icon: <Plus size={14} /> },
                    ].map(item => (
                      <Link key={item.href} href={item.href} onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{ color: "var(--ink)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--cream)"; (e.currentTarget as HTMLElement).style.color = "var(--terracotta-dark)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}>
                        <span style={{ color: "var(--ink-soft)" }}>{item.icon}</span>{item.label}
                      </Link>
                    ))}

                    {/* Invite & Earn */}
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
                      <div className="flex justify-between text-[10px]">
                        <span className="font-bold" style={{ color: "var(--ink)" }}>🎁 Invite & Earn</span>
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--ink-soft)" }}>Get <strong style={{ color: "var(--terracotta)" }}>+2 claims</strong> for each friend referred.</p>
                      <div className="flex gap-1.5">
                        <input readOnly value={refLink} className="flex-1 text-[9px] rounded-lg px-2 py-1 outline-none select-all"
                          style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink)" }} />
                        <button onClick={() => { navigator.clipboard.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                          className="px-2 py-1 rounded-lg text-[9px] font-bold transition-all"
                          style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Join ${displayAppName}: ${refLink}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-full flex items-center justify-center py-1 rounded-lg text-[9.5px] font-bold"
                        style={{ background: "#25D366", color: "#fff" }}>Share Invite</a>
                    </div>

                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                      <div className="sm:hidden pb-3 mb-3" style={{ borderBottom: "1px solid var(--line)" }}><LanguageSelector /></div>
                      <button onClick={() => { setShowUserMenu(false); handleLogout(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all"
                        style={{ color: "var(--terracotta-dark)" }}>
                        <LogOut size={14} />Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Campaign banner */}
      {activeCampaign && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--terracotta-soft)", color: "var(--terracotta)" }}>
              <Sparkles size={18} />
            </span>
            <div>
              <p className="text-sm font-display font-semibold" style={{ color: "var(--ink)" }}>🎉 {activeCampaign.campaign_name || "Special Campaign Active!"}</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                {activeCampaign.campaign_type === "unlimited" ? "Enjoy unlimited claims!" : `Claim limits expanded to ${activeCampaign.campaign_limit} items this month!`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-3xl sm:text-5xl font-display font-bold leading-tight mb-3" style={{ color: "var(--ink)" }}>
          Find Free Items &amp;{" "}
          <span className="relative inline-block" style={{ color: "var(--terracotta)" }}>
            Skills Nearby
            <svg className="absolute w-full" style={{ bottom: -10, left: 0, height: 14 }} viewBox="0 0 300 14" preserveAspectRatio="none">
              <path d="M2 10 Q75 2 150 8 T298 6" stroke="var(--golden)" strokeWidth="5" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="text-sm max-w-md" style={{ color: "var(--ink-soft)" }}>
          Reduce landfill waste. Declutter your home. Share your talent. Help your neighbors.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="max-w-7xl mx-auto px-4 pb-4 space-y-3">
        {/* Search card */}
        {/* Search card */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-3xl" style={{ background: "var(--paper)", border: "1.5px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
          <div className="flex-1 min-w-[220px] flex items-center gap-2.5 px-4 py-2.5">
            <Search size={18} style={{ color: "var(--ink-soft)", flexShrink: 0 }} />
            <input type="text" placeholder={t("search_placeholder")} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm font-semibold"
              style={{ fontFamily: "'Quicksand', sans-serif", color: "var(--ink)" }} />
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 max-sm:w-full sm:border-l sm:border-[var(--line)]">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Condition:</span>
            <select value={selectedCondition} onChange={e => setSelectedCondition(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold cursor-pointer" style={{ color: "var(--ink)", fontFamily: "'Quicksand', sans-serif" }}>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 max-sm:w-full sm:border-l sm:border-[var(--line)]">
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Distance:</span>
            <select value={selectedRadius} onChange={e => handleRadiusChange(e.target.value)} disabled={detectingCoords}
              className="bg-transparent border-none outline-none text-xs font-bold cursor-pointer" style={{ color: "var(--ink)", fontFamily: "'Quicksand', sans-serif" }}>
              <option value="All">Anywhere</option>
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
              <option value="50">Within 50 km</option>
            </select>
            {detectingCoords && <Loader2 className="animate-spin" size={12} style={{ color: "var(--terracotta)" }} />}
          </div>
        </div>

        {/* Type toggles */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(["all", "item", "skill"] as const).map(type => (
            <button key={type} onClick={() => { setSelectedListingType(type); setSelectedCategory("All"); }}
              className="px-5 py-2.5 rounded-full text-xs font-display font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer"
              style={selectedListingType === type
                ? { background: "var(--ink)", color: "var(--paper)", border: "1.5px solid var(--ink)" }
                : { background: "var(--paper)", color: "var(--ink-soft)", border: "1.5px solid var(--line)" }}>
              {type === "all" ? "🌐 All Listings" : type === "item" ? "📦 Items" : "🎯 Skills"}
            </button>
          ))}
        </div>

        {/* Category pills */}
        {selectedListingType !== "skill" && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {["All", ...itemCategories].map(cat => {
              const { emoji, name } = cat === "All" ? { emoji: "🌐", name: "All" } : parseCategory(cat);
              const active = selectedCategory === cat;
              return (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer"
                  style={active
                    ? { background: "var(--terracotta-soft)", border: "1.5px solid var(--terracotta)", color: "var(--terracotta-dark)", fontWeight: 700 }
                    : { background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
                  <span>{emoji}</span><span>{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Proximity map */}
      {selectedRadius !== "All" && userCoords && (
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <ProximityMap listings={listings} userLocation={userCoords} />
        </div>
      )}

      {/* Listings */}
      <div className="max-w-7xl mx-auto px-4 mt-4 space-y-10">
        {/* Offline banner */}
        {isOffline && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl" style={{ background: "var(--golden-soft)", border: "1px solid var(--golden)", color: "var(--ink)" }}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "var(--terracotta)" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--terracotta)" }} />
              </span>
              Offline Mode — Showing Cached Items
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-lg" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>Cached</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ border: "2px dashed var(--line)", background: "var(--paper)" }}>
            <Grid className="mx-auto mb-4" size={40} style={{ color: "var(--ink-soft)" }} />
            <p className="text-base font-display font-semibold" style={{ color: "var(--ink)" }}>{t("no_items_found")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{t("no_items_desc")}</p>
          </div>
        ) : (
          <>
            {/* Trending */}
            {trendingListings.length > 0 && !searchTerm && selectedCategory === "All" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid var(--line)" }}>
                  <h2 className="text-sm font-display font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <Sparkles size={16} style={{ color: "var(--terracotta)" }} />{t("trending_items")}
                  </h2>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--ink-soft)" }}>Most viewed nearby</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {trendingListings.map((item, i) => <ListingCard key={`tr-${item.id}`} item={item} index={i} />)}
                </div>
              </div>
            )}

            {/* Fresh listings */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid var(--line)" }}>
                <h2 className="text-sm font-display font-semibold uppercase tracking-wider" style={{ color: "var(--ink)" }}>
                  {searchTerm || selectedCategory !== "All" ? "Filtered Results" : t("fresh_listings")}
                </h2>
                {selectedLocation && <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>Showing items in {selectedLocation.city || "your area"}</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {listings.map((item, i) => <ListingCard key={item.id} item={item} index={i} />)}
              </div>

              <div className="pt-8 flex flex-col items-center gap-4">
                {isFetchingMore && (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} style={{ color: "var(--terracotta)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Loading next items...</span>
                  </div>
                )}
                {hasMore && page < 3 && !isFetchingMore && <div id="feed-sentinel" className="h-4 w-full" />}
                {hasMore && page >= 3 && !isFetchingMore && (
                  <button onClick={() => setPage(p => p + 1)}
                    className="px-6 py-3 rounded-full text-xs font-display font-semibold uppercase tracking-wider transition-all cursor-pointer"
                    style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
                    Load More Listings
                  </button>
                )}
                {!hasMore && listings.length > 0 && (
                  <p className="text-[10px] italic font-semibold py-6" style={{ color: "var(--ink-soft)" }}>🎉 You've seen all listings!</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-soft)" }}>
        <p>© {new Date().getFullYear()} {displayAppName}. All rights reserved.</p>
        <div className="flex flex-wrap justify-center gap-6 font-semibold uppercase tracking-wider text-[10px]">
          <Link href="/terms" style={{ color: "var(--ink-soft)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--terracotta)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"; }}>Terms</Link>
          <Link href="/privacy" style={{ color: "var(--ink-soft)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--terracotta)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"; }}>Privacy</Link>
          <a href={`mailto:${supportEmail}`} style={{ color: "var(--ink-soft)" }}>Grievance</a>
        </div>
      </footer>

      <LocationPickerModal isOpen={showLocationPicker} onClose={() => setShowLocationPicker(false)} onSelectLocation={handleSelectLocation} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LANDING PAGE (logged-out)
══════════════════════════════════════════════════════════════ */
function LandingPageView({ listings, trendingListings, lang }: { listings: any[]; trendingListings: any[]; lang: Language }) {
  const { appName, appShortName, supportEmail, brandLogoUrl, logoDisplayMode } = useBranding();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [previewTab, setPreviewTab] = useState<"all" | "item" | "skill">("all");
  const t = (key: any) => getTranslation(key, lang);
  const displayAppName = appName === "FreeShare India" ? t("app_title") : appName;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const filteredListings = listings.filter(item => previewTab === "all" || item.listing_type === previewTab);

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: "var(--cream)", color: "var(--ink)", fontFamily: "'Quicksand', sans-serif" }}>
      {/* Blobs */}
      <div className="absolute pointer-events-none -z-10" style={{ top: -120, right: -80, width: 320, height: 320, borderRadius: "50%", background: "var(--golden-soft)", filter: "blur(80px)", opacity: 0.65 }} />
      <div className="absolute pointer-events-none -z-10" style={{ top: 280, left: -100, width: 260, height: 260, borderRadius: "50%", background: "var(--sage-soft)", filter: "blur(80px)", opacity: 0.65 }} />
      <div className="absolute pointer-events-none -z-10" style={{ top: 60, right: "18%", width: 200, height: 200, borderRadius: "50%", background: "var(--teal-soft)", filter: "blur(80px)", opacity: 0.65 }} />

      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ borderBottom: "1px solid var(--line)", background: "rgba(255,252,246,0.88)" }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 cursor-pointer">
              {logoDisplayMode !== "text" && (
                brandLogoUrl ? (
                  <Image src={brandLogoUrl} alt="Logo" width={logoDisplayMode === "logo" ? 120 : 32} height={logoDisplayMode === "logo" ? 40 : 32} priority
                    className={`${logoDisplayMode === "logo" ? "h-10 w-auto" : "h-8 w-8"} object-contain`} />
                ) : <LogoMark />
              )}
              {logoDisplayMode !== "logo" && (
                <span className="text-xl font-display font-bold" style={{ color: "var(--terracotta-dark)" }}>{displayAppName}</span>
              )}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ink-soft)" }}>
            {[["features","Our Pillars"],["how-it-works","How it Works"],["trending-preview","Browse Live"],["impact","Impact"]].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} className="relative py-1 group cursor-pointer transition-all"
                style={{ color: "var(--ink-soft)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--terracotta)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"; }}>
                {label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <LanguageSelector />
            <Link href="/login" className="text-xs font-bold px-3 py-2 transition-all" style={{ color: "var(--ink-soft)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--terracotta)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--ink-soft)"; }}>Log in</Link>
            <Link href="/register" className="text-xs font-display font-semibold px-5 py-2.5 rounded-full transition-all"
              style={{ background: "var(--terracotta)", color: "var(--paper)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta-dark)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta)"; }}>
              Sign up
            </Link>
          </div>

          <button onClick={() => setShowMobileMenu(true)} className="sm:hidden w-10 h-10 rounded-full flex flex-col justify-center items-center gap-1.5"
            style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
            <span className="w-5 h-0.5 rounded-full" style={{ background: "currentcolor" }} />
            <span className="w-5 h-0.5 rounded-full" style={{ background: "currentcolor" }} />
            <span className="w-4 h-0.5 rounded-full self-start ml-1.5" style={{ background: "currentcolor" }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[60] sm:hidden">
          <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(74,58,46,0.5)" }} onClick={() => setShowMobileMenu(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-6 pt-5 pb-10 space-y-3" style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}>
            <div className="w-12 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--line)" }} />
            <Link href="/login" onClick={() => setShowMobileMenu(false)}
              className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-bold transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
              Log in <ArrowRight size={16} style={{ color: "var(--ink-soft)" }} />
            </Link>
            <Link href="/register" onClick={() => setShowMobileMenu(false)}
              className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl text-sm font-display font-semibold transition-all"
              style={{ background: "var(--terracotta)", color: "var(--paper)" }}>
              Create Free Account <ArrowRight size={16} />
            </Link>
            <div className="pt-2"><LanguageSelector /></div>
          </div>
        </div>
      )}

      {/* ─── Hero ─── */}
      <section className="relative max-w-7xl mx-auto px-4 pt-16 pb-16 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide"
              style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--terracotta)" }}>
              <Sparkles size={12} style={{ color: "var(--terracotta)" }} />
              India's Premium Sharing & Skill Exchange Network
            </div>
            <h1 className="text-4xl sm:text-6xl font-display font-bold leading-tight" style={{ color: "var(--ink)" }}>
              Pass On Unused Items,{" "}
              <span className="relative inline-block" style={{ color: "var(--terracotta)" }}>
                Share Your Skills
                <svg className="absolute w-full" style={{ bottom: -12, left: 0, height: 14 }} viewBox="0 0 300 14" preserveAspectRatio="none">
                  <path d="M2 10 Q75 2 150 8 T298 6" stroke="var(--golden)" strokeWidth="5" fill="none" strokeLinecap="round" />
                </svg>
              </span>{" "}Nearby
            </h1>
            <p className="text-base max-w-xl mx-auto lg:mx-0 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Why buy when you can share? Get items you need, learn new skills, and volunteer in local drives. All 100% free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-xs font-display font-semibold uppercase tracking-wider transition-all"
                style={{ background: "var(--terracotta)", color: "var(--paper)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta-dark)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta)"; }}>
                Join Now (Free) <ArrowRight size={14} />
              </Link>
              <button onClick={() => scrollTo("trending-preview")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                style={{ background: "var(--paper)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
                <Search size={14} /> Browse Nearby
              </button>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-3 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="flex -space-x-2.5">
                {["1534528741775","1507003211169","1494790108377"].map((id) => (
                  <img key={id} className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid var(--paper)" }}
                    src={`https://images.unsplash.com/photo-${id}-53994a69daeb?auto=format&fit=crop&q=80&w=100`} alt="User" />
                ))}
              </div>
              <p className="text-[10px] text-left leading-normal" style={{ color: "var(--ink-soft)" }}>
                Join <strong style={{ color: "var(--ink)" }}>local changemakers</strong> building a sustainable India 💚
              </p>
            </div>
          </div>

          {/* Hero visual cards */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="relative w-full max-w-sm h-96">
              {[
                { style: { top: 8, left: 16, transform: "rotate(-3deg)" }, icon: <Gift size={16} style={{ color: "var(--teal)" }} />, bg: "var(--teal-soft)", title: "Sofa Couch Set", sub: "2.1 km away", badge: "● Like New", badgeColor: "var(--teal)" },
                { style: { top: "32%", right: 8, transform: "rotate(2deg)" }, icon: <Sparkles size={16} style={{ color: "#7c3aed" }} />, bg: "#ede9fe", title: "Spoken English Class", sub: "Online / Live", badge: "⚡ Skill", badgeColor: "#7c3aed" },
                { style: { bottom: 24, left: 24, transform: "rotate(-1deg)" }, icon: <Calendar size={16} style={{ color: "var(--golden)" }} />, bg: "var(--golden-soft)", title: "Book Drive", sub: "Lajpat Nagar", badge: "📅 Campaign", badgeColor: "var(--terracotta)" },
              ].map((card, i) => (
                <div key={i} className="absolute w-52 rounded-2xl p-4 transition-transform hover:scale-105 hover:z-10 cursor-pointer"
                  style={{ ...card.style, background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: card.bg }}>{card.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold truncate" style={{ color: "var(--ink)" }}>{card.title}</p>
                      <p className="text-[8px] flex items-center gap-0.5" style={{ color: "var(--ink-soft)" }}><MapPin size={8} /> {card.sub}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: "1px dashed var(--line)" }}>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ color: card.badgeColor, background: card.bg }}>{card.badge}</span>
                    <span className="text-[9px]" style={{ color: "var(--ink-soft)" }}>100% Free</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Impact metrics ─── */}
      <section id="impact" className="py-12" style={{ background: "var(--paper)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-7xl mx-auto px-4 text-center space-y-8">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: "var(--terracotta-soft)", color: "var(--terracotta-dark)" }}>Our Collective Target</span>
            <h3 className="text-xl sm:text-2xl font-display font-semibold mt-3" style={{ color: "var(--ink)" }}>Launch Goals we are achieving together</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Items Gifted", val: "10,000+", color: "var(--teal)" },
              { label: "Skill Exchange", val: "1,000+ Hrs", color: "#7c3aed" },
              { label: "Campaigns", val: "200+ Events", color: "var(--terracotta)" },
              { label: "Waste Diverted", val: "5 Tons", color: "var(--sage)" },
            ].map(m => (
              <div key={m.label} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: "var(--ink-soft)" }}>{m.label}</span>
                <span className="text-3xl sm:text-4xl font-display font-bold" style={{ color: m.color }}>{m.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Three Pillars ─── */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-display font-bold" style={{ color: "var(--ink)" }}>
            One Platform. <span style={{ color: "var(--terracotta)" }}>Three Pillars.</span>
          </h2>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Build connections, reduce waste, and exchange value freely.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Gift size={22} style={{ color: "var(--teal)" }} />, bg: "var(--teal-soft)", title: "Share Free Items", desc: "Gift books, clothes, furniture to neighbors. Prevent waste with local reuse.", points: ["Radius-based searching","Verified trust scores","Secure in-app chat"] },
            { icon: <Sparkles size={22} style={{ color: "#7c3aed" }} />, bg: "#ede9fe", title: "Empower with Skills", desc: "Share mentoring, tutorials, or garden advice. Help others grow without fees.", points: ["Online & local sessions","Flexible time slots","Learner review forms"] },
            { icon: <Calendar size={22} style={{ color: "var(--golden)" }} />, bg: "var(--golden-soft)", title: "Organize Drives", desc: "Connect with NGOs or start campaigns — food drives, cleanups, and more.", points: ["Real-time RSVP","Interactive event maps","NGO host badges"] },
          ].map(p => (
            <div key={p.title} className="rounded-3xl p-8 space-y-5 transition-all group"
              style={{ background: "var(--paper)", border: "1.5px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--terracotta)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: p.bg }}>{p.icon}</div>
              <div className="space-y-2">
                <h3 className="text-lg font-display font-semibold flex items-center gap-2 transition-all" style={{ color: "var(--ink)" }}>{p.title}
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-all" style={{ color: "var(--terracotta)" }} />
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{p.desc}</p>
              </div>
              <ul className="text-[11px] space-y-2 pt-4" style={{ color: "var(--ink-soft)", borderTop: "1px solid var(--line)" }}>
                {p.points.map(pt => <li key={pt} className="flex items-center gap-2">✓ {pt}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 py-20 text-center" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="max-w-xl mx-auto mb-14 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ background: "var(--terracotta-soft)", color: "var(--terracotta-dark)" }}>3 Easy Steps</span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold mt-3" style={{ color: "var(--ink)" }}>How {appShortName} Works</h2>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Join, upload, and start sharing with community members nearby.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Smartphone size={24} style={{ color: "var(--teal)" }} />, bg: "var(--teal-soft)", title: "1. Post in Seconds", desc: "Upload items to gift, describe a skill, or pin a cleanup event." },
            { icon: <MessageSquare size={24} style={{ color: "#7c3aed" }} />, bg: "#ede9fe", title: "2. Chat & Coordinate", desc: "Use secure in-app messaging to verify details and arrange handoffs." },
            { icon: <HeartHandshake size={24} style={{ color: "var(--golden)" }} />, bg: "var(--golden-soft)", title: "3. Earn Karma", desc: "Complete the exchange, rate each other, and unlock green impact badges!" },
          ].map(s => (
            <div key={s.title} className="rounded-3xl p-8 space-y-4 flex flex-col items-center transition-all"
              style={{ background: "var(--paper)", border: "1.5px solid var(--line)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--terracotta)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: s.bg }}>{s.icon}</div>
              <h3 className="font-bold text-sm" style={{ color: "var(--ink)" }}>{s.title}</h3>
              <p className="text-xs max-w-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Live Preview ─── */}
      <section id="trending-preview" className="max-w-7xl mx-auto px-4 py-20" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="flex flex-col sm:flex-row items-center justify-between pb-4 mb-8 gap-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-display font-bold flex items-center gap-2 justify-center sm:justify-start" style={{ color: "var(--ink)" }}>
              <Sparkles size={18} style={{ color: "var(--terracotta)" }} /> Live Sharing Preview
            </h2>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Real-time listings. Sign up to claim or schedule.</p>
          </div>
          <div className="flex p-1.5 rounded-xl gap-1" style={{ background: "var(--cream)", border: "1px solid var(--line)" }}>
            {(["all","item","skill"] as const).map(tab => (
              <button key={tab} onClick={() => setPreviewTab(tab)}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                style={previewTab === tab ? { background: "var(--ink)", color: "var(--paper)" } : { color: "var(--ink-soft)" }}>
                {tab === "all" ? "All" : tab === "item" ? "Items" : "Skills"}
              </button>
            ))}
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-20 rounded-3xl" style={{ border: "2px dashed var(--line)", background: "var(--paper)" }}>
            <Gift className="mx-auto mb-3" size={36} style={{ color: "var(--ink-soft)" }} />
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>No active {previewTab !== "all" ? previewTab + "s" : "listings"} right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredListings.slice(0, 8).map((item, i) => <ListingCard key={item.id} item={item} index={i} />)}
          </div>
        )}
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="rounded-3xl p-8 sm:p-16 text-center space-y-6 relative overflow-hidden"
          style={{ background: "var(--paper)", border: "1.5px solid var(--line)", boxShadow: "var(--shadow)" }}>
          <h2 className="text-3xl sm:text-4xl font-display font-bold" style={{ color: "var(--ink)" }}>Ready to Start Sharing?</h2>
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Join thousands giving away goods, training others, and building cleaner neighborhoods.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-xs font-display font-semibold uppercase tracking-wider transition-all"
              style={{ background: "var(--terracotta)", color: "var(--paper)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta-dark)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--terracotta)"; }}>
              Create Your Account
            </Link>
            <button onClick={() => scrollTo("trending-preview")}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              style={{ background: "var(--cream)", border: "1.5px solid var(--line)", color: "var(--ink)" }}>
              Explore Feed
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 mt-8 text-[9px] uppercase tracking-widest font-bold" style={{ borderTop: "1px solid var(--line)", color: "var(--ink)" }}>
            <div className="flex items-center justify-center gap-1.5"><ShieldCheck size={14} style={{ color: "var(--teal)" }} /> Verified</div>
            <div className="flex items-center justify-center gap-1.5"><Gift size={14} style={{ color: "var(--teal)" }} /> 100% Free</div>
            <div className="flex items-center justify-center gap-1.5"><MapPin size={14} style={{ color: "var(--teal)" }} /> Proximity</div>
            <div className="flex items-center justify-center gap-1.5"><ShieldCheck size={14} style={{ color: "var(--teal)" }} /> Secure</div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="max-w-7xl mx-auto px-4 py-10 text-center mt-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs"
        style={{ borderTop: "1px solid var(--line)", color: "var(--ink-soft)" }}>
        <p>© {new Date().getFullYear()} {displayAppName}. All rights reserved.</p>
        <div className="flex flex-wrap justify-center gap-6 font-semibold uppercase tracking-wider text-[10px]">
          <Link href="/terms" style={{ color: "var(--ink-soft)" }}>Terms</Link>
          <Link href="/privacy" style={{ color: "var(--ink-soft)" }}>Privacy</Link>
          <a href={`mailto:${supportEmail}`} style={{ color: "var(--ink-soft)" }}>Grievance</a>
        </div>
      </footer>
    </div>
  );
}

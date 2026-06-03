"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Gift, ClipboardList, Check, X, MessageSquare, AlertCircle, Calendar, ArrowLeft, Star, Bell, CheckCircle, Sparkles, Clock, ArrowUpDown, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";

type TabState = "donations" | "claims";

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabState>("donations");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Data States
  const [myListings, setMyListings] = useState<any[]>([]);
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [pendingAppeals, setPendingAppeals] = useState<string[]>([]);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealListingId, setAppealListingId] = useState<string | null>(null);
  const [appealExplanation, setAppealExplanation] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealError, setAppealError] = useState("");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Sub-claims mapping (claims received for each of my listings)
  const [claimsReceived, setClaimsReceived] = useState<{ [listingId: string]: any[] }>({});

  // Donation Manager Workspace States
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [shortlistedClaimIds, setShortlistedClaimIds] = useState<string[]>([]);
  const [claimsSortKey, setClaimsSortKey] = useState<"newest" | "oldest" | "trust" | "first-time">("newest");
  const [requesterStats, setRequesterStats] = useState<{ [receiverId: string]: { totalCompleted: number; completedFromMe: number } }>({});
  const [showDeclinedDrawer, setShowDeclinedDrawer] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Review Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewClaimId, setReviewClaimId] = useState<string | null>(null);
  const [reviewedUserId, setReviewedUserId] = useState<string | null>(null);
  const [reviewedUserName, setReviewedUserName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRole, setReviewRole] = useState<"donor_reviewing_receiver" | "receiver_reviewing_donor">("donor_reviewing_receiver");
  const [submittingReview, setSubmittingReview] = useState(false);

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
    if (!userId) return;
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error("Mark notifications read error:", err);
    }
  };
  const clearAllNotifications = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Clear notifications error:", err);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?next=/dashboard");
        return;
      }
      setUserId(data.user.id);
      await loadDashboardData(data.user.id);
      await fetchNotifications(data.user.id);
      setLoading(false);
    };
    fetchUserData();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    // 1. Subscribe to new notifications in real-time
    const notifChannel = supabase
      .channel(`realtime_notifications_dashboard:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotif = payload.new;
          if (newNotif.user_id !== userId) return;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    // 2. Subscribe to claims changes to auto-reload dashboard data in real-time
    const claimsChannel = supabase
      .channel(`realtime_claims_dashboard:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "claims",
        },
        () => {
          loadDashboardData(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(claimsChannel);
    };
  }, [userId]);

  const loadDashboardData = async (uid: string) => {
    try {
      const { data: listings } = await supabase
        .from("listings")
        .select("*")
        .eq("donor_id", uid)
        .order("created_at", { ascending: false });

      const listed = listings || [];
      setMyListings(listed);

      if (listed.length > 0) {
        const listingIds = listed.map((l) => l.id);

        // Fetch pending appeals for listings
        const { data: appeals } = await supabase
          .from("reports")
          .select("reported_listing_id")
          .eq("reason", "other")
          .like("description", "[APPEAL]%")
          .eq("status", "pending")
          .in("reported_listing_id", listingIds);

        if (appeals) {
          setPendingAppeals(appeals.map((a: any) => a.reported_listing_id));
        } else {
          setPendingAppeals([]);
        }
        const { data: claims } = await supabase
          .from("claims")
          .select(`
            *,
             receiver:receiver_id(id, name, trust_score, avatar_url, is_ngo)
          `)
          .in("listing_id", listingIds)
          .order("created_at", { ascending: false });

        const claimsMap: { [listingId: string]: any[] } = {};
        listingIds.forEach((id) => {
          claimsMap[id] = [];
        });

        const claimsList = claims || [];
        claimsList.forEach((claim) => {
          claimsMap[claim.listing_id].push(claim);
        });

        setClaimsReceived(claimsMap);

        // Fetch completed claims stats for all unique requesters
        const receiverIds = Array.from(new Set(claimsList.map((c) => c.receiver_id)));
        if (receiverIds.length > 0) {
          const { data: pastClaims } = await supabase
            .from("claims")
            .select("id, receiver_id, donor_id, status")
            .in("receiver_id", receiverIds)
            .eq("status", "completed");

          const statsMap: { [receiverId: string]: { totalCompleted: number; completedFromMe: number } } = {};
          receiverIds.forEach((rid) => {
            statsMap[rid] = { totalCompleted: 0, completedFromMe: 0 };
          });

          pastClaims?.forEach((c) => {
            if (!statsMap[c.receiver_id]) {
              statsMap[c.receiver_id] = { totalCompleted: 0, completedFromMe: 0 };
            }
            statsMap[c.receiver_id].totalCompleted += 1;
            if (c.donor_id === uid) {
              statsMap[c.receiver_id].completedFromMe += 1;
            }
          });

          setRequesterStats(statsMap);
        }
      }

      // Default the selected listing if none is set
      if (listed.length > 0) {
        setSelectedListingId((prev) => {
          if (prev && listed.some((l) => l.id === prev)) return prev;
          return listed[0].id;
        });
      }

      const { data: claimsMade } = await supabase
        .from("claims")
        .select(`
          *,
          listing:listing_id(id, title, images, status, city, area)
        `)
        .eq("receiver_id", uid)
        .order("created_at", { ascending: false });

      setMyClaims(claimsMade || []);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setErrorMsg("Failed to load dashboard statistics.");
    }
  };

  const handleClaimAction = async (claimId: string, action: "accepted" | "declined" | "completed" | "cancelled", extraDetails?: any) => {
    setActionLoadingId(claimId);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action execution failed");

      // Reload dashboard data
      if (userId) await loadDashboardData(userId);

      // Trigger Review Modal if marked completed
      if (action === "completed" && extraDetails) {
        setReviewClaimId(claimId);
        setReviewedUserId(extraDetails.userId);
        setReviewedUserName(extraDetails.userName);
        setReviewRole(extraDetails.role);
        setShowReviewModal(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Operation failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !reviewClaimId || !reviewedUserId) return;

    setSubmittingReview(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_id: reviewClaimId,
          reviewer_id: userId,
          reviewed_id: reviewedUserId,
          rating: reviewRating,
          comment: reviewComment,
          role: reviewRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit review");

      setShowReviewModal(false);
      setReviewComment("");
      setReviewRating(5);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit feedback.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !appealListingId) return;

    if (appealExplanation.trim().length < 15) {
      setAppealError("Please provide a detailed explanation (minimum 15 characters)");
      return;
    }

    setAppealSubmitting(true);
    setAppealError("");
    setAppealMessage("");

    try {
      const res = await fetch("/api/listings/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: appealListingId,
          explanation: appealExplanation,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit appeal");

      if (data.restored) {
        setAppealMessage(data.message);
        // Instant restore: refresh lists & update selected listing status locally
        setMyListings((prev) =>
          prev.map((l) =>
            l.id === appealListingId
              ? { ...l, status: "available", admin_removed: false, is_flagged: false }
              : l
          )
        );
      } else {
        setAppealMessage(data.message);
        // Non-instant restore: add to pending appeals local list
        setPendingAppeals((prev) => [...prev, appealListingId]);
      }

      setTimeout(() => {
        setShowAppealModal(false);
        setAppealExplanation("");
        setAppealListingId(null);
      }, 4000);
    } catch (err: any) {
      setAppealError(err.message || "Failed to submit appeal request.");
    } finally {
      setAppealSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Loading user panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-16 selection:bg-teal-500 selection:text-black">
      
      {/* Header back button */}
      <div className="max-w-6xl mx-auto px-4 pt-6 flex justify-between items-center relative">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
        
        <div className="flex items-center gap-3">
          {/* Real-time Notifications Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && notifications.filter((n) => !n.is_read).length > 0) {
                  markNotificationsRead();
                }
              }}
              className="relative p-2 hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Bell size={18} />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-slate-950 animate-pulse" />
              )}
            </button>

            {/* Dropdown Box Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-3 z-50">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200">Recent Alerts</span>
                  <div className="flex gap-2.5">
                    {notifications.filter((n) => !n.is_read).length > 0 && (
                      <button
                        onClick={markNotificationsRead}
                        className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold"
                      >
                        Mark read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearAllNotifications}
                        className="text-[10px] text-red-400 hover:text-red-350 font-semibold"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2.5">
                  {notifications.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-4">No recent alerts found.</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link || "/dashboard"}
                        onClick={() => setShowNotifications(false)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors ${
                          n.is_read ? "hover:bg-slate-950/20" : "bg-teal-500/5 hover:bg-teal-500/10 border-l-2 border-teal-500"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                          {getNotificationIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-[11px] font-bold text-slate-200 line-clamp-1">{n.title}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{n.body}</p>
                          <span className="text-[8px] text-slate-550 block mt-1">{formatTimeAgo(n.created_at)}</span>
                        </div>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0 animate-pulse" />
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <span className="text-xs text-slate-400 font-bold bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
            User Dashboard
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        {/* Error panel */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center flex items-center justify-center gap-2">
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        {/* Dynamic tab switches */}
        <div className="flex gap-2 border-b border-slate-900 pb-2">
          <button
            onClick={() => setActiveTab("donations")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "donations"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Gift size={16} />
            My Donations ({myListings.length})
          </button>
          <button
            onClick={() => setActiveTab("claims")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === "claims"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ClipboardList size={16} />
            My Claims ({myClaims.length})
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === "donations" ? (
          /* Donations Splitscreen Workspace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {myListings.length === 0 ? (
              <div className="lg:col-span-12 text-center py-16 border border-dashed border-slate-900 rounded-3xl bg-slate-900/10">
                <Gift className="mx-auto text-slate-700 mb-3" size={32} />
                <p className="text-sm font-bold text-slate-400">No items listed yet</p>
                <Link href="/donate" className="text-xs text-teal-400 hover:underline mt-1 inline-block">Donate an item now</Link>
              </div>
            ) : (
              <>
                {/* Left sidebar: Listing selections */}
                <div className="lg:col-span-4 space-y-3 bg-slate-900/15 border border-slate-900/60 p-4 rounded-3xl max-h-[600px] overflow-y-auto">
                  <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1 pb-1">
                    My Listings ({myListings.length})
                  </h3>
                  <div className="space-y-2">
                    {myListings.map((item) => {
                      const allClaims = claimsReceived[item.id] || [];
                      const pendingCount = allClaims.filter((c) => c.status === "pending").length;
                      const isSelected = selectedListingId === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedListingId(item.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-slate-900/80 border-teal-500/30 shadow-md shadow-teal-500/5 text-slate-100"
                              : "bg-slate-950/20 border-transparent hover:bg-slate-900/30 text-slate-450 hover:text-slate-200"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 shrink-0 flex items-center justify-center">
                            {item.images?.[0] && !brokenImages[item.id] ? (
                              <img
                                src={item.images[0]}
                                alt="Listing thumbnail"
                                className="w-full h-full object-cover"
                                onError={() => setBrokenImages(prev => ({ ...prev, [item.id]: true }))}
                              />
                            ) : (
                              <ImageIcon className="text-slate-500" size={16} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-bold text-xs truncate">{item.title}</h4>
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                item.status === "available" ? "bg-teal-500/10 text-teal-400" :
                                item.status === "reserved" ? "bg-amber-500/10 text-amber-400" :
                                "bg-slate-850 text-slate-500"
                              }`}>
                                {item.status}
                              </span>
                              {pendingCount > 0 && (
                                <span className="bg-teal-500 text-slate-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                                  {pendingCount} new
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Detailed Workspace for selected listing */}
                <div className="lg:col-span-8 space-y-6">
                  {(() => {
                    const selectedItem = myListings.find((l) => l.id === selectedListingId);
                    if (!selectedItem) {
                      return (
                        <div className="text-center py-16 bg-slate-900/10 border border-slate-900 rounded-3xl text-slate-500 text-xs">
                          Select a listing from the sidebar to manage claims.
                        </div>
                      );
                    }

                    const allClaims = claimsReceived[selectedItem.id] || [];
                    const pendingClaims = allClaims.filter((c) => c.status === "pending");
                    const historicalClaims = allClaims.filter((c) => ["declined", "cancelled", "expired"].includes(c.status));
                    const activeClaim = allClaims.find((c) => c.id === selectedItem.active_claim_id);

                    // Sorting Logic
                    const sortedPendingClaims = [...pendingClaims].sort((a, b) => {
                      // Shortlisted items pinned to top
                      const isAShort = shortlistedClaimIds.includes(a.id);
                      const isBShort = shortlistedClaimIds.includes(b.id);
                      if (isAShort && !isBShort) return -1;
                      if (!isAShort && isBShort) return 1;

                      switch (claimsSortKey) {
                        case "oldest":
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        case "trust":
                          return (b.receiver?.trust_score || 5.0) - (a.receiver?.trust_score || 5.0);
                        case "first-time":
                          const aClaims = requesterStats[a.receiver_id]?.totalCompleted || 0;
                          const bClaims = requesterStats[b.receiver_id]?.totalCompleted || 0;
                          return aClaims - bClaims;
                        case "newest":
                        default:
                          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                      }
                    });

                    return (
                      <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6">
                        {/* Selected Item header detail */}
                        <div className="flex gap-4 items-center border-b border-slate-900/80 pb-4">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                            {selectedItem.images?.[0] && !brokenImages[selectedItem.id + "_selected"] ? (
                              <img
                                src={selectedItem.images[0]}
                                alt="Listing thumbnail"
                                className="w-full h-full object-cover"
                                onError={() => setBrokenImages(prev => ({ ...prev, [selectedItem.id + "_selected"]: true }))}
                              />
                            ) : (
                              <ImageIcon className="text-slate-500" size={18} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <h3 className="font-extrabold text-base text-slate-100">{selectedItem.title}</h3>
                            <p className="text-xs text-slate-400">{selectedItem.area}, {selectedItem.city}</p>
                            <span className={`inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                              selectedItem.status === "available" ? "bg-teal-500/10 text-teal-400" :
                              selectedItem.status === "reserved" ? "bg-amber-500/10 text-amber-400" :
                              "bg-slate-800 text-slate-500"
                            }`}>
                              {selectedItem.status}
                            </span>
                          </div>
                        </div>

                        {/* WARNING CARD FOR FLAGGED LISTING */}
                        {selectedItem.is_flagged && !selectedItem.admin_removed && (
                          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                              <div className="flex-1 space-y-1">
                                <h4 className="text-xs font-bold text-amber-450">Listing Flagged & Warning Triggered</h4>
                                <p className="text-[11px] text-slate-350 leading-relaxed">
                                  Your listing has been flagged by users for guidelines/spam/commercial reselling. Please review and edit your listing details within 24 hours to comply with community standards. Edits automatically resolve the warning and clear the flag.
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/listing/${selectedItem.id}?edit=true`}
                                className="text-[11px] font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5"
                              >
                                Edit & Resolve Listing
                              </Link>
                            </div>
                          </div>
                        )}

                        {/* WARNING CARD FOR SUSPENDED/ADMIN REMOVED LISTING */}
                        {selectedItem.admin_removed && (
                          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                              <div className="flex-1 space-y-1">
                                <h4 className="text-xs font-bold text-red-450">⛔ Listing Suspended & Hidden</h4>
                                <p className="text-[11px] text-slate-350 leading-relaxed">
                                  This listing was reported by the community and has been hidden from the public feed.
                                  {pendingAppeals.includes(selectedItem.id) 
                                    ? " Your appeal has been submitted and is currently under review by administrators." 
                                    : " If you believe this is a mistake, you can submit an appeal explaining why the listing complies with community guidelines."}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {pendingAppeals.includes(selectedItem.id) ? (
                                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/25 flex items-center gap-1.5">
                                  ⏳ Appeal Under Review
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAppealListingId(selectedItem.id);
                                    setAppealExplanation("");
                                    setAppealMessage("");
                                    setAppealError("");
                                    setShowAppealModal(true);
                                  }}
                                  className="text-[11px] font-extrabold bg-red-500 hover:bg-red-450 text-slate-100 px-3.5 py-1.5 rounded-xl transition-all"
                                >
                                  Appeal Relisting
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* RESERVED STATUS ACTION CARD */}
                        {selectedItem.status === "reserved" && activeClaim && (
                          <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div className="space-y-1">
                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Reserved For</span>
                                <Link href={`/profile/${activeClaim.receiver?.id}`} className="text-sm font-bold text-slate-200 hover:text-teal-400 hover:underline transition-colors block">
                                  {activeClaim.receiver?.name}
                                </Link>
                                {activeClaim.expires_at && (
                                  <span className="text-[9px] text-slate-500 flex items-center gap-1">
                                    <Calendar size={11} />
                                    Expires: {new Date(activeClaim.expires_at).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                <Link
                                  href={`/chat/${activeClaim.id}`}
                                  className="flex-1 sm:flex-none justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-teal-400 hover:bg-slate-850 py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors"
                                >
                                  <MessageSquare size={14} />
                                  Chat
                                </Link>
                                <button
                                  disabled={actionLoadingId !== null}
                                  onClick={() => handleClaimAction(activeClaim.id, "completed", {
                                    userId: activeClaim.receiver?.id,
                                    userName: activeClaim.receiver?.name,
                                    role: "donor_reviewing_receiver"
                                  })}
                                  className="flex-1 sm:flex-none justify-center text-xs font-bold bg-teal-500 text-slate-950 py-2 px-3 rounded-xl flex items-center gap-1 hover:bg-teal-400 transition-colors"
                                >
                                  <Check size={14} strokeWidth={3} />
                                  Handed-Over
                                </button>
                                <button
                                  disabled={actionLoadingId !== null}
                                  onClick={() => handleClaimAction(activeClaim.id, "cancelled")}
                                  className="flex-1 sm:flex-none justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-red-400 py-2 px-3 rounded-xl flex items-center gap-1 hover:bg-red-500/10 transition-colors"
                                >
                                  <X size={14} />
                                  No-Show
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* AVAILABLE / PENDING REQUESTS PANEL */}
                        {selectedItem.status === "available" && (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900/60 pb-3">
                              <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                                Pending Requests ({pendingClaims.length})
                              </h4>
                              
                              {pendingClaims.length > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-slate-500 flex items-center gap-1 text-[10px]"><ArrowUpDown size={12} /> Sort:</span>
                                  <select
                                    value={claimsSortKey}
                                    onChange={(e: any) => setClaimsSortKey(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-350 focus:outline-none focus:border-teal-500/50"
                                  >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="trust">Trust Score</option>
                                    <option value="first-time">First-time Requesters</option>
                                  </select>
                                </div>
                              )}
                            </div>

                            {pendingClaims.length === 0 ? (
                              <p className="text-xs text-slate-500 text-center py-8">Waiting for claims. Interested users will show up here.</p>
                            ) : (
                              <div className="space-y-3">
                                {sortedPendingClaims.map((claim) => {
                                  const stats = requesterStats[claim.receiver_id] || { totalCompleted: 0, completedFromMe: 0 };
                                  const isShortlisted = shortlistedClaimIds.includes(claim.id);

                                  return (
                                    <div
                                      key={claim.id}
                                      className={`p-4 rounded-2xl bg-slate-950/40 border transition-all space-y-3 ${
                                        isShortlisted ? "border-amber-500/30 bg-amber-500/[0.01]" : "border-slate-900"
                                      }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {/* Shortlist star */}
                                          <button
                                            onClick={() => {
                                              setShortlistedClaimIds((prev) =>
                                                isShortlisted ? prev.filter((id) => id !== claim.id) : [...prev, claim.id]
                                              );
                                            }}
                                            className={`p-1 rounded-full transition-colors ${
                                              isShortlisted ? "text-amber-400 hover:text-amber-500" : "text-slate-650 hover:text-slate-400"
                                            }`}
                                            title={isShortlisted ? "Remove Shortlist" : "Shortlist Requester"}
                                          >
                                            <Star size={14} fill={isShortlisted ? "currentColor" : "none"} />
                                          </button>

                                          <Link href={`/profile/${claim.receiver?.id}`} className="text-xs font-bold text-slate-200 hover:text-teal-400 hover:underline transition-colors inline-flex items-center gap-1.5">
                                            {claim.receiver?.name}
                                            {claim.receiver?.is_ngo && (
                                              <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase" title="Verified NGO / Charity">
                                                ♥ Verified NGO
                                              </span>
                                            )}
                                          </Link>

                                          {/* Trust Score */}
                                          <span className="text-[9px] text-slate-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 flex items-center gap-0.5">
                                            ★ {claim.receiver?.trust_score || "5.0"}
                                          </span>

                                          {/* Requester stats badges */}
                                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Total successful claims on the platform">
                                            🎁 {stats.totalCompleted} claimed
                                          </span>

                                          {stats.completedFromMe > 0 && (
                                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20" title="Previous successful claims from you">
                                              🤝 Got {stats.completedFromMe} from you
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex gap-1.5">
                                          <button
                                            disabled={actionLoadingId !== null}
                                            onClick={() => handleClaimAction(claim.id, "accepted")}
                                            className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-all cursor-pointer"
                                            title="Accept Request"
                                          >
                                            <Check size={14} />
                                          </button>
                                          <button
                                            disabled={actionLoadingId !== null}
                                            onClick={() => handleClaimAction(claim.id, "declined")}
                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                                            title="Decline Request"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      <p className="text-xs text-slate-350 leading-relaxed italic bg-slate-950/20 p-2.5 rounded-xl border border-slate-900/60">
                                        "{claim.message}"
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* HISTORICAL / DECLINED CLAIMS COLLAPSIBLE DRAWER */}
                        {historicalClaims.length > 0 && (
                          <div className="border-t border-slate-900/80 pt-4">
                            <button
                              onClick={() => setShowDeclinedDrawer(!showDeclinedDrawer)}
                              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 font-bold transition-all select-none"
                            >
                              {showDeclinedDrawer ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>Archived / Declined Requests ({historicalClaims.length})</span>
                            </button>

                            {showDeclinedDrawer && (
                              <div className="mt-3 space-y-2">
                                {historicalClaims.map((claim) => (
                                  <div key={claim.id} className="p-3.5 rounded-xl bg-slate-950/25 border border-slate-900/70 flex justify-between items-center gap-3">
                                    <div className="space-y-1 flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400">{claim.receiver?.name}</span>
                                        <span className={`text-[8px] font-extrabold uppercase px-1 py-0.25 rounded ${
                                          claim.status === "declined" ? "bg-red-500/10 text-red-400 border border-red-500/10" : "bg-slate-800 text-slate-500"
                                        }`}>
                                          {claim.status}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 italic truncate">"{claim.message}"</p>
                                    </div>
                                    <span className="text-[10px] text-slate-600 shrink-0">
                                      {formatTimeAgo(claim.created_at)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Claims made List mapping */
          <div className="space-y-4">
            {myClaims.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-900 rounded-3xl">
                <ClipboardList className="mx-auto text-slate-700 mb-3" size={32} />
                <p className="text-sm font-bold text-slate-400">No claims submitted yet</p>
                <Link href="/" className="text-xs text-teal-400 hover:underline mt-1 inline-block">Browse feed and claim items</Link>
              </div>
            ) : (
              myClaims.map((claim) => (
                <div key={claim.id} className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                      {claim.listing?.images?.[0] && !brokenImages[claim.id + "_claim"] ? (
                        <img
                          src={claim.listing.images[0]}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          onError={() => setBrokenImages(prev => ({ ...prev, [claim.id + "_claim"]: true }))}
                        />
                      ) : (
                        <ImageIcon className="text-slate-500" size={18} />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-slate-100">{claim.listing?.title}</h4>
                      <p className="text-[10px] text-slate-500">{claim.listing?.area}, {claim.listing?.city}</p>
                      <div className="flex items-center gap-2.5">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                          claim.status === "pending" ? "bg-slate-800 text-slate-400" :
                          claim.status === "accepted" ? "bg-emerald-500/10 text-emerald-400" :
                          claim.status === "declined" ? "bg-red-500/10 text-red-400" :
                          claim.status === "completed" ? "bg-teal-500/10 text-teal-400" :
                          "bg-slate-800 text-slate-500"
                        }`}>
                          {claim.status}
                        </span>
                        <Link href={`/profile/${claim.donor_id}`} className="text-[10px] text-teal-400 hover:text-teal-300 hover:underline font-bold transition-all">
                          View Donor Profile
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    {/* Rate Donor Button if completed */}
                    {claim.status === "completed" && (
                      <button
                        onClick={() => {
                          setReviewClaimId(claim.id);
                          setReviewedUserId(claim.donor_id);
                          setReviewedUserName("the Donor");
                          setReviewRole("receiver_reviewing_donor");
                          setShowReviewModal(true);
                        }}
                        className="w-full sm:w-auto text-xs font-bold bg-slate-900 border border-slate-850 hover:bg-slate-800 text-yellow-500 py-2.5 px-4 rounded-xl flex items-center gap-1"
                      >
                        <Star size={14} className="fill-yellow-500 text-yellow-500" />
                        Rate Donor
                      </button>
                    )}

                    {/* Chat navigation buttons if request is accepted */}
                    {claim.status === "accepted" && (
                      <Link
                        href={`/chat/${claim.id}`}
                        className="w-full sm:w-auto justify-center text-xs font-bold bg-teal-500 text-slate-950 py-2.5 px-4 rounded-xl flex items-center gap-1.5 hover:bg-teal-400 shadow-lg shadow-teal-500/10 transition-colors"
                      >
                        <MessageSquare size={14} />
                        Chat with Donor
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* RATING SUBMISSION MODAL OVERLAY */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-100">Rate Your Exchange</h3>
              <p className="text-xs text-slate-400">How was your experience sharing with {reviewedUserName}?</p>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Star selector */}
              <div className="flex justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      size={32}
                      className={star <= reviewRating ? "fill-yellow-500 text-yellow-500" : "text-slate-700"}
                    />
                  </button>
                ))}
              </div>

              {/* Written review comment */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                  Comment (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="e.g. Friendly behavior, arrived right on time!"
                  maxLength={200}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-xs font-bold text-slate-400 py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg transition-all"
                >
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* LISTING APPEAL MODAL OVERLAY */}
      {showAppealModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-100">Appeal Listing Removal</h3>
              <p className="text-xs text-slate-400">Explain why this item complies with community guidelines.</p>
            </div>

            {appealMessage ? (
              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-center space-y-2">
                <span className="text-2xl">🎉</span>
                <p className="text-xs text-slate-250 font-semibold">{appealMessage}</p>
                <p className="text-[10px] text-slate-500">This window will close automatically shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleAppealSubmit} className="space-y-4">
                {appealError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-450 font-semibold">
                    {appealError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Explanation / Appeal Details
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={appealExplanation}
                    onChange={(e) => setAppealExplanation(e.target.value)}
                    placeholder="e.g. This is a genuinely free study table that I am donating from my home. I am not selling this or running any business."
                    minLength={15}
                    maxLength={500}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-[10px] text-slate-500 block text-right">
                    {appealExplanation.length} / 500 characters
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAppealModal(false)}
                    className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-xs font-bold text-slate-400 py-3 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={appealSubmitting}
                    className="flex-1 bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-450 hover:to-amber-450 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg transition-all"
                  >
                    {appealSubmitting ? "Submitting..." : "Submit Appeal"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

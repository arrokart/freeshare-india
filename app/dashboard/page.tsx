"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Gift, ClipboardList, Check, X, MessageSquare, AlertCircle, Calendar, ArrowLeft, Star, Bell, CheckCircle, Sparkles, Clock, ArrowUpDown, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";

type TabState = "donations" | "claims" | "event_chats";

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabState>("donations");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Event Chats States
  const [eventInquiries, setEventInquiries] = useState<any[]>([]);
  const [loadingEventInquiries, setLoadingEventInquiries] = useState(false);
  const [selectedEventInquiryId, setSelectedEventInquiryId] = useState<string | null>(null);

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
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [selectedClaimMadeId, setSelectedClaimMadeId] = useState<string | null>(null);
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
      case "new_event_comment":
        return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case "new_event_message":
        return <MessageSquare className="w-4 h-4 text-orange-400" />;
      case "event_rsvp":
        return <Calendar className="w-4 h-4 text-amber-400" />;
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
            listing:listing_id(id, title, images, status, city, area),
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

        const allReceivedClaims = claimsList;
        if (allReceivedClaims.length > 0) {
          setSelectedClaimId((prev) => {
            if (prev && allReceivedClaims.some((c) => c.id === prev)) return prev;
            return allReceivedClaims[0].id;
          });
        }

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
          listing:listing_id(id, title, images, status, city, area),
          donor:donor_id(id, name, trust_score, avatar_url, is_ngo, is_verified)
        `)
        .eq("receiver_id", uid)
        .order("created_at", { ascending: false });

      const resolvedClaimsMade = claimsMade || [];
      setMyClaims(resolvedClaimsMade);
      if (resolvedClaimsMade.length > 0) {
        setSelectedClaimMadeId((prev) => {
          if (prev && resolvedClaimsMade.some((c) => c.id === prev)) return prev;
          return resolvedClaimsMade[0].id;
        });
      }

      // Fetch event inquiries
      setLoadingEventInquiries(true);
      try {
        const inqRes = await fetch(`/api/events/inquiry?userId=${uid}`);
        if (inqRes.ok) {
          const inqData = await inqRes.json();
          const resolvedInqs = Array.isArray(inqData) ? inqData : [];
          setEventInquiries(resolvedInqs);
          if (resolvedInqs.length > 0) {
            setSelectedEventInquiryId((prev) => {
              if (prev && resolvedInqs.some((i) => i.id === prev)) return prev;
              return resolvedInqs[0].id;
            });
          }
        }
      } catch (inqErr) {
        console.error("Error loading event inquiries:", inqErr);
      } finally {
        setLoadingEventInquiries(false);
      }
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-24 selection:bg-teal-500 selection:text-black">
      
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

        {/* Dashboard Navigation via Stat Cards */}
        {(() => {
          const availableShares = myListings.filter(l => l.status === "available").length;
          const reservedShares = myListings.filter(l => l.status === "reserved").length;
          
          const pendingRequests = myClaims.filter(c => c.status === "pending").length;
          const acceptedRequests = myClaims.filter(c => c.status === "accepted").length;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
              {/* My Shares Card */}
              <button
                onClick={() => setActiveTab("donations")}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 backdrop-blur-md border cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 group ${
                  activeTab === "donations"
                    ? "bg-slate-900/80 border-teal-500/40 shadow-[0_0_20px_-3px_rgba(20,184,166,0.15)]"
                    : "bg-slate-950/20 border-slate-900 hover:bg-slate-900/40 hover:border-slate-800"
                }`}
              >
                {/* Active Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                  activeTab === "donations" ? "bg-teal-500" : "bg-transparent group-hover:bg-slate-800"
                }`} />

                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                    activeTab === "donations" ? "text-teal-400" : "text-slate-500 group-hover:text-slate-400"
                  }`}>
                    My Shares
                  </span>
                  <div className={`p-2 rounded-xl border transition-colors ${
                    activeTab === "donations"
                      ? "bg-teal-500/10 border-teal-500/20 text-teal-400"
                      : "bg-slate-900 border-slate-800 text-slate-500 group-hover:text-slate-400"
                  }`}>
                    <Gift size={16} />
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-100 tracking-tight">
                    {myListings.length}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">items shared</span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-900/80 flex flex-wrap items-center gap-2 text-[9.5px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500/80" />
                    {availableShares} available
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                    {myListings.filter(l => l.status === "reserved").length} reserved
                  </span>
                </div>
              </button>

              {/* My Requests Card */}
              <button
                onClick={() => setActiveTab("claims")}
                className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 backdrop-blur-md border cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 group ${
                  activeTab === "claims"
                    ? "bg-slate-900/80 border-emerald-500/40 shadow-[0_0_20px_-3px_rgba(16,185,129,0.15)]"
                    : "bg-slate-950/20 border-slate-900 hover:bg-slate-900/40 hover:border-slate-800"
                }`}
              >
                {/* Active Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                  activeTab === "claims" ? "bg-emerald-500" : "bg-transparent group-hover:bg-slate-800"
                }`} />

                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                    activeTab === "claims" ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-400"
                  }`}>
                    My Requests
                  </span>
                  <div className={`p-2 rounded-xl border transition-colors ${
                    activeTab === "claims"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-slate-900 border-slate-800 text-slate-500 group-hover:text-slate-400"
                  }`}>
                    <ClipboardList size={16} />
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-100 tracking-tight">
                    {myClaims.length}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">claims made</span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-900/80 flex flex-wrap items-center gap-2 text-[9.5px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                    {pendingRequests} pending
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    {acceptedRequests} approved
                  </span>
                </div>
              </button>

              {/* Event Inquiries Card */}
              <button
                onClick={() => setActiveTab("event_chats")}
                className={`col-span-2 sm:col-span-1 relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 backdrop-blur-md border cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 group ${
                  activeTab === "event_chats"
                    ? "bg-slate-900/80 border-amber-500/40 shadow-[0_0_20px_-3px_rgba(245,158,11,0.15)]"
                    : "bg-slate-950/20 border-slate-900 hover:bg-slate-900/40 hover:border-slate-800"
                }`}
              >
                {/* Active Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                  activeTab === "event_chats" ? "bg-amber-500" : "bg-transparent group-hover:bg-slate-800"
                }`} />

                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold uppercase tracking-widest ${
                    activeTab === "event_chats" ? "text-amber-400" : "text-slate-500 group-hover:text-slate-400"
                  }`}>
                    Event Inquiries
                  </span>
                  <div className={`p-2 rounded-xl border transition-colors ${
                    activeTab === "event_chats"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : "bg-slate-900 border-slate-800 text-slate-500 group-hover:text-slate-400"
                  }`}>
                    <MessageSquare size={16} />
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-100 tracking-tight">
                    {eventInquiries.length}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">active chats</span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-900/80 flex flex-wrap items-center gap-1.5 text-[9.5px] font-bold text-slate-400">
                  <span className="flex items-center gap-1 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                    Private messages & RSVPs
                  </span>
                </div>
              </button>
            </div>
          );
        })()}

        {/* Tab contents */}
        {activeTab === "event_chats" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {loadingEventInquiries ? (
              <div className="lg:col-span-12 flex items-center justify-center py-16 text-slate-500 text-xs">
                <Loader2 className="animate-spin text-amber-500 mr-2" size={16} />
                Loading inquiries...
              </div>
            ) : eventInquiries.length === 0 ? (
              <div className="lg:col-span-12 text-center py-16 border border-dashed border-slate-900 rounded-3xl bg-slate-900/10">
                <MessageSquare className="mx-auto text-slate-700 mb-3" size={32} />
                <p className="text-sm font-bold text-slate-400">No event inquiry chats found</p>
                <p className="text-xs text-slate-500 mt-1">When you coordinate or discuss details for listed local events, they will show up here.</p>
              </div>
            ) : (
              <>
                {/* Left sidebar: Event Chats Conversational Inbox */}
                <div className="lg:col-span-4 space-y-3 bg-slate-900/15 border border-slate-900/60 p-4 rounded-3xl max-h-[600px] overflow-y-auto">
                  <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1 pb-1">
                    Event Chats ({eventInquiries.length})
                  </h3>
                  <div className="space-y-2">
                    {eventInquiries.map((inq) => {
                      const isSelected = selectedEventInquiryId === inq.id;
                      const isHost = userId === inq.event.organizer_id;
                      const partner = isHost ? inq.user : inq.host;
                      const lastMsg = inq.lastMessage;

                      return (
                        <div
                          key={inq.id}
                          onClick={() => setSelectedEventInquiryId(inq.id)}
                          className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-slate-900/80 border-amber-500/30 shadow-md shadow-amber-500/5 text-slate-100"
                              : "bg-slate-950/20 border-transparent hover:bg-slate-900/30 text-slate-450 hover:text-slate-200"
                          }`}
                        >
                          {/* Partner Avatar Initials */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-extrabold text-sm shrink-0 shadow-inner">
                            {partner?.name ? partner.name[0].toUpperCase() : "U"}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-xs truncate text-slate-200">
                                {partner?.name || "Community Member"}
                              </h4>
                              <span className="text-[7.5px] uppercase tracking-wider font-extrabold text-slate-500 bg-slate-850 px-1 py-0.2 rounded shrink-0">
                                {isHost ? "Host" : "Guest"}
                              </span>
                            </div>
                            <p className="text-[10px] text-amber-500 font-medium truncate leading-normal">
                              {inq.event.title}
                            </p>
                            <p className="text-[9px] text-slate-400 truncate italic leading-normal">
                              {lastMsg ? lastMsg.content : "No messages yet"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Detailed Workspace for selected event inquiry */}
                <div className="lg:col-span-8 space-y-6">
                  {(() => {
                    const inq = eventInquiries.find((i) => i.id === selectedEventInquiryId);
                    if (!inq) {
                      return (
                        <div className="text-center py-16 bg-slate-900/10 border border-slate-900 rounded-3xl text-slate-500 text-xs">
                          Select a chat from the inbox.
                        </div>
                      );
                    }

                    const isHost = userId === inq.event.organizer_id;
                    const partner = isHost ? inq.user : inq.host;
                    const lastMsg = inq.lastMessage;

                    return (
                      <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6">
                        {/* Event Details Header */}
                        <div className="flex gap-4 items-center border-b border-slate-900/80 pb-4">
                          <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center text-amber-500">
                            <Calendar size={24} />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest block">Associated Event</span>
                            <h3 className="font-extrabold text-base text-slate-100">{inq.event.title}</h3>
                            <p className="text-xs text-slate-400">Scheduled: {new Date(inq.event.date).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Partner Profile card */}
                        <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-extrabold text-base shrink-0 shadow-inner">
                              {partner?.name ? partner.name[0].toUpperCase() : "U"}
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">
                                {isHost ? "Inquirer profile" : "Event Organizer"}
                              </span>
                              <Link href={`/profile/${partner?.id}`} className="text-sm font-bold text-slate-200 hover:text-amber-400 hover:underline transition-colors block">
                                {partner?.name}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <span className="text-[9px] text-slate-450 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/80 flex items-center gap-0.5">
                                  ★ {partner?.trust_score || "5.0"}
                                </span>
                                {partner?.is_ngo && (
                                  <span className="text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                                    ♥ NGO
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-900/60 space-y-1.5">
                            <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest block">Last Chat Snippet</span>
                            <div className="p-3.5 bg-slate-900/40 border border-slate-900 rounded-xl text-xs text-slate-350 italic leading-relaxed">
                              {lastMsg ? (
                                <>
                                  <strong className="text-slate-400 font-bold">
                                    {lastMsg.sender_id === userId ? "You: " : `${partner?.name || "User"}: `}
                                  </strong>
                                  "{lastMsg.content}"
                                </>
                              ) : (
                                "No messages exchanged yet."
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Communication Action Panel */}
                        <div className="p-5 rounded-2xl bg-slate-950/20 border border-slate-900 space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-350">Workspace Tools</h4>
                          <div className="flex flex-col sm:flex-row gap-3 pt-1">
                            <Link
                              href={`/events/chat/${inq.id}`}
                              className="flex-1 justify-center text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-440 hover:to-orange-440 text-slate-950 py-3 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg active:scale-[0.98]"
                            >
                              <MessageSquare size={14} />
                              Open Event Chat Room
                            </Link>

                            <Link
                              href={`/events/${inq.event.id}`}
                              className="flex-1 justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-slate-400 py-3 px-4 rounded-xl flex items-center gap-1.5 hover:bg-slate-850 hover:text-slate-250 transition-all active:scale-[0.98]"
                            >
                              View Public Event Details
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "donations" ? (
          /* Donations Splitscreen Workspace */
          (() => {
            // Group received claims by listing_id and receiver_id, taking the most active/recent claim
            const uniqueReceivedClaimsMap: { [key: string]: any } = {};
            myListings.forEach((item) => {
              const claims = claimsReceived[item.id] || [];
              claims.forEach((claim) => {
                const key = `${claim.listing_id}-${claim.receiver_id}`;
                const existing = uniqueReceivedClaimsMap[key];
                
                // Prioritize status order: pending > accepted > completed > declined/cancelled
                const statusPriority = (status: string) => {
                  if (status === "pending") return 4;
                  if (status === "accepted") return 3;
                  if (status === "completed") return 2;
                  return 1;
                };

                if (!existing || statusPriority(claim.status) > statusPriority(existing.status) || (statusPriority(claim.status) === statusPriority(existing.status) && new Date(claim.created_at) > new Date(existing.created_at))) {
                  uniqueReceivedClaimsMap[key] = claim;
                }
              });
            });

            const allReceivedClaims = Object.values(uniqueReceivedClaimsMap);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {allReceivedClaims.length === 0 ? (
                  <div className="lg:col-span-12 text-center py-16 border border-dashed border-slate-900 rounded-3xl bg-slate-900/10">
                    <Gift className="mx-auto text-slate-700 mb-3" size={32} />
                    <p className="text-sm font-bold text-slate-400">No requests received yet</p>
                    <p className="text-xs text-slate-500 mt-1">When someone claims your items or requests sessions, they will show up here as conversations.</p>
                  </div>
                ) : (
                  <>
                    {/* Left sidebar: Conversational Inbox */}
                    <div className="lg:col-span-4 space-y-3 bg-slate-900/15 border border-slate-900/60 p-4 rounded-3xl max-h-[600px] overflow-y-auto">
                      <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1 pb-1">
                        Inbox Conversations ({allReceivedClaims.length})
                      </h3>
                      <div className="space-y-2">
                        {allReceivedClaims.map((claim: any) => {
                          const isSelected = selectedClaimId === claim.id;

                          return (
                            <div
                              key={claim.id}
                              onClick={() => {
                                setSelectedClaimId(claim.id);
                                setSelectedListingId(claim.listing_id);
                              }}
                              className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                                isSelected
                                  ? "bg-slate-900/80 border-teal-500/30 shadow-md shadow-teal-500/5 text-slate-100"
                                  : "bg-slate-950/20 border-transparent hover:bg-slate-900/30 text-slate-450 hover:text-slate-200"
                              }`}
                            >
                              {/* Receiver Avatar Initials */}
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 font-extrabold text-sm shrink-0 shadow-inner">
                                {claim.receiver?.name ? claim.receiver.name[0].toUpperCase() : "U"}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-xs truncate text-slate-200">
                                    {claim.receiver?.name || "A neighbor"}
                                  </h4>
                                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                    claim.status === "pending" ? "bg-teal-500/10 text-teal-400" :
                                    claim.status === "accepted" ? "bg-amber-500/10 text-amber-400" :
                                    claim.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                                    "bg-slate-800 text-slate-500"
                                  }`}>
                                    {claim.status === "accepted" ? "reserved" : claim.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-350 truncate leading-normal">
                                  {claim.listing?.title || "Item"}
                                </p>
                                <p className="text-[9px] text-slate-500 truncate italic leading-normal">
                                  "{claim.message}"
                                </p>
                                
                                {/* Past Exchange Badge */}
                                {(() => {
                                  const stats = requesterStats[claim.receiver_id];
                                  if (stats && stats.totalCompleted > 0) {
                                    return (
                                      <div className="pt-1">
                                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded border border-amber-550/20">
                                          🤝 {stats.totalCompleted} Past Exchange{stats.totalCompleted > 1 ? "s" : ""}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right side: Detailed Workspace for selected claim */}
                    <div className="lg:col-span-8 space-y-6">
                      {(() => {
                        const selectedClaim = allReceivedClaims.find((c) => c.id === selectedClaimId);
                        if (!selectedClaim) {
                          return (
                            <div className="text-center py-16 bg-slate-900/10 border border-slate-900 rounded-3xl text-slate-500 text-xs">
                              Select a conversation from the inbox to manage the claim.
                            </div>
                          );
                        }

                        const stats = requesterStats[selectedClaim.receiver_id] || { totalCompleted: 0, completedFromMe: 0 };
                        const isShortlisted = shortlistedClaimIds.includes(selectedClaim.id);

                        return (
                          <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6">
                            {/* Listing summary header */}
                            <div className="flex gap-4 items-center border-b border-slate-900/80 pb-4">
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                                {selectedClaim.listing?.images?.[0] ? (
                                  <img
                                    src={selectedClaim.listing.images[0]}
                                    alt="Listing thumbnail"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="text-slate-500" size={18} />
                                )}
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest block">Requested Item</span>
                                <h3 className="font-extrabold text-base text-slate-100">{selectedClaim.listing?.title}</h3>
                                <p className="text-xs text-slate-400">{selectedClaim.listing?.area}, {selectedClaim.listing?.city}</p>
                              </div>
                            </div>

                            {/* Requester Profile card */}
                            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 font-extrabold text-base shrink-0 shadow-inner">
                                    {selectedClaim.receiver?.name ? selectedClaim.receiver.name[0].toUpperCase() : "U"}
                                  </div>
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Requester Profile</span>
                                    <Link href={`/profile/${selectedClaim.receiver_id}`} className="text-sm font-bold text-slate-200 hover:text-teal-400 hover:underline transition-colors block">
                                      {selectedClaim.receiver?.name}
                                    </Link>
                                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                      <span className="text-[9px] text-slate-450 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/80 flex items-center gap-0.5">
                                        ★ {selectedClaim.receiver?.trust_score || "5.0"}
                                      </span>
                                      {selectedClaim.receiver?.is_ngo && (
                                        <span className="text-[9px] font-extrabold bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase">
                                          ♥ NGO
                                        </span>
                                      )}
                                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Total successful claims on the platform">
                                        🎁 {stats.totalCompleted} claimed
                                      </span>
                                      {stats.completedFromMe > 0 && (
                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                          🤝 Got {stats.completedFromMe} from you
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() => {
                                      setShortlistedClaimIds((prev) =>
                                        isShortlisted ? prev.filter((id) => id !== selectedClaim.id) : [...prev, selectedClaim.id]
                                      );
                                    }}
                                    className={`p-2 rounded-xl transition-all border ${
                                      isShortlisted
                                        ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                                        : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350 hover:bg-slate-850"
                                    }`}
                                    title={isShortlisted ? "Remove Shortlist" : "Shortlist Requester"}
                                  >
                                    <Star size={14} fill={isShortlisted ? "currentColor" : "none"} />
                                  </button>
                                </div>
                              </div>

                              <div className="pt-3 border-t border-slate-900/60 space-y-1.5">
                                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">First Request Message</span>
                                <div className="p-3.5 bg-slate-900/40 border border-slate-900 rounded-xl text-xs text-slate-300 italic leading-relaxed">
                                  "{selectedClaim.message}"
                                </div>
                              </div>
                            </div>

                            {/* Claim Decision / Actions card */}
                            <div className="p-5 rounded-2xl bg-slate-950/20 border border-slate-900 space-y-4">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-350">Claim Status & Actions</h4>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 font-medium">Current Stage:</span>
                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                                  selectedClaim.status === "pending" ? "bg-teal-500/15 text-teal-455 border-teal-500/20" :
                                  selectedClaim.status === "accepted" ? "bg-amber-500/15 text-amber-455 border-amber-500/20" :
                                  selectedClaim.status === "completed" ? "bg-emerald-500/15 text-emerald-450 border-emerald-500/20" :
                                  "bg-slate-900 text-slate-500 border-slate-800"
                                }`}>
                                  {selectedClaim.status === "accepted" ? "reserved" : selectedClaim.status}
                                </span>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Link
                                  href={`/chat/${selectedClaim.id}`}
                                  className="flex-1 justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-teal-400 hover:bg-slate-850 py-3 px-4 rounded-xl flex items-center gap-1.5 transition-all active:scale-[0.98]"
                                >
                                  <MessageSquare size={14} />
                                  Open Chat & Connect
                                </Link>

                                {selectedClaim.status === "pending" && (
                                  <>
                                    <button
                                      disabled={actionLoadingId !== null}
                                      onClick={() => handleClaimAction(selectedClaim.id, "accepted")}
                                      className="flex-1 justify-center text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 py-3 px-4 rounded-xl flex items-center gap-1 hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                      Accept & Reserve
                                    </button>
                                    <button
                                      disabled={actionLoadingId !== null}
                                      onClick={() => handleClaimAction(selectedClaim.id, "declined")}
                                      className="flex-1 justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-slate-400 py-3 px-4 rounded-xl flex items-center gap-1 hover:text-red-400 hover:bg-red-500/10 hover:border-red-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                      Decline
                                    </button>
                                  </>
                                )}

                                {selectedClaim.status === "accepted" && (
                                  <>
                                    <button
                                      disabled={actionLoadingId !== null}
                                      onClick={() => handleClaimAction(selectedClaim.id, "completed", {
                                        userId: selectedClaim.receiver?.id,
                                        userName: selectedClaim.receiver?.name,
                                        role: "donor_reviewing_receiver"
                                      })}
                                      className="flex-1 justify-center text-xs font-bold bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 py-3 px-4 rounded-xl flex items-center gap-1 hover:from-teal-400 hover:to-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                      <Check size={14} strokeWidth={3} />
                                      Mark Handed-Over
                                    </button>
                                    <button
                                      disabled={actionLoadingId !== null}
                                      onClick={() => handleClaimAction(selectedClaim.id, "cancelled")}
                                      className="flex-1 justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-red-400 py-3 px-4 rounded-xl flex items-center gap-1 hover:text-red-400 hover:bg-red-500/10 hover:border-red-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                                    >
                                      <X size={14} />
                                      Mark No-Show
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            );
          })()
        ) : (
          /* Claims made (My Requests) Splitscreen Workspace */
          (() => {
            const uniqueClaimsMadeMap: { [key: string]: any } = {};
            myClaims.forEach((claim) => {
              const key = `${claim.listing_id}-${claim.donor_id}`;
              const existing = uniqueClaimsMadeMap[key];

              const statusPriority = (status: string) => {
                if (status === "pending") return 4;
                if (status === "accepted") return 3;
                if (status === "completed") return 2;
                return 1;
              };

              if (!existing || statusPriority(claim.status) > statusPriority(existing.status) || (statusPriority(claim.status) === statusPriority(existing.status) && new Date(claim.created_at) > new Date(existing.created_at))) {
                uniqueClaimsMadeMap[key] = claim;
              }
            });

            const allOutboundClaims = Object.values(uniqueClaimsMadeMap);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {allOutboundClaims.length === 0 ? (
                  <div className="lg:col-span-12 text-center py-16 border border-dashed border-slate-900 rounded-3xl bg-slate-900/10">
                    <ClipboardList className="mx-auto text-slate-700 mb-3" size={32} />
                    <p className="text-sm font-bold text-slate-400">No requests submitted yet</p>
                    <Link href="/" className="text-xs text-teal-400 hover:underline mt-1 inline-block">Browse feed and claim items</Link>
                  </div>
                ) : (
                  <>
                    {/* Left sidebar: Outbound Claims Conversational Inbox */}
                    <div className="lg:col-span-4 space-y-3 bg-slate-900/15 border border-slate-900/60 p-4 rounded-3xl max-h-[600px] overflow-y-auto">
                      <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1 pb-1">
                        Outbound Requests ({allOutboundClaims.length})
                      </h3>
                      <div className="space-y-2">
                        {allOutboundClaims.map((claim: any) => {
                          const isSelected = selectedClaimMadeId === claim.id;

                      return (
                        <div
                          key={claim.id}
                          onClick={() => {
                            setSelectedClaimMadeId(claim.id);
                          }}
                          className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
                            isSelected
                              ? "bg-slate-900/80 border-teal-500/30 shadow-md shadow-teal-500/5 text-slate-100"
                              : "bg-slate-950/20 border-transparent hover:bg-slate-900/30 text-slate-450 hover:text-slate-200"
                          }`}
                        >
                          {/* Donor Initials Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 font-extrabold text-sm shrink-0 shadow-inner">
                            {claim.donor?.name ? claim.donor.name[0].toUpperCase() : "D"}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-xs truncate text-slate-200">
                                {claim.donor?.name || "Donor"}
                              </h4>
                              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                claim.status === "pending" ? "bg-slate-800 text-slate-400" :
                                claim.status === "accepted" ? "bg-emerald-500/10 text-emerald-400" :
                                claim.status === "completed" ? "bg-teal-500/10 text-teal-400" :
                                claim.status === "declined" ? "bg-red-500/10 text-red-400" :
                                "bg-slate-800 text-slate-500"
                              }`}>
                                {claim.status === "accepted" ? "reserved" : claim.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-350 truncate leading-normal">
                              {claim.listing?.title || "Item"}
                            </p>
                            <p className="text-[9px] text-slate-500 truncate italic leading-normal">
                              "{claim.message}"
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Detailed Workspace for selected claim made */}
                <div className="lg:col-span-8 space-y-6">
                  {(() => {
                    const selectedClaim = myClaims.find((c) => c.id === selectedClaimMadeId);
                    if (!selectedClaim) {
                      return (
                        <div className="text-center py-16 bg-slate-900/10 border border-slate-900 rounded-3xl text-slate-500 text-xs">
                          Select a request from the sidebar inbox.
                        </div>
                      );
                    }

                    return (
                      <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 space-y-6">
                        {/* Listing summary header */}
                        <div className="flex gap-4 items-center border-b border-slate-900/80 pb-4">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
                            {selectedClaim.listing?.images?.[0] ? (
                              <img
                                src={selectedClaim.listing.images[0]}
                                alt="Listing thumbnail"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="text-slate-500" size={18} />
                            )}
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest block">Requested Listing</span>
                            <h3 className="font-extrabold text-base text-slate-100">{selectedClaim.listing?.title}</h3>
                            <p className="text-xs text-slate-400">{selectedClaim.listing?.area}, {selectedClaim.listing?.city}</p>
                          </div>
                        </div>

                        {/* Donor Profile card */}
                        <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-900 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 border border-teal-500/20 flex items-center justify-center text-teal-500 font-extrabold text-base shrink-0 shadow-inner">
                              {selectedClaim.donor?.name ? selectedClaim.donor.name[0].toUpperCase() : "D"}
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Donor Profile</span>
                              <Link href={`/profile/${selectedClaim.donor_id}`} className="text-sm font-bold text-slate-200 hover:text-teal-400 hover:underline transition-colors block">
                                {selectedClaim.donor?.name}
                              </Link>
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <span className="text-[9px] text-slate-450 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800/80 flex items-center gap-0.5">
                                  ★ {selectedClaim.donor?.trust_score || "5.0"}
                                </span>
                                {selectedClaim.donor?.is_ngo && (
                                  <span className="text-[9px] font-extrabold bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase">
                                    ♥ NGO
                                  </span>
                                )}
                                {selectedClaim.donor?.is_verified && (
                                  <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
                                    ✓ Verified
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-900/60 space-y-1.5">
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Your Sent Message</span>
                            <div className="p-3.5 bg-slate-900/40 border border-slate-900 rounded-xl text-xs text-slate-300 italic leading-relaxed">
                              "{selectedClaim.message}"
                            </div>
                          </div>
                        </div>

                        {/* Claim Status and Action Controls */}
                        <div className="p-5 rounded-2xl bg-slate-950/20 border border-slate-900 space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-350">Request Status & Actions</h4>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 font-medium">Current Stage:</span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                              selectedClaim.status === "pending" ? "bg-slate-800 text-slate-400 border-slate-700" :
                              selectedClaim.status === "accepted" ? "bg-emerald-500/15 text-emerald-450 border-emerald-500/20" :
                              selectedClaim.status === "completed" ? "bg-teal-500/15 text-teal-450 border-teal-500/20" :
                              selectedClaim.status === "declined" ? "bg-red-500/15 text-red-450 border-red-500/20" :
                              "bg-slate-800 text-slate-500 border-slate-800"
                            }`}>
                              {selectedClaim.status === "accepted" ? "reserved" : selectedClaim.status}
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            {/* Standard Connect Chat Link */}
                            {(selectedClaim.status === "accepted" || selectedClaim.status === "pending") && (
                              <Link
                                href={`/chat/${selectedClaim.id}`}
                                className="flex-1 justify-center text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 py-3 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/10 active:scale-[0.98]"
                              >
                                <MessageSquare size={14} />
                                Chat with Donor
                              </Link>
                            )}

                            {/* Rate Donor Button */}
                            {selectedClaim.status === "completed" && (
                              <button
                                onClick={() => {
                                  setReviewClaimId(selectedClaim.id);
                                  setReviewedUserId(selectedClaim.donor_id);
                                  setReviewedUserName(selectedClaim.donor?.name || "the Donor");
                                  setReviewRole("receiver_reviewing_donor");
                                  setShowReviewModal(true);
                                }}
                                className="flex-1 justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-yellow-500 hover:bg-slate-850 py-3 px-4 rounded-xl flex items-center gap-1.5 transition-all active:scale-[0.98]"
                              >
                                <Star size={14} className="fill-yellow-500 text-yellow-500" />
                                Rate Donor
                              </button>
                            )}

                            {/* Cancel Request Button */}
                            {(selectedClaim.status === "pending" || selectedClaim.status === "accepted") && (
                              <button
                                disabled={actionLoadingId !== null}
                                onClick={() => handleClaimAction(selectedClaim.id, "cancelled")}
                                className="flex-1 justify-center text-xs font-bold bg-slate-900 border border-slate-800 text-slate-400 py-3 px-4 rounded-xl flex items-center gap-1.5 hover:text-red-400 hover:bg-red-500/10 hover:border-red-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
                              >
                                <X size={14} />
                                Cancel Request
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
          );
        })()
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

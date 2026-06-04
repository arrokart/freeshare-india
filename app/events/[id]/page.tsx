"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, MapPin, Users, Loader2, ArrowLeft, Flag, Trash, Share2, Send } from "lucide-react";
import ReportModal from "@/components/ReportModal";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // RSVP Actions
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [shareText, setShareText] = useState("Share");

  // Q&A Comments States
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [chatInitiating, setChatInitiating] = useState(false);

  const fetchEventDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          organizer:organizer_id(id, name, email, is_ngo, avatar_url),
          rsvps:event_rsvps(user_id)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (err) {
      console.error("Error loading event:", err);
      router.push("/events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      }
    };
    fetchUser();
    
    if (id) {
      fetchEventDetails();
      fetchComments();
    }
  }, [id]);

  const handleShare = async () => {
    const shareData = {
      title: event?.title || "Community Event",
      text: event?.description || "Check out this community event on FreeShare India",
      url: window.location.href,
    };
    
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Web share failed, falling back to copy:", err);
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareText("Copied!");
      setTimeout(() => {
        setShareText("Share");
      }, 2000);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/events/comments?eventId=${id}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/login?next=/events/${id}`);
      return;
    }
    if (newCommentText.trim().length < 2) return;

    setCommentSubmitting(true);
    try {
      const res = await fetch("/api/events/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: id,
          user_id: user.id,
          content: newCommentText.trim()
        }),
      });

      const newComment = await res.json();
      if (!res.ok) throw new Error(newComment.error || "Failed to submit comment");

      setComments((prev) => [...prev, newComment]);
      setNewCommentText("");
    } catch (err: any) {
      alert(err.message || "Failed to post comment.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    try {
      const res = await fetch(`/api/events/comments?commentId=${commentId}&userId=${user.id}`, {
        method: "DELETE"
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to delete comment");

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      alert(err.message || "Failed to delete comment.");
    }
  };

  const handleStartChatWithHost = async () => {
    if (!user) {
      router.push(`/login?next=/events/${id}`);
      return;
    }

    setChatInitiating(true);
    try {
      const res = await fetch("/api/events/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start chat");

      router.push(`/events/chat/${data.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to start chat.");
    } finally {
      setChatInitiating(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this event? This action cannot be undone.")) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/events?eventId=${id}&userId=${user?.id}`, {
        method: "DELETE",
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to delete event");
      
      alert("Event deleted successfully.");
      router.push("/events");
    } catch (err: any) {
      alert(err.message || "Failed to delete event.");
    } finally {
      setDeleteLoading(false);
    }
  };


  const handleRsvpToggle = async () => {
    if (!user) {
      router.push(`/login?next=/events/${id}`);
      return;
    }

    setRsvpLoading(true);
    try {
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id, userId: user.id }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to RSVP");

      await fetchEventDetails();
    } catch (err: any) {
      alert(err.message || "Something went wrong.");
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatTimeRange = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    const dateStr = start.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    
    const startTime = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    const endTime = end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    
    return `${dateStr}, ${startTime} - ${endTime}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="animate-spin text-amber-500" size={28} />
        <p className="text-xs">Loading event details...</p>
      </div>
    );
  }

  if (!event) return null;

  const isGoing = user && event.rsvps?.some((r: any) => r.user_id === user.id);
  const rsvpCount = event.rsvps?.length || 0;
  const isFull = event.max_participants && rsvpCount >= event.max_participants;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-amber-500 selection:text-black">
      
      {/* Navbar header */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/events" className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900">
              <ArrowLeft size={20} />
            </Link>
            <span className="text-sm font-extrabold text-slate-400">Back to Events</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-amber-500 hover:text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/5 border border-transparent hover:border-amber-500/10 transition-all cursor-pointer"
            >
              <Share2 size={12} />
              <span>{shareText}</span>
            </button>

            {user && user.id !== event.organizer_id && (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
              >
                <Flag size={12} />
                <span>Report</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Details Body */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Event Banner Image if Present */}
        {event.image_url && (
          <div className="w-full h-64 sm:h-80 rounded-3xl overflow-hidden border border-slate-900 relative shadow-xl">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Details Card */}
        <div className="bg-slate-900/15 border border-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden">
          
          <div className="flex-1 space-y-4">
            
            {/* Title / Badge */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] uppercase tracking-wider font-extrabold">
                  📅 Community Event
                </span>
                {event.organizer?.is_ngo && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] uppercase tracking-wider font-extrabold">
                    Verified NGO
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-100 leading-tight">
                {event.title}
              </h1>
            </div>

            {/* Time / Address details */}
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-amber-500 shrink-0" />
                <span>{formatTimeRange(event.start_date, event.end_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-amber-500 shrink-0" />
                <span>{event.location_name}, {event.area}, {event.city} {event.pincode && `(Pincode: ${event.pincode})`}</span>
              </div>
            </div>

          </div>

          {/* RSVP Card */}
          <div className="w-full md:w-56 bg-slate-950/65 border border-slate-900 rounded-2xl p-5 shrink-0 flex flex-col gap-4 text-center">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">ATTENDEE STATUS</span>
              <div className="flex items-center justify-center gap-1.5 text-lg font-extrabold text-slate-200">
                <Users className="text-amber-500" size={18} />
                <span>{rsvpCount} going</span>
              </div>
              {event.max_participants && (
                <span className="text-[10px] text-slate-600 block">
                  Capacity limit: {event.max_participants} users
                </span>
              )}
            </div>

            {user && user.id === event.organizer_id ? (
              <button
                onClick={handleDeleteEvent}
                disabled={deleteLoading}
                className="w-full py-3 text-xs font-black rounded-xl transition-all cursor-pointer bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-900/30 hover:border-red-800/40 uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                {deleteLoading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Trash size={14} />
                )}
                Delete Event
              </button>
            ) : (
              <button
                onClick={handleRsvpToggle}
                disabled={rsvpLoading || (!isGoing && isFull)}
                className={`w-full py-3 text-xs font-black rounded-xl transition-all cursor-pointer uppercase tracking-wider select-none ${
                  isGoing
                    ? "bg-slate-850 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/20 text-slate-400 hover:text-red-400"
                    : isFull
                    ? "bg-slate-950 border border-slate-900 text-slate-700 cursor-not-allowed"
                    : "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/10"
                }`}
              >
                {rsvpLoading ? (
                  <Loader2 className="animate-spin mx-auto text-slate-500" size={16} />
                ) : isGoing ? (
                  "Cancel RSVP"
                ) : isFull ? (
                  "Event Full"
                ) : (
                  "RSVP Now"
                )}
              </button>
            )}
          </div>

        </div>

        {/* Description Section */}
        <div className="space-y-3 bg-slate-900/10 border border-slate-900 rounded-3xl p-6">
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">About this event</h2>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {event.description}
          </p>
        </div>

        {/* Public Q&A / Comments Board */}
        <div className="space-y-4 bg-slate-900/10 border border-slate-900 rounded-3xl p-6">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              💬 Questions & Discussion ({comments.length})
            </h2>
          </div>

          {/* Comments List */}
          {commentsLoading ? (
            <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
              <Loader2 className="animate-spin text-amber-500 mr-2" size={14} />
              Loading discussion...
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              No questions or comments yet. Be the first to ask!
            </p>
          ) : (
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {comments.map((cmt) => {
                const isCmtAuthor = user && cmt.user_id === user.id;
                const isEventHost = user && event.organizer_id === user.id;
                const showDelete = isCmtAuthor || isEventHost;
                
                return (
                  <div key={cmt.id} className="flex gap-3 bg-slate-950/20 border border-slate-900/60 p-3 rounded-2xl relative group/cmt">
                    {/* User Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-950 border border-slate-850 text-slate-500 text-xs flex items-center justify-center font-black shrink-0">
                      {cmt.user?.avatar_url ? (
                        <img src={cmt.user.avatar_url} alt={cmt.user.name} className="w-full h-full object-cover" />
                      ) : (
                        cmt.user?.name?.charAt(0) || "U"
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 space-y-1 min-w-0 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-350">{cmt.user?.name || "Community Member"}</span>
                        {cmt.user_id === event.organizer_id && (
                          <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded">Host</span>
                        )}
                        <span className="text-[8px] text-slate-500 font-medium">
                          {new Date(cmt.created_at).toLocaleDateString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed break-words">{cmt.content}</p>
                    </div>
                    {/* Delete button */}
                    {showDelete && (
                      <button
                        onClick={() => handleDeleteComment(cmt.id)}
                        className="absolute right-3 top-3 text-slate-600 hover:text-red-500 transition-colors p-1 rounded-md opacity-0 group-hover/cmt:opacity-100 focus:opacity-100"
                        title="Delete Comment"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment Form */}
          <form onSubmit={handlePostComment} className="flex gap-2 pt-2 border-t border-slate-900">
            <input
              type="text"
              required
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={user ? "Ask a question or leave a comment..." : "Sign in to join the discussion..."}
              className="flex-1 bg-slate-950/40 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
            />
            <button
              type="submit"
              disabled={commentSubmitting || newCommentText.trim().length < 2}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-[0.98] disabled:opacity-50 shrink-0 uppercase tracking-wider"
            >
              {commentSubmitting ? <Loader2 className="animate-spin text-slate-950" size={12} /> : "Post"}
            </button>
          </form>
        </div>

        {/* Organizer Host Info */}
        <div className="bg-slate-900/10 border border-slate-900 rounded-3xl p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center text-sm font-extrabold text-amber-500 uppercase overflow-hidden shrink-0">
              {event.organizer?.avatar_url ? (
                <img src={event.organizer.avatar_url} alt={event.organizer.name} className="w-full h-full object-cover" />
              ) : (
                event.organizer?.name?.charAt(0) || "U"
              )}
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Organized By</span>
              <Link href={`/profile/${event.organizer_id}`} className="text-xs font-bold text-slate-350 hover:text-amber-500 transition-colors">
                {event.organizer?.name}
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user && user.id !== event.organizer_id && (
              <button
                onClick={handleStartChatWithHost}
                disabled={chatInitiating}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
              >
                {chatInitiating ? (
                  <Loader2 className="animate-spin text-slate-950" size={12} />
                ) : (
                  <Send size={12} />
                )}
                Chat with Host
              </button>
            )}

            <a
              href={`mailto:${event.organizer?.email}`}
              className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-900 hover:border-slate-850 text-xs font-bold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              Email Host
            </a>
          </div>
        </div>

      </main>

      {/* Report Event Modal Dialog */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedEventId={event.id}
        targetName={`event "${event.title}"`}
        reporterId={user?.id}
      />

    </div>
  );
}

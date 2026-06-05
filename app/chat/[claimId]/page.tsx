"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getR2PublicUrl } from "@/lib/r2";
import { Loader2, ArrowLeft, Send, Image as ImageIcon, MapPin, CheckCheck, Wifi, WifiOff, AlertCircle, ShieldCheck, Heart } from "lucide-react";

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const claimId = params?.claimId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [claim, setClaim] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Connection & Activity
  const [isConnected, setIsConnected] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [otherUserName, setOtherUserName] = useState("Other User");

  // Inputs
  const [textInput, setTextInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Booking Control States
  const [statusChanging, setStatusChanging] = useState(false);
  const [nudging, setNudging] = useState(false);

  // Past Exchanges / Sibling claims mapping
  const [pastClaims, setPastClaims] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [loadingHistoryMessages, setLoadingHistoryMessages] = useState(false);
  const [selectedHistoryClaimId, setSelectedHistoryClaimId] = useState<string | null>(null);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!claimId) return;
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      
      setClaim((prev: any) => ({ ...prev, status: newStatus }));
    } catch (err: any) {
      alert(err.message || "Failed to update booking status.");
    } finally {
      setStatusChanging(false);
    }
  };

  const handleNudgeHost = async () => {
    if (!claimId || !claim) return;
    setNudging(true);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: claim.donor_id,
          type: "claim_nudge",
          title: "Session Request Reminder ⏱",
          body: `${claim.receiver?.name || "A neighbor"} is waiting for your response regarding your skill: "${claim.listing?.title}"`,
          link: `/chat/${claimId}`,
        }),
      });

      const nowStr = new Date().toISOString();
      const { error } = await supabase
        .from("claims")
        .update({ last_nudged_at: nowStr })
        .eq("id", claimId);

      if (error) throw error;

      setClaim((prev: any) => ({ ...prev, last_nudged_at: nowStr }));
      alert("Host has been nudged!");
    } catch (err: any) {
      alert(err.message || "Failed to nudge host.");
    } finally {
      setNudging(false);
    }
  };

  const handleFetchHistoryMessages = async (pastId: string) => {
    setSelectedHistoryClaimId(pastId);
    setLoadingHistoryMessages(true);
    try {
      const res = await fetch(`/api/messages?claimId=${pastId}&limit=100`);
      if (!res.ok) throw new Error("Failed to load archived chat");
      const data = await res.json();
      setHistoryMessages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      alert(err.message || "Failed to load past chat messages.");
    } finally {
      setLoadingHistoryMessages(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<any>(null);

  useEffect(() => {
    // Get Auth user info
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login");
        return;
      }
      setUserId(data.user.id);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    if (!claimId || !userId) return;

    const fetchChatDetails = async () => {
      setLoading(true);
      try {
        // 1. Get Claim & Listing metadata
        const { data: claimData, error: claimErr } = await supabase
          .from("claims")
          .select(`
            *,
            listing:listing_id(id, title, images, listing_type, max_bookings_per_user),
            donor:donor_id(id, name, is_ngo, is_verified),
            receiver:receiver_id(id, name, is_ngo, is_verified)
          `)
          .eq("id", claimId)
          .single();

        if (claimErr) throw claimErr;
        setClaim(claimData);

        // Identify other user's name
        const isDonor = claimData.donor_id === userId;
        setOtherUserName(isDonor ? claimData.receiver?.name : claimData.donor?.name);

        // 2. Fetch sibling claims (historical requests) between these two users for this listing
        const { data: siblings } = await supabase
          .from("claims")
          .select("id, status, created_at, message")
          .eq("listing_id", claimData.listing_id)
          .eq("receiver_id", claimData.receiver_id)
          .eq("donor_id", claimData.donor_id)
          .neq("id", claimId)
          .order("created_at", { ascending: false });
        
        setPastClaims(siblings || []);

        // 3. Fetch last 50 historical messages
        const msgRes = await fetch(`/api/messages?claimId=${claimId}&limit=50`);
        const msgData = await msgRes.json();
        const loadedMessages = Array.isArray(msgData) ? msgData : [];
        setMessages(loadedMessages);

        // Mark incoming messages as read
        const hasUnread = loadedMessages.some((m: any) => m.sender_id !== userId && !m.is_read);
        if (hasUnread) {
          fetch(`/api/messages`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ claimId, readerId: userId }),
          }).catch((err) => console.error("Error marking messages read:", err));
        }
      } catch (err) {
        console.error("Chat details fetch error:", err);
        setErrorMsg("Failed to load chat history.");
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    };

    fetchChatDetails();
  }, [claimId, userId]);

  // WebSocket Live Subscription hook
  useEffect(() => {
    if (!claimId || !userId) return;

    // 1. Subscribe to Live DB changes on messages table
    const messageChannel = supabase
      .channel(`live_messages:${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new;
            if (newMsg.claim_id !== claimId) return;

            setMessages((prev) => {
              // 1. If already added (due to fast HTTP response), skip
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              // 2. If it's our own message, check if we have an optimistic placeholder
              if (newMsg.sender_id === userId) {
                const optIndex = prev.findIndex((m) => m.id.startsWith("optimistic-"));
                if (optIndex !== -1) {
                  const updated = [...prev];
                  updated[optIndex] = newMsg;
                  return updated;
                }
              }

              // 3. Otherwise, append normally
              return [...prev, newMsg];
            });

            // Mark as read immediately on receive if from other user
            if (newMsg.sender_id !== userId) {
              fetch(`/api/messages`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claimId, readerId: userId })
              }).catch(err => console.error("Error marking live message read:", err));
            }
            scrollToBottom();
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new;
            if (updatedMsg.claim_id !== claimId) return;
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
            );
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    // 2. Track Typing Indicators using Supabase Presence
    const presenceChannel = supabase.channel(`presence_typing:${claimId}`);
    presenceChannelRef.current = presenceChannel;
    
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        // Check if other user is typing
        let isTyping = false;
        Object.keys(state).forEach((key) => {
          const userPresences = state[key] as any[];
          userPresences.forEach((p) => {
            if (p.userId !== userId && p.isTyping) {
              isTyping = true;
            }
          });
        });
        setIsOtherUserTyping(isTyping);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track our own presence details
          await presenceChannel.track({
            userId,
            isTyping: false,
          });
        }
      });

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
    };
  }, [claimId, userId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Broadcast typing changes to other user
  const handleTyping = () => {
    if (!claimId || !userId || !presenceChannelRef.current) return;
    
    const channel = presenceChannelRef.current;
    
    channel.track({
      userId,
      isTyping: true,
    });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    typingTimerRef.current = setTimeout(() => {
      channel.track({
        userId,
        isTyping: false,
      });
    }, 2000);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !claimId) return;
    if (!textInput.trim() && !imageFile) return;

    // Immediately stop indicating typing
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({
        userId,
        isTyping: false,
      });
    }

    setSending(true);
    setErrorMsg("");

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      claim_id: claimId,
      sender_id: userId,
      content: textInput,
      image_url: imagePreview || undefined,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // Render instantly in local states
    setMessages((prev) => [...prev, optimisticMessage]);
    scrollToBottom();

    const textPayload = textInput;
    setTextInput(""); // Clear field

    try {
      let finalImageUrl = "";

      // 1. If image is selected, upload to Cloudflare R2 first
      if (imageFile) {
        let fileToUpload = imageFile;
        try {
          const imageCompression = (await import("browser-image-compression")).default;
          const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
          };
          const compressed = await imageCompression(imageFile, options);
          fileToUpload = new File([compressed], imageFile.name, { type: imageFile.type });
        } catch (compressErr) {
          console.error("Chat image compression failed, uploading original:", compressErr);
        }

        const presignRes = await fetch("/api/listings/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: fileToUpload.name,
            fileType: fileToUpload.type,
          }),
        });

        const { uploadUrl, fileKey } = await presignRes.json();
        if (!uploadUrl) throw new Error("R2 Presign failed");

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": fileToUpload.type },
          body: fileToUpload,
        });

        if (!uploadRes.ok) throw new Error("R2 direct upload failed");

        finalImageUrl = getR2PublicUrl(fileKey) || `https://pub-placeholder-domain.r2.dev/${fileKey}`;
        clearImage();
      }

      // 2. Post to backend Messages endpoint
      const msgRes = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_id: claimId,
          sender_id: userId,
          content: textPayload,
          image_url: finalImageUrl || null,
        }),
      });

      const msgData = await msgRes.json();
      if (!msgRes.ok) throw new Error(msgData.error || "Failed to post message");

      // Replace optimistic entry with DB committed object
      setMessages((prev) => {
        if (prev.some((m) => m.id === msgData.id)) {
          return prev.filter((m) => m.id !== optimisticId);
        }
        return prev.map((m) => (m.id === optimisticId ? msgData : m));
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Message delivery failed.");
      // Flag optimistic message as failed
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Connecting to secure chat channel...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-teal-500 selection:text-black">
      
      {/* Dynamic Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 hover:bg-slate-900 rounded-full text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="space-y-0.5">
            <h1 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              {otherUserName}
              {claim && (
                (() => {
                  const isDonor = claim.donor_id === userId;
                  const otherUser = isDonor ? claim.receiver : claim.donor;
                  if (otherUser?.is_ngo) {
                    return (
                      <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20" title="Verified NGO">
                        <Heart size={10} className="fill-violet-400" /> NGO
                      </span>
                    );
                  }
                  if (otherUser?.is_verified) {
                    return (
                      <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20" title="Identity Verified">
                        <ShieldCheck size={10} /> Verified
                      </span>
                    );
                  }
                  return null;
                })()
              )}
            </h1>
            {claim?.listing && (
              <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px] sm:max-w-md">
                Item: {claim.listing.title}
              </span>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
          {isConnected ? (
            <>
              <Wifi size={10} className="text-teal-400 animate-pulse" />
              <span className="text-teal-400">Live Connection</span>
            </>
          ) : (
            <>
              <WifiOff size={10} className="text-red-400" />
              <span className="text-red-400">Disconnected</span>
            </>
          )}
        </div>
      </header>

      {/* Dynamic Claim/Booking Action Header */}
      {claim && (
        <div className="bg-slate-900/60 border-b border-slate-900 px-4 py-3 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">
                {claim.listing?.listing_type === "skill" ? "Booking Status:" : "Request Status:"}
              </span>
              {claim.status === "pending" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {claim.listing?.listing_type === "skill" ? "Pending Request" : "Pending Approval"}
                </span>
              )}
              {claim.status === "accepted" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {claim.listing?.listing_type === "skill" ? "Booking Confirmed" : "Item Reserved"}
                </span>
              )}
              {claim.status === "completed" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  🌱 {claim.listing?.listing_type === "skill" ? "Completed" : "Donated"}
                </span>
              )}
              {claim.status === "declined" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                  Declined
                </span>
              )}
              {claim.status === "cancelled" && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                  Cancelled
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Donor / Host actions */}
              {claim.donor_id === userId && (
                <>
                  {claim.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus("accepted")}
                        disabled={statusChanging}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                      >
                        {claim.listing?.listing_type === "skill" ? "Accept Booking" : "Accept & Reserve"}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus("declined")}
                        disabled={statusChanging}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-red-400 border border-slate-750 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {claim.status === "accepted" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus("completed")}
                        disabled={statusChanging}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                      >
                        {claim.listing?.listing_type === "skill" ? "Mark Completed" : "Mark Handed-Over"}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus("cancelled")}
                        disabled={statusChanging}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-750 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                      >
                        {claim.listing?.listing_type === "skill" ? "Cancel Booking" : "Mark No-Show"}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Requester / Claimant actions */}
              {claim.receiver_id === userId && (
                <>
                  {(claim.status === "pending" || claim.status === "accepted") && (
                    <button
                      onClick={() => handleUpdateStatus("cancelled")}
                      disabled={statusChanging}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-red-400 border border-slate-750 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                    >
                      Cancel Request
                    </button>
                  )}

                  {claim.status === "pending" && (
                    <button
                      onClick={handleNudgeHost}
                      disabled={
                        nudging ||
                        (claim.last_nudged_at &&
                          Date.now() - new Date(claim.last_nudged_at).getTime() < 3600000)
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/40 transition-all disabled:opacity-50 cursor-pointer"
                      title={
                        claim.last_nudged_at &&
                        Date.now() - new Date(claim.last_nudged_at).getTime() < 3600000
                          ? "You can nudge again in 1 hour"
                          : "Send a reminder push notification to the host/donor"
                      }
                    >
                      {nudging ? "Nudging..." : "⏱ Nudge Donor"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Messages Scroll Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-4xl mx-auto w-full">
        {/* Safety guidelines reminder */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/85 text-xs text-slate-300 space-y-2 max-w-4xl mx-auto flex items-start gap-3 shadow-inner select-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-1 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-200">💡 Safe Exchange Guidelines</p>
            <p className="text-[11px] text-slate-450 leading-relaxed">
              Always meet in public, well-lit areas (such as metro stations, shopping malls, or parks). Avoid sharing private home details if uncomfortable. Bringing a friend along is highly recommended!
            </p>
          </div>
        </div>

        {/* Sibling claim link banner */}
        {pastClaims.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-xs text-slate-300 flex items-center justify-between gap-3 max-w-4xl mx-auto animate-in fade-in duration-350">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-sm">ℹ️</span>
              <p className="text-[11px] text-slate-350 leading-relaxed font-semibold">
                You have {pastClaims.length} past exchange history records for this item with this user.
              </p>
            </div>
            <button
              onClick={() => {
                setShowHistoryModal(true);
                // Auto load the first past claim history messages
                handleFetchHistoryMessages(pastClaims[0].id);
              }}
              className="text-[10px] font-black uppercase text-amber-500 hover:text-amber-400 border-b border-dashed border-amber-550/40 pb-0.5 tracking-wider shrink-0 transition-colors"
            >
              View History
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center flex items-center justify-center gap-2">
            <AlertCircle size={14} />
            {errorMsg}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <p className="text-xs">Connection secured. Send a message to coordinate pickup details.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            const senderDetails = msg.sender_id === claim?.donor_id ? claim?.donor : claim?.receiver;

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[75%] space-y-1 ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                {!isMe && (
                  <span className="text-[10px] text-slate-400 font-bold px-1 flex items-center gap-1">
                    {senderDetails?.name || "User"}
                    {senderDetails?.is_ngo && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20" title="Verified NGO">
                        <Heart size={8} className="fill-violet-400" /> NGO
                      </span>
                    )}
                    {senderDetails?.is_verified && !senderDetails?.is_ngo && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20" title="Verified User">
                        <ShieldCheck size={8} /> Verified
                      </span>
                    )}
                  </span>
                )}
                {/* Bubble content */}
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-medium rounded-tr-none"
                      : "bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  {/* Attached photo rendering */}
                  {msg.image_url && (
                    <div className="mb-2 rounded-lg overflow-hidden max-w-[200px] border border-black/10">
                      <img src={msg.image_url} alt="Attached Media" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {msg.content && <p className="break-words">{msg.content}</p>}
                </div>

                {/* Bubble Timestamp & Status Ticks */}
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[9px] text-slate-500 font-semibold">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && (
                    <span title={msg.is_read ? "Read" : "Delivered"}>
                      <CheckCheck 
                        className={`w-3.5 h-3.5 ${msg.is_read ? "text-teal-400" : "text-slate-600"}`} 
                      />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Other User is Typing indicator */}
        {isOtherUserTyping && (
          <div className="mr-auto flex items-center gap-2 text-xs text-slate-500 italic pl-1 bg-slate-900/20 py-2 px-3.5 rounded-full border border-slate-900/60 max-w-[200px]">
            <Loader2 className="animate-spin text-teal-400" size={12} />
            <span>{otherUserName} is typing...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </main>

      {/* Inputs controls foot bar */}
      <footer className="border-t border-slate-900 bg-slate-950/80 backdrop-blur-md p-4 sticky bottom-0 z-50">
        <div className="max-w-4xl mx-auto space-y-3">
          
          {/* Image Upload previews */}
          {imagePreview && (
            <div className="relative inline-block border border-slate-800 bg-slate-900 p-1.5 rounded-2xl overflow-hidden shadow-2xl">
              <img src={imagePreview} alt="Chat attachment" className="w-24 h-24 object-cover rounded-xl" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-1.5 right-1.5 bg-black/80 hover:bg-red-500/80 rounded-full p-1 text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2">
            {/* Image attachment icon trigger */}
            <label className="p-3 bg-slate-900 border border-slate-800/80 rounded-2xl cursor-pointer hover:bg-slate-850 hover:border-slate-700 hover:text-teal-400 text-slate-400 transition-all flex items-center justify-center shrink-0">
              <ImageIcon size={20} />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>

            {/* Input bar */}
            <input
              type="text"
              placeholder="Type coordinates or meetup details..."
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                if (e.target.value.trim() === "") {
                  if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                  if (presenceChannelRef.current) {
                    presenceChannelRef.current.track({
                      userId,
                      isTyping: false,
                    });
                  }
                } else {
                  handleTyping();
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-800/80 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/80 transition-all"
            />

            {/* Send submit button */}
            <button
              type="submit"
              disabled={sending || (!textInput.trim() && !imageFile)}
              className="p-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-teal-500/10 flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
            >
              {sending ? (
                <Loader2 className="animate-spin text-slate-950" size={20} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>
      </footer>

      {/* HISTORICAL EXCHANGE/CHAT HISTORY OVERLAY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  📂 Archived Exchange History
                </h3>
                <p className="text-xs text-slate-400">
                  Read past conversation threads between you and {otherUserName} for this listing
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryMessages([]);
                  setSelectedHistoryClaimId(null);
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-slate-200 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Claims selection Tabs row if there are multiple sibling claims */}
            {pastClaims.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 border-b border-slate-900">
                {pastClaims.map((pc, index) => {
                  const isSelected = selectedHistoryClaimId === pc.id;
                  return (
                    <button
                      key={pc.id}
                      onClick={() => handleFetchHistoryMessages(pc.id)}
                      className={`text-[10px] font-black uppercase px-3.5 py-2 rounded-xl transition-all tracking-wider shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/15 border border-amber-500/25 text-amber-400"
                          : "bg-slate-950/40 border border-slate-850 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Exchange #{pastClaims.length - index} ({pc.status})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Chat message content box */}
            <div className="flex-1 overflow-y-auto bg-slate-950/40 border border-slate-900 rounded-2xl p-4 space-y-4 min-h-[300px]">
              {loadingHistoryMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500 py-16">
                  <Loader2 className="animate-spin text-amber-500" size={24} />
                  <span className="text-[11px]">Loading archived messages...</span>
                </div>
              ) : historyMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-650 py-16 text-center">
                  <p className="text-xs">No chat logs found in the database for this attempt.</p>
                  <p className="text-[10px] text-slate-700 mt-1">
                    (Note: Messages older than 90 days are automatically cleared from the platform).
                  </p>
                </div>
              ) : (
                historyMessages.map((msg) => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] space-y-1 ${
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? "bg-slate-800 text-slate-100 rounded-tr-none border border-slate-750"
                            : "bg-slate-900 text-slate-300 rounded-tl-none border border-slate-850"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[8px] text-slate-500 px-1 font-semibold">
                        {new Date(msg.created_at).toLocaleDateString()} at{" "}
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

// Fallback image close support button (used above)
function X({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

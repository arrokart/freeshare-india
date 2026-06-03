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
            listing:listing_id(id, title, images),
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

        // 2. Fetch last 50 historical messages
        const msgRes = await fetch(`/api/messages?claimId=${claimId}&limit=50`);
        const msgData = await msgRes.json();
        setMessages(Array.isArray(msgData) ? msgData : []);
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

    // 1. Subscribe to Live DB Inserts on messages table
    const messageChannel = supabase
      .channel(`live_messages:${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
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

            // 3. Otherwise, append normally (message from other user or no placeholder)
            return [...prev, newMsg];
          });
          scrollToBottom();
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
        const presignRes = await fetch("/api/listings/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: imageFile.name,
            fileType: imageFile.type,
          }),
        });

        const { uploadUrl, fileKey } = await presignRes.json();
        if (!uploadUrl) throw new Error("R2 Presign failed");

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
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

                {/* Bubble Timestamp */}
                <span className="text-[9px] text-slate-500 font-semibold px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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

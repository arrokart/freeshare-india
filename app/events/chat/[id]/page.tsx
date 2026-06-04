"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, ArrowLeft, Send, Calendar, User } from "lucide-react";

export default function EventChatPage() {
  const params = useParams();
  const router = useRouter();
  const inquiryId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inquiry, setInquiry] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadChatData = async () => {
      try {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push(`/login?next=/events/chat/${inquiryId}`);
          return;
        }
        setCurrentUser(user);

        // 2. Fetch inquiry details
        const { data: inqRecord, error: inqError } = await supabase
          .from("event_inquiries")
          .select(`
            *,
            event:event_id(id, title, organizer_id),
            user:user_id(id, name, avatar_url)
          `)
          .eq("id", inquiryId)
          .single();

        if (inqError || !inqRecord) {
          console.error("Failed to load conversation thread", inqError);
          router.push("/events");
          return;
        }

        // Fetch organizer host details separately
        const { data: hostProfile } = await supabase
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", inqRecord.event.organizer_id)
          .single();

        const enrichedInquiry = {
          ...inqRecord,
          host: hostProfile || null,
        };

        setInquiry(enrichedInquiry);

        // 3. Fetch message history
        const msgRes = await fetch(`/api/events/inquiry/messages?inquiryId=${inquiryId}`);
        const msgData = await msgRes.json();
        setMessages(Array.isArray(msgData) ? msgData : []);

        setLoading(false);
      } catch (err) {
        console.error("Error loading chat page data:", err);
        router.push("/events");
      }
    };

    if (inquiryId) {
      loadChatData();
    }
  }, [inquiryId, router]);

  // Supabase Real-time messages listener setup
  useEffect(() => {
    if (!inquiryId) return;

    const channel = supabase
      .channel(`realtime-inquiry-messages-${inquiryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_inquiry_messages",
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicate messages if API post already added it locally
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [inquiryId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || sending || !currentUser || !inquiry) return;

    const textToSend = newMessageText.trim();
    setNewMessageText("");
    setSending(true);

    try {
      const res = await fetch("/api/events/inquiry/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiry_id: inquiryId,
          sender_id: currentUser.id,
          content: textToSend,
        }),
      });

      const messageObj = await res.json();
      if (!res.ok) throw new Error(messageObj.error || "Failed to send message");

      setMessages((prev) => {
        if (prev.some((m) => m.id === messageObj.id)) return prev;
        return [...prev, messageObj];
      });
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="animate-spin text-amber-500" size={28} />
        <p className="text-xs">Loading chat thread...</p>
      </div>
    );
  }

  // Identify who the chat partner is (host vs inquirer)
  const isUserHost = currentUser.id === inquiry.event.organizer_id;
  const partnerName = isUserHost ? inquiry.user?.name : inquiry.host?.name;
  const partnerAvatar = isUserHost ? inquiry.user?.avatar_url : inquiry.host?.avatar_url;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans h-screen max-h-screen overflow-hidden selection:bg-amber-500 selection:text-black">
      
      {/* Header bar */}
      <nav className="border-b border-slate-900 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50 shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(`/events/${inquiry.event.id}`)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900 shrink-0"
              title="Back to Event"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-sm font-extrabold text-amber-500 uppercase overflow-hidden shrink-0">
              {partnerAvatar ? (
                <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
              ) : (
                partnerName?.charAt(0) || "U"
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-black text-slate-200 block truncate">{partnerName}</span>
              <span className="text-[9px] font-semibold text-slate-500 truncate flex items-center gap-1">
                <Calendar size={10} className="text-amber-500 shrink-0" />
                {inquiry.event.title}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
            {isUserHost ? "Event Host Inbox" : "Inquirer chat"}
          </span>
        </div>
      </nav>

      {/* Message feed */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-900/60 border border-slate-850 flex items-center justify-center text-3xl">
              💬
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-350">Start the conversation</h4>
              <p className="text-[10px] text-slate-550 max-w-xs leading-relaxed">
                Send a message to the host to ask questions, request details, or coordinate RSVPs for this event.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl p-3 px-4 shadow-md text-xs leading-relaxed ${
                    isMe
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-medium rounded-tr-none"
                      : "bg-slate-900 border border-slate-850 text-slate-250 rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <span
                    className={`text-[8px] font-bold block text-right mt-1.5 ${
                      isMe ? "text-slate-800" : "text-slate-550"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Chat input box */}
      <footer className="border-t border-slate-900 bg-slate-950/80 backdrop-blur-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shrink-0">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            required
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder={`Message ${partnerName?.split(" ")[0]}...`}
            className="flex-1 bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !newMessageText.trim()}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-slate-950 font-black text-xs transition-all active:scale-[0.98] disabled:opacity-50 shrink-0 flex items-center justify-center"
            title="Send Message"
          >
            {sending ? (
              <Loader2 className="animate-spin text-slate-950" size={14} />
            ) : (
              <Send size={14} />
            )}
          </button>
        </form>
      </footer>

    </div>
  );
}

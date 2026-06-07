"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, X, Send, Loader2, CheckCircle2 } from "lucide-react";

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hide button entirely if user is not logged in
  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      setErrorMsg("Please write at least 10 characters.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccess(false);

    try {
      const res = await fetch("/api/admin/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          message: message.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback.");
      }

      setSuccess(true);
      setMessage("");
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[45] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 p-3.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group cursor-pointer border border-teal-400/25"
        title="Share Feedback"
      >
        <MessageSquare size={18} strokeWidth={2.5} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-extrabold text-xs uppercase tracking-wider whitespace-nowrap">
          Feedback
        </span>
      </button>

      {/* Slide-over Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsOpen(false);
                setErrorMsg("");
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-xs font-bold bg-slate-950/40 p-1.5 rounded-lg border border-slate-850 cursor-pointer"
            >
              <X size={14} />
            </button>

            {success ? (
              <div className="text-center py-6 space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 size={48} className="text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">Thank You!</h4>
                  <p className="text-xs text-slate-400 mt-1">Your feedback helps us make ArcShare better.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                    💬 Share Platform Feedback
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Have suggestions, bugs, or feature requests? Let the team know!
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1">
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="E.g. The events filter is extremely helpful, but I'd love to see direct message alerts on WhatsApp..."
                    maxLength={1000}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-3 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all resize-none"
                  />
                  <div className="text-right text-[9px] text-slate-500 font-mono">
                    {message.length} / 1000 characters
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  Submit Feedback
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

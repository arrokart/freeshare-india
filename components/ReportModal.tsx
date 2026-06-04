"use client";

import React, { useState } from "react";
import { X, Flag, Loader2 } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reporterId: string | null;
  reportedUserId?: string;
  reportedListingId?: string;
  reportedEventId?: string;
  targetName: string; // "listing 'Wooden table'" or "user 'Demo User'"
}

const REPORT_REASONS = [
  { value: "fake_listing", label: "Fake Listing or Scam" },
  { value: "spam", label: "Spam or Duplicate Postings" },
  { value: "abuse", label: "Abusive or Inappropriate Behavior" },
  { value: "inappropriate", label: "Inappropriate Content / Images" },
  { value: "commercial_reselling", label: "Commercial Sales / Reselling" },
  { value: "other", label: "Other Issues" },
];

export default function ReportModal({
  isOpen,
  onClose,
  reporterId,
  reportedUserId,
  reportedListingId,
  reportedEventId,
  targetName,
}: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterId) {
      setErrorMsg("Please log in to submit a report.");
      return;
    }

    if (!reason) {
      setErrorMsg("Please select a reason for reporting.");
      return;
    }

    if (description.trim().length < 15) {
      setErrorMsg("Please provide more detail (minimum 15 characters).");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterId,
          reportedUserId,
          reportedListingId,
          reportedEventId,
          reason,
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit report");

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReason("");
        setDescription("");
        onClose();
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-455 hover:text-slate-200 rounded-full bg-slate-950/40 hover:bg-slate-800/50 transition-all border border-slate-800/40"
        >
          <X size={16} />
        </button>

        {success ? (
          /* Success Screen */
          <div className="p-6 text-center py-10 space-y-4">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
              <Flag size={28} />
            </div>
            <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">Report Submitted</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Thank you for helping keep FreeShare safe. Our administrators will review this report shortly.
            </p>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 mb-1">
                <Flag size={10} /> Flag Content
              </div>
              <h3 className="text-base font-extrabold text-slate-100">
                Report {targetName}
              </h3>
              <p className="text-xs text-slate-500">
                If you believe this content violates community guidelines, please report it.
              </p>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center font-medium">
                {errorMsg}
              </p>
            )}

            {/* Select Reason */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Reason for Report</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-3.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="">Select a reason...</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">Report Details</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the issue in detail (minimum 15 characters)..."
                maxLength={200}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-xs font-bold text-slate-400 py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1"
              >
                {loading ? (
                  <Loader2 className="animate-spin text-white" size={14} />
                ) : (
                  <>
                    <Flag size={13} />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

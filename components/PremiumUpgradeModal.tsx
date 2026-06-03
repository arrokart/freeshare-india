"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Check, Loader2, CreditCard, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onSuccess?: () => void;
}

type CheckoutMethod = "card" | "upi";

export default function PremiumUpgradeModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: PremiumUpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"pricing" | "checkout" | "success">("pricing");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutMethod>("card");
  const [errorMsg, setErrorMsg] = useState("");

  // Card Inputs
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cvvFocused, setCvvFocused] = useState(false);

  // UPI Inputs
  const [upiConfirming, setUpiConfirming] = useState(false);
  const [upiTimer, setUpiTimer] = useState(8);

  useEffect(() => {
    if (!isOpen) {
      setStep("pricing");
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
      setCvvFocused(false);
      setUpiConfirming(false);
      setErrorMsg("");
    }
  }, [isOpen]);

  // UPI checkout scanning confirmation simulator
  useEffect(() => {
    let interval: any;
    if (upiConfirming && upiTimer > 0) {
      interval = setInterval(() => {
        setUpiTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleUpgradeSuccess();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [upiConfirming, upiTimer]);

  if (!isOpen) return null;

  const handleUpgradeSuccess = async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      // 1. Update public.users table in Supabase
      const { error: dbError } = await supabase
        .from("users")
        .update({
          is_premium: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (dbError) throw dbError;

      // 2. Update User Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          is_premium: true,
        }
      });

      if (authError) throw authError;

      setStep("success");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Failed to upgrade to premium:", err);
      setErrorMsg(err.message || "Failed to complete premium upgrade. Please try again.");
      setUpiConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      setErrorMsg("Please fill in all credit card details.");
      return;
    }
    setLoading(true);
    await handleUpgradeSuccess();
  };

  const handleStartUpiVerify = () => {
    setUpiConfirming(true);
    setUpiTimer(6);
  };

  // Card formatting helpers
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const formatted = raw.match(/.{1,4}/g)?.join(" ") || "";
    setCardNumber(formatted.substring(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `${raw.substring(0, 2)}/${raw.substring(2, 4)}`;
    }
    setCardExpiry(formatted.substring(0, 5));
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-250 relative flex flex-col max-h-[90vh]">
        
        {/* Header banner glow */}
        <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-teal-500/10 via-emerald-500/5 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 rounded-full bg-slate-950/40 hover:bg-slate-800/50 transition-all border border-slate-800/40 z-20"
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 relative flex-1">
          
          {/* STEP 1: PRICING PLANS VIEW */}
          {step === "pricing" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/30 text-teal-400 mb-1">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
                <h3 className="text-xl font-black text-slate-100 uppercase tracking-wider">
                  Choose your sharing plan
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Upgrade your limit overrides permanently or stay on the default program.
                </p>
              </div>

              {/* Tiers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Standard Free Tier Card */}
                <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      Standard
                    </span>
                    <h4 className="text-sm font-black text-slate-200 pt-1.5">Free Tier</h4>
                    <p className="text-[11px] text-slate-400">Regular default claim limit cap per neighbor.</p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-slate-600 shrink-0" />
                      <span>10 free item claims / month</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 line-through">
                      <Check size={12} className="shrink-0" />
                      <span>Early access listings</span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-full bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 py-2.5 rounded-xl font-bold text-xs transition-colors"
                  >
                    Keep Free Plan
                  </button>
                </div>

                {/* Premium Plan Card */}
                <div className="bg-gradient-to-b from-teal-500/10 to-transparent border border-teal-500/30 p-5 rounded-2xl flex flex-col justify-between space-y-4 relative shadow-xl shadow-teal-500/5">
                  <div className="absolute top-4 right-4">
                    <span className="text-[8px] font-black uppercase tracking-wider text-teal-400 bg-teal-500/15 border border-teal-500/25 px-2 py-0.5 rounded-full animate-pulse">
                      Recommended
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-teal-400 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20">
                      Pro Share
                    </span>
                    <h4 className="text-sm font-black text-slate-100 pt-1.5 flex items-center gap-1">
                      Premium Plan
                      <span className="text-xs text-slate-400 font-normal">/ month</span>
                    </h4>
                    <p className="text-[11px] text-slate-300">Unlock absolute sharing limits and early item alerts.</p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-900/60 text-[11px] text-slate-350">
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-teal-400 shrink-0" />
                      <span>Unlimited item claims</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-teal-400 shrink-0" />
                      <span>Early Listing Access (2h before)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-teal-400 shrink-0" />
                      <span>Verified Gold Badge indicators</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!userId) {
                        setErrorMsg("Please log in to upgrade to Premium.");
                      } else {
                        setStep("checkout");
                      }
                    }}
                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-all active:scale-[0.98]"
                  >
                    Upgrade Plan (₹299/mo)
                  </button>
                </div>
              </div>
              {errorMsg && (
                <p className="text-xs text-rose-500 text-center font-medium bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl">
                  {errorMsg}
                </p>
              )}
            </div>
          )}

          {/* STEP 2: CHECKOUT OPTIONS (UPI OR CREDIT CARD INTERACTIVE) */}
          {step === "checkout" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-100 uppercase tracking-wide">
                  Complete Subscription Checkout
                </h3>
                <p className="text-xs text-slate-400">
                  Select payment type to activate unlimited claim limits instantly.
                </p>
              </div>

              {/* Checkout tabs navigation */}
              <div className="grid grid-cols-2 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-900 gap-1.5 text-xs font-bold">
                <button
                  onClick={() => { setPaymentMethod("card"); setErrorMsg(""); }}
                  className={`py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === "card"
                      ? "bg-slate-900 border border-slate-800 text-teal-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CreditCard size={14} />
                  Credit / Debit Card
                </button>
                <button
                  onClick={() => { setPaymentMethod("upi"); setErrorMsg(""); }}
                  className={`py-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === "upi"
                      ? "bg-slate-900 border border-slate-800 text-teal-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <QrCode size={14} />
                  Pay via UPI QR
                </button>
              </div>

              {/* PAYMENT WINDOW: CREDIT CARD METHOD */}
              {paymentMethod === "card" && (
                <div className="space-y-5">
                  {/* Glassmorphic interactive Card flip layout container */}
                  <div className="perspective-1000 w-full max-w-[320px] mx-auto h-[180px] select-none">
                    <div
                      className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
                        cvvFocused ? "rotate-y-180" : ""
                      }`}
                    >
                      {/* CARD FRONT SIDE */}
                      <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 p-5 flex flex-col justify-between border border-slate-700/40 backface-hidden shadow-2xl">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">
                            FreeShare Pay
                          </span>
                          <span className="w-10 h-7 bg-slate-950/40 rounded-lg flex items-center justify-center text-xs font-black italic text-slate-300">
                            VISA
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {/* Card chip */}
                          <div className="w-8 h-6 bg-yellow-500/20 border border-yellow-500/30 rounded-md" />
                          <div className="font-mono text-base text-slate-100 tracking-widest text-center py-1">
                            {cardNumber || "•••• •••• •••• ••••"}
                          </div>
                        </div>
                        <div className="flex justify-between items-end text-[10px]">
                          <div>
                            <span className="text-slate-500 block uppercase font-bold text-[8px]">Cardholder</span>
                            <span className="font-bold text-slate-200 block truncate max-w-[150px]">
                              {cardName.toUpperCase() || "YOUR NAME"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block uppercase font-bold text-[8px]">Expiry</span>
                            <span className="font-mono font-bold text-slate-200 block">
                              {cardExpiry || "MM/YY"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARD BACK SIDE */}
                      <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 py-5 flex flex-col justify-between border border-slate-800 backface-hidden rotate-y-180 shadow-2xl">
                        <div className="w-full h-9 bg-slate-950" />
                        <div className="px-5">
                          <span className="text-slate-500 block uppercase font-bold text-[8px] mb-1">Signature CVV</span>
                          <div className="w-full h-8 bg-slate-100 rounded flex justify-end items-center px-3">
                            <span className="font-mono font-black text-slate-900 italic text-xs tracking-wider">
                              {cardCvv || "•••"}
                            </span>
                          </div>
                        </div>
                        <div className="px-5 text-[9px] text-slate-650 font-bold">
                          FreeShare Premium Subscription Card Verification Security.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Form Inputs */}
                  <form onSubmit={handleCardSubmit} className="space-y-4">
                    {/* Cardholder Name */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Aditya Nair"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        required
                        className="w-full bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    {/* Card Number */}
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                        Card Number
                      </label>
                      <input
                        type="text"
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        required
                        className="w-full bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                      />
                    </div>

                    {/* Expiry & CVV */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                          Expiration Date
                        </label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={handleExpiryChange}
                          required
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                          Security CVV
                        </label>
                        <input
                          type="text"
                          maxLength={3}
                          placeholder="123"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").substring(0, 3))}
                          onFocus={() => setCvvFocused(true)}
                          onBlur={() => setCvvFocused(false)}
                          required
                          className="w-full bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono text-center"
                        />
                      </div>
                    </div>

                    {errorMsg && (
                      <p className="text-xs text-rose-500 text-center font-medium bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl">
                        {errorMsg}
                      </p>
                    )}

                    {/* Action button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>Pay & Upgrade Plan</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* PAYMENT WINDOW: UPI QR CODE SCAN SIMULATION */}
              {paymentMethod === "upi" && (
                <div className="space-y-5 text-center">
                  {!upiConfirming ? (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      {/* Fake QR Scanner container */}
                      <div className="w-[180px] h-[180px] bg-slate-950 border border-slate-800 rounded-3xl mx-auto flex flex-col items-center justify-center p-4 relative overflow-hidden group shadow-2xl">
                        {/* QR Grid background */}
                        <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-slate-455 border border-slate-800/60">
                          <QrCode size={110} className="text-teal-400" />
                        </div>
                        {/* Scanning green line effect */}
                        <div className="absolute left-0 right-0 h-[2px] bg-teal-500 top-4 animate-scanner opacity-80" />
                      </div>

                      <div className="space-y-1 max-w-sm mx-auto">
                        <p className="text-xs font-bold text-slate-200">
                          Scan the code with any UPI app (GPay, PhonePe, Paytm)
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Amount due: <span className="font-extrabold text-teal-400 font-mono">₹299.00</span>
                        </p>
                      </div>

                      {errorMsg && (
                        <p className="text-xs text-rose-500 text-center font-medium bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl">
                          {errorMsg}
                        </p>
                      )}

                      <button
                        onClick={handleStartUpiVerify}
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      >
                        Simulate QR Scan (Pay)
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="inline-flex items-center justify-center p-4 rounded-full bg-teal-500/5 border border-teal-500/20 text-teal-400 relative">
                        <Loader2 className="animate-spin text-teal-400" size={32} />
                        <span className="absolute font-mono text-[9px] font-black">{upiTimer}s</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-200">Verifying UPI transaction...</h4>
                        <p className="text-[10px] text-slate-500">Connecting with NPCI payment gateways. Do not reload.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: TRANSACTION SUCCESS PLAN ACTIVE ANIMATION */}
          {step === "success" && (
            <div className="text-center py-6 space-y-5 animate-in zoom-in-95 duration-300">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 relative">
                {/* Glowing ring animation */}
                <div className="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping opacity-60" />
                <Check size={32} strokeWidth={3} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-emerald-400 uppercase tracking-wider">
                  Payment Confirmed!
                </h3>
                <h4 className="text-sm font-bold text-slate-200">
                  Welcome to FreeShare Premium
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Your local account settings have been expanded. You now have unlimited item claims and premium search badges!
                </p>
              </div>

              <button
                onClick={onClose}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-300 font-bold px-6 py-2.5 rounded-xl text-xs transition-all active:scale-[0.98]"
              >
                Close Billing Console
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

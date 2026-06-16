"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Info } from "lucide-react";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if consent has already been registered
    const storedConsent = localStorage.getItem("freeshare_cookie_consent");
    if (!storedConsent) {
      // Delay showing the banner slightly for better page-load transition UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (status: "granted" | "denied") => {
    localStorage.setItem("freeshare_cookie_consent", status);
    setIsVisible(false);

    // Fire custom event to notify AnalyticsManager of the update
    window.dispatchEvent(new Event("cookieConsentChanged"));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[9999] max-w-sm backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-350 select-none"
      style={{ background: "var(--paper)", border: "1.5px solid var(--line)", boxShadow: "var(--shadow)" }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "var(--teal-soft)", border: "1px solid var(--teal)", color: "var(--teal)" }}>
          <ShieldCheck size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-display font-bold uppercase tracking-wider" style={{ color: "var(--ink)" }}>Cookie Preferences</h4>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            We use essential cookies to maintain your login session. We also use analytics and advertising cookies (like Google AdSense) to keep this platform 100% free.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          onClick={() => saveConsent("denied")}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-bold transition-all uppercase cursor-pointer"
          style={{ background: "transparent", border: "1.5px solid var(--line)", color: "var(--ink-soft)" }}
        >
          Essential Only
        </button>
        <button
          onClick={() => saveConsent("granted")}
          className="w-full sm:flex-1 px-4 py-2 rounded-xl text-[10px] font-display font-semibold transition-all uppercase cursor-pointer text-center"
          style={{ background: "var(--terracotta)", color: "var(--paper)" }}
        >
          Accept All
        </button>
      </div>

      <div className="flex items-center gap-1 text-[8.5px] mt-1" style={{ color: "var(--ink-soft)" }}>
        <Info size={10} />
        <span>You can update your choices at any time in settings.</span>
      </div>
    </div>
  );
}

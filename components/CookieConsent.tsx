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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-[9999] max-w-sm bg-slate-900/90 border border-slate-800 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-2xl space-y-4 animate-in slide-in-from-bottom-5 duration-350 select-none">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck size={18} />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black text-slate-100 uppercase tracking-wider">Cookie Preferences</h4>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            We use essential cookies to maintain your login session. We also use analytics and advertising cookies (like Google AdSense) to keep this platform 100% free.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          onClick={() => saveConsent("denied")}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-[10px] font-bold text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-950 border border-slate-850 hover:border-slate-750 transition-all uppercase cursor-pointer"
        >
          Essential Only
        </button>
        <button
          onClick={() => saveConsent("granted")}
          className="w-full sm:flex-1 px-4 py-2 rounded-xl text-[10px] font-extrabold text-slate-950 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 transition-all shadow-md uppercase cursor-pointer text-center"
        >
          Accept All
        </button>
      </div>

      <div className="flex items-center gap-1 text-[8.5px] text-slate-500 mt-1">
        <Info size={10} />
        <span>You can update your choices at any time in settings.</span>
      </div>
    </div>
  );
}

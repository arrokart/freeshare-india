"use client";

import React, { useEffect, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { Language } from "@/lib/i18n";

export default function LanguageSelector() {
  const [currentLang, setCurrentLang] = useState<Language>("en");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("freeshare_locale") as Language;
    if (stored) {
      setCurrentLang(stored);
    }
  }, []);

  const handleLanguageSelect = (lang: Language) => {
    localStorage.setItem("freeshare_locale", lang);
    setCurrentLang(lang);
    setIsOpen(false);
    window.dispatchEvent(new Event("languageChanged"));
  };

  const languageLabels = {
    en: "English",
    hi: "हिन्दी"
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-300 hover:text-slate-100 transition-all cursor-pointer"
      >
        <Globe size={13} className="text-teal-400" />
        <span>{languageLabels[currentLang]}</span>
        <ChevronDown size={12} className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay to close popover */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-32 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {(Object.keys(languageLabels) as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageSelect(lang)}
                className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  currentLang === lang
                    ? "text-teal-400 bg-teal-500/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                {languageLabels[lang]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

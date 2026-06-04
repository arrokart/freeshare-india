"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, MapPin, Eye, Trash2 } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all font-semibold uppercase tracking-wider">
            <ArrowLeft size={14} /> Back to home
          </Link>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FreeShare India</span>
        </div>
      </header>

      {/* Main Content Box */}
      <main className="max-w-4xl mx-auto px-4 pt-12 space-y-10">
        {/* Title Hero Banner */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-slate-400 font-medium">Last updated: June 2026</p>
        </div>

        {/* Section Cards */}
        <div className="space-y-6">
          
          {/* Card 1: Data Collection */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-teal-400">
              <Eye size={20} />
              <h2 className="text-base font-bold text-slate-100">1. Information We Collect</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              We collect information to help facilitate secure and local item exchanges. This includes your name, email address, profile photo, and active messages sent within our chat platform. Real-time message exchange metadata is saved securely to support active chats.
            </p>
          </div>

          {/* Card 2: Geolocation tracking */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-violet-400">
              <MapPin size={20} />
              <h2 className="text-base font-bold text-slate-100">2. Geolocation and Area Mapping</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              FreeShare matches items and skills based on proximity. When you upload a listing, your approximate location (city, area, and pincode) is stored. Real-time browser coordinate checks are done entirely client-side to calculate distance metrics and are never shared with third parties.
            </p>
          </div>

          {/* Card 3: Storage and Security */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck size={20} />
              <h2 className="text-base font-bold text-slate-100">3. Safe Storage & Web Push Tokens</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              All profile and listing details are saved securely on encrypted cloud servers. PWA Web Push notification subscription tokens are saved to deliver instant notifications directly to your device and can be cleared at any time by toggling browser permission settings.
            </p>
          </div>

          {/* Card 4: Right to Erasure */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <Trash2 size={20} />
              <h2 className="text-base font-bold text-slate-100">4. Right to Erasure (DPDP Act Compliance)</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              In compliance with India's Digital Personal Data Protection (DPDP) Act, you have full control over your personal data. You can delete your active listings at any time. For complete account deletion or permanent removal of chat logs, please email your request directly to <a href="mailto:support@freeshare.in" className="text-teal-400 hover:underline">support@freeshare.in</a>.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

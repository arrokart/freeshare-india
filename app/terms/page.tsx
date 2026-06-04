"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Scale, Ban, HeartHandshake } from "lucide-react";

export default function TermsOfService() {
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
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">Terms of Service</h1>
          <p className="text-xs text-slate-400 font-medium">Last updated: June 2026</p>
        </div>

        {/* Section Cards */}
        <div className="space-y-6">
          
          {/* Card 1: 100% Free Platform */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-teal-400">
              <HeartHandshake size={20} />
              <h2 className="text-base font-bold text-slate-100">1. Pure Donation Model (100% Free)</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              FreeShare India is a strictly non-commercial platform. All items, skills, and community events shared here must be offered completely free of charge. Selling items, requesting shipping fees, or demanding compensation in any form is prohibited and will lead to an immediate lifetime ban.
            </p>
          </div>

          {/* Card 2: Prohibited Goods Blacklist */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Ban size={20} />
              <h2 className="text-base font-bold text-slate-100">2. Prohibited Goods & Services Blacklist</h2>
            </div>
            <div className="text-xs text-slate-350 leading-relaxed space-y-2">
              <p>To avoid legal and safety hazards in India, you are strictly prohibited from listing, hosting, or offering:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Prescription drugs, medicines, vitamins, or medical supplements.</li>
                <li>Alcohol, tobacco products, e-cigarettes, or vaporizers.</li>
                <li>Weapons, firearms, knives, ammunition, or fireworks.</li>
                <li>Expired food products or unsafe items.</li>
                <li>Counterfeit, duplicated, or pirated trademarked goods.</li>
                <li>Illegal services or adult-oriented sessions.</li>
              </ul>
            </div>
          </div>

          {/* Card 3: As-Is Disclaimers */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <Scale size={20} />
              <h2 className="text-base font-bold text-slate-100">3. Non-Liability and "As-Is" Exchange</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              The platform acts solely as a peer-to-peer directory matcher. All donations are provided "as-is" without any warranties, express or implied. Users assume all responsibility for verifying the quality, safety, and hygiene of items received or services booked.
            </p>
          </div>

          {/* Card 4: Intermediary and Safe Harbor Policy */}
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-violet-400">
              <ShieldAlert size={20} />
              <h2 className="text-base font-bold text-slate-100">4. Intermediary Status & Grievance Contact (IT Rules 2021)</h2>
            </div>
            <p className="text-xs text-slate-350 leading-relaxed">
              FreeShare India is an intermediary platform under Section 79 of the Indian Information Technology Act. We do not verify or own the content listed. If you find copyright infringements, intellectual property issues, or abusive content, please immediately file a report or contact our Grievance Officer at <a href="mailto:legal@freeshare.in" className="text-teal-400 hover:underline">legal@freeshare.in</a>.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

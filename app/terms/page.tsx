"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Scale, Ban, HeartHandshake, CreditCard, RefreshCw, HelpCircle, FileText, Search } from "lucide-react";

type CategoryFilter = "all" | "rules" | "billing" | "legal";

export default function TermsOfService() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const termsSections = [
    {
      id: "rules-1",
      category: "rules",
      title: "1. Pure Donation Model & Core Community Policy",
      icon: <HeartHandshake className="w-5 h-5 text-teal-400" />,
      content: "FreeShare India is built on trust and mutual aid. The listing, sharing, and claiming of standard items and services on the basic feed will always remain 100% free. Users are strictly prohibited from selling items, requesting shipping fees, or demanding compensation in any form. Demanding payment for a listing is a direct violation of community policy and results in an immediate lifetime ban.",
    },
    {
      id: "rules-2",
      category: "rules",
      title: "2. Prohibited Goods & Services Blacklist",
      icon: <Ban className="w-5 h-5 text-red-400" />,
      content: "To maintain community safety and comply with local laws in India, listing the following goods or services is strictly prohibited: (a) Prescription drugs, medicines, vitamins, or medical supplements. (b) Alcohol, tobacco, nicotine, e-cigarettes, or vaporizers. (c) Weapons, firearms, knives, ammunition, or fireworks. (d) Expired food items, opened/unhygienic cosmetics. (e) Counterfeit, duplicated, or pirated trademarked items. (f) Illegal services, commercial advertisements, or adult-oriented sessions.",
    },
    {
      id: "billing-1",
      category: "billing",
      title: "3. Optional Premium Services & Monetization",
      icon: <CreditCard className="w-5 h-5 text-violet-400" />,
      content: "FreeShare India reserves the right to introduce optional premium features, subscription packages (e.g. FreeShare Premium), and promotional options (e.g. listing boosts or featured event bookings) to support server costs and community expansion. Unlocking these value-added packages is completely voluntary. Basic item sharing will remain open to all users without charge.",
    },
    {
      id: "billing-2",
      category: "billing",
      title: "4. Payments, Auto-Renewals & Refunds",
      icon: <RefreshCw className="w-5 h-5 text-emerald-400" />,
      content: "Any premium services or subscription tiers purchased on FreeShare India are governed by clear transaction rules: (a) Billing transactions are securely processed by authorized third-party payment gateways (e.g., Stripe, Razorpay). (b) Subscriptions auto-renew unless cancelled in your user profile dashboard settings before the next renewal date. (c) Unless required by local consumer protection laws, all premium payments, tokens, or boosts are non-refundable.",
    },
    {
      id: "legal-1",
      category: "legal",
      title: "5. Non-Liability & 'As-Is' Exchange Agreement",
      icon: <Scale className="w-5 h-5 text-amber-400" />,
      content: "FreeShare India acts solely as a matching directory. We do not inspect, own, verify, or guarantee the quality, safety, or legality of any item or skill shared. Users assume all responsibility for verifying the quality, hygiene, and safe usage of items claimed. By using this service, you hold FreeShare India and its organizers harmless from any physical harm, disputes, or liabilities arising from peer-to-peer exchanges.",
    },
    {
      id: "legal-2",
      category: "legal",
      title: "6. Intermediary Status & Safe Harbor (IT Act Section 79)",
      icon: <ShieldAlert className="w-5 h-5 text-blue-400" />,
      content: "We operate as an intermediary network under Section 79 of the Indian Information Technology Act. We do not pre-screen user-generated listings. If you identify copyright infringements, guideline violations, or abusive chat messages, please file an instant report. Our designated Grievance Officer can be contacted directly at legal@freeshare.in.",
    },
    {
      id: "legal-3",
      category: "legal",
      title: "7. Modifications to the Terms & Platforms Changes",
      icon: <FileText className="w-5 h-5 text-teal-400" />,
      content: "FreeShare India reserves the right to modify, replace, or update these Terms of Service or service fees at any time. When substantial changes occur, we will provide a 15-day prior notice via email, system notifications, or a banner in the dashboard. Continued use of the application after changes go into effect constitutes legal consent to the updated terms.",
    },
  ];

  const faqs = [
    {
      q: "Will sharing items and claiming standard items ever cost money?",
      a: "No! The core mission of FreeShare India is to facilitate neighborly donation and reduce waste. Listing your unwanted items and claiming basic shares will always be free.",
    },
    {
      q: "What benefits will Premium Subscriptions offer in the future?",
      a: "Future premium tiers may offer value-added boosts such as higher active claim limits, early access notifications for popular listings, specialized verified badges, and ad-free browsing.",
    },
    {
      q: "How can I manage or cancel a future paid package?",
      a: "All subscription packages will be easily managed directly from your User Dashboard settings, letting you cancel auto-renewals with a single click at any time.",
    },
  ];

  const filteredSections = termsSections.filter((sec) => {
    const matchesCategory = activeCategory === "all" || sec.category === activeCategory;
    const matchesSearch =
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-20 selection:bg-teal-500 selection:text-black">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all font-bold uppercase tracking-wider group">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back to home
          </Link>
          <span className="text-xs font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20 shadow-[0_0_15px_-3px_rgba(20,184,166,0.1)]">
            Policy Center
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 pt-12 space-y-10">
        
        {/* Title Hero Banner */}
        <div className="space-y-4 text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight bg-gradient-to-r from-teal-400 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Last Updated & Prepared for Future Growth: June 2026
          </p>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
            Please read these terms carefully. They establish our platform guidelines, safety requirements, legal liability exemptions, and terms regarding potential premium service upgrades.
          </p>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="space-y-4 bg-slate-900/15 border border-slate-900/60 p-4 rounded-2xl backdrop-blur-md">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search policies (e.g. premium, refund, rules)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-900 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-teal-500/50 transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: "all", label: "📚 All Clauses" },
              { id: "rules", label: "🛡️ Rules & Safety" },
              { id: "billing", label: "💳 Billing & Premium" },
              { id: "legal", label: "⚖️ Legal Shield" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as CategoryFilter)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeCategory === tab.id
                    ? "bg-teal-500 text-slate-950 font-black shadow-lg shadow-teal-500/15"
                    : "text-slate-400 bg-slate-950/20 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Render Section Cards */}
        <div className="space-y-4">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-900 rounded-2xl text-slate-500 text-xs">
              No matching terms sections found for "{searchQuery}".
            </div>
          ) : (
            filteredSections.map((sec) => {
              const isActive = activeCategory !== "all" && activeCategory === sec.category;
              return (
                <div
                  key={sec.id}
                  className={`relative overflow-hidden p-6 rounded-2xl border transition-all duration-300 ${
                    isActive 
                      ? "bg-slate-900/80 border-teal-500/20 shadow-[0_0_20px_-5px_rgba(20,184,166,0.08)]" 
                      : "bg-slate-900/30 border-slate-900 hover:border-slate-800 hover:bg-slate-900/40"
                  }`}
                >
                  {/* Left indicator accent color */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    sec.category === "rules" ? "bg-teal-500" :
                    sec.category === "billing" ? "bg-violet-500" :
                    "bg-amber-500"
                  }`} />

                  <div className="space-y-3 pl-1">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-900 shrink-0">
                        {sec.icon}
                      </div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-100">
                        {sec.title}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      {sec.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Future Monetization FAQ section */}
        <div className="mt-12 pt-10 border-t border-slate-900 space-y-6">
          <div className="flex items-center gap-2 text-slate-200">
            <HelpCircle className="w-5 h-5 text-teal-400" />
            <h3 className="text-lg font-black tracking-tight">Monetization & Future Changes FAQ</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {faqs.map((faq, index) => (
              <div key={index} className="p-5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 flex items-start gap-2">
                  <span className="text-teal-400">Q:</span> {faq.q}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed pl-5">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, MapPin, Eye, Trash2, Lock, CreditCard, Search, HelpCircle } from "lucide-react";

type CategoryFilter = "all" | "collection" | "location" | "security";

export default function PrivacyPolicy() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const privacySections = [
    {
      id: "collect-1",
      category: "collection",
      title: "1. Information We Collect & Chat Metadata",
      icon: <Eye className="w-5 h-5 text-teal-400" />,
      content: "To facilitate safe, local item exchanges, we collect information you explicitly provide: (a) Profile Details: Name, email address, profile description, and avatar photo. (b) Live Communications: Private chat text and image coordinates sent within the claim or event inbox. This message data is stored securely to display your message logs in real-time.",
    },
    {
      id: "collect-2",
      category: "collection",
      title: "2. Payment & Billing Disclosures (PCI-DSS Compliance)",
      icon: <CreditCard className="w-5 h-5 text-violet-400" />,
      content: "When optional premium subscriptions or listing boosts are purchased, we do not store your credit card, debit card, or UPI credentials on our servers. All payments are collected directly by certified PCI-DSS compliant third-party payment gateways (e.g. Stripe, Razorpay). These gateway partners securely manage your payment tokens and billing details according to strict banking security standards.",
    },
    {
      id: "loc-1",
      category: "location",
      title: "3. Proximity Location & Area Protection",
      icon: <MapPin className="w-5 h-5 text-amber-400" />,
      content: "FreeShare India matches shares and bookings based on proximity. When you upload a listing, we store your self-selected city, neighborhood area name, and pincode. Exact GPS coordinates are queried locally in your web browser to calculate nearby listing distances and are never saved to our central databases or disclosed to other users.",
    },
    {
      id: "sec-1",
      category: "security",
      title: "4. Data Security & Notification Tokens",
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      content: "We take administrative and technical security measures to protect your database profile. This includes encryption protocols for cloud storage and secure SSL transmission. Subscription tokens for PWA Web Push notifications are stored securely to deliver alert notifications directly to your device and can be cleared instantly in browser permissions.",
    },
    {
      id: "sec-2",
      category: "security",
      title: "5. DPDP Act Compliance & Right to Erasure",
      icon: <Trash2 className="w-5 h-5 text-rose-400" />,
      content: "In compliance with India's Digital Personal Data Protection (DPDP) Act, you have absolute ownership over your data. You can delete your listings at any time. If you wish to request a complete account deletion and permanent removal of all chat history and profile details, please contact us directly at support@freeshare.in. Your data will be fully purged from our active systems within 30 days.",
    },
  ];

  const faqs = [
    {
      q: "Does FreeShare track my exact location in the background?",
      a: "No. FreeShare only uses your neighborhood area and city to organize local feeds. Real-time browser GPS calculations are done completely on your device to show distance metrics and are never sent to our servers.",
    },
    {
      q: "How secure is my billing information for future boosts or premium plans?",
      a: "Extremely secure. All billing transactions bypass our servers and are handled directly by industry-leading payment processors using PCI-DSS compliant tokenization.",
    },
    {
      q: "Can I request that all my chats and active logs be permanently deleted?",
      a: "Yes. In accordance with the DPDP Act, you can request full erasure of all account details. Send an email to support@freeshare.in and we will permanently delete all records.",
    },
  ];

  const filteredSections = privacySections.filter((sec) => {
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
            Privacy Center
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 pt-12 space-y-10">
        
        {/* Title Hero Banner */}
        <div className="space-y-4 text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-100 tracking-tight bg-gradient-to-r from-teal-400 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Last Updated & Prepared for Growth: June 2026
          </p>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
            We value your privacy and trust. This document outlines the types of data we collect, how locations are kept local, our data security practices, and compliance with India's DPDP Act.
          </p>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="space-y-4 bg-slate-900/15 border border-slate-900/60 p-4 rounded-2xl backdrop-blur-md">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search privacy policies (e.g. location, delete, payment)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/40 border border-slate-900 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-teal-500/50 transition-all"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: "all", label: "📚 All Policies" },
              { id: "collection", label: "🔍 Data Collection" },
              { id: "location", label: "📍 Location Privacy" },
              { id: "security", label: "🔐 Security & DPDP" },
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
              No matching privacy policies found for "{searchQuery}".
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
                    sec.category === "collection" ? "bg-teal-500" :
                    sec.category === "location" ? "bg-amber-500" :
                    "bg-emerald-500"
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

        {/* Proximity Privacy FAQ section */}
        <div className="mt-12 pt-10 border-t border-slate-900 space-y-6">
          <div className="flex items-center gap-2 text-slate-200">
            <HelpCircle className="w-5 h-5 text-teal-400" />
            <h3 className="text-lg font-black tracking-tight">Privacy FAQ</h3>
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

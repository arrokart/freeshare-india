"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User, Mail, Lock, Calendar, MapPin, Loader2, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [referralCode, setReferralCode] = useState("");

  // States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  // Validate Age (Must be 18+)
  const validateAge = (birthDateString: string): boolean => {
    if (!birthDateString) return false;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 18;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        sessionStorage.setItem("freeshare_referrer_id", ref);
        // Pre-fill the invite code input as well
        setReferralCode("REF-" + ref.substring(0, 8).toUpperCase());
      }
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    // Age validation check
    if (!validateAge(dob)) {
      setErrorMsg("Registration blocked: You must be 18 years or older to register on FreeShare India.");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Sign up in Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            date_of_birth: dob,
            city,
            area,
            pincode,
          },
        },
      });

      if (authError) throw authError;

      // Step 2: Insert into public.users table (if DB triggers haven't done so automatically)
      if (data?.user) {
        const { error: dbError } = await supabase.from("users").insert({
          id: data.user.id,
          email,
          name,
          date_of_birth: dob,
          city,
          area,
          pincode,
        });

        if (dbError && !dbError.message.includes("already exists")) {
          throw dbError;
        }

        // Call the referral conversion API
        const referrerId = sessionStorage.getItem("freeshare_referrer_id");
        if (referrerId || referralCode.trim()) {
          try {
            await fetch("/api/referral", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                referrerId,
                referrerCode: referralCode.trim(),
                newUserId: data.user.id,
              }),
            });
            sessionStorage.removeItem("freeshare_referrer_id");
          } catch (err) {
            console.error("Referral recording failed:", err);
          }
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during signup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 to-slate-950 p-4 font-sans text-slate-100 selection:bg-teal-500 selection:text-black">
      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/50 transition-all duration-300 hover:border-slate-700/80">
        
        {success ? (
          /* Success Screen */
          <div className="text-center py-8 space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 size={64} className="text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Verify Your Email</h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                We've sent a verification link to <span className="text-teal-400">{email}</span>. Please click the link to verify your account.
              </p>
            </div>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-teal-500/10"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                Join FreeShare
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                You must be 18+ to share or claim items.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Full Name
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    minLength={8}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Date of Birth
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                    <Calendar size={16} />
                  </span>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Location (City, Area & Pincode) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    City
                  </label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                      <MapPin size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    Area
                  </label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                      <MapPin size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Andheri West"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                    Pincode
                  </label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
                      <MapPin size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 400053"
                      maxLength={10}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Referral Code (Optional) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-350 uppercase tracking-wider block">
                  Referral / Invite Code (Optional)
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="e.g. REF-81158650"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all uppercase"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 relative overflow-hidden group bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin text-slate-950" size={18} />
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
              <p className="text-xs text-slate-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-teal-400 hover:text-teal-300 font-semibold hover:underline transition-all"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

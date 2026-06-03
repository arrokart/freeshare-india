"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

// Nested component that consumes the SearchParams safely under Suspense
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Set cookie helper for SSR / Next.js proxy token checks
      if (data?.session) {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${data.session.expires_in}; SameSite=Lax; Secure`;
      }

      setSuccessMsg("Logged in successfully! Redirecting...");
      setTimeout(() => {
        router.push(redirectTarget);
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/50 transition-all duration-300 hover:border-slate-700/80">
      
      {/* Branding header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
          FreeShare India
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Give items away. Help neighbors. Reduce waste.
        </p>
      </div>

      {/* Auth responses */}
      {errorMsg && (
        <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-pulse">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        {/* Email field */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Email Address
          </label>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
              <Mail size={18} />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
            />
          </div>
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-teal-400 hover:text-teal-300 hover:underline transition-all"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400 transition-colors">
              <Lock size={18} />
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
            />
          </div>
        </div>

        {/* Login button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 relative overflow-hidden group bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin text-slate-950" size={18} />
          ) : (
            <>
              Sign In
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Navigation prompt */}
      <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="text-teal-400 hover:text-teal-300 font-semibold hover:underline transition-all"
          >
            Sign Up (18+)
          </Link>
        </p>
      </div>

    </div>
  );
}

// Fallback spinner component when loading SearchParams
function LoginFormFallback() {
  return (
    <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center min-h-[350px]">
      <Loader2 className="animate-spin text-teal-400" size={32} />
      <p className="text-sm text-slate-400 mt-4">Loading secure form...</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-slate-900 to-slate-950 p-4 font-sans text-slate-100 selection:bg-teal-500 selection:text-black">
      {/* Background visual circles */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

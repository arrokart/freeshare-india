"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getR2PublicUrl } from "@/lib/r2";
import { 
  Loader2, ArrowLeft, Heart, ShieldCheck, CheckCircle2, 
  FileText, Upload, AlertCircle, Sparkles, X, Check
} from "lucide-react";

export default function NGOApplyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // NGO App Form Fields
  const [orgName, setOrgName] = useState("");
  const [darpanId, setDarpanId] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [userDesc, setUserDesc] = useState("");

  // Existing App State
  const [existingApp, setExistingApp] = useState<any | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?next=/profile/ngo-apply");
        return;
      }
      setUserId(data.user.id);
      await fetchExistingApp(data.user.id);
      setLoading(false);
    };
    checkSession();
  }, [router]);

  const fetchExistingApp = async (uid: string) => {
    try {
      const { data: profile } = await supabase
        .from("users")
        .select("bio, is_ngo")
        .eq("id", uid)
        .single();

      if (profile?.bio) {
        try {
          const parsed = JSON.parse(profile.bio);
          if (parsed && parsed.is_ngo_application === true) {
            setExistingApp({
              ...parsed,
              isNgoVerified: profile.is_ngo
            });
          }
        } catch {
          // Bio is a standard text string description, no app found
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File size must not exceed 5MB.");
      return;
    }

    setDocFile(file);
    if (file.type.startsWith("image/")) {
      setDocPreview(URL.createObjectURL(file));
    } else {
      setDocPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!orgName || !regNumber || !docFile) {
      setErrorMsg("Please complete all required fields and upload verification documents.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // 1. Upload verification certificate document to Cloudflare R2
      const presignRes = await fetch("/api/listings/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: docFile.name,
          fileType: docFile.type,
        }),
      });

      const { uploadUrl, fileKey } = await presignRes.json();
      if (!uploadUrl) {
        throw new Error("Failed to configure storage upload tunnel.");
      }

      // PUT directly to R2 bucket
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": docFile.type },
        body: docFile,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload document file directly to storage.");
      }

      const documentUrl = getR2PublicUrl(fileKey) || `https://pub-placeholder-domain.r2.dev/${fileKey}`;

      // 2. Submit application details to backend API
      const res = await fetch("/api/ngo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          org_name: orgName,
          darpan_id: darpanId,
          registration_number: regNumber,
          document_url: documentUrl,
          user_description: userDesc
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit NGO application");

      setSuccessMsg("NGO verification application submitted successfully!");
      await fetchExistingApp(userId);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Checking organization credentials...</p>
      </div>
    );
  }

  // Display status page if application already exists
  if (existingApp) {
    const isPending = existingApp.status === "pending";
    const isApproved = existingApp.status === "approved" && existingApp.isNgoVerified;
    const isRejected = existingApp.status === "rejected";

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-16">
        <div className="max-w-xl mx-auto px-4 pt-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Feed
          </Link>

          <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 sm:p-8 mt-6 text-center space-y-6 relative overflow-hidden shadow-2xl">
            {/* Background Glow */}
            <div className={`absolute top-0 left-0 right-0 h-40 bg-gradient-to-b pointer-events-none ${
              isApproved ? "from-emerald-500/10" :
              isRejected ? "from-red-500/10" :
              "from-amber-500/10"
            }`} />

            {/* Status Icons */}
            <div className="relative">
              {isApproved && (
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                  <ShieldCheck size={36} className="animate-pulse" />
                </div>
              )}
              {isPending && (
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
                  <Loader2 size={36} className="animate-spin" />
                </div>
              )}
              {isRejected && (
                <div className="inline-flex items-center justify-center p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-2">
                  <AlertCircle size={36} />
                </div>
              )}
            </div>

            <div className="space-y-2 relative">
              <h3 className="text-xl font-extrabold uppercase tracking-wide">
                {isApproved && "Charity Account Verified"}
                {isPending && "Verification Pending"}
                {isRejected && "Verification Declined"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {isApproved && `Congratulations! Your organization "${existingApp.org_name}" is verified. Priority claims are active.`}
                {isPending && `Your verification application for "${existingApp.org_name}" is currently under review by administrators.`}
                {isRejected && `Your verification application for "${existingApp.org_name}" was not approved.`}
              </p>
            </div>

            {/* NGO Metadata Card */}
            <div className="bg-slate-950/40 border border-slate-900/60 rounded-2xl p-4 text-left text-xs space-y-2 text-slate-350 font-mono">
              <div><span className="text-slate-500">ORGANIZATION:</span> {existingApp.org_name}</div>
              <div><span className="text-slate-500">DARPAN ID:</span> {existingApp.darpan_id || "N/A"}</div>
              <div><span className="text-slate-500">REGISTRATION #:</span> {existingApp.registration_number}</div>
              {existingApp.admin_notes && (
                <div className="pt-2 border-t border-slate-900 mt-2 text-red-400 font-sans leading-relaxed">
                  <span className="font-bold text-slate-450 block text-[10px] uppercase tracking-wider mb-0.5">Admin Review Notes:</span>
                  "{existingApp.admin_notes}"
                </div>
              )}
            </div>

            {isRejected && (
              <button
                onClick={() => setExistingApp(null)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs py-3 rounded-xl hover:bg-slate-850 hover:text-white transition-all cursor-pointer"
              >
                Re-apply for NGO Verification
              </button>
            )}

            <p className="text-[10px] text-slate-500">
              Need assistance? Contact verification support at <span className="text-slate-450 hover:underline">support@freeshare.in</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-16">
      
      {/* Back button */}
      <div className="max-w-xl mx-auto px-4 pt-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-6">
        <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          
          {/* Header */}
          <div className="border-b border-slate-900 pb-4">
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
              <Heart className="text-teal-400 fill-teal-400/10" size={22} />
              NGO Verification
            </h1>
            <p className="text-xs text-slate-400 mt-1">Apply for charity status to unlock priority claims and visual NGO badges.</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium flex items-center justify-center gap-2">
              <AlertCircle size={14} />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium flex items-center justify-center gap-2">
              <CheckCircle2 size={14} />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Org Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Organization Name *</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Robin Hood Army / Feeding India"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500/85 transition-all"
              />
            </div>

            {/* Darpan ID & Reg Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">NITI Aayog Darpan ID</label>
                <input
                  type="text"
                  value={darpanId}
                  onChange={(e) => setDarpanId(e.target.value)}
                  placeholder="e.g. DL/2026/012345"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500/85 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Registration Number *</label>
                <input
                  type="text"
                  required
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. Trust Deed/Reg Number"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500/85 transition-all"
                />
              </div>
            </div>

            {/* Description/Mission */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Mission Statement & Description</label>
              <textarea
                value={userDesc}
                onChange={(e) => setUserDesc(e.target.value)}
                placeholder="Describe your organization's mission and how you plan to distribute items..."
                rows={3}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:border-teal-500/85 transition-all resize-none"
              />
            </div>

            {/* Certificate File Upload */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Registration Certificate (PDF/Image) *</label>
              
              {docFile ? (
                <div className="border border-slate-800 rounded-2xl p-3 flex items-center justify-between bg-slate-950/40">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      <FileText size={16} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-200 truncate max-w-[200px]">{docFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(docFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDocFile(null);
                      setDocPreview(null);
                    }}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-slate-800 hover:border-teal-500/40 hover:bg-slate-950/40 rounded-2xl py-8 px-4 flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <Upload className="text-slate-500 group-hover:text-teal-400 transition-colors" size={24} />
                  <span className="text-xs font-bold text-slate-350 mt-3">Upload verification document</span>
                  <span className="text-[10px] text-slate-550 mt-1">Accepts PDF, JPG, PNG (Max 5MB)</span>
                  <input
                    type="file"
                    required
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full relative overflow-hidden group bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Submit for Verification</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

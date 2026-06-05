"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getR2PublicUrl } from "@/lib/r2";
import { ArrowLeft, Loader2, Calendar, MapPin, AlignLeft, Users, Send, Upload, X, ShieldAlert, Award } from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import { normalizeCityName } from "@/lib/cities";

export default function CreateEventPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  
  // Image Uploading States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Submit States
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Appeal States
  const [appealExplanation, setAppealExplanation] = useState("");
  const [appealing, setAppealing] = useState(false);
  const [appealSuccessMsg, setAppealSuccessMsg] = useState("");
  const [appealErrorMsg, setAppealErrorMsg] = useState("");

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAppealing(true);
    setAppealErrorMsg("");
    setAppealSuccessMsg("");
    try {
      const res = await fetch("/api/events/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explanation: appealExplanation,
          userId: user.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit appeal");
      setAppealSuccessMsg(data.message);
      setAppealExplanation("");
    } catch (err: any) {
      setAppealErrorMsg(err.message || "Failed to submit appeal");
    } finally {
      setAppealing(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?next=/events/new");
      } else {
        setUser(data.user);
        
        // Fetch user trust_score and can_create_events from the users table with fallback if column is missing
        const { data: userProfile, error: profileErr } = await supabase
          .from("users")
          .select("trust_score, can_create_events")
          .eq("id", data.user.id)
          .single();
        
        if (profileErr) {
          // Fallback if column does not exist
          const { data: fallbackProfile } = await supabase
            .from("users")
            .select("trust_score")
            .eq("id", data.user.id)
            .single();
          if (fallbackProfile) {
            setProfile({
              trust_score: fallbackProfile.trust_score,
              can_create_events: true // Default to true if migration is pending
            });
          }
        } else if (userProfile) {
          setProfile(userProfile);
        }

        // Load location defaults if they exist on user metadata
        setCity(data.user.user_metadata?.city || "");
        setArea(data.user.user_metadata?.area || "");
        setPincode(data.user.user_metadata?.pincode || "");
      }
      setAuthLoading(false);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    const now = new Date();
    // Round to the nearest 5 minutes for a clean interface, starting 5 minutes from now
    const start = new Date(Math.ceil(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000) + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration
    
    const formatLocal = (d: Date) => {
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      return local.toISOString().slice(0, 16);
    };
    
    setStartDate(formatLocal(start));
    setEndDate(formatLocal(end));
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start.getTime() < now.getTime() - 10 * 60 * 1000) {
      setErrorMsg("Event start time cannot be in the past.");
      setSubmitting(false);
      return;
    }

    if (end.getTime() <= start.getTime()) {
      setErrorMsg("Event end time must be scheduled after the start time.");
      setSubmitting(false);
      return;
    }

    try {
      let finalImageUrl = null;

      // Upload promotional image if selected
      if (imageFile) {
        setUploadingImage(true);
        let fileToUpload = imageFile;

        // Compress image before upload
        try {
          const imageCompression = (await import("browser-image-compression")).default;
          const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
          };
          const compressed = await imageCompression(imageFile, options);
          fileToUpload = new File([compressed], imageFile.name, { type: imageFile.type });
        } catch (compressErr) {
          console.error("Compression failed, uploading original:", compressErr);
        }

        const presignRes = await fetch("/api/listings/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: fileToUpload.name, fileType: fileToUpload.type }),
        });

        const { uploadUrl, fileKey } = await presignRes.json();
        if (!uploadUrl) throw new Error("Failed to fetch pre-signed upload URL");

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": fileToUpload.type },
          body: fileToUpload,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload promotional image");

        finalImageUrl = getR2PublicUrl(fileKey) || `https://pub-placeholder-domain.r2.dev/${fileKey}`;
        setUploadingImage(false);
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizer_id: user.id,
          title,
          description,
          start_date: startDate,
          end_date: endDate,
          location_name: locationName,
          city: normalizeCityName(city),
          area,
          pincode,
          image_url: finalImageUrl,
          max_participants: maxParticipants ? parseInt(maxParticipants) : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create event.");
      }

      setSuccessMsg("Event published successfully! Redirecting...");
      setTimeout(() => {
        router.push("/events");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-amber-500" size={28} />
        <p className="text-xs text-slate-500">Checking credentials...</p>
      </div>
    );
  }

  // Permission Guard / Premium Dark Lock Screen
  const isSuspendedByAdmin = profile?.can_create_events === false;
  const isSuspendedByTrust = profile?.trust_score !== null && profile?.trust_score < 3.50;
  
  if (isSuspendedByAdmin || isSuspendedByTrust) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-amber-500 selection:text-black">
        {/* Header navbar */}
        <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
            <Link href="/events" className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900">
              <ArrowLeft size={20} />
            </Link>
            <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent select-none">
              Post New Event
            </span>
          </div>
        </nav>

        {/* Lock Screen UI Container */}
        <main className="max-w-md mx-auto px-4 pt-16 flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-red-500 shadow-2xl shadow-red-500/5">
              <ShieldAlert size={36} />
            </div>
          </div>

          <h2 className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-slate-450 bg-clip-text text-transparent">
            {isSuspendedByAdmin ? "Event Creation Suspended" : "Insufficient Trust Score"}
          </h2>
          
          <p className="text-xs text-slate-400 mt-3 leading-relaxed max-w-sm">
            {isSuspendedByAdmin 
              ? "Your access to create community events has been restricted by an administrator. Please reach out to support if you believe this is in error."
              : `Your trust score of ${Number(profile?.trust_score).toFixed(2)} is below the required 3.50 threshold. Participate in standard claims and maintain positive reviews to restore your standing.`
            }
          </p>

          <div className="w-full mt-8 bg-slate-900/20 border border-slate-900 rounded-3xl p-5 space-y-4 text-left">
            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-900/60">
              <span className="text-slate-500 font-bold">Policy Status</span>
              <span className="font-extrabold text-red-400 uppercase tracking-widest text-[9px] bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded">
                RESTRICTED
              </span>
            </div>
            
            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-900/60">
              <span className="text-slate-500 font-bold">Your Trust Score</span>
              <span className={`font-mono font-bold ${isSuspendedByTrust ? "text-red-400" : "text-slate-300"}`}>
                ★ {Number(profile?.trust_score ?? 5.0).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs py-1">
              <span className="text-slate-500 font-bold">Admin Override Status</span>
              <span className={`font-mono font-bold ${isSuspendedByAdmin ? "text-red-400" : "text-emerald-400"}`}>
                {isSuspendedByAdmin ? "Suspended" : "Active"}
              </span>
            </div>
          </div>

          {/* Appeal Form UI */}
          <div className="w-full mt-8 bg-slate-900/10 border border-slate-900 rounded-3xl p-5 space-y-4 text-left">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
              <Award size={16} className="text-amber-500" />
              Appeal Suspension
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              If you have positive updates, proof of community cleanup efforts, or believe this was an error, submit an appeal below. An administrator will review it.
            </p>

            {appealSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-xs">
                {appealSuccessMsg}
              </div>
            )}

            {appealErrorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-pulse">
                {appealErrorMsg}
              </div>
            )}

            {!appealSuccessMsg && (
              <form onSubmit={handleAppealSubmit} className="space-y-3">
                <textarea
                  required
                  value={appealExplanation}
                  onChange={(e) => setAppealExplanation(e.target.value)}
                  placeholder="Provide details about your planned event, cleanup history, or general context (minimum 15 characters)..."
                  rows={3}
                  className="w-full bg-slate-950/40 border border-slate-850 focus:border-amber-500/80 rounded-xl p-3 text-xs text-slate-100 focus:outline-none placeholder-slate-700 resize-none"
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 font-mono">
                    {appealExplanation.length} chars (min 15)
                  </span>
                  
                  <button
                    type="submit"
                    disabled={appealing || appealExplanation.trim().length < 15}
                    className="bg-amber-500 hover:bg-amber-450 disabled:opacity-50 text-slate-950 font-black text-[11px] px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 uppercase tracking-wider"
                  >
                    {appealing ? (
                      <Loader2 className="animate-spin text-slate-950" size={13} />
                    ) : (
                      "Submit Appeal"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <Link href="/events" className="mt-8 inline-flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 font-black uppercase tracking-wider transition-colors">
            <ArrowLeft size={16} />
            Back to Events Feed
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-amber-500 selection:text-black">
      
      {/* Header navbar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/events" className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900">
            <ArrowLeft size={20} />
          </Link>
          <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent select-none">
            Post New Event
          </span>
        </div>
      </nav>

      {/* Form Page */}
      <main className="max-w-lg mx-auto px-4 pt-8">
        
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-pulse">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/20 backdrop-blur-xl border border-slate-900 rounded-3xl p-6 shadow-2xl shadow-black/45">
          
          {/* Promo Image Picker */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Promotional Event Image (Optional)
            </label>
            
            {imagePreview ? (
              <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 hover:bg-red-500 text-slate-300 hover:text-white transition-all border border-slate-800"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border border-dashed border-slate-800 hover:border-amber-500/50 bg-slate-950/20 hover:bg-slate-950/40 transition-all cursor-pointer group">
                <Upload className="text-slate-600 group-hover:text-amber-500 transition-colors mb-2" size={24} />
                <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-400">Click to upload photo</span>
                <span className="text-[9px] text-slate-600 mt-1">JPEG, PNG up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Event Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Karol Bagh Donation Drive (min 10 chars)"
              className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Description / Instructions
            </label>
            <div className="relative group">
              <span className="absolute top-3.5 left-4 text-slate-600 group-focus-within:text-amber-500 transition-colors">
                <AlignLeft size={16} />
              </span>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Detail what people should bring, how they can find you, and the scope of the drive (min 20 chars)..."
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all resize-none"
              />
            </div>
          </div>

          {/* Date & Time Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Start Date and Time
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600 group-focus-within:text-amber-500 transition-colors">
                  <Calendar size={16} />
                </span>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                End Date and Time
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600 group-focus-within:text-amber-500 transition-colors">
                  <Calendar size={16} />
                </span>
                <input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-100 focus:outline-none focus:border-amber-500/80 transition-all [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Location Name / Address */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Venue / Address Details
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600 group-focus-within:text-amber-500 transition-colors">
                <MapPin size={16} />
              </span>
              <input
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Near Metro Gate 1 Park, Community Hall"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>
          </div>

          {/* City & Area */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                City
              </label>
              <CityAutocomplete
                value={city}
                onChange={setCity}
                placeholder="e.g. Delhi"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-750 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Area
              </label>
              <input
                type="text"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Karol Bagh"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>
          </div>

          {/* Pincode & Max Participants */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Pincode (Optional)
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 110005"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Participant Cap (Optional)
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600 group-focus-within:text-amber-500 transition-colors">
                  <Users size={15} />
                </span>
                <input
                  type="number"
                  min="1"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500/80 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || uploadingImage}
            className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 uppercase tracking-wider text-xs"
          >
            {submitting ? (
              <Loader2 className="animate-spin text-slate-950" size={18} />
            ) : uploadingImage ? (
              <>
                <Loader2 className="animate-spin text-slate-950" size={18} />
                <span>Uploading Image...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Publish Event</span>
              </>
            )}
          </button>

        </form>

      </main>
    </div>
  );
}

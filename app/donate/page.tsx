"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getR2PublicUrl } from "@/lib/r2";
import { Upload, X, Loader2, ArrowLeft, MapPin, Zap, Package } from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import { normalizeCityName } from "@/lib/cities";
import { useBranding } from "@/components/BrandingContext";
import { parseCategory } from "@/lib/branding";

const ITEM_CATEGORIES = [
  "Furniture", "Electronics", "Books", "Clothing", "Toys",
  "Kitchen", "Appliances", "Sports", "Office", "Miscellaneous"
];

const SKILL_CATEGORIES = [
  "Teaching", "Repair", "Creative", "Fitness", "Tech Help", "Cooking", "Language", "Other"
];

const CONDITIONS = ["Like New", "Good", "Fair", "Needs Repair"];
const SKILL_DURATIONS = ["15 min", "30 min", "1 hour", "Flexible"];

// Skill category display config
const SKILL_CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  Teaching:   { emoji: "📚", color: "violet" },
  Repair:     { emoji: "🔧", color: "orange" },
  Creative:   { emoji: "🎨", color: "pink" },
  Fitness:    { emoji: "💪", color: "green" },
  "Tech Help":{ emoji: "💻", color: "blue" },
  Cooking:    { emoji: "🍳", color: "yellow" },
  Language:   { emoji: "🗣️", color: "teal" },
  Other:      { emoji: "✨", color: "slate" },
};

export default function DonatePage() {
  const { itemCategories, skillCategories } = useBranding();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  // Listing type toggle
  const [listingType, setListingType] = useState<"item" | "skill">("item");

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [skillDuration, setSkillDuration] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [maxBookingsPerUser, setMaxBookingsPerUser] = useState<number>(2);

  const [tagInput, setTagInput] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [receiverPreference, setReceiverPreference] = useState("all");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Image Uploading States
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?next=/donate");
      } else {
        setUserId(data.user.id);
        setCity(data.user.user_metadata?.city || "");
        setArea(data.user.user_metadata?.area || "");
        setPincode(data.user.user_metadata?.pincode || "");
      }
    };
    checkUser();
  }, [router]);

  // Reset category/condition when switching listing type
  useEffect(() => {
    setCategory("");
    setCondition("");
    setSkillDuration("");
    setSkillTags([]);
    setTagInput("");
    setImages([]);
    setPreviews([]);
  }, [listingType]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await res.json();
      const addr = data.address || {};
      const detectedCity = addr.city || addr.town || addr.village || addr.state_district || "";
      const detectedArea = addr.suburb || addr.neighbourhood || addr.county || "";
      const detectedPincode = addr.postcode || "";
      if (detectedCity) setCity(normalizeCityName(detectedCity));
      if (detectedArea) setArea(detectedArea);
      if (detectedPincode) setPincode(detectedPincode);
    } catch {
      // Reverse geocode failed silently
    }
  };

  const handleAutoDetectLocation = () => {
    setDetectingLocation(true);
    setErrorMsg("");

    const fallbackToIP = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          setLatitude(data.latitude);
          setLongitude(data.longitude);
          if (data.city) setCity(normalizeCityName(data.city));
          if (data.postal) setPincode(data.postal);
          if (data.region) setArea(data.region);
        } else {
          setLatitude(28.6139);
          setLongitude(77.209);
          setErrorMsg("IP detection returned no coords. Using default (New Delhi).");
        }
      } catch {
        setLatitude(28.6139);
        setLongitude(77.209);
        setErrorMsg("Location detection failed. Using default coordinates (New Delhi).");
      }
      setDetectingLocation(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLatitude(latitude);
          setLongitude(longitude);
          reverseGeocode(latitude, longitude);
          setDetectingLocation(false);
        },
        () => {
          console.warn("Browser geolocation unavailable, falling back to IP-based detection");
          fallbackToIP();
        },
        { timeout: 5000 }
      );
    } else {
      fallbackToIP();
    }
  };

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Image compression failed"));
            },
            "image/webp",
            0.8
          );
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const remainingSlots = 5 - images.length;
      const filesToProcess = filesArray.slice(0, remainingSlots);

      setErrorMsg("");
      const compressedFiles: File[] = [];
      const localPreviews: string[] = [];

      for (const file of filesToProcess) {
        try {
          const compressedBlob = await compressImage(file);
          const compressedFile = new File([compressedBlob], `${file.name.split(".")[0]}.webp`, {
            type: "image/webp",
          });
          compressedFiles.push(compressedFile);
          localPreviews.push(URL.createObjectURL(compressedFile));
        } catch (err) {
          console.error("Compression error:", err);
          setErrorMsg("Failed to compress some images. Please try again.");
        }
      }

      setImages((prev) => [...prev, ...compressedFiles]);
      setPreviews((prev) => [...prev, ...localPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const isSkill = listingType === "skill";

    if (!isSkill && images.length === 0) {
      setErrorMsg("Please upload at least 1 image of the item.");
      return;
    }

    if (!category) {
      setErrorMsg("Please select a category.");
      return;
    }

    if (!isSkill && !condition) {
      setErrorMsg("Please select the item condition.");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const uploadedUrls: string[] = [];

      // Upload images (only if any provided)
      for (let file of images) {
        // Compress image before upload
        try {
          const imageCompression = (await import("browser-image-compression")).default;
          const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
          };
          const compressed = await imageCompression(file, options);
          file = new File([compressed], file.name, { type: file.type });
        } catch (compressErr) {
          console.error("Compression failed, uploading original:", compressErr);
        }

        const presignRes = await fetch("/api/listings/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, fileType: file.type }),
        });

        const { uploadUrl, fileKey } = await presignRes.json();
        if (!uploadUrl) throw new Error("Failed to fetch pre-signed upload URL");

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image directly to storage");

        const publicUrl = getR2PublicUrl(fileKey) || `https://pub-placeholder-domain.r2.dev/${fileKey}`;
        uploadedUrls.push(publicUrl);
      }

      const listingRes = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donor_id: userId,
          title,
          description,
          category,
          condition: isSkill ? null : condition,
          images: uploadedUrls,
          city: normalizeCityName(city),
          area,
          landmark,
          pincode,
          receiver_preference: receiverPreference,
          latitude,
          longitude,
          listing_type: listingType,
          skill_duration: isSkill ? skillDuration : null,
          skill_tags: isSkill ? skillTags : [],
          max_bookings_per_user: isSkill ? maxBookingsPerUser : null,
        }),
      });

      const listingData = await listingRes.json();
      if (!listingRes.ok) throw new Error(listingData.error || "Failed to create listing record");

      const searchParams = new URLSearchParams(window.location.search);
      const assignNgoId = searchParams.get("assignNgoId");
      if (assignNgoId && listingData?.id) {
        const directDonateRes = await fetch("/api/ngo/direct-donate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: listingData.id,
            ngoId: assignNgoId,
            donorId: userId,
            message: "Direct Donation submitted via NGO Profile redirection flow"
          })
        });
        const directData = await directDonateRes.json();
        if (directDonateRes.ok && directData.claimId) {
          setSuccessMsg("Listing created and assigned to NGO! Redirecting to chat...");
          setTimeout(() => router.push(`/chat/${directData.claimId}`), 1500);
          return;
        }
      }

      setSuccessMsg(isSkill ? "Skill offer published! Going to Home Feed..." : "Listing created! Going to Home Feed...");
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during submission.");
    } finally {
      setUploading(false);
    }
  };

  const isSkill = listingType === "skill";
  const accentClass = isSkill ? "violet" : "teal";
  const categories = isSkill ? (skillCategories || []) : (itemCategories || []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-24 sm:pb-12 selection:bg-violet-500 selection:text-black">
      {/* Navigation Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
      </div>

      <div className="max-w-3xl mx-auto bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-4 sm:p-8 shadow-2xl mt-4">

        {/* ─── What are you sharing toggle ─── */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">What are you sharing today?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setListingType("item")}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 ${
                !isSkill
                  ? "border-teal-500/60 bg-teal-500/10 text-teal-400"
                  : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${!isSkill ? "bg-teal-500/20" : "bg-slate-800"}`}>
                <Package size={18} className={!isSkill ? "text-teal-400" : "text-slate-500"} />
              </span>
              <div className="text-left">
                <p className="font-bold text-sm">An Item</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Physical goods, furniture, clothes…</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setListingType("skill")}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 ${
                isSkill
                  ? "border-violet-500/60 bg-violet-500/10 text-violet-400"
                  : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${isSkill ? "bg-violet-500/20" : "bg-slate-800"}`}>
                <Zap size={18} className={isSkill ? "text-violet-400" : "text-slate-500"} />
              </span>
              <div className="text-left">
                <p className="font-bold text-sm">A Skill</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Tutoring, repair help, creative…</p>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Page Title ─── */}
        <div className="mb-8 pb-6 border-b border-slate-800/80">
          <h1 className={`text-2xl sm:text-3xl font-extrabold bg-gradient-to-r ${isSkill ? "from-violet-400 to-purple-400" : "from-teal-400 to-emerald-400"} bg-clip-text text-transparent`}>
            {isSkill ? "Share a Skill" : "Donate an Item"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isSkill
              ? "Offer your time and talent to neighbors for free."
              : "Give items a second life. List details accurately below."}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ─── Photo Upload ─── */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              {isSkill ? "Photo (Optional)" : "Photos (Max 5, Min 1)"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {previews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group">
                  <img src={preview} alt="Upload Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <label className={`relative aspect-square rounded-xl border border-dashed ${isSkill ? "border-violet-800/50 hover:border-violet-500/50 hover:bg-violet-950/20" : "border-slate-800 hover:border-teal-500/50 hover:bg-slate-950/40"} flex flex-col items-center justify-center cursor-pointer transition-all group`}>
                  <Upload size={24} className={`${isSkill ? "text-violet-600 group-hover:text-violet-400" : "text-slate-500 group-hover:text-teal-400"} transition-colors`} />
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-2 font-medium">
                    {isSkill ? "Add Photo" : "Add Photo"}
                  </span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {isSkill
                ? "* Add a photo of you working or a sample of your skill (optional)."
                : "* Client-side canvas webp compression automatically processes files."}
            </p>
          </div>

          {/* ─── Title ─── */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              {isSkill ? "Skill Name" : "Title"}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isSkill ? "e.g., Free Basic English Tutoring Sessions" : "e.g., Wooden Study Table for Students"}
              minLength={5}
              maxLength={80}
              className={`w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${isSkill ? "focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/20" : "focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20"} transition-all`}
            />
          </div>

          {/* ─── Category + Condition/Duration ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                {isSkill ? "Skill Category" : "Category"}
              </label>
              {isSkill ? (
                <div className="grid grid-cols-2 gap-2">
                  {(skillCategories || []).map((cat) => {
                    const { emoji, name } = parseCategory(cat);
                    const selected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`flex items-center gap-2 p-2.5 min-h-[44px] rounded-xl border text-xs font-semibold transition-all ${
                          selected
                            ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                            : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                        }`}
                      >
                        <span>{emoji}</span>
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-teal-500/80 [color-scheme:dark]"
                >
                  <option value="">Select Category</option>
                  {(itemCategories || []).map((cat) => {
                    const { emoji, name } = parseCategory(cat);
                    return (
                      <option key={cat} value={cat}>{emoji} {name}</option>
                    );
                  })}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                {isSkill ? "Session Duration" : "Condition"}
              </label>
              {isSkill ? (
                <div className="grid grid-cols-2 gap-2">
                  {SKILL_DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setSkillDuration(dur)}
                      className={`p-2.5 min-h-[44px] rounded-xl border text-xs font-bold transition-all ${
                        skillDuration === dur
                          ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                          : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      ⏱ {dur}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-teal-500/80 [color-scheme:dark]"
                >
                  <option value="">Select Condition</option>
                  {CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>{cond}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* ─── Description ─── */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Description
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isSkill
                ? "Describe what you'll help with, your experience level, and what the receiver can expect from the session."
                : "Provide item details, measurements, and condition details. Helping receivers choose wisely."}
              minLength={20}
              maxLength={500}
              className={`w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${isSkill ? "focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/20" : "focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20"} transition-all resize-none`}
            />
          </div>

          {/* ─── Skill Tags (only for skill listings) ─── */}
          {isSkill && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                  Skill Tags
                  <span className="ml-2 text-[10px] font-normal text-slate-500 normal-case">Add specific tags so people can find you (e.g. yoga, python, mehendi)</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {skillTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-violet-500/10 border border-violet-500/30 text-violet-300 px-3 py-1 rounded-full"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setSkillTags((prev) => prev.filter((t) => t !== tag))}
                        className="text-violet-400 hover:text-red-400 transition-colors ml-0.5 p-1.5 -m-1.5 rounded"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9 ]/g, ""))}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                        e.preventDefault();
                        const newTag = tagInput.trim().replace(/\s+/g, "-");
                        if (!skillTags.includes(newTag) && skillTags.length < 10) {
                          setSkillTags((prev) => [...prev, newTag]);
                        }
                        setTagInput("");
                      }
                    }}
                    placeholder="Type a tag and press Enter... (e.g. yoga)"
                    maxLength={30}
                    className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newTag = tagInput.trim().replace(/\s+/g, "-");
                      if (newTag && !skillTags.includes(newTag) && skillTags.length < 10) {
                        setSkillTags((prev) => [...prev, newTag]);
                        setTagInput("");
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-bold hover:bg-violet-500/20 transition-all"
                  >
                    + Add
                  </button>
                </div>
                <p className="text-[10px] text-slate-600 mt-1.5">{skillTags.length}/10 tags · Press Enter or comma to add</p>
              </div>

              {/* Max Bookings Per User */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                  Max Active Bookings Per User
                  <span className="ml-2 text-[10px] font-normal text-slate-500 normal-case">
                    Limit active requests a single user can have at any time (default is 2)
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={maxBookingsPerUser}
                    onChange={(e) => setMaxBookingsPerUser(parseInt(e.target.value))}
                    className="bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 focus:outline-none focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/20 transition-all w-36 [color-scheme:dark]"
                  >
                    {[1, 2, 3, 4, 5, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? "Active Slot" : "Active Slots"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ─── Location ─── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              {isSkill ? "Your Location" : "Meetup & Pickup Location"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">City</label>
                <CityAutocomplete required value={city} onChange={(val) => setCity(val)} placeholder="e.g. Mumbai" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">Area / Neighbourhood</label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Andheri West"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">Pincode</label>
                <input
                  type="text"
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 400053"
                  maxLength={10}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80"
                />
              </div>
            </div>

            {!isSkill && (
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">Public Meetup Landmark (Exact address remains hidden initially)</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-teal-400">
                    <MapPin size={18} />
                  </span>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Opposite National Park Main Gate"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAutoDetectLocation}
                disabled={detectingLocation}
                className="inline-flex items-center gap-2 bg-slate-950/80 border border-slate-800 hover:border-teal-500/50 text-slate-300 hover:text-teal-400 text-xs font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50"
              >
                <MapPin size={14} className={detectingLocation ? "animate-pulse text-teal-400" : ""} />
                {detectingLocation ? "Detecting location..." : "Use Current Geolocation Coordinates"}
              </button>
              {latitude && longitude && (
                <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 py-1 px-3.5 rounded-full">
                  ✓ Location pinned ({latitude.toFixed(4)}, {longitude.toFixed(4)})
                </span>
              )}
            </div>
          </div>

          {/* ─── Receiver Preferences ─── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              {isSkill ? "Who Can Request?" : "Receiver Preferences"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: "all", label: "Open to All" },
                { value: "ngo_only", label: "Verified NGOs First" },
                { value: "high_trust", label: "Trust Score 4.0+" },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800 hover:border-teal-500/40 rounded-xl cursor-pointer select-none transition-all">
                  <input
                    type="radio"
                    name="preference"
                    value={value}
                    checked={receiverPreference === value}
                    onChange={() => setReceiverPreference(value)}
                    className={isSkill ? "accent-violet-500" : "accent-teal-500"}
                  />
                  <span className="text-xs font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ─── Submit Button ─── */}
          <button
            type="submit"
            disabled={uploading}
            className={`w-full relative overflow-hidden group bg-gradient-to-r ${
              isSkill
                ? "from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 shadow-violet-500/10"
                : "from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-teal-500/10"
            } text-slate-950 font-extrabold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50`}
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin text-slate-950" size={18} />
                {isSkill ? "Publishing skill offer..." : "Uploading compressed assets..."}
              </>
            ) : (
              isSkill ? "🎯 Publish Skill Offer" : "📦 Publish Listing"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

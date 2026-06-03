"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getR2PublicUrl } from "@/lib/r2";
import { Upload, X, Loader2, ArrowLeft, Image as ImageIcon, MapPin } from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import { normalizeCityName } from "@/lib/cities";

const CATEGORIES = [
  "Furniture", "Electronics", "Books", "Clothing", "Toys", 
  "Kitchen", "Appliances", "Sports", "Office", "Miscellaneous"
];

const CONDITIONS = ["Like New", "Good", "Fair", "Needs Repair"];

export default function DonatePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
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
    // Fetch authenticated user info
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.push("/login?next=/donate");
      } else {
        setUserId(data.user.id);
        // Pre-fill location if available
        setCity(data.user.user_metadata?.city || "");
        setArea(data.user.user_metadata?.area || "");
        setPincode(data.user.user_metadata?.pincode || "");
      }
    };
    checkUser();
  }, [router]);

  // Reverse-geocode coordinates to auto-fill city, area, pincode
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
      // Reverse geocode failed silently — user can still type manually
    }
  };

  // Geolocate user coordinates helper
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
          // Auto-fill city/pincode from IP data directly
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
          // Reverse-geocode to auto-fill city/area/pincode
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

  // Client-side canvas compression logic
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

          // Scale proportion calculation
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to WebP under 400KB
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Image compression failed"));
              }
            },
            "image/webp",
            0.8 // 80% compression quality
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

    if (images.length === 0) {
      setErrorMsg("Please upload at least 1 image of the item.");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const uploadedUrls: string[] = [];

      // Step 1: Upload compressed files to Cloudflare R2 using pre-signed URLs
      for (const file of images) {
        const presignRes = await fetch("/api/listings/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            fileType: file.type,
          }),
        });

        const { uploadUrl, fileKey } = await presignRes.json();

        if (!uploadUrl) {
          throw new Error("Failed to fetch pre-signed upload URL");
        }

        // Put request directly to R2 bucket
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload image directly to storage");
        }

        // Build CDN URL
        const publicUrl = getR2PublicUrl(fileKey) || `https://pub-placeholder-domain.r2.dev/${fileKey}`;
        uploadedUrls.push(publicUrl);
      }

      // Step 2: Save metadata to listings DB table
      const listingRes = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          donor_id: userId,
          title,
          description,
          category,
          condition,
          images: uploadedUrls,
          city: normalizeCityName(city),
          area,
          landmark,
          pincode,
          receiver_preference: receiverPreference,
          latitude,
          longitude,
        }),
      });

      const listingData = await listingRes.json();

      if (!listingRes.ok) {
        throw new Error(listingData.error || "Failed to create listing record");
      }

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
          setSuccessMsg("Donation listing created and assigned directly to the NGO! Redirecting to chat...");
          setTimeout(() => {
            router.push(`/chat/${directData.claimId}`);
          }, 1500);
          return;
        }
      }

      setSuccessMsg("Listing created successfully! Going to Home Feed...");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during submission.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-12 selection:bg-teal-500 selection:text-black">
      {/* Navigation Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
      </div>

      <div className="max-w-3xl mx-auto bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl mt-4">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            Donate an Item
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Give items a second life. List details accurately below.
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
          {/* Images Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Photos (Max 5, Min 1)
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
                <label className="relative aspect-square rounded-xl border border-dashed border-slate-800 hover:border-teal-500/50 hover:bg-slate-950/40 flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <Upload size={24} className="text-slate-500 group-hover:text-teal-400 transition-colors" />
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-2 font-medium">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              * Client-side canvas webp compression automatically processes files.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Wooden Study Table for Students"
              minLength={5}
              maxLength={80}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all"
            />
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Category
              </label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 focus:outline-none focus:border-teal-500/80 [color-scheme:dark]"
              >
                <option value="">Select Category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Condition
              </label>
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
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Description
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide item details, measurements, and condition details. Helping receivers choose wisely."
              minLength={20}
              maxLength={500}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all resize-none"
            />
          </div>

          {/* Location Fields */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Meetup & Pickup Location
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">City</label>
                <CityAutocomplete
                  required
                  value={city}
                  onChange={(val) => setCity(val)}
                  placeholder="e.g. Mumbai"
                />
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
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20"
                />
              </div>
            </div>

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

          {/* Preferences */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Receiver Preferences
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800 hover:border-teal-500/40 rounded-xl cursor-pointer select-none transition-all">
                <input
                  type="radio"
                  name="preference"
                  value="all"
                  checked={receiverPreference === "all"}
                  onChange={() => setReceiverPreference("all")}
                  className="accent-teal-500"
                />
                <span className="text-xs font-medium">Open to All</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800 hover:border-teal-500/40 rounded-xl cursor-pointer select-none transition-all">
                <input
                  type="radio"
                  name="preference"
                  value="ngo_only"
                  checked={receiverPreference === "ngo_only"}
                  onChange={() => setReceiverPreference("ngo_only")}
                  className="accent-teal-500"
                />
                <span className="text-xs font-medium">Verified NGOs First</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800 hover:border-teal-500/40 rounded-xl cursor-pointer select-none transition-all">
                <input
                  type="radio"
                  name="preference"
                  value="high_trust"
                  checked={receiverPreference === "high_trust"}
                  onChange={() => setReceiverPreference("high_trust")}
                  className="accent-teal-500"
                />
                <span className="text-xs font-medium">Trust Score 4.0+</span>
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold py-4 px-4 rounded-xl shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin text-slate-950" size={18} />
                Uploading compressed assets...
              </>
            ) : (
              "Publish Listing"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

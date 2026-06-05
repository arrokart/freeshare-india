"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, MapPin, User, Star, Loader2, Send, ShieldAlert, Award, Upload, X, Image as ImageIcon, Save, Edit, Sparkles, Flag, Trash, Share2 } from "lucide-react";
import { getR2PublicUrl } from "@/lib/r2";
import CityAutocomplete from "@/components/CityAutocomplete";
import { normalizeCityName } from "@/lib/cities";
import ReportModal from "@/components/ReportModal";

const CATEGORIES = [
  "Furniture", "Electronics", "Books", "Clothing", "Toys", 
  "Kitchen", "Appliances", "Sports", "Office", "Miscellaneous"
];

const CONDITIONS = ["Like New", "Good", "Fair", "Needs Repair"];

export default function ListingDetailClient({ initialListing }: { initialListing: any }) {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [listing, setListing] = useState<any>(initialListing);
  const [loading, setLoading] = useState(!initialListing);

  // Gallery slider index
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Claim Request States
  const [userClaimed, setUserClaimed] = useState(false);
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");
  
  // Account Limit States
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [userClaimCount, setUserClaimCount] = useState(0);
  const [claimLimit, setClaimLimit] = useState(10);
  const [copied, setCopied] = useState(false);

  // Edit listing states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCondition, setEditCondition] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editLandmark, setEditLandmark] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editReceiverPreference, setEditReceiverPreference] = useState("all");
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
  const [editImages, setEditImages] = useState<(string | File)[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [shareText, setShareText] = useState("Share");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [editMaxBookings, setEditMaxBookings] = useState<number>(2);


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
      if (detectedCity) setEditCity(normalizeCityName(detectedCity));
      if (detectedArea) setEditArea(detectedArea);
      if (detectedPincode) setEditPincode(detectedPincode);
    } catch {
      // ignore
    }
  };

  const handleAutoDetectLocation = () => {
    setDetectingLocation(true);
    setSaveError("");

    const fallbackToIP = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          setEditLatitude(data.latitude);
          setEditLongitude(data.longitude);
          if (data.city) setEditCity(normalizeCityName(data.city));
          if (data.postal) setEditPincode(data.postal);
          if (data.region) setEditArea(data.region);
        } else {
          setEditLatitude(28.6139);
          setEditLongitude(77.209);
          setSaveError("IP detection returned no coords. Using default (New Delhi).");
        }
      } catch {
        setEditLatitude(28.6139);
        setEditLongitude(77.209);
        setSaveError("Location detection failed. Using default coordinates (New Delhi).");
      }
      setDetectingLocation(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setEditLatitude(latitude);
          setEditLongitude(longitude);
          reverseGeocode(latitude, longitude);
          setDetectingLocation(false);
        },
        () => {
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

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Image compression failed"));
              }
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
      const remainingSlots = 5 - editImages.length;
      const filesToProcess = filesArray.slice(0, remainingSlots);

      setSaveError("");
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
          setSaveError("Failed to compress some images. Please try again.");
        }
      }

      setEditImages((prev) => [...prev, ...compressedFiles]);
      setEditPreviews((prev) => [...prev, ...localPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
    setEditPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    const shareData = {
      title: listing.title,
      text: listing.description || `Check out this listing on FreeShare India`,
      url: window.location.href,
    };
    
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Web share failed, falling back to copy:", err);
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareText("Copied!");
      setTimeout(() => {
        setShareText("Share");
      }, 2000);
    }
  };

  const handleDeleteListing = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this listing? This action cannot be undone.")) {
      return;
    }
    
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from("listings")
        .delete()
        .eq("id", listing.id);
        
      if (error) throw error;
      
      alert("Listing deleted successfully.");
      router.push("/dashboard");
    } catch (err: any) {
      alert(err.message || "Failed to delete listing.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStartEdit = () => {
    setEditTitle(listing.title || "");
    setEditDescription(listing.description || "");
    setEditCategory(listing.category || "");
    setEditCondition(listing.condition || "");
    setEditCity(listing.city || "");
    setEditArea(listing.area || "");
    setEditLandmark(listing.landmark || "");
    setEditPincode(listing.pincode || "");
    setEditReceiverPreference(listing.receiver_preference || "all");
    setEditMaxBookings(listing.max_bookings_per_user || 2);
    
    let lat: number | null = null;
    let lng: number | null = null;
    if (listing.location) {
      if (listing.location.coordinates) {
        lng = listing.location.coordinates[0];
        lat = listing.location.coordinates[1];
      } else if (typeof listing.location === "string") {
        const match = listing.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      }
    }
    setEditLatitude(lat);
    setEditLongitude(lng);

    setEditImages(listing.images || []);
    setEditPreviews(listing.images || []);
    setIsEditing(true);
    setSaveError("");
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !listing) return;

    if (editImages.length === 0) {
      setSaveError("Please upload at least 1 image of the item.");
      return;
    }

    setSaveLoading(true);
    setSaveError("");

    try {
      const uploadedUrls: string[] = [];

      for (const item of editImages) {
        if (typeof item === "string") {
          uploadedUrls.push(item);
        } else {
          let fileToUpload = item;
          try {
            const imageCompression = (await import("browser-image-compression")).default;
            const options = {
              maxSizeMB: 0.8,
              maxWidthOrHeight: 1200,
              useWebWorker: true,
            };
            const compressed = await imageCompression(item, options);
            fileToUpload = new File([compressed], item.name, { type: item.type });
          } catch (compressErr) {
            console.error("Listing edit image compression failed, uploading original:", compressErr);
          }

          const presignRes = await fetch("/api/listings/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: fileToUpload.name,
              fileType: fileToUpload.type,
            }),
          });

          const { uploadUrl, fileKey } = await presignRes.json();
          if (!uploadUrl) {
            throw new Error("Failed to fetch pre-signed upload URL");
          }

          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": fileToUpload.type },
            body: fileToUpload,
          });

          if (!uploadRes.ok) {
            throw new Error("Failed to upload image directly to storage");
          }

          const publicUrl = getR2PublicUrl(fileKey) || `https://pub-placeholder-domain.r2.dev/${fileKey}`;
          uploadedUrls.push(publicUrl);
        }
      }

      const updateRes = await fetch("/api/listings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: listing.id,
          donor_id: userId,
          title: editTitle,
          description: editDescription,
          category: editCategory,
          condition: editCondition,
          images: uploadedUrls,
          city: normalizeCityName(editCity),
          area: editArea,
          landmark: editLandmark,
          pincode: editPincode,
          receiver_preference: editReceiverPreference,
          latitude: editLatitude,
          longitude: editLongitude,
          listing_type: listing.listing_type,
          skill_duration: listing.skill_duration,
          skill_tags: listing.skill_tags,
          max_bookings_per_user: editMaxBookings,
        }),
      });

      const responseData = await updateRes.json();
      if (!updateRes.ok) {
        throw new Error(responseData.error || "Failed to update listing");
      }

      setListing((prev: any) => ({
        ...prev,
        ...responseData,
        donor: prev.donor
      }));
      
      setIsEditing(false);
      setActiveImageIndex(0);
    } catch (err: any) {
      setSaveError(err.message || "An unexpected error occurred during save.");
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      let currentLimit = 10;
      let campaignType = "none";
      let campaignLimit = 20;
      let welcomeTrialEnabled = true;
      try {
        const settingsRes = await fetch("/api/admin/settings");
        const settingsData = await settingsRes.json();
        if (settingsData) {
          currentLimit = settingsData.monthly_claim_limit || 10;
          campaignType = settingsData.campaign_type || "none";
          campaignLimit = settingsData.campaign_limit || 20;
          welcomeTrialEnabled = settingsData.welcome_trial_enabled !== false;
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }

      if (data?.user) {
        setUserId(data.user.id);
        
        let bio = "";
        let isNgo = false;
        let isPremium = false;
        let monthlyCount = 0;
        let isTrialActive = false;
        try {
          const { data: profile } = await supabase
            .from("users")
            .select("is_ngo, is_premium, bio, monthly_claim_count, created_at")
            .eq("id", data.user.id)
            .single();
          if (profile) {
            isNgo = profile.is_ngo;
            isPremium = profile.is_premium;
            bio = profile.bio || "";
            monthlyCount = profile.monthly_claim_count || 0;

            if (welcomeTrialEnabled && profile.created_at) {
              const createdDate = new Date(profile.created_at);
              const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (30 - diffDays > 0) {
                isTrialActive = true;
              }
            }
          }
        } catch (e) {
          console.error("Failed to check user profile status:", e);
        }

        // Apply dynamic priority checking logic
        let finalLimit = currentLimit;
        let isUnlimited = isTrialActive;

        // 1. Check user override limit
        let customLimit: number | undefined = undefined;
        if (bio) {
          try {
            const parsedBio = JSON.parse(bio);
            if (parsedBio && typeof parsedBio === "object" && !Array.isArray(parsedBio)) {
              customLimit = parsedBio.custom_claim_limit;
            }
          } catch {}
        }

        if (customLimit !== undefined) {
          if (customLimit === -1) {
            isUnlimited = true;
          } else {
            finalLimit = customLimit;
          }
        } else {
          // 2. Check active campaign
          if (campaignType && campaignType !== "none") {
            if (campaignType === "unlimited") {
              isUnlimited = true;
            } else if (campaignType === "custom") {
              finalLimit = campaignLimit;
            }
          }
        }

        // Apply Premium or NGO expansions if not overridden and not unlimited
        if (customLimit === undefined && !isUnlimited) {
          if (isNgo) {
            finalLimit = 20;
          }
          if (isPremium) {
            isUnlimited = true;
          }
        }

        setUserClaimCount(monthlyCount);
        setClaimLimit(isUnlimited ? -1 : finalLimit);
        if (!isUnlimited && monthlyCount >= finalLimit) {
          setIsLimitReached(true);
        }
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchListingDetail = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("listings")
          .select(`
            *,
            donor:donor_id(id, name, trust_score, avatar_url, is_ngo, is_verified)
          `)
          .eq("id", id)
          .single();

        if (error) throw error;
        setListing(data);

        // Securely increment view count on the server side
        fetch("/api/listings/view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, userId }),
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData.success) {
              setListing((prev: any) => prev ? { ...prev, view_count: resData.new_count } : prev);
            }
          })
          .catch((err) => console.error("Error updating view count:", err));

        // Check if current user has already claimed this item or reached active bookings cap for skills
        if (userId && data) {
          if (data.listing_type === "skill") {
            const { data: bookingClaims, error: bookingErr } = await supabase
              .from("claims")
              .select("id")
              .eq("listing_id", id)
              .eq("receiver_id", userId)
              .in("status", ["pending", "accepted"]);

            if (!bookingErr && bookingClaims) {
              setActiveBookingsCount(bookingClaims.length);
              const maxCap = data.max_bookings_per_user ?? 2;
              if (bookingClaims.length >= maxCap) {
                setUserClaimed(true);
              }
              if (bookingClaims.length > 0) {
                setActiveClaimId(bookingClaims[0].id);
              }
            }
          } else {
            const { data: claimData } = await supabase
              .from("claims")
              .select("id")
              .eq("listing_id", id)
              .eq("receiver_id", userId)
              .in("status", ["pending", "accepted"])
              .maybeSingle();

            if (claimData) {
              setUserClaimed(true);
              setActiveClaimId(claimData.id);
            }
          }
        }
      } catch (err) {
        console.error("Listing detail fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchListingDetail();
  }, [id, userId]);

  useEffect(() => {
    if (!loading && listing && userId && listing.donor_id === userId) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("edit") === "true") {
        handleStartEdit();
      }
    }
  }, [loading, listing, userId]);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !listing) return;

    if (isLimitReached) {
      setClaimError(`You have reached your limit of ${claimLimit} free claims this month. Please try again next month when your limit resets.`);
      return;
    }

    if (claimMessage.length < 50 || claimMessage.length > 300) {
      setClaimError("Message must be between 50 and 300 characters.");
      return;
    }

    setClaiming(true);
    setClaimError("");
    setClaimSuccess("");

    try {
      // 1. Submit claim to DB claims table
      const { data: newClaim, error: claimError } = await supabase
        .from("claims")
        .insert({
          listing_id: listing.id,
          receiver_id: userId,
          donor_id: listing.donor_id,
          message: claimMessage,
          status: "pending",
        })
        .select()
        .single();

      if (claimError) {
        if (claimError.message.includes("Claim limit reached")) {
          throw new Error("You cannot have more than 5 active pending claims simultaneously. Please cancel one of your other pending claims first.");
        }
        throw claimError;
      }

      // 1.5 Fetch receiver name and notify the donor via server-side API (bypasses RLS)
      const { data: receiverProfile } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .single();
      const receiverName = receiverProfile?.name || "A neighbor";

      const isSkill = listing.listing_type === "skill";

      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: listing.donor_id,
          type: "new_claim",
          title: isSkill ? "New Session Request" : "New Claim Request",
          body: isSkill
            ? `${receiverName} requested your skill: "${listing.title}"`
            : `${receiverName} requested to claim your item: "${listing.title}"`,
          link: newClaim ? `/chat/${newClaim.id}` : "/dashboard",
        }),
      });

      if (newClaim) {
        try {
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              claim_id: newClaim.id,
              sender_id: userId,
              content: claimMessage,
            }),
          });
        } catch (msgErr) {
          console.error("Failed to post initial claim message:", msgErr);
        }
      }

      if (!isSkill) {
        // 2. Increment monthly claim count in user metadata for items
        const newClaimCount = userClaimCount + 1;
        const { error: authError } = await supabase.auth.updateUser({
          data: { monthly_claim_count: newClaimCount }
        });

        if (authError) throw authError;

        // 3. Increment monthly claim count in database users table
        await supabase
          .from("users")
          .update({ monthly_claim_count: newClaimCount })
          .eq("id", userId);

        setUserClaimed(true);
        if (newClaim) {
          setActiveClaimId(newClaim.id);
        }
      }

      setClaimSuccess("Request submitted successfully! Redirecting to chat...");
      setTimeout(() => {
        if (newClaim) {
          router.push(`/chat/${newClaim.id}`);
        }
      }, 1500);
    } catch (err: any) {
      setClaimError(err.message || "Failed to submit request.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Retrieving item file details...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <ShieldAlert size={48} className="text-red-400 animate-pulse" />
        <h2 className="text-lg font-bold">Item Not Found</h2>
        <Link href="/" className="text-teal-400 hover:underline text-xs flex items-center gap-1">
          <ArrowLeft size={14} /> Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-16 selection:bg-teal-500 selection:text-black">
      {/* Header back button */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
      </div>

      {isEditing ? (
        /* Edit Mode Card */
        <div className="max-w-3xl mx-auto bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mt-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                Edit Listing
              </h1>
              <p className="text-xs text-slate-400 mt-1">Update your listing details below.</p>
            </div>
            {saveError && <span className="text-red-400 text-xs font-semibold">{saveError}</span>}
          </div>

          <form onSubmit={handleEditSave} className="space-y-5">
            {/* Images */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Photos (Max 5, Min 1)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {editPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {editImages.length < 5 && (
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
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Wooden Study Table"
                minLength={5}
                maxLength={80}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 transition-all"
              />
            </div>

            {/* Category & Condition/MaxBookings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Category</label>
                <select
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className={`w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 focus:outline-none ${listing.listing_type === "skill" ? "focus:border-violet-500/80" : "focus:border-teal-500/80"} [color-scheme:dark]`}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {listing.listing_type === "skill" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Max Active Bookings Per User</label>
                  <select
                    value={editMaxBookings}
                    onChange={(e) => setEditMaxBookings(parseInt(e.target.value))}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500/80 [color-scheme:dark]"
                  >
                    {[1, 2, 3, 4, 5, 10].map((num) => (
                      <option key={num} value={num}>{num} {num === 1 ? "Active Slot" : "Active Slots"}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Condition</label>
                  <select
                    required
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/80 [color-scheme:dark]"
                  >
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Description</label>
              <textarea
                required
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe the item's condition, dimensions, and meetup notes..."
                minLength={20}
                maxLength={500}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 transition-all resize-none"
              />
            </div>

            {/* Location */}
            <div className="space-y-3 pt-2 border-t border-slate-850">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Meetup & Pickup Location</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">City</label>
                  <CityAutocomplete
                    required
                    value={editCity}
                    onChange={(val) => setEditCity(val)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Area</label>
                  <input
                    type="text"
                    required
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Pincode</label>
                  <input
                    type="text"
                    required
                    value={editPincode}
                    onChange={(e) => setEditPincode(e.target.value)}
                    maxLength={10}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500">Landmark</label>
                <input
                  type="text"
                  value={editLandmark}
                  onChange={(e) => setEditLandmark(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAutoDetectLocation}
                  disabled={detectingLocation}
                  className="inline-flex items-center gap-2 bg-slate-950/80 border border-slate-800 hover:border-teal-500/50 text-slate-350 hover:text-teal-400 text-[10px] font-bold py-2 px-3 rounded-xl transition-all disabled:opacity-50"
                >
                  <MapPin size={12} className={detectingLocation ? "animate-pulse text-teal-400" : ""} />
                  {detectingLocation ? "Detecting location..." : "Use Current Geolocation"}
                </button>
                {editLatitude && editLongitude && (
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 py-1 px-3 rounded-full">
                    ✓ Location pinned
                  </span>
                )}
              </div>
            </div>

            {/* Preferences */}
            <div className="space-y-2 pt-2 border-t border-slate-850">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Receiver Preferences</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {["all", "ngo_only", "high_trust"].map((pref) => (
                  <label key={pref} className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800 hover:border-teal-500/40 rounded-xl cursor-pointer select-none transition-all">
                    <input
                      type="radio"
                      name="preference"
                      value={pref}
                      checked={editReceiverPreference === pref}
                      onChange={() => setEditReceiverPreference(pref)}
                      className="accent-teal-500"
                    />
                    <span className="text-xs font-semibold capitalize text-slate-200">
                      {pref === "all" ? "Open to All" : pref === "ngo_only" ? "NGOs First" : "Trust 4.0+"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saveLoading}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-350 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 transition-all disabled:opacity-50"
              >
                {saveLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Image Slider */}
          <div className="space-y-4">
            <div className="aspect-square w-full rounded-3xl overflow-hidden bg-slate-950 border border-slate-900 relative">
              <img
                src={listing.images[activeImageIndex]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
              {/* Index label indicator */}
              <span className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white font-semibold border border-white/25">
                {activeImageIndex + 1} / {listing.images.length}
              </span>
            </div>

            {/* Image thumbnails mapping */}
            {listing.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto py-1">
                {listing.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-square w-16 rounded-xl overflow-hidden bg-slate-950 border transition-all ${
                      idx === activeImageIndex
                        ? "border-teal-500 ring-2 ring-teal-500/20"
                        : "border-slate-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Listing Details & Form */}
          <div className="space-y-6">
            <div className="space-y-3">
              {/* Badges row */}
              <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                  {listing.listing_type === "skill" ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      🎯 {listing.category}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      {listing.category}
                    </span>
                  )}
                  {listing.listing_type === "skill" ? (
                    listing.skill_duration && (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-violet-900/40 text-violet-300 border border-violet-800/40">
                        ⏱ {listing.skill_duration}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                      {listing.condition}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShare}
                    className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold ${listing.listing_type === "skill" ? "text-violet-500 hover:text-violet-400" : "text-teal-500 hover:text-teal-400"} bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-md transition-all cursor-pointer`}
                    title="Share Listing"
                  >
                    <Share2 size={11} />
                    <span>{shareText}</span>
                  </button>
                  {userId && listing.donor_id !== userId && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                      title="Report Listing"
                    >
                      <Flag size={10} />
                      <span>Report</span>
                    </button>
                  )}
                </div>
              </div>
              
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
                {listing.title}
              </h1>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin size={14} className="text-slate-500" />
                <span>{listing.area}, {listing.city}</span>
                {listing.landmark && (
                  <>
                    <span className="text-slate-700">•</span>
                    <span className="italic text-slate-400">Landmark: {listing.landmark}</span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Description
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>

            {/* Skill Tags */}
            {listing.listing_type === "skill" && listing.skill_tags && listing.skill_tags.length > 0 && (
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest">Skill Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {listing.skill_tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="inline-flex items-center text-xs font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/25 px-3 py-1 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Donor details card */}
            <div className="border border-slate-900 rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-400">
                  {listing.donor?.avatar_url ? (
                    <img src={listing.donor.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/profile/${listing.donor?.id}`} className="text-sm font-bold text-slate-200 hover:text-teal-400 hover:underline transition-colors">
                      {listing.donor?.name || "Anonymous Donor"}
                    </Link>
                    {listing.donor?.is_ngo && (
                      <span title="Verified NGO">
                        <Award size={14} className="text-violet-400" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Star size={11} className="fill-yellow-500 text-yellow-500" />
                    <span>{listing.donor?.trust_score || "5.0"} Trust Score</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Claim/Contact Block Form */}
            <div className="pt-4">
              {!userId ? (
                <Link
                  href={`/login?next=/listing/${listing.id}`}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-200 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  Sign in to {listing.listing_type === "skill" ? "Request Session" : "Claim Item"}
                </Link>
              ) : userClaimed ? (
                <div className="space-y-3">
                  <div className={`p-4 rounded-xl ${listing.listing_type === "skill" ? "bg-violet-500/10 border border-violet-500/20 text-violet-400" : "bg-teal-500/10 border border-teal-500/20 text-teal-400"} text-xs text-center font-semibold`}>
                    {listing.listing_type === "skill"
                      ? `✓ You have reached the maximum active bookings (${listing.max_bookings_per_user ?? 2}) allowed by the host.`
                      : "✓ You have already requested this item. Check your profile for status updates."
                    }
                  </div>
                  {activeClaimId && (
                    <div className="flex gap-2">
                      <Link
                        href={`/chat/${activeClaimId}`}
                        className="flex-1 text-center bg-slate-900 border border-slate-800 text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-slate-850 transition-colors flex items-center justify-center"
                      >
                        Open Chat
                      </Link>
                      <button
                        onClick={async () => {
                          if (confirm("Are you sure you want to cancel this request?")) {
                            try {
                              const res = await fetch(`/api/claims/${activeClaimId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "cancelled" }),
                              });
                              if (res.ok) {
                                // Decrease monthly claim count in user metadata for items
                                if (listing.listing_type !== "skill") {
                                  const newClaimCount = Math.max(0, userClaimCount - 1);
                                  await supabase.auth.updateUser({
                                    data: { monthly_claim_count: newClaimCount }
                                  });
                                  await supabase
                                    .from("users")
                                    .update({ monthly_claim_count: newClaimCount })
                                    .eq("id", userId);
                                }

                                setUserClaimed(false);
                                setActiveClaimId(null);
                                window.location.reload();
                              }
                            } catch (err) {
                              console.error("Cancel claim failed:", err);
                            }
                          }
                        }}
                        className="flex-1 bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-900/30 hover:border-red-800/40 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}
                </div>
              ) : listing.donor_id === userId ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs text-center font-medium">
                    This is your listing. You cannot claim your own item.
                  </div>
                  <button
                    onClick={handleStartEdit}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-extrabold rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-350 border border-slate-800 hover:border-slate-750 transition-all active:scale-[0.98]"
                  >
                    <Edit size={14} />
                    Edit Listing Details
                  </button>
                  <button
                    onClick={handleDeleteListing}
                    disabled={deleteLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-extrabold rounded-xl bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-900/30 hover:border-red-800/40 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {deleteLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash size={14} />
                    )}
                    Delete Listing
                  </button>
                </div>
              ) : isLimitReached ? (
                /* Compact Claims Limit Reached Card */
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-teal-400">
                    <ShieldAlert size={16} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Limit Reached
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    You have claimed all {claimLimit} items this month. Invite friends to unlock <strong className="text-teal-450 font-bold">+2 extra claims</strong>!
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/register?ref=${userId}`;
                        navigator.clipboard.writeText(link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 py-2 px-3 rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {copied ? "Link Copied!" : "Copy Invite Link"}
                    </button>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Hey! Check out FreeShare India to claim free pre-loved goods in your city! Sign up using my link: ${typeof window !== "undefined" ? `${window.location.origin}/register?ref=${userId}` : ""}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-[#25D366] hover:bg-[#20ba59] text-black font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-[0.98] text-xs cursor-pointer text-center"
                    >
                      Share on WhatsApp
                    </a>
                  </div>
                </div>
              ) : (
                /* Request form details */
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200">
                    Request this Item
                  </h3>

                  {claimError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                      {claimError}
                    </div>
                  )}
                  {claimSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center">
                      {claimSuccess}
                    </div>
                  )}

                  <form onSubmit={handleClaimSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400">
                        Why do you need this item? (Min 50, Max 300 characters)
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={claimMessage}
                        onChange={(e) => setClaimMessage(e.target.value)}
                        placeholder="e.g., I'm a first-year student and need a desk for study. I can collect it tomorrow evening."
                        minLength={50}
                        maxLength={300}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20 transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={claiming}
                      className={`w-full bg-gradient-to-r ${listing.listing_type === "skill" ? "from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400" : "from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400"} text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 text-sm`}
                    >
                      {claiming ? (
                        <Loader2 className="animate-spin text-slate-950" size={16} />
                      ) : (
                        <>
                          <Send size={14} />
                          {listing.listing_type === "skill" ? "Request Session" : "Claim Item"}
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reporterId={userId}
        reportedListingId={listing.id}
        reportedUserId={listing.donor_id}
        targetName={`listing "${listing.title}"`}
      />
    </div>
  );
}

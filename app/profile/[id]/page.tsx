"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, ArrowLeft, Star, MapPin, Gift, Calendar, AlertTriangle, ShieldCheck, Heart, Phone, Edit, Save, Flag } from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import { normalizeCityName } from "@/lib/cities";
import ReportModal from "@/components/ReportModal";



type ProfileTabState = "listings" | "events" | "reviews";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTabState>("listings");

  // Auth & Editing state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editGender, setEditGender] = useState("Male");
  const [editPhone, setEditPhone] = useState("");
  const [editShowPhone, setEditShowPhone] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Direct NGO Donation States
  const [showDirectDonationModal, setShowDirectDonationModal] = useState(false);
  const [myAvailableListings, setMyAvailableListings] = useState<any[]>([]);
  const [loadingMyListings, setLoadingMyListings] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [donationMessage, setDonationMessage] = useState("");
  const [donationSubmitting, setDonationSubmitting] = useState(false);
  const [donationError, setDonationError] = useState("");

  const isOwner = currentUser && currentUser.id === id;

  useEffect(() => {
    if (showDirectDonationModal && currentUser) {
      const fetchMyListings = async () => {
        setLoadingMyListings(true);
        setDonationError("");
        try {
          const { data, error } = await supabase
            .from("listings")
            .select("*")
            .eq("donor_id", currentUser.id)
            .eq("status", "available")
            .order("created_at", { ascending: false });

          if (error) throw error;
          setMyAvailableListings(data || []);
          if (data && data.length > 0) {
            setSelectedListingId(data[0].id);
          } else {
            setSelectedListingId("");
          }
        } catch (err: any) {
          console.error("Error fetching my listings:", err);
          setDonationError("Failed to fetch your listings.");
        } finally {
          setLoadingMyListings(false);
        }
      };
      fetchMyListings();
    }
  }, [showDirectDonationModal, currentUser]);

  const handleDirectDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedListingId) return;

    setDonationSubmitting(true);
    setDonationError("");

    try {
      const res = await fetch("/api/ngo/direct-donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selectedListingId,
          ngoId: id,
          donorId: currentUser.id,
          message: donationMessage || "Direct Donation offer via NGO profile page"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to make direct donation.");
      }

      setShowDirectDonationModal(false);
      router.push(`/chat/${data.claimId}`);
    } catch (err: any) {
      console.error(err);
      setDonationError(err.message || "Something went wrong.");
    } finally {
      setDonationSubmitting(false);
    }
  };

  const getBioText = (bioString: string) => {
    if (!bioString) return "";
    try {
      const parsed = JSON.parse(bioString);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed.user_description || "";
      }
    } catch {}
    return bioString;
  };

  const handleStartEdit = () => {
    setEditName(profile.name || "");
    setEditBio(getBioText(profile.bio || ""));
    setEditCity(profile.city || "");
    setEditArea(profile.area || "");
    setEditPincode(profile.pincode || "");
    setEditGender(profile.gender || "Male");
    setEditPhone(profile.phone || "");
    setEditShowPhone(!!profile.show_phone);
    setIsEditing(true);
    setSaveError("");
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveError("Name is required");
      return;
    }
    setSaveLoading(true);
    setSaveError("");
    try {
      const normalizedCity = normalizeCityName(editCity);

      // Preserve existing JSON fields (e.g. push_subscriptions)
      let finalBio = editBio;
      try {
        const existingBio = JSON.parse(profile.bio || "{}");
        if (existingBio && typeof existingBio === "object" && !Array.isArray(existingBio)) {
          existingBio.user_description = editBio;
          finalBio = JSON.stringify(existingBio);
        } else {
          finalBio = JSON.stringify({ user_description: editBio });
        }
      } catch {
        finalBio = JSON.stringify({ user_description: editBio });
      }

      // 1. Update public.users table in Supabase
      const { error: dbError } = await supabase
        .from("users")
        .update({
          name: editName,
          bio: finalBio,
          city: normalizedCity,
          area: editArea,
          pincode: editPincode,
          gender: editGender,
          phone: editPhone,
          show_phone: editShowPhone,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (dbError) throw dbError;

      // 2. Best-effort update of User Auth metadata
      await supabase.auth.updateUser({
        data: {
          name: editName,
          city: normalizedCity,
          area: editArea,
          pincode: editPincode,
          gender: editGender,
        }
      });

      // Update local profile state
      setProfile((prev: any) => ({
        ...prev,
        name: editName,
        bio: finalBio,
        city: normalizedCity,
        area: editArea,
        pincode: editPincode,
        gender: editGender,
        phone: editPhone,
        show_phone: editShowPhone,
      }));

      setIsEditing(false);
    } catch (err: any) {
      // Supabase errors are objects, not standard JS Error instances.
      // Extract message manually so console.error doesn't log "{}"
      const errMsg =
        err?.message ||
        err?.error_description ||
        err?.details ||
        (typeof err === "string" ? err : JSON.stringify(err));
      console.error("Failed to save profile:", errMsg);
      setSaveError(errMsg || "Failed to update profile. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchProfileData = async () => {
      setLoading(true);
      try {
        // Fetch current logged-in user
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        // 1. Fetch public profile details
        const { data: userProfile, error: profileErr } = await supabase
          .from("users")
          .select("*")
          .eq("id", id)
          .single();

        if (profileErr) throw profileErr;
        setProfile(userProfile);

        // 2. Fetch listings by this user
        const { data: userListings } = await supabase
          .from("listings")
          .select("*")
          .eq("donor_id", id)
          .in("status", ["available", "completed"])
          .order("created_at", { ascending: false });

        setListings(userListings || []);

        // 3. Fetch reviews received by this user
        const { data: userReviews } = await supabase
          .from("reviews")
          .select(`
            *,
            reviewer:reviewer_id(id, name, avatar_url)
          `)
          .eq("reviewed_id", id)
          .order("created_at", { ascending: false });

        setReviews(userReviews || []);

        // 4. Fetch events organized by this user
        const { data: userEvents } = await supabase
          .from("events")
          .select("*, rsvps:event_rsvps(user_id)")
          .eq("organizer_id", id)
          .order("start_date", { ascending: true });

        setEvents(userEvents || []);

      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-teal-400" size={36} />
        <p className="text-sm text-slate-500">Retrieving user profile file details...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <AlertTriangle size={48} className="text-red-400 animate-pulse" />
        <h2 className="text-lg font-bold">Profile Not Found</h2>
        <Link href="/" className="text-teal-400 hover:underline text-xs flex items-center gap-1">
          <ArrowLeft size={14} /> Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans pb-24 selection:bg-teal-500 selection:text-black">
      {/* Header Back Button */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Feed
        </Link>
      </div>

      {/* Profile Main Card */}
      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 sm:p-8 space-y-6">
          {isEditing ? (
            /* Editing State */
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                  <Edit className="text-teal-400" size={18} /> Edit Your Profile
                </h3>
                {saveError && (
                  <span className="text-red-400 text-xs font-medium">{saveError}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 px-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* Mobile Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 px-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* City */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">City</label>
                  <CityAutocomplete
                    required
                    value={editCity}
                    onChange={(val) => setEditCity(val)}
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* Area */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Area</label>
                  <input
                    type="text"
                    required
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* Pincode */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Pincode</label>
                  <input
                    type="text"
                    required
                    value={editPincode}
                    onChange={(e) => setEditPincode(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Gender</label>
                  <select
                    required
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all [color-scheme:dark]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Bio */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Bio</label>
                  <textarea
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Write something about yourself..."
                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/10 transition-all resize-none"
                  />
                </div>

                {/* Phone visibility toggle checkbox */}
                <div className="sm:col-span-2 flex items-start gap-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
                  <input
                    type="checkbox"
                    id="show_phone"
                    checked={editShowPhone}
                    onChange={(e) => setEditShowPhone(e.target.checked)}
                    className="mt-0.5 rounded border-slate-800 bg-slate-950 text-teal-500 focus:ring-teal-500/20"
                  />
                  <label htmlFor="show_phone" className="text-xs text-slate-350 cursor-pointer select-none">
                    <span className="font-extrabold text-slate-200 block">Show my mobile number on my profile</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      By default, your mobile number is hidden. Enable this to make it visible to other logged-in users so they can contact you directly.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={saveLoading}
                  className="px-4 py-3 text-xs font-bold rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 transition-all min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-bold rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 transition-all disabled:opacity-50 min-h-[44px]"
                >
                  {saveLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            /* View State */
            <>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                
                {/* Avatar block */}
                <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-950 border-2 border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Gift size={40} className="text-slate-700" />
                  )}
                </div>

                {/* Profile detail text */}
                <div className="space-y-3 flex-1">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                      <h2 className="text-2xl font-black text-slate-100">{profile.name}</h2>
                      {profile.is_verified && (
                        <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20" title="Identity Verified">
                          <ShieldCheck size={10} /> Verified
                        </span>
                      )}
                      {profile.is_ngo && (
                        <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20" title="Verified NGO">
                          <Heart size={10} className="fill-violet-400" /> NGO
                        </span>
                      )}
                      {isOwner && (
                        <button
                          onClick={handleStartEdit}
                          className="flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-750 transition-all active:scale-[0.98]"
                        >
                          <Edit size={11} /> Edit Details
                        </button>
                      )}
                      {!isOwner && currentUser && (
                        <button
                          onClick={() => setShowReportModal(true)}
                          className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-red-400 text-slate-400 border border-slate-800 transition-all cursor-pointer"
                          title="Report User Profile"
                        >
                          <Flag size={11} /> Report
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-500" /> {profile.area}, {profile.city} {isOwner && profile.pincode ? `(${profile.pincode})` : ""}
                      </span>
                      {profile.gender && (
                        <>
                          <span className="text-slate-700">•</span>
                          <span className="flex items-center gap-1">
                            <span className="text-slate-500 font-medium">Gender:</span> {profile.gender}
                          </span>
                        </>
                      )}
                      <span className="text-slate-700">•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-500" /> Joined {new Date(profile.created_at).toLocaleDateString([], { month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Bio block */}
                  {getBioText(profile.bio) ? (
                    <p className="text-sm text-slate-300 max-w-xl leading-relaxed">{getBioText(profile.bio)}</p>
                  ) : (
                    <p className="text-xs text-slate-550 italic">"No bio added yet."</p>
                  )}

                  {/* Phone badge */}
                  {profile.phone && (isOwner || profile.show_phone) ? (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1.5">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl text-xs font-semibold">
                        <Phone size={12} /> {profile.phone}
                        {isOwner && (
                          <span className="text-[9px] text-slate-500 font-bold ml-1">
                            ({profile.show_phone ? "Visible" : "Private"})
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    isOwner && (
                      <button
                        onClick={handleStartEdit}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400 bg-slate-900/60 px-3 py-1 rounded-xl border border-slate-800 border-dashed hover:border-slate-750 transition-all font-medium"
                      >
                        <Phone size={12} /> Add Mobile Number
                      </button>
                    )
                  )}

                  {/* Rating stars */}
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-xs pt-1">
                    <div className="flex items-center gap-0.5 bg-yellow-500/10 text-yellow-500 px-2.5 py-1 rounded-lg border border-yellow-500/10">
                      <Star size={12} className="fill-yellow-500 text-yellow-500" />
                      <span className="font-extrabold text-[11px]">{profile.trust_score || "5.0"}</span>
                    </div>
                    <span className="text-slate-500 pl-1">{reviews.length} feedback ratings</span>
                  </div>

                  {!isOwner && profile.is_ngo && (
                    <div className="pt-3 flex justify-center sm:justify-start">
                      <button
                        onClick={() => setShowDirectDonationModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-650 to-indigo-700 hover:from-violet-550 hover:to-indigo-600 text-slate-100 text-xs font-bold border border-violet-500/20 shadow-lg shadow-violet-950/20 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Heart size={13} className="fill-slate-100" /> Donate Directly to NGO
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Bar Counters */}
              <div className="grid grid-cols-3 gap-4 border-t border-slate-900/80 pt-6 text-center">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Items Donated</span>
                  <span className="text-lg font-black text-teal-400">{profile.total_donated || 0}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Items Received</span>
                  <span className="text-lg font-black text-slate-100">{profile.total_received || 0}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Warning Strikes</span>
                  <span className={`text-lg font-black ${profile.strike_count > 0 ? "text-amber-500" : "text-slate-500"}`}>
                    {profile.strike_count || 0}
                  </span>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Tab Controls Switches */}
        <div className="flex gap-1 border-b border-slate-900 pb-0 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button
            onClick={() => setActiveTab("listings")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all shrink-0 whitespace-nowrap ${
              activeTab === "listings"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Gift size={16} />
            Listings ({listings.length})
          </button>

          <button
            onClick={() => setActiveTab("events")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all shrink-0 whitespace-nowrap ${
              activeTab === "events"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar size={16} />
            Events Organised ({events.length})
          </button>
          
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all shrink-0 whitespace-nowrap ${
              activeTab === "reviews"
                ? "border-teal-500 text-teal-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Star size={16} />
            Reviews Received ({reviews.length})
          </button>
        </div>

        {/* Active Tab contents */}
        {activeTab === "listings" ? (
          /* Available Listings */
          <div className="mt-4">
            {listings.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-900 rounded-3xl">
                <Gift className="mx-auto text-slate-700 mb-3" size={32} />
                <p className="text-sm text-slate-500">No listings available from this donor.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-6">
                {listings.map((item) => (
                  <Link
                    key={item.id}
                    href={`/listing/${item.id}`}
                    className="group bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all"
                  >
                    <div className="aspect-square relative overflow-hidden bg-slate-950">
                      <img src={item.images?.[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      {item.status === "completed" ? (
                        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex items-center justify-center z-10">
                          <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border bg-emerald-500/20 text-emerald-450 border-emerald-500/30">
                            🌱 Donated
                          </span>
                        </div>
                      ) : (
                        <span className="absolute top-2 left-2 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded bg-black/60 text-teal-400">
                          {item.condition}
                        </span>
                      )}
                    </div>
                    <div className="p-3 sm:p-4 space-y-1">
                      <h4 className="font-bold text-xs text-slate-100 group-hover:text-teal-400 transition-colors line-clamp-1">{item.title}</h4>
                      <p className="text-[10px] text-slate-500 truncate">{item.area}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "events" ? (
          /* Events Organised */
          <div className="mt-4">
            {events.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-900 rounded-3xl">
                <Calendar className="mx-auto text-slate-700 mb-3" size={32} />
                <p className="text-sm text-slate-500">No events organised by this user yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-6">
                {events.map((event) => {
                  const rsvpCount = event.rsvps?.length || 0;
                  const isPast = new Date(event.end_date) < new Date();
                  
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="group bg-slate-900/30 border border-slate-900 hover:border-amber-500/50 rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all h-full"
                    >
                      <div className="aspect-video relative overflow-hidden bg-slate-950">
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-950/40 to-slate-950 text-2xl">
                            📢
                          </div>
                        )}
                        <span className={`absolute top-2 left-2 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded bg-black/60 tracking-wider ${
                          isPast ? "text-slate-500" : "text-amber-400"
                        }`}>
                          {isPast ? "Ended" : "Upcoming"}
                        </span>
                      </div>
                      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-slate-100 group-hover:text-amber-400 transition-colors line-clamp-1">
                            {event.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 line-clamp-2">
                            {event.description}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-900/50 flex items-center justify-between text-[9px] text-slate-550">
                          <span>{event.area}</span>
                          <span>{rsvpCount} attending</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Feedback Reviews list */
          <div className="mt-4 space-y-4">
            {reviews.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-900 rounded-3xl">
                <Star className="mx-auto text-slate-700 mb-3" size={32} />
                <p className="text-sm text-slate-500">No reviews received yet.</p>
              </div>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800 text-slate-500">
                        {rev.reviewer?.avatar_url ? (
                          <img src={rev.reviewer.avatar_url} alt="Reviewer" className="w-full h-full object-cover" />
                        ) : (
                          <Gift size={16} />
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-200">{rev.reviewer?.name || "User"}</span>
                    </div>
                    
                    <div className="flex items-center gap-0.5 text-yellow-500 text-xs">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} size={11} className="fill-yellow-500 text-yellow-500" />
                      ))}
                    </div>
                  </div>

                  {rev.comment && (
                    <p className="text-xs text-slate-350 leading-relaxed italic bg-slate-950/20 p-3 rounded-2xl border border-slate-900/50">
                      "{rev.comment}"
                    </p>
                  )}
                  <div className="text-[9px] text-slate-500 text-right">
                    Reviewed on {new Date(rev.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Report Modal */}
      {profile && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={currentUser?.id || null}
          reportedUserId={profile.id}
          targetName={`user profile "${profile.name}"`}
        />
      )}

      {/* Direct Donation Modal */}
      {showDirectDonationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Heart className="text-violet-400 fill-violet-400" size={20} /> Donate to {profile.name}
              </h3>
              <button
                onClick={() => setShowDirectDonationModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold bg-slate-950/40 p-1.5 rounded-lg border border-slate-850"
              >
                ✕
              </button>
            </div>

            {loadingMyListings ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="animate-spin text-teal-400" size={28} />
                <p className="text-xs text-slate-550">Checking your available listings...</p>
              </div>
            ) : donationError ? (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {donationError}
              </div>
            ) : myAvailableListings.length > 0 ? (
              <form onSubmit={handleDirectDonationSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                    Select Item to Donate
                  </label>
                  <select
                    value={selectedListingId}
                    onChange={(e) => setSelectedListingId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-100 focus:outline-none focus:border-teal-500 transition-all"
                  >
                    {myAvailableListings.map((lst) => (
                      <option key={lst.id} value={lst.id}>
                        {lst.title} ({lst.condition})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                    Message for NGO (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={donationMessage}
                    onChange={(e) => setDonationMessage(e.target.value)}
                    placeholder="E.g. I can drop this off at your center, or please arrange pickup..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-all resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setShowDirectDonationModal(false)}
                    className="px-4 py-3 text-xs font-bold rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-350 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={donationSubmitting}
                    className="flex items-center gap-1.5 px-4 py-3 text-xs font-bold rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {donationSubmitting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Heart size={13} className="fill-slate-950" />
                    )}
                    Confirm Donation Offer
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  You don't have any items currently listed as <span className="text-teal-400 font-bold">"available"</span>.
                </p>
                <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
                  <Link
                    href={`/donate?assignNgoId=${profile.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-teal-500/10 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Gift size={13} /> List a New Item for this NGO
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowDirectDonationModal(false)}
                    className="px-4 py-2 text-[10px] font-bold uppercase text-slate-500 hover:text-slate-350 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

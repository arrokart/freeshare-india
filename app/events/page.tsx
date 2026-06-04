"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, MapPin, Users, Plus, Loader2, ArrowLeft, Search, HelpCircle, AlertCircle } from "lucide-react";
import CityAutocomplete from "@/components/CityAutocomplete";
import { normalizeCityName } from "@/lib/cities";

export default function EventsFeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filtering states
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [pincode, setPincode] = useState("");
  
  // RSVP processing states
  const [rsvpLoadingId, setRsvpLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        // Fetch full profile info
        const { data: profile } = await supabase
          .from("users")
          .select("id, name, is_admin, is_ngo, city, area, pincode")
          .eq("id", data.user.id)
          .single();
        
        setUser(profile || data.user);
        
        // Auto-fill location defaults from user profile
        if (profile) {
          setCity(profile.city || "");
          setArea(profile.area || "");
          setPincode(profile.pincode || "");
        }
      }
    };
    fetchUser();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (city) queryParams.set("city", normalizeCityName(city));
      if (area) queryParams.set("area", area);
      if (pincode) queryParams.set("pincode", pincode);

      const res = await fetch(`/api/events?${queryParams.toString()}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [city, area, pincode]);

  const handleRsvpToggle = async (eventId: string) => {
    if (!user) {
      router.push("/login?next=/events");
      return;
    }

    setRsvpLoadingId(eventId);
    try {
      const res = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, userId: user.id }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to RSVP");

      // Refresh listings
      await fetchEvents();
    } catch (err: any) {
      alert(err.message || "Something went wrong.");
    } finally {
      setRsvpLoadingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCalendarDateParts = (dateString: string) => {
    const d = new Date(dateString);
    const day = d.getDate();
    const month = d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase();
    return { day, month };
  };

  const filteredEvents = events.filter((event) => {
    const matchSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-amber-500 selection:text-black">
      
      {/* Header Bar */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900">
              <ArrowLeft size={20} />
            </Link>
            <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent select-none">
              Community Events
            </span>
          </div>

          {user && (
            <Link
              href="/events/new"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-xs font-bold text-slate-950 transition-all shadow-lg shadow-amber-500/10 cursor-pointer uppercase tracking-wider"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Create Event</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Intro Banner */}
        <div className="p-6 rounded-3xl bg-radial from-amber-500/5 to-transparent border border-amber-500/10 text-center md:text-left md:flex md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-amber-400">Bring Neighbors Together</h2>
            <p className="text-xs text-slate-400">
              Participate in local cloth distribution drives, neighborhood cleaning, group support, or local charity workshops.
            </p>
          </div>
          {!user && (
            <Link
              href="/login?next=/events/new"
              className="inline-block mt-4 md:mt-0 px-5 py-2.5 rounded-xl border border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-xs font-bold text-amber-400 transition-all"
            >
              Log in to Post Events
            </Link>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-900 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Search Input */}
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 group-focus-within:text-amber-400 transition-colors">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, topics, or venues..."
                className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>

            {/* City Search */}
            <div className="relative">
              <CityAutocomplete
                value={city}
                onChange={setCity}
                placeholder="Filter by City (e.g. Delhi)"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-amber-500/80 transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Area Search */}
            <div>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Filter by Area (e.g. Connaught Place)"
                className="w-full bg-slate-950/40 border border-slate-800 rounded-2xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-amber-500/80 transition-all"
              />
            </div>

          </div>
        </div>

        {/* Events Catalog List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-amber-500" size={28} />
            <p className="text-xs text-slate-500">Loading local community events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-slate-900 rounded-3xl bg-slate-950/50 p-8">
            <Calendar size={40} className="text-slate-700 mb-3" />
            <h3 className="text-sm font-bold text-slate-400">No Upcoming Events Found</h3>
            <p className="text-xs text-slate-600 mt-1 max-w-sm">
              There are no upcoming events listed for your area. Try adjusting your filters or click "Create Event" to post one!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const { day, month } = getCalendarDateParts(event.event_date);
              const isGoing = user && event.rsvps?.some((r: any) => r.user_id === user.id);
              const rsvpCount = event.rsvps?.length || 0;
              const isFull = event.max_participants && rsvpCount >= event.max_participants;

              return (
                <div
                  key={event.id}
                  className="group bg-slate-900/30 border border-slate-900 rounded-3xl p-5 hover:border-slate-800/80 transition-all flex flex-col sm:flex-row gap-5 shadow-lg relative overflow-hidden"
                >
                  {/* Calender icon badge */}
                  <div className="flex sm:flex-col items-center justify-center bg-slate-950 border border-slate-850 rounded-2xl p-3 sm:w-16 sm:h-16 shrink-0 h-fit gap-2 sm:gap-0">
                    <span className="text-[10px] uppercase font-black text-amber-500 tracking-widest">{month}</span>
                    <span className="text-2xl font-black text-slate-100">{day}</span>
                  </div>

                  {/* Event Details Content */}
                  <div className="flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/events/${event.id}`} className="text-base font-extrabold text-slate-200 hover:text-amber-400 transition-colors">
                        {event.title}
                      </Link>

                      {/* Organizer badge */}
                      {event.organizer?.is_ngo ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] uppercase tracking-wider font-extrabold">
                          🤝 Verified NGO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 text-[8px] uppercase tracking-wider font-extrabold">
                          👤 Member Host
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2">
                      {event.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-[10px] text-slate-500 font-bold">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-amber-500" />
                        {formatDate(event.event_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-amber-500" />
                        {event.location_name}, {event.area}, {event.city}
                      </span>
                      {event.max_participants && (
                        <span className="text-slate-600 font-normal">
                          Max size: {event.max_participants}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions / RSVP Area */}
                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-900/60 pt-4 sm:pt-0 sm:pl-5 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <Users size={14} className="text-amber-500" />
                      <span>{rsvpCount} going</span>
                    </div>

                    <button
                      onClick={() => handleRsvpToggle(event.id)}
                      disabled={rsvpLoadingId === event.id || (!isGoing && isFull)}
                      className={`w-full px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer select-none text-center ${
                        isGoing
                          ? "bg-slate-850 hover:bg-red-500/10 border border-slate-850 hover:border-red-500/20 text-slate-400 hover:text-red-400"
                          : isFull
                          ? "bg-slate-950 border border-slate-900 text-slate-700 cursor-not-allowed"
                          : "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/35 text-amber-400"
                      }`}
                    >
                      {rsvpLoadingId === event.id ? (
                        <Loader2 className="animate-spin inline-block mr-1" size={12} />
                      ) : isGoing ? (
                        "Going"
                      ) : isFull ? (
                        "Full"
                      ) : (
                        "Attend"
                      )}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

    </div>
  );
}

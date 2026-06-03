"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Search, MapPin, Loader2 } from "lucide-react";

interface LocationData {
  display_name: string;
  city?: string;
  state?: string;
  postcode?: string;
  lat: number;
  lng: number;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
}

const POPULAR_CITIES = [
  { name: "Mumbai", lat: 18.9696, lng: 72.823 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
];

export default function LocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setResults([]);
    setErrorMsg("");
  }, [isOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (val.trim().length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    timerRef.current = setTimeout(async () => {
      try {
        // Query Nominatim API with countrycodes=in (India) and addressdetails=1
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&addressdetails=1&q=${encodeURIComponent(
            val
          )}`
        );
        const data = await res.json();
        
        if (Array.isArray(data)) {
          const formatted = data.map((item: any) => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.suburb || addr.village || addr.state_district || "";
            const state = addr.state || "";
            const postcode = addr.postcode || "";
            
            // Clean dynamic name formatting
            let cleanName = item.display_name;
            if (city && state) {
              cleanName = `${city}, ${state} ${postcode ? `(${postcode})` : ""}`;
            }

            return {
              display_name: cleanName,
              city,
              state,
              postcode,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          setResults(formatted);
        }
      } catch (err) {
        console.error("Nominatim fetch error:", err);
        setErrorMsg("Failed to load location suggestions.");
      } finally {
        setLoading(false);
      }
    }, 600); // 600ms debounce
  };

  // IP-based geolocation fallback (works on desktops without GPS)
  const detectViaIP = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("IP geolocation API error");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        onSelectLocation({
          display_name: [data.city, data.region].filter(Boolean).join(", "),
          city: data.city || "",
          state: data.region || "",
          postcode: data.postal || "",
          lat: data.latitude,
          lng: data.longitude,
        });
        setDetecting(false);
        onClose();
      } else {
        throw new Error("No coordinates in response");
      }
    } catch {
      setErrorMsg("Could not detect location. Please search or select a city manually.");
      setDetecting(false);
    }
  };

  // Reverse-geocode browser coords to get city/state/pincode
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.state_district || "";
      const state = addr.state || "";
      const postcode = addr.postcode || "";
      onSelectLocation({
        display_name: [city, state].filter(Boolean).join(", ") + (postcode ? ` (${postcode})` : ""),
        city,
        state,
        postcode,
        lat,
        lng,
      });
    } catch {
      // Reverse geocode failed, use raw coords
      onSelectLocation({
        display_name: "Current Location",
        lat,
        lng,
      });
    }
    setDetecting(false);
    onClose();
  };

  const handleDetectLocation = async () => {
    setDetecting(true);
    setErrorMsg("");

    // Try browser geolocation first (best accuracy on mobile)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          reverseGeocode(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Browser geolocation failed — fall back to IP-based detection
          console.warn("Browser geolocation unavailable, falling back to IP-based detection");
          detectViaIP();
        },
        { timeout: 5000 }
      );
    } else {
      // No geolocation API at all — IP fallback
      await detectViaIP();
    }
  };

  const handleSelectPreset = (city: any) => {
    onSelectLocation({
      display_name: city.name,
      city: city.name,
      lat: city.lat,
      lng: city.lng,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Choose Location
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Autocomplete Input */}
          <div className="relative group">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 group-focus-within:text-teal-400 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin text-teal-400" /> : <Search size={16} />}
            </span>
            <input
              type="text"
              placeholder="Search City, Neighborhood, Pincode..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/80 transition-all"
            />
          </div>

          {errorMsg && (
            <p className="text-[10px] text-red-400 text-center font-medium">{errorMsg}</p>
          )}

          {/* Results Suggestions */}
          {results.length > 0 && (
            <div className="bg-slate-950 border border-slate-850 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-900 scrollbar-none">
              {results.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelectLocation(item);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-slate-900/60 hover:text-teal-400 transition-all flex items-center gap-2"
                >
                  <MapPin size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Detect Location Action */}
          <button
            onClick={handleDetectLocation}
            disabled={detecting}
            className="w-full bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {detecting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Detecting coords...
              </>
            ) : (
              <>
                <MapPin size={14} />
                Detect My Current Location
              </>
            )}
          </button>

          {/* Popular presets */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Popular Cities
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {POPULAR_CITIES.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleSelectPreset(city)}
                  className="bg-slate-950 border border-slate-800 hover:border-slate-700/60 hover:bg-slate-900 text-slate-300 py-2.5 px-1 rounded-xl text-[10px] text-center font-bold transition-all truncate"
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

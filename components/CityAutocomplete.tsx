"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { searchStaticCities, normalizeCityName } from "@/lib/cities";

interface CityAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function CityAutocomplete({
  value,
  onChange,
  placeholder = "e.g. Patna",
  className = "w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/20",
  required = false,
}: CityAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if value prop changes from outside
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val); // Bubble up immediately to let parent know the text is changing
    setHighlightedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    // 1. Get static list matches immediately
    const staticMatches = searchStaticCities(val);

    // Set static results first
    setSuggestions(staticMatches);

    // 2. Debounce Nominatim live API call if query is longer than 2 chars
    if (val.trim().length >= 3) {
      setLoading(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          // Nominatim query restricted to India cities/towns
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&addressdetails=1&q=${encodeURIComponent(
              val.trim()
            )}`
          );
          if (!res.ok) throw new Error("API error");
          const data = await res.json();

          if (Array.isArray(data)) {
            const apiCities = data
              .map((item: any) => {
                const addr = item.address || {};
                const name = addr.city || addr.town || addr.village || addr.suburb || addr.state_district || "";
                return normalizeCityName(name);
              })
              .filter((name): name is string => !!name);

            // Merge local static results and API results, removing duplicates
            const merged = Array.from(new Set([...staticMatches, ...apiCities]))
              // Cap suggestions list
              .slice(0, 8);

            setSuggestions(merged);
          }
        } catch (err) {
          console.error("City fetch error:", err);
        } finally {
          setLoading(false);
        }
      }, 500);
    } else {
      setSuggestions(staticMatches.slice(0, 8));
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (val: string) => {
    const normalized = normalizeCityName(val);
    setInputValue(normalized);
    onChange(normalized);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && inputValue.trim().length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[highlightedIndex]);
        } else {
          // Normalise current custom text on enter
          handleSelectSuggestion(inputValue);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          required={required}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim().length > 0) {
              setIsOpen(true);
              const staticMatches = searchStaticCities(inputValue);
              setSuggestions(staticMatches.slice(0, 8));
            }
          }}
          placeholder={placeholder}
          className={className}
        />
        {loading && (
          <div className="absolute right-3 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-2 bg-slate-950 border border-slate-800/80 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-900/60 backdrop-blur-xl">
          {suggestions.map((item, index) => (
            <li
              key={index}
              onClick={() => handleSelectSuggestion(item)}
              className={`flex items-center gap-2.5 px-4 py-3 text-sm text-slate-200 cursor-pointer transition-colors ${
                highlightedIndex === index
                  ? "bg-slate-900/80 text-teal-400 font-medium"
                  : "hover:bg-slate-900/40 hover:text-slate-100"
              }`}
            >
              <MapPin className={`h-3.5 w-3.5 ${highlightedIndex === index ? "text-teal-400" : "text-slate-500"}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

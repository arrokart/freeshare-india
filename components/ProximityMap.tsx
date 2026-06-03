"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icon asset loading issues by using stable CDN resources
const itemIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface ProximityMapProps {
  listings: any[];
  userLocation: { lat: number; lng: number } | null;
}

// Subcomponent to fly the map focus to the user's location when it updates
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function ProximityMap({ listings, userLocation }: ProximityMapProps) {
  // Default map center (e.g. New Delhi, India if no location is detected)
  const defaultCenter: [number, number] = [28.6139, 77.209];
  const activeCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : defaultCenter;

  return (
    <div className="w-full h-[350px] rounded-2xl overflow-hidden border border-gray-800 shadow-xl relative z-10">
      <MapContainer
        center={activeCenter}
        zoom={12}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Modern dark mode map style
        />

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="text-gray-900 font-semibold text-center">
                📍 You are here
              </div>
            </Popup>
          </Marker>
        )}

        {listings.map((item) => {
          let itemLat: number | null = null;
          let itemLng: number | null = null;

          if (item.location) {
            if (item.location.coordinates) {
              itemLng = item.location.coordinates[0];
              itemLat = item.location.coordinates[1];
            } else if (typeof item.location === "string") {
              const match = item.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
              if (match) {
                itemLng = parseFloat(match[1]);
                itemLat = parseFloat(match[2]);
              }
            }
          }

          if (itemLat === null || itemLng === null) return null;

          return (
            <Marker key={item.id} position={[itemLat, itemLng]} icon={itemIcon}>
              <Popup>
                <div className="text-gray-900 max-w-[200px]">
                  {item.images?.[0] && (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="w-full h-24 object-cover rounded-md mb-2"
                    />
                  )}
                  <h4 className="font-bold text-sm leading-tight text-gray-900 truncate">
                    {item.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 capitalize font-medium">
                    {item.category} • {item.condition}
                  </p>
                  {item.distance_km !== undefined && item.distance_km !== null && (
                    <p className="text-xs text-emerald-600 font-bold mt-0.5">
                      {item.distance_km} km away
                    </p>
                  )}
                  <Link
                    href={`/listing/${item.id}`}
                    className="block text-center bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold py-1.5 px-3 rounded-md mt-2 transition-all duration-200"
                  >
                    View Details
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <MapRecenter center={activeCenter} />
      </MapContainer>
    </div>
  );
}

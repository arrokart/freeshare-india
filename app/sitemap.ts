import type { MetadataRoute } from "next";
import { getBrandingServer } from "@/lib/brandingServer";
import { supabase } from "@/lib/supabaseClient";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const branding = await getBrandingServer();
  const domainUrl = branding.appDomain.replace(/\/+$/, "");

  // Static core platform paths
  const staticRoutes = [
    "",
    "/login",
    "/register",
    "/events",
    "/privacy",
    "/terms",
  ].map((route) => ({
    url: `${domainUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.7,
  }));

  // Fetch dynamic listings paths to include in the index
  let dynamicListings: MetadataRoute.Sitemap = [];
  try {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, updated_at")
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(500); // Index the latest 500 active listings for Search Console

    if (listings && listings.length > 0) {
      dynamicListings = listings.map((item) => ({
        url: `${domainUrl}/listing/${item.id}`,
        lastModified: item.updated_at ? new Date(item.updated_at).toISOString() : new Date().toISOString(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch (err) {
    console.error("Failed to query sitemap dynamic paths:", err);
  }

  return [...staticRoutes, ...dynamicListings];
}

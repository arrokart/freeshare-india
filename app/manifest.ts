import type { MetadataRoute } from "next";
import { getBrandingServer } from "@/lib/brandingServer";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getBrandingServer();

  return {
    name: branding.appName,
    short_name: branding.appShortName,
    description: branding.appDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0d9488",
    icons: [
      {
        src: branding.appLogoUrl || "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: branding.appLogoUrl || "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

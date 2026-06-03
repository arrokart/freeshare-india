import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FreeShare India",
    short_name: "FreeShare",
    description: "Share items you no longer need, reduce waste, and help your neighbors.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0d9488",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

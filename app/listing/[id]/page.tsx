import { Metadata } from "next";
import { supabase } from "@/lib/supabaseClient";
import ListingDetailClient from "@/components/ListingDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data: listing } = await supabase
    .from("listings")
    .select("title, description, images, city, area, condition")
    .eq("id", id)
    .maybeSingle();

  if (!listing) {
    return {
      title: "Item Not Found | FreeShare India",
      description: "This item could not be found on FreeShare India.",
    };
  }

  const ogImage = listing.images?.[0] || "/icon-512x512.png";
  const desc = `${listing.condition || "Pre-loved"} item in ${listing.area}, ${listing.city}. ${listing.description}`;

  return {
    title: `${listing.title} | FreeShare India`,
    description: desc,
    openGraph: {
      title: `${listing.title} | FreeShare India`,
      description: desc,
      url: `https://freeshare-india.vercel.app/listing/${id}`,
      siteName: "FreeShare India",
      images: [
        {
          url: ogImage,
          width: 800,
          height: 800,
          alt: listing.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.title} | FreeShare India`,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Pre-fetch listing data server-side
  const { data: listing } = await supabase
    .from("listings")
    .select(`
      *,
      donor:donor_id(id, name, trust_score, avatar_url, is_ngo, is_verified)
    `)
    .eq("id", id)
    .maybeSingle();

  return <ListingDetailClient initialListing={listing} />;
}

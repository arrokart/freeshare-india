import { Metadata } from "next";
import { supabase } from "@/lib/supabaseClient";
import ListingDetailClient from "@/components/ListingDetailClient";
import { getBrandingServer } from "@/lib/brandingServer";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [listingRes, branding] = await Promise.all([
    supabase.from("listings").select("title, description, images, city, area, condition").eq("id", id).maybeSingle(),
    getBrandingServer()
  ]);

  const { data: listing } = listingRes;

  if (!listing) {
    return {
      title: `Item Not Found | ${branding.appName}`,
      description: `This item could not be found on ${branding.appName}.`,
    };
  }

  const ogImage = listing.images?.[0] || branding.brandLogoUrl || branding.appLogoUrl;
  const desc = `${listing.condition || "Pre-loved"} item in ${listing.area}, ${listing.city}. ${listing.description}`;

  const domainUrl = branding.appDomain.replace(/\/+$/, "");
  const canonicalUrl = `${domainUrl}/listing/${id}`;

  return {
    title: `${listing.title} | ${branding.appName}`,
    description: desc,
    openGraph: {
      title: `${listing.title} | ${branding.appName}`,
      description: desc,
      url: canonicalUrl,
      siteName: branding.appName,
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
      title: `${listing.title} | ${branding.appName}`,
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

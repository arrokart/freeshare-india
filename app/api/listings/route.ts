import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Helper function to calculate great-circle distance (Haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// GET listings with search and filter queries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const condition = searchParams.get("condition");
    const search = searchParams.get("search");
    const latParam = searchParams.get("latitude");
    const lngParam = searchParams.get("longitude");
    const radiusParam = searchParams.get("radius"); // in km
    const sortBy = searchParams.get("sort_by");
    const city = searchParams.get("city");
    const pincode = searchParams.get("pincode");
    const listingType = searchParams.get("listing_type"); // 'item' | 'skill' | null (all)

    let query = supabase
      .from("listings")
      .select(`
        *,
        donor:donor_id(id, name, trust_score, avatar_url)
      `)
      .in("status", ["available", "reserved", "completed"]);

    // Sorting logic
    if (sortBy === "trending") {
      query = query.order("view_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // Listing type filter (items vs skills)
    if (listingType && listingType !== "all") {
      query = query.eq("listing_type", listingType);
    }

    // Category filter
    if (category && category !== "All") {
      query = query.eq("category", category);
    }

    // Condition filter
    if (condition && condition !== "All") {
      query = query.eq("condition", condition);
    }

    // City filter
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    // Pincode filter
    if (pincode) {
      query = query.eq("pincode", pincode);
    }

    // Search query filter — matches title, description, and skill tags
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,skill_tags.cs.{${search}}`);
    }

    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    // Only apply database-level limit if we are not paginating on coordinates
    if (limitParam && !pageParam && !(latParam && lngParam && radiusParam)) {
      query = query.limit(parseInt(limitParam));
    }

    const { data, error } = await query;

    if (error) throw error;

    let listings = data || [];

    // Filter by proximity if coordinates are provided
    if (latParam && lngParam && radiusParam) {
      const userLat = parseFloat(latParam);
      const userLng = parseFloat(lngParam);
      const radiusKm = parseFloat(radiusParam);

      if (!isNaN(userLat) && !isNaN(userLng) && !isNaN(radiusKm)) {
        listings = listings
          .map((item: any) => {
            let itemLat: number | null = null;
            let itemLng: number | null = null;

            // Extract lat/lng from PostGIS location object
            if (item.location) {
              if (item.location.coordinates) {
                // PostGIS Point GeoJSON stores coordinates as [longitude, latitude]
                itemLng = item.location.coordinates[0];
                itemLat = item.location.coordinates[1];
              } else if (typeof item.location === "string") {
                // Handle string representation if returned as WKT (e.g., POINT(lng lat))
                const match = item.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
                if (match) {
                  itemLng = parseFloat(match[1]);
                  itemLat = parseFloat(match[2]);
                }
              }
            }

            if (itemLat !== null && itemLng !== null) {
              const distance = getDistance(userLat, userLng, itemLat, itemLng);
              return { ...item, distance_km: parseFloat(distance.toFixed(2)) };
            }
            return { ...item, distance_km: null };
          })
          // Keep items within the radius
          .filter((item: any) => item.distance_km !== null && item.distance_km <= radiusKm)
          // Sort closest first (only if we filter by radius proximity, otherwise preserve default order)
          .sort((a: any, b: any) => (a.distance_km || 0) - (b.distance_km || 0));
      }
    }

    // Apply pagination slicing
    let hasMore = false;
    if (pageParam || limitParam) {
      const page = parseInt(pageParam || "1");
      const limit = parseInt(limitParam || "12");
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      hasMore = endIndex < listings.length;
      listings = listings.slice(startIndex, endIndex);
    }

    return NextResponse.json({ listings, hasMore });
  } catch (error: any) {
    console.error("Fetch listings error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

// POST create a new listing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      donor_id,
      title,
      description,
      category,
      condition,
      images,
      city,
      area,
      landmark,
      pincode,
      receiver_preference,
      latitude,
      longitude,
      listing_type,
      skill_duration,
      skill_tags,
      max_bookings_per_user,
    } = body;

    const isSkill = listing_type === "skill";

    // Validate parameters — images optional for skills
    if (!donor_id || !title || !description || !category) {
      return NextResponse.json(
        { error: "Missing required listing parameters" },
        { status: 400 }
      );
    }
    if (!isSkill && (!condition || !images || !images.length)) {
      return NextResponse.json(
        { error: "Item listings require condition and at least one image" },
        { status: 400 }
      );
    }

    // Format location coordinates if provided
    let locationData: any = null;
    if (latitude && longitude) {
      locationData = `POINT(${parseFloat(longitude)} ${parseFloat(latitude)})`;
    }

    const { data, error } = await supabaseAdmin
      .from("listings")
      .insert({
        donor_id,
        title,
        description,
        category,
        condition: isSkill ? null : condition,
        images: images || [],
        city,
        area,
        landmark,
        pincode,
        location: locationData,
        receiver_preference: receiver_preference || "all",
        status: "available",
        listing_type: listing_type || "item",
        skill_duration: isSkill ? (skill_duration || null) : null,
        skill_tags: isSkill ? (skill_tags || []) : [],
        max_bookings_per_user: isSkill ? (max_bookings_per_user ?? 2) : null,
      })
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null, { status: 201 });
  } catch (error: any) {
    console.error("Create listing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create listing" },
      { status: 500 }
    );
  }
}

// PUT update an existing listing
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      donor_id,
      title,
      description,
      category,
      condition,
      images,
      city,
      area,
      landmark,
      pincode,
      receiver_preference,
      latitude,
      longitude,
      listing_type,
      skill_duration,
      skill_tags,
      max_bookings_per_user,
    } = body;

    const isSkill = listing_type === "skill";

    // Validate parameters
    if (!id || !donor_id || !title || !description || !category) {
      return NextResponse.json(
        { error: "Missing required listing parameters" },
        { status: 400 }
      );
    }
    if (!isSkill && (!condition || !images || !images.length)) {
      return NextResponse.json(
        { error: "Item listings require condition and at least one image" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingListing, error: checkError } = await supabase
      .from("listings")
      .select("donor_id")
      .eq("id", id)
      .single();

    if (checkError || !existingListing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    if (existingListing.donor_id !== donor_id) {
      return NextResponse.json(
        { error: "Unauthorized: Only the donor can edit this listing" },
        { status: 403 }
      );
    }

    // Format location coordinates if provided
    let locationData: any = null;
    if (latitude && longitude) {
      locationData = `POINT(${parseFloat(longitude)} ${parseFloat(latitude)})`;
    }

    const { data, error } = await supabaseAdmin
      .from("listings")
      .update({
        title,
        description,
        category,
        condition: isSkill ? null : condition,
        images: images || [],
        city,
        area,
        landmark,
        pincode,
        location: locationData,
        receiver_preference: receiver_preference || "all",
        listing_type: listing_type || "item",
        skill_duration: isSkill ? (skill_duration || null) : null,
        skill_tags: isSkill ? (skill_tags || []) : [],
        max_bookings_per_user: isSkill ? (max_bookings_per_user ?? 2) : null,
        is_flagged: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null, { status: 200 });
  } catch (error: any) {
    console.error("Update listing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update listing" },
      { status: 500 }
    );
  }
}


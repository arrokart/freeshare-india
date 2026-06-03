import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(request: Request) {
  try {
    const { id, userId } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Listing ID is required" }, { status: 400 });
    }

    // 1. Fetch current view_count and donor_id
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from("listings")
      .select("view_count, donor_id")
      .eq("id", id)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 444 });
    }

    // 2. Increment view count only if viewer is not the donor
    if (!userId || listing.donor_id !== userId) {
      const currentCount = listing.view_count || 0;
      const { error: updateError } = await supabaseAdmin
        .from("listings")
        .update({ view_count: currentCount + 1 })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, new_count: currentCount + 1 });
    }

    return NextResponse.json({ success: true, new_count: listing.view_count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

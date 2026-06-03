import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    // Verify secure cron key if configured
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // 1. Find all accepted claims that have expired
    const { data: expiredClaims, error: fetchErr } = await supabase
      .from("claims")
      .select("id, listing_id, receiver_id")
      .eq("status", "accepted")
      .lt("expires_at", now);

    if (fetchErr) throw fetchErr;

    if (!expiredClaims || expiredClaims.length === 0) {
      return NextResponse.json({ message: "No expired claims found to release." });
    }

    const releasedIds: string[] = [];

    // 2. Loop through and release them
    for (const claim of expiredClaims) {
      // Set claim status to expired
      await supabase
        .from("claims")
        .update({ status: "expired" })
        .eq("id", claim.id);

      // Set listing status back to available
      await supabase
        .from("listings")
        .update({
          status: "available",
          active_claim_id: null,
        })
        .eq("id", claim.listing_id);

      // Increment strike count on flaky receiver's account profile
      const { data: userProfile } = await supabase
        .from("users")
        .select("strike_count")
        .eq("id", claim.receiver_id)
        .single();
      
      const currentStrikes = userProfile?.strike_count || 0;
      await supabase
        .from("users")
        .update({ strike_count: currentStrikes + 1 })
        .eq("id", claim.receiver_id);

      releasedIds.push(claim.id);
    }

    return NextResponse.json({
      message: `Successfully released ${releasedIds.length} expired claims.`,
      released_claims: releasedIds,
    });
  } catch (error: any) {
    console.error("Cron Release claims error:", error);
    return NextResponse.json(
      { error: error.message || "Cron operation failed" },
      { status: 500 }
    );
  }
}

// Support GET requests as well for easy testing/webhook calls
export async function GET(request: Request) {
  return POST(request);
}

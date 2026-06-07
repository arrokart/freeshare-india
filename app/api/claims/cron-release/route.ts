import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

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

    const releasedIds: string[] = [];

    // 2. Loop through and release expired accepted claims
    if (expiredClaims && expiredClaims.length > 0) {
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
    }

    // 3. Find all pending claims that are older than 48 hours (inactive hosts)
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    const { data: expiredPendingClaims, error: pendingFetchErr } = await supabase
      .from("claims")
      .select("id, listing_id, receiver_id, listing:listing_id(title)")
      .eq("status", "pending")
      .lt("created_at", fortyEightHoursAgo.toISOString());

    if (pendingFetchErr) throw pendingFetchErr;

    const expiredPendingIds: string[] = [];

    // 4. Loop through and expire pending claims
    if (expiredPendingClaims && expiredPendingClaims.length > 0) {
      for (const claim of expiredPendingClaims) {
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

        // Notify the receiver that their pending claim has expired due to host inactivity
        const listingTitle = (claim.listing as any)?.title || "Item";
        await supabase.from("notifications").insert({
          user_id: claim.receiver_id,
          type: "listing_removed",
          title: "Request Expired",
          body: `Your request for "${listingTitle}" expired due to host inactivity.`,
          link: "/",
        });

        expiredPendingIds.push(claim.id);
      }
    }

    return NextResponse.json({
      message: `Processed expired claims.`,
      released_accepted_claims: releasedIds,
      expired_pending_claims: expiredPendingIds,
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

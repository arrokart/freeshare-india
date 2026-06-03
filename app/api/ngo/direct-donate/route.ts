import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { listingId, ngoId, donorId, message } = await request.json();

    if (!listingId || !ngoId || !donorId) {
      return NextResponse.json({ error: "Missing required donation parameters." }, { status: 400 });
    }

    // 1. Fetch listing to verify ownership and availability
    const { data: listing, error: listingErr } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingErr || !listing) {
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    if (listing.donor_id !== donorId) {
      return NextResponse.json({ error: "Access Denied: You do not own this listing." }, { status: 403 });
    }

    if (listing.status !== "available") {
      return NextResponse.json({ error: "Listing is not available for donation." }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // 2. Insert new claim pre-approved
    const { data: newClaim, error: claimErr } = await supabase
      .from("claims")
      .insert({
        listing_id: listingId,
        receiver_id: ngoId,
        donor_id: donorId,
        message: message || "Direct Donation to NGO",
        status: "accepted",
        accepted_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (claimErr || !newClaim) {
      console.error("Direct claim insertion failed:", claimErr);
      throw new Error(claimErr?.message || "Failed to create donation claim.");
    }

    // 3. Reserve the listing and link active claim
    const { error: listingUpdateErr } = await supabase
      .from("listings")
      .update({
        status: "reserved",
        active_claim_id: newClaim.id
      })
      .eq("id", listingId);

    if (listingUpdateErr) throw listingUpdateErr;

    // 4. Decline other pending claims on this listing
    const { error: declineErr } = await supabase
      .from("claims")
      .update({ status: "declined" })
      .eq("listing_id", listingId)
      .eq("status", "pending")
      .neq("id", newClaim.id);

    if (declineErr) throw declineErr;

    // 5. Send notification to the NGO
    await supabase.from("notifications").insert({
      user_id: ngoId,
      type: "claim_accepted",
      title: "Direct Donation Received!",
      body: `A donor offered "${listing.title}" directly to your organization. Open chat to arrange pickup.`,
      link: `/chat/${newClaim.id}`
    });

    return NextResponse.json({ success: true, claimId: newClaim.id });
  } catch (error: any) {
    console.error("Direct NGO Donation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to complete direct donation" }, { status: 500 });
  }
}

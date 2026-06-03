import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendPushNotification } from "@/lib/push";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body; // accepted, declined, completed, cancelled

    if (!id || !status) {
      return NextResponse.json(
        { error: "Missing required claim parameters" },
        { status: 400 }
      );
    }

    // Fetch the claim details
    const { data: claim, error: claimFetchError } = await supabase
      .from("claims")
      .select("*, listing:listing_id(*)")
      .eq("id", id)
      .single();

    if (claimFetchError || !claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const now = new Date();

    if (status === "accepted") {
      // 1. Calculate 48-hour pickup deadline
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // 2. Set claim status to accepted
      const { error: claimUpdateErr } = await supabase
        .from("claims")
        .update({
          status: "accepted",
          accepted_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", id);

      if (claimUpdateErr) throw claimUpdateErr;

      // 3. Set listing status to reserved and point to active claim ID
      const { error: listingUpdateErr } = await supabase
        .from("listings")
        .update({
          status: "reserved",
          active_claim_id: id,
        })
        .eq("id", claim.listing_id);

      if (listingUpdateErr) throw listingUpdateErr;

      // 4. Decline other pending claims on this listing automatically
      const { error: bulkDeclineErr } = await supabase
        .from("claims")
        .update({ status: "declined" })
        .eq("listing_id", claim.listing_id)
        .eq("status", "pending")
        .neq("id", id);

      if (bulkDeclineErr) throw bulkDeclineErr;

      // 5. Notify the receiver that their claim was accepted
      await supabase.from("notifications").insert({
        user_id: claim.receiver_id,
        type: "claim_accepted",
        title: "Claim Request Accepted!",
        body: `Your request for "${claim.listing.title}" has been accepted! Open chat to coordinate pickup.`,
        link: `/chat/${id}`,
      });

      // Broadcast active mobile push notification
      await sendPushNotification(
        claim.receiver_id,
        "Claim Request Accepted!",
        `Your request for "${claim.listing.title}" has been accepted! Open chat to coordinate pickup.`,
        `/chat/${id}`
      );

      return NextResponse.json({ message: "Claim accepted and listing reserved successfully." });
    }

    if (status === "declined") {
      const { error } = await supabase
        .from("claims")
        .update({ status: "declined" })
        .eq("id", id);

      if (error) throw error;

      // Notify the receiver that their claim was declined
      await supabase.from("notifications").insert({
        user_id: claim.receiver_id,
        type: "listing_removed",
        title: "Claim Request Update",
        body: `Your claim request for "${claim.listing.title}" was not accepted. Keep browsing!`,
        link: "/",
      });

      // Broadcast active mobile push notification
      await sendPushNotification(
        claim.receiver_id,
        "Claim Request Update",
        `Your claim request for "${claim.listing.title}" was not accepted. Keep browsing!`,
        "/"
      );

      return NextResponse.json({ message: "Claim declined." });
    }

    if (status === "completed") {
      // 1. Set claim status to completed
      const { error: claimErr } = await supabase
        .from("claims")
        .update({ status: "completed" })
        .eq("id", id);

      if (claimErr) throw claimErr;

      // 2. Set listing status to completed
      const { error: listingErr } = await supabase
        .from("listings")
        .update({
          status: "completed",
          completed_at: now.toISOString(),
        })
        .eq("id", claim.listing_id);

      if (listingErr) throw listingErr;

      // 3. Increment counters on users profiles (donor total_donated, receiver total_received)
      await supabase.rpc("increment_donation_counters", {
        donor_uuid: claim.donor_id,
        receiver_uuid: claim.receiver_id,
      });

      return NextResponse.json({ message: "Transaction completed." });
    }

    if (status === "cancelled") {
      // 1. Reset claim status to cancelled
      const { error: claimErr } = await supabase
        .from("claims")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (claimErr) throw claimErr;

      // 2. Set listing status back to available and clear active claim id
      const { error: listingErr } = await supabase
        .from("listings")
        .update({
          status: "available",
          active_claim_id: null,
        })
        .eq("id", claim.listing_id);

      if (listingErr) throw listingErr;

      return NextResponse.json({ message: "Claim cancelled. Listing is now available again." });
    }

    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  } catch (error: any) {
    console.error("Claim Action Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update claim" },
      { status: 500 }
    );
  }
}

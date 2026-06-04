import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
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
    const isSkill = claim.listing?.listing_type === "skill";

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

      if (!isSkill) {
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
      }

      // 5. Notify the receiver that their claim was accepted
      await supabase.from("notifications").insert({
        user_id: claim.receiver_id,
        type: "claim_accepted",
        title: isSkill ? "Session Request Accepted!" : "Claim Request Accepted!",
        body: isSkill
          ? `Your session request for "${claim.listing.title}" has been accepted! Open chat to coordinate.`
          : `Your request for "${claim.listing.title}" has been accepted! Open chat to coordinate pickup.`,
        link: `/chat/${id}`,
      });

      // Broadcast active mobile push notification
      await sendPushNotification(
        claim.receiver_id,
        isSkill ? "Session Request Accepted!" : "Claim Request Accepted!",
        isSkill
          ? `Your session request for "${claim.listing.title}" has been accepted! Open chat to coordinate.`
          : `Your request for "${claim.listing.title}" has been accepted! Open chat to coordinate pickup.`,
        `/chat/${id}`
      );

      return NextResponse.json({ message: isSkill ? "Session request accepted." : "Claim accepted and listing reserved successfully." });
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
        title: isSkill ? "Session Request Update" : "Claim Request Update",
        body: isSkill
          ? `Your session request for "${claim.listing.title}" was not accepted.`
          : `Your claim request for "${claim.listing.title}" was not accepted. Keep browsing!`,
        link: "/",
      });

      // Broadcast active mobile push notification
      await sendPushNotification(
        claim.receiver_id,
        isSkill ? "Session Request Update" : "Claim Request Update",
        isSkill
          ? `Your session request for "${claim.listing.title}" was not accepted.`
          : `Your claim request for "${claim.listing.title}" was not accepted. Keep browsing!`,
        "/"
      );

      return NextResponse.json({ message: "Request declined." });
    }

    if (status === "completed") {
      // 1. Set claim status to completed
      const { error: claimErr } = await supabase
        .from("claims")
        .update({ status: "completed" })
        .eq("id", id);

      if (claimErr) throw claimErr;

      if (!isSkill) {
        // 2. Set listing status to completed
        const { error: listingErr } = await supabase
          .from("listings")
          .update({
            status: "completed",
            completed_at: now.toISOString(),
          })
          .eq("id", claim.listing_id);

        if (listingErr) throw listingErr;
      }

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

      if (!isSkill) {
        // 2. Set listing status back to available and clear active claim id
        const { error: listingErr } = await supabase
          .from("listings")
          .update({
            status: "available",
            active_claim_id: null,
          })
          .eq("id", claim.listing_id);

        if (listingErr) throw listingErr;
      }

      // 3. Notify the donor that the receiver cancelled
      try {
        const { data: receiverProfile } = await supabase
          .from("users")
          .select("name")
          .eq("id", claim.receiver_id)
          .single();
        const receiverName = receiverProfile?.name || "Someone";

        await supabase.from("notifications").insert({
          user_id: claim.donor_id,
          type: "listing_removed",
          title: "Request Cancelled",
          body: `${receiverName} has cancelled their request for "${claim.listing.title}".`,
          link: "/",
        });

        await sendPushNotification(
          claim.donor_id,
          "Request Cancelled",
          `${receiverName} has cancelled their request for "${claim.listing.title}".`,
          "/"
        );
      } catch (notifErr) {
        console.error("Failed to notify donor on cancellation:", notifErr);
      }

      return NextResponse.json({ message: "Request cancelled." });
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

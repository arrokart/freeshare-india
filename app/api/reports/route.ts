import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reporterId, reportedUserId, reportedListingId, reason, description } = body;

    // Validation
    if (!reporterId || !reason || !description) {
      return NextResponse.json({ error: "Missing required report parameters" }, { status: 400 });
    }

    if (description.trim().length < 15) {
      return NextResponse.json({ error: "Please provide a detailed description (minimum 15 characters)" }, { status: 400 });
    }

    const validReasons = ['fake_listing', 'spam', 'abuse', 'inappropriate', 'commercial_reselling', 'other'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Invalid report reason category" }, { status: 400 });
    }

    // A user cannot report themselves
    if (reportedUserId && reporterId === reportedUserId) {
      return NextResponse.json({ error: "You cannot report your own profile." }, { status: 400 });
    }

    // Save report to database
    const { error: dbError } = await supabase
      .from("reports")
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId || null,
        reported_listing_id: reportedListingId || null,
        reason,
        description: description.trim(),
        status: "pending"
      });

    if (dbError) throw dbError;

    // Handle warning and moderation logic if a listing was reported
    if (reportedListingId) {
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("donor_id, title")
        .eq("id", reportedListingId)
        .single();

      if (!listingError && listing) {
        const isSevere = ['abuse', 'inappropriate', 'fake_listing'].includes(reason);
        if (isSevere) {
          // Severe: Hide immediately by setting status to 'removed' and admin_removed to true
          await supabase
            .from("listings")
            .update({ status: "removed", admin_removed: true })
            .eq("id", reportedListingId);

          // Notify the donor
          await supabase.from("notifications").insert({
            user_id: listing.donor_id,
            type: "listing_suspended",
            title: "Listing Suspended",
            body: `⛔ Suspension: Your listing "${listing.title}" has been hidden due to reports of inappropriate content. Please contact support if you believe this is a mistake.`,
            link: "/dashboard"
          });
        } else {
          // Mild: Flag and trigger 24h warning
          await supabase
            .from("listings")
            .update({ is_flagged: true })
            .eq("id", reportedListingId);

          // Notify the donor
          await supabase.from("notifications").insert({
            user_id: listing.donor_id,
            type: "listing_flagged",
            title: "Listing Warning",
            body: `⚠️ Warning: Your listing "${listing.title}" has been flagged for commercial reselling/spam/guidelines. Please edit your listing within 24 hours to comply with guidelines or it will be removed.`,
            link: "/dashboard"
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Report submitted successfully. Administrators have been notified." });
  } catch (err: any) {
    console.error("Report submit API error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit report." }, { status: 500 });
  }
}


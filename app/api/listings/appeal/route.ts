import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { listingId, explanation, userId } = body;

    // Validation
    if (!listingId || !explanation || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (explanation.trim().length < 15) {
      return NextResponse.json({ error: "Please provide a detailed explanation (minimum 15 characters)" }, { status: 400 });
    }

    // 1. Verify ownership of the listing
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("donor_id, title")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.donor_id !== userId) {
      return NextResponse.json({ error: "Unauthorized to appeal this listing" }, { status: 403 });
    }

    // 2. Fetch owner's trust score
    const { data: ownerProfile, error: profileError } = await supabase
      .from("users")
      .select("trust_score")
      .eq("id", userId)
      .single();

    if (profileError || !ownerProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const trustScore = ownerProfile.trust_score !== null ? parseFloat(ownerProfile.trust_score) : 5.0;
    const isHighTrust = trustScore >= 4.5;

    if (isHighTrust) {
      // Restore listing instantly
      const { error: updateError } = await supabase
        .from("listings")
        .update({
          status: "available",
          admin_removed: false,
          is_flagged: false,
          updated_at: new Date().toISOString()
        })
        .eq("id", listingId);

      if (updateError) throw updateError;

      // Log/insert appeal in reports table as resolved/approved
      const { error: reportError } = await supabase
        .from("reports")
        .insert({
          reporter_id: userId,
          reported_user_id: userId,
          reported_listing_id: listingId,
          reason: "other",
          description: `[APPEAL] [AUTO-RESTORED | Trust: ${trustScore}] ${explanation.trim()}`,
          status: "resolved"
        });

      if (reportError) console.error("Error creating appeal log:", reportError);

      return NextResponse.json({
        success: true,
        restored: true,
        message: `Listing restored instantly based on your high trust score (★ ${trustScore.toFixed(1)})! Administrators will verify your explanation.`
      });
    } else {
      // Keep hidden, submit manual appeal
      const { error: reportError } = await supabase
        .from("reports")
        .insert({
          reporter_id: userId,
          reported_user_id: userId,
          reported_listing_id: listingId,
          reason: "other",
          description: `[APPEAL] [PENDING REVIEW | Trust: ${trustScore}] ${explanation.trim()}`,
          status: "pending"
        });

      if (reportError) throw reportError;

      return NextResponse.json({
        success: true,
        restored: false,
        message: `Appeal submitted successfully. Since your trust score is ★ ${trustScore.toFixed(1)}, your listing will remain hidden until an administrator reviews and approves it.`
      });
    }
  } catch (err: any) {
    console.error("Listing appeal error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit appeal" }, { status: 500 });
  }
}

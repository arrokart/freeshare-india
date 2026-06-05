import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { explanation, userId } = body;

    // Validation
    if (!explanation || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (explanation.trim().length < 15) {
      return NextResponse.json({ error: "Please provide a detailed explanation (minimum 15 characters)" }, { status: 400 });
    }

    // Fetch user details to log their current standing in the appeal description
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("trust_score, can_create_events")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const trustScore = userProfile.trust_score !== null ? parseFloat(userProfile.trust_score) : 5.0;

    // Insert user appeal in reports table for admin moderation review
    const { error: reportError } = await supabase
      .from("reports")
      .insert({
        reporter_id: userId,
        reported_user_id: userId,
        reported_listing_id: null,
        reported_event_id: null,
        reason: "other",
        description: `[EVENT_APPEAL] [PENDING REVIEW | Trust: ${trustScore.toFixed(2)}] ${explanation.trim()}`,
        status: "pending"
      });

    if (reportError) throw reportError;

    return NextResponse.json({
      success: true,
      message: "Your appeal has been submitted successfully. An administrator will review your account history shortly."
    });
  } catch (err: any) {
    console.error("Event appeal error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit appeal" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { claim_id, reviewer_id, reviewed_id, rating, comment, role } = body;

    if (!claim_id || !reviewer_id || !reviewed_id || !rating || !role) {
      return NextResponse.json(
        { error: "Missing required review parameters" },
        { status: 400 }
      );
    }

    // 1. Insert review into public.reviews table
    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .insert({
        claim_id,
        reviewer_id,
        reviewed_id,
        rating,
        comment,
        role,
      })
      .select()
      .single();

    if (reviewErr) {
      if (reviewErr.message.includes("unique_claim_reviewer")) {
        return NextResponse.json(
          { error: "You have already submitted a review for this transaction." },
          { status: 400 }
        );
      }
      throw reviewErr;
    }

    // 2. Fetch all reviews for the reviewed user to calculate new average
    const { data: allReviews, error: fetchReviewsErr } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewed_id", reviewed_id);

    if (fetchReviewsErr) throw fetchReviewsErr;

    if (allReviews && allReviews.length > 0) {
      const sum = allReviews.reduce((acc, curr) => acc + curr.rating, 0);
      const averageScore = parseFloat((sum / allReviews.length).toFixed(2));

      // 3. Update the trust_score on public.users table
      const { error: userUpdateErr } = await supabase
        .from("users")
        .update({ trust_score: averageScore })
        .eq("id", reviewed_id);

      if (userUpdateErr) throw userUpdateErr;
    }

    return NextResponse.json(review, { status: 201 });
  } catch (error: any) {
    console.error("Submit review error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit review" },
      { status: 500 }
    );
  }
}

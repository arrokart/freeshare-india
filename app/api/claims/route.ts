import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    // 1. Extract and validate the user's JWT from the Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.substring(7);

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { listing_id, receiver_id, donor_id, message } = body;

    // 3. Security: receiver_id must match the authenticated user
    if (receiver_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: receiver_id must match authenticated user" },
        { status: 403 }
      );
    }

    // 4. Validate required fields
    if (!listing_id || !receiver_id || !donor_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields: listing_id, receiver_id, donor_id, message" },
        { status: 400 }
      );
    }

    // 5. Validate message length
    if (message.length < 50 || message.length > 300) {
      return NextResponse.json(
        { error: "Message must be between 50 and 300 characters." },
        { status: 400 }
      );
    }

    // 6. Insert claim using service role (bypasses RLS — user already validated above)
    const { data: newClaim, error: claimError } = await supabaseAdmin
      .from("claims")
      .insert({
        listing_id,
        receiver_id,
        donor_id,
        message,
        status: "pending",
      })
      .select()
      .single();

    if (claimError) {
      if (claimError.message.includes("Claim limit reached")) {
        return NextResponse.json(
          {
            error:
              "You cannot have more than 5 active pending claims simultaneously. Please cancel one of your other pending claims first.",
          },
          { status: 400 }
        );
      }
      throw claimError;
    }

    return NextResponse.json(newClaim, { status: 201 });
  } catch (error: any) {
    console.error("Claims POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create claim" },
      { status: 500 }
    );
  }
}

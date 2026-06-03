import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return NextResponse.json({ error: "Missing required subscription parameters." }, { status: 400 });
    }

    // 1. Fetch current profile from Supabase
    const { data: userProfile, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", userId)
      .single();

    if (fetchErr || !userProfile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    // 2. Parse existing JSON structure or initialize a fresh one
    let parsedBio: any = {};
    try {
      parsedBio = JSON.parse(userProfile.bio || "{}");
      // If bio was just a normal string rather than serialized JSON object:
      if (typeof parsedBio !== "object" || parsedBio === null || Array.isArray(parsedBio)) {
        parsedBio = {
          user_description: userProfile.bio || ""
        };
      }
    } catch {
      // Bio was standard text string
      parsedBio = {
        user_description: userProfile.bio || ""
      };
    }

    // 3. Initialize push subscriptions array
    if (!Array.isArray(parsedBio.push_subscriptions)) {
      parsedBio.push_subscriptions = [];
    }

    // 4. Check for duplicates
    const alreadyExists = parsedBio.push_subscriptions.some(
      (sub: any) => sub.endpoint === subscription.endpoint
    );

    if (!alreadyExists) {
      parsedBio.push_subscriptions.push(subscription);
    }

    // 5. Save serialized structure back to users table
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        bio: JSON.stringify(parsedBio)
      })
      .eq("id", userId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, message: "Push subscription synced successfully." });
  } catch (error: any) {
    console.error("Notifications Subscription Error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync push subscription" }, { status: 500 });
  }
}

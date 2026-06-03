import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { referrerId, referrerCode, newUserId } = await request.json();

    if (!newUserId) {
      return NextResponse.json({ error: "Missing required newUserId parameter." }, { status: 400 });
    }

    let finalReferrerId = referrerId;

    // 1. Resolve referrerId from code if provided
    if (!finalReferrerId && referrerCode) {
      const cleanCode = referrerCode.trim().toUpperCase();
      if (cleanCode.startsWith("REF-")) {
        const prefix = cleanCode.substring(4).toLowerCase();
        
        // Query users whose ID starts with the prefix
        const { data: matchedUsers, error: matchErr } = await supabase
          .from("users")
          .select("id")
          .filter("id", "like", `${prefix}%`);

        if (!matchErr && matchedUsers && matchedUsers.length > 0) {
          finalReferrerId = matchedUsers[0].id;
        }
      }
    }

    if (!finalReferrerId) {
      return NextResponse.json({ error: "Referrer not found." }, { status: 404 });
    }

    // Prevent referring oneself
    if (finalReferrerId === newUserId) {
      return NextResponse.json({ error: "Cannot refer yourself." }, { status: 400 });
    }

    // 2. Fetch referrer's current bio
    const { data: referrer, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", finalReferrerId)
      .single();

    if (fetchErr || !referrer) {
      return NextResponse.json({ error: "Referrer profile not found." }, { status: 404 });
    }

    // Parse referrer bio JSON
    let referrerBio: any = {};
    try {
      referrerBio = JSON.parse(referrer.bio || "{}");
      if (typeof referrerBio !== "object" || referrerBio === null || Array.isArray(referrerBio)) {
        referrerBio = { user_description: referrer.bio || "" };
      }
    } catch {
      referrerBio = { user_description: referrer.bio || "" };
    }

    if (!Array.isArray(referrerBio.referred_users)) {
      referrerBio.referred_users = [];
    }

    // 3. Prevent double conversion check
    if (!referrerBio.referred_users.includes(newUserId)) {
      referrerBio.referred_users.push(newUserId);

      // Fetch global claim limit
      let defaultLimit = 10;
      try {
        const { data: admins } = await supabase
          .from("users")
          .select("bio")
          .eq("is_admin", true);
        if (admins && admins.length > 0) {
          const adminBio = JSON.parse(admins[0].bio || "{}");
          if (adminBio && adminBio.monthly_claim_limit) {
            defaultLimit = adminBio.monthly_claim_limit;
          }
        }
      } catch (e) {
        console.error("Failed to load global limit settings:", e);
      }

      // Referrer gets +2 claims
      const currentReferrerLimit = typeof referrerBio.custom_claim_limit === "number" ? referrerBio.custom_claim_limit : defaultLimit;
      referrerBio.custom_claim_limit = currentReferrerLimit + 2;

      // Save referrer updates
      const { error: updateRefErr } = await supabase
        .from("users")
        .update({ bio: JSON.stringify(referrerBio) })
        .eq("id", finalReferrerId);

      if (updateRefErr) throw updateRefErr;

      // 4. Invitee gets +1 claim reward
      const { data: invitee, error: fetchInviteeErr } = await supabase
        .from("users")
        .select("bio")
        .eq("id", newUserId)
        .single();

      if (!fetchInviteeErr && invitee) {
        let inviteeBio: any = {};
        try {
          inviteeBio = JSON.parse(invitee.bio || "{}");
          if (typeof inviteeBio !== "object" || inviteeBio === null || Array.isArray(inviteeBio)) {
            inviteeBio = { user_description: invitee.bio || "" };
          }
        } catch {
          inviteeBio = { user_description: invitee.bio || "" };
        }

        inviteeBio.referred_by = finalReferrerId;
        const currentInviteeLimit = typeof inviteeBio.custom_claim_limit === "number" ? inviteeBio.custom_claim_limit : defaultLimit;
        inviteeBio.custom_claim_limit = currentInviteeLimit + 1;

        await supabase
          .from("users")
          .update({ bio: JSON.stringify(inviteeBio) })
          .eq("id", newUserId);
      }
    }

    return NextResponse.json({ success: true, message: "Double-sided referral successfully processed." });
  } catch (error: any) {
    console.error("Referral API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process referral" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { userId, org_name, darpan_id, registration_number, document_url, user_description } = await request.json();

    if (!userId || !org_name || !registration_number || !document_url) {
      return NextResponse.json({ error: "Missing required NGO registration fields." }, { status: 400 });
    }

    // 1. Fetch current profile to preserve details
    const { data: userProfile, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", userId)
      .single();

    if (fetchErr || !userProfile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    // 2. Assemble application structure
    const ngoDetails = {
      is_ngo_application: true,
      org_name,
      darpan_id: darpan_id || "",
      registration_number,
      document_url,
      status: "pending",
      user_description: user_description || userProfile.bio || "",
      submitted_at: new Date().toISOString()
    };

    // 3. Update bio field and reset is_ngo to false (until approved)
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        bio: JSON.stringify(ngoDetails),
        is_ngo: false
      })
      .eq("id", userId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, message: "NGO application submitted successfully." });
  } catch (err: any) {
    console.error("NGO Apply Error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit NGO application" }, { status: 500 });
  }
}

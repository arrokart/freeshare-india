import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// Helper to verify if user is admin
async function verifyAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.is_admin === true;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");
    const search = searchParams.get("search");

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      users: users || [],
      totalCount: count || 0
    });
  } catch (error: any) {
    console.error("Admin fetch users error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, targetUserId, action, custom_claim_limit } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    if (!targetUserId || action !== "set_limit") {
      return NextResponse.json({ error: "Invalid action or missing parameters." }, { status: 400 });
    }

    // 1. Fetch target user bio
    const { data: userProfile, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", targetUserId)
      .single();

    if (fetchErr || !userProfile) {
      return NextResponse.json({ error: "Target user not found." }, { status: 404 });
    }

    let parsedBio: any = {};
    try {
      parsedBio = JSON.parse(userProfile.bio || "{}");
      if (typeof parsedBio !== "object" || parsedBio === null || Array.isArray(parsedBio)) {
        parsedBio = { user_description: userProfile.bio || "" };
      }
    } catch {
      parsedBio = { user_description: userProfile.bio || "" };
    }

    // 2. Set or clear custom override limit
    const parsedLimit = parseInt(custom_claim_limit);
    if (isNaN(parsedLimit)) {
      delete parsedBio.custom_claim_limit;
    } else {
      parsedBio.custom_claim_limit = parsedLimit;
    }

    // 3. Save updated bio
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        bio: JSON.stringify(parsedBio)
      })
      .eq("id", targetUserId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, message: "Custom claim limit override updated successfully." });
  } catch (error: any) {
    console.error("Set limit override error:", error);
    return NextResponse.json({ error: error.message || "Failed to set custom claim limit" }, { status: 500 });
  }
}

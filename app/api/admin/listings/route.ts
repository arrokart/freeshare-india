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
      .from("listings")
      .select(`
        *,
        donor:donor_id(id, name, email, trust_score)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data: listings, error, count } = await query.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      listings: listings || [],
      totalCount: count || 0
    });
  } catch (error: any) {
    console.error("Admin fetch listings error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch listings" }, { status: 500 });
  }
}

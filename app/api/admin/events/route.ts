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
      .from("events")
      .select(`
        *,
        organizer:organizer_id(id, name, email, is_ngo)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data: events, error, count } = await query.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      events: events || [],
      totalCount: count || 0
    });
  } catch (error: any) {
    console.error("Admin fetch events error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch events" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      adminId,
      eventId,
      title,
      description,
      start_date,
      end_date,
      location_name,
      city,
      area,
      pincode,
      max_participants,
    } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    if (!eventId || !title || !description || !start_date || !end_date || !location_name || !city || !area) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("events")
      .update({
        title,
        description,
        start_date,
        end_date,
        location_name,
        city,
        area,
        pincode: pincode || null,
        max_participants: max_participants ? parseInt(max_participants) : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", eventId)
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null, { status: 200 });
  } catch (error: any) {
    console.error("Admin update event error:", error);
    return NextResponse.json({ error: error.message || "Failed to update event" }, { status: 500 });
  }
}

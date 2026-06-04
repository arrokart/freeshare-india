import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET events with city/area filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const area = searchParams.get("area");
    const pincode = searchParams.get("pincode");

    let query = supabase
      .from("events")
      .select(`
        *,
        organizer:organizer_id(id, name, email, is_ngo, avatar_url),
        rsvps:event_rsvps(user_id)
      `)
      .order("start_date", { ascending: true });

    // Filter by city if provided
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    // Filter by area if provided
    if (area) {
      query = query.ilike("area", `%${area}%`);
    }

    // Filter by pincode if provided
    if (pincode) {
      query = query.eq("pincode", pincode);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("GET events error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST create a new event
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      organizer_id,
      title,
      description,
      start_date,
      end_date,
      location_name,
      city,
      area,
      pincode,
      image_url,
      max_participants,
    } = body;

    // Basic Validation
    if (!organizer_id || !title || !description || !start_date || !end_date || !location_name || !city || !area) {
      return NextResponse.json(
        { error: "Missing required event fields" },
        { status: 400 }
      );
    }

    if (title.length < 10 || title.length > 100) {
      return NextResponse.json(
        { error: "Title must be between 10 and 100 characters" },
        { status: 400 }
      );
    }

    if (description.length < 20 || description.length > 1000) {
      return NextResponse.json(
        { error: "Description must be between 20 and 1000 characters" },
        { status: 400 }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    const now = new Date();

    // Validate start date is not in the past (allow 10 mins grace period for form filling)
    if (start.getTime() < now.getTime() - 10 * 60 * 1000) {
      return NextResponse.json(
        { error: "Event start time cannot be in the past" },
        { status: 400 }
      );
    }

    // Validate end date is after start date
    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: "Event end date/time must be after the start date/time" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({
        organizer_id,
        title,
        description,
        start_date,
        end_date,
        location_name,
        city,
        area,
        pincode: pincode || null,
        image_url: image_url || null,
        max_participants: max_participants ? parseInt(max_participants) : null,
      })
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null, { status: 201 });
  } catch (error: any) {
    console.error("Create event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create event" },
      { status: 500 }
    );
  }
}

// DELETE an event (only allowed for the organizer or admin)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const userId = searchParams.get("userId");

    if (!eventId || !userId) {
      return NextResponse.json(
        { error: "Missing eventId or userId" },
        { status: 400 }
      );
    }

    // Verify the caller is the organizer or an admin
    const { data: event, error: fetchErr } = await supabaseAdmin
      .from("events")
      .select("organizer_id")
      .eq("id", eventId)
      .single();

    if (fetchErr || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();

    const isAdmin = userProfile?.is_admin === true;

    if (event.organizer_id !== userId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", eventId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: "Event deleted successfully" });
  } catch (error: any) {
    console.error("Delete event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete event" },
      { status: 500 }
    );
  }
}

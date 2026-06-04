import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET retrieve a single inquiry or list of inquiries for dashboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId"); // Can be host or inquirer
    const type = searchParams.get("type") || "all"; // 'host', 'inquirer', or 'all'

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("event_inquiries")
      .select(`
        *,
        event:event_id(id, title, organizer_id),
        user:user_id(id, name, avatar_url)
      `);

    if (type === "host") {
      // Find inquiries where the user is the organizer of the event
      const { data: hostEvents } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("organizer_id", userId);
      
      const eventIds = (hostEvents || []).map((e) => e.id);
      query = query.in("event_id", eventIds);
    } else if (type === "inquirer") {
      query = query.eq("user_id", userId);
    } else {
      // Fetch both (dashboard default)
      const { data: hostEvents } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("organizer_id", userId);
      const eventIds = (hostEvents || []).map((e) => e.id);

      query = query.or(`user_id.eq.${userId},event_id.in.(${eventIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch last message preview for each inquiry
    const enriched = await Promise.all(
      (data || []).map(async (inq: any) => {
        const { data: lastMsg } = await supabaseAdmin
          .from("event_inquiry_messages")
          .select("content, created_at, sender_id")
          .eq("inquiry_id", inq.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Fetch host details separately
        const { data: hostProfile } = await supabaseAdmin
          .from("users")
          .select("id, name, avatar_url")
          .eq("id", inq.event.organizer_id)
          .maybeSingle();

        return {
          ...inq,
          host: hostProfile || null,
          lastMessage: lastMsg || null,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error: any) {
    console.error("Fetch inquiries error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch inquiries" },
      { status: 500 }
    );
  }
}

// POST create or retrieve an inquiry thread
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, userId } = body;

    if (!eventId || !userId) {
      return NextResponse.json(
        { error: "Missing eventId or userId" },
        { status: 400 }
      );
    }

    // Verify event exists
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("organizer_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 444 });
    }

    if (event.organizer_id === userId) {
      return NextResponse.json(
        { error: "Organizers cannot start inquiries on their own events" },
        { status: 400 }
      );
    }

    // Check if inquiry already exists
    const { data: existing, error: findError } = await supabaseAdmin
      .from("event_inquiries")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }

    // Insert new inquiry
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("event_inquiries")
      .insert({
        event_id: eventId,
        user_id: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(inserted, { status: 201 });
  } catch (error: any) {
    console.error("Create inquiry error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to initialize inquiry" },
      { status: 500 }
    );
  }
}

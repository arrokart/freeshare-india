import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST toggle RSVP status for an event
export async function POST(request: Request) {
  try {
    const { eventId, userId } = await request.json();

    if (!eventId || !userId) {
      return NextResponse.json(
        { error: "Missing eventId or userId" },
        { status: 400 }
      );
    }

    // Check if user already RSVP'd
    const { data: existingRsvp, error: selectError } = await supabaseAdmin
      .from("event_rsvps")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingRsvp) {
      // User has RSVP'd already -> Cancel RSVP (Delete)
      const { error: deleteError } = await supabaseAdmin
        .from("event_rsvps")
        .delete()
        .eq("id", existingRsvp.id);

      if (deleteError) throw deleteError;

      return NextResponse.json({ status: "cancelled", message: "RSVP cancelled successfully" });
    } else {
      // Check if event has participant cap limits
      const { data: event, error: eventError } = await supabaseAdmin
        .from("events")
        .select("max_participants")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      if (event?.max_participants) {
        const { count, error: countError } = await supabaseAdmin
          .from("event_rsvps")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId);

        if (countError) throw countError;

        if (count && count >= event.max_participants) {
          return NextResponse.json(
            { error: "Event RSVP limit reached. This event is full." },
            { status: 400 }
          );
        }
      }

      // User has not RSVP'd -> Join Event (Insert)
      const { error: insertError } = await supabaseAdmin
        .from("event_rsvps")
        .insert({
          event_id: eventId,
          user_id: userId,
        });

      if (insertError) throw insertError;

      return NextResponse.json({ status: "joined", message: "Successfully RSVP'd for event" });
    }
  } catch (error: any) {
    console.error("RSVP toggle error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process RSVP" },
      { status: 500 }
    );
  }
}

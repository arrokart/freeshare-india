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
        .select("max_participants, organizer_id, title")
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

      // Notify the event organizer (only if the RSVP is from someone else)
      if (event && event.organizer_id && event.organizer_id !== userId) {
        try {
          const { data: userProfile } = await supabaseAdmin
            .from("users")
            .select("name")
            .eq("id", userId)
            .single();

          const userName = userProfile?.name || "Someone";

          await supabaseAdmin.from("notifications").insert({
            user_id: event.organizer_id,
            type: "event_rsvp",
            title: "New RSVP for your event",
            body: `${userName} just RSVP'd for "${event.title}"`,
            link: `/events/${eventId}`,
          });
        } catch (notifErr) {
          console.error("Failed to send RSVP notification:", notifErr);
        }
      }

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


import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// POST report an event for moderation
export async function POST(request: Request) {
  try {
    const { eventId, reporterId, reason, description } = await request.json();

    if (!eventId || !reporterId || !reason || !description) {
      return NextResponse.json(
        { error: "Missing report parameter fields" },
        { status: 400 }
      );
    }

    // Insert new report record linked to the event
    const { data, error } = await supabase
      .from("reports")
      .insert({
        reporter_id: reporterId,
        reported_event_id: eventId,
        reason,
        description,
        status: "pending",
      })
      .select();

    if (error) throw error;

    return NextResponse.json(data?.[0] || null, { status: 201 });
  } catch (error: any) {
    console.error("Report event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit report" },
      { status: 500 }
    );
  }
}

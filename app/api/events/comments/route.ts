import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET retrieve all comments for a specific event
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId parameter" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("event_comments")
      .select(`
        *,
        user:user_id(id, name, avatar_url)
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Fetch comments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST submit a new comment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event_id, user_id, content } = body;

    if (!event_id || !user_id || !content) {
      return NextResponse.json(
        { error: "Missing required comment parameters" },
        { status: 400 }
      );
    }

    const contentTrimmed = content.trim();
    if (contentTrimmed.length < 2 || contentTrimmed.length > 500) {
      return NextResponse.json(
        { error: "Comment must be between 2 and 500 characters" },
        { status: 400 }
      );
    }

    // Insert comment using supabaseAdmin
    const { data, error } = await supabaseAdmin
      .from("event_comments")
      .insert({
        event_id,
        user_id,
        content: contentTrimmed,
      })
      .select(`
        *,
        user:user_id(id, name, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Notification Flow: Notify event host (if commenter is not the host)
    try {
      const { data: event } = await supabaseAdmin
        .from("events")
        .select("organizer_id, title")
        .eq("id", event_id)
        .single();

      if (event && event.organizer_id !== user_id) {
        // Fetch sender's name
        const { data: userProfile } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", user_id)
          .single();

        const senderName = userProfile?.name || "Someone";
        const commentPreview = contentTrimmed.length > 50
          ? `${contentTrimmed.substring(0, 50)}...`
          : contentTrimmed;

        await supabaseAdmin.from("notifications").insert({
          user_id: event.organizer_id,
          type: "new_event_comment",
          title: `New comment on your event`,
          body: `${senderName}: "${commentPreview}"`,
          link: `/events/${event_id}`,
        });
      }
    } catch (notifErr) {
      console.error("Failed to generate event comment notification:", notifErr);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Post comment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit comment" },
      { status: 500 }
    );
  }
}

// DELETE remove a comment (allowed for author, event host, or admin)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");
    const userId = searchParams.get("userId");

    if (!commentId || !userId) {
      return NextResponse.json(
        { error: "Missing commentId or userId parameters" },
        { status: 400 }
      );
    }

    // Fetch comment to check author and parent event organizer
    const { data: comment, error: fetchError } = await supabaseAdmin
      .from("event_comments")
      .select("*, event:event_id(organizer_id)")
      .eq("id", commentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 444 });
    }

    const isAuthor = comment.user_id === userId;
    const isHost = (comment.event as any)?.organizer_id === userId;

    // Check if caller is admin
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle();
    const isAdmin = profile?.is_admin === true;

    if (isAuthor || isHost || isAdmin) {
      const { error: deleteError } = await supabaseAdmin
        .from("event_comments")
        .delete()
        .eq("id", commentId);

      if (deleteError) throw deleteError;

      return NextResponse.json({ success: true, message: "Comment deleted successfully" });
    } else {
      return NextResponse.json({ error: "Unauthorized to delete this comment" }, { status: 403 });
    }
  } catch (error: any) {
    console.error("Delete comment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete comment" },
      { status: 500 }
    );
  }
}

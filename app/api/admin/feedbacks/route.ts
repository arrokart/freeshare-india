import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { userId, message } = await request.json();

    if (!userId || !message || message.trim().length < 10) {
      return NextResponse.json({ error: "Missing required fields or feedback too short." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("feedbacks")
      .insert({
        user_id: userId,
        message: message.trim()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, feedback: data });
  } catch (err: any) {
    console.error("Feedback submit API error:", err);
    return NextResponse.json({ error: err.message || "Failed to submit feedback." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");

    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // Verify admin privileges server-side
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", adminId)
      .single();

    if (profileErr || !profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden access" }, { status: 403 });
    }

    // Query feedback list joining author profile details
    const { data: feedbacks, error } = await supabaseAdmin
      .from("feedbacks")
      .select(`
        *,
        user:user_id(id, name, email, avatar_url)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(feedbacks || []);
  } catch (err: any) {
    console.error("Get feedback list API error:", err);
    return NextResponse.json({ error: err.message || "Failed to load feedback logs." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");
    const feedbackId = searchParams.get("id");

    if (!adminId || !feedbackId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Verify admin privileges
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", adminId)
      .single();

    if (profileErr || !profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden access" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("feedbacks")
      .delete()
      .eq("id", feedbackId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete feedback API error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete feedback." }, { status: 500 });
  }
}

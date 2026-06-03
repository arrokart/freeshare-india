import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET user notifications
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PATCH mark all or individual notifications as read
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, notificationId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required userId parameter" },
        { status: 400 }
      );
    }

    let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);

    if (notificationId) {
      query = query.eq("id", notificationId);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Notifications updated." });
  } catch (error: any) {
    console.error("Update notifications error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update notifications" },
      { status: 500 }
    );
  }
}

// DELETE clear all notifications for a user
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "All notifications cleared." });
  } catch (error: any) {
    console.error("Delete notifications error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear notifications" },
      { status: 500 }
    );
  }
}

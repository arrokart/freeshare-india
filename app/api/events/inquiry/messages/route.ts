import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushNotification } from "@/lib/push";

// GET message history for a private event inquiry
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inquiryId = searchParams.get("inquiryId");

    if (!inquiryId) {
      return NextResponse.json(
        { error: "Missing inquiryId parameter" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("event_inquiry_messages")
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Fetch inquiry messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch inquiry messages" },
      { status: 555 }
    );
  }
}

// POST send a message in a private event inquiry
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inquiry_id, sender_id, content } = body;

    if (!inquiry_id || !sender_id || !content) {
      return NextResponse.json(
        { error: "Missing required message parameters" },
        { status: 400 }
      );
    }

    // Insert message
    const { data, error } = await supabaseAdmin
      .from("event_inquiry_messages")
      .insert({
        inquiry_id,
        sender_id,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send notifications to the recipient
    try {
      // Fetch parent inquiry details
      const { data: inquiry } = await supabaseAdmin
        .from("event_inquiries")
        .select("*, event:event_id(organizer_id, title)")
        .eq("id", inquiry_id)
        .single();

      if (inquiry) {
        // Recipient is the organizer if the sender is the inquirer, else the inquirer
        const recipientId = sender_id === inquiry.user_id
          ? (inquiry.event as any).organizer_id
          : inquiry.user_id;

        // Fetch sender's name
        const { data: senderProfile } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", sender_id)
          .single();

        const senderName = senderProfile?.name || "Someone";
        const previewText = content.length > 50
          ? `${content.substring(0, 50)}...`
          : content;

        // 1. Send in-app notification
        await supabaseAdmin.from("notifications").insert({
          user_id: recipientId,
          type: "new_event_message",
          title: `New message regarding "${(inquiry.event as any).title}"`,
          body: `${senderName}: "${previewText}"`,
          link: `/events/chat/${inquiry_id}`,
        });

        // 2. Broadcast push notification for mobile PWA
        await sendPushNotification(
          recipientId,
          `New message regarding "${(inquiry.event as any).title}"`,
          `${senderName}: "${previewText}"`,
          `/events/chat/${inquiry_id}`
        );
      }
    } catch (notifErr) {
      console.error("Failed to generate inquiry message notification:", notifErr);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Send inquiry message error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendPushNotification } from "@/lib/push";

// GET retrieve message history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const claimId = searchParams.get("claimId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!claimId) {
      return NextResponse.json(
        { error: "Missing claimId parameter" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Fetch messages error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST send a message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { claim_id, sender_id, content, image_url } = body;

    if (!claim_id || !sender_id || (!content && !image_url)) {
      return NextResponse.json(
        { error: "Missing required message parameters" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        claim_id,
        sender_id,
        content,
        image_url,
        is_read: false,
      })
      .select();

    if (error) throw error;

    // Send notification to recipient
    try {
      // 1. Fetch sender profile name
      const { data: senderProfile } = await supabase
        .from("users")
        .select("name")
        .eq("id", sender_id)
        .single();
      const senderName = senderProfile?.name || "User";

      // 2. Fetch the claim details to identify recipient
      const { data: claimRecord } = await supabase
        .from("claims")
        .select("donor_id, receiver_id")
        .eq("id", claim_id)
        .single();

      if (claimRecord) {
        const recipient_id = sender_id === claimRecord.donor_id 
          ? claimRecord.receiver_id 
          : claimRecord.donor_id;

        const msgPreview = content 
          ? (content.length > 60 ? `${content.substring(0, 60)}...` : content) 
          : "sent an image";

        await supabase.from("notifications").insert({
          user_id: recipient_id,
          type: "new_message",
          title: `New Message from ${senderName}`,
          body: msgPreview,
          link: `/chat/${claim_id}`,
        });

        // Broadcast active mobile push notification
        await sendPushNotification(
          recipient_id,
          `New Message from ${senderName}`,
          msgPreview,
          `/chat/${claim_id}`
        );
      }
    } catch (notifError) {
      console.error("Failed to generate chat message notification:", notifError);
    }

    return NextResponse.json(data?.[0] || null, { status: 201 });
  } catch (error: any) {
    console.error("Post message error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send message" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { sendPushNotification } from "@/lib/push";

async function verifyAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.is_admin === true;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, targetType, city, title, notifBody, link } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json(
        { error: "Access Denied: Administrator privileges required." },
        { status: 403 }
      );
    }

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: "Notification title and body are required." },
        { status: 400 }
      );
    }

    // Determine target users query
    let userQuery = supabase.from("users").select("id, name, city");

    if (targetType === "city" && city) {
      userQuery = userQuery.ilike("city", `%${city.trim()}%`);
    }

    const { data: users, error: fetchUsersError } = await userQuery;

    if (fetchUsersError) throw fetchUsersError;

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No matching target users found." });
    }

    // Insert notifications and dispatch push alerts in parallel batches of 20 to avoid timeouts
    const batchSize = 20;
    let successCount = 0;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (u) => {
          try {
            // 1. Insert in-app notification row
            await supabase.from("notifications").insert({
              user_id: u.id,
              type: "broadcast_alert",
              title: title,
              body: notifBody,
              link: link || "/",
            });

            // 2. Dispatch Web Push notification
            await sendPushNotification(u.id, title, notifBody, link || "/");
            successCount++;
          } catch (err) {
            console.error(`Failed to broadcast to user ${u.id}:`, err);
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      message: `Successfully broadcasted to ${successCount} users.`,
    });
  } catch (error: any) {
    console.error("Broadcast handler error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process broadcast notifications." },
      { status: 500 }
    );
  }
}

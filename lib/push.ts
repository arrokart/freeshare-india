import webPush from "web-push";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "";

if (publicVapidKey && privateVapidKey) {
  webPush.setVapidDetails(
    "mailto:support@freeshare.in",
    publicVapidKey,
    privateVapidKey
  );
} else {
  console.warn("[Web Push] VAPID Keys are missing. Push notifications will fail to broadcast.");
}

/**
 * Sends a secure Web Push notification to all active browser endpoints of a target user.
 * Automatically cleans up expired/gone (status 410/404) subscriptions from the database profile.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  link: string = "/"
) {
  try {
    if (!publicVapidKey || !privateVapidKey) return;

    // 1. Fetch user's profile metadata
    const { data: userProfile, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", userId)
      .single();

    if (fetchErr || !userProfile || !userProfile.bio) return;

    let parsedBio: any;
    try {
      parsedBio = JSON.parse(userProfile.bio);
    } catch {
      return; // bio is not standard JSON, meaning no subscriptions are set
    }

    if (!parsedBio || !Array.isArray(parsedBio.push_subscriptions) || parsedBio.push_subscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({ title, body, link });
    const activeSubscriptions: any[] = [];
    let subscriptionsUpdated = false;

    // 2. Dispatch push to all client endpoints
    for (const sub of parsedBio.push_subscriptions) {
      try {
        await webPush.sendNotification(sub, payload);
        activeSubscriptions.push(sub);
      } catch (err: any) {
        console.error(`[Push Notification] Dispatch failed for endpoint: ${sub.endpoint}`, err.statusCode);
        
        // 410 (Gone) or 404 (Not Found) means subscription has expired/been revoked
        if (err.statusCode === 410 || err.statusCode === 404) {
          subscriptionsUpdated = true; // Exclude from active list to trigger cleanup
        } else {
          activeSubscriptions.push(sub); // Retain on general network timeouts or other temporary errors
        }
      }
    }

    // 3. Save cleaned subscriptions list back to DB if changes occurred
    if (subscriptionsUpdated) {
      console.log(`[Push Notification] Cleaning up ${parsedBio.push_subscriptions.length - activeSubscriptions.length} expired subscriptions for user: ${userId}`);
      parsedBio.push_subscriptions = activeSubscriptions;
      
      await supabase
        .from("users")
        .update({
          bio: JSON.stringify(parsedBio)
        })
        .eq("id", userId);
    }

  } catch (error) {
    console.error("[Push Notification] Broadcaster experienced an unexpected error:", error);
  }
}

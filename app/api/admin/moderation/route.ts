import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// Helper to verify if user is admin
async function verifyAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.is_admin === true;
}

// GET all reports
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    const { data: reports, error: reportsErr } = await supabase
      .from("reports")
      .select(`
        *,
        reporter:reporter_id(id, name),
        reported_user:reported_user_id(id, name, email, is_banned),
        reported_listing:reported_listing_id(id, title, images, status)
      `)
      .order("created_at", { ascending: false });

    if (reportsErr) throw reportsErr;

    return NextResponse.json(reports || []);
  } catch (error: any) {
    console.error("Admin reports get error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST execute moderation actions (resolve report, ban user, delete listing)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, reportId, action, targetUserId, targetListingId } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (!action) {
      return NextResponse.json({ error: "Missing action parameters" }, { status: 400 });
    }

    if (action === "ban_user" && targetUserId) {
      const { error } = await supabase
        .from("users")
        .update({ is_banned: true })
        .eq("id", targetUserId);
      if (error) throw error;
    }

    if (action === "unban_user" && targetUserId) {
      const { error } = await supabase
        .from("users")
        .update({ is_banned: false })
        .eq("id", targetUserId);
      if (error) throw error;
    }

    if (action === "grant_premium" && targetUserId) {
      // 1. Update DB table
      const { error: dbError } = await supabase
        .from("users")
        .update({ is_premium: true })
        .eq("id", targetUserId);
      if (dbError) throw dbError;

      // 2. Update Auth metadata
      const { error: authError } = await supabase.auth.admin.updateUserById(targetUserId, {
        user_metadata: { is_premium: true }
      });
      if (authError) {
        console.warn("Auth metadata update warning:", authError);
      }
    }

    if (action === "revoke_premium" && targetUserId) {
      // 1. Update DB table
      const { error: dbError } = await supabase
        .from("users")
        .update({ is_premium: false })
        .eq("id", targetUserId);
      if (dbError) throw dbError;

      // 2. Update Auth metadata
      const { error: authError } = await supabase.auth.admin.updateUserById(targetUserId, {
        user_metadata: { is_premium: false }
      });
      if (authError) {
        console.warn("Auth metadata update warning:", authError);
      }
    }

    if (action === "adjust_trust" && targetUserId) {
      const { trustScore } = body;
      const { error } = await supabase
        .from("users")
        .update({ trust_score: parseFloat(trustScore) })
        .eq("id", targetUserId);
      if (error) throw error;
    }

    if (action === "remove_listing" && targetListingId) {
      const { error } = await supabase
        .from("listings")
        .update({
          status: "removed",
          admin_removed: true,
          admin_notes: `Removed by administrator on report resolve.`,
        })
        .eq("id", targetListingId);
      if (error) throw error;
    }

    if (action === "approve_appeal" && targetListingId) {
      // Approve: Relist listing
      const { error } = await supabase
        .from("listings")
        .update({
          status: "available",
          admin_removed: false,
          is_flagged: false,
          admin_notes: `Restored by administrator on appeal approval.`
        })
        .eq("id", targetListingId);
      if (error) throw error;
    }

    if (action === "reject_appeal" && targetListingId) {
      // Reject: Keep listing removed
      const { error } = await supabase
        .from("listings")
        .update({
          admin_notes: `Appeal rejected by administrator.`
        })
        .eq("id", targetListingId);
      if (error) throw error;
    }

    if (action === "approve_event_appeal" && targetUserId) {
      // Fetch target user's current trust score
      const { data: userProfile } = await supabase
        .from("users")
        .select("trust_score")
        .eq("id", targetUserId)
        .single();
      
      const currentTrust = (userProfile && userProfile.trust_score !== null) ? Number(userProfile.trust_score) : 5.0;
      const nextTrust = Math.max(currentTrust, 3.50);

      // Restore privilege and unblock trust threshold if low
      const { error } = await supabase
        .from("users")
        .update({
          can_create_events: true,
          trust_score: nextTrust
        })
        .eq("id", targetUserId);
      if (error) throw error;
    }

    if (action === "reject_event_appeal" && targetUserId) {
      // Keep suspended, maybe log note
      const { error } = await supabase
        .from("users")
        .update({
          bio: JSON.stringify({ event_appeal_notes: "Appeal rejected by administrator." })
        })
        .eq("id", targetUserId);
      // Fail silently if bio parsing is complex
    }

    // 2. Mark report status as resolved if reportId is provided
    if (reportId) {
      let finalStatus = "action_taken";
      if (action === "dismiss") {
        finalStatus = "dismissed";
      } else if (action === "approve_appeal" || action === "approve_event_appeal") {
        finalStatus = "resolved";
      } else if (action === "reject_appeal" || action === "reject_event_appeal") {
        finalStatus = "action_taken";
      }

      const { error: reportUpdateErr } = await supabase
        .from("reports")
        .update({
          status: finalStatus,
          admin_id: adminId,
        })
        .eq("id", reportId);

      if (reportUpdateErr) throw reportUpdateErr;
    }

    return NextResponse.json({ success: true, message: "Moderation action completed." });
  } catch (error: any) {
    console.error("Moderation action execution error:", error);
    return NextResponse.json(
      { error: error.message || "Action execution failed" },
      { status: 500 }
    );
  }
}

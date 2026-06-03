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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");
    const statusFilter = searchParams.get("status") || "pending"; // 'pending', 'approved', 'rejected'

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    // Fetch users who might have applications
    const { data: users, error } = await supabase
      .from("users")
      .select("id, name, email, bio, created_at")
      .not("bio", "is", null);

    if (error) throw error;

    // Filter and parse applications
    const applications = (users || [])
      .map((u) => {
        try {
          const parsed = JSON.parse(u.bio);
          if (parsed && parsed.is_ngo_application === true) {
            return {
              userId: u.id,
              name: u.name,
              email: u.email,
              created_at: u.created_at,
              org_name: parsed.org_name,
              darpan_id: parsed.darpan_id,
              registration_number: parsed.registration_number,
              document_url: parsed.document_url,
              status: parsed.status,
              user_description: parsed.user_description,
              admin_notes: parsed.admin_notes || "",
              submitted_at: parsed.submitted_at || u.created_at
            };
          }
        } catch {
          // Profile bio is standard text description, skip
        }
        return null;
      })
      .filter((app) => app !== null && app.status === statusFilter);

    return NextResponse.json(applications);
  } catch (error: any) {
    console.error("Admin NGO GET Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load NGO applications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, targetUserId, action, adminNotes } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    if (!targetUserId || !action) {
      return NextResponse.json({ error: "Missing required approval fields." }, { status: 400 });
    }

    // 1. Fetch user's current profile bio
    const { data: userProfile, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", targetUserId)
      .single();

    if (fetchErr || !userProfile || !userProfile.bio) {
      return NextResponse.json({ error: "NGO application profile not found." }, { status: 404 });
    }

    let parsedBio;
    try {
      parsedBio = JSON.parse(userProfile.bio);
      if (parsedBio.is_ngo_application !== true) {
        throw new Error("Target profile does not contain an active NGO application.");
      }
    } catch {
      return NextResponse.json({ error: "Target profile does not contain a valid NGO application structure." }, { status: 400 });
    }

    // 2. Adjust application properties
    const isApproved = action === "approve";
    parsedBio.status = isApproved ? "approved" : "rejected";
    parsedBio.admin_notes = adminNotes || "";
    parsedBio.reviewed_at = new Date().toISOString();

    // 3. Update profile is_ngo flag and bio properties
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        is_ngo: isApproved,
        bio: JSON.stringify(parsedBio)
      })
      .eq("id", targetUserId);

    if (updateErr) throw updateErr;

    // 4. Send alert in-app notification to the NGO user
    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: isApproved ? "ngo_approved" : "ngo_rejected",
      title: isApproved ? "Charity Status Approved!" : "NGO Verification Update",
      body: isApproved 
        ? `Congratulations! Your organization verification for "${parsedBio.org_name}" is approved. Priority claims and charity features are active.`
        : `Your NGO application was not approved. Notes: ${adminNotes || "None provided"}. You can re-apply from your profile settings.`,
      is_read: false
    });

    return NextResponse.json({ success: true, message: `NGO application status updated to: ${parsedBio.status}.` });
  } catch (error: any) {
    console.error("Admin NGO POST Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update NGO application." }, { status: 500 });
  }
}

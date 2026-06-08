import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { deleteFileFromR2 } from "@/lib/r2";

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
    const search = searchParams.get("search");

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      users: users || [],
      totalCount: count || 0
    });
  } catch (error: any) {
    console.error("Admin fetch users error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminId, targetUserId, action, custom_claim_limit } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    if (!targetUserId || (action !== "set_limit" && action !== "toggle_event_creation")) {
      return NextResponse.json({ error: "Invalid action or missing parameters." }, { status: 400 });
    }

    if (action === "toggle_event_creation") {
      // Fetch current status
      let currentStatus = true;
      let hasColumn = true;

      const { data: userProfile, error: fetchErr } = await supabase
        .from("users")
        .select("can_create_events")
        .eq("id", targetUserId)
        .single();

      if (fetchErr) {
        const errMsg = fetchErr.message || "";
        if (errMsg.includes("column") || errMsg.includes("does not exist") || fetchErr.code === "PGRST204" || fetchErr.code === "42703") {
          hasColumn = false;
        } else {
          return NextResponse.json({ error: "Target user not found or database query failed." }, { status: 404 });
        }
      } else if (userProfile) {
        currentStatus = userProfile.can_create_events !== false;
      }

      if (!hasColumn) {
        return NextResponse.json({ 
          error: "Database migration pending: Please execute the following SQL in your Supabase SQL Editor first:\n\nALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_create_events BOOLEAN DEFAULT TRUE;" 
        }, { status: 400 });
      }

      const nextState = !currentStatus;

      const { error: updateErr } = await supabase
        .from("users")
        .update({ can_create_events: nextState })
        .eq("id", targetUserId);

      if (updateErr) throw updateErr;

      return NextResponse.json({ 
        success: true, 
        message: `Event creation privilege has been ${nextState ? "enabled" : "suspended"} for this user.` 
      });
    }

    // 1. Fetch target user bio
    const { data: userProfile, error: fetchErr } = await supabase
      .from("users")
      .select("bio")
      .eq("id", targetUserId)
      .single();

    if (fetchErr || !userProfile) {
      return NextResponse.json({ error: "Target user not found." }, { status: 404 });
    }

    let parsedBio: any = {};
    try {
      parsedBio = JSON.parse(userProfile.bio || "{}");
      if (typeof parsedBio !== "object" || parsedBio === null || Array.isArray(parsedBio)) {
        parsedBio = { user_description: userProfile.bio || "" };
      }
    } catch {
      parsedBio = { user_description: userProfile.bio || "" };
    }

    // 2. Set or clear custom override limit
    const parsedLimit = parseInt(custom_claim_limit);
    if (isNaN(parsedLimit)) {
      delete parsedBio.custom_claim_limit;
    } else {
      parsedBio.custom_claim_limit = parsedLimit;
    }

    // 3. Save updated bio
    const { error: updateErr } = await supabase
      .from("users")
      .update({
        bio: JSON.stringify(parsedBio)
      })
      .eq("id", targetUserId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, message: "Custom claim limit override updated successfully." });
  } catch (error: any) {
    console.error("Set limit override error:", error);
    return NextResponse.json({ error: error.message || "Failed to set custom claim limit" }, { status: 500 });
  }
}

// DELETE a user account and clean up all associated R2 assets
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get("adminId");
    const targetUserId = searchParams.get("targetUserId");

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing targetUserId parameter." }, { status: 400 });
    }

    // 1. Retrieve the user profile to find their avatar and NGO documents
    const { data: userProfile, error: profileErr } = await supabase
      .from("users")
      .select("avatar_url, bio")
      .eq("id", targetUserId)
      .single();

    if (profileErr || !userProfile) {
      return NextResponse.json({ error: "Target user profile not found." }, { status: 404 });
    }

    // 2. Retrieve all listings owned by the user to get their images
    const { data: listings, error: listingsErr } = await supabase
      .from("listings")
      .select("images")
      .eq("donor_id", targetUserId);

    if (listingsErr) {
      console.warn("Could not retrieve user listings for storage cleanup:", listingsErr);
    }

    // Collect all URLs to clean up
    const urlsToCleanup: string[] = [];

    // Add user avatar
    if (userProfile.avatar_url) {
      urlsToCleanup.push(userProfile.avatar_url);
    }

    // Parse bio for NGO application document
    if (userProfile.bio) {
      try {
        const parsedBio = JSON.parse(userProfile.bio);
        if (parsedBio && typeof parsedBio === "object" && parsedBio.document_url) {
          urlsToCleanup.push(parsedBio.document_url);
        }
      } catch {
        // Standard bio text, no JSON
      }
    }

    // Add all listings' images
    if (listings && listings.length > 0) {
      for (const item of listings) {
        if (item.images && Array.isArray(item.images)) {
          urlsToCleanup.push(...item.images);
        }
      }
    }

    // 3. Delete files from R2
    const publicDomain = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || "";
    const domain = publicDomain ? (publicDomain.endsWith("/") ? publicDomain : `${publicDomain}/`) : null;
    const placeholderDomain = "https://pub-placeholder-domain.r2.dev/";

    for (const fileUrl of urlsToCleanup) {
      let fileKey: string | null = null;
      if (domain && fileUrl.startsWith(domain)) {
        fileKey = fileUrl.substring(domain.length);
      } else if (fileUrl.startsWith(placeholderDomain)) {
        fileKey = fileUrl.substring(placeholderDomain.length);
      }

      if (fileKey) {
        try {
          await deleteFileFromR2(fileKey);
        } catch (storageErr) {
          console.error(`Failed to delete storage file ${fileKey}:`, storageErr);
        }
      }
    }

    // 4. Delete the user from authentication (this will cascade delete users, listings, claims, messages tables)
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(targetUserId);
    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, message: "User account and all associated data and files deleted successfully." });
  } catch (error: any) {
    console.error("Delete user account error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete user account" }, { status: 500 });
  }
}


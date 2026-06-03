import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

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

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    // 1. Fetch count totals
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const { count: totalListings } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true });

    const { count: activeListings } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", "available");

    const { count: reservedListings } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", "reserved");

    const { count: completedListings } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    // 2. Compute Category Distribution
    const { data: categoryData, error: catError } = await supabase
      .from("listings")
      .select("category");

    if (catError) throw catError;

    const categoryDistribution: Record<string, number> = {};
    (categoryData || []).forEach((item) => {
      const cat = item.category || "Miscellaneous";
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    });

    // 3. Compute Average Fulfillment Time (completed claims / listings)
    // We get claims where status is completed
    const { data: completedClaims, error: claimsError } = await supabase
      .from("claims")
      .select("created_at, accepted_at, updated_at")
      .eq("status", "completed");

    if (claimsError) throw claimsError;

    let averageFulfillmentHours = 0;
    if (completedClaims && completedClaims.length > 0) {
      let totalDurationMs = 0;
      let count = 0;
      completedClaims.forEach((claim) => {
        const start = new Date(claim.created_at).getTime();
        const end = new Date(claim.updated_at || claim.accepted_at || new Date()).getTime();
        if (end > start) {
          totalDurationMs += (end - start);
          count++;
        }
      });
      if (count > 0) {
        averageFulfillmentHours = parseFloat((totalDurationMs / (1000 * 60 * 60) / count).toFixed(1));
      }
    }

    // 4. Compute past 7-day timeline upload trends
    const past7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();

    const { data: recentListings, error: recentError } = await supabase
      .from("listings")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (recentError) throw recentError;

    const uploadTrends: Record<string, number> = {};
    past7Days.forEach((date) => {
      uploadTrends[date] = 0;
    });

    (recentListings || []).forEach((item) => {
      const dateStr = new Date(item.created_at).toISOString().split("T")[0];
      if (uploadTrends[dateStr] !== undefined) {
        uploadTrends[dateStr] += 1;
      }
    });

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalListings: totalListings || 0,
      activeListings: activeListings || 0,
      reservedListings: reservedListings || 0,
      completedListings: completedListings || 0,
      categoryDistribution,
      averageFulfillmentHours,
      uploadTrends: past7Days.map(date => ({
        date: new Date(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        count: uploadTrends[date]
      }))
    });

  } catch (error: any) {
    console.error("Analytics GET Error:", error);
    return NextResponse.json({ error: error.message || "Failed to compile admin stats." }, { status: 500 });
  }
}

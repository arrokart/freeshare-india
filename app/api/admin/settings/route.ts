import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

const DEFAULT_SETTINGS = {
  monthly_claim_limit: 10,
  grace_period_hours: 24,
  auto_restore_threshold: 4.5,
  campaign_type: "none", // 'none', 'unlimited', 'custom'
  campaign_limit: 20,
  campaign_name: "",
  welcome_trial_enabled: true,
  ga_measurement_id: "",
  adsense_client_id: ""
};

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
    const { data: adminProfile, error } = await supabase
      .from("users")
      .select("bio")
      .eq("email", "admin@freeshare.in")
      .single();

    if (error || !adminProfile || !adminProfile.bio) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    try {
      const parsed = JSON.parse(adminProfile.bio);
      return NextResponse.json({
        monthly_claim_limit: parsed.monthly_claim_limit ?? DEFAULT_SETTINGS.monthly_claim_limit,
        grace_period_hours: parsed.grace_period_hours ?? DEFAULT_SETTINGS.grace_period_hours,
        auto_restore_threshold: parsed.auto_restore_threshold ?? DEFAULT_SETTINGS.auto_restore_threshold,
        campaign_type: parsed.campaign_type ?? DEFAULT_SETTINGS.campaign_type,
        campaign_limit: parsed.campaign_limit ?? DEFAULT_SETTINGS.campaign_limit,
        campaign_name: parsed.campaign_name ?? DEFAULT_SETTINGS.campaign_name,
        welcome_trial_enabled: parsed.welcome_trial_enabled ?? DEFAULT_SETTINGS.welcome_trial_enabled,
        ga_measurement_id: parsed.ga_measurement_id ?? DEFAULT_SETTINGS.ga_measurement_id,
        adsense_client_id: parsed.adsense_client_id ?? DEFAULT_SETTINGS.adsense_client_id
      });
    } catch {
      return NextResponse.json(DEFAULT_SETTINGS);
    }
  } catch (error: any) {
    console.error("Fetch settings error:", error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      adminId, 
      monthly_claim_limit, 
      grace_period_hours, 
      auto_restore_threshold,
      campaign_type,
      campaign_limit,
      campaign_name,
      welcome_trial_enabled,
      ga_measurement_id,
      adsense_client_id
    } = body;

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: "Access Denied: Administrator privileges required." }, { status: 403 });
    }

    const settingsObj = {
      monthly_claim_limit: parseInt(monthly_claim_limit) || DEFAULT_SETTINGS.monthly_claim_limit,
      grace_period_hours: parseInt(grace_period_hours) || DEFAULT_SETTINGS.grace_period_hours,
      auto_restore_threshold: parseFloat(auto_restore_threshold) || DEFAULT_SETTINGS.auto_restore_threshold,
      campaign_type: campaign_type || DEFAULT_SETTINGS.campaign_type,
      campaign_limit: parseInt(campaign_limit) || DEFAULT_SETTINGS.campaign_limit,
      campaign_name: campaign_name || DEFAULT_SETTINGS.campaign_name,
      welcome_trial_enabled: welcome_trial_enabled !== undefined ? welcome_trial_enabled : DEFAULT_SETTINGS.welcome_trial_enabled,
      ga_measurement_id: ga_measurement_id !== undefined ? String(ga_measurement_id).trim() : DEFAULT_SETTINGS.ga_measurement_id,
      adsense_client_id: adsense_client_id !== undefined ? String(adsense_client_id).trim() : DEFAULT_SETTINGS.adsense_client_id
    };

    // Update the bio column of the admin user
    const { error: updateError } = await supabase
      .from("users")
      .update({ bio: JSON.stringify(settingsObj) })
      .eq("email", "admin@freeshare.in");

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, settings: settingsObj });
  } catch (error: any) {
    console.error("Save settings error:", error);
    return NextResponse.json({ error: error.message || "Failed to save settings." }, { status: 500 });
  }
}

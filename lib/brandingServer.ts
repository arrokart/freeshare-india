import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { 
  DEFAULT_APP_NAME, 
  DEFAULT_APP_SHORT_NAME,
  DEFAULT_APP_DESCRIPTION, 
  DEFAULT_SUPPORT_EMAIL, 
  DEFAULT_LOGO_URL, 
  DEFAULT_APP_DOMAIN 
} from "@/lib/branding";

export async function getBrandingServer() {
  try {
    const { data: adminProfile, error } = await supabaseAdmin
      .from("users")
      .select("bio")
      .eq("email", "admin@freeshare.in")
      .single();

    if (error || !adminProfile || !adminProfile.bio) {
      return {
        appName: DEFAULT_APP_NAME,
        appShortName: DEFAULT_APP_SHORT_NAME,
        appDescription: DEFAULT_APP_DESCRIPTION,
        supportEmail: DEFAULT_SUPPORT_EMAIL,
        appLogoUrl: DEFAULT_LOGO_URL,
        appDomain: DEFAULT_APP_DOMAIN
      };
    }

    const parsed = JSON.parse(adminProfile.bio);
    const appName = parsed.app_name || DEFAULT_APP_NAME;
    const appShortName = appName.split(" ")[0] || DEFAULT_APP_SHORT_NAME;

    return {
      appName,
      appShortName,
      appDescription: parsed.app_description || DEFAULT_APP_DESCRIPTION,
      supportEmail: parsed.support_email || DEFAULT_SUPPORT_EMAIL,
      appLogoUrl: parsed.app_logo_url || DEFAULT_LOGO_URL,
      appDomain: parsed.app_domain || DEFAULT_APP_DOMAIN
    };
  } catch (err) {
    console.error("Failed to load branding server-side:", err);
    return {
      appName: DEFAULT_APP_NAME,
      appShortName: DEFAULT_APP_SHORT_NAME,
      appDescription: DEFAULT_APP_DESCRIPTION,
      supportEmail: DEFAULT_SUPPORT_EMAIL,
      appLogoUrl: DEFAULT_LOGO_URL,
      appDomain: DEFAULT_APP_DOMAIN
    };
  }
}

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { unstable_cache } from "next/cache";
import { 
  DEFAULT_APP_NAME, 
  DEFAULT_APP_SHORT_NAME,
  DEFAULT_APP_DESCRIPTION, 
  DEFAULT_SUPPORT_EMAIL, 
  DEFAULT_LOGO_URL, 
  DEFAULT_APP_DOMAIN,
  DEFAULT_ITEM_CATEGORIES,
  DEFAULT_SKILL_CATEGORIES,
  DEFAULT_BRAND_LOGO_URL,
  DEFAULT_LOGO_DISPLAY_MODE
} from "@/lib/branding";

// Fetch branding directly from the dedicated table
async function fetchBrandingFromDb() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !settings) {
      return {
        appName: DEFAULT_APP_NAME,
        appShortName: DEFAULT_APP_SHORT_NAME,
        appDescription: DEFAULT_APP_DESCRIPTION,
        supportEmail: DEFAULT_SUPPORT_EMAIL,
        appLogoUrl: DEFAULT_LOGO_URL,
        appDomain: DEFAULT_APP_DOMAIN,
        itemCategories: DEFAULT_ITEM_CATEGORIES,
        skillCategories: DEFAULT_SKILL_CATEGORIES,
        brandLogoUrl: DEFAULT_BRAND_LOGO_URL,
        logoDisplayMode: DEFAULT_LOGO_DISPLAY_MODE
      };
    }

    const appName = settings.app_name || DEFAULT_APP_NAME;
    const appShortName = appName.split(" ")[0] || DEFAULT_APP_SHORT_NAME;

    return {
      appName,
      appShortName,
      appDescription: settings.app_description || DEFAULT_APP_DESCRIPTION,
      supportEmail: settings.support_email || DEFAULT_SUPPORT_EMAIL,
      appLogoUrl: settings.app_logo_url || DEFAULT_LOGO_URL,
      appDomain: settings.app_domain || DEFAULT_APP_DOMAIN,
      itemCategories: (settings.item_categories && settings.item_categories.length > 0) ? settings.item_categories : DEFAULT_ITEM_CATEGORIES,
      skillCategories: (settings.skill_categories && settings.skill_categories.length > 0) ? settings.skill_categories : DEFAULT_SKILL_CATEGORIES,
      brandLogoUrl: settings.brand_logo_url || DEFAULT_BRAND_LOGO_URL,
      logoDisplayMode: settings.logo_display_mode || DEFAULT_LOGO_DISPLAY_MODE
    };
  } catch (err) {
    console.error("Failed to load branding server-side:", err);
    return {
      appName: DEFAULT_APP_NAME,
      appShortName: DEFAULT_APP_SHORT_NAME,
      appDescription: DEFAULT_APP_DESCRIPTION,
      supportEmail: DEFAULT_SUPPORT_EMAIL,
      appLogoUrl: DEFAULT_LOGO_URL,
      appDomain: DEFAULT_APP_DOMAIN,
      itemCategories: DEFAULT_ITEM_CATEGORIES,
      skillCategories: DEFAULT_SKILL_CATEGORIES,
      brandLogoUrl: DEFAULT_BRAND_LOGO_URL,
      logoDisplayMode: DEFAULT_LOGO_DISPLAY_MODE
    };
  }
}

// Wrap with unstable_cache to serve data in 0ms, invalidating only when revalidateTag('branding') is called
export const getBrandingServer = unstable_cache(
  async () => {
    return fetchBrandingFromDb();
  },
  ["branding-settings"],
  {
    tags: ["branding"],
    revalidate: false // Cache indefinitely until manually invalidated
  }
);

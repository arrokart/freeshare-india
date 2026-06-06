export const DEFAULT_APP_NAME = "FreeShare India";
export const DEFAULT_APP_SHORT_NAME = "FreeShare";
export const DEFAULT_APP_DESCRIPTION = "Share surplus items, coordinate community cleanups, and request verified skill sharing.";
export const DEFAULT_SUPPORT_EMAIL = "support@freeshare.in";
export const DEFAULT_LEGAL_EMAIL = "legal@freeshare.in";
export const DEFAULT_LOGO_URL = "/icon-192x192.png";
export const DEFAULT_APP_DOMAIN = "https://freeshare-india.vercel.app";
export const DEFAULT_TWITTER_HANDLE = "@freeshare_india";
export const DEFAULT_INSTAGRAM_HANDLE = "@freeshare_india";

export const DEFAULT_BRAND_LOGO_URL = "";
export const DEFAULT_LOGO_DISPLAY_MODE = "both";

export const DEFAULT_ITEM_CATEGORIES = [
  "🛋️ Furniture", "🔌 Electronics", "📚 Books", "👕 Clothing", "🧸 Toys", 
  "🍳 Kitchen", "📺 Appliances", "⚽ Sports", "🏢 Office", "✨ Miscellaneous"
];

export const DEFAULT_SKILL_CATEGORIES = [
  "📚 Academic Tutoring", "🗣️ Language Practice", "🔧 Handyman Services", 
  "💻 Coding & Tech", "🎨 Design & Creative", "💪 Fitness & Sports", "✨ Miscellaneous"
];

export function parseCategory(categoryString: string) {
  if (!categoryString) return { emoji: "✨", name: "" };
  // Check if string starts with an emoji pattern (e.g. 🛋️, 🔌) followed by space
  const match = categoryString.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|\S)\s+(.*)$/);
  if (match) {
    return { emoji: match[1], name: match[2] };
  }
  return { emoji: "✨", name: categoryString };
}

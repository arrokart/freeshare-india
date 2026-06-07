const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEFAULT_ITEM_CATEGORIES = [
  "🛋️ Furniture", "🔌 Electronics", "📚 Books", "👕 Clothing", "🧸 Toys", 
  "🍳 Kitchen", "📺 Appliances", "⚽ Sports", "🏢 Office", "✨ Miscellaneous"
];

const DEFAULT_SKILL_CATEGORIES = [
  "📚 Academic Tutoring", "🗣️ Language Practice", "🔧 Handyman Services", 
  "💻 Coding & Tech", "🎨 Design & Creative", "💪 Fitness & Sports", "✨ Miscellaneous"
];

async function run() {
  console.log("Populating platform categories directly in database...");
  
  const { data, error } = await supabase
    .from("platform_settings")
    .update({
      item_categories: DEFAULT_ITEM_CATEGORIES,
      skill_categories: DEFAULT_SKILL_CATEGORIES
    })
    .eq("id", 1)
    .select();

  if (error) {
    console.error("❌ Failed to update categories:", error.message);
  } else {
    console.log("✅ Categories updated successfully in database!");
    console.log("Item Categories:", data[0].item_categories);
    
    // Now trigger a revalidate call on the live API or trigger caching reload
    console.log("\nTo complete cache clearing on live Vercel deployment, please save settings once in the Admin page, or wait for next dynamic refresh.");
  }
}

run();

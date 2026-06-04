const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load .env.local variables
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const eqIdx = trimmed.indexOf("=");
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testScenario() {
  console.log("=== STARTING RUNTIME DIAGNOSTIC SCENARIO ===");

  // 1. Fetch some existing user
  console.log("\n1. Fetching a donor user from public.users...");
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, name, email")
    .limit(1);

  if (userError) {
    console.error("Error fetching users:", userError);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.error("No users found in database to act as donor. Run scratch_create_ngo.js or create a user first.");
    process.exit(1);
  }

  const donor = users[0];
  console.log(`Using donor: ${donor.name} (${donor.email}) [ID: ${donor.id}]`);

  // 2. Insert a standard product item
  console.log("\n2. Inserting a test item listing...");
  const itemTitle = "Test Item " + Date.now();
  const { data: itemData, error: itemError } = await supabase
    .from("listings")
    .insert({
      donor_id: donor.id,
      title: itemTitle,
      description: "This is a diagnostic test item created during pre-launch checkout.",
      category: "Books",
      condition: "Good",
      images: ["https://placeholder-url.com/book.jpg"],
      city: "Delhi",
      area: "Connaught Place",
      pincode: "110001",
      listing_type: "item"
    })
    .select();

  if (itemError) {
    console.error("❌ Failed to insert standard item:", itemError.message);
  } else {
    console.log("✅ Successfully inserted item listing:", itemData[0].id);
  }

  // 3. Insert a skill share listing (checking dropped NOT NULL condition constraint, tags, and duration)
  console.log("\n3. Inserting a test skill share listing...");
  const skillTitle = "Test Skill " + Date.now();
  const { data: skillData, error: skillError } = await supabase
    .from("listings")
    .insert({
      donor_id: donor.id,
      title: skillTitle,
      description: "Teaching beginner math and science for kids in the neighborhood.",
      category: "Books", // Category can be set to Books or similar fallback
      condition: null, // Should be allowed now!
      images: [], // Images are optional for skills
      city: "Delhi",
      area: "Connaught Place",
      pincode: "110001",
      listing_type: "skill",
      skill_duration: "1 hour",
      skill_tags: ["Math", "Teaching", "Kids"]
    })
    .select();

  if (skillError) {
    console.error("❌ Failed to insert skill listing:", skillError.message);
  } else {
    console.log("✅ Successfully inserted skill listing:", skillData[0].id);
  }

  // 4. Query listings with search and filters matching the skill tags
  console.log("\n4. Searching listings using tags query (simulating the search filter)...");
  const { data: searchResults, error: searchError } = await supabase
    .from("listings")
    .select("id, title, listing_type, skill_tags")
    .contains("skill_tags", ["Math"]);

  if (searchError) {
    console.error("❌ Search failed:", searchError.message);
  } else {
    console.log(`✅ Search succeeded. Found ${searchResults.length} listings containing tag 'Math':`);
    searchResults.forEach((r) => {
      console.log(` - [${r.listing_type}] ${r.title} | Tags: ${r.skill_tags.join(", ")}`);
    });
  }

  // 5. Cleanup test items
  console.log("\n5. Cleaning up test listings...");
  const idsToDelete = [];
  if (itemData) idsToDelete.push(itemData[0].id);
  if (skillData) idsToDelete.push(skillData[0].id);

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("listings")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("❌ Cleanup failed:", deleteError.message);
    } else {
      console.log("✅ Cleanup completed successfully. DB state clean.");
    }
  }

  console.log("\n=== DIAGNOSTICS COMPLETED SUCCESSFULLY ===");
}

testScenario();

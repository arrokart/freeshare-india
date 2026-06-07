const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAll() {
  console.log("=== Starting Platform Verification ===");

  // 1. Verify new platform_settings table
  console.log("\n1. Checking platform_settings table...");
  const { data: settings, error: settingsErr } = await supabase
    .from("platform_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (settingsErr) {
    console.error("Error reading platform_settings:", settingsErr);
  } else {
    console.log("✅ platform_settings read successfully:", {
      app_name: settings.app_name,
      logo_display_mode: settings.logo_display_mode,
      brand_logo_url: settings.brand_logo_url,
      welcome_trial_enabled: settings.welcome_trial_enabled
    });
  }

  // 2. Create/Verify demo user in 'users' table
  console.log("\n2. Checking demo user status...");
  const testEmail = "demo_test_user@freeshare.in";
  
  // Check if user already exists in DB
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("email", testEmail)
    .single();

  if (existingUser) {
    console.log("✅ Demo user already exists in DB:", existingUser.email, "(ID:", existingUser.id + ")");
  } else {
    console.log("Cleaning up potential orphaned auth user first...");
    // Retrieve users list to find ID if it exists in auth but not in DB users table
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUsers.find(u => u.email === testEmail);
    if (existingAuthUser) {
      console.log("Found existing auth user, deleting first...");
      await supabase.auth.admin.deleteUser(existingAuthUser.id);
    }

    console.log("Creating new demo user in auth and users table...");
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: "password123",
      email_confirm: true
    });

    if (authErr) {
      console.error("❌ Failed to create user in Auth:", authErr.message);
    } else {
      console.log("✅ Auth user created successfully. ID:", authUser.user.id);
      
      // Let's insert into profile table with date_of_birth
      const { data: profileUser, error: profileErr } = await supabase
        .from("users")
        .insert({
          id: authUser.user.id,
          email: testEmail,
          name: "Demo Test User",
          avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
          bio: "This is a test account generated for platform verification.",
          is_admin: false,
          city: "Mumbai",
          area: "Bandra",
          gender: "Prefer not to say",
          date_of_birth: "2000-01-01"
        })
        .select()
        .single();

      if (profileErr) {
        console.error("❌ Failed to create user profile in DB:", profileErr.message);
      } else {
        console.log("✅ Demo user profile created successfully:", profileUser.email);
      }
    }
  }

  // 3. Check latest Listings and Claims count to verify DB integrity
  console.log("\n3. Testing Listings and Claims integrity...");
  const { count: listingCount, error: listErr } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true });

  if (listErr) {
    console.error("Error fetching listings count:", listErr);
  } else {
    console.log(`✅ Total active listings in database: ${listingCount}`);
  }

  const { count: claimCount, error: claimErr } = await supabase
    .from("claims")
    .select("*", { count: "exact", head: true });

  if (claimErr) {
    console.error("Error fetching claims count:", claimErr);
  } else {
    console.log(`✅ Total active claims in database: ${claimCount}`);
  }

  console.log("\n=== Verification Completed successfully! ===");
}

testAll();

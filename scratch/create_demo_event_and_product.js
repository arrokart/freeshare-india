const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Parse .env.local
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
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  const randSuffix = Math.floor(Math.random() * 10000);
  const email = `hero_${randSuffix}@freeshare.in`;
  const password = "SecurePassword123!";
  const name = `Delhi Hero ${randSuffix}`;
  const city = "Delhi";
  const area = "Karol Bagh";
  const pincode = "110005";

  console.log(`\nCreating new user: ${email}...`);

  try {
    // 1. Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        city,
        area,
        pincode,
        date_of_birth: "1995-05-15",
      },
    });

    if (authError) throw authError;
    const userId = authUser.user.id;
    console.log(`✔ User created in Auth (ID: ${userId})`);

    // Wait 1.5 seconds for the database trigger to complete user synchronization
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Ensure database profile exists or create it if the trigger failed
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      console.log("Trigger didn't run. Creating profile manually...");
      const { error: dbError } = await supabaseAdmin.from("users").insert({
        id: userId,
        email,
        name,
        city,
        area,
        pincode,
        date_of_birth: "1995-05-15",
      });
      if (dbError) throw dbError;
    } else {
      console.log("✔ Profile synchronized successfully by trigger");
      // Update profile coordinates/details to match metadata
      await supabaseAdmin
        .from("users")
        .update({ name, city, area, pincode })
        .eq("id", userId);
    }

    // 3. Create a Donation Listing (Product)
    const { data: listing, error: listingError } = await supabaseAdmin.from("listings").insert({
      donor_id: userId,
      title: "Red Nike Air Jordan 1",
      description: "Original Air Jordan 1 sneakers in good condition. Size US 9. Giving away to anyone who needs them.",
      category: "Clothing",
      condition: "Good",
      images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=60"],
      city,
      area,
      pincode,
      status: "available",
      listing_type: "item",
    }).select().single();

    if (listingError) throw listingError;
    console.log(`✔ Donation product created: "${listing.title}" (ID: ${listing.id})`);

    // 4. Create a Community Event
    const now = new Date();
    // Start tomorrow at 10 AM, end tomorrow at 2 PM
    const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4 hour duration

    const { data: event, error: eventError } = await supabaseAdmin.from("events").insert({
      organizer_id: userId,
      title: "Karol Bagh Book Donation Drive",
      description: "Bring your old textbooks, novels, and children's books to distribute to local kids. Everyone is welcome to join!",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      location_name: "Karol Bagh Central Park, Gate 2",
      city,
      area,
      pincode,
      max_participants: 50,
      image_url: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&auto=format&fit=crop&q=60",
    }).select().single();

    if (eventError) throw eventError;
    console.log(`✔ Community event created: "${event.title}" (ID: ${event.id})`);

    console.log("\n=============================================");
    console.log("DEMO DETAILS & LOGIN CREDENTIALS:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`New Product: /listing/${listing.id}`);
    console.log(`New Event: /events/${event.id}`);
    console.log("=============================================");

  } catch (err) {
    console.error("❌ Execution failed:", err.message || err);
  }
}

main();

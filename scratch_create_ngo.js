const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local since dotenv is not installed
const envPath = path.join(__dirname, ".env.local");
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
  const demoEmail = "ngo-demo@freeshare.in";
  const demoPassword = "Password123!";
  const demoName = "Helping Hands Charity";
  const demoCity = "New Delhi";
  const demoArea = "Connaught Place";
  const demoPincode = "110001";

  console.log(`Creating NGO demo user: ${demoEmail}...`);

  try {
    // 1. Create/Ensure the user exists in Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        name: demoName,
        city: demoCity,
        area: demoArea,
        pincode: demoPincode,
        date_of_birth: "1995-05-15",
      },
    });

    let userId = authUser?.user?.id;

    if (authError) {
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        // Fetch existing user to get ID
        const { data: listUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        const existing = listUsers.users.find(u => u.email === demoEmail);
        if (existing) {
          userId = existing.id;
        } else {
          throw new Error("User exists but could not retrieve ID.");
        }
      } else {
        throw authError;
      }
    }

    console.log(`NGO Demo User ID: ${userId}`);

    // Assemble the NGO Application payload
    const ngoDetails = {
      is_ngo_application: true,
      org_name: "Helping Hands Charity Foundation",
      darpan_id: "DL/2026/0998877",
      registration_number: "REG-IND-998877-2026",
      document_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      status: "pending",
      user_description: "We are a non-profit organization dedicated to distributing books, toys, and clothes to underprivileged children in shelter homes.",
      submitted_at: new Date().toISOString()
    };

    // Check/Insert User Profile in DB
    const { data: existingProfile } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile) {
      console.log("Updating database profile with NGO application structure...");
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          name: demoName,
          city: demoCity,
          area: demoArea,
          pincode: demoPincode,
          is_ngo: false,
          bio: JSON.stringify(ngoDetails),
        })
        .eq("id", userId);
      
      if (updateError) throw updateError;
    } else {
      console.log("Creating database profile with NGO application structure...");
      const { error: dbError } = await supabaseAdmin.from("users").insert({
        id: userId,
        email: demoEmail,
        name: demoName,
        city: demoCity,
        area: demoArea,
        pincode: demoPincode,
        date_of_birth: "1995-05-15",
        is_ngo: false,
        bio: JSON.stringify(ngoDetails),
      });

      if (dbError) throw dbError;
    }

    console.log("\n=============================================");
    console.log("NGO DEMO USER CREATED SUCCESSFULLY!");
    console.log(`Email: ${demoEmail}`);
    console.log(`Password: Password123!`);
    console.log("Role: User (with pending NGO application)");
    console.log("=============================================");

  } catch (err) {
    console.error("Error setting up NGO demo user:", err.message || err);
  }
}

main();

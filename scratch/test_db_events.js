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
  console.log("=== STARTING EVENTS DIAGNOSTIC SCENARIO ===");

  // 1. Fetch some existing user to organizer
  console.log("\n1. Fetching a host user...");
  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, name")
    .limit(2);

  if (userError || !users || users.length === 0) {
    console.error("Error fetching users:", userError);
    process.exit(1);
  }

  const host = users[0];
  const attendee = users[1] || users[0];
  console.log(`Using host: ${host.name} [ID: ${host.id}]`);
  console.log(`Using attendee: ${attendee.name} [ID: ${attendee.id}]`);

  // 2. Insert test event
  console.log("\n2. Inserting a test event...");
  const eventTitle = "Test Cleanup Event " + Date.now();
  const start = new Date();
  start.setHours(start.getHours() + 2); // 2 hours in the future
  const end = new Date();
  end.setHours(end.getHours() + 4); // 4 hours in the future

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .insert({
      organizer_id: host.id,
      title: eventTitle,
      description: "Clean up the central park area next to the metro station.",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      location_name: "Central Park Metro Gate 1",
      city: "Delhi",
      area: "Karol Bagh",
      pincode: "110005",
      max_participants: 10
    })
    .select();

  if (eventError) {
    console.error("❌ Failed to insert event:", eventError.message);
    process.exit(1);
  } else {
    console.log("✅ Successfully inserted event:", eventData[0].id);
  }

  const event = eventData[0];

  // 3. Insert test RSVP
  console.log("\n3. Inserting a test RSVP...");
  const { data: rsvpData, error: rsvpError } = await supabase
    .from("event_rsvps")
    .insert({
      event_id: event.id,
      user_id: attendee.id
    })
    .select();

  if (rsvpError) {
    console.error("❌ Failed to insert RSVP:", rsvpError.message);
  } else {
    console.log("✅ Successfully inserted RSVP:", rsvpData[0].id);
  }

  // 4. Report event
  console.log("\n4. Submitting a test report on the event...");
  const { data: reportData, error: reportError } = await supabase
    .from("reports")
    .insert({
      reporter_id: attendee.id,
      reported_event_id: event.id,
      reason: "spam",
      description: "This is a diagnostic check to ensure reports table links correctly.",
      status: "pending"
    })
    .select();

  if (reportError) {
    console.error("❌ Failed to insert report:", reportError.message);
  } else {
    console.log("✅ Successfully inserted report:", reportData[0].id);
  }

  // 5. Cleanup
  console.log("\n5. Cleaning up diagnostic records...");
  if (reportData) {
    await supabase.from("reports").delete().eq("id", reportData[0].id);
  }
  if (eventData) {
    await supabase.from("events").delete().eq("id", event.id);
  }
  console.log("✅ Cleanup finished. DB state clean.");

  console.log("\n=== EVENTS DIAGNOSTICS COMPLETED SUCCESSFULLY ===");
}

testScenario();

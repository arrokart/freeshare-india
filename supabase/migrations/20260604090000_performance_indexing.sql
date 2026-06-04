-- Add performance indexes for frequently queried columns in FreeShare India
-- This optimizes the listings queries, feed loads, and comment section fetches

-- Index on listings status, type, and created_at to speed up main feed queries
CREATE INDEX IF NOT EXISTS idx_listings_status_type_created ON listings(status, listing_type, created_at DESC);

-- Indexes on listings search and filter columns
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_pincode ON listings(pincode);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_donor_id ON listings(donor_id);

-- Index on event comments for faster event page loads
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id_created ON event_comments(event_id, created_at DESC);

-- Index on claims to speed up claim and request resolution queries
CREATE INDEX IF NOT EXISTS idx_claims_listing_id ON claims(listing_id);
CREATE INDEX IF NOT EXISTS idx_claims_receiver_id ON claims(receiver_id);

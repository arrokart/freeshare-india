-- Add database indexes on foreign keys to prevent full table scans and improve application speed

-- 1. Index claims table foreign keys
CREATE INDEX IF NOT EXISTS idx_claims_listing_id ON public.claims(listing_id);
CREATE INDEX IF NOT EXISTS idx_claims_receiver_id ON public.claims(receiver_id);
CREATE INDEX IF NOT EXISTS idx_claims_donor_id ON public.claims(donor_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);

-- 2. Index messages table foreign keys 
CREATE INDEX IF NOT EXISTS idx_messages_claim_id ON public.messages(claim_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 3. Index listings table filters
CREATE INDEX IF NOT EXISTS idx_listings_donor_id ON public.listings(donor_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON public.listings(listing_type);

-- 4. Index notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

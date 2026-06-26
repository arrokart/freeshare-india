-- =====================================================================
-- FREESHARE INDIA DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- =====================================================================

-- Enable PostGIS extension for geolocation coordinates and search
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable pg_trgm for fuzzy search autocomplete
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Clean existing tables (in order of dependencies)
-- DROP TABLE IF EXISTS reports CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS reviews CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS claims CASCADE;
-- DROP TABLE IF EXISTS listings CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =====================================================================
-- 1. USERS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    date_of_birth DATE NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    pincode TEXT,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    bio TEXT,
    trust_score DECIMAL(3,2) DEFAULT 5.00 CHECK (trust_score >= 1.00 AND trust_score <= 5.00),
    total_donated INT DEFAULT 0 CHECK (total_donated >= 0),
    total_received INT DEFAULT 0 CHECK (total_received >= 0),
    monthly_claim_count INT DEFAULT 0 CHECK (monthly_claim_count >= 0),
    monthly_claim_reset_date DATE DEFAULT CURRENT_DATE,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    strike_count INT DEFAULT 0 CHECK (strike_count >= 0),
    is_banned BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE, -- Identity Verification
    is_ngo BOOLEAN DEFAULT FALSE,      -- NGO account verification
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Safety trigger / constraint for age limit validation (must be 18+)
    CONSTRAINT check_user_age_18_plus CHECK (
        date_of_birth <= (CURRENT_DATE - INTERVAL '18 years')
    )
);

-- =====================================================================
-- 2. LISTINGS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 80),
    description TEXT NOT NULL CHECK (char_length(description) >= 20 AND char_length(description) <= 500),
    category TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN (
        'Like New', 'Good', 'Fair', 'Needs Repair'
    )),
    images TEXT[] NOT NULL CHECK (array_length(images, 1) >= 1 AND array_length(images, 1) <= 5),
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    landmark TEXT,
    -- Location coordinates (PostGIS geometry point)
    location GEOGRAPHY(Point, 4326), 
    status TEXT DEFAULT 'available' CHECK (status IN (
        'available', 'reserved', 'completed', 'removed'
    )),
    receiver_preference TEXT DEFAULT 'all' CHECK (receiver_preference IN (
        'all', 'ngo_only', 'high_trust'
    )),
    active_claim_id UUID, -- Will point to the accepted claim
    view_count INT DEFAULT 0 CHECK (view_count >= 0),
    is_flagged BOOLEAN DEFAULT FALSE,
    admin_removed BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================================
-- 3. CLAIMS TABLE (Recipient Requests)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    donor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (char_length(message) >= 50 AND char_length(message) <= 300),
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'declined', 'expired', 'completed', 'cancelled'
    )),
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Complete the circular reference once the tables exist
ALTER TABLE public.listings 
ADD CONSTRAINT fk_active_claim_id 
FOREIGN KEY (active_claim_id) REFERENCES public.claims(id) ON DELETE SET NULL;

-- =====================================================================
-- 4. MESSAGES TABLE (Real-time Chats)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    image_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- 5. REVIEWS TABLE (Ratings)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reviewed_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT CHECK (char_length(comment) <= 200),
    role TEXT NOT NULL CHECK (role IN ('donor_reviewing_receiver', 'receiver_reviewing_donor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure reviewer cannot rate themselves
    CONSTRAINT check_not_self_review CHECK (reviewer_id <> reviewed_id),
    -- Ensure only one review per user per claim
    CONSTRAINT unique_claim_reviewer UNIQUE (claim_id, reviewer_id)
);

-- =====================================================================
-- 6. NOTIFICATIONS TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'new_claim', 'claim_accepted', 'new_message', 
        'pickup_reminder', 'listing_removed', 'account_warning', 'monthly_reset'
    )),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- 7. REPORTS TABLE (Moderation)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reported_listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN (
        'fake_listing', 'spam', 'abuse', 'inappropriate', 'commercial_reselling', 'other'
    )),
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- DATABASE TRIGGERS & FUNCTIONS
-- =====================================================================

-- Trigger: Automatically update updated_at timestamps on update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_claims_updated_at
BEFORE UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Validation Trigger: Enforce max 5 active pending claims per receiver
CREATE OR REPLACE FUNCTION check_active_claims_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_count INT;
BEGIN
    -- Only check on INSERT or if status is changing back to pending
    IF (TG_OP = 'INSERT') OR (NEW.status = 'pending' AND OLD.status <> 'pending') THEN
        SELECT COUNT(*) INTO active_count
        FROM public.claims
        WHERE receiver_id = NEW.receiver_id AND status = 'pending';
        
        IF active_count >= 5 THEN
            RAISE EXCEPTION 'Claim limit reached: You cannot have more than 5 active pending claims simultaneously.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_active_claims_limit
BEFORE INSERT OR UPDATE ON public.claims
FOR EACH ROW EXECUTE FUNCTION check_active_claims_limit();

-- =====================================================================
-- CRON purges and indices
-- =====================================================================

-- Index for searching Listings (Title & Description fuzzy searches)
CREATE INDEX IF NOT EXISTS listings_fuzzy_search_idx ON public.listings USING gin (title gin_trgm_ops, description gin_trgm_ops);

-- Index for Geospatial nearby listings
CREATE INDEX IF NOT EXISTS listings_location_idx ON public.listings USING gist (location);

-- Function to run 60-day chat auto-delete purge
CREATE OR REPLACE FUNCTION purge_expired_chat_messages()
RETURNS void AS $$
BEGIN
    -- Delete messages belonging to claims completed/cancelled/expired > 60 days ago
    DELETE FROM public.messages
    WHERE claim_id IN (
        SELECT id FROM public.claims
        WHERE status IN ('completed', 'cancelled', 'expired', 'declined')
        AND updated_at < (NOW() - INTERVAL '60 days')
    );
END;
$$ LANGUAGE plpgsql;

-- (To schedule this, the Supabase PG_CRON extension can run:
-- SELECT cron.schedule('0 0 * * *', 'SELECT purge_expired_chat_messages();');)

-- =====================================================================
-- RLS POLICIES FOR USERS TABLE
-- =====================================================================

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public profile insertion during sign-up
CREATE POLICY "Allow public insert on users" 
ON public.users 
FOR INSERT 
WITH CHECK (true);

-- Policy: Allow public read of user profiles
CREATE POLICY "Allow public read access on users" 
ON public.users 
FOR SELECT 
USING (true);

-- Policy: Allow users to update only their own profiles
CREATE POLICY "Allow individual update on users" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id);


-- =====================================================================
-- RLS POLICIES FOR LISTINGS TABLE
-- =====================================================================

-- Enable RLS on listings
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read of listings (browsing feed)
CREATE POLICY "Allow public read access on listings" 
ON public.listings 
FOR SELECT 
USING (true);

-- Policy: Allow authenticated users to create listings
CREATE POLICY "Allow authenticated insert on listings" 
ON public.listings 
FOR INSERT 
WITH CHECK (auth.uid() = donor_id);

-- Policy: Allow donors to update their own listings
CREATE POLICY "Allow individual update on listings" 
ON public.listings 
FOR UPDATE 
USING (auth.uid() = donor_id);

-- Policy: Allow donors to delete their own listings
CREATE POLICY "Allow individual delete on listings" 
ON public.listings 
FOR DELETE 
USING (auth.uid() = donor_id);


-- =====================================================================
-- RLS POLICIES FOR CLAIMS, MESSAGES, REVIEWS, NOTIFICATIONS, REPORTS
-- =====================================================================

-- 1. Claims security
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow view relevant claims" 
ON public.claims 
FOR SELECT 
USING (auth.uid() = receiver_id OR EXISTS (
  SELECT 1 FROM public.listings 
  WHERE listings.id = claims.listing_id AND listings.donor_id = auth.uid()
));

CREATE POLICY "Allow authenticated user insert claims" 
ON public.claims 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = receiver_id);

CREATE POLICY "Allow update relevant claims" 
ON public.claims 
FOR UPDATE 
USING (auth.uid() = receiver_id OR EXISTS (
  SELECT 1 FROM public.listings 
  WHERE listings.id = claims.listing_id AND listings.donor_id = auth.uid()
));

-- 2. Messages security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members of claim to select messages" 
ON public.messages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.claims 
  WHERE claims.id = messages.claim_id AND (
    claims.receiver_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = claims.listing_id AND listings.donor_id = auth.uid()
    )
  )
));

CREATE POLICY "Allow members of claim to insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id AND EXISTS (
  SELECT 1 FROM public.claims 
  WHERE claims.id = messages.claim_id AND (
    claims.receiver_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.listings 
      WHERE listings.id = claims.listing_id AND listings.donor_id = auth.uid()
    )
  )
));

-- 3. Reviews security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on reviews" 
ON public.reviews 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated insert on reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (auth.uid() = reviewer_id);

-- 4. Notifications security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 5. Reports security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated insert on reports" 
ON public.reports 
FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);


-- =====================================================================
-- AUTH SYNC TRIGGER FOR PROFILE ROW CREATION (GOOGLE OAUTH & EMAIL)
-- =====================================================================

-- Trigger Function: Automatically sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, date_of_birth, city, area, pincode, gender)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::date, '2000-01-01'::date),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Delhi'),
    COALESCE(NEW.raw_user_meta_data->>'area', 'Delhi'),
    COALESCE(NEW.raw_user_meta_data->>'pincode', ''),
    NEW.raw_user_meta_data->>'gender'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    gender = COALESCE(EXCLUDED.gender, public.users.gender);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();




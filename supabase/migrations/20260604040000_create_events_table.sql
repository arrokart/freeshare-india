-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) >= 10 AND char_length(title) <= 100),
    description TEXT NOT NULL CHECK (char_length(description) >= 20 AND char_length(description) <= 1000),
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location_name TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    pincode TEXT,
    image_url TEXT,
    max_participants INT CHECK (max_participants > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create event RSVPs table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_event_user_rsvp UNIQUE (event_id, user_id)
);

-- Extend reports table to support events moderation
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS reported_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- Enable RLS on events and event_rsvps
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.events
CREATE POLICY "Allow public read access on events" 
ON public.events 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated insert on events" 
ON public.events 
FOR INSERT 
WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Allow organizer update on events" 
ON public.events 
FOR UPDATE 
USING (auth.uid() = organizer_id OR EXISTS (
  SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = true
));

CREATE POLICY "Allow organizer delete on events" 
ON public.events 
FOR DELETE 
USING (auth.uid() = organizer_id OR EXISTS (
  SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = true
));

-- RLS Policies for public.event_rsvps
CREATE POLICY "Allow public read access on event_rsvps" 
ON public.event_rsvps 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated insert on event_rsvps" 
ON public.event_rsvps 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated delete on event_rsvps" 
ON public.event_rsvps 
FOR DELETE 
USING (auth.uid() = user_id);

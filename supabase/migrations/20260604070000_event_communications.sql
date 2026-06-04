-- Migration for Event Communications: Comments & Private Chats

-- 1. Create event comments table (Option A - Public Q&A Comments)
CREATE TABLE IF NOT EXISTS public.event_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) >= 2 AND char_length(content) <= 500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create event inquiries table (Option B - Private Chat Threads)
CREATE TABLE IF NOT EXISTS public.event_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- inquirer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_event_user_inquiry UNIQUE (event_id, user_id)
);

-- 3. Create event inquiry messages table
CREATE TABLE IF NOT EXISTS public.event_inquiry_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_inquiry_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for public.event_comments
CREATE POLICY "Allow public read access on event_comments"
ON public.event_comments FOR SELECT USING (true);

CREATE POLICY "Allow authenticated user insert on event_comments"
ON public.event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow comment author/host/admin delete on event_comments"
ON public.event_comments FOR DELETE USING (
    auth.uid() = user_id OR 
    auth.uid() = (SELECT organizer_id FROM public.events WHERE events.id = event_comments.event_id) OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = true)
);

-- 6. RLS Policies for public.event_inquiries
CREATE POLICY "Allow conversation members select on event_inquiries"
ON public.event_inquiries FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT organizer_id FROM public.events WHERE events.id = event_inquiries.event_id)
);

CREATE POLICY "Allow inquirer insert on event_inquiries"
ON public.event_inquiries FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- 7. RLS Policies for public.event_inquiry_messages
CREATE POLICY "Allow conversation members select on event_inquiry_messages"
ON public.event_inquiry_messages FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.event_inquiries WHERE event_inquiries.id = inquiry_id) OR
    auth.uid() = (SELECT organizer_id FROM public.events WHERE events.id = (SELECT event_id FROM public.event_inquiries WHERE event_inquiries.id = inquiry_id))
);

CREATE POLICY "Allow conversation members insert on event_inquiry_messages"
ON public.event_inquiry_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
        auth.uid() = (SELECT user_id FROM public.event_inquiries WHERE event_inquiries.id = inquiry_id) OR
        auth.uid() = (SELECT organizer_id FROM public.events WHERE events.id = (SELECT event_id FROM public.event_inquiries WHERE event_inquiries.id = inquiry_id))
    )
);

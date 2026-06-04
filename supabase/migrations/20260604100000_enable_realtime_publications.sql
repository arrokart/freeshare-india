-- Enable Supabase Realtime for notifications, messages, claims, and event messages
-- This ensures that the notification bell, chat rooms, and dashboard update instantly without page refresh

-- 1. Ensure the publication exists
CREATE OR REPLACE FUNCTION public.enable_realtime_for_tables()
RETURNS void AS $$
BEGIN
  -- If the supabase_realtime publication doesn't exist, create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    EXECUTE 'CREATE PUBLICATION supabase_realtime';
  END IF;

  -- Add tables to the publication if they are not already part of it
  -- notifications table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE notifications';
  END IF;

  -- messages table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE messages';
  END IF;

  -- claims table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'claims'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE claims';
  END IF;

  -- event_inquiry_messages table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'event_inquiry_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE event_inquiry_messages';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Run the function to enable realtime
SELECT public.enable_realtime_for_tables();

-- Clean up helper function
DROP FUNCTION public.enable_realtime_for_tables();

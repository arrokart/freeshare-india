-- Fix the auth sync trigger to handle cases where OAuth providers (like Google)
-- do not supply date_of_birth, city, or area in raw_user_meta_data.
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

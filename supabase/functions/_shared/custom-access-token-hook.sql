-- Custom access token hook to populate JWT with role and school_code
-- This function runs before a token is issued and adds additional claims

CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_school_code text;
  user_school_name text;
  user_super_admin_code text;
BEGIN
  -- Extract user metadata from the event
  claims := event->'claims';
  
  -- Get user role from app_metadata
  user_role := event->'user'->'app_metadata'->>'role';
  user_school_code := event->'user'->'app_metadata'->>'school_code';
  user_school_name := event->'user'->'app_metadata'->>'school_name';
  user_super_admin_code := event->'user'->'app_metadata'->>'super_admin_code';
  
  -- Add custom claims to the JWT
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  END IF;
  
  IF user_school_code IS NOT NULL THEN
    claims := jsonb_set(claims, '{school_code}', to_jsonb(user_school_code));
  END IF;
  
  IF user_school_name IS NOT NULL THEN
    claims := jsonb_set(claims, '{school_name}', to_jsonb(user_school_name));
  END IF;
  
  IF user_super_admin_code IS NOT NULL THEN
    claims := jsonb_set(claims, '{super_admin_code}', to_jsonb(user_super_admin_code));
  END IF;
  
  -- Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

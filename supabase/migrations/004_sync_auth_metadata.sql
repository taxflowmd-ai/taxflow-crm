-- ============================================================
-- Optimizare middleware: rol + is_active în JWT app_metadata
-- Middleware-ul făcea un query la profiles pe fiecare request.
-- Sincronizăm role/is_active în auth.users.raw_app_meta_data
-- printr-un trigger, iar middleware-ul le citește din user-ul
-- returnat de Auth fără round-trip suplimentar la DB.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', NEW.role, 'is_active', NEW.is_active)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_profile_auth_metadata ON public.profiles;
CREATE TRIGGER sync_profile_auth_metadata
  AFTER INSERT OR UPDATE OF role, is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth_metadata();

-- Backfill pentru conturile existente
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role, 'is_active', p.is_active)
FROM public.profiles p
WHERE p.id = u.id;

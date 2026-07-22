-- ============================================================
-- Fix securitate: escaladare de privilegii pe profiles
-- Problema: politica "profiles_update_own" permitea oricărui
-- utilizator autentificat să-și seteze singur role='admin' sau
-- să-și reactiveze contul (is_active) printr-un UPDATE direct
-- cu cheia anon, ocolind interfața aplicației.
-- ============================================================

-- 1. Trigger care protejează câmpurile sensibile din profiles.
-- RLS nu poate restricționa coloane individuale, deci folosim un
-- BEFORE UPDATE trigger: utilizatorii obișnuiți nu pot modifica
-- role / is_active / email / id; adminii și service_role pot.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Fără utilizator autentificat = context server (service_role,
  -- care oricum ocolește RLS) sau operațiuni administrative directe.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id        IS DISTINCT FROM OLD.id
  OR NEW.role      IS DISTINCT FROM OLD.role
  OR NEW.is_active IS DISTINCT FROM OLD.is_active
  OR NEW.email     IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Nu aveți permisiunea de a modifica aceste câmpuri';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 2. WITH CHECK explicit: rândul rezultat trebuie să rămână al userului
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Elimină citirea publică a invitațiilor.
-- Orice utilizator autentificat putea citi toate token-urile de
-- invitație nefolosite. Verificarea token-ului se face exclusiv în
-- API (accept-invite) cu service_role, care ocolește RLS, deci
-- politica nu e necesară.
DROP POLICY IF EXISTS "invitations_select_token" ON public.invitations;

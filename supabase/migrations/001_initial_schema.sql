-- ============================================================
-- TaxFlow CRM - Schema complet cu Row Level Security
-- Rulează în Supabase SQL Editor
-- ============================================================

-- Extensii necesare
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABEL: profiles (extinde auth.users din Supabase)
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  avatar_color  TEXT DEFAULT '#3a7bd5',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================================
-- TABEL: invitations (sistem de invitații)
-- ============================================================
CREATE TABLE public.invitations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  invited_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL: leads
-- ============================================================
CREATE TABLE public.leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  company       TEXT,
  phone         TEXT,
  email         TEXT,
  source        TEXT DEFAULT 'Meta Ads' CHECK (source IN ('Meta Ads','WhatsApp','Organic','Referință','Site web','Import')),
  status        TEXT DEFAULT 'Nou' CHECK (status IN ('Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut')),
  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note          TEXT,
  reminder_at   TIMESTAMPTZ,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL: lead_history (audit trail)
-- ============================================================
CREATE TABLE public.lead_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id     UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL: tasks
-- ============================================================
CREATE TABLE public.tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  priority      TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  due_at        TIMESTAMPTZ,
  reminder_at   TIMESTAMPTZ,
  is_done       BOOLEAN NOT NULL DEFAULT false,
  done_at       TIMESTAMPTZ,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL: events
-- ============================================================
CREATE TABLE public.events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  type          TEXT DEFAULT 'meeting' CHECK (type IN ('meeting','call','deadline')),
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  location      TEXT,
  note          TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABEL: notifications
-- ============================================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  icon        TEXT DEFAULT '🔔',
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCȚII & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at    BEFORE UPDATE ON public.leads    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tasks_updated_at    BEFORE UPDATE ON public.tasks    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Creare automată profil la înregistrare
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: verifică dacă utilizatorul curent e admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: verifică dacă utilizatorul e activ
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "profiles_select_own"    ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all"     ON public.profiles FOR ALL    USING (public.is_admin());

-- INVITATIONS policies
CREATE POLICY "invitations_admin_all"  ON public.invitations FOR ALL USING (public.is_admin());
CREATE POLICY "invitations_select_token" ON public.invitations FOR SELECT USING (true); -- token verificat în API

-- LEADS policies
-- Admin vede toate, user vede doar ale lui
CREATE POLICY "leads_admin_all"        ON public.leads FOR ALL    USING (public.is_admin());
CREATE POLICY "leads_user_own"         ON public.leads FOR SELECT USING (assigned_to = auth.uid() AND public.is_active_user());
CREATE POLICY "leads_user_insert"      ON public.leads FOR INSERT WITH CHECK (public.is_active_user());
CREATE POLICY "leads_user_update_own"  ON public.leads FOR UPDATE USING (assigned_to = auth.uid() AND public.is_active_user());

-- LEAD_HISTORY policies
CREATE POLICY "history_admin_all"      ON public.lead_history FOR ALL    USING (public.is_admin());
CREATE POLICY "history_user_lead"      ON public.lead_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND assigned_to = auth.uid())
);
CREATE POLICY "history_user_insert"    ON public.lead_history FOR INSERT WITH CHECK (public.is_active_user());

-- TASKS policies
CREATE POLICY "tasks_admin_all"        ON public.tasks FOR ALL    USING (public.is_admin());
CREATE POLICY "tasks_user_own"         ON public.tasks FOR SELECT USING (assigned_to = auth.uid() AND public.is_active_user());
CREATE POLICY "tasks_user_insert"      ON public.tasks FOR INSERT WITH CHECK (public.is_active_user());
CREATE POLICY "tasks_user_update_own"  ON public.tasks FOR UPDATE USING (assigned_to = auth.uid() AND public.is_active_user());

-- EVENTS policies
CREATE POLICY "events_admin_all"       ON public.events FOR ALL    USING (public.is_admin());
CREATE POLICY "events_user_own"        ON public.events FOR SELECT USING (assigned_to = auth.uid() AND public.is_active_user());
CREATE POLICY "events_user_insert"     ON public.events FOR INSERT WITH CHECK (public.is_active_user());

-- NOTIFICATIONS policies
CREATE POLICY "notifs_own"             ON public.notifications FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- INDECȘI pentru performanță
-- ============================================================
CREATE INDEX idx_leads_assigned_to  ON public.leads(assigned_to);
CREATE INDEX idx_leads_status       ON public.leads(status);
CREATE INDEX idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_at       ON public.tasks(due_at);
CREATE INDEX idx_events_starts_at   ON public.events(starts_at);
CREATE INDEX idx_invitations_token  ON public.invitations(token);
CREATE INDEX idx_notifs_user        ON public.notifications(user_id, is_read);

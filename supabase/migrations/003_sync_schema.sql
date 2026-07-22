-- ============================================================
-- Sincronizare schemă: aduce migrațiile la nivelul producției
-- Generat prin introspecția bazei de producție (22.07.2026).
-- Idempotent: poate rula pe o bază nouă (după 001+002) sau pe
-- producție fără efecte secundare.
-- Acoperă modulele adăugate manual prin SQL Editor:
--   Rapoarte & Compliance, Oferte, Calificare client, Banking,
--   WhatsApp, note/istoric extins, sarcini recurente.
-- ============================================================

-- ============================================================
-- 1. EXTINDERI LA TABELE EXISTENTE
-- ============================================================

-- profiles: token pentru feed-ul iCal (sincronizare calendar iOS)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_token UUID DEFAULT gen_random_uuid();

-- leads: date fiscale + valoare estimată/contract
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS idno            TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fiscal_regime   TEXT DEFAULT 'non-TVA';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS employees_count INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contract_value  NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS service_type    TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS value_estimated NUMERIC;

-- leads: status nou "Nu se califică"
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY['Nou','Contactat','Întâlnire programată','Ofertă trimisă','Client activ','Pierdut','Nu se califică']));

CREATE INDEX IF NOT EXISTS idx_leads_idno ON public.leads(idno);

-- lead_history: note structurate (tip + conținut)
ALTER TABLE public.lead_history ADD COLUMN IF NOT EXISTS type       TEXT DEFAULT 'note';
ALTER TABLE public.lead_history ADD COLUMN IF NOT EXISTS content    TEXT;
ALTER TABLE public.lead_history ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_history_created_by_fkey') THEN
    ALTER TABLE public.lead_history
      ADD CONSTRAINT lead_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);
  END IF;
END $$;

-- tasks: sarcini recurente
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_recurring      BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence        VARCHAR(20);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS recurrence_end_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id    UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_check') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_recurrence_check
      CHECK (recurrence::text = ANY (ARRAY['daily','weekly','monthly','quarterly','yearly']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parent_task_id_fkey') THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_done      ON public.tasks(is_done);
CREATE INDEX IF NOT EXISTS idx_tasks_lead      ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON public.tasks(is_recurring) WHERE is_recurring = true;

-- Curățenie: index duplicat (același cu idx_tasks_assigned_to din 001)
DROP INDEX IF EXISTS public.idx_tasks_assigned;

-- ============================================================
-- 2. MODUL RAPOARTE & COMPLIANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.report_types (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(20) NOT NULL UNIQUE,
  label          VARCHAR(100) NOT NULL,
  description    TEXT,
  sort_order     INTEGER DEFAULT 0,
  frequency      TEXT,
  deadline_day   INTEGER,
  deadline_month INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_obligations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  report_type_id UUID NOT NULL REFERENCES public.report_types(id) ON DELETE CASCADE,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, report_type_id)
);

CREATE TABLE IF NOT EXISTS public.compliance_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  report_type_id UUID NOT NULL REFERENCES public.report_types(id) ON DELETE CASCADE,
  year           INTEGER NOT NULL,
  month          INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status         VARCHAR(20) DEFAULT 'pending' CHECK (status::text = ANY (ARRAY['pending','in_progress','done','na'])),
  note           TEXT,
  completed_at   TIMESTAMPTZ,
  completed_by   UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lead_id, report_type_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_obligations_lead  ON public.client_obligations(lead_id);
CREATE INDEX IF NOT EXISTS idx_compliance_lead   ON public.compliance_reports(lead_id);
CREATE INDEX IF NOT EXISTS idx_compliance_period ON public.compliance_reports(year, month);

-- ============================================================
-- 3. MODUL OFERTE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offer_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  package_type TEXT,
  tagline      TEXT,
  audience     TEXT,
  price_min    NUMERIC,
  price_max    NUMERIC,
  price_unit   TEXT DEFAULT 'MDL/lună',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active    BOOLEAN DEFAULT true,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES public.offer_templates(id),
  status          TEXT DEFAULT 'draft',
  sector          TEXT,
  problems_json   JSONB DEFAULT '[]'::jsonb,
  content_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  excluded_json   JSONB DEFAULT '[]'::jsonb,
  price           NUMERIC,
  price_unit      TEXT DEFAULT 'MDL/lună',
  contract_months INTEGER DEFAULT 6,
  valid_until     DATE,
  pdf_url         TEXT,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_lead_id ON public.offers(lead_id);
CREATE INDEX IF NOT EXISTS idx_offers_status  ON public.offers(status);

-- ============================================================
-- 4. MODUL CALIFICARE CLIENT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_qualifications (
  lead_id                  UUID PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  employees                TEXT,
  revenue                  TEXT,
  vat_regime               TEXT,
  activities_count         TEXT,
  monthly_documents        TEXT,
  current_reporting        TEXT,
  financial_decision_basis TEXT,
  financial_manager        TEXT,
  main_expectation         TEXT,
  delegation_level         TEXT,
  structure_reaction       TEXT,
  special_project          TEXT,
  score_dimension          INTEGER,
  score_complexity         INTEGER,
  score_maturity           INTEGER,
  score_fit                INTEGER,
  overall_score            INTEGER,
  recommended_package      TEXT,
  risk_flags               TEXT,
  updated_by               UUID REFERENCES public.profiles(id),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. MODUL BANKING
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_banking (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  bank_name  TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_banking_users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banking_id          UUID NOT NULL REFERENCES public.client_banking(id) ON DELETE CASCADE,
  label               TEXT NOT NULL DEFAULT 'Utilizator 1',
  login               TEXT,
  password            TEXT,
  password_envelope   TEXT,
  notes               TEXT,
  is_active           BOOLEAN DEFAULT true,
  password_updated_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_banking_lead_id          ON public.client_banking(lead_id);
CREATE INDEX IF NOT EXISTS idx_client_banking_users_banking_id ON public.client_banking_users(banking_id);

-- ============================================================
-- 6. MODUL WHATSAPP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  wa_phone        VARCHAR(30) NOT NULL UNIQUE,
  wa_name         VARCHAR(200),
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count    INTEGER DEFAULT 0,
  is_archived     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id   VARCHAR(200) UNIQUE,
  direction       VARCHAR(10) NOT NULL CHECK (direction::text = ANY (ARRAY['inbound','outbound'])),
  message_type    VARCHAR(20) DEFAULT 'text',
  body            TEXT,
  media_url       TEXT,
  media_mime_type VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'sent',
  sent_by         UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_lead    ON public.whatsapp_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone   ON public.whatsapp_conversations(wa_phone);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv     ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_created  ON public.whatsapp_messages(created_at DESC);

-- ============================================================
-- 7. VIEW & FUNCȚII & TRIGGERE
-- ============================================================

-- Ultima notă per lead (folosit în Pipeline)
CREATE OR REPLACE VIEW public.lead_latest_note AS
  SELECT DISTINCT ON (lead_id) lead_id, content, action, created_at, created_by
  FROM public.lead_history
  WHERE type = 'note'
  ORDER BY lead_id, created_at DESC;

-- Variantă istorică a lui update_updated_at (folosită de trigger-ul WA)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wa_conv_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER update_wa_conv_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. ROW LEVEL SECURITY pentru tabelele noi
-- ============================================================

ALTER TABLE public.report_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_obligations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_qualifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_banking         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_banking_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages      ENABLE ROW LEVEL SECURITY;

-- REPORT_TYPES
DROP POLICY IF EXISTS "Active users read report_types" ON public.report_types;
CREATE POLICY "Active users read report_types" ON public.report_types FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_active = true));

-- CLIENT_OBLIGATIONS
DROP POLICY IF EXISTS "Active users manage obligations" ON public.client_obligations;
CREATE POLICY "Active users manage obligations" ON public.client_obligations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_active = true));

-- COMPLIANCE_REPORTS
DROP POLICY IF EXISTS "Active users manage compliance" ON public.compliance_reports;
CREATE POLICY "Active users manage compliance" ON public.compliance_reports FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_active = true));

-- OFFER_TEMPLATES (scriere doar prin service_role)
DROP POLICY IF EXISTS "templates_select_all" ON public.offer_templates;
CREATE POLICY "templates_select_all" ON public.offer_templates FOR SELECT USING (true);

-- OFFERS
DROP POLICY IF EXISTS "offers_select_own" ON public.offers;
CREATE POLICY "offers_select_own" ON public.offers FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = offers.lead_id AND leads.assigned_to = auth.uid())
  );
DROP POLICY IF EXISTS "offers_insert_own" ON public.offers;
CREATE POLICY "offers_insert_own" ON public.offers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "offers_update_own" ON public.offers;
CREATE POLICY "offers_update_own" ON public.offers FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
DROP POLICY IF EXISTS "offers_delete_admin" ON public.offers;
CREATE POLICY "offers_delete_admin" ON public.offers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- CLIENT_QUALIFICATIONS
DROP POLICY IF EXISTS "qualifications_select" ON public.client_qualifications;
CREATE POLICY "qualifications_select" ON public.client_qualifications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = client_qualifications.lead_id AND leads.assigned_to = auth.uid())
  );
DROP POLICY IF EXISTS "qualifications_upsert" ON public.client_qualifications;
CREATE POLICY "qualifications_upsert" ON public.client_qualifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "qualifications_update" ON public.client_qualifications;
CREATE POLICY "qualifications_update" ON public.client_qualifications FOR UPDATE USING (auth.uid() IS NOT NULL);

-- CLIENT_BANKING
DROP POLICY IF EXISTS "banking_select" ON public.client_banking;
CREATE POLICY "banking_select" ON public.client_banking FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = client_banking.lead_id AND leads.assigned_to = auth.uid())
  );
DROP POLICY IF EXISTS "banking_insert" ON public.client_banking;
CREATE POLICY "banking_insert" ON public.client_banking FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = client_banking.lead_id AND leads.assigned_to = auth.uid())
  );
DROP POLICY IF EXISTS "banking_update" ON public.client_banking;
CREATE POLICY "banking_update" ON public.client_banking FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = client_banking.lead_id AND leads.assigned_to = auth.uid())
  );
DROP POLICY IF EXISTS "banking_delete" ON public.client_banking;
CREATE POLICY "banking_delete" ON public.client_banking FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- CLIENT_BANKING_USERS
DROP POLICY IF EXISTS "banking_users_select" ON public.client_banking_users;
CREATE POLICY "banking_users_select" ON public.client_banking_users FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.client_banking cb
    WHERE cb.id = client_banking_users.banking_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = cb.lead_id AND leads.assigned_to = auth.uid())
      )
  ));
DROP POLICY IF EXISTS "banking_users_insert" ON public.client_banking_users;
CREATE POLICY "banking_users_insert" ON public.client_banking_users FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_banking cb
    WHERE cb.id = client_banking_users.banking_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = cb.lead_id AND leads.assigned_to = auth.uid())
      )
  ));
DROP POLICY IF EXISTS "banking_users_update" ON public.client_banking_users;
CREATE POLICY "banking_users_update" ON public.client_banking_users FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.client_banking cb
    WHERE cb.id = client_banking_users.banking_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = cb.lead_id AND leads.assigned_to = auth.uid())
      )
  ));
DROP POLICY IF EXISTS "banking_users_delete" ON public.client_banking_users;
CREATE POLICY "banking_users_delete" ON public.client_banking_users FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.client_banking cb
    WHERE cb.id = client_banking_users.banking_id
      AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ));

-- WHATSAPP
DROP POLICY IF EXISTS "Active users see conversations" ON public.whatsapp_conversations;
CREATE POLICY "Active users see conversations" ON public.whatsapp_conversations FOR ALL USING (public.is_active_user());
DROP POLICY IF EXISTS "Active users see messages" ON public.whatsapp_messages;
CREATE POLICY "Active users see messages" ON public.whatsapp_messages FOR ALL USING (public.is_active_user());

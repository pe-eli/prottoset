-- Prottoset PostgreSQL Schema with Row Level Security
-- Run: npm run db:init

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS productivity CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TYPE IF EXISTS schedule_category;
DROP TYPE IF EXISTS daily_rating;

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new','contacted','replied','converted','ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_priority AS ENUM ('HIGH','MEDIUM','LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_status AS ENUM ('new','contacted','negotiating','client','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_channel AS ENUM ('email','whatsapp','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_message_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('pix','transferencia','parcelamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE folder_color AS ENUM ('blue','emerald','amber','violet','rose','sky','teal','orange');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE outbound_channel AS ENUM ('email','whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE outbound_run_status AS ENUM ('queued','validating','running','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE outbound_run_status ADD VALUE IF NOT EXISTS 'retrying';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE outbound_item_status AS ENUM ('pending','sending','sent','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- GLOBAL TABLES (no RLS)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  google_id TEXT UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  verification_code_hash TEXT,
  verification_code_expires_at TIMESTAMPTZ,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;

-- Backward compatibility for instances that still have token-based columns.
ALTER TABLE users DROP COLUMN IF EXISTS verification_token_hash;
ALTER TABLE users DROP COLUMN IF EXISTS verification_expires_at;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE NOT revoked;

CREATE TABLE IF NOT EXISTS quota_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quota_key TEXT NOT NULL,
  daily_limit INTEGER NOT NULL CHECK (daily_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, quota_key)
);

CREATE INDEX IF NOT EXISTS idx_quota_limits_key ON quota_limits (quota_key);

CREATE TABLE IF NOT EXISTS quota_usage (
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quota_key TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, quota_key, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_quota_usage_date ON quota_usage (usage_date);

INSERT INTO quota_limits (tenant_id, quota_key, daily_limit)
VALUES
  (NULL, 'email_blasts_daily', 20),
  (NULL, 'email_messages_daily', 50),
  (NULL, 'whatsapp_blasts_daily', 20),
  (NULL, 'scrape_requests_daily', 100),
  (NULL, 'free_leads_daily', 50),
  (NULL, 'pdf_generations_daily', 50)
ON CONFLICT (tenant_id, quota_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS outbound_runs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel outbound_channel NOT NULL,
  status outbound_run_status NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'queued',
  subject TEXT,
  body TEXT,
  prompt_base TEXT,
  message_mode TEXT NOT NULL DEFAULT 'ai' CHECK (message_mode IN ('ai', 'manual')),
  manual_message TEXT,
  personalization_enabled BOOLEAN NOT NULL DEFAULT false,
  personalization_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  pain_points TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  batch_size INTEGER NOT NULL CHECK (batch_size > 0 AND batch_size <= 50),
  interval_min_seconds INTEGER NOT NULL CHECK (interval_min_seconds >= 5),
  interval_max_seconds INTEGER NOT NULL CHECK (interval_max_seconds >= interval_min_seconds),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  sent INTEGER NOT NULL DEFAULT 0 CHECK (sent >= 0),
  failed INTEGER NOT NULL DEFAULT 0 CHECK (failed >= 0),
  skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped >= 0),
  current_batch INTEGER,
  total_batches INTEGER,
  current_message TEXT,
  validation_error TEXT,
  last_error TEXT,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE outbound_runs ADD COLUMN IF NOT EXISTS message_mode TEXT NOT NULL DEFAULT 'ai';
ALTER TABLE outbound_runs ADD COLUMN IF NOT EXISTS manual_message TEXT;
ALTER TABLE outbound_runs ADD COLUMN IF NOT EXISTS personalization_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE outbound_runs ADD COLUMN IF NOT EXISTS personalization_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE outbound_runs ADD COLUMN IF NOT EXISTS pain_points TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outbound_runs_message_mode_check'
  ) THEN
    ALTER TABLE outbound_runs
      ADD CONSTRAINT outbound_runs_message_mode_check CHECK (message_mode IN ('ai', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outbound_runs_tenant ON outbound_runs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_runs_status ON outbound_runs (status);

ALTER TABLE outbound_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbound_runs_tenant ON outbound_runs;
CREATE POLICY outbound_runs_tenant ON outbound_runs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE TABLE IF NOT EXISTS outbound_run_items (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES outbound_runs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  status outbound_item_status NOT NULL DEFAULT 'pending',
  error TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, target)
);

CREATE INDEX IF NOT EXISTS idx_outbound_run_items_run ON outbound_run_items (run_id, id);
CREATE INDEX IF NOT EXISTS idx_outbound_run_items_tenant ON outbound_run_items (tenant_id, status);

ALTER TABLE outbound_run_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbound_run_items_tenant ON outbound_run_items;
CREATE POLICY outbound_run_items_tenant ON outbound_run_items
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ============================================================
-- TENANT-SCOPED TABLES (with RLS)
-- ============================================================

-- LEADS
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  website_fetch_error BOOLEAN NOT NULL DEFAULT false,
  email1 TEXT NOT NULL DEFAULT '',
  email2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  has_website BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  niche TEXT NOT NULL DEFAULT '',
  priority lead_priority NOT NULL DEFAULT 'LOW',
  status lead_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_dedup ON leads (tenant_id, lower(name), lower(address));

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_tenant ON leads;
CREATE POLICY leads_tenant ON leads
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- LEAD FOLDERS
CREATE TABLE IF NOT EXISTS lead_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color folder_color NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_folders_tenant ON lead_folders (tenant_id);

ALTER TABLE lead_folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_folders_tenant ON lead_folders;
CREATE POLICY lead_folders_tenant ON lead_folders
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- LEAD FOLDER ↔ LEADS (junction table)
CREATE TABLE IF NOT EXISTS lead_folder_leads (
  folder_id UUID NOT NULL REFERENCES lead_folders(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (folder_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_folder_leads_tenant ON lead_folder_leads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_folder_leads_lead ON lead_folder_leads (lead_id);

ALTER TABLE lead_folder_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lfl_tenant ON lead_folder_leads;
CREATE POLICY lfl_tenant ON lead_folder_leads
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  status contact_status NOT NULL DEFAULT 'new',
  notes TEXT NOT NULL DEFAULT '',
  channel contact_channel,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts (tenant_id, lower(email)) WHERE email != '';
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (tenant_id, phone) WHERE phone != '';

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_tenant ON contacts;
CREATE POLICY contacts_tenant ON contacts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- CONTACT MESSAGES (conversation history)
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel contact_channel NOT NULL DEFAULT 'whatsapp',
  direction contact_message_direction NOT NULL,
  content TEXT NOT NULL,
  external_id TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_contact ON contact_messages (tenant_id, contact_id, sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_messages_external
  ON contact_messages (tenant_id, contact_id, external_id)
  WHERE external_id != '';

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_messages_tenant ON contact_messages;
CREATE POLICY contact_messages_tenant ON contact_messages
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- QUEUES (phone queues)
CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queues_tenant ON queues (tenant_id);

ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS queues_tenant ON queues;
CREATE POLICY queues_tenant ON queues
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- QUEUE ↔ PHONES (replaces phones[] array)
CREATE TABLE IF NOT EXISTS queue_phones (
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (queue_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_queue_phones_tenant ON queue_phones (tenant_id);

ALTER TABLE queue_phones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS queue_phones_tenant ON queue_phones;
CREATE POLICY queue_phones_tenant ON queue_phones
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- QUOTES (JSONB for nested objects)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client JSONB NOT NULL DEFAULT '{}',
  project JSONB NOT NULL DEFAULT '{}',
  services JSONB NOT NULL DEFAULT '[]',
  extras JSONB NOT NULL DEFAULT '[]',
  payment JSONB NOT NULL DEFAULT '{}',
  subtotal_services NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal_extras NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes (tenant_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quotes_tenant ON quotes;
CREATE POLICY quotes_tenant ON quotes
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ─── WHATSAPP INSTANCES (global — no RLS, looked up by webhook) ───

DO $$ BEGIN
  CREATE TYPE wa_instance_status AS ENUM ('connecting','connected','disconnected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE wa_instance_status ADD VALUE IF NOT EXISTS 'created';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE wa_instance_status ADD VALUE IF NOT EXISTS 'webhook_pending';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  status        wa_instance_status NOT NULL DEFAULT 'disconnected',
  phone         TEXT,
  qr_code       TEXT,
  qr_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_instance_per_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_instances_tenant ON whatsapp_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_instances_name ON whatsapp_instances(instance_name);

-- ─── SUBSCRIPTIONS (global — no RLS) ───
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  mp_subscription_id TEXT,
  mp_payer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON subscriptions (user_id) WHERE status IN ('active', 'pending');
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_id
  ON subscriptions (mp_subscription_id) WHERE mp_subscription_id IS NOT NULL;

-- ─── SUBSCRIPTION USAGE (global — no RLS) ───
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  leads_used INTEGER NOT NULL DEFAULT 0 CHECK (leads_used >= 0),
  whatsapp_used INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp_used >= 0),
  emails_used INTEGER NOT NULL DEFAULT 0 CHECK (emails_used >= 0),
  quotes_used INTEGER NOT NULL DEFAULT 0 CHECK (quotes_used >= 0),
  ai_credits_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_credits_used >= 0),
  UNIQUE (user_id, month)
);

ALTER TABLE subscription_usage ADD COLUMN IF NOT EXISTS ai_credits_used INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_subscription_usage_user
  ON subscription_usage (user_id, month DESC);

-- ─── WEBHOOK SECURITY / IDEMPOTENCY ───
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processed | failed
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status
  ON webhook_events (provider, status, received_at DESC);

CREATE TABLE IF NOT EXISTS processed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_provider_processed
  ON processed_webhooks (provider, processed_at DESC);

CREATE TABLE IF NOT EXISTS webhook_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (provider, nonce)
);

CREATE INDEX IF NOT EXISTS idx_webhook_nonces_exp
  ON webhook_nonces (provider, expires_at);

-- ─── BILLING LEDGER (idempotent) ───
CREATE TABLE IF NOT EXISTS billing_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  consumption_type TEXT NOT NULL, -- AI | EMAIL | WHATSAPP | PDF
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processed | failed
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  UNIQUE (tenant_id, idempotency_key)
);

ALTER TABLE billing_consumptions DROP CONSTRAINT IF EXISTS billing_consumptions_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_consumptions_tenant_idempotency
  ON billing_consumptions (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_billing_consumptions_tenant_created
  ON billing_consumptions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_consumptions_status
  ON billing_consumptions (status, created_at DESC);

-- ─── CREDIT LEDGER (transactional reservations/commits/refunds) ───
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMMITTED', 'FAILED', 'REFUNDED')),
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  UNIQUE (tenant_id, idempotency_key)
);

ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_idempotency_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_tenant_idempotency
  ON credit_transactions (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant_created
  ON credit_transactions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_status
  ON credit_transactions (status, created_at DESC);

-- ─── INTEGRATION VAULT ───
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider
  ON tenant_integrations (provider, updated_at DESC);

-- ─── OUTBOX (transactional dispatch) ───
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_available
  ON outbox_events (status, available_at, created_at);

-- ─── AUDIT LOGS ───
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  correlation_id TEXT,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs (action, created_at DESC);

-- ─── ANTI-FRAUD EVENTS / BLOCKS ───
CREATE TABLE IF NOT EXISTS fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_tenant_created
  ON fraud_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_events_type_created
  ON fraud_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_security_blocks (
  tenant_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HARDENED RLS POLICIES (tenant/user isolation + explicit system bypass)
-- ============================================================

-- Force RLS on already tenant-scoped tables.
ALTER TABLE outbound_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE outbound_run_items FORCE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_folders FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_folder_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE contact_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE queues FORCE ROW LEVEL SECURITY;
ALTER TABLE queue_phones FORCE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;

-- Quotas.
ALTER TABLE quota_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_limits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quota_limits_tenant ON quota_limits;
CREATE POLICY quota_limits_tenant ON quota_limits
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quota_usage_tenant ON quota_usage;
CREATE POLICY quota_usage_tenant ON quota_usage
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

-- WhatsApp instances.
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_instances_tenant ON whatsapp_instances;
CREATE POLICY whatsapp_instances_tenant ON whatsapp_instances
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

-- Subscriptions.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_user_scope ON subscriptions;
CREATE POLICY subscriptions_user_scope ON subscriptions
  USING (
    user_id = current_setting('app.current_user', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    user_id = current_setting('app.current_user', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_usage_user_scope ON subscription_usage;
CREATE POLICY subscription_usage_user_scope ON subscription_usage
  USING (
    user_id = current_setting('app.current_user', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    user_id = current_setting('app.current_user', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

-- Billing and integration tables.
ALTER TABLE billing_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_consumptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_consumptions_tenant ON billing_consumptions;
CREATE POLICY billing_consumptions_tenant ON billing_consumptions
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_transactions_tenant ON credit_transactions;
CREATE POLICY credit_transactions_tenant ON credit_transactions
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_integrations_tenant ON tenant_integrations;
CREATE POLICY tenant_integrations_tenant ON tenant_integrations
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outbox_events_tenant ON outbox_events;
CREATE POLICY outbox_events_tenant ON outbox_events
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

-- Security/audit telemetry.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_tenant ON audit_logs;
CREATE POLICY audit_logs_tenant ON audit_logs
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fraud_events_tenant ON fraud_events;
CREATE POLICY fraud_events_tenant ON fraud_events
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

ALTER TABLE tenant_security_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_security_blocks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_security_blocks_tenant ON tenant_security_blocks;
CREATE POLICY tenant_security_blocks_tenant ON tenant_security_blocks
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR current_setting('app.security_bypass', true) = 'true'
  );

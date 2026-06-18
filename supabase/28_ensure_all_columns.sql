-- =====================================================================
-- RSG CRM – 28_ensure_all_columns.sql
-- =====================================================================
-- DEFINITIVE Persistenz-Absicherung: ergänzt JEDE Spalte, die irgendeine
-- Eingabemaske schreibt. Additiv & idempotent – vorhandene Spalten bleiben
-- unverändert, fehlende werden ergänzt. Danach kann KEIN Feld mehr still
-- verworfen werden ("Daten weg"-Problem endgültig behoben).
-- Im Supabase SQL-Editor ausführen.
-- =====================================================================

-- ── Accounts (Kundenmaske) ───────────────────────────────────────────
alter table public.accounts add column if not exists branche            text;
alter table public.accounts add column if not exists segment            text;
alter table public.accounts add column if not exists line               text;
alter table public.accounts add column if not exists lifecycle          text;
alter table public.accounts add column if not exists contact_name       text;
alter table public.accounts add column if not exists contact_email      text;
alter table public.accounts add column if not exists contact_phone      text;
alter table public.accounts add column if not exists mrr                numeric default 0;
alter table public.accounts add column if not exists ort                text;
alter table public.accounts add column if not exists strasse            text;
alter table public.accounts add column if not exists plz                text;
alter table public.accounts add column if not exists country            text;
alter table public.accounts add column if not exists owner              text;
alter table public.accounts add column if not exists since              date;
alter table public.accounts add column if not exists external_id        text;
alter table public.accounts add column if not exists last_activity_at   timestamptz;
alter table public.accounts add column if not exists engagement_type    text;
alter table public.accounts add column if not exists contract_status    text;
alter table public.accounts add column if not exists contract_signed_at date;
alter table public.accounts add column if not exists fee_agreement      text;

-- ── Kandidaten (Kandidatenmaske) ─────────────────────────────────────
alter table public.candidates add column if not exists salutation          text;
alter table public.candidates add column if not exists title               text;
alter table public.candidates add column if not exists email               text;
alter table public.candidates add column if not exists phone               text;
alter table public.candidates add column if not exists mandate_id          text;
alter table public.candidates add column if not exists location            text;
alter table public.candidates add column if not exists zip                 text;
alter table public.candidates add column if not exists willing_to_relocate boolean;
alter table public.candidates add column if not exists travel_willingness  text;
alter table public.candidates add column if not exists salary_expectation  numeric;
alter table public.candidates add column if not exists availability        text;
alter table public.candidates add column if not exists birth_date          date;
alter table public.candidates add column if not exists current_employer    text;
alter table public.candidates add column if not exists languages           text;
alter table public.candidates add column if not exists experience_years    integer;
alter table public.candidates add column if not exists rating              integer;
alter table public.candidates add column if not exists tags                text[];
alter table public.candidates add column if not exists skills              text[];
alter table public.candidates add column if not exists photo_path          text;
alter table public.candidates add column if not exists cv_path             text;
alter table public.candidates add column if not exists cv_filename         text;
alter table public.candidates add column if not exists cv_uploaded_at      timestamptz;
alter table public.candidates add column if not exists candidate_no        integer;

-- ── Recruiting-Mandate (Personalvermittlung) ─────────────────────────
alter table public.recruiting_mandates add column if not exists positions              integer default 1;
alter table public.recruiting_mandates add column if not exists filled                 integer default 0;
alter table public.recruiting_mandates add column if not exists status                 text;
alter table public.recruiting_mandates add column if not exists pricing_model          text;
alter table public.recruiting_mandates add column if not exists fee                    numeric;
alter table public.recruiting_mandates add column if not exists target_salary          numeric;
alter table public.recruiting_mandates add column if not exists fee_percent            numeric;
alter table public.recruiting_mandates add column if not exists deposit                numeric;
alter table public.recruiting_mandates add column if not exists split_payment          boolean;
alter table public.recruiting_mandates add column if not exists job_posting            text;
alter table public.recruiting_mandates add column if not exists job_posting_anonymized text;
alter table public.recruiting_mandates add column if not exists share_token            text;
alter table public.recruiting_mandates add column if not exists candidate_count        integer default 0;
alter table public.recruiting_mandates add column if not exists deadline               date;
alter table public.recruiting_mandates add column if not exists deposit_paid           boolean default false;
alter table public.recruiting_mandates add column if not exists deposit_paid_at        date;
alter table public.recruiting_mandates add column if not exists final_paid             boolean default false;
alter table public.recruiting_mandates add column if not exists final_paid_at          date;

-- ── KI-Projekte (KI & Telefonassistenz) ──────────────────────────────
alter table public.ki_projects add column if not exists product          text;
alter table public.ki_projects add column if not exists segment          text;
alter table public.ki_projects add column if not exists status           text;
alter table public.ki_projects add column if not exists mrr              numeric default 0;
alter table public.ki_projects add column if not exists setup_fee        numeric;
alter table public.ki_projects add column if not exists go_live          date;
alter table public.ki_projects add column if not exists health           text;
alter table public.ki_projects add column if not exists use_case         text;
alter table public.ki_projects add column if not exists project_manager  text;
alter table public.ki_projects add column if not exists kickoff_date     date;
alter table public.ki_projects add column if not exists decision_maker   text;
alter table public.ki_projects add column if not exists tech_contact     text;
alter table public.ki_projects add column if not exists contract_start   date;
alter table public.ki_projects add column if not exists contract_end     date;
alter table public.ki_projects add column if not exists term_months      integer;
alter table public.ki_projects add column if not exists billing_cycle    text;
alter table public.ki_projects add column if not exists auto_renew       boolean;
alter table public.ki_projects add column if not exists churn_risk       text;
alter table public.ki_projects add column if not exists nps              integer;
alter table public.ki_projects add column if not exists upsell_potential text;
alter table public.ki_projects add column if not exists upsell_value     numeric;

-- ── Verkaufschancen (Sales-Pipeline) ─────────────────────────────────
alter table public.opportunities add column if not exists value          numeric;
alter table public.opportunities add column if not exists value_type     text;
alter table public.opportunities add column if not exists probability    integer;
alter table public.opportunities add column if not exists owner          text;
alter table public.opportunities add column if not exists expected_close date;

-- ── Aufgaben / Kontakte / Notizen (Sub-Entitäten) ────────────────────
alter table public.crm_tasks         add column if not exists due_time        text;
alter table public.crm_tasks         add column if not exists notes           text;
alter table public.crm_tasks         add column if not exists google_event_id text;
alter table public.account_contacts  add column if not exists salutation      text;
alter table public.account_contacts  add column if not exists title           text;
alter table public.account_contacts  add column if not exists role            text;
alter table public.candidate_notes   add column if not exists kind            text;

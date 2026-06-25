-- =====================================================================
-- RSG CRM – 32_fonio_call_result.sql
-- =====================================================================
-- Ergänzt fonio_calls um die Ergebnis-Felder eines abgeschlossenen Anrufs
-- (Transkript, KI-Zusammenfassung, Dauer, Outcome). Befüllt durch den Fonio-
-- Webhook (/api/fonio/webhook). STRIKT ADDITIV, idempotent.
-- =====================================================================

begin;

alter table public.fonio_calls add column if not exists call_ref         text;
alter table public.fonio_calls add column if not exists transcript       text;
alter table public.fonio_calls add column if not exists summary          text;
alter table public.fonio_calls add column if not exists duration_seconds integer;
alter table public.fonio_calls add column if not exists outcome          text;
alter table public.fonio_calls add column if not exists ended_at         timestamptz;

create index if not exists idx_fonio_calls_to_number on public.fonio_calls(to_number, created_at desc);
create index if not exists idx_fonio_calls_ref       on public.fonio_calls(call_ref);

commit;

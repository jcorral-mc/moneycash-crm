-- ════════════════════════════════════════════════════════════════
--  FASE 5 · COBRANZA — Revisión con gerencia (escalamiento + checklist)
--  Réplica de la hoja REVISION_COBRANZA del Apps Script.
--  Flujo: ejecutivo escala (checklist 3 puntos) → EN REVISION →
--         gerente/admin resuelve (REGULARIZADO / JURIDICO / RESUELTO).
--  Correr en Supabase → SQL Editor → pegar todo → Run.
--  (Las advertencias de "destructive/RLS" son normales: Run anyway.)
-- ════════════════════════════════════════════════════════════════

create table if not exists revision_cobranza (
  id              bigint generated always as identity primary key,
  cliente         text,
  ejecutivo       text,
  fecha_escalado  date default current_date,
  escalo          text,                      -- quién lo escaló
  llamo_cliente   boolean default false,     -- checklist 3 puntos
  llamo_ref       boolean default false,
  visito_dom      boolean default false,
  estatus         text default 'EN REVISION',-- EN REVISION / REGULARIZADO / ENVIADO A JURIDICO / RESUELTO / EN AUTORIZACION
  resuelto_por    text,
  nota            text,
  created_at      timestamptz default now()
);
create index if not exists idx_rev_cliente on revision_cobranza(cliente);
create index if not exists idx_rev_estatus on revision_cobranza(estatus);

-- RLS: todos los autenticados ven los casos; escalar (insert) lo puede hacer
-- cualquier rol operativo; resolver (update) solo Admin/Gerente.
alter table revision_cobranza enable row level security;

drop policy if exists rev_sel on revision_cobranza;
create policy rev_sel on revision_cobranza for select to authenticated
  using (true);

drop policy if exists rev_ins on revision_cobranza;
create policy rev_ins on revision_cobranza for insert to authenticated
  with check (auth_rol() in ('ADMIN','GERENTE','EJECUTIVO','JURIDICO','AUX_ADMIN'));

drop policy if exists rev_upd on revision_cobranza;
create policy rev_upd on revision_cobranza for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE')) with check (true);

-- FIN fase5_cobranza_revision.sql

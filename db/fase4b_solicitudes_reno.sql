-- ════════════════════════════════════════════════════════════════
-- FASE 4B · SOLICITUDES DE RENOVACIÓN / REACTIVACIÓN
-- El ejecutivo cotiza una reno/react y manda solicitud al gerente.
-- El gerente la autoriza → se crea el prospecto en Tubería "Listo para Surtir".
-- Correr DESPUÉS de fase4_tuberia.sql.
-- ════════════════════════════════════════════════════════════════
drop table if exists solicitudes_reno cascade;
create table solicitudes_reno (
  id            bigint generated always as identity primary key,
  tipo          text default 'RENOVACION',        -- RENOVACION / REACTIVACION
  cliente       text not null,                     -- cliente actual en cartera
  ejecutivo     text,
  saldo_actual  numeric(14,2) default 0,           -- adeudo real al solicitar
  capital       numeric(14,2) default 0,
  monto_nuevo   numeric(14,2) default 0,
  plazo         int default 1,
  frecuencia    text,
  tipo_cred     text,                              -- PERSONAL/CONVENIO/GOBIERNO/AMERICANO
  comision      numeric(14,2) default 0,
  financiar     boolean default false,
  abono_puntual   numeric(14,2) default 0,
  abono_impuntual numeric(14,2) default 0,
  deposito      numeric(14,2) default 0,
  solicitante   text,
  cotizacion_json jsonb,
  estatus       text default 'PENDIENTE',          -- PENDIENTE / APROBADO / RECHAZADO
  resuelto_por  text,
  notas         text,
  fecha         timestamptz default now()
);
create index idx_solreno_estatus on solicitudes_reno(estatus);

alter table solicitudes_reno enable row level security;
create policy solreno_sel on solicitudes_reno for select to authenticated using (true);
create policy solreno_ins on solicitudes_reno for insert to authenticated with check (true);
create policy solreno_upd on solicitudes_reno for update to authenticated using (auth_rol() in ('ADMIN','GERENTE')) with check (true);
create policy solreno_del on solicitudes_reno for delete to authenticated using (auth_rol() in ('ADMIN','GERENTE'));

-- FIN fase4b_solicitudes_reno.sql

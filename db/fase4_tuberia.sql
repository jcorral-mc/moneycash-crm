-- ════════════════════════════════════════════════════════════════
-- FASE 4 · MÓDULO TUBERÍA (cotizador + pipeline de prospectos)
-- Pipeline: Prospecto/Nuevo → Contacto/Evaluación → Checklist → Docs →
--           Revisión → Visita → Listo para Surtir → Surtidos (a cartera).
-- Correr DESPUÉS de schema_fase1.sql.
-- ════════════════════════════════════════════════════════════════
drop table if exists prospectos cascade;
create table prospectos (
  id            bigint generated always as identity primary key,
  prospect_id   text unique,                  -- folio legible (NOMBRE-SUCURSAL-####)
  nombre        text not null,
  telefono      text,
  sucursal      text,
  ejecutivo     text,
  status        text default 'Prospecto / Nuevo',
  -- datos de cotización
  monto         numeric(14,2) default 0,
  plazo         int default 1,
  frecuencia    text,                          -- SEMANAL / QUINCENAL / MENSUAL
  tipo          text,                          -- PERSONAL / CONVENIO / GOBIERNO / AMERICANO
  comision      numeric(14,2) default 0,
  financiar     boolean default false,         -- true = sumada; false = descontada
  deposito      numeric(14,2) default 0,
  abono_puntual   numeric(14,2) default 0,
  abono_impuntual numeric(14,2) default 0,
  base_deuda    numeric(14,2) default 0,
  interes_pct   text,
  adeudo_actual numeric(14,2) default 0,       -- renovación
  tipo_cliente  text,                          -- NUEVO / RENOVACION
  -- ubicación / evaluación
  colonia       text,
  municipio     text,
  score_eval    int,
  cotizacion_json jsonb,
  notas         text,
  enviado_cartera boolean default false,
  fecha_creacion timestamptz default now(),
  created_at    timestamptz default now()
);
create index idx_prosp_status on prospectos(status);
create index idx_prosp_ejec on prospectos(ejecutivo);

-- RLS: todos los autenticados leen/crean; ejecutivos ven todo (mercado de ventas) pero
-- el front filtra "mi tubería". Borrar/cancelar lo controla la app.
alter table prospectos enable row level security;
create policy prosp_sel on prospectos for select to authenticated using (true);
create policy prosp_ins on prospectos for insert to authenticated with check (true);
create policy prosp_upd on prospectos for update to authenticated using (true) with check (true);
create policy prosp_del on prospectos for delete to authenticated using (auth_rol() in ('ADMIN','GERENTE'));

-- FIN fase4_tuberia.sql

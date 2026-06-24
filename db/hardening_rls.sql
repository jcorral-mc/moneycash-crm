-- ════════════════════════════════════════════════════════════════
-- HARDENING RLS · MoneyCash CRM v2 (corrige B5 del reporte Fase 1.5)
-- Restringe las ESCRITURAS sensibles por rol a nivel de BASE DE DATOS,
-- no solo en la interfaz. Correr DESPUÉS de schema_fase1.sql.
--
-- Qué NO se toca (para no romper al ejecutivo):
--   · pagos_pendientes INSERT  → sigue abierto (el ejecutivo registra el cobro)
--   · comentarios_cobranza INSERT → sigue abierto (el ejecutivo comenta)
--   · Lecturas → ya están protegidas (ejecutivo solo ve su cartera)
-- Qué SÍ se cierra (solo Admin/Gerente/Aux, o Admin/Aux para alta):
--   · cartera (alta + cambio de saldo)
--   · calendarios (alta + aplicación de pago)
--   · desglose (registro de cobro al conciliar)
--   · bancos (ingresos/saldo al conciliar)
--   · pagos_pendientes UPDATE (conciliar: aprobar/rechazar)
--   · autorizaciones UPDATE (aprobar multa/liquidación)
-- ════════════════════════════════════════════════════════════════

-- ── CARTERA: alta = Admin/Aux ; cambio de saldo = Admin/Gerente/Aux ──
drop policy if exists cart_ins on cartera;
drop policy if exists cart_upd on cartera;
create policy cart_ins on cartera for insert to authenticated
  with check (auth_rol() in ('ADMIN','AUX_ADMIN'));
create policy cart_upd on cartera for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN')) with check (true);

-- ── CALENDARIOS: alta y conciliación = Admin/Gerente/Aux ──
drop policy if exists cal_ins on calendarios;
drop policy if exists cal_upd on calendarios;
create policy cal_ins on calendarios for insert to authenticated
  with check (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));
create policy cal_upd on calendarios for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN')) with check (true);

-- ── PAGOS_PENDIENTES: registrar lo hace cualquiera; conciliar (update) = Admin/Gerente/Aux ──
drop policy if exists pagos_pendientes_upd on pagos_pendientes;
create policy pagos_pendientes_upd on pagos_pendientes for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN')) with check (true);

-- ── DESGLOSE: registro de cobro (al conciliar) = Admin/Gerente/Aux ──
drop policy if exists desglose_ins on desglose;
create policy desglose_ins on desglose for insert to authenticated
  with check (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));

-- ── BANCOS: mover ingresos/saldo = Admin/Gerente/Aux ──
drop policy if exists bancos_upd on bancos;
create policy bancos_upd on bancos for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN')) with check (true);

-- ── AUTORIZACIONES: aprobar/rechazar = Admin/Gerente ──
drop policy if exists autorizaciones_upd on autorizaciones;
create policy autorizaciones_upd on autorizaciones for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE')) with check (true);

-- ── MOVIMIENTOS: registrar movimientos de banco = Admin/Gerente/Aux ──
drop policy if exists movimientos_ins on movimientos;
create policy movimientos_ins on movimientos for insert to authenticated
  with check (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));

-- FIN hardening_rls.sql

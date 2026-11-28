-- =============================================================================
-- erp-node · Registros que sube el POS
--   POST /api.php/integrospos/logs/registrarErrorEndpoint → llx_pos_logs_errores
--   POST /api.php/integrospos/pos/auditoria               → llx_pos_auditoria
-- Ejecutar con un usuario ADMINISTRADOR de MySQL, en la base de CADA cliente,
-- ANTES de enrutar estos endpoints a erp-node. Revisado: 2026-11-28.
-- =============================================================================

-- 0) Verificar que las tablas existen y tienen las columnas que usa erp-node.
--    En el repositorio hay dos definiciones distintas de llx_pos_logs_errores:
--    erp-node usa la del módulo integrospos (id, created_at, updated_at), que es
--    la única con la que funciona el modelo de apipos. Si SHOW CREATE TABLE
--    muestra rowid/date_creation, NO aplicar y avisar.
SHOW CREATE TABLE `llx_pos_logs_errores`;
SHOW CREATE TABLE `llx_pos_auditoria`;

-- 1) Permisos MÍNIMOS: solo INSERT (erp-node ya tiene SELECT en toda la base).
--    Ajustar la base y el host si erp-node se conecta desde otra IP.
GRANT INSERT ON `mercaboy_erp_24`.`llx_pos_logs_errores` TO 'erp_node'@'192.168.254.212';
GRANT INSERT ON `mercaboy_erp_24`.`llx_pos_auditoria`    TO 'erp_node'@'192.168.254.212';

-- Verificación:
SHOW GRANTS FOR 'erp_node'@'192.168.254.212';

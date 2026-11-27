-- =============================================================================
-- erp-node · Login del POS (POST /custom/integrospos/login.php, refresh, logout, me)
-- Ejecutar con un usuario ADMINISTRADOR de MySQL, en la base de CADA cliente.
-- Revisado: 2026-11-27. Es idempotente (se puede ejecutar más de una vez).
-- =============================================================================

-- 1) Tabla de tokens del POS.
--    Misma estructura que crea apipos (Laravel Sanctum + refresh/device), para que
--    un token emitido por apipos o por erp-node funcione en ambos mientras conviven.
--    En mercaboy_erp_24 NO existe todavía.
CREATE TABLE IF NOT EXISTS `llx_personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `refresh_token` varchar(64) DEFAULT NULL,
  `abilities` text,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `refresh_expires_at` timestamp NULL DEFAULT NULL,
  `device_id` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `llx_personal_access_tokens_token_unique` (`token`),
  UNIQUE KEY `llx_personal_access_tokens_refresh_token_unique` (`refresh_token`),
  KEY `llx_personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`, `tokenable_id`),
  KEY `llx_personal_access_tokens_expires_at_index` (`expires_at`),
  KEY `llx_personal_access_tokens_device_id_index` (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Índices para que las búsquedas del login no recorran tablas completas
--    (MySQL 8.4 no tiene CREATE INDEX IF NOT EXISTS: si ya existen, ignorar el error 1061).
CREATE INDEX `idx_integros_user_token_usuario` ON `llx_integros_user_token` (`fk_user`, `revoked`, `expires_at`);
CREATE INDEX `idx_pos_login_logout_usuario` ON `llx_pos_login_logout` (`fk_user`, `date_logout`);

-- 3) Permisos MÍNIMOS para erp-node (hoy solo tiene SELECT en toda la base).
--    Ajustar el host si erp-node se conecta desde otra IP.
GRANT INSERT, UPDATE, DELETE ON `mercaboy_erp_24`.`llx_personal_access_tokens` TO 'erp_node'@'192.168.254.212';
GRANT INSERT, UPDATE         ON `mercaboy_erp_24`.`llx_integros_user_token`    TO 'erp_node'@'192.168.254.212';
GRANT INSERT, UPDATE         ON `mercaboy_erp_24`.`llx_pos_login_logout`       TO 'erp_node'@'192.168.254.212';

-- Verificación (debe listar SELECT en la base + los tres GRANT de arriba):
SHOW GRANTS FOR 'erp_node'@'192.168.254.212';

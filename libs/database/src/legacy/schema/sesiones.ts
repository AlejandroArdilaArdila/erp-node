import { bigint, datetime, int, text, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/**
 * llx_personal_access_tokens: tokens del POS. Misma estructura que la tabla
 * de Laravel Sanctum de apipos (+ refresh y device), para que un token emitido
 * por apipos o por erp-node sirva en ambos mientras conviven.
 * Script de creación: sql/2026-11-27_login-pos.sql
 */
export const tokensAcceso = tablaLegado('personal_access_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  tokenableType: varchar('tokenable_type', { length: 255 }).notNull(),
  tokenableId: bigint('tokenable_id', { mode: 'number', unsigned: true }).notNull(),
  name: text('name').notNull(),
  token: varchar('token', { length: 64 }).notNull(),
  refreshToken: varchar('refresh_token', { length: 64 }),
  abilities: text('abilities'),
  lastUsedAt: timestamp('last_used_at', { mode: 'string' }),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  refreshExpiresAt: timestamp('refresh_expires_at', { mode: 'string' }),
  deviceId: varchar('device_id', { length: 64 }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

/** llx_integros_user_token: candado de "un solo dispositivo activo" por usuario. */
export const sesionesDispositivo = tablaLegado('integros_user_token', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  fkUser: bigint('fk_user', { mode: 'number' }).notNull(),
  deviceId: varchar('device_id', { length: 128 }).notNull(),
  tokenHash: varchar('token_hash', { length: 128 }).notNull(),
  refreshHash: varchar('refresh_hash', { length: 128 }).notNull(),
  expiresAt: datetime('expires_at', { mode: 'string' }).notNull(),
  lastSeenAt: datetime('last_seen_at', { mode: 'string' }).notNull(),
  cierreSesion: datetime('cierre_sesion', { mode: 'string' }),
  revoked: tinyint('revoked').notNull(),
  ip: varchar('ip', { length: 45 }),
  versionPos: varchar('version_pos', { length: 50 }),
  servidorLocal: varchar('servidor_local', { length: 255 }),
});

/** llx_pos_login_logout: bitácora de entradas y salidas del POS. */
export const registroLoginPos = tablaLegado('pos_login_logout', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkUser: int('fk_user').notNull(),
  dateLogin: datetime('date_login', { mode: 'string' }),
  dateLogout: datetime('date_logout', { mode: 'string' }),
});

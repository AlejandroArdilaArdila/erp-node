/**
 * @erp/database: conexiones, esquemas y transacciones.
 * Los módulos de dominio acceden a datos SOLO a través de sus repositorios,
 * que usan lo que exporta esta librería.
 */
export * from './database.module.js';
export * from './legacy/bloqueos.js';
export * from './legacy/consultas-pdo.js';
export * from './legacy/legacy-db.js';
export * from './legacy/schema/index.js';
export * from './legacy/schema/tabla-legado.js';
export * from './salud-base-datos.js';
export * from './transactions/transacciones-legado.service.js';
export * from './transactions/transaccion.js';

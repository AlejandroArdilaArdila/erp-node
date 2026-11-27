/**
 * @erp/domain: un subdirectorio por dominio de negocio (auth, pos, ventas,
 * inventario, facturacion, contabilidad...). Importar siempre por dominio:
 *
 *   import { AuthModule } from '@erp/domain/auth';
 *
 * Este archivo existe solo porque el CLI de Nest lo exige como entrada de la
 * librería; no reexportar dominios aquí.
 */
export {};

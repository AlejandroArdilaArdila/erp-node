/**
 * @erp/dolibarr: compatibilidad con Dolibarr mientras conviva con erp-node.
 * Todo lo que imita un comportamiento de Dolibarr/apipos vive aquí y tiene
 * tests con vectores generados por el PHP real. Se elimina en la fase 6.
 */
export * from './crypt/dolibarr-crypt.js';
export * from './password/verificar-password.js';

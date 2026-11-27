import { int, tinyint, varchar } from 'drizzle-orm/mysql-core';
import { tablaLegado } from './tabla-legado.js';

/** llx_societe: terceros (clientes y proveedores). */
export const terceros = tablaLegado('societe', {
  rowid: int('rowid').primaryKey().autoincrement(),
  nom: varchar('nom', { length: 128 }),
  tvaIntra: varchar('tva_intra', { length: 20 }),
  phone: varchar('phone', { length: 20 }),
  fournisseur: tinyint('fournisseur'),
});

/** llx_societe_commerciaux: vendedores (usuarios) asignados a un tercero. */
export const tercerosComerciales = tablaLegado('societe_commerciaux', {
  rowid: int('rowid').primaryKey().autoincrement(),
  fkSoc: int('fk_soc'),
  fkUser: int('fk_user'),
});

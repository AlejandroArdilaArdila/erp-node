import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { AlmacenesRepositorio } from './almacenes.repositorio.js';

/** Cliente mysql2 falso: no se conecta a nada, solo guarda el SQL y responde las filas dadas. */
function crear(filas: unknown[][] = []) {
  const consultas: Array<{ sql: string; params: unknown }> = [];
  const responder = async (q: { sql: string } | string, params: unknown) => {
    consultas.push({ sql: typeof q === 'string' ? q : q.sql, params });
    return [filas, []];
  };
  const db = drizzle({
    client: { query: responder, execute: responder } as never,
    schema,
    mode: 'default',
  }) as unknown as LegacyDb;
  return { repo: new AlmacenesRepositorio(db), consultas };
}

describe('AlmacenesRepositorio.abiertos', () => {
  it('almacenes con statut 1, por ref; fk_parent NULL → 0', async () => {
    const { repo, consultas } = crear([
      [1, 'Sucursal', null],
      [6, 'Almacen', 1],
    ]);

    await expect(repo.abiertos()).resolves.toEqual([
      { id: 1, nombre: 'Sucursal', idPadre: 0 },
      { id: 6, nombre: 'Almacen', idPadre: 1 },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toContain('from `llx_entrepot`');
    expect(sql).toContain('where `llx_entrepot`.`statut` = ?');
    expect(sql).toContain('order by `llx_entrepot`.`ref`');
    expect(params).toEqual([1]);
  });
});

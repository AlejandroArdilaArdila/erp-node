import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { CodigosOperativosRepositorio } from './codigos-operativos.repositorio.js';

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
  return { repo: new CodigosOperativosRepositorio(db), consultas };
}

describe('CodigosOperativosRepositorio.activos', () => {
  it('LEFT JOIN con llx_product, filtro por entidad y activos, rowid descendente', async () => {
    const { repo, consultas } = crear([
      [3, 'DESC10', 50, 1, '2026-08-01 09:15:00', 'SRV-DESC', 'Descuento 10%', 1],
      [2, 'HUERFANO', 99, null, '2026-07-01 08:00:00', null, null, null],
    ]);

    await expect(repo.activos(1)).resolves.toEqual([
      {
        id: 3,
        codigo: 'DESC10',
        idProducto: 50,
        descuento: 1,
        refProducto: 'SRV-DESC',
        nombreProducto: 'Descuento 10%',
        tipoProducto: 1,
        fechaCreacion: '2026-08-01 09:15:00',
      },
      {
        id: 2,
        codigo: 'HUERFANO',
        idProducto: 99,
        descuento: null,
        refProducto: null,
        nombreProducto: null,
        tipoProducto: null,
        fechaCreacion: '2026-07-01 08:00:00',
      },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toContain(
      'from `llx_product_codoperativos` left join `llx_product` on `llx_product`.`rowid` = `llx_product_codoperativos`.`fk_product`',
    );
    expect(sql).toContain(
      'where (`llx_product_codoperativos`.`entity` = ? and `llx_product_codoperativos`.`active` = ?)',
    );
    expect(sql).toContain('order by `llx_product_codoperativos`.`rowid` desc');
    expect(params).toEqual([1, 1]);
  });
});

import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { CategoriasRepositorio } from './categorias.repositorio.js';

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
  return { repo: new CategoriasRepositorio(db), consultas };
}

describe('CategoriasRepositorio.deProductoConTotales', () => {
  it('cuenta productos con una subconsulta de columnas calificadas', async () => {
    const { repo, consultas } = crear();

    await repo.deProductoConTotales(1);

    expect(consultas).toHaveLength(1);
    const { sql, params } = consultas[0];
    // Sin calificar, `rowid` se resolvería contra llx_categorie_product si tuviera esa columna.
    expect(sql).toContain(
      '(select count(*) from `llx_categorie_product` where `llx_categorie_product`.`fk_categorie` = `llx_categorie`.`rowid`)',
    );
    expect(sql).toContain('where (`llx_categorie`.`type` = ? and `llx_categorie`.`entity` = ?)');
    expect(sql).toContain('order by `llx_categorie`.`label`');
    expect(params).toEqual([0, 1]);
  });

  it('convierte las filas en categorías (COUNT llega como número o texto)', async () => {
    const { repo } = crear([
      [12, 'Bebidas', 'Gaseosas', '3399CC', 0, 45],
      [13, 'Jugos', null, null, 12, '3'],
    ]);

    await expect(repo.deProductoConTotales(1)).resolves.toEqual([
      {
        id: 12,
        nombre: 'Bebidas',
        descripcion: 'Gaseosas',
        color: '3399CC',
        idPadre: 0,
        totalProductos: 45,
      },
      { id: 13, nombre: 'Jugos', descripcion: null, color: null, idPadre: 12, totalProductos: 3 },
    ]);
  });
});

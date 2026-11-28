import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { TercerosService } from './terceros.module.js';
import { TercerosRepositorio } from './terceros.repositorio.js';

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
  return { servicio: new TercerosService(new TercerosRepositorio(db)), consultas };
}

describe('TercerosService.proveedores (réplica de ClientesService::proveedores)', () => {
  it('sin búsqueda: proveedores activos por nombre, límite 100', async () => {
    const { servicio, consultas } = crear([[3, 'Distribuidora', '900123', '6041234']]);

    await expect(servicio.proveedores({})).resolves.toEqual([
      { id: 3, nombre: 'Distribuidora', rif: '900123', telefono: '6041234' },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toContain('from `llx_societe`');
    expect(sql).toContain('where (`llx_societe`.`fournisseur` = ? and `llx_societe`.`status` = ?)');
    expect(sql).toContain('order by `llx_societe`.`nom` limit ?');
    expect(params).toEqual([1, 1, 100]);
  });

  it('con búsqueda: LIKE en nombre o NIT, sin escapar comodines', async () => {
    const { servicio, consultas } = crear();

    await servicio.proveedores({ search: '  50%_a ', limit: '20' });

    const { sql, params } = consultas[0];
    expect(sql).toContain('(`llx_societe`.`nom` like ? or `llx_societe`.`tva_intra` like ?)');
    expect(params).toEqual([1, 1, '%50%_a%', '%50%_a%', 20]);
  });

  it.each([
    [0, 100],
    [-5, 100],
    ['abc', 100],
    ['7xyz', 7],
    [3.9, 3],
  ])('limit %j → %s ((int) de PHP; <= 0 usa 100)', async (limit, esperado) => {
    const { servicio, consultas } = crear();
    await servicio.proveedores({ limit });
    expect((consultas[0].params as unknown[]).at(-1)).toBe(esperado);
  });

  it('búsqueda de solo espacios cuenta como vacía', async () => {
    const { servicio, consultas } = crear();
    await servicio.proveedores({ search: '   ' });
    expect(consultas[0].sql).not.toContain('like');
  });
});

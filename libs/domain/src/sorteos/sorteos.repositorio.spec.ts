import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { SorteosRepositorio } from './sorteos.repositorio.js';

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
  return { repo: new SorteosRepositorio(db), consultas };
}

const FILA = [
  4,
  'Sorteo',
  'TV',
  '2026-11-01',
  '2026-12-24',
  50000,
  1,
  'todos',
  'fijo',
  null,
  0,
  '[1]',
  null,
];

describe('SorteosRepositorio', () => {
  it('vigentes: activos con CURDATE() entre las fechas, por fecha final', async () => {
    const { repo, consultas } = crear([FILA]);

    await expect(repo.vigentes()).resolves.toEqual([
      {
        id: 4,
        descripcion: 'Sorteo',
        premio: 'TV',
        fechaInicio: '2026-11-01',
        fechaFinal: '2026-12-24',
        compraMinimo: 50000,
        valorParticipacion: 1,
        tipoCliente: 'todos',
        tipoCalculo: 'fijo',
        observacion: null,
        permitirEntregarSinCtrl: 0,
        clientesJson: '[1]',
        productosJson: null,
      },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toContain('from `llx_pos_sorteo`');
    expect(sql).toContain(
      'where (`llx_pos_sorteo`.`estado` = ? and `llx_pos_sorteo`.`fecha_inicio` <= CURDATE() and `llx_pos_sorteo`.`fecha_final` >= CURDATE())',
    );
    expect(sql).toContain('order by `llx_pos_sorteo`.`fecha_final`');
    expect(params).toEqual([1]);
  });

  it('próximos: activos que empiezan después de CURDATE(), por fecha de inicio', async () => {
    const { repo, consultas } = crear();

    await repo.proximos();

    const { sql } = consultas[0];
    expect(sql).toContain('`llx_pos_sorteo`.`fecha_inicio` > CURDATE()');
    expect(sql).toContain('order by `llx_pos_sorteo`.`fecha_inicio`');
  });
});

import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { DashboardsRepositorio } from './dashboards.repositorio.js';

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
  return { repo: new DashboardsRepositorio(db), consultas };
}

describe('DashboardsRepositorio', () => {
  it('visibles: propios o públicos, por tms descendente, con conteo calificado de widgets', async () => {
    const { repo, consultas } = crear([
      [3, 'Ventas', null, null, null, 0, 5, '2026-10-01 08:00:00', null, null, '4'],
    ]);

    await expect(repo.visiblesPara(5)).resolves.toMatchObject([{ id: 3, totalWidgets: 4 }]);

    const { sql, params } = consultas[0];
    expect(sql).toContain(
      '(select count(*) from `llx_informes_dashboard_widget` where `llx_informes_dashboard_widget`.`fk_dashboard` = `llx_informes_dashboard`.`rowid`)',
    );
    expect(sql).toContain(
      'where (`llx_informes_dashboard`.`fk_user_creat` = ? or `llx_informes_dashboard`.`es_publico` = ?)',
    );
    expect(sql).toContain('order by `llx_informes_dashboard`.`tms` desc');
    expect(params).toEqual([5, 1]);
  });

  it('widgets por tab con GROUP BY en MySQL', async () => {
    const { repo, consultas } = crear([
      ['Ventas', 5],
      ['Clientes', 2],
    ]);

    await expect(repo.widgetsPorTab(3)).resolves.toEqual(
      new Map([
        ['Ventas', 5],
        ['Clientes', 2],
      ]),
    );
    expect(consultas[0].sql).toContain('group by `llx_informes_dashboard_widget`.`tab_nombre`');
  });
});

import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { TirillasRepositorio } from './tirillas.repositorio.js';

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
  return { repo: new TirillasRepositorio(db), consultas };
}

describe('TirillasRepositorio', () => {
  it('plantillas: las columnas JSON se leen como texto (CAST AS CHAR), por rowid', async () => {
    const { repo, consultas } = crear([
      [1, 'factura_pos', 'Factura POS', '{"a":1}', 1, '{"b": 2}', 80, '["x"]'],
    ]);

    await expect(repo.plantillas()).resolves.toEqual([
      {
        id: 1,
        nombre: 'factura_pos',
        label: 'Factura POS',
        configJson: '{"a":1}',
        activo: 1,
        datoPreviewJson: '{"b": 2}',
        columnas: 80,
        variablesJson: '["x"]',
      },
    ]);

    const { sql } = consultas[0];
    expect(sql).toContain('cast(`dato_preview` as char)');
    expect(sql).toContain('cast(`variables` as char)');
    expect(sql).toContain('order by `llx_integrospos_ticket_template`.`rowid` asc');
  });

  it('por id y por nombre: una sola fila', async () => {
    const { repo, consultas } = crear();

    await expect(repo.plantillaPorId(5)).resolves.toBeNull();
    await expect(repo.plantillaPorNombre('cierre')).resolves.toBeNull();

    expect(consultas[0].sql).toContain('where `llx_integrospos_ticket_template`.`rowid` = ?');
    expect(consultas[0].params).toEqual([5, 1]);
    expect(consultas[1].sql).toContain('where `llx_integrospos_ticket_template`.`nombre` = ?');
    expect(consultas[1].params).toEqual(['cierre', 1]);
  });

  it('secciones: elementos como texto', async () => {
    const { repo, consultas } = crear([[1, 'enc', 'Encabezado', '[]']]);
    await expect(repo.secciones()).resolves.toEqual([
      { id: 1, nombre: 'enc', descripcion: 'Encabezado', elementosJson: '[]' },
    ]);
    expect(consultas[0].sql).toContain('cast(`elementos` as char)');
  });

  it('variables por rowid', async () => {
    const { repo, consultas } = crear([[1, 'total', 'Total', 'numero']]);
    await expect(repo.variables()).resolves.toEqual([
      { id: 1, nombre: 'total', descripcion: 'Total', tipo: 'numero' },
    ]);
    expect(consultas[0].sql).toContain('order by `llx_integrospos_ticket_variables`.`rowid` asc');
  });
});

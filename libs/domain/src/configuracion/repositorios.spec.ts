import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { CiudadesRepositorio } from './ciudades.repositorio.js';
import { ConstantesRepositorio } from './constantes.repositorio.js';

/** Cliente mysql2 falso: no se conecta a nada, solo guarda el SQL y responde las filas dadas. */
function crearDb(filas: unknown[][] = []) {
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
  return { db, consultas };
}

describe('ConstantesRepositorio.porNombres', () => {
  it('filtra por nombre y entidad, ordenado por entidad y rowid', async () => {
    const { db, consultas } = crearDb([['A', 0, 'x']]);

    await expect(new ConstantesRepositorio(db).porNombres(['A', 'B'], [0, 1])).resolves.toEqual([
      { nombre: 'A', entidad: 0, valor: 'x' },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toContain('from `llx_const`');
    expect(sql).toContain('`llx_const`.`name` in (?, ?)');
    expect(sql).toContain('`llx_const`.`entity` in (?, ?)');
    expect(sql).toContain('order by `llx_const`.`entity` asc, `llx_const`.`rowid` asc');
    expect(params).toEqual(['A', 'B', 0, 1]);
  });

  it('sin nombres → [] sin consultar', async () => {
    const { db, consultas } = crearDb();
    await expect(new ConstantesRepositorio(db).porNombres([], [0, 1])).resolves.toEqual([]);
    expect(consultas).toHaveLength(0);
  });
});

describe('CiudadesRepositorio', () => {
  it('departamentos: DISTINCT de ciudades activas, por nombre', async () => {
    const { db, consultas } = crearDb([['05', 'Antioquia']]);

    await expect(new CiudadesRepositorio(db).departamentosActivos()).resolves.toEqual([
      { codigo: '05', nombre: 'Antioquia' },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toMatch(/^select distinct /);
    expect(sql).toContain('from `llx_c_ciudades_fe`');
    expect(sql).toContain('where `llx_c_ciudades_fe`.`active` = ?');
    expect(sql).toContain('order by `llx_c_ciudades_fe`.`depto`');
    expect(params).toEqual([1]);
  });

  it('ciudades activas, por nombre', async () => {
    const { db, consultas } = crearDb([[80, '05', '05001', 'Medellin', '050013']]);

    await expect(new CiudadesRepositorio(db).ciudadesActivas()).resolves.toEqual([
      {
        id: 80,
        codigoDepartamento: '05',
        codigo: '05001',
        nombre: 'Medellin',
        codigoPostal: '050013',
      },
    ]);

    expect(consultas[0].sql).toContain('order by `llx_c_ciudades_fe`.`ciudad`');
  });
});

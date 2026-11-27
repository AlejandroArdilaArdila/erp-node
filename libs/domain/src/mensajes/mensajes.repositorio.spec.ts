import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { drizzle } from 'drizzle-orm/mysql2';
import { MensajesRepositorio } from './mensajes.repositorio.js';

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
  return { repo: new MensajesRepositorio(db), consultas };
}

describe('MensajesRepositorio.deUsuario', () => {
  it('sin fecha → emisor, receptor o difusión, ordenados por fecha', async () => {
    const { repo, consultas } = crear();

    await repo.deUsuario(5, null);

    const { sql, params } = consultas[0];
    expect(sql).toContain('from `llx_chat_vendedor`');
    expect(sql).toContain(
      'where (`llx_chat_vendedor`.`fk_user_from` = ? or `llx_chat_vendedor`.`fk_user_to` = ? or `llx_chat_vendedor`.`fk_user_to` = ?)',
    );
    expect(sql).not.toContain('date(');
    expect(sql).toContain('order by `llx_chat_vendedor`.`fecha`');
    expect(params).toEqual([5, 5, 0]);
  });

  it('con fecha → DATE(fecha) = ? (como whereDate de Laravel)', async () => {
    const { repo, consultas } = crear();

    await repo.deUsuario(5, '2026-07-16');

    const { sql, params } = consultas[0];
    expect(sql).toContain('and date(`llx_chat_vendedor`.`fecha`) = ?');
    expect(params).toEqual([5, 5, 0, '2026-07-16']);
  });

  it('convierte las filas en mensajes (leido tinyint → boolean)', async () => {
    const { repo } = crear([
      [10, 5, 8, 'Hola', 'mensaje', '2026-07-16 10:23:45', 0],
      [11, 8, 0, 'Para todos', 'mensaje', '2026-07-16 11:00:00', 1],
    ]);

    await expect(repo.deUsuario(5, null)).resolves.toEqual([
      {
        id: 10,
        idEmisor: 5,
        idReceptor: 8,
        mensaje: 'Hola',
        tipo: 'mensaje',
        fecha: '2026-07-16 10:23:45',
        leido: false,
      },
      {
        id: 11,
        idEmisor: 8,
        idReceptor: 0,
        mensaje: 'Para todos',
        tipo: 'mensaje',
        fecha: '2026-07-16 11:00:00',
        leido: true,
      },
    ]);
  });
});

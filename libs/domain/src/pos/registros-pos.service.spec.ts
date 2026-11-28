import { HttpException } from '@nestjs/common';
import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import { entradaLaravel, type Reloj } from '@erp/shared';
import { drizzle } from 'drizzle-orm/mysql2';
import { RegistrosPosRepositorio } from './registros-pos.repositorio.js';
import { RegistrosPosService } from './registros-pos.service.js';

/** Base falsa: captura los INSERT sin conectarse a nada. */
function crear(ahora = new Date('2026-11-29T01:30:00Z')) {
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const responder = async (q: { sql: string } | string, params: unknown[]) => {
    consultas.push({ sql: typeof q === 'string' ? q : q.sql, params });
    return [{ affectedRows: 1, insertId: 1 }, []];
  };
  const db = drizzle({
    client: { query: responder, execute: responder } as never,
    schema,
    mode: 'default',
  }) as unknown as LegacyDb;
  const reloj: Reloj = { ahora: () => ahora };
  return { servicio: new RegistrosPosService(new RegistrosPosRepositorio(db), reloj), consultas };
}

async function rechazo401(promesa: Promise<unknown>, mensaje: string): Promise<void> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(401);
  expect((error as HttpException).getResponse()).toEqual({ message: mensaje });
}

const ERROR_VALIDO = {
  deviceid: 'CAJA01_192.168.1.50',
  fk_user: '7',
  metodo: 'post',
  url: '/api/api.php/integrospos/pos/ticket/payment',
  status_code: 500,
  tiempo_ms: 1234.9,
  request_body: '{"a":1}',
  response_body: null,
  fecha: '2026-11-28T20:15:30.123-05:00',
};

describe('RegistrosPosService.registrarErrorEndpoint', () => {
  it('inserta con los valores como apipos (created_at en UTC)', async () => {
    const { servicio, consultas } = crear();

    await servicio.registrarErrorEndpoint(entradaLaravel({}, ERROR_VALIDO));

    expect(consultas).toHaveLength(1);
    const { sql, params } = consultas[0];
    expect(sql).toContain('insert into `llx_pos_logs_errores`');
    expect(sql).toContain(
      '(`id`, `deviceid`, `fk_user`, `metodo`, `url`, `status_code`, `tiempo_ms`, `request_body`, `response_body`, `fecha_cliente`, `created_at`, `updated_at`)',
    );
    expect(params).toEqual([
      'CAJA01_192.168.1.50',
      7,
      'POST',
      '/api/api.php/integrospos/pos/ticket/payment',
      500,
      1234,
      '{"a":1}',
      null,
      // la hora escrita, sin convertir la zona (Carbon::parse + Eloquent)
      '2026-11-28 20:15:30',
      // 8:30 p. m. en Bogotá = 01:30 UTC del día siguiente
      '2026-11-29 01:30:00',
      '2026-11-29 01:30:00',
    ]);
  });

  it('campos opcionales vacíos → null (ConvertEmptyStringsToNull y filled)', async () => {
    const { servicio, consultas } = crear();
    await servicio.registrarErrorEndpoint(
      entradaLaravel({}, { ...ERROR_VALIDO, deviceid: '  ', fk_user: '', tiempo_ms: null }),
    );
    expect(consultas[0].params.slice(0, 2)).toEqual([null, null]);
    expect(consultas[0].params[5]).toBeNull();
  });

  it.each([
    [{ metodo: '' }, "El campo 'metodo' es obligatorio."],
    [{ metodo: '   ' }, "El campo 'metodo' es obligatorio."],
    [{ url: undefined }, "El campo 'url' es obligatorio."],
    [{ status_code: 399 }, "El campo 'status_code' es obligatorio y debe ser >= 400."],
    [{ status_code: 'abc' }, "El campo 'status_code' es obligatorio y debe ser >= 400."],
    [{ status_code: null }, "El campo 'status_code' es obligatorio y debe ser >= 400."],
    [{ fecha: '' }, "El campo 'fecha' es obligatorio."],
    [{ fecha: '0' }, "El campo 'fecha' es obligatorio."],
    [{ fecha: 'basura' }, "El campo 'fecha' no es una fecha valida."],
    [{ fecha: '2026-13-01' }, "El campo 'fecha' no es una fecha valida."],
  ])('%j → 401 %s', async (cambio, mensaje) => {
    const { servicio, consultas } = crear();
    await rechazo401(
      servicio.registrarErrorEndpoint(entradaLaravel({}, { ...ERROR_VALIDO, ...cambio })),
      mensaje,
    );
    expect(consultas).toHaveLength(0);
  });

  it('status_code numérico en texto ("404.9") → 404', async () => {
    const { servicio, consultas } = crear();
    await servicio.registrarErrorEndpoint(
      entradaLaravel({}, { ...ERROR_VALIDO, status_code: '404.9' }),
    );
    expect(consultas[0].params[4]).toBe(404);
  });

  it('request_body como objeto JSON → error (PDO no enlaza arrays: 500 en apipos)', async () => {
    const { servicio, consultas } = crear();
    await expect(
      servicio.registrarErrorEndpoint(
        entradaLaravel({}, { ...ERROR_VALIDO, request_body: { a: 1 } }),
      ),
    ).rejects.toThrow();
    expect(consultas).toHaveLength(0);
  });
});

const AUDITORIA_VALIDA = {
  id: 55,
  modulo: 'ventas',
  accion: 'anular',
  usuario_id: 7,
  usuario_nombre: 'Ana',
  entidad_tipo: 'cotizacion',
  entidad_id: 'COT-001',
  tipo_documento: 'COT',
  datos_antes_json: '{"estado":1}',
  datos_despues_json: '{"estado":0}',
  descripcion: '  Anulada por error  ',
  fk_caja_local: 3,
  total: 1234567.891234567,
  subtotal: '1000.50',
  iva: 0.1 + 0.2,
  items: '4',
  fecha: '2026-11-28 10:15:30.1234567',
};

describe('RegistrosPosService.registrarAuditoria', () => {
  it('inserta y responde { ok: true, id: <id local> }', async () => {
    const { servicio, consultas } = crear();

    await expect(
      servicio.registrarAuditoria(entradaLaravel({}, AUDITORIA_VALIDA)),
    ).resolves.toEqual({ ok: true, id: 55 });

    const { sql, params } = consultas[0];
    expect(sql).toContain('insert into `llx_pos_auditoria`');
    expect(params).toEqual([
      55,
      '2026-11-28 10:15:30.123456',
      'ventas',
      'anular',
      7,
      'Ana',
      'cotizacion',
      'COT-001',
      'COT',
      '{"estado":1}',
      '{"estado":0}',
      'Anulada por error',
      3,
      // decimales como (string) $float de PHP (lo que guardaba PDO)
      '1234567.8912346',
      '1000.50',
      '0.3',
      4,
    ]);
  });

  it('sin id → id null en la respuesta', async () => {
    const { servicio } = crear();
    await expect(
      servicio.registrarAuditoria(entradaLaravel({}, { ...AUDITORIA_VALIDA, id: '' })),
    ).resolves.toEqual({ ok: true, id: null });
  });

  it.each([
    [{ modulo: '' }, "El campo 'modulo' es obligatorio."],
    [{ accion: null }, "El campo 'accion' es obligatorio."],
    [{ entidad_tipo: '  ' }, "El campo 'entidad_tipo' es obligatorio."],
    [{ fecha: undefined }, "El campo 'fecha' es obligatorio."],
    [{ fecha: '28/11/2026' }, "El campo 'fecha' no es una fecha valida."],
  ])('%j → 401 %s', async (cambio, mensaje) => {
    const { servicio, consultas } = crear();
    await rechazo401(
      servicio.registrarAuditoria(entradaLaravel({}, { ...AUDITORIA_VALIDA, ...cambio })),
      mensaje,
    );
    expect(consultas).toHaveLength(0);
  });
});

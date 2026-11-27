import { createHash } from 'node:crypto';
import type { BloqueosLegado, TransaccionesLegado } from '@erp/database';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { CajaService, EstadoCaja, TerminalPos } from '@erp/domain/pos';
import type { TercerosService } from '@erp/domain/terceros';
import type { AppConfig } from '@erp/shared';
import type { ApiKeyService } from './api-key.service.js';
import { SesionPosService } from './sesion-pos.service.js';
import type { SesionesDispositivoRepositorio } from './sesiones-dispositivo.repositorio.js';
import type { TokensRepositorio } from './tokens.repositorio.js';
import type { UsuarioParaLogin, UsuariosRepositorio } from './usuarios.repositorio.js';

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');
const CLAVE_INSTANCIA = 'clave-instancia';
/** bcrypt de 'Secreta#2026' generado con PHP password_hash(). */
const BCRYPT = '$2y$10$UeT1cuPSfn23EyQYdUZYweCFhiLtskz02j4m7DaLtmCh89erDWizK';
const AHORA = new Date(2026, 10, 27, 15, 0, 0); // 27-nov-2026 15:00 local

const USUARIO: UsuarioParaLogin = {
  id: 7,
  login: 'cajero1',
  nombre: 'Ana Pérez',
  admin: false,
  entity: 1,
  statut: 1,
  credenciales: { passCrypted: BCRYPT, passPlano: null },
  apiKeyGuardada: cifrarApiKeyDolibarr('APIKEY-PLANA', CLAVE_INSTANCIA),
};

interface FilaToken {
  id: number;
  idUsuario: number;
  nombre: string;
  hash: string;
  hashRefresh: string;
  expiresAt: string;
  refreshExpiresAt: string;
  lastUsedAt?: string;
}
interface FilaSesion {
  id: number;
  idUsuario: number;
  deviceId: string;
  revoked: number;
  expiresAt: string;
  ip: string | null;
  versionPos: string | null;
  servidorLocal: string | null;
  tokenHash: string;
  cierreSesion?: string;
  lastSeenAt?: string;
}

/** Simula las tablas en memoria. */
function crearMundo(
  opciones: {
    usuario?: UsuarioParaLogin | null;
    terminal?: TerminalPos | null;
    caja?: EstadoCaja;
  } = {},
) {
  const usuario = opciones.usuario === undefined ? USUARIO : opciones.usuario;
  const db = {
    tokens: [] as FilaToken[],
    sesiones: [] as FilaSesion[],
    entradas: [] as Array<{ rowid: number; idUsuario: number; login: string; logout?: string }>,
    bloqueos: [] as string[],
    secuencia: 100,
  };
  const vigente = (s: FilaSesion, ahora: string) => s.revoked === 0 && s.expiresAt > ahora;
  const aToken = (t: FilaToken) => ({
    id: t.id,
    idUsuario: t.idUsuario,
    nombre: t.nombre,
    hash: t.hash,
    expiresAt: t.expiresAt,
    refreshExpiresAt: t.refreshExpiresAt,
  });

  const usuarios = {
    buscarParaLogin: vi.fn(async (login: string) => (usuario?.login === login ? usuario : null)),
    buscarPorId: vi.fn(async (id: number) => (usuario?.id === id ? usuario : null)),
    filaPublica: vi.fn(async (id: number) => ({ rowid: id, login: 'cajero1' })),
  };
  const tokens = {
    buscarPorId: vi.fn(async (id: number) => {
      const t = db.tokens.find((x) => x.id === id);
      return t ? aToken(t) : null;
    }),
    buscarPorHashAcceso: vi.fn(async (h: string) => {
      const t = db.tokens.find((x) => x.hash === h);
      return t ? aToken(t) : null;
    }),
    buscarPorHashRefresh: vi.fn(async (h: string) => {
      const t = db.tokens.find((x) => x.hashRefresh === h);
      return t ? aToken(t) : null;
    }),
    eliminarDeDispositivo: vi.fn(async (_tx: unknown, idUsuario: number, nombre: string) => {
      db.tokens = db.tokens.filter((t) => !(t.idUsuario === idUsuario && t.nombre === nombre));
    }),
    eliminar: vi.fn(async (_tx: unknown, id: number) => {
      const antes = db.tokens.length;
      db.tokens = db.tokens.filter((t) => t.id !== id);
      return antes - db.tokens.length;
    }),
    crear: vi.fn(async (_tx: unknown, t: Record<string, string | number>) => {
      db.tokens.push({
        id: ++db.secuencia,
        idUsuario: t.idUsuario as number,
        nombre: t.nombre as string,
        hash: t.hashAcceso as string,
        hashRefresh: t.hashRefresh as string,
        expiresAt: t.expiresAt as string,
        refreshExpiresAt: t.refreshExpiresAt as string,
      });
    }),
    marcarUso: vi.fn(async (id: number, ahora: string) => {
      db.tokens.find((t) => t.id === id)!.lastUsedAt = ahora;
    }),
  };
  const sesiones = {
    activaDeUsuario: vi.fn(
      async (_tx: unknown, idUsuario: number, ahora: string) =>
        [...db.sesiones].reverse().find((s) => s.idUsuario === idUsuario && vigente(s, ahora)) ??
        null,
    ),
    activaEnDispositivo: vi.fn(
      async (idUsuario: number, deviceId: string, ahora: string) =>
        [...db.sesiones]
          .reverse()
          .find((s) => s.idUsuario === idUsuario && s.deviceId === deviceId && vigente(s, ahora)) ??
        null,
    ),
    guardarInicio: vi.fn(async (_tx: unknown, s: Record<string, unknown>) => {
      const datos = {
        revoked: 0,
        expiresAt: s.expiresAt as string,
        ip: s.ip as string | null,
        versionPos: s.versionPos as string | null,
        tokenHash: s.hashAcceso as string,
      };
      const existente = db.sesiones.find((x) => x.id === s.idExistente);
      if (existente) Object.assign(existente, datos);
      else
        db.sesiones.push({
          id: ++db.secuencia,
          idUsuario: s.idUsuario as number,
          deviceId: s.deviceId as string,
          servidorLocal: null,
          ...datos,
        });
    }),
    revocarUltima: vi.fn(async (_tx: unknown, idUsuario: number, ahora: string) => {
      const ultima = [...db.sesiones].reverse().find((s) => s.idUsuario === idUsuario);
      if (ultima) Object.assign(ultima, { revoked: 1, cierreSesion: ahora });
    }),
    actualizarActividad: vi.fn(async (id: number, cambios: Partial<FilaSesion>) => {
      Object.assign(
        db.sesiones.find((s) => s.id === id)!,
        cambios,
      );
    }),
    registrarEntrada: vi.fn(async (_tx: unknown, idUsuario: number, ahora: string) => {
      db.entradas.push({ rowid: ++db.secuencia, idUsuario, login: ahora });
    }),
    registrarSalida: vi.fn(async (_tx: unknown, idUsuario: number, ahora: string) => {
      const abierta = [...db.entradas]
        .reverse()
        .find((e) => e.idUsuario === idUsuario && !e.logout);
      if (!abierta) return false;
      abierta.logout = ahora;
      return true;
    }),
  };
  const apiKeys = {
    usuarioPorApiKey: vi.fn(async (k: string) => (k === 'APIKEY-PLANA' ? usuario : null)),
  };
  const caja = {
    terminalDeUsuario: vi.fn(async () =>
      opciones.terminal === undefined ? { id: 1, enUso: false } : opciones.terminal,
    ),
    estadoCaja: vi.fn(
      async () => opciones.caja ?? { apertura: true, cierre: false, continuar: true },
    ),
  };
  const terceros = {
    proveedoresAsignados: vi.fn(async () => [
      { id: 3, nombre: 'Prov', rif: '900', telefono: null },
    ]),
  };
  const transacciones = { ejecutar: vi.fn(async (fn: (tx: unknown) => unknown) => fn('TX')) };
  const bloqueos = {
    conBloqueo: vi.fn(async (_tx: unknown, nombre: string, fn: () => unknown) => {
      db.bloqueos.push(nombre);
      return fn();
    }),
  };
  const reloj = { ahora: vi.fn(() => AHORA) };

  const servicio = new SesionPosService(
    usuarios as unknown as UsuariosRepositorio,
    tokens as unknown as TokensRepositorio,
    sesiones as unknown as SesionesDispositivoRepositorio,
    apiKeys as unknown as ApiKeyService,
    caja as unknown as CajaService,
    terceros as unknown as TercerosService,
    transacciones as unknown as TransaccionesLegado,
    bloqueos as unknown as BloqueosLegado,
    { dolibarrInstanceKey: CLAVE_INSTANCIA } as AppConfig,
    reloj,
  );
  return { servicio, db, mocks: { usuarios, tokens, sesiones, caja, reloj } };
}

const cuerpoLogin = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ login: 'cajero1', password: 'Secreta#2026', device_name: 'caja-1', ...extra });

describe('SesionPosService.login (contrato apipos)', () => {
  it('cuerpo vacío → 400', async () => {
    const { servicio } = crearMundo();
    await expect(servicio.login('  ', '1.1.1.1')).resolves.toEqual({
      status: 400,
      cuerpo: { error: 'NO SE HAN RECIBIDO DATOS PARA PROCESAR SU SOLICITUD.' },
    });
  });

  it('JSON inválido → 400 con el mensaje de PHP', async () => {
    const { servicio } = crearMundo();
    await expect(servicio.login('{login:', null)).resolves.toEqual({
      status: 400,
      cuerpo: { error: 'ESTRUCTURA DE DATOS RECIBIDOS ERRONEA: Syntax error' },
    });
  });

  it.each([
    ['sin device_name', { device_name: undefined }],
    ['login "0" (falso en PHP)', { login: '0' }],
    ['password vacío', { password: '' }],
    ['device_name con solo espacios', { device_name: '   ' }],
  ])('%s → 403 PARÁMETROS INCOMPLETOS', async (_caso, extra) => {
    const { servicio } = crearMundo();
    await expect(servicio.login(cuerpoLogin(extra), null)).resolves.toEqual({
      status: 403,
      cuerpo: { error: 'PARÁMETROS INCOMPLETOS' },
    });
  });

  it('usuario inexistente o contraseña incorrecta → 403 CREDENCIALES INVALIDAS', async () => {
    const { servicio } = crearMundo();
    for (const extra of [{ login: 'otro' }, { password: 'mala' }]) {
      await expect(servicio.login(cuerpoLogin(extra), null)).resolves.toEqual({
        status: 403,
        cuerpo: { error: 'CREDENCIALES INVALIDAS' },
      });
    }
  });

  it('usuario inactivo → 403', async () => {
    const { servicio } = crearMundo({ usuario: { ...USUARIO, statut: 0 } });
    await expect(servicio.login(cuerpoLogin(), null)).resolves.toMatchObject({
      status: 403,
      cuerpo: { error: 'USUARIO INACTIVO' },
    });
  });

  it('sin api_key → 403', async () => {
    const { servicio } = crearMundo({ usuario: { ...USUARIO, apiKeyGuardada: null } });
    await expect(servicio.login(cuerpoLogin(), null)).resolves.toMatchObject({
      status: 403,
      cuerpo: { error: 'USUARIO NO TIENE API_KEY CONFIGURADA' },
    });
  });

  it('terminal: sin configurar o bloqueada → 403; con app=true no se valida', async () => {
    const sinTerminal = crearMundo({ terminal: null });
    await expect(sinTerminal.servicio.login(cuerpoLogin(), null)).resolves.toMatchObject({
      status: 403,
      cuerpo: { error: 'Usuario no tiene terminal configurada.' },
    });
    const bloqueada = crearMundo({ terminal: { id: 1, enUso: true } });
    await expect(bloqueada.servicio.login(cuerpoLogin(), null)).resolves.toMatchObject({
      status: 403,
      cuerpo: { error: 'Terminal bloqueada.' },
    });
    const app = crearMundo({ terminal: null });
    await expect(app.servicio.login(cuerpoLogin({ app: 'true' }), null)).resolves.toMatchObject({
      status: 200,
    });
  });

  it('éxito → mismo cuerpo que apipos y registra token, sesión del dispositivo y entrada', async () => {
    const { servicio, db } = crearMundo();
    const r = await servicio.login(cuerpoLogin({ version: ' 4.4.81 ', ip: '' }), '10.0.0.9');

    expect(r.status).toBe(200);
    expect(Object.keys(r.cuerpo)).toEqual([
      'access_token',
      'refresh_token',
      'expires_at',
      'device_id',
      'user_id',
      'APIKEY',
      'apertura',
      'cierre',
      'continuar',
      'proveedoresAsignados',
    ]);
    expect(r.cuerpo).toMatchObject({
      access_token: expect.stringMatching(/^[0-9a-f]{64}$/),
      refresh_token: expect.stringMatching(/^[0-9a-f]{64}$/),
      expires_at: '2026-11-28 00:00:00', // 00:00 local del día siguiente
      device_id: 'caja-1',
      user_id: '7', // string, como apipos
      APIKEY: 'APIKEY-PLANA',
      apertura: true,
      cierre: false,
      continuar: true,
      proveedoresAsignados: [{ id: 3, nombre: 'Prov', rif: '900', telefono: null }],
    });

    expect(db.tokens).toEqual([
      expect.objectContaining({
        idUsuario: 7,
        nombre: 'caja-1',
        hash: sha256(r.cuerpo.access_token as string),
        hashRefresh: sha256(r.cuerpo.refresh_token as string),
        refreshExpiresAt: '2026-12-05 00:00:00',
      }),
    ]);
    expect(db.sesiones).toEqual([
      expect.objectContaining({ deviceId: 'caja-1', ip: '10.0.0.9', versionPos: '4.4.81' }),
    ]);
    expect(db.entradas).toEqual([
      expect.objectContaining({ idUsuario: 7, login: '2026-11-27 15:00:00' }),
    ]);
    expect(db.bloqueos).toEqual(['login-pos:7']);
  });

  it('sesión activa en OTRO dispositivo → 423 y no escribe nada', async () => {
    const { servicio, db } = crearMundo();
    await servicio.login(cuerpoLogin(), null);
    const tokensAntes = [...db.tokens];

    await expect(servicio.login(cuerpoLogin({ device_name: 'caja-2' }), null)).resolves.toEqual({
      status: 423,
      cuerpo: {
        error:
          'USUARIO RELACIONADO CON UN ID DE DISPOSITIVO - El usuario ya tiene una sesión activa en el equipo [caja-1].',
      },
    });
    expect(db.tokens).toEqual(tokensAntes);
    expect(db.entradas).toHaveLength(1);
  });

  it('mismo dispositivo → reemplaza su token y reutiliza la sesión del dispositivo', async () => {
    const { servicio, db } = crearMundo();
    const primero = await servicio.login(cuerpoLogin(), null);
    const segundo = await servicio.login(cuerpoLogin(), null);

    expect(segundo.status).toBe(200);
    expect(db.tokens).toHaveLength(1);
    expect(db.tokens[0].hash).toBe(sha256(segundo.cuerpo.access_token as string));
    expect(db.tokens[0].hash).not.toBe(sha256(primero.cuerpo.access_token as string));
    expect(db.sesiones).toHaveLength(1);
    expect(db.entradas).toHaveLength(2);
  });
});

describe('SesionPosService.refresh', () => {
  it('sin refresh_token → 422 como Laravel', async () => {
    const { servicio } = crearMundo();
    for (const cuerpo of [{}, { refresh_token: '  ' }, null]) {
      await expect(servicio.refresh(cuerpo)).resolves.toEqual({
        status: 422,
        cuerpo: {
          message: 'The refresh token field is required.',
          errors: { refresh_token: ['The refresh token field is required.'] },
        },
      });
    }
    await expect(servicio.refresh({ refresh_token: 123 })).resolves.toMatchObject({
      status: 422,
      cuerpo: { message: 'The refresh token field must be a string.' },
    });
  });

  it('desconocido → 401', async () => {
    const { servicio } = crearMundo();
    await expect(servicio.refresh({ refresh_token: 'x' })).resolves.toEqual({
      status: 401,
      cuerpo: { message: 'Refresh token inválido o expirado.' },
    });
  });

  it('válido → rota el token del mismo dispositivo', async () => {
    const { servicio, db } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    const r = await servicio.refresh({ refresh_token: login.cuerpo.refresh_token });

    expect(r.status).toBe(200);
    expect(r.cuerpo.device_id).toBe('caja-1');
    expect(r.cuerpo.access_token).not.toBe(login.cuerpo.access_token);
    expect(db.tokens).toHaveLength(1);
    expect(db.tokens[0].hash).toBe(sha256(r.cuerpo.access_token as string));
    // El refresh viejo ya no sirve.
    await expect(
      servicio.refresh({ refresh_token: login.cuerpo.refresh_token }),
    ).resolves.toMatchObject({
      status: 401,
    });
  });

  it('vencido → 401', async () => {
    const { servicio, db, mocks } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    mocks.reloj.ahora.mockReturnValue(new Date(2026, 11, 6)); // después del 5-dic
    await expect(
      servicio.refresh({ refresh_token: login.cuerpo.refresh_token }),
    ).resolves.toMatchObject({
      status: 401,
    });
    expect(db.tokens).toHaveLength(1);
  });

  it('dos refresh simultáneos con el mismo token → solo uno gana', async () => {
    const { servicio, mocks } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    mocks.tokens.eliminar.mockResolvedValueOnce(0); // otro proceso ya lo consumió
    await expect(
      servicio.refresh({ refresh_token: login.cuerpo.refresh_token }),
    ).resolves.toMatchObject({
      status: 401,
    });
  });
});

describe('SesionPosService.usuarioDeToken (/me)', () => {
  it('token vigente → usuario y registra el uso', async () => {
    const { servicio, db } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    const r = await servicio.usuarioDeToken(login.cuerpo.access_token as string);
    expect(r?.usuario.id).toBe(7);
    expect(db.tokens[0].lastUsedAt).toBe('2026-11-27 15:00:00');
  });

  it('acepta el formato de Sanctum "id|token"', async () => {
    const { servicio, db } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    await expect(
      servicio.usuarioDeToken(`${db.tokens[0].id}|${login.cuerpo.access_token as string}`),
    ).resolves.toMatchObject({ usuario: { id: 7 } });
    await expect(servicio.usuarioDeToken(`${db.tokens[0].id}|otro`)).resolves.toBeNull();
  });

  it('vencido o desconocido → null', async () => {
    const { servicio, mocks } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    await expect(servicio.usuarioDeToken('desconocido')).resolves.toBeNull();
    mocks.reloj.ahora.mockReturnValue(new Date(2026, 10, 28, 0, 0, 1));
    await expect(servicio.usuarioDeToken(login.cuerpo.access_token as string)).resolves.toBeNull();
  });
});

describe('SesionPosService.logout', () => {
  it('con access token → borra el token, revoca la sesión y cierra la entrada', async () => {
    const { servicio, db } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    const r = await servicio.logout({
      bearer: login.cuerpo.access_token as string,
      accessTokenCampo: undefined,
      apiKey: '',
    });
    expect(r).toEqual({
      status: 200,
      cuerpo: { success: true, user_id: 7, date_logout: '2026-11-27 15:00:00' },
    });
    expect(db.tokens).toHaveLength(0);
    expect(db.sesiones[0]).toMatchObject({ revoked: 1, cierreSesion: '2026-11-27 15:00:00' });
    expect(db.entradas[0].logout).toBe('2026-11-27 15:00:00');
  });

  it('con DOLAPIKEY y sin entrada abierta → 200 con error (como apipos)', async () => {
    const { servicio } = crearMundo();
    await expect(
      servicio.logout({ bearer: null, accessTokenCampo: undefined, apiKey: 'APIKEY-PLANA' }),
    ).resolves.toEqual({
      status: 200,
      cuerpo: { error: 'No se encontró un login activo para este usuario.' },
    });
  });

  it('access_token en el cuerpo también sirve; sin credenciales → 401', async () => {
    const { servicio, db } = crearMundo();
    const login = await servicio.login(cuerpoLogin(), null);
    await expect(
      servicio.logout({ bearer: null, accessTokenCampo: login.cuerpo.access_token, apiKey: '' }),
    ).resolves.toMatchObject({ status: 200, cuerpo: { success: true } });
    expect(db.tokens).toHaveLength(0);

    await expect(
      servicio.logout({ bearer: null, accessTokenCampo: undefined, apiKey: 'mala' }),
    ).resolves.toEqual({
      status: 401,
      cuerpo: { message: 'Falta DOLAPIKEY o el access_token es invalido.' },
    });
  });
});

describe('SesionPosService.registrarActividad (integrosTokenOpen)', () => {
  const usuario = { id: 7, login: 'cajero1', nombre: 'Ana', admin: false, entity: 1 };

  it('valida device_id e idusuario', async () => {
    const { servicio } = crearMundo();
    await expect(servicio.registrarActividad(usuario, {})).resolves.toEqual({
      status: 400,
      cuerpo: { error: 'PARÁMETROS INCOMPLETOS: device_id es obligatorio.' },
    });
    await expect(
      servicio.registrarActividad(usuario, { device_id: 'caja-1', idusuario: '8' }),
    ).resolves.toEqual({
      status: 403,
      cuerpo: { error: 'EL idusuario NO CORRESPONDE AL USUARIO DE LA DOLAPIKEY.' },
    });
  });

  it('sin sesión activa en ese dispositivo → 404', async () => {
    const { servicio } = crearMundo();
    await expect(
      servicio.registrarActividad(usuario, { device_id: 'caja-9', idusuario: '' }),
    ).resolves.toEqual({
      status: 404,
      cuerpo: { error: 'NO HAY SESIÓN ACTIVA PARA ESTE USUARIO EN EL DISPOSITIVO [caja-9].' },
    });
  });

  it('actualiza solo lo que viene y conserva lo demás', async () => {
    const { servicio, db } = crearMundo();
    await servicio.login(cuerpoLogin({ ip: '10.0.0.1', version: '1.0' }), null);
    const r = await servicio.registrarActividad(usuario, {
      device_id: 'caja-1',
      idusuario: 7,
      ip_local: '',
      version: '2.0',
      servidor_local: 'srv',
    });
    expect(r).toEqual({
      status: 200,
      cuerpo: {
        success: true,
        user_id: 7,
        device_id: 'caja-1',
        ip: '10.0.0.1',
        version: '2.0',
        servidor_local: 'srv',
        last_seen_at: '2026-11-27 15:00:00',
      },
    });
    expect(db.sesiones[0]).toMatchObject({ versionPos: '2.0', servidorLocal: 'srv' });
  });
});

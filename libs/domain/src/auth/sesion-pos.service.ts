import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { BloqueosLegado, type LegacyEjecutor, TransaccionesLegado } from '@erp/database';
import { descifrarDolibarr, verificarPasswordDolibarr } from '@erp/dolibarr';
import { CajaService } from '@erp/domain/pos';
import { TercerosService } from '@erp/domain/terceros';
import {
  AppConfig,
  formatearFechaHora,
  inicioDelDia,
  leerFechaHora,
  mbSubstr,
  phpBooleano,
  phpEntero,
  phpString,
  phpTrim,
  phpVacio,
  Reloj,
  sumarDias,
} from '@erp/shared';
import { ApiKeyService } from './api-key.service.js';
import { SesionesDispositivoRepositorio } from './sesiones-dispositivo.repositorio.js';
import { TokensRepositorio } from './tokens.repositorio.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';
import { type UsuarioParaLogin, UsuariosRepositorio } from './usuarios.repositorio.js';

/** Respuesta con el status y cuerpo exactos del contrato apipos. */
export interface RespuestaLegado {
  status: number;
  cuerpo: Record<string, unknown>;
}

const respuesta = (status: number, cuerpo: Record<string, unknown>): RespuestaLegado => ({
  status,
  cuerpo,
});

/** Días de validez del refresh token más allá del access token (REFRESH_DAYS de apipos). */
const DIAS_REFRESH = 7;

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');
const tokenAleatorio = () => randomBytes(32).toString('hex');

/** `!$valor` de PHP para cualquier tipo (password puede no ser string). */
function phpFalso(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === 'object' && valor !== null) return false;
  return valor === 0 || valor === false || phpVacio(phpString(valor));
}

/** isset($p[k]) && trim((string)$p[k]) !== '' → valor recortado, si no null. */
function textoOpcional(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  const texto = phpTrim(phpString(valor));
  return texto === '' ? null : texto;
}

interface TokenEmitido {
  accessPlano: string;
  refreshPlano: string;
  expiresAt: string;
}

/**
 * Sesión del POS (Flutter): login, refresh, logout, /me y actividad del
 * dispositivo. Réplica de AuthService + AuthController de apipos con las
 * mejoras de concurrencia del ADR 0004 (escrituras en una transacción y
 * login serializado por usuario). Diferencias con apipos: docs/adr/0005.
 */
@Injectable()
export class SesionPosService {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly tokens: TokensRepositorio,
    private readonly sesiones: SesionesDispositivoRepositorio,
    private readonly apiKeys: ApiKeyService,
    private readonly caja: CajaService,
    private readonly terceros: TercerosService,
    private readonly transacciones: TransaccionesLegado,
    private readonly bloqueos: BloqueosLegado,
    private readonly config: AppConfig,
    private readonly reloj: Reloj,
  ) {}

  /** POST /custom/integrospos/login.php (cuerpo crudo, como getContent() de Laravel). */
  async login(cuerpoCrudo: string, ipPeticion: string | null): Promise<RespuestaLegado> {
    if (phpTrim(cuerpoCrudo) === '') {
      return respuesta(400, { error: 'NO SE HAN RECIBIDO DATOS PARA PROCESAR SU SOLICITUD.' });
    }
    let payload: unknown;
    try {
      payload = JSON.parse(cuerpoCrudo);
    } catch {
      return respuesta(400, { error: 'ESTRUCTURA DE DATOS RECIBIDOS ERRONEA: Syntax error' });
    }
    const p: Record<string, unknown> =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    const login = p.login !== undefined && p.login !== null ? phpTrim(phpString(p.login)) : null;
    const password = p.password ?? null;
    const deviceName =
      p.device_name !== undefined && p.device_name !== null
        ? phpTrim(phpString(p.device_name))
        : null;
    const esApp = phpBooleano(p.app ?? false);
    const ip = textoOpcional(p.ip) ?? ipPeticion;
    const versionPos = textoOpcional(p.version);

    if (phpVacio(login) || phpFalso(password) || phpVacio(deviceName)) {
      return respuesta(403, { error: 'PARÁMETROS INCOMPLETOS' });
    }

    const usuario = await this.usuarios.buscarParaLogin(login!);
    if (!usuario || !(await verificarPasswordDolibarr(phpString(password), usuario.credenciales))) {
      return respuesta(403, { error: 'CREDENCIALES INVALIDAS' });
    }
    if (usuario.statut !== 1) {
      return respuesta(403, { error: 'USUARIO INACTIVO' });
    }
    if (phpVacio(usuario.apiKeyGuardada)) {
      return respuesta(403, { error: 'USUARIO NO TIENE API_KEY CONFIGURADA' });
    }

    if (!esApp) {
      const terminal = await this.caja.terminalDeUsuario(usuario.id);
      if (!terminal) {
        return respuesta(403, { error: 'Usuario no tiene terminal configurada.' });
      }
      if (terminal.enUso) {
        return respuesta(403, { error: 'Terminal bloqueada.' });
      }
    }

    const ahora = this.reloj.ahora();
    const ahoraTxt = formatearFechaHora(ahora);

    // Todo el registro de la sesión es una transacción, serializada por usuario
    // para que dos dispositivos no puedan iniciar sesión a la vez (apipos no lo garantizaba).
    const resultado = await this.transacciones.ejecutar((tx) =>
      this.bloqueos.conBloqueo(tx, `login-pos:${usuario.id}`, async () => {
        const activa = await this.sesiones.activaDeUsuario(tx, usuario.id, ahoraTxt);
        if (activa && activa.deviceId !== deviceName) {
          return { bloqueadoPor: activa.deviceId };
        }
        await this.tokens.eliminarDeDispositivo(tx, usuario.id, deviceName!);
        const emitido = await this.emitirToken(tx, usuario.id, deviceName!, ahora);
        await this.sesiones.guardarInicio(tx, {
          idExistente: activa?.id ?? null,
          idUsuario: usuario.id,
          deviceId: deviceName!,
          hashAcceso: sha256(emitido.accessPlano),
          hashRefresh: sha256(emitido.refreshPlano),
          expiresAt: emitido.expiresAt,
          ahora: ahoraTxt,
          ip: ip !== null ? mbSubstr(ip, 45) : null,
          versionPos: versionPos !== null ? mbSubstr(versionPos, 50) : null,
        });
        await this.sesiones.registrarEntrada(tx, usuario.id, ahoraTxt);
        return { emitido };
      }),
    );

    if ('bloqueadoPor' in resultado) {
      return respuesta(423, {
        error: `USUARIO RELACIONADO CON UN ID DE DISPOSITIVO - El usuario ya tiene una sesión activa en el equipo [${resultado.bloqueadoPor}].`,
      });
    }
    return respuesta(200, await this.armarSesion(usuario, deviceName!, resultado.emitido));
  }

  /** POST /custom/integrospos/refresh. Body ya parseado (JSON o formulario). */
  async refresh(cuerpo: unknown): Promise<RespuestaLegado> {
    const valor = (cuerpo as Record<string, unknown> | null)?.refresh_token;
    // Igual que Laravel: TrimStrings + ConvertEmptyStringsToNull + 'required|string'.
    const texto = typeof valor === 'string' ? phpTrim(valor) : valor;
    if (
      texto === undefined ||
      texto === null ||
      texto === '' ||
      (Array.isArray(texto) && texto.length === 0)
    ) {
      return this.errorValidacion('refresh_token', 'The refresh token field is required.');
    }
    if (typeof texto !== 'string') {
      return this.errorValidacion('refresh_token', 'The refresh token field must be a string.');
    }

    const invalido = respuesta(401, { message: 'Refresh token inválido o expirado.' });
    const token = await this.tokens.buscarPorHashRefresh(sha256(texto));
    const ahora = this.reloj.ahora();
    if (!token || (token.refreshExpiresAt && leerFechaHora(token.refreshExpiresAt) < ahora)) {
      return invalido;
    }
    const usuario = await this.usuarios.buscarPorId(token.idUsuario);
    if (!usuario) {
      return invalido;
    }

    // Rota: elimina el token actual y emite uno nuevo para el mismo dispositivo.
    const emitido = await this.transacciones.ejecutar(async (tx) => {
      // Si otro refresh simultáneo ya lo consumió, este es inválido (evita duplicar sesiones).
      if ((await this.tokens.eliminar(tx, token.id)) === 0) {
        return null;
      }
      return this.emitirToken(tx, usuario.id, token.nombre, ahora);
    });
    if (!emitido) {
      return invalido;
    }
    return respuesta(200, await this.armarSesion(usuario, token.nombre, emitido));
  }

  /**
   * Usuario dueño de un access token vigente (guard de GET /me, como Sanctum).
   * Acepta el formato de Sanctum "id|token" y el token plano.
   */
  async usuarioDeToken(
    bearer: string,
  ): Promise<{ usuario: UsuarioAutenticado; idToken: number } | null> {
    let token;
    const separador = bearer.indexOf('|');
    if (separador > 0) {
      const id = phpEntero(bearer.slice(0, separador));
      token = await this.tokens.buscarPorId(id);
      const esperado = Buffer.from(sha256(bearer.slice(separador + 1)));
      if (
        !token ||
        token.hash.length !== esperado.length ||
        !timingSafeEqual(Buffer.from(token.hash), esperado)
      ) {
        return null;
      }
    } else {
      token = await this.tokens.buscarPorHashAcceso(sha256(bearer));
    }
    const ahora = this.reloj.ahora();
    if (!token || (token.expiresAt && leerFechaHora(token.expiresAt) < ahora)) {
      return null;
    }
    const usuario = await this.usuarios.buscarPorId(token.idUsuario);
    if (!usuario) {
      return null;
    }
    await this.tokens.marcarUso(token.id, formatearFechaHora(ahora));
    return { usuario, idToken: token.id };
  }

  /** GET /custom/integrospos/me: la fila del usuario como la serializaba Eloquent. */
  async perfil(idUsuario: number): Promise<Record<string, unknown> | null> {
    return this.usuarios.filaPublica(idUsuario);
  }

  /**
   * POST /custom/integrospos/logout. Se identifica por access token (header
   * Bearer o campo access_token) o, si no viene, por DOLAPIKEY.
   */
  async logout(entrada: {
    bearer: string | null;
    accessTokenCampo: unknown;
    apiKey: string;
  }): Promise<RespuestaLegado> {
    const plano = entrada.bearer || phpTrim(phpString(entrada.accessTokenCampo));
    if (plano !== '') {
      const token = await this.tokens.buscarPorHashAcceso(sha256(plano));
      const usuario = token ? await this.usuarios.buscarPorId(token.idUsuario) : null;
      if (token && usuario) {
        return respuesta(200, await this.cerrarSesion(usuario.id, token.id));
      }
    }

    const usuario = await this.apiKeys.usuarioPorApiKey(entrada.apiKey);
    if (!usuario) {
      return respuesta(401, { message: 'Falta DOLAPIKEY o el access_token es invalido.' });
    }
    return respuesta(200, await this.cerrarSesion(usuario.id, null));
  }

  /** POST /api.php/integrospos/terminales/integrosTokenOpen (requiere DOLAPIKEY). */
  async registrarActividad(
    usuario: UsuarioAutenticado,
    payload: Record<string, unknown>,
  ): Promise<RespuestaLegado> {
    const deviceId = phpTrim(phpString(payload.device_id));
    if (deviceId === '') {
      return respuesta(400, { error: 'PARÁMETROS INCOMPLETOS: device_id es obligatorio.' });
    }
    const idusuario = payload.idusuario;
    const idusuarioPresente =
      idusuario !== undefined &&
      idusuario !== null &&
      !(typeof idusuario === 'string' && phpTrim(idusuario) === '');
    if (idusuarioPresente && phpEntero(idusuario) !== usuario.id) {
      return respuesta(403, { error: 'EL idusuario NO CORRESPONDE AL USUARIO DE LA DOLAPIKEY.' });
    }

    const ahoraTxt = formatearFechaHora(this.reloj.ahora());
    const sesion = await this.sesiones.activaEnDispositivo(usuario.id, deviceId, ahoraTxt);
    if (!sesion) {
      return respuesta(404, {
        error: `NO HAY SESIÓN ACTIVA PARA ESTE USUARIO EN EL DISPOSITIVO [${deviceId}].`,
      });
    }

    const ip = phpTrim(phpString(payload.ip_local));
    const version = phpTrim(phpString(payload.version));
    const servidorLocal = phpTrim(phpString(payload.servidor_local));
    const actualizada = {
      ip: ip !== '' ? mbSubstr(ip, 45) : sesion.ip,
      versionPos: version !== '' ? mbSubstr(version, 50) : sesion.versionPos,
      servidorLocal: servidorLocal !== '' ? mbSubstr(servidorLocal, 255) : sesion.servidorLocal,
    };
    await this.sesiones.actualizarActividad(sesion.id, { ...actualizada, lastSeenAt: ahoraTxt });

    return respuesta(200, {
      success: true,
      user_id: usuario.id,
      device_id: sesion.deviceId,
      ip: actualizada.ip,
      version: actualizada.versionPos,
      servidor_local: actualizada.servidorLocal,
      last_seen_at: ahoraTxt,
    });
  }

  private async cerrarSesion(
    idUsuario: number,
    idToken: number | null,
  ): Promise<Record<string, unknown>> {
    const ahoraTxt = formatearFechaHora(this.reloj.ahora());
    const habiaEntrada = await this.transacciones.ejecutar(async (tx) => {
      if (idToken !== null) {
        await this.tokens.eliminar(tx, idToken);
      }
      await this.sesiones.revocarUltima(tx, idUsuario, ahoraTxt);
      return this.sesiones.registrarSalida(tx, idUsuario, ahoraTxt);
    });
    if (!habiaEntrada) {
      return { error: 'No se encontró un login activo para este usuario.' };
    }
    return { success: true, user_id: idUsuario, date_logout: ahoraTxt };
  }

  /** Access token vence a las 00:00 (hora local) del día siguiente; refresh, 7 días después. */
  private async emitirToken(
    ej: LegacyEjecutor,
    idUsuario: number,
    nombre: string,
    ahora: Date,
  ): Promise<TokenEmitido> {
    const accessPlano = tokenAleatorio();
    const refreshPlano = tokenAleatorio();
    const vence = inicioDelDia(sumarDias(ahora, 1));
    const expiresAt = formatearFechaHora(vence);
    await this.tokens.crear(ej, {
      idUsuario,
      nombre,
      hashAcceso: sha256(accessPlano),
      hashRefresh: sha256(refreshPlano),
      expiresAt,
      refreshExpiresAt: formatearFechaHora(sumarDias(vence, DIAS_REFRESH)),
      ahora: formatearFechaHora(ahora),
    });
    return { accessPlano, refreshPlano, expiresAt };
  }

  /** Cuerpo de respuesta de login y refresh (mismo orden de campos que apipos). */
  private async armarSesion(
    usuario: UsuarioParaLogin,
    deviceName: string,
    emitido: TokenEmitido,
  ): Promise<Record<string, unknown>> {
    const [caja, proveedoresAsignados] = await Promise.all([
      this.caja.estadoCaja(usuario.id),
      this.terceros.proveedoresAsignados(usuario.id),
    ]);
    return {
      access_token: emitido.accessPlano,
      refresh_token: emitido.refreshPlano,
      expires_at: emitido.expiresAt,
      device_id: deviceName,
      user_id: String(usuario.id),
      APIKEY: descifrarDolibarr(usuario.apiKeyGuardada, this.config.dolibarrInstanceKey),
      apertura: caja.apertura,
      cierre: caja.cierre,
      continuar: caja.continuar,
      proveedoresAsignados,
    };
  }

  private errorValidacion(campo: string, mensaje: string): RespuestaLegado {
    return respuesta(422, { message: mensaje, errors: { [campo]: [mensaje] } });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  ConsultasPdoLegado,
  LEGACY_DB,
  type LegacyDb,
  PREFIJO_LEGADO,
  usuarios,
} from '@erp/database';
import type { CredencialesDolibarr } from '@erp/dolibarr';
import { and, eq, inArray } from 'drizzle-orm';
import { nombreVisible, type UsuarioAutenticado } from './usuario-autenticado.js';

export interface FiltroApiKey {
  /** Valores posibles de llx_user.api_key (texto plano y cifrado). */
  apiKeys: string[];
  /** Limitar a estas entidades (Dolibarr multicompañía). Sin valor = todas. */
  entidades?: number[];
}

/** Usuario con los datos que necesita el login (incluye credenciales: NO exponer). */
export interface UsuarioParaLogin extends UsuarioAutenticado {
  statut: number;
  credenciales: CredencialesDolibarr;
  /** llx_user.api_key tal como está guardada (cifrada o en texto plano). */
  apiKeyGuardada: string | null;
}

/**
 * Columnas que NUNCA salen en una respuesta. apipos ocultaba pass,
 * pass_crypted y api_key; erp-node también oculta pass_temp (contraseña
 * temporal), que apipos exponía en /me. Ver docs/adr/0005.
 */
const COLUMNAS_OCULTAS = ['pass', 'pass_crypted', 'pass_temp', 'api_key'];

const camposUsuario = {
  rowid: usuarios.rowid,
  login: usuarios.login,
  firstname: usuarios.firstname,
  lastname: usuarios.lastname,
  admin: usuarios.admin,
  entity: usuarios.entity,
};

type FilaUsuario = {
  rowid: number;
  login: string;
  firstname: string | null;
  lastname: string | null;
  admin: number;
  entity: number;
};

function aUsuario(fila: FilaUsuario): UsuarioAutenticado {
  return {
    id: fila.rowid,
    login: fila.login,
    nombre: nombreVisible(fila.firstname, fila.lastname, fila.login),
    admin: fila.admin === 1,
    entity: fila.entity,
  };
}

/**
 * Acceso a llx_user. Es el ÚNICO lugar del dominio auth que conoce la tabla;
 * el resto trabaja con `UsuarioAutenticado`.
 */
@Injectable()
export class UsuariosRepositorio {
  constructor(
    @Inject(LEGACY_DB) private readonly db: LegacyDb,
    private readonly consultasPdo: ConsultasPdoLegado,
  ) {}

  async buscarActivoPorApiKey({
    apiKeys,
    entidades,
  }: FiltroApiKey): Promise<UsuarioAutenticado | null> {
    const [fila] = await this.db
      .select(camposUsuario)
      .from(usuarios)
      .where(
        and(
          eq(usuarios.statut, 1),
          inArray(usuarios.apiKey, apiKeys),
          entidades ? inArray(usuarios.entity, entidades) : undefined,
        ),
      )
      .limit(1);
    return fila ? aUsuario(fila) : null;
  }

  /** Usuario por id, sin filtrar estado (como `tokenable` de Sanctum). */
  async buscarPorId(id: number): Promise<UsuarioParaLogin | null> {
    return this.buscarConCredenciales(eq(usuarios.rowid, id));
  }

  /** Usuario por login en las entidades 0 y 1 (como AuthService::login de apipos). */
  async buscarParaLogin(login: string): Promise<UsuarioParaLogin | null> {
    return this.buscarConCredenciales(
      and(eq(usuarios.login, login), inArray(usuarios.entity, [0, 1])),
    );
  }

  /**
   * Fila completa de llx_user, sin columnas sensibles, con los tipos que
   * entregaba Eloquent (respuesta de GET /me).
   */
  async filaPublica(id: number): Promise<Record<string, unknown> | null> {
    const [fila] = await this.consultasPdo.filas(
      `SELECT * FROM \`${PREFIJO_LEGADO}user\` WHERE rowid = ? LIMIT 1`,
      [id],
    );
    if (!fila) {
      return null;
    }
    for (const columna of COLUMNAS_OCULTAS) {
      delete fila[columna];
    }
    return fila;
  }

  private async buscarConCredenciales(
    condicion: ReturnType<typeof and>,
  ): Promise<UsuarioParaLogin | null> {
    const [fila] = await this.db
      .select({
        ...camposUsuario,
        statut: usuarios.statut,
        pass: usuarios.pass,
        passCrypted: usuarios.passCrypted,
        apiKey: usuarios.apiKey,
      })
      .from(usuarios)
      .where(condicion)
      .limit(1);
    if (!fila) {
      return null;
    }
    return {
      ...aUsuario(fila),
      statut: fila.statut,
      credenciales: { passCrypted: fila.passCrypted, passPlano: fila.pass },
      apiKeyGuardada: fila.apiKey,
    };
  }
}

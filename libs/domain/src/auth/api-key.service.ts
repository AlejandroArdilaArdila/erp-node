import { Injectable } from '@nestjs/common';
import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import { AppConfig } from '@erp/shared';
import type { UsuarioAutenticado } from './usuario-autenticado.js';
import { UsuariosRepositorio } from './usuarios.repositorio.js';

/** Entidades válidas para el guard DOLAPIKEY (igual que ApiKeyGuard de apipos). */
const ENTIDADES_GUARD = [0, 1];

export type ResultadoValidacionApiKey =
  | { ok: false; error: string }
  | { ok: true; user: { id: number; login: string; nombre: string; admin: number } };

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly config: AppConfig,
  ) {}

  /** La api_key puede estar guardada en texto plano o cifrada con IV fijo. */
  private valoresPosibles(apiKey: string): string[] {
    return [apiKey, cifrarApiKeyDolibarr(apiKey, this.config.dolibarrInstanceKey)];
  }

  /**
   * Usuario dueño de la DOLAPIKEY, para el guard de rutas protegidas.
   * Réplica de App\Auth\ApiKeyGuard::user().
   */
  async usuarioPorApiKey(apiKey: string): Promise<UsuarioAutenticado | null> {
    if (!apiKey) {
      return null;
    }
    return this.usuarios.buscarActivoPorApiKey({
      apiKeys: this.valoresPosibles(apiKey),
      entidades: ENTIDADES_GUARD,
    });
  }

  /**
   * POST /custom/integrospos/validateApiKey.
   * Réplica de UsuariosService::validarApiKey: OJO, el original NO filtra por
   * entity (a diferencia del guard). Se mantiene igual para no cambiar el
   * contrato; revisar con el equipo si es intencional.
   */
  async validar(apiKeyCruda: string): Promise<ResultadoValidacionApiKey> {
    const apiKey = apiKeyCruda.trim();
    if (apiKey === '') {
      return { ok: false, error: 'APIKEY requerida' };
    }

    const usuario = await this.usuarios.buscarActivoPorApiKey({
      apiKeys: this.valoresPosibles(apiKey),
    });
    if (!usuario) {
      return { ok: false, error: 'APIKEY inválida' };
    }

    return {
      ok: true,
      user: {
        id: usuario.id,
        login: usuario.login,
        nombre: usuario.nombre,
        admin: usuario.admin ? 1 : 0,
      },
    };
  }
}

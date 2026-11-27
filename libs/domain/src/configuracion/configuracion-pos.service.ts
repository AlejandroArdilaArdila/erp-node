import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfig, phpEntero, phpVacio } from '@erp/shared';
import { CiudadesRepositorio } from './ciudades.repositorio.js';
import { ConstantesService } from './constantes.service.js';

/** Respuesta de GET /api.php/integrospos/customers/posapi/departamentos (contrato apipos). */
export interface DepartamentosYCiudadesLegado {
  departamentos: Array<{ code_depto: string; depto: string }>;
  ciudades: Array<{ rowid: string; code_depto: string; code: string; ciudad: string; zip: string }>;
}

/** Respuesta de GET /api.php/integrospos/pos/update/check (contrato apipos). */
export interface ActualizacionPosLegado {
  version: string;
  build: number;
  changelog: string;
  forzar: boolean;
  windows_url: string;
  linux_url: string;
}

/** `rtrim($texto, '/')` de PHP. */
function quitarBarrasFinales(texto: string): string {
  return texto.replace(/\/+$/, '');
}

@Injectable()
export class ConfiguracionPosService {
  constructor(
    private readonly ciudades: CiudadesRepositorio,
    private readonly constantes: ConstantesService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Réplica de ConfiguracionService::departamentosYCiudades (apipos).
   * Todos los campos van como texto (`(string)` de PHP: NULL → '').
   */
  async departamentosYCiudades(): Promise<DepartamentosYCiudadesLegado> {
    const departamentos = await this.ciudades.departamentosActivos();
    const ciudades = await this.ciudades.ciudadesActivas();
    return {
      departamentos: departamentos.map((d) => ({
        code_depto: d.codigo ?? '',
        depto: d.nombre,
      })),
      ciudades: ciudades.map((c) => ({
        rowid: String(c.id),
        code_depto: c.codigoDepartamento ?? '',
        code: c.codigo ?? '',
        ciudad: c.nombre,
        zip: c.codigoPostal,
      })),
    };
  }

  /**
   * Réplica de ConfiguracionService::verificarActualizacion (apipos): versión
   * publicada del POS de escritorio (constantes POS_UPDATE_*).
   *
   * - Sin versión o sin build (`empty()` de PHP: también '0') →
   *   404 { "message": "No hay una actualización configurada" }.
   * - `forzar` es `(bool)` de PHP: solo '' y '0' son falsos ('false' es verdadero).
   */
  async verificarActualizacion(): Promise<ActualizacionPosLegado> {
    const valores = await this.constantes.valores([
      'POS_UPDATE_VERSION',
      'POS_UPDATE_BUILD',
      'POS_UPDATE_CHANGELOG',
      'POS_UPDATE_FORZAR',
    ]);
    const version = valores.get('POS_UPDATE_VERSION');
    const build = valores.get('POS_UPDATE_BUILD');

    if (phpVacio(version) || phpVacio(build)) {
      throw new HttpException(
        { message: 'No hay una actualización configurada' },
        HttpStatus.NOT_FOUND,
      );
    }

    const urlBase = quitarBarrasFinales(this.config.urlBaseActualizacionPos);
    return {
      version: version as string,
      build: phpEntero(build),
      changelog: valores.get('POS_UPDATE_CHANGELOG') ?? '',
      forzar: !phpVacio(valores.get('POS_UPDATE_FORZAR')),
      windows_url: `${urlBase}/pos.exe`,
      linux_url: `${urlBase}/pos.deb`,
    };
  }
}

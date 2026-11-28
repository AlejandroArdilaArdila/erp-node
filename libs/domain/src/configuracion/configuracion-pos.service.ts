import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AppConfig, phpEntero, phpUnserialize, phpVacio } from '@erp/shared';
import { CatalogosRepositorio } from './catalogos.repositorio.js';
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

/** Opción de un catálogo: `valor` siempre es texto; `label` conserva el tipo original. */
export interface OpcionLegado {
  valor: string;
  label: unknown;
}

/** Respuesta de GET /api.php/integrospos/pos/getCategorieIva (contrato apipos). */
export interface CatalogosProductoLegado {
  ivas: OpcionLegado[];
  categorias: OpcionLegado[];
  peso: OpcionLegado[];
  volumen: OpcionLegado[];
}

/** Colombia en llx_c_country. */
const ID_PAIS_COLOMBIA = 70;

/** `rtrim($texto, '/')` de PHP. */
function quitarBarrasFinales(texto: string): string {
  return texto.replace(/\/+$/, '');
}

@Injectable()
export class ConfiguracionPosService {
  constructor(
    private readonly catalogos: CatalogosRepositorio,
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

  /**
   * Réplica de ConfiguracionService::getCategorieIva (apipos): catálogos del
   * formulario de producto del POS.
   *
   * - `categorias`: opciones del extrafield "categoria" (param guardado con
   *   serialize() de PHP). Si no existe o no se puede leer → [].
   * - `ivas`: tarifas activas de Colombia. Si localtax1_type es 1 (impoconsumo)
   *   el valor es localtax1; si no, la tarifa de IVA. `(string)` de un DOUBLE de
   *   PHP coincide con `String()` para tarifas como 19, 5 o 2.5.
   * - `peso` / `volumen`: unidades con su escala como texto (NULL → '').
   *
   * Diferencia conocida: si `options` existiera pero no fuera un array, el
   * original fallaría con 500 (warning de foreach convertido en excepción por
   * Laravel); aquí se devuelve []. No ocurre con datos guardados por Dolibarr.
   */
  async catalogosProducto(): Promise<CatalogosProductoLegado> {
    const categorias: OpcionLegado[] = [];
    const param = await this.catalogos.parametrosExtrafield('categoria');
    if (!phpVacio(param)) {
      const parametros = phpUnserialize(param as string);
      const opciones = parametros instanceof Map ? parametros.get('options') : undefined;
      if (opciones instanceof Map) {
        for (const [clave, opcion] of opciones) {
          categorias.push({ valor: String(clave), label: opcion });
        }
      }
    }

    const tarifas = await this.catalogos.tarifasIvaActivas(ID_PAIS_COLOMBIA);
    const peso = await this.catalogos.unidadesPorTipo('weight');
    const volumen = await this.catalogos.unidadesPorTipo('volume');
    const unidad = (u: { escala: number | null; abreviatura: string | null }): OpcionLegado => ({
      valor: u.escala === null ? '' : String(u.escala),
      label: u.abreviatura,
    });

    return {
      ivas: tarifas.map((t) => ({
        valor: phpEntero(t.tipoImpuestoLocal1) === 1 ? t.impuestoLocal1 : String(t.tarifa),
        label: t.codigo,
      })),
      categorias,
      peso: peso.map(unidad),
      volumen: volumen.map(unidad),
    };
  }
}

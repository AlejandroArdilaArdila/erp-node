import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { type PhpJson, phpEntero, phpJsonDecode, phpString, phpTrim, phpVacio } from '@erp/shared';
import { type PlantillaTirilla, TirillasRepositorio } from './tirillas.repositorio.js';

/**
 * Las respuestas llevan JSON de la base (`PhpJson`) y se envían con
 * `responderJsonPhp`, para que el orden de las claves y el formato de los
 * números sean los de json_encode de PHP.
 */
export interface PlantillaLegado {
  rowid: number;
  nombre: string;
  label: string;
  config: PhpJson | never[];
  activo: number;
}

export interface ConfiguracionTirillaLegado {
  rowid: number;
  nombre: string;
  label: string;
  config: PhpJson | never[];
  /** `(object) []` → `{}` si no hay datos de vista previa. */
  dato_preview: PhpJson | Record<string, never>;
  columnas: number;
  variables: PhpJson | never[];
}

export interface SeccionLegado {
  rowid: number;
  nombre: string;
  descripcion: string;
  elementos: PhpJson | never[];
  condicional: PhpJson;
  repeat: PhpJson;
}

/** `json_decode($texto, true) ?? []`: solo el null (o el JSON inválido) se vuelve []. */
function jsonOLista(texto: string | null): PhpJson | never[] {
  const valor = phpJsonDecode(phpString(texto));
  return valor === null ? [] : valor;
}

/** `$arreglo['clave'] ?? null` sobre un valor decodificado. */
function campo(valor: PhpJson | never[], clave: string): PhpJson {
  return valor instanceof Map ? (valor.get(clave) ?? null) : null;
}

/** `strtolower()` de PHP 8: solo letras ASCII. */
function minusculasAscii(texto: string): string {
  return texto.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function noEncontrada(mensaje: string): HttpException {
  // apipos responde 401 (no 404) cuando no encuentra la plantilla.
  return new HttpException({ message: mensaje }, HttpStatus.UNAUTHORIZED);
}

function aPlantillaLegado(p: PlantillaTirilla): PlantillaLegado {
  return {
    rowid: p.id,
    nombre: p.nombre,
    label: p.label,
    config: jsonOLista(p.configJson),
    activo: p.activo ?? 0,
  };
}

/** Réplica de TicketTemplateService (apipos): plantillas de tirilla del POS. */
@Injectable()
export class TirillasService {
  constructor(private readonly tirillas: TirillasRepositorio) {}

  /**
   * GET tickettemplate/{id}: con '0' o 'null' (sin importar mayúsculas), todas
   * las plantillas; con solo dígitos, por rowid; si no, por nombre (recortado).
   * No encontrada → 401 { "message": "Plantilla no encontrada" }.
   */
  async plantillaPorIdONombre(id: string): Promise<PlantillaLegado | PlantillaLegado[]> {
    if (id === '0' || minusculasAscii(id) === 'null') {
      return (await this.tirillas.plantillas()).map(aPlantillaLegado);
    }

    // ctype_digit(): uno o más dígitos, nada más.
    const plantilla = /^\d+$/.test(id)
      ? await this.tirillas.plantillaPorId(phpEntero(id))
      : await this.tirillas.plantillaPorNombre(phpTrim(id));

    if (!plantilla) {
      throw noEncontrada('Plantilla no encontrada');
    }
    return aPlantillaLegado(plantilla);
  }

  /** POST tickettemplate/tipos: todas las plantillas, sin la configuración. */
  async tipos(): Promise<{ tipos: Array<Omit<PlantillaLegado, 'config'>> }> {
    const plantillas = await this.tirillas.plantillas();
    return {
      tipos: plantillas.map((p) => ({
        rowid: p.id,
        nombre: p.nombre,
        label: p.label,
        activo: p.activo ?? 0,
      })),
    };
  }

  /**
   * POST tickettemplate/get: configuración completa de una plantilla por
   * `nombre` (query string + cuerpo, como `$request->input`).
   * - Sin nombre → 401 { "message": "nombre requerido" }.
   * - No existe → 401 { "message": "Tipo no encontrado" }.
   */
  async configuracion(entrada: Record<string, unknown>): Promise<ConfiguracionTirillaLegado> {
    const nombre = phpTrim(phpString(entrada.nombre ?? ''));
    if (nombre === '') {
      throw noEncontrada('nombre requerido');
    }

    const plantilla = await this.tirillas.plantillaPorNombre(nombre);
    if (!plantilla) {
      throw noEncontrada('Tipo no encontrado');
    }

    return {
      rowid: plantilla.id,
      nombre: plantilla.nombre,
      label: plantilla.label,
      config: jsonOLista(plantilla.configJson),
      dato_preview: phpVacio(plantilla.datoPreviewJson)
        ? {}
        : phpJsonDecode(plantilla.datoPreviewJson as string),
      // (int) ($columnas ?: 80)
      columnas: plantilla.columnas === 0 ? 80 : plantilla.columnas,
      variables: phpVacio(plantilla.variablesJson)
        ? []
        : phpJsonDecode(plantilla.variablesJson as string),
    };
  }

  /** POST tickettemplate/variables: variables de campo; tipo vacío → 'string'. */
  async variables(): Promise<{
    variables: Array<{ rowid: number; nombre: string; descripcion: string; tipo: string }>;
  }> {
    const variables = await this.tirillas.variables();
    return {
      variables: variables.map((v) => ({
        rowid: v.id,
        nombre: v.nombre,
        descripcion: v.descripcion,
        tipo: phpVacio(v.tipo) ? 'string' : v.tipo,
      })),
    };
  }

  /**
   * POST tickettemplate/secciones. `elementos` tiene dos formatos: el nuevo es
   * un objeto con "items" (y opcionalmente "condicional" y "repeat"); el viejo
   * es la lista de elementos directamente.
   */
  async secciones(): Promise<{ secciones: SeccionLegado[] }> {
    const secciones = await this.tirillas.secciones();
    return {
      secciones: secciones.map((s) => {
        const bruto = jsonOLista(s.elementosJson);
        // isset($bruto['items']): existe y no es null.
        const formatoNuevo = campo(bruto, 'items') !== null;
        return {
          rowid: s.id,
          nombre: s.nombre,
          descripcion: s.descripcion,
          elementos: formatoNuevo ? campo(bruto, 'items') : bruto,
          condicional: formatoNuevo ? campo(bruto, 'condicional') : null,
          repeat: formatoNuevo ? campo(bruto, 'repeat') : null,
        };
      }),
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import {
  LEGACY_DB,
  type LegacyDb,
  plantillasTirilla,
  seccionesTirilla,
  variablesTirilla,
} from '@erp/database';
import { asc, eq, type SQL, sql } from 'drizzle-orm';
import type { AnyMySqlColumn } from 'drizzle-orm/mysql-core';

/** Plantilla de tirilla. Los campos JSON van como texto, tal como los entrega MySQL. */
export interface PlantillaTirilla {
  id: number;
  nombre: string;
  label: string;
  configJson: string | null;
  activo: number | null;
  datoPreviewJson: string | null;
  columnas: number;
  variablesJson: string | null;
}

export interface SeccionTirilla {
  id: number;
  nombre: string;
  descripcion: string;
  elementosJson: string;
}

export interface VariableTirilla {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: string;
}

/** Texto de una columna JSON de MySQL (lo que recibe PDO), sin que mysql2 lo convierta. */
function textoJson(columna: AnyMySqlColumn) {
  return sql<string | null>`cast(${columna} as char)`;
}

const columnasPlantilla = {
  rowid: plantillasTirilla.rowid,
  nombre: plantillasTirilla.nombre,
  label: plantillasTirilla.label,
  config: plantillasTirilla.config,
  activo: plantillasTirilla.activo,
  datoPreview: textoJson(plantillasTirilla.datoPreview),
  columnas: plantillasTirilla.columnas,
  variables: textoJson(plantillasTirilla.variables),
};

/** Acceso a las tablas de tirillas del POS. Solo lectura. */
@Injectable()
export class TirillasRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /** Todas las plantillas, por rowid. */
  async plantillas(): Promise<PlantillaTirilla[]> {
    const filas = await this.db
      .select(columnasPlantilla)
      .from(plantillasTirilla)
      .orderBy(asc(plantillasTirilla.rowid));
    return filas.map(aPlantilla);
  }

  async plantillaPorId(id: number): Promise<PlantillaTirilla | null> {
    return this.primeraPlantilla(eq(plantillasTirilla.rowid, id));
  }

  /** Por nombre, con la comparación de MySQL (collation), como el original. */
  async plantillaPorNombre(nombre: string): Promise<PlantillaTirilla | null> {
    return this.primeraPlantilla(eq(plantillasTirilla.nombre, nombre));
  }

  /** Secciones reutilizables, por rowid. */
  async secciones(): Promise<SeccionTirilla[]> {
    const filas = await this.db
      .select({
        rowid: seccionesTirilla.rowid,
        nombre: seccionesTirilla.nombre,
        descripcion: seccionesTirilla.descripcion,
        elementos: textoJson(seccionesTirilla.elementos),
      })
      .from(seccionesTirilla)
      .orderBy(asc(seccionesTirilla.rowid));
    return filas.map((f) => ({
      id: f.rowid,
      nombre: f.nombre,
      descripcion: f.descripcion,
      // La columna es NOT NULL; el CAST solo daría NULL si la fila no tuviera JSON.
      elementosJson: f.elementos ?? '',
    }));
  }

  /** Variables de campo, por rowid. */
  async variables(): Promise<VariableTirilla[]> {
    const filas = await this.db
      .select({
        rowid: variablesTirilla.rowid,
        nombre: variablesTirilla.nombre,
        descripcion: variablesTirilla.descripcion,
        tipo: variablesTirilla.tipo,
      })
      .from(variablesTirilla)
      .orderBy(asc(variablesTirilla.rowid));
    return filas.map((f) => ({
      id: f.rowid,
      nombre: f.nombre,
      descripcion: f.descripcion,
      tipo: f.tipo,
    }));
  }

  private async primeraPlantilla(condicion: SQL): Promise<PlantillaTirilla | null> {
    const [fila] = await this.db
      .select(columnasPlantilla)
      .from(plantillasTirilla)
      .where(condicion)
      .limit(1);
    return fila ? aPlantilla(fila) : null;
  }
}

function aPlantilla(f: {
  rowid: number;
  nombre: string;
  label: string;
  config: string | null;
  activo: number | null;
  datoPreview: string | null;
  columnas: number;
  variables: string | null;
}): PlantillaTirilla {
  return {
    id: f.rowid,
    nombre: f.nombre,
    label: f.label,
    configJson: f.config,
    activo: f.activo,
    datoPreviewJson: f.datoPreview,
    columnas: f.columnas,
    variablesJson: f.variables,
  };
}

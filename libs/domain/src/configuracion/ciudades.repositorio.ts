import { Inject, Injectable } from '@nestjs/common';
import { ciudadesFe, LEGACY_DB, type LegacyDb } from '@erp/database';
import { eq } from 'drizzle-orm';

export interface Departamento {
  codigo: string | null;
  nombre: string;
}

export interface Ciudad {
  id: number;
  codigoDepartamento: string | null;
  /** Código DIAN de la ciudad (DIVIPOLA). */
  codigo: string | null;
  nombre: string;
  codigoPostal: string;
}

/** Acceso a llx_c_ciudades_fe. Solo lectura. */
@Injectable()
export class CiudadesRepositorio {
  constructor(@Inject(LEGACY_DB) private readonly db: LegacyDb) {}

  /** Pares (código, nombre) de departamento distintos, de ciudades activas, por nombre. */
  async departamentosActivos(): Promise<Departamento[]> {
    const filas = await this.db
      .selectDistinct({ codeDepto: ciudadesFe.codeDepto, depto: ciudadesFe.depto })
      .from(ciudadesFe)
      .where(eq(ciudadesFe.active, 1))
      .orderBy(ciudadesFe.depto);
    return filas.map((f) => ({ codigo: f.codeDepto, nombre: f.depto }));
  }

  /** Ciudades activas, por nombre. */
  async ciudadesActivas(): Promise<Ciudad[]> {
    const filas = await this.db
      .select({
        rowid: ciudadesFe.rowid,
        codeDepto: ciudadesFe.codeDepto,
        code: ciudadesFe.code,
        ciudad: ciudadesFe.ciudad,
        zip: ciudadesFe.zip,
      })
      .from(ciudadesFe)
      .where(eq(ciudadesFe.active, 1))
      .orderBy(ciudadesFe.ciudad);
    return filas.map((f) => ({
      id: f.rowid,
      codigoDepartamento: f.codeDepto,
      codigo: f.code,
      nombre: f.ciudad,
      codigoPostal: f.zip,
    }));
  }
}

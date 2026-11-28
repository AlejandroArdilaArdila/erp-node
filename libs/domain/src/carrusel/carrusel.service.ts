import { Injectable } from '@nestjs/common';
import { Reloj } from '@erp/shared';
import { CarruselArchivos } from './carrusel.archivos.js';
import { CarruselRepositorio } from './carrusel.repositorio.js';

/** Respuesta de GET /api.php/integrospos/carrusel/activas (contrato apipos). */
export interface CarruselLegado {
  total: number;
  imagenes: Array<{
    rowid: number;
    label: string | null;
    date_start: string;
    date_end: string;
    imagen_base64: string;
  }>;
}

/** Tipo MIME por extensión, como apipos: sensible a mayúsculas ('.PNG' → jpeg). */
function tipoMime(archivo: string): string {
  if (archivo.endsWith('.webp')) return 'image/webp';
  if (archivo.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

@Injectable()
export class CarruselService {
  constructor(
    private readonly imagenes: CarruselRepositorio,
    private readonly archivos: CarruselArchivos,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Réplica de CarruselService::obtenerActivas (apipos): imágenes vigentes hoy,
   * activas, en base64. Las filas cuyo archivo no existe se omiten.
   *
   * ⚠ "Hoy" es la fecha UTC, porque apipos corre con app.timezone = 'UTC' y
   * `whereDate(..., now())` usa esa fecha. En Colombia (UTC-5), desde las
   * 7:00 p. m. hora local apipos ya considera que es el día siguiente: oculta
   * las imágenes que terminan hoy y muestra las que empiezan mañana. Se
   * mantiene igual al original; pendiente de decidir con el equipo si se
   * corrige con la fecha local (formatearFecha de @erp/shared).
   */
  async activas(): Promise<CarruselLegado> {
    const hoyUtc = this.reloj.ahora().toISOString().slice(0, 10);
    const vigentes = await this.imagenes.vigentes(hoyUtc);

    const imagenes: CarruselLegado['imagenes'] = [];
    for (const imagen of vigentes) {
      const contenido = await this.archivos.leer(imagen.archivo);
      if (contenido === null) continue;
      imagenes.push({
        rowid: imagen.id,
        label: imagen.label,
        date_start: imagen.desde,
        date_end: imagen.hasta,
        imagen_base64: `data:${tipoMime(imagen.archivo)};base64,${contenido.toString('base64')}`,
      });
    }
    return { total: imagenes.length, imagenes };
  }
}

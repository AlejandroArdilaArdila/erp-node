import { readFile, stat } from 'node:fs/promises';
import { posix } from 'node:path';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '@erp/shared';

/** Carpeta de las imágenes, relativa a la raíz del sitio de Dolibarr (como en apipos). */
const CARPETA_RELATIVA = 'htdocs/custom/integrospos/frontend/img/carrouselPriceChecker';

/**
 * Lectura de las imágenes del carrusel en el disco de Dolibarr. Solo lee: las
 * sube y borra el panel de Dolibarr (custom/integrospos/admin/carruselPos.php).
 */
@Injectable()
export class CarruselArchivos {
  constructor(private readonly config: AppConfig) {}

  /**
   * `dirname(rtrim(DOL_DOCUMENTS_ROOT, '/')) . '/' . CARPETA_RELATIVA`, como
   * carpetaImagenes() de apipos (dirname('') de PHP es '').
   */
  carpeta(): string {
    const documentos = this.config.dolibarrDocumentsRoot.replace(/\/+$/, '');
    const raiz = documentos === '' ? '' : posix.dirname(documentos);
    return `${raiz}/${CARPETA_RELATIVA}`;
  }

  /**
   * Contenido del archivo, o null si no existe o no es un archivo regular
   * (`is_file()` de PHP). El nombre se concatena tal cual, como en apipos.
   */
  async leer(archivo: string): Promise<Buffer | null> {
    const ruta = `${this.carpeta()}/${archivo}`;
    try {
      if (!(await stat(ruta)).isFile()) return null;
      return await readFile(ruta);
    } catch {
      return null;
    }
  }
}

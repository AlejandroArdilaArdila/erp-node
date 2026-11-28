import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as schema from '@erp/database';
import type { LegacyDb } from '@erp/database';
import type { AppConfig, Reloj } from '@erp/shared';
import { drizzle } from 'drizzle-orm/mysql2';
import { CarruselArchivos } from './carrusel.archivos.js';
import { CarruselRepositorio, type ImagenCarrusel } from './carrusel.repositorio.js';
import { CarruselService } from './carrusel.service.js';

const configCon = (root: string) => ({ dolibarrDocumentsRoot: root }) as unknown as AppConfig;

describe('CarruselArchivos', () => {
  it.each([
    ['/var/www/cliente/erp/documents/', '/var/www/cliente/erp/htdocs'],
    ['/var/www/cliente/erp/documents', '/var/www/cliente/erp/htdocs'],
    ['', '/htdocs'],
  ])('carpeta con DOL_DOCUMENTS_ROOT %j (dirname como PHP)', (root, prefijo) => {
    expect(new CarruselArchivos(configCon(root)).carpeta()).toBe(
      `${prefijo}/custom/integrospos/frontend/img/carrouselPriceChecker`,
    );
  });

  describe('leer', () => {
    let raiz: string;
    let archivos: CarruselArchivos;

    beforeAll(async () => {
      raiz = await mkdtemp(join(tmpdir(), 'carrusel-'));
      const carpeta = join(raiz, 'htdocs/custom/integrospos/frontend/img/carrouselPriceChecker');
      await mkdir(join(carpeta, 'subcarpeta'), { recursive: true });
      await writeFile(join(carpeta, 'promo.png'), Buffer.from([1, 2, 3]));
      archivos = new CarruselArchivos(configCon(join(raiz, 'documents/')));
    });

    afterAll(async () => {
      await rm(raiz, { recursive: true, force: true });
    });

    it('archivo existente → su contenido', async () => {
      await expect(archivos.leer('promo.png')).resolves.toEqual(Buffer.from([1, 2, 3]));
    });

    it('archivo inexistente o carpeta → null (is_file de PHP)', async () => {
      await expect(archivos.leer('no-existe.png')).resolves.toBeNull();
      await expect(archivos.leer('subcarpeta')).resolves.toBeNull();
    });
  });
});

describe('CarruselRepositorio.vigentes', () => {
  it('DATE() entre las fechas, activas, rowid descendente', async () => {
    const consultas: Array<{ sql: string; params: unknown }> = [];
    const responder = async (q: { sql: string }, params: unknown) => {
      consultas.push({ sql: q.sql, params });
      return [[[4, 'promo.png', 'Promo', '2026-11-01', '2026-11-30']], []];
    };
    const db = drizzle({
      client: { query: responder, execute: responder } as never,
      schema,
      mode: 'default',
    }) as unknown as LegacyDb;

    await expect(new CarruselRepositorio(db).vigentes('2026-11-28')).resolves.toEqual([
      { id: 4, archivo: 'promo.png', label: 'Promo', desde: '2026-11-01', hasta: '2026-11-30' },
    ]);

    const { sql, params } = consultas[0];
    expect(sql).toContain(
      'where (date(`llx_pos_img_cp`.`date_start`) <= ? and date(`llx_pos_img_cp`.`date_end`) >= ? and `llx_pos_img_cp`.`active` = ?)',
    );
    expect(sql).toContain('order by `llx_pos_img_cp`.`rowid` desc');
    expect(params).toEqual(['2026-11-28', '2026-11-28', 1]);
  });
});

describe('CarruselService.activas (réplica de obtenerActivas)', () => {
  const IMAGENES: ImagenCarrusel[] = [
    { id: 5, archivo: 'a.webp', label: 'A', desde: '2026-11-01', hasta: '2026-11-30' },
    { id: 4, archivo: 'falta.png', label: null, desde: '2026-11-01', hasta: '2026-11-30' },
    { id: 3, archivo: 'b.PNG', label: null, desde: '2026-11-01', hasta: '2026-11-30' },
    { id: 2, archivo: 'c.png', label: 'C', desde: '2026-11-01', hasta: '2026-11-30' },
  ];

  function crear(ahora: Date) {
    const repo = { vigentes: vi.fn().mockResolvedValue(IMAGENES) };
    const archivos = {
      leer: vi.fn(async (archivo: string) =>
        archivo === 'falta.png' ? null : Buffer.from(archivo),
      ),
    };
    const reloj: Reloj = { ahora: () => ahora };
    const servicio = new CarruselService(
      repo as unknown as CarruselRepositorio,
      archivos as unknown as CarruselArchivos,
      reloj,
    );
    return { servicio, repo };
  }

  it('omite los archivos que faltan; MIME por extensión sensible a mayúsculas', async () => {
    const { servicio } = crear(new Date('2026-11-28T15:00:00Z'));
    const respuesta = await servicio.activas();

    expect(respuesta.total).toBe(3);
    expect(respuesta.imagenes.map((i) => [i.rowid, i.imagen_base64])).toEqual([
      [5, `data:image/webp;base64,${Buffer.from('a.webp').toString('base64')}`],
      [3, `data:image/jpeg;base64,${Buffer.from('b.PNG').toString('base64')}`],
      [2, `data:image/png;base64,${Buffer.from('c.png').toString('base64')}`],
    ]);
    expect(respuesta.imagenes[0]).toMatchObject({
      label: 'A',
      date_start: '2026-11-01',
      date_end: '2026-11-30',
    });
  });

  it('"hoy" es la fecha UTC, como apipos (8 p. m. en Bogotá ya es el día siguiente)', async () => {
    // 2026-11-28 20:00 en Bogotá = 2026-11-29 01:00 UTC
    const { servicio, repo } = crear(new Date('2026-11-29T01:00:00Z'));
    await servicio.activas();
    expect(repo.vigentes).toHaveBeenCalledWith('2026-11-29');
  });
});

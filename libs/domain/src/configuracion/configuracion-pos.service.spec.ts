import { HttpException } from '@nestjs/common';
import type { AppConfig } from '@erp/shared';
import type { CiudadesRepositorio } from './ciudades.repositorio.js';
import { ConfiguracionPosService } from './configuracion-pos.service.js';
import type { ConstantesService } from './constantes.service.js';

interface OpcionesPrueba {
  constantes?: Record<string, string>;
  urlBase?: string;
}

function crear({ constantes = {}, urlBase = 'https://apipos.cliente.com' }: OpcionesPrueba = {}) {
  const ciudades = {
    departamentosActivos: vi.fn().mockResolvedValue([
      { codigo: '05', nombre: 'Antioquia' },
      { codigo: null, nombre: 'Sin código' },
    ]),
    ciudadesActivas: vi.fn().mockResolvedValue([
      {
        id: 80,
        codigoDepartamento: '05',
        codigo: '05001',
        nombre: 'Medellin',
        codigoPostal: '050013',
      },
      { id: 81, codigoDepartamento: null, codigo: null, nombre: 'Otra', codigoPostal: '' },
    ]),
  };
  const servicioConstantes = {
    valores: vi.fn().mockResolvedValue(new Map(Object.entries(constantes))),
  };
  const config = { urlBaseActualizacionPos: urlBase };
  const servicio = new ConfiguracionPosService(
    ciudades as unknown as CiudadesRepositorio,
    servicioConstantes as unknown as ConstantesService,
    config as unknown as AppConfig,
  );
  return { servicio, servicioConstantes };
}

describe('ConfiguracionPosService.departamentosYCiudades', () => {
  it('todos los campos como texto; NULL → ""', async () => {
    const { servicio } = crear();
    await expect(servicio.departamentosYCiudades()).resolves.toEqual({
      departamentos: [
        { code_depto: '05', depto: 'Antioquia' },
        { code_depto: '', depto: 'Sin código' },
      ],
      ciudades: [
        { rowid: '80', code_depto: '05', code: '05001', ciudad: 'Medellin', zip: '050013' },
        { rowid: '81', code_depto: '', code: '', ciudad: 'Otra', zip: '' },
      ],
    });
  });
});

describe('ConfiguracionPosService.verificarActualizacion', () => {
  const PUBLICADA = {
    POS_UPDATE_VERSION: '4.4.51',
    POS_UPDATE_BUILD: '404051',
    POS_UPDATE_CHANGELOG: '- Tirillas dinámicas',
    POS_UPDATE_FORZAR: '1',
  };

  it('versión publicada → datos y URLs de descarga', async () => {
    const { servicio, servicioConstantes } = crear({ constantes: PUBLICADA });
    await expect(servicio.verificarActualizacion()).resolves.toEqual({
      version: '4.4.51',
      build: 404051,
      changelog: '- Tirillas dinámicas',
      forzar: true,
      windows_url: 'https://apipos.cliente.com/pos.exe',
      linux_url: 'https://apipos.cliente.com/pos.deb',
    });
    expect(servicioConstantes.valores).toHaveBeenCalledWith([
      'POS_UPDATE_VERSION',
      'POS_UPDATE_BUILD',
      'POS_UPDATE_CHANGELOG',
      'POS_UPDATE_FORZAR',
    ]);
  });

  it.each([
    ['sin versión', { POS_UPDATE_BUILD: '1' }],
    ['sin build', { POS_UPDATE_VERSION: '4.4.51' }],
    ['versión vacía', { POS_UPDATE_VERSION: '', POS_UPDATE_BUILD: '1' }],
    ['build "0" (empty() de PHP)', { POS_UPDATE_VERSION: '4.4.51', POS_UPDATE_BUILD: '0' }],
  ])('%s → 404 { message: "No hay una actualización configurada" }', async (_caso, constantes) => {
    const { servicio } = crear({ constantes });
    const error = await servicio.verificarActualizacion().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
    expect((error as HttpException).getResponse()).toEqual({
      message: 'No hay una actualización configurada',
    });
  });

  it.each([
    [undefined, false],
    ['', false],
    ['0', false],
    ['1', true],
    ['false', true],
  ])('POS_UPDATE_FORZAR %j → forzar %s ((bool) de PHP)', async (valor, esperado) => {
    const constantes: Record<string, string> = { ...PUBLICADA };
    if (valor === undefined) delete constantes.POS_UPDATE_FORZAR;
    else constantes.POS_UPDATE_FORZAR = valor;
    const { servicio } = crear({ constantes });
    await expect(servicio.verificarActualizacion()).resolves.toMatchObject({ forzar: esperado });
  });

  it('sin changelog → ""; build con sufijo → (int) de PHP', async () => {
    const { servicio } = crear({
      constantes: { POS_UPDATE_VERSION: '4.4.51', POS_UPDATE_BUILD: '404051-beta' },
    });
    await expect(servicio.verificarActualizacion()).resolves.toMatchObject({
      build: 404051,
      changelog: '',
      forzar: false,
    });
  });

  it('quita las barras finales de la URL base (rtrim de PHP)', async () => {
    const { servicio } = crear({ constantes: PUBLICADA, urlBase: 'https://apipos.cliente.com//' });
    await expect(servicio.verificarActualizacion()).resolves.toMatchObject({
      windows_url: 'https://apipos.cliente.com/pos.exe',
      linux_url: 'https://apipos.cliente.com/pos.deb',
    });
  });
});

import { HttpException } from '@nestjs/common';
import type { AppConfig } from '@erp/shared';
import type { CatalogosRepositorio, TarifaIva, UnidadMedida } from './catalogos.repositorio.js';
import type { CiudadesRepositorio } from './ciudades.repositorio.js';
import { ConfiguracionPosService } from './configuracion-pos.service.js';
import type { ConstantesService } from './constantes.service.js';

interface OpcionesPrueba {
  constantes?: Record<string, string>;
  urlBase?: string;
  paramCategoria?: string | null;
  tarifas?: TarifaIva[];
  unidades?: Record<string, UnidadMedida[]>;
}

function crear({
  constantes = {},
  urlBase = 'https://apipos.cliente.com',
  paramCategoria = null,
  tarifas = [],
  unidades = {},
}: OpcionesPrueba = {}) {
  const catalogos = {
    parametrosExtrafield: vi.fn().mockResolvedValue(paramCategoria),
    tarifasIvaActivas: vi.fn().mockResolvedValue(tarifas),
    unidadesPorTipo: vi.fn(async (tipo: string) => unidades[tipo] ?? []),
  };
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
    catalogos as unknown as CatalogosRepositorio,
    ciudades as unknown as CiudadesRepositorio,
    servicioConstantes as unknown as ConstantesService,
    config as unknown as AppConfig,
  );
  return { servicio, servicioConstantes, catalogos };
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

describe('ConfiguracionPosService.catalogosProducto (réplica de getCategorieIva)', () => {
  it('arma los cuatro catálogos', async () => {
    const { servicio, catalogos } = crear({
      // serialize() de PHP 8.3 de ['options' => [1 => 'Abarrotes', 'A' => 'Lácteos ñ']]
      paramCategoria: 'a:1:{s:7:"options";a:2:{i:1;s:9:"Abarrotes";s:1:"A";s:11:"Lácteos ñ";}}',
      tarifas: [
        { codigo: 'Excento', tarifa: 0, impuestoLocal1: '0', tipoImpuestoLocal1: '0' },
        { codigo: '19', tarifa: 19, impuestoLocal1: '0', tipoImpuestoLocal1: '0' },
        { codigo: '2.5', tarifa: 2.5, impuestoLocal1: '0', tipoImpuestoLocal1: '0' },
        { codigo: 'IC8', tarifa: 0, impuestoLocal1: '8', tipoImpuestoLocal1: '1' },
      ],
      unidades: {
        weight: [
          { escala: 0, abreviatura: 'kg' },
          { escala: -3, abreviatura: 'g' },
        ],
        volume: [
          { escala: 98, abreviatura: 'L' },
          { escala: null, abreviatura: null },
        ],
      },
    });

    await expect(servicio.catalogosProducto()).resolves.toEqual({
      ivas: [
        { valor: '0', label: 'Excento' },
        { valor: '19', label: '19' },
        { valor: '2.5', label: '2.5' },
        { valor: '8', label: 'IC8' },
      ],
      categorias: [
        { valor: '1', label: 'Abarrotes' },
        { valor: 'A', label: 'Lácteos ñ' },
      ],
      peso: [
        { valor: '0', label: 'kg' },
        { valor: '-3', label: 'g' },
      ],
      volumen: [
        { valor: '98', label: 'L' },
        { valor: '', label: null },
      ],
    });
    expect(catalogos.parametrosExtrafield).toHaveBeenCalledWith('categoria');
    expect(catalogos.tarifasIvaActivas).toHaveBeenCalledWith(70);
  });

  it.each([
    ['sin extrafield', null],
    ['param vacío', ''],
    ['param "0" (falso en PHP)', '0'],
    ['param que no es serializado', 'basura'],
    ['sin options', 'a:1:{s:4:"otra";b:1;}'],
    ['options no es array', 'a:1:{s:7:"options";s:3:"abc";}'],
  ])('%s → categorias []', async (_caso, paramCategoria) => {
    const { servicio } = crear({ paramCategoria });
    await expect(servicio.catalogosProducto()).resolves.toMatchObject({ categorias: [] });
  });
});

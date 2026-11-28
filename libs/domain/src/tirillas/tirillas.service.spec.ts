import { HttpException } from '@nestjs/common';
import { phpJsonEncode } from '@erp/shared';
import type {
  PlantillaTirilla,
  SeccionTirilla,
  TirillasRepositorio,
  VariableTirilla,
} from './tirillas.repositorio.js';
import { TirillasService } from './tirillas.service.js';

/**
 * Filas de ejemplo y respuestas esperadas generadas con PHP 8.3 ejecutando la
 * lógica de TicketTemplateService (apipos) sobre las mismas filas, con
 * json_encode(..., JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).
 */
const PLANTILLAS: PlantillaTirilla[] = [
  {
    id: 1,
    nombre: 'factura_pos',
    label: 'Factura POS',
    configJson: '{"ancho":80,"fuente":{"tam":1.5,"neg":true},"9":"a","10":"b","margen":0.00001}',
    activo: 1,
    datoPreviewJson: '{"total": 1000, "cliente": "Ana"}',
    columnas: 0,
    variablesJson: '["total", "cliente"]',
  },
  {
    id: 2,
    nombre: 'cierre',
    label: 'Cierre',
    configJson: null,
    activo: null,
    datoPreviewJson: null,
    columnas: 42,
    variablesJson: null,
  },
  {
    id: 3,
    nombre: 'rara',
    label: 'Rara',
    configJson: 'basura',
    activo: 0,
    datoPreviewJson: '0',
    columnas: 58,
    variablesJson: '{}',
  },
];

const ESPERADO_PLANTILLA: Record<number, string> = {
  1: '{"rowid":1,"nombre":"factura_pos","label":"Factura POS","config":{"ancho":80,"fuente":{"tam":1.5,"neg":true},"9":"a","10":"b","margen":1.0e-5},"activo":1}',
  2: '{"rowid":2,"nombre":"cierre","label":"Cierre","config":[],"activo":0}',
  3: '{"rowid":3,"nombre":"rara","label":"Rara","config":[],"activo":0}',
};

const ESPERADO_CONFIGURACION: Record<number, string> = {
  1: '{"rowid":1,"nombre":"factura_pos","label":"Factura POS","config":{"ancho":80,"fuente":{"tam":1.5,"neg":true},"9":"a","10":"b","margen":1.0e-5},"dato_preview":{"total":1000,"cliente":"Ana"},"columnas":80,"variables":["total","cliente"]}',
  2: '{"rowid":2,"nombre":"cierre","label":"Cierre","config":[],"dato_preview":{},"columnas":42,"variables":[]}',
  3: '{"rowid":3,"nombre":"rara","label":"Rara","config":[],"dato_preview":{},"columnas":58,"variables":[]}',
};

const SECCIONES: SeccionTirilla[] = [
  {
    id: 1,
    nombre: 'enc',
    descripcion: 'Encabezado',
    elementosJson: '{"items": [{"tipo": "texto"}], "repeat": "lineas"}',
  },
  {
    id: 2,
    nombre: 'viejo',
    descripcion: '',
    elementosJson: '[{"tipo": "linea"}, {"tipo": "qr", "tam": 3.0}]',
  },
  {
    id: 3,
    nombre: 'nulo',
    descripcion: 'x',
    elementosJson: '{"items": null, "condicional": {"campo": "a"}}',
  },
  { id: 4, nombre: 'escalar', descripcion: 'x', elementosJson: '"texto"' },
  {
    id: 5,
    nombre: 'completo',
    descripcion: 'x',
    elementosJson: '{"condicional": {"campo": "total", "op": ">"}, "items": [], "repeat": null}',
  },
];

const ESPERADO_SECCIONES =
  '{"secciones":[{"rowid":1,"nombre":"enc","descripcion":"Encabezado","elementos":[{"tipo":"texto"}],"condicional":null,"repeat":"lineas"},{"rowid":2,"nombre":"viejo","descripcion":"","elementos":[{"tipo":"linea"},{"tipo":"qr","tam":3}],"condicional":null,"repeat":null},{"rowid":3,"nombre":"nulo","descripcion":"x","elementos":{"items":null,"condicional":{"campo":"a"}},"condicional":null,"repeat":null},{"rowid":4,"nombre":"escalar","descripcion":"x","elementos":"texto","condicional":null,"repeat":null},{"rowid":5,"nombre":"completo","descripcion":"x","elementos":[],"condicional":{"campo":"total","op":">"},"repeat":null}]}';

function crear({ variables = [] as VariableTirilla[] } = {}) {
  const repo = {
    plantillas: vi.fn().mockResolvedValue(PLANTILLAS),
    plantillaPorId: vi.fn(async (id: number) => PLANTILLAS.find((p) => p.id === id) ?? null),
    plantillaPorNombre: vi.fn(
      async (nombre: string) => PLANTILLAS.find((p) => p.nombre === nombre) ?? null,
    ),
    secciones: vi.fn().mockResolvedValue(SECCIONES),
    variables: vi.fn().mockResolvedValue(variables),
  };
  return { servicio: new TirillasService(repo as unknown as TirillasRepositorio), repo };
}

async function error401(promesa: Promise<unknown>, mensaje: string): Promise<void> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(401);
  expect((error as HttpException).getResponse()).toEqual({ message: mensaje });
}

describe('TirillasService.plantillaPorIdONombre', () => {
  it.each(['0', 'null', 'NULL', 'Null'])('%s → todas las plantillas', async (id) => {
    const { servicio } = crear();
    const respuesta = await servicio.plantillaPorIdONombre(id);
    expect(phpJsonEncode(respuesta)).toBe(
      `[${[1, 2, 3].map((i) => ESPERADO_PLANTILLA[i]).join(',')}]`,
    );
  });

  it.each([1, 2, 3])('por rowid %s → igual que PHP', async (id) => {
    const { servicio, repo } = crear();
    const respuesta = await servicio.plantillaPorIdONombre(String(id));
    expect(phpJsonEncode(respuesta)).toBe(ESPERADO_PLANTILLA[id]);
    expect(repo.plantillaPorId).toHaveBeenCalledWith(id);
  });

  it('por nombre, recortado (trim de PHP)', async () => {
    const { servicio, repo } = crear();
    const respuesta = await servicio.plantillaPorIdONombre(' factura_pos ');
    expect(phpJsonEncode(respuesta)).toBe(ESPERADO_PLANTILLA[1]);
    expect(repo.plantillaPorNombre).toHaveBeenCalledWith('factura_pos');
    expect(repo.plantillaPorId).not.toHaveBeenCalled();
  });

  it('"12a" no es solo dígitos → busca por nombre', async () => {
    const { servicio, repo } = crear();
    await error401(servicio.plantillaPorIdONombre('12a'), 'Plantilla no encontrada');
    expect(repo.plantillaPorNombre).toHaveBeenCalledWith('12a');
  });

  it('inexistente → 401 { message: "Plantilla no encontrada" }', async () => {
    const { servicio } = crear();
    await error401(servicio.plantillaPorIdONombre('99'), 'Plantilla no encontrada');
  });
});

describe('TirillasService.configuracion', () => {
  it.each([1, 2, 3])('plantilla %s → igual que PHP', async (id) => {
    const { servicio } = crear();
    const nombre = PLANTILLAS.find((p) => p.id === id)?.nombre;
    expect(phpJsonEncode(await servicio.configuracion({ nombre }))).toBe(
      ESPERADO_CONFIGURACION[id],
    );
  });

  it.each([{}, { nombre: '' }, { nombre: '   ' }, { nombre: null }])(
    'sin nombre %j → 401 { message: "nombre requerido" }',
    async (entrada) => {
      const { servicio, repo } = crear();
      await error401(servicio.configuracion(entrada), 'nombre requerido');
      expect(repo.plantillaPorNombre).not.toHaveBeenCalled();
    },
  );

  it('nombre inexistente → 401 { message: "Tipo no encontrado" }', async () => {
    const { servicio } = crear();
    await error401(servicio.configuracion({ nombre: 'otra' }), 'Tipo no encontrado');
  });
});

describe('TirillasService.tipos, variables y secciones', () => {
  it('tipos sin config', async () => {
    const { servicio } = crear();
    expect(phpJsonEncode(await servicio.tipos())).toBe(
      '{"tipos":[{"rowid":1,"nombre":"factura_pos","label":"Factura POS","activo":1},{"rowid":2,"nombre":"cierre","label":"Cierre","activo":0},{"rowid":3,"nombre":"rara","label":"Rara","activo":0}]}',
    );
  });

  it('variables: tipo vacío o "0" → "string" (?: de PHP)', async () => {
    const { servicio } = crear({
      variables: [
        { id: 1, nombre: 'total', descripcion: 'Total', tipo: 'numero' },
        { id: 2, nombre: 'cliente', descripcion: '', tipo: '' },
        { id: 3, nombre: 'raro', descripcion: '', tipo: '0' },
      ],
    });
    await expect(servicio.variables()).resolves.toEqual({
      variables: [
        { rowid: 1, nombre: 'total', descripcion: 'Total', tipo: 'numero' },
        { rowid: 2, nombre: 'cliente', descripcion: '', tipo: 'string' },
        { rowid: 3, nombre: 'raro', descripcion: '', tipo: 'string' },
      ],
    });
  });

  it('secciones en formato nuevo y viejo → igual que PHP', async () => {
    const { servicio } = crear();
    expect(phpJsonEncode(await servicio.secciones())).toBe(ESPERADO_SECCIONES);
  });
});

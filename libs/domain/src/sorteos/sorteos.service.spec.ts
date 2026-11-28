import { phpJsonEncode } from '@erp/shared';
import type { Sorteo, SorteosRepositorio } from './sorteos.repositorio.js';
import { SorteosService, soloFecha } from './sorteos.service.js';

/**
 * Vectores de PHP 8.3 con soloFecha() de apipos copiada tal cual, y
 * date('d/m/Y', strtotime(...)) sobre el resultado.
 */
const VECTORES_FECHA: Array<[string, string, string | null]> = [
  ['2026-11-28', '2026-11-28', '28/11/2026'],
  ['0000-00-00', '', null],
  ['2026-02-30', '', null],
  ['2024-02-29', '2024-02-29', '29/02/2024'],
  ['2023-02-29', '', null],
  ['2026-12-31 10:00:00', '2026-12-31', '31/12/2026'],
  [' 2026-01-05 ', '2026-01-05', '05/01/2026'],
  ['28/11/2026', '2026-11-28', '28/11/2026'],
  ['31/04/2026', '', null],
  ['0001-01-01', '0001-01-01', '01/01/0001'],
  ['2026-13-01', '', null],
  ['', '', null],
];

describe('soloFecha (réplica de SorteosService::soloFecha)', () => {
  it.each(VECTORES_FECHA)('%j → %j', (entrada, esperado) => {
    expect(soloFecha(entrada)).toBe(esperado);
  });
});

const BASE: Sorteo = {
  id: 4,
  descripcion: 'Sorteo navideño',
  premio: 'Televisor',
  fechaInicio: '2026-11-01',
  fechaFinal: '2026-12-24',
  compraMinimo: 50000,
  valorParticipacion: 50000,
  tipoCliente: 'todos',
  tipoCalculo: 'proporcional',
  observacion: 'Válido en todas las sedes',
  permitirEntregarSinCtrl: 0,
  clientesJson: '[10,20]',
  productosJson: null,
};

function crear(vigentes: Sorteo[], proximos: Sorteo[] = []) {
  const repo = {
    vigentes: vi.fn().mockResolvedValue(vigentes),
    proximos: vi.fn().mockResolvedValue(proximos),
  };
  return new SorteosService(repo as unknown as SorteosRepositorio);
}

describe('SorteosService.vigentesYProximos (réplica de listarVigentesYProximos)', () => {
  it('arma vigentes y próximos con los campos de apipos', async () => {
    const servicio = crear([BASE], [{ ...BASE, id: 5, fechaInicio: '2027-01-10' }]);
    const respuesta = await servicio.vigentesYProximos();

    expect(respuesta.vigentes).toEqual([
      {
        rowid: 4,
        descripcion: 'Sorteo navideño',
        premio: 'Televisor',
        fecha_inicio: '01/11/2026',
        fecha_final: '24/12/2026',
        fecha_inicio_raw: '2026-11-01',
        fecha_final_raw: '2026-12-24',
        compra_minimo: 50000,
        valor_participacion: 50000,
        tipo_cliente: 'todos',
        tipo_calculo: 'proporcional',
        observacion: 'Válido en todas las sedes',
        permitir_entregar_sin_ctrl: 0,
        fk_clientes: new Map([
          [0, 10],
          [1, 20],
        ]),
        fk_productos: [],
      },
    ]);
    expect(respuesta.proximos).toMatchObject([{ rowid: 5, fecha_inicio: '10/01/2027' }]);
  });

  it('fecha inválida → fecha y fecha_raw en null', async () => {
    const servicio = crear([{ ...BASE, fechaInicio: '0000-00-00' }]);
    const { vigentes } = await servicio.vigentesYProximos();
    expect(vigentes[0]).toMatchObject({ fecha_inicio: null, fecha_inicio_raw: null });
  });

  it.each([
    [null, '[]'],
    ['', '[]'],
    ['basura', '[]'],
    ['{}', '[]'],
    ['{"0":5,"1":6}', '[5,6]'],
    ['{"a":1}', '{"a":1}'],
    ['{"1":5,"0":6}', '{"1":5,"0":6}'],
  ])('fk_clientes %j → %s (json_decode ?: [], como PHP 8.3)', async (json, esperado) => {
    const servicio = crear([{ ...BASE, clientesJson: json }]);
    const { vigentes } = await servicio.vigentesYProximos();
    expect(phpJsonEncode(vigentes[0].fk_clientes)).toBe(esperado);
  });
});

import type {
  CodigoOperativo,
  CodigosOperativosRepositorio,
} from './codigos-operativos.repositorio.js';
import { CodigosOperativosService } from './codigos-operativos.service.js';

const BASE: CodigoOperativo = {
  id: 3,
  codigo: 'DESC10',
  idProducto: 50,
  descuento: 1,
  refProducto: 'SRV-DESC',
  nombreProducto: 'Descuento 10%',
  tipoProducto: 1,
  fechaCreacion: '2026-08-01 09:15:00',
};

function crear(codigos: CodigoOperativo[]) {
  const repo = { activos: vi.fn().mockResolvedValue(codigos) };
  return {
    servicio: new CodigosOperativosService(repo as unknown as CodigosOperativosRepositorio),
    repo,
  };
}

describe('CodigosOperativosService.activos (réplica de CodigoOperativoService::listar)', () => {
  it('consulta la entidad 1 y usa los nombres de campo de apipos', async () => {
    const { servicio, repo } = crear([BASE]);
    await expect(servicio.activos()).resolves.toEqual([
      {
        rowid: 3,
        codigo: 'DESC10',
        fk_product: 50,
        descuento: 1,
        ref: 'SRV-DESC',
        label: 'Descuento 10%',
        tipo: 'Servicio',
        date_creation: '2026-08-01 09:15:00',
      },
    ]);
    expect(repo.activos).toHaveBeenCalledWith(1);
  });

  it.each([
    [0, 'Producto'],
    [9, 'Producto'],
    [null, 'Producto'],
    [1, 'Servicio'],
  ])('fk_product_type %s → tipo %s', async (tipoProducto, tipo) => {
    const { servicio } = crear([{ ...BASE, tipoProducto }]);
    await expect(servicio.activos()).resolves.toMatchObject([{ tipo }]);
  });

  it('producto inexistente → ref y label null, tipo Producto; descuento null se conserva', async () => {
    const { servicio } = crear([
      { ...BASE, refProducto: null, nombreProducto: null, tipoProducto: null, descuento: null },
    ]);
    await expect(servicio.activos()).resolves.toMatchObject([
      { ref: null, label: null, tipo: 'Producto', descuento: null },
    ]);
  });
});

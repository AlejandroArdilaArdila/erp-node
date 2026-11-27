import { CajaService } from './caja.service.js';
import type { AperturaCaja, TerminalesRepositorio } from './terminales.repositorio.js';

function crear(apertura: AperturaCaja | null, ahora = new Date(2026, 10, 27, 15, 0, 0)) {
  const repo = { aperturaRelevante: vi.fn().mockResolvedValue(apertura) };
  const reloj = { ahora: () => ahora };
  return { servicio: new CajaService(repo as unknown as TerminalesRepositorio, reloj), repo };
}

describe('CajaService.estadoCaja', () => {
  it('sin apertura → debe abrir caja', async () => {
    const { servicio, repo } = crear(null);
    await expect(servicio.estadoCaja(7)).resolves.toEqual({
      apertura: true,
      cierre: false,
      continuar: true,
    });
    expect(repo.aperturaRelevante).toHaveBeenCalledWith(7, '2026-11-27');
  });

  it('abierta hoy → continúa', async () => {
    const { servicio } = crear({ estado: 1, fechaApertura: '2026-11-27 06:00:00' });
    await expect(servicio.estadoCaja(7)).resolves.toEqual({
      apertura: false,
      cierre: false,
      continuar: true,
    });
  });

  it('abierta ayer → debe cerrar (aunque hayan pasado menos de 24 h)', async () => {
    const { servicio } = crear(
      { estado: 1, fechaApertura: '2026-11-26 23:30:00' },
      new Date(2026, 10, 27, 0, 10, 0),
    );
    await expect(servicio.estadoCaja(7)).resolves.toEqual({
      apertura: false,
      cierre: true,
      continuar: false,
    });
  });

  it('cerrada hoy → no continúa', async () => {
    const { servicio } = crear({ estado: 2, fechaApertura: '2026-11-27 06:00:00' });
    await expect(servicio.estadoCaja(7)).resolves.toEqual({
      apertura: false,
      cierre: false,
      continuar: false,
    });
  });

  it('conciliada (estado 3) hoy → continúa, igual que apipos', async () => {
    const { servicio } = crear({ estado: 3, fechaApertura: '2026-11-27 06:00:00' });
    await expect(servicio.estadoCaja(7)).resolves.toMatchObject({ continuar: true });
  });
});

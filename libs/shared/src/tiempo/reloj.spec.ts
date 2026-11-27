import {
  formatearFecha,
  formatearFechaHora,
  inicioDelDia,
  leerFechaHora,
  sumarDias,
} from './reloj.js';

describe('fechas locales', () => {
  const fecha = new Date(2026, 10, 27, 9, 5, 7); // 27-nov-2026 09:05:07 local

  it('formatea como MySQL/Dolibarr', () => {
    expect(formatearFechaHora(fecha)).toBe('2026-11-27 09:05:07');
    expect(formatearFecha(fecha)).toBe('2026-11-27');
  });

  it('calcula inicio del día y suma días cruzando mes y año', () => {
    expect(formatearFechaHora(inicioDelDia(fecha))).toBe('2026-11-27 00:00:00');
    expect(formatearFecha(sumarDias(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('lee lo que entrega MySQL', () => {
    expect(formatearFechaHora(leerFechaHora('2026-11-27 23:59:58'))).toBe('2026-11-27 23:59:58');
    expect(formatearFechaHora(leerFechaHora('2026-11-27'))).toBe('2026-11-27 00:00:00');
  });
});

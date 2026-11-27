import { Injectable } from '@nestjs/common';

/**
 * Fuente única de "ahora". Inyectar `Reloj` en vez de usar `new Date()`
 * permite probar reglas que dependen de la fecha (vencimientos, estado de
 * caja) con fechas fijas.
 */
@Injectable()
export class Reloj {
  ahora(): Date {
    return new Date();
  }
}

const dos = (n: number) => String(n).padStart(2, '0');

/**
 * 'YYYY-MM-DD HH:mm:ss' en hora LOCAL (TZ del proceso = America/Bogota).
 * Es el formato y la zona horaria con los que Dolibarr y MySQL guardan
 * fechas (ver docs/adr/0003). Nunca guardar fechas en UTC en la base legado.
 */
export function formatearFechaHora(fecha: Date): string {
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ` +
    `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`
  );
}

/** 'YYYY-MM-DD' en hora local. */
export function formatearFecha(fecha: Date): string {
  return formatearFechaHora(fecha).slice(0, 10);
}

/** 00:00:00 local del mismo día. */
export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Suma días de calendario (respeta la hora local). */
export function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/** Interpreta 'YYYY-MM-DD HH:mm:ss' (hora local, como lo entrega MySQL). */
export function leerFechaHora(texto: string): Date {
  const [fecha, hora = '00:00:00'] = texto.split(' ');
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, mi, s] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, mi, s);
}

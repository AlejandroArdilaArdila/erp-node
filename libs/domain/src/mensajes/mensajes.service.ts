import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DirectorioUsuariosService, type NombreUsuario } from '@erp/domain/auth';
import { phpEntero, phpString, phpTrim } from '@erp/shared';
import { MensajesRepositorio } from './mensajes.repositorio.js';

/** Elemento de POST /api.php/integrosone/mensajes (contrato apipos). */
export interface MensajeLegado {
  rowid: number;
  fk_user_from: number;
  fk_user_to: number;
  mensaje: string;
  tipo: string;
  fecha: string;
  leido: boolean;
  nombre_from: string;
  nombre_to: string;
}

/** `trim(($u?->firstname ?? '') . ' ' . ($u?->lastname ?? ''))` de apipos. */
function nombreCompleto(usuario: NombreUsuario | undefined): string {
  return phpTrim(`${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`);
}

@Injectable()
export class MensajesService {
  constructor(
    private readonly mensajes: MensajesRepositorio,
    private readonly directorio: DirectorioUsuariosService,
  ) {}

  /**
   * Réplica de MensajeService::getMensajes (apipos).
   *
   * `entrada` es `$request->all()`: query string + cuerpo, donde gana el cuerpo.
   * - `user` se convierte como `(int)` de PHP. Si es <= 0 →
   *   401 { "message": "El campo 'user' es obligatorio." } (sí, 401 y no 422,
   *   igual que el original).
   * - `fecha` es opcional ('YYYY-MM-DD'). Vacía o ausente = todos los mensajes.
   *
   * ⚠ Igual que en apipos, no se verifica que `user` sea el dueño de la
   * DOLAPIKEY: cualquier usuario autenticado puede leer el chat de otro.
   * Pendiente de revisar con el equipo.
   */
  async listar(entrada: Record<string, unknown>): Promise<MensajeLegado[]> {
    const idUsuario = phpEntero(entrada.user ?? 0);
    const fecha = phpTrim(phpString(entrada.fecha ?? ''));

    if (idUsuario <= 0) {
      throw new HttpException(
        { message: "El campo 'user' es obligatorio." },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const mensajes = await this.mensajes.deUsuario(idUsuario, fecha === '' ? null : fecha);
    if (mensajes.length === 0) {
      return [];
    }

    const nombres = await this.directorio.nombresPorIds(
      mensajes.flatMap((m) => [m.idEmisor, m.idReceptor]),
    );

    return mensajes.map((m) => ({
      rowid: m.id,
      fk_user_from: m.idEmisor,
      fk_user_to: m.idReceptor,
      mensaje: m.mensaje,
      tipo: m.tipo,
      fecha: m.fecha,
      leido: m.leido,
      nombre_from: nombreCompleto(nombres.get(m.idEmisor)),
      nombre_to: nombreCompleto(nombres.get(m.idReceptor)),
    }));
  }
}

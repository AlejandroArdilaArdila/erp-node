import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BloqueosLegado } from './bloqueos.js';
import type { LegacyTx } from './legacy-db.js';

/** Transacción falsa: la primera consulta (GET_LOCK) devuelve `ok`; las demás, RELEASE_LOCK. */
function txFalsa(ok: unknown) {
  const execute = vi
    .fn()
    .mockResolvedValueOnce([[{ ok }], []])
    .mockResolvedValue([[{ r: '1' }], []]);
  return { tx: { execute } as unknown as LegacyTx, execute };
}

describe('BloqueosLegado', () => {
  const bloqueos = new BloqueosLegado();

  // Regresión: el pool usa bigNumberStrings y GET_LOCK (BIGINT) llega como '1'.
  // Antes se comparaba con 1 y el login respondía siempre 503 "Operación en curso".
  it.each([['1'], [1]])(
    'ejecuta el trabajo y libera el bloqueo cuando GET_LOCK devuelve %j',
    async (ok) => {
      const { tx, execute } = txFalsa(ok);
      await expect(bloqueos.conBloqueo(tx, 'login-pos:1', async () => 'hecho')).resolves.toBe(
        'hecho',
      );
      expect(execute).toHaveBeenCalledTimes(2);
    },
  );

  it.each([['0'], [0], [null]])(
    'responde 503 sin ejecutar el trabajo cuando GET_LOCK devuelve %j',
    async (ok) => {
      const { tx, execute } = txFalsa(ok);
      const trabajo = vi.fn();
      await expect(bloqueos.conBloqueo(tx, 'login-pos:1', trabajo)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(trabajo).not.toHaveBeenCalled();
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it('libera el bloqueo aunque el trabajo falle', async () => {
    const { tx, execute } = txFalsa('1');
    await expect(
      bloqueos.conBloqueo(tx, 'login-pos:1', async () => {
        throw new Error('falló');
      }),
    ).rejects.toThrow('falló');
    expect(execute).toHaveBeenCalledTimes(2);
  });
});

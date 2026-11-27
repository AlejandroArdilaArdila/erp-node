import { conReintentoPorBloqueo, motivoReintentable } from './transaccion.js';

function errorMysql(errno: number, code: string): Error {
  return Object.assign(new Error(code), { errno, code });
}

describe('motivoReintentable', () => {
  it('detecta deadlock y lock wait timeout, también envueltos por Drizzle', () => {
    expect(motivoReintentable(errorMysql(1213, 'ER_LOCK_DEADLOCK'))).toBe('deadlock');
    expect(motivoReintentable(errorMysql(1205, 'ER_LOCK_WAIT_TIMEOUT'))).toBe('lock wait timeout');
    const envuelto = new Error('Failed query', { cause: errorMysql(1213, 'ER_LOCK_DEADLOCK') });
    expect(motivoReintentable(envuelto)).toBe('deadlock');
  });

  it('no reintenta otros errores', () => {
    expect(motivoReintentable(errorMysql(1062, 'ER_DUP_ENTRY'))).toBeNull();
    expect(motivoReintentable(new Error('x'))).toBeNull();
    expect(motivoReintentable(undefined)).toBeNull();
  });
});

describe('conReintentoPorBloqueo', () => {
  it('reintenta un deadlock y luego tiene éxito', async () => {
    const trabajo = vi
      .fn()
      .mockRejectedValueOnce(errorMysql(1213, 'ER_LOCK_DEADLOCK'))
      .mockResolvedValueOnce('ok');
    const alReintentar = vi.fn();

    await expect(conReintentoPorBloqueo(trabajo, { esperaBaseMs: 1, alReintentar })).resolves.toBe(
      'ok',
    );
    expect(trabajo).toHaveBeenCalledTimes(2);
    expect(alReintentar).toHaveBeenCalledWith(
      expect.objectContaining({ intento: 1, motivo: 'deadlock' }),
    );
  });

  it('se rinde después del máximo de intentos', async () => {
    const error = errorMysql(1205, 'ER_LOCK_WAIT_TIMEOUT');
    const trabajo = vi.fn().mockRejectedValue(error);

    await expect(conReintentoPorBloqueo(trabajo, { intentos: 3, esperaBaseMs: 1 })).rejects.toBe(
      error,
    );
    expect(trabajo).toHaveBeenCalledTimes(3);
  });

  it('no reintenta errores que no son de bloqueo', async () => {
    const error = errorMysql(1062, 'ER_DUP_ENTRY');
    const trabajo = vi.fn().mockRejectedValue(error);

    await expect(conReintentoPorBloqueo(trabajo, { esperaBaseMs: 1 })).rejects.toBe(error);
    expect(trabajo).toHaveBeenCalledTimes(1);
  });
});

import { stdSerializers } from 'pino';
import { mensajeSeguro, serializarErrorSeguro } from './serializar-error.js';

const SECRETO = 'api-key-super-secreta';

/** Simula DrizzleQueryError: mensaje "Failed query: ...\nparams: ..." + propiedades. */
function errorDeConsulta(): Error {
  const causa = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), {
    code: 'ECONNREFUSED',
    sql: `select * from llx_user where api_key = '${SECRETO}'`,
  });
  return Object.assign(
    new Error(
      `Failed query: select 1 from llx_user where api_key in (?, ?)\nparams: 1,${SECRETO}`,
      {
        cause: causa,
      },
    ),
    {
      name: 'DrizzleQueryError',
      query: 'select 1 from llx_user where api_key in (?, ?)',
      params: [1, SECRETO],
    },
  );
}

describe('serializarErrorSeguro', () => {
  it('no deja ningún parámetro de la consulta en el resultado', () => {
    const resultado = JSON.stringify(serializarErrorSeguro(errorDeConsulta()));
    expect(resultado).not.toContain(SECRETO);
    expect(resultado).toContain('Failed query: select 1 from llx_user');
    expect(resultado).toContain('params: [oculto]');
  });

  it('conserva errores normales intactos', () => {
    const resultado = serializarErrorSeguro(new Error('Algo falló'));
    expect(resultado.message).toBe('Algo falló');
    expect(resultado.stack).toContain('Algo falló');
  });
});

describe('serializarErrorSeguro con el objeto ya serializado (como lo llama pino-http)', () => {
  // Regresión: pino-http aplica primero stdSerializers.err y pasa un objeto plano.
  // Antes se registraba "[object Object]" y se perdía el error.
  const comoPinoHttp = (e: Error) => serializarErrorSeguro(stdSerializers.err(e));

  it('conserva el mensaje y el stack', () => {
    const resultado = comoPinoHttp(new Error('failed with status code 503'));
    expect(resultado.message).toBe('failed with status code 503');
    expect(resultado.stack).toContain('failed with status code 503');
  });

  it('tampoco deja parámetros de la consulta, ni en la causa', () => {
    const plano = {
      ...(stdSerializers.err(errorDeConsulta()) as unknown as Record<string, unknown>),
      params: [1, SECRETO],
      cause: { message: 'x', sql: `select '${SECRETO}'` },
    };
    const resultado = JSON.stringify(serializarErrorSeguro(plano));
    expect(resultado).not.toContain(SECRETO);
    expect(resultado).toContain('params: [oculto]');
  });
});

describe('mensajeSeguro', () => {
  it('quita los parámetros del mensaje', () => {
    expect(mensajeSeguro(errorDeConsulta())).not.toContain(SECRETO);
  });
});

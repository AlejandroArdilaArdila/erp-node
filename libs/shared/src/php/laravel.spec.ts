import { carbonParse } from './fecha.js';
import { entradaLaravel, laravelFilled, laravelTrim } from './laravel.js';
import { phpDecimalATexto, phpEsFalso, phpEsNumerico, phpValorEnlazado } from './php.js';

/*
 * Vectores generados con PHP 8.4 (la versión de apipos) y el vendor de apipos
 * (Illuminate\\Support\\Str::trim, Carbon\\Carbon::parse con zona UTC).
 */

const IS_NUMERIC: Array<[string, boolean]> = [
  ['404', true],
  [' 404', true],
  ['404 ', true],
  ['404.5', true],
  ['4e2', true],
  ['.5', true],
  ['5.', true],
  ['0x1A', false],
  ['abc', false],
  ['', false],
  ['  ', false],
  ['-500', true],
  ['+500', true],
  ['1_000', false],
  ['404abc', false],
  ['\n404\n', true],
];

const FLOAT_A_TEXTO: Array<[number, string]> = [
  [0.30000000000000004, '0.3'],
  [1234567.891234567, '1234567.8912346'],
  [120000.5, '120000.5'],
  [1e25, '1.0E+25'],
  [1e-5, '1.0E-5'],
  [0.0001, '0.0001'],
  [19999.99, '19999.99'],
  [0.3333333333333333, '0.33333333333333'],
  [-2.5, '-2.5'],
  [100000000000000.0, '1.0E+14'],
  [1000000000000000.0, '1.0E+15'],
  [123456789012345.6, '1.2345678901235E+14'],
  [0.000123456789, '0.000123456789'],
  [-0, '-0'],
  [99999999999999.98, '1.0E+14'],
];

const STR_TRIM: Array<[string, string]> = [
  ['  a  ', 'a'],
  [' a ', 'a'],
  ['﻿a', 'a'],
  ['\t\na\r\n', 'a'],
  ['　a', 'a'],
  ['​a​', 'a'],
  ['\u0000a\u0000', 'a'],
  [' a ', 'a'],
  ['a', 'a'],
  [' a', 'a'],
  ['᠎a', 'a'],
  ['­a', 'a'],
  ['𝅙a', 'a'],
  ['a b', 'a b'],
  ['⠀aㅤ', 'a'],
  ['\u000ba\f', 'a'],
];

/** [texto, format('Y-m-d H:i:s.u')] o null si Carbon lanza excepción. */
const CARBON: Array<[string, string | null]> = [
  ['2026-11-28 10:15:30.123', '2026-11-28 10:15:30.123000'],
  ['2026-11-28 10:15:30.123456', '2026-11-28 10:15:30.123456'],
  ['2026-11-28T10:15:30.123', '2026-11-28 10:15:30.123000'],
  ['2026-11-28T10:15:30.123Z', '2026-11-28 10:15:30.123000'],
  ['2026-11-28T10:15:30Z', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30-05:00', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30+0130', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30', '2026-11-28 10:15:30.000000'],
  ['2026-11-28 10:15', '2026-11-28 10:15:00.000000'],
  ['2026-11-28', '2026-11-28 00:00:00.000000'],
  ['2026-11-28T23:59:59.999999-05:00', '2026-11-28 23:59:59.999999'],
  ['2026-02-30 10:00:00', '2026-03-02 10:00:00.000000'],
  ['2026-13-01', null],
  ['28/11/2026', null],
  ['basura', null],
  ['1732800000', null],
  ['2026-11-28 10:15:30.1234567', '2026-11-28 10:15:30.123456'],
  [' 2026-11-28 10:15:30 ', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30.5+00:00', '2026-11-28 10:15:30.500000'],
  ['2026-11-28 25:00:00', null],
  ['2026-11-28T10:15:30.123-05', '2026-11-28 10:15:30.123000'],
  ['2026-11-28 24:00:00', '2026-11-29 00:00:00.000000'],
  ['2026-11-28 23:60:00', null],
  ['2026-11-28 23:59:60', '2026-11-29 00:00:00.000000'],
  ['2026-11-00', '2026-10-31 00:00:00.000000'],
  ['2026-11-31', '2026-12-01 00:00:00.000000'],
  ['2026-11-32', null],
  ['2026-00-10', '2025-12-10 00:00:00.000000'],
  ['2026-11-28T10', '2026-11-28 10:00:00.000000'],
  ['2026-1-5', '2026-01-05 00:00:00.000000'],
  ['2026-11-28 7:05:09', '2026-11-28 07:05:09.000000'],
  ['2026-11-28t10:15:30z', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30 Z', '2026-11-28 10:15:30.000000'],
  ['2026-11-28   10:15:30', '2026-11-28 10:15:30.000000'],
  ['2026-11-28 10', null],
  ['2026-11-28T1', '2026-11-28 01:00:00.000000'],
  ['2026-11-28T10:5', '2026-11-28 10:05:00.000000'],
  ['2026-11-28 10:15:30.', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30+5', '2026-11-28 10:15:30.000000'],
  ['2026-11-28T10:15:30.123 -05:00', '2026-11-28 10:15:30.123000'],
  ['2026-11-28T10:15:30.0000001', '2026-11-28 10:15:30.000000'],
  ['2024-02-29 12:00:00', '2024-02-29 12:00:00.000000'],
  ['2023-02-29 12:00:00', '2023-03-01 12:00:00.000000'],
];

describe('phpEsNumerico (is_numeric)', () => {
  it.each(IS_NUMERIC)('%j → %s', (valor, esperado) => {
    expect(phpEsNumerico(valor)).toBe(esperado);
  });
});

describe('phpDecimalATexto ((string) $float, precision 14)', () => {
  it.each(FLOAT_A_TEXTO)('%s → %s', (valor, esperado) => {
    expect(phpDecimalATexto(valor)).toBe(esperado);
  });
});

describe('laravelTrim (Str::trim)', () => {
  it.each(STR_TRIM)('%j → %j', (texto, esperado) => {
    expect(laravelTrim(texto)).toBe(esperado);
  });
});

describe('carbonParse (Carbon::parse)', () => {
  // Expresiones que Carbon acepta y aquí no (no las genera el POS): diferencia documentada.
  const NO_SOPORTADAS = new Set(['now']);

  it.each(CARBON.filter(([t]) => !NO_SOPORTADAS.has(t)))('%j → %j', (texto, esperado) => {
    expect(carbonParse(texto)?.conMicrosegundos ?? null).toBe(esperado);
  });

  it('fechaHora sin microsegundos', () => {
    expect(carbonParse('2026-11-28T10:15:30.123-05:00')?.fechaHora).toBe('2026-11-28 10:15:30');
  });
});

describe('entradaLaravel (TrimStrings + ConvertEmptyStringsToNull + input())', () => {
  it('recorta, convierte vacíos en null y el cuerpo gana sobre la query', () => {
    expect(
      entradaLaravel(
        { a: ' q ', b: 'query', c: '' },
        { b: '  cuerpo\u00a0', d: { e: ' x ', f: [' y ', ''] }, password: ' p ' },
      ),
    ).toEqual({ a: 'q', b: 'cuerpo', c: null, d: { e: 'x', f: ['y', null] }, password: ' p ' });
  });

  it('cuerpo que no es objeto → solo la query', () => {
    expect(entradaLaravel({ a: '1' }, 'texto')).toEqual({ a: '1' });
  });
});

describe('laravelFilled', () => {
  it.each([
    [{ x: 'a' }, true],
    [{ x: 0 }, true],
    [{ x: false }, true],
    [{ x: [] }, true],
    [{ x: '   ' }, false],
    [{ x: null }, false],
    [{}, false],
  ])('%j → %s', (entrada, esperado) => {
    expect(laravelFilled(entrada, 'x')).toBe(esperado);
  });
});

describe('phpValorEnlazado (bindings de Laravel/PDO)', () => {
  it('booleanos como 1/0, enteros tal cual, decimales como (string) de PHP', () => {
    expect(phpValorEnlazado(true)).toBe(1);
    expect(phpValorEnlazado(false)).toBe(0);
    expect(phpValorEnlazado(120000)).toBe(120000);
    expect(phpValorEnlazado(1234567.891234567)).toBe('1234567.8912346');
    expect(phpValorEnlazado('texto')).toBe('texto');
    expect(phpValorEnlazado(null)).toBeNull();
  });

  it('array u objeto → error (500 en apipos)', () => {
    expect(() => phpValorEnlazado([1])).toThrow();
    expect(() => phpValorEnlazado({ a: 1 })).toThrow();
  });
});

describe('phpEsFalso (!$valor)', () => {
  it.each([null, false, 0, '', '0', []])('%j es falso', (valor) => {
    expect(phpEsFalso(valor)).toBe(true);
  });
  it.each(['a', 1, ' ', [0], true])('%j no es falso', (valor) => {
    expect(phpEsFalso(valor)).toBe(false);
  });
});

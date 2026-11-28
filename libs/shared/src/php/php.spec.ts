import { mbSubstr, phpBooleano, phpEntero, phpString, phpTrim, phpVacio } from './php.js';

describe('semántica PHP', () => {
  it('trim solo quita los caracteres de PHP', () => {
    expect(phpTrim(' \t caja-1 \n')).toBe('caja-1');
    expect(phpTrim(' x ')).toBe(' x '); // NBSP: PHP no lo quita
  });

  it('(string) de escalares', () => {
    expect(phpString(123)).toBe('123');
    expect(phpString(true)).toBe('1');
    expect(phpString(null)).toBe('');
    expect(phpString({ a: 1 })).toBe('');
  });

  it("'' y '0' son vacíos", () => {
    expect(phpVacio('')).toBe(true);
    expect(phpVacio('0')).toBe(true);
    expect(phpVacio('00')).toBe(false);
    expect(phpVacio(null)).toBe(true);
  });

  it('FILTER_VALIDATE_BOOLEAN', () => {
    for (const v of [true, 1, '1', 'true', 'TRUE', ' on ', 'yes'])
      expect(phpBooleano(v)).toBe(true);
    for (const v of [false, 0, '0', 'no', 'false', '', null, undefined, 'si'])
      expect(phpBooleano(v)).toBe(false);
  });

  it('(int)', () => {
    expect(phpEntero('12abc')).toBe(12);
    expect(phpEntero('abc')).toBe(0);
    expect(phpEntero(7.9)).toBe(7);
    expect(phpEntero(null)).toBe(0);
  });

  it('mb_substr corta por caracteres', () => {
    expect(mbSubstr('ñandú€', 4)).toBe('ñand');
  });
});

/** Vectores de PHP 8.4: `(int) $valor`. */
describe('phpEntero ((int) de PHP 8)', () => {
  it.each([
    ['404', 404],
    [' 404', 404],
    ['404.9', 404],
    ['4e2', 400],
    ['1.9e1', 19],
    ['.5', 0],
    ['7xyz', 7],
    ['1e3abc', 1000],
    ['-3.7', -3],
    ['+5', 5],
    ['abc', 0],
    ['', 0],
    ['  ', 0],
    ['0x1A', 0],
    ['\n12', 12],
    ['12 ', 12],
    ['-0', 0],
    [5.9, 5],
    [-5.9, -5],
    [true, 1],
    [false, 0],
    [null, 0],
  ])('%j → %s', (valor, esperado) => {
    expect(phpEntero(valor)).toBe(esperado);
  });
});

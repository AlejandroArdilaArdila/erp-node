import {
  mbSubstr,
  phpBooleano,
  phpEntero,
  phpFalso,
  phpJsonDecode,
  phpString,
  phpTrim,
  phpVacio,
} from './php.js';

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

/** Vectores de PHP 8.3: `json_encode(json_decode($s, true) ?: [])`. */
describe('phpJsonDecode + phpFalso (json_decode($s, true) ?: [])', () => {
  const comoPhp = (s: string) => {
    const v = phpJsonDecode(s);
    return phpFalso(v) ? [] : v;
  };

  it.each([
    ['[1,2,3]', [1, 2, 3]],
    ['[]', []],
    ['{}', []],
    ['null', []],
    ['0', []],
    ['"0"', []],
    ['""', []],
    ['false', []],
    ['basura', []],
    ['', []],
    ['{"0":5,"1":6}', [5, 6]],
    ['{"1":5,"2":6}', { '1': 5, '2': 6 }],
    ['{"a":1}', { a: 1 }],
    ['[{"0":"x"}]', [['x']]],
    ['"abc"', 'abc'],
    ['12', 12],
    [' [4] ', [4]],
  ])('%j → %j', (entrada, esperado) => {
    expect(comoPhp(entrada)).toEqual(esperado);
  });
});

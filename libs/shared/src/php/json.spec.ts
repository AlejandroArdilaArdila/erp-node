import { PhpDecimal, phpJsonDecode, phpJsonEncode, phpJsonFalso } from './json.js';

/**
 * Vectores de PHP 8.3:
 *   json_encode(json_decode($s, true), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
 * (las dos opciones solo cambian cómo se escapan los textos, que aquí se
 * escriben con JSON.stringify). Si alguno falla, erp-node dejó de responder
 * igual que apipos para el JSON guardado en la base.
 */
const VECTORES: Array<[string, string]> = [
  ['1.0', '1'],
  ['1', '1'],
  ['0.1', '0.1'],
  ['1e25', '1.0e+25'],
  ['1E2', '100'],
  ['1e15', '1000000000000000'],
  ['1e16', '10000000000000000'],
  ['1e17', '1.0e+17'],
  ['123456789012345678', '123456789012345678'],
  ['9223372036854775807', '9223372036854775807'],
  ['9223372036854775808', '9.223372036854776e+18'],
  ['-9223372036854775808', '-9223372036854775808'],
  ['-9223372036854775809', '-9.223372036854776e+18'],
  ['-0', '0'],
  ['-0.0', '-0'],
  ['0.0001', '0.0001'],
  ['0.00001', '1.0e-5'],
  ['1.5e300', '1.5e+300'],
  ['2.5', '2.5'],
  ['100.50', '100.5'],
  ['3.14159265358979323846', '3.141592653589793'],
  ['-1.25e-7', '-1.25e-7'],
  ['0.1e1', '1'],
  ['5e-324', '5.0e-324'],
  ['123.456e5', '12345600'],
  ['0.000123', '0.000123'],
  ['12345678901234567890.5', '1.2345678901234567e+19'],
  ['[]', '[]'],
  ['{}', '[]'],
  ['[1,2,3]', '[1,2,3]'],
  ['{"0":5,"1":6}', '[5,6]'],
  ['{"1":5,"0":6}', '{"1":5,"0":6}'],
  ['{"1":5,"2":6}', '{"1":5,"2":6}'],
  ['{"b":1,"a":2,"b":3}', '{"b":3,"a":2}'],
  ['{"-0":1,"05":2,"5":3,"-5":4}', '{"-0":1,"05":2,"5":3,"-5":4}'],
  ['{"":1}', '{"":1}'],
  ['{"a":{}}', '{"a":[]}'],
  ['[{"0":"x"}]', '[["x"]]'],
  [
    '{"items":[{"tipo":"texto","size":1.5,"bold":true}],"condicional":null,"repeat":"lineas"}',
    '{"items":[{"tipo":"texto","size":1.5,"bold":true}],"condicional":null,"repeat":"lineas"}',
  ],
  [
    '{"fontSize":12.0,"ancho":80,"margen":0.25,"x":-3}',
    '{"fontSize":12,"ancho":80,"margen":0.25,"x":-3}',
  ],
  ['"a/b ñ 😀"', '"a/b ñ 😀"'],
  ['[true,false,null]', '[true,false,null]'],
  ['{"9223372036854775808":1}', '{"9223372036854775808":1}'],
  ['{"10":"a","9":"b"}', '{"10":"a","9":"b"}'],
  [' [ 1 , {"a" : [ ] } ] ', '[1,{"a":[]}]'],
];

describe('phpJsonEncode(phpJsonDecode(...)) igual que PHP', () => {
  it.each(VECTORES)('%j → %s', (entrada, esperado) => {
    expect(phpJsonEncode(phpJsonDecode(entrada))).toBe(esperado);
  });
});

describe('phpJsonDecode', () => {
  it.each([
    ['vacío', ''],
    ['coma final', '[1,]'],
    ['cero a la izquierda', '01'],
    ['mitad de par sustituto', '"\\ud800"'],
    ['tabulador dentro del texto', '"a\tb"'],
    ['texto después del valor', '[1] x'],
    ['dos valores', '1 2'],
    ['NaN', 'NaN'],
    ['escape inválido', '"\\x"'],
    ['mayúsculas en true', 'tRue'],
    ['punto sin decimales', '1.'],
    ['decimal sin entero', '.5'],
    ['exponente vacío', '1e'],
    ['coma final en objeto', '{"a":1,}'],
    ['BOM al inicio', '\ufeff[1]'],
  ])('%s → null (como PHP)', (_caso, texto) => {
    expect(phpJsonDecode(texto)).toBeNull();
  });

  it('decodifica pares sustitutos y escapes', () => {
    expect(phpJsonDecode('"\\ud83d\\ude00 \\u00e9 \\/"')).toBe('😀 é /');
  });

  it('distingue enteros de decimales', () => {
    expect(phpJsonDecode('5')).toBe(5);
    expect(phpJsonDecode('5.0')).toEqual(new PhpDecimal(5));
    expect(phpJsonDecode('123456789012345678')).toBe(123456789012345678n);
  });

  it('acepta 511 niveles de arrays y rechaza 512 (depth 512 de PHP)', () => {
    const anidado = (n: number) => '['.repeat(n) + '1' + ']'.repeat(n);
    expect(phpJsonDecode(anidado(511))).not.toBeNull();
    expect(phpJsonDecode(anidado(512))).toBeNull();
  });
});

describe('phpJsonEncode con valores de JavaScript', () => {
  it('objetos en su orden, vacíos como {}; arrays como listas; enteros y decimales', () => {
    expect(phpJsonEncode({ b: 1, a: [], c: {}, d: 0.00001, e: -0, f: undefined })).toBe(
      '{"b":1,"a":[],"c":{},"d":1.0e-5,"e":-0}',
    );
  });

  it('INF y NAN fallan (json_encode devuelve false y Laravel responde 500)', () => {
    expect(() => phpJsonEncode(Infinity)).toThrow();
    expect(() => phpJsonEncode(new PhpDecimal(NaN))).toThrow();
  });
});

describe('phpJsonFalso ($v ?: ...)', () => {
  it.each(['null', 'false', '0', '0.0', '""', '"0"', '[]', '{}'])('%s es falso', (json) => {
    expect(phpJsonFalso(phpJsonDecode(json))).toBe(true);
  });

  it.each(['1', '"a"', '[0]', '{"a":null}', '0.1', 'true'])('%s es verdadero', (json) => {
    expect(phpJsonFalso(phpJsonDecode(json))).toBe(false);
  });
});

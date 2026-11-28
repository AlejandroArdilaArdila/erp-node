import { type PhpArray, type PhpValor, phpUnserialize } from './unserialize.js';

/** Map → arreglo de [clave, valor] recursivo, para comparar conservando el orden. */
function entradas(valor: PhpValor | false): unknown {
  if (valor instanceof Map) {
    return [...valor].map(([clave, v]) => [clave, entradas(v)]);
  }
  return valor;
}

/**
 * Vectores generados con PHP 8.3 (`php83 -r 'echo serialize(...)'` y
 * `var_dump(@unserialize(...))`). Si alguno falla, dejamos de leer igual que PHP
 * lo que Dolibarr guarda en la base.
 */
describe('phpUnserialize', () => {
  it('opciones de un extrafield con claves numéricas', () => {
    const serializado = 'a:1:{s:7:"options";a:2:{i:1;s:9:"Abarrotes";i:2;s:9:"Licores 1";}}';
    expect(entradas(phpUnserialize(serializado))).toEqual([
      [
        'options',
        [
          [1, 'Abarrotes'],
          [2, 'Licores 1'],
        ],
      ],
    ]);
  });

  it('longitudes en bytes (UTF-8), comillas y llaves dentro del texto', () => {
    const serializado =
      'a:1:{s:7:"options";a:3:{s:1:"A";s:11:"Lácteos ñ";i:10;s:7:"Bebidas";s:3:"x y";s:26:"Con "comillas"; y {llaves}";}}';
    expect(entradas(phpUnserialize(serializado))).toEqual([
      [
        'options',
        [
          ['A', 'Lácteos ñ'],
          [10, 'Bebidas'],
          ['x y', 'Con "comillas"; y {llaves}'],
        ],
      ],
    ]);
  });

  it('texto vacío y clave 0', () => {
    expect(
      entradas(phpUnserialize('a:1:{s:7:"options";a:2:{i:0;s:0:"";s:0:"";s:6:"vacía";}}')),
    ).toEqual([
      [
        'options',
        [
          [0, ''],
          ['', 'vacía'],
        ],
      ],
    ]);
  });

  it('escalares: null, booleanos, enteros y decimales', () => {
    expect(
      entradas(
        phpUnserialize(
          'a:1:{s:7:"options";a:4:{s:1:"n";N;s:1:"b";b:0;s:1:"i";i:-7;s:1:"d";d:2.5;}}',
        ),
      ),
    ).toEqual([
      [
        'options',
        [
          ['n', null],
          ['b', false],
          ['i', -7],
          ['d', 2.5],
        ],
      ],
    ]);
    expect(phpUnserialize('N;')).toBeNull();
    expect(phpUnserialize('i:+5;')).toBe(5);
    expect(phpUnserialize('i:007;')).toBe(7);
    expect(phpUnserialize('d:1e2;')).toBe(100);
  });

  it('conserva el orden de inserción de las claves enteras', () => {
    expect(entradas(phpUnserialize('a:3:{i:3;s:1:"c";i:1;s:1:"a";i:2;s:1:"b";}'))).toEqual([
      [3, 'c'],
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('clave "5" se vuelve entero; repetida reemplaza el valor y conserva la posición', () => {
    expect(entradas(phpUnserialize('a:2:{i:5;s:1:"a";s:1:"5";s:1:"b";}'))).toEqual([[5, 'b']]);
    expect(entradas(phpUnserialize('a:1:{s:2:"05";s:1:"x";}'))).toEqual([['05', 'x']]);
  });

  it('arrays anidados', () => {
    expect(entradas(phpUnserialize('a:1:{i:0;a:1:{s:1:"k";d:0.1;}}'))).toEqual([[0, [['k', 0.1]]]]);
  });

  it('ignora lo que sobra después del valor, como PHP', () => {
    expect(phpUnserialize('i:1;basura')).toBe(1);
    expect(entradas(phpUnserialize('a:1:{i:0;i:1;}extra'))).toEqual([[0, 1]]);
  });

  it.each([
    ['texto que no es serializado', 'basura'],
    ['cadena vacía', ''],
    ['longitud de texto mayor a la real', 'a:1:{s:7:"options";a:1:{i:1;s:99:"corto";}}'],
    ['longitud de texto distinta', 's:3:"ab";'],
    ['booleano distinto de 0/1', 'b:2;'],
    ['menos elementos que los declarados', 'a:2:{i:0;i:1;}'],
    ['más elementos que los declarados', 'a:1:{i:0;i:1;i:1;i:2;}'],
    ['clave decimal', 'a:1:{d:1.5;i:1;}'],
    ['clave booleana', 'a:1:{b:1;i:1;}'],
    ['falta la llave de cierre', 'a:1:{i:0;s:1:"x"}'],
  ])('%s → false (como PHP)', (_caso, serializado) => {
    expect(phpUnserialize(serializado)).toBe(false);
  });

  it('objetos no soportados → false (PHP los reconstruye; Dolibarr no los guarda en param)', () => {
    expect(phpUnserialize('O:8:"stdClass":0:{}')).toBe(false);
  });

  it('el resultado de un array es un Map', () => {
    const valor = phpUnserialize('a:1:{i:0;i:1;}') as PhpArray;
    expect(valor).toBeInstanceOf(Map);
  });
});

import { cifrarApiKeyDolibarr, descifrarDolibarr, estaCifradoDolibarr } from './dolibarr-crypt.js';

/**
 * Vectores generados con PHP 8 + openssl (mismo código que Dolibarr/apipos).
 * Si alguno falla, Node dejó de ser compatible con lo que hay en la base.
 */
const VECTORES_IV_FIJO = [
  {
    caso: 'clave corta (PHP rellena con 0x00)',
    clave: 'clave-instancia-corta',
    cifrado: 'dolcrypt:AES-256-CTR:10fbb3f05469219f:XG1qM5VXUTPYuPyQ5sDvfQA=',
  },
  {
    caso: 'clave larga (PHP trunca a 32 bytes)',
    clave: 'k'.repeat(40),
    cifrado: 'dolcrypt:AES-256-CTR:10fbb3f05469219f:z5Qnog0z86A81Yn/W0FWB9Q=',
  },
  {
    caso: 'clave vacía',
    clave: '',
    cifrado: 'dolcrypt:AES-256-CTR:10fbb3f05469219f:uKnrRMDwzESdpcGeanR9wbc=',
  },
];

describe('cifrarApiKeyDolibarr', () => {
  it.each(VECTORES_IV_FIJO)('produce lo mismo que PHP: $caso', ({ clave, cifrado }) => {
    expect(cifrarApiKeyDolibarr('ApiKeyDePrueba123', clave)).toBe(cifrado);
  });
});

describe('descifrarDolibarr', () => {
  it('descifra lo que cifró PHP con IV fijo', () => {
    expect(descifrarDolibarr(VECTORES_IV_FIJO[0].cifrado, 'clave-instancia-corta')).toBe(
      'ApiKeyDePrueba123',
    );
  });

  it('descifra con IV propio y caracteres UTF-8', () => {
    const cifrado = 'dolcrypt:AES-256-CTR:0123456789abcdef:xAoknBpuyMe5cWw=';
    expect(descifrarDolibarr(cifrado, 'clave-instancia-corta')).toBe('ñandú €');
  });

  it('devuelve null si la clave es incorrecta (resultado no UTF-8)', () => {
    const cifrado = 'dolcrypt:AES-256-CTR:0123456789abcdef:xAoknBpuyMe5cWw=';
    expect(descifrarDolibarr(cifrado, 'otra-clave')).toBeNull();
  });

  it('devuelve el valor tal cual si no está cifrado o no hay clave', () => {
    expect(descifrarDolibarr('texto-plano', 'clave')).toBe('texto-plano');
    expect(descifrarDolibarr(VECTORES_IV_FIJO[0].cifrado, '')).toBe(VECTORES_IV_FIJO[0].cifrado);
    expect(descifrarDolibarr('', 'clave')).toBe('');
    expect(descifrarDolibarr(null, 'clave')).toBeNull();
  });

  it('ida y vuelta', () => {
    const cifrado = cifrarApiKeyDolibarr('otra-api-key', 'mi-clave');
    expect(estaCifradoDolibarr(cifrado)).toBe(true);
    expect(descifrarDolibarr(cifrado, 'mi-clave')).toBe('otra-api-key');
  });
});

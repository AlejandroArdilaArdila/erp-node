import { createCipheriv, createDecipheriv, createHash, getCipherInfo } from 'node:crypto';

/**
 * Compatibilidad con el cifrado "dolcrypt" de Dolibarr
 * (core/lib/security.lib.php → dolEncrypt / dolDecrypt) y con
 * App\Support\DolibarrCrypt + ApiKeyGuard de apipos.
 *
 * Formato: `dolcrypt:<CIPHER>:<IV>:<CIPHERTEXT_BASE64>`
 *  - El IV se usa como texto literal (sus caracteres), no se decodifica de hex.
 *  - La clave es `$dolibarr_main_instance_unique_id` (env DOLIBARR_INSTANCE_KEY).
 *
 * PHP `openssl_encrypt` rellena con bytes 0x00 una clave corta y trunca una
 * larga; Node exige el largo exacto, así que se replica ese ajuste en
 * `ajustarLargo`. Los tests usan vectores generados con el PHP real.
 */

const PREFIJO = 'dolcrypt:';
const CIFRADO_POR_DEFECTO = 'AES-256-CTR';

/**
 * IV fijo que Dolibarr usa para api_key: `substr(md5('dolibarr'), 0, 16)`.
 * Permite buscar un usuario por api_key cifrada sin descifrar toda la tabla.
 */
const IV_FIJO_API_KEY = createHash('md5').update('dolibarr').digest('hex').slice(0, 16);

function infoCifrado(nombre: string): { keyLength: number; ivLength: number } {
  const info = getCipherInfo(nombre.toLowerCase());
  if (!info) {
    throw new Error(`Cifrado no soportado: ${nombre}`);
  }
  return { keyLength: info.keyLength, ivLength: info.ivLength ?? 0 };
}

/** Rellena con 0x00 o trunca, igual que PHP openssl_*. */
function ajustarLargo(valor: string, largo: number): Buffer {
  const salida = Buffer.alloc(largo);
  Buffer.from(valor, 'utf8').copy(salida, 0, 0, largo);
  return salida;
}

/** true si el valor tiene el formato `dolcrypt:...`. */
export function estaCifradoDolibarr(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.startsWith(PREFIJO);
}

/**
 * Cifra igual que `dolEncrypt($valor, $clave, 'AES-256-CTR', 'dolibarr')`, es
 * decir, con el IV fijo. Es lo que guarda Dolibarr en `llx_user.api_key`.
 */
export function cifrarApiKeyDolibarr(valor: string, clave: string): string {
  const { keyLength, ivLength } = infoCifrado(CIFRADO_POR_DEFECTO);
  const iv = IV_FIJO_API_KEY.slice(0, ivLength);
  const cipher = createCipheriv(
    CIFRADO_POR_DEFECTO.toLowerCase(),
    ajustarLargo(clave, keyLength),
    Buffer.from(iv, 'utf8'),
  );
  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]).toString('base64');
  return `${PREFIJO}${CIFRADO_POR_DEFECTO}:${iv}:${cifrado}`;
}

/**
 * Réplica de `DolibarrCrypt::decrypt` de apipos.
 *  - Valor vacío, sin clave o sin formato dolcrypt → se devuelve tal cual.
 *  - Clave incorrecta → `null` (AES-CTR no falla, devuelve basura no UTF-8).
 */
export function descifrarDolibarr(cadena: string | null, clave: string): string | null {
  if (cadena === null || cadena === '') {
    return cadena;
  }
  const coincidencia = /^dolcrypt:([^:]+):(.+)$/s.exec(cadena);
  if (clave === '' || !coincidencia) {
    return cadena;
  }

  const [, nombreCifrado, resto] = coincidencia;
  const partes = resto.split(':');
  const tieneIv = partes.length > 1 && partes[1] !== '';
  const iv = tieneIv ? partes[0] : '';
  const textoCifrado = tieneIv ? partes[1] : partes[0];

  try {
    const { keyLength, ivLength } = infoCifrado(nombreCifrado);
    const decipher = createDecipheriv(
      nombreCifrado.toLowerCase(),
      ajustarLargo(clave, keyLength),
      ajustarLargo(iv, ivLength),
    );
    const bytes = Buffer.concat([
      decipher.update(Buffer.from(textoCifrado, 'base64')),
      decipher.final(),
    ]);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

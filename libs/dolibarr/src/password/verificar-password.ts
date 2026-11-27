import { createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Datos de contraseña de un usuario de `llx_user`.
 *  - `passCrypted`: columna `pass_crypted` (bcrypt en Dolibarr moderno, MD5 en instalaciones viejas).
 *  - `passPlano`: columna `pass` (texto plano; solo en configuraciones inseguras).
 */
export interface CredencialesDolibarr {
  passCrypted: string | null;
  passPlano: string | null;
}

function igualesSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Réplica de `AuthService::verifyPassword` de apipos:
 *  1. bcrypt (`$2y$`, `$2a$`, `$2b$`) → bcrypt.compare
 *  2. MD5 de 32 hex → comparación en tiempo constante
 *  3. Texto plano en `pass` → comparación en tiempo constante (último recurso)
 *
 * Diferencia conocida: PHP `password_verify` también acepta argon2. Dolibarr
 * usa bcrypt por defecto; si aparece un hash `$argon2...` se rechaza y se
 * debe agregar soporte (ver docs/adr/0003).
 */
export async function verificarPasswordDolibarr(
  password: string,
  credenciales: CredencialesDolibarr,
): Promise<boolean> {
  const hash = credenciales.passCrypted ?? '';

  if (/^\$2[aby]\$\d{2}\$/.test(hash)) {
    // bcryptjs no reconoce el prefijo $2y$ de PHP; es el mismo algoritmo que $2b$.
    return bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2b$'));
  }

  if (hash.startsWith('$argon2')) {
    return false;
  }

  if (/^[a-f0-9]{32}$/i.test(hash)) {
    const md5 = createHash('md5').update(password, 'utf8').digest('hex');
    return igualesSeguro(hash.toLowerCase(), md5);
  }

  const plano = credenciales.passPlano ?? '';
  if (plano !== '') {
    return igualesSeguro(plano, password);
  }

  return false;
}

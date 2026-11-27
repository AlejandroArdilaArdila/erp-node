import { verificarPasswordDolibarr } from './verificar-password.js';

/** Hashes generados con PHP password_hash() / md5() (mismo origen que Dolibarr). */
const BCRYPT_PHP = '$2y$10$UeT1cuPSfn23EyQYdUZYweCFhiLtskz02j4m7DaLtmCh89erDWizK';
const MD5_PHP = 'ad11e5ba1cc03bd554e6c755756d54a2';
const PASSWORD = 'Secreta#2026';

describe('verificarPasswordDolibarr', () => {
  it('acepta bcrypt $2y$ generado por PHP', async () => {
    await expect(
      verificarPasswordDolibarr(PASSWORD, { passCrypted: BCRYPT_PHP, passPlano: null }),
    ).resolves.toBe(true);
    await expect(
      verificarPasswordDolibarr('otra', { passCrypted: BCRYPT_PHP, passPlano: null }),
    ).resolves.toBe(false);
  });

  it('acepta MD5 legado (sin importar mayúsculas)', async () => {
    await expect(
      verificarPasswordDolibarr(PASSWORD, { passCrypted: MD5_PHP.toUpperCase(), passPlano: null }),
    ).resolves.toBe(true);
    await expect(
      verificarPasswordDolibarr('otra', { passCrypted: MD5_PHP, passPlano: null }),
    ).resolves.toBe(false);
  });

  it('usa texto plano solo si no hay hash reconocible', async () => {
    await expect(
      verificarPasswordDolibarr(PASSWORD, { passCrypted: null, passPlano: PASSWORD }),
    ).resolves.toBe(true);
    await expect(
      verificarPasswordDolibarr(PASSWORD, { passCrypted: '', passPlano: 'otra' }),
    ).resolves.toBe(false);
  });

  it('el texto plano no aplica cuando hay un bcrypt (no se puede saltar el hash)', async () => {
    await expect(
      verificarPasswordDolibarr(PASSWORD, { passCrypted: BCRYPT_PHP, passPlano: 'x' }),
    ).resolves.toBe(true);
    await expect(
      verificarPasswordDolibarr('x', { passCrypted: BCRYPT_PHP, passPlano: 'x' }),
    ).resolves.toBe(false);
  });

  it('rechaza si no hay nada con qué comparar', async () => {
    await expect(
      verificarPasswordDolibarr(PASSWORD, { passCrypted: null, passPlano: null }),
    ).resolves.toBe(false);
  });
});

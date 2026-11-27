import { cifrarApiKeyDolibarr } from '@erp/dolibarr';
import type { AppConfig } from '@erp/shared';
import { ApiKeyService } from './api-key.service.js';
import { nombreVisible, type UsuarioAutenticado } from './usuario-autenticado.js';
import type { UsuariosRepositorio } from './usuarios.repositorio.js';

const CLAVE = 'clave-instancia';
const USUARIO: UsuarioAutenticado = {
  id: 7,
  login: 'cajero1',
  nombre: 'Ana Pérez',
  admin: false,
  entity: 1,
};

function crearServicio(usuario: UsuarioAutenticado | null = USUARIO) {
  const repo = { buscarActivoPorApiKey: vi.fn().mockResolvedValue(usuario) };
  const config = { dolibarrInstanceKey: CLAVE } as AppConfig;
  return { servicio: new ApiKeyService(repo as unknown as UsuariosRepositorio, config), repo };
}

describe('ApiKeyService.usuarioPorApiKey (guard)', () => {
  it('busca por texto plano y por valor cifrado, limitado a entidades 0 y 1', async () => {
    const { servicio, repo } = crearServicio();

    await expect(servicio.usuarioPorApiKey('ABC')).resolves.toEqual(USUARIO);
    expect(repo.buscarActivoPorApiKey).toHaveBeenCalledWith({
      apiKeys: ['ABC', cifrarApiKeyDolibarr('ABC', CLAVE)],
      entidades: [0, 1],
    });
  });

  it('sin api_key no consulta la base', async () => {
    const { servicio, repo } = crearServicio();
    await expect(servicio.usuarioPorApiKey('')).resolves.toBeNull();
    expect(repo.buscarActivoPorApiKey).not.toHaveBeenCalled();
  });
});

describe('ApiKeyService.validar (validateApiKey)', () => {
  it('APIKEY vacía o con espacios → requerida', async () => {
    const { servicio } = crearServicio();
    await expect(servicio.validar('   ')).resolves.toEqual({
      ok: false,
      error: 'APIKEY requerida',
    });
  });

  it('APIKEY desconocida → inválida', async () => {
    const { servicio } = crearServicio(null);
    await expect(servicio.validar('XYZ')).resolves.toEqual({ ok: false, error: 'APIKEY inválida' });
  });

  it('APIKEY válida → mismo formato que apipos, sin filtrar entity', async () => {
    const { servicio, repo } = crearServicio();
    await expect(servicio.validar(' ABC ')).resolves.toEqual({
      ok: true,
      user: { id: 7, login: 'cajero1', nombre: 'Ana Pérez', admin: 0 },
    });
    expect(repo.buscarActivoPorApiKey).toHaveBeenCalledWith({
      apiKeys: ['ABC', cifrarApiKeyDolibarr('ABC', CLAVE)],
    });
  });
});

describe('nombreVisible', () => {
  it('replica implode + array_filter de PHP', () => {
    expect(nombreVisible('Ana', 'Pérez', 'x')).toBe('Ana Pérez');
    expect(nombreVisible(null, 'Pérez', 'x')).toBe('Pérez');
    expect(nombreVisible('', null, 'cajero1')).toBe('cajero1');
    expect(nombreVisible('0', null, 'cajero1')).toBe('cajero1');
  });
});

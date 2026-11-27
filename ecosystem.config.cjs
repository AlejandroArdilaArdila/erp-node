/**
 * PM2: un proceso de erp-node POR CLIENTE (ADR 0007).
 *
 * Cada archivo tenants/<cliente>.env define un cliente: su base de datos, su
 * puerto y TENANT_ID=<cliente>. Agregar un cliente = crear su archivo y luego:
 *
 *   npm run build && pm2 start ecosystem.config.cjs && pm2 save
 *
 * Actualizar todos después de un cambio de código:  pm2 reload ecosystem.config.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const carpeta = path.join(__dirname, 'tenants');
const archivos = fs.existsSync(carpeta)
  ? fs.readdirSync(carpeta).filter((f) => /^[a-z0-9][a-z0-9-]*\.env$/.test(f))
  : [];

const puertos = new Map();
const apps = archivos.map((archivo) => {
  const cliente = archivo.replace(/\.env$/, '');
  const ruta = path.join(carpeta, archivo);
  const contenido = fs.readFileSync(ruta, 'utf8');
  const valor = (clave) => (new RegExp(`^${clave}="?([^"\\n]*)"?`, 'm').exec(contenido) || [])[1];

  if (valor('TENANT_ID') !== cliente) {
    throw new Error(`${archivo}: TENANT_ID debe ser "${cliente}" (es "${valor('TENANT_ID')}")`);
  }
  const puerto = valor('PORT');
  if (!puerto) throw new Error(`${archivo}: falta PORT`);
  if (puertos.has(puerto)) {
    throw new Error(`${archivo}: el puerto ${puerto} ya lo usa ${puertos.get(puerto)}`);
  }
  puertos.set(puerto, archivo);

  return {
    name: `erp-node-${cliente}`,
    script: 'dist/apps/api/main.js',
    cwd: __dirname,
    exec_mode: 'fork',
    instances: 1,
    env: { NODE_ENV: 'production', ENV_FILE: ruta },
    max_memory_restart: '512M',
    kill_timeout: 10000,
    time: true,
  };
});

module.exports = { apps };

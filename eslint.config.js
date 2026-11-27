// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Reglas de calidad y de ARQUITECTURA. Las reglas de arquitectura
 * (imports restringidos, process.env) hacen cumplir las decisiones de
 * docs/adr: si una regla molesta, se discute en un ADR, no se desactiva.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.introspeccion-legado/**',
      'eslint.config.js',
      '*.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Promesas sin await = transacciones o errores que se pierden en silencio.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: 'error',
      'no-console': 'error',

      // Fronteras entre módulos: solo la API pública de cada dominio.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@erp/domain/*/*'],
              message: 'Importa solo la API pública del dominio: @erp/domain/<dominio>.',
            },
            {
              group: ['**/libs/*/src/**'],
              message: 'Usa el alias (@erp/...) en vez de rutas relativas a libs.',
            },
          ],
        },
      ],

      // La configuración se lee SOLO a través de AppConfig (validada).
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Inyecta AppConfig en vez de leer process.env.',
        },
      ],
    },
  },
  {
    // Únicos lugares autorizados a leer process.env.
    files: [
      'libs/shared/src/config/**/*.ts',
      'libs/database/src/legacy/schema/tabla-legado.ts',
      'apps/*/test/setup-env.ts',
      '*.ts',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    // Los tests pueden reemplazar piezas internas y usar respuestas sin tipo.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'apps/*/test/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);

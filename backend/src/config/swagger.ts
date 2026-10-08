import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { swaggerBasicAuth } from '../middleware/swaggerAuth.js';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildOpenApiSpec(): object {
  return swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: { title: 'TizimLab API', version: '1.0.0' },
      servers: [{ url: '/api/v1' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    // Har modul router'idagi `@openapi` annotatsiyalari (src: .ts, dist: .js)
    apis: [path.join(srcDir, 'modules/**/*.router.{ts,js}').replace(/\\/g, '/')],
  });
}

/** Swagger UI faqat development muhitida ulanadi (spec §16), HTTP Basic bilan himoyalangan (D-93). */
export function mountSwagger(app: Express, credentials: { user: string; password: string }): void {
  app.use(
    '/docs',
    swaggerBasicAuth(credentials),
    swaggerUi.serve,
    swaggerUi.setup(buildOpenApiSpec()),
  );
}

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { sendOk } from '../../utils/http.js';
import { getHistory, type HistoryEntity } from './history.service.js';

const paramsSchema = z.object({
  entity: z.enum(['sample', 'reagent', 'nd']),
  id: z.string().uuid('Identifikator noto‘g‘ri'),
});

/** Har tur o'z ko'rish ruxsati bilan (namuna/reaktiv/ND sahifasini ko'ra olgan — tarixini ham). */
const VIEW: Record<HistoryEntity, ReturnType<typeof requirePermission>> = {
  sample: requirePermission('samples', 'view'),
  reagent: requirePermission('reagents', 'view'),
  nd: requirePermission('nd', 'view'),
};

/**
 * P18 (D-189): yagona tarix — `GET /history/{sample|reagent|nd}/{id}`.
 * @openapi
 * /history/{entity}/{id}:
 *   get:
 *     tags: [History]
 *     summary: "Tarix: sarf, AI maydon o'zgarishlari (AI → yakuniy), rad etish sabablari, tasdiqlashlar"
 *     security: [{ bearerAuth: [] }]
 *     responses: { 200: { description: "[{ id, type, at, actorId, actorName, data }]" }, 404: { description: NOT_FOUND } }
 */
export function createHistoryRouter(deps: { auth: AuthMiddleware }): Router {
  const router = Router();
  router.get(
    '/:entity/:id',
    ...deps.auth.requireAuth,
    requireCompany,
    validate({ params: paramsSchema }),
    (req: Request, res: Response, next: NextFunction) => {
      const { entity } = req.validated.params as z.infer<typeof paramsSchema>;
      return VIEW[entity](req, res, next);
    },
    async (req: Request, res: Response) => {
      if (!req.auth?.companyId) throw new UnauthorizedError();
      const { entity, id } = req.validated.params as z.infer<typeof paramsSchema>;
      sendOk(
        res,
        await getHistory(
          req.auth.companyId,
          { id: req.auth.userId, role: req.auth.role, companyId: req.auth.companyId },
          entity,
          id,
        ),
      );
    },
  );
  return router;
}

import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createStabilityController } from './stability.controller.js';
import {
  addParameterSchema,
  checkpointIdParamSchema,
  completeCheckpointSchema,
  createCheckpointSchema,
  createStudySchema,
  listCheckpointsQuerySchema,
  listStudiesQuerySchema,
  parameterParamSchema,
  recordResultsSchema,
  studyIdParamSchema,
  updateCheckpointSchema,
} from './stability.schemas.js';

export interface StabilityRouterDeps {
  auth: AuthMiddleware;
}

export function createStabilityRouter(deps: StabilityRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const controller = createStabilityController();

  // Studies list & creation
  router.get(
    '/',
    ...companyAuth,
    requirePermission('stability', 'view'),
    validate({ query: listStudiesQuerySchema }),
    controller.listStudies,
  );

  router.post(
    '/',
    ...companyAuth,
    requirePermission('stability', 'start'),
    validate({ body: createStudySchema }),
    controller.createStudy,
  );

  // Checkpoints list (for reminders, dashboards)
  router.get(
    '/checkpoints',
    ...companyAuth,
    requirePermission('stability', 'view'),
    validate({ query: listCheckpointsQuerySchema }),
    controller.listCheckpoints,
  );

  // Sample-specific active study
  router.get(
    '/sample/:sampleId',
    ...companyAuth,
    requirePermission('stability', 'view'),
    controller.getStudyBySampleId,
  );

  // Single study detail
  router.get(
    '/:id',
    ...companyAuth,
    requirePermission('stability', 'view'),
    validate({ params: studyIdParamSchema }),
    controller.getStudyById,
  );

  // Add checkpoint to study
  router.post(
    '/:id/checkpoints',
    ...companyAuth,
    requirePermission('stability', 'start'),
    validate({ params: studyIdParamSchema, body: createCheckpointSchema }),
    controller.createCheckpoint,
  );

  // Checkpoint details
  router.get(
    '/checkpoints/:id',
    ...companyAuth,
    requirePermission('stability', 'view'),
    validate({ params: checkpointIdParamSchema }),
    controller.getCheckpointById,
  );

  // Update checkpoint
  router.put(
    '/checkpoints/:id',
    ...companyAuth,
    requirePermission('stability', 'start'),
    validate({ params: checkpointIdParamSchema, body: updateCheckpointSchema }),
    controller.updateCheckpoint,
  );

  // Delete checkpoint
  router.delete(
    '/checkpoints/:id',
    ...companyAuth,
    requirePermission('stability', 'start'),
    validate({ params: checkpointIdParamSchema }),
    controller.deleteCheckpoint,
  );

  // Record results
  router.post(
    '/checkpoints/:id/results',
    ...companyAuth,
    requirePermission('stability', 'record'),
    validate({ params: checkpointIdParamSchema, body: recordResultsSchema }),
    controller.recordResults,
  );

  // Complete checkpoint
  router.post(
    '/checkpoints/:id/complete',
    ...companyAuth,
    requirePermission('stability', 'record'),
    validate({ params: checkpointIdParamSchema, body: completeCheckpointSchema }),
    controller.completeCheckpoint,
  );

  // Checkpoint parameters (add / remove)
  router.post(
    '/checkpoints/:id/parameters',
    ...companyAuth,
    requirePermission('stability', 'start'),
    validate({ params: checkpointIdParamSchema, body: addParameterSchema }),
    controller.addParameter,
  );

  router.delete(
    '/checkpoints/:id/parameters/:parameter',
    ...companyAuth,
    requirePermission('stability', 'start'),
    validate({ params: parameterParamSchema }),
    controller.removeParameter,
  );

  return router;
}

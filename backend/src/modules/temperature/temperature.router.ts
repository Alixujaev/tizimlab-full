import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/authenticate.js';
import { requireCompany, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createTemperatureController } from './temperature.controller.js';
import {
  createManualReadingSchema,
  createSensorConfigSchema,
  idParamSchema,
  ingestReadingSchema,
  listAlertsQuerySchema,
  listReadingsQuerySchema,
  resolveAlertSchema,
  updateSensorConfigSchema,
} from './temperature.schemas.js';

export interface TemperatureRouterDeps {
  auth: AuthMiddleware;
}

export function createTemperatureRouter(deps: TemperatureRouterDeps): Router {
  const router = Router();
  const companyAuth = [...deps.auth.requireAuth, requireCompany];
  const controller = createTemperatureController();

  // Status (har bir sensor bo'yicha joriy holat, so'nggi o'qish, 24h statistika)
  router.get(
    '/status',
    ...companyAuth,
    requirePermission('temperature', 'view'),
    controller.getStatus,
  );

  // Sensorlar sozlamalari (CRUD)
  router.get(
    '/sensors',
    ...companyAuth,
    requirePermission('temperature', 'view'),
    controller.listSensors,
  );

  router.get(
    '/sensors/:id',
    ...companyAuth,
    requirePermission('temperature', 'view'),
    validate({ params: idParamSchema }),
    controller.getSensorById,
  );

  router.post(
    '/sensors',
    ...companyAuth,
    requirePermission('temperature', 'write'),
    validate({ body: createSensorConfigSchema }),
    controller.createSensor,
  );

  router.put(
    '/sensors/:id',
    ...companyAuth,
    requirePermission('temperature', 'write'),
    validate({ params: idParamSchema, body: updateSensorConfigSchema }),
    controller.updateSensor,
  );

  router.delete(
    '/sensors/:id',
    ...companyAuth,
    requirePermission('temperature', 'write'),
    validate({ params: idParamSchema }),
    controller.deleteSensor,
  );

  // O'qishlar (Readings)
  router.get(
    '/readings',
    ...companyAuth,
    requirePermission('temperature', 'view'),
    validate({ query: listReadingsQuerySchema }),
    controller.listReadings,
  );

  router.post(
    '/readings',
    ...companyAuth,
    requirePermission('temperature', 'write'),
    validate({ body: createManualReadingSchema }),
    controller.createReading,
  );

  // IoT / Qurilma orqali o'qish yuborish (D-137: API key orqali)
  router.post(
    '/readings/ingest',
    validate({ body: ingestReadingSchema }),
    controller.ingestReading,
  );

  // Alertlar (Alerts)
  router.get(
    '/alerts',
    ...companyAuth,
    requirePermission('temperature', 'view'),
    validate({ query: listAlertsQuerySchema }),
    controller.listAlerts,
  );

  router.post(
    '/alerts/:id/resolve',
    ...companyAuth,
    requirePermission('temperature', 'write'),
    validate({ params: idParamSchema, body: resolveAlertSchema }),
    controller.resolveAlert,
  );

  return router;
}

import type { Request, Response } from 'express';
import { sendCreated, sendOk, sendPaginated } from '../../utils/http.js';
import type {
  CreateManualReadingInput,
  CreateSensorConfigInput,
  IngestReadingInput,
  ListAlertsQuery,
  ListReadingsQuery,
  ResolveAlertInput,
  UpdateSensorConfigInput,
} from './temperature.schemas.js';
import * as tempService from './temperature.service.js';

export function createTemperatureController() {
  return {
    async listSensors(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const sensors = await tempService.listSensorConfigs(companyId);
      sendOk(res, sensors);
    },

    async getSensorById(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const sensor = await tempService.getSensorConfigById(companyId, req.params.id as string);
      sendOk(res, sensor);
    },

    async createSensor(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const input = (req.validated?.body ?? req.body) as CreateSensorConfigInput;
      const sensor = await tempService.createSensorConfig(companyId, input);
      sendCreated(res, sensor);
    },

    async updateSensor(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const input = (req.validated?.body ?? req.body) as UpdateSensorConfigInput;
      const sensor = await tempService.updateSensorConfig(companyId, req.params.id as string, input);
      sendOk(res, sensor);
    },

    async deleteSensor(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      await tempService.deleteSensorConfig(companyId, req.params.id as string);
      res.status(204).send();
    },

    async createReading(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const userId = req.auth!.userId;
      const input = (req.validated?.body ?? req.body) as CreateManualReadingInput;
      const result = await tempService.createManualReading(companyId, userId, input);
      sendCreated(res, result);
    },

    async ingestReading(req: Request, res: Response) {
      const headerKey = req.headers['x-sensor-key'] as string | undefined;
      const input = (req.validated?.body ?? req.body) as IngestReadingInput;
      const result = await tempService.ingestDeviceReading(headerKey, input);
      sendCreated(res, result);
    },

    async listReadings(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const query = (req.validated?.query ?? req.query) as unknown as ListReadingsQuery;
      const result = await tempService.listReadings(companyId, query);
      sendPaginated(res, result.items, result.meta);
    },

    async listAlerts(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const query = (req.validated?.query ?? req.query) as unknown as ListAlertsQuery;
      const result = await tempService.listAlerts(companyId, query);
      sendPaginated(res, result.items, result.meta);
    },

    async resolveAlert(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const userId = req.auth!.userId;
      const input = (req.validated?.body ?? req.body) as ResolveAlertInput;
      const alert = await tempService.resolveAlert(companyId, req.params.id as string, userId, input);
      sendOk(res, alert);
    },

    async getStatus(req: Request, res: Response) {
      const companyId = req.auth!.companyId!;
      const status = await tempService.getSensorsStatus(companyId);
      sendOk(res, status);
    },
  };
}

/** P17 (D-174..D-178): apparatlar, normativ hujjatlar, moslik va ND bo'yicha avto-sarf. */

export type EquipmentStatus = 'active' | 'maintenance' | 'out_of_service';

export interface EquipmentDto {
  id: string;
  companyId: string;
  name: string;
  category: string;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  status: EquipmentStatus;
  calibrationDue: string | null;
  isCalibrationExpired: boolean;
  isCalibrationDueSoon: boolean;
  isUsable: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentInput {
  name: string;
  category: string;
  model?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  status?: EquipmentStatus;
  calibrationDue?: string | null;
  notes?: string | null;
}

export interface EquipmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: EquipmentStatus;
  calibrationDueWithinDays?: number;
}

export type NdStatus = 'draft' | 'approved' | 'archived';

export interface NdDto {
  id: string;
  code: string;
  name: string;
  version: string | null;
  status: NdStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  fileName: string | null;
  fileSize: number | null;
  hasFile: boolean;
  requirementCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NdRequirementDto {
  id: string;
  kind: 'equipment' | 'reagent';
  methodName: string | null;
  equipmentCategory: string | null;
  reagentItemId: string | null;
  reagentItemName: string | null;
  quantityPerAnalysis: number | null;
  unit: string | null;
  source: 'manual' | 'ai';
  note: string | null;
  sortOrder: number;
}

export interface NdDetailDto extends NdDto {
  requirements: NdRequirementDto[];
}

export interface NdInput {
  code: string;
  name: string;
  version?: string | null;
}

export type NdRequirementInput =
  | {
      kind: 'equipment';
      equipmentCategory: string;
      methodName?: string | null;
      note?: string | null;
    }
  | {
      kind: 'reagent';
      reagentItemId: string;
      quantityPerAnalysis: number;
      unit: string;
      methodName?: string | null;
      note?: string | null;
    };

export interface NdListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: NdStatus;
}

export type FeasibilityReasonType =
  | 'no_requirements'
  | 'equipment_missing'
  | 'equipment_unavailable'
  | 'equipment_calibration_expired'
  | 'reagent_missing'
  | 'reagent_insufficient'
  | 'reagent_all_expired';

export interface FeasibilityReason {
  type: FeasibilityReasonType;
  detail: string;
  data: Record<string, string | number | null>;
}

export interface FeasibilityDto {
  ndId: string;
  ndStatus: NdStatus;
  nAnalyses: number;
  canRun: boolean;
  reasons: FeasibilityReason[];
  equipment: { category: string; ok: boolean; usable: number; total: number }[];
  reagents: {
    reagentItemId: string;
    reagentName: string;
    unit: string;
    required: number;
    available: number;
    ok: boolean;
  }[];
}

export interface ReagentItemDto {
  id: string;
  name: string;
  casNumber: string | null;
  unitFamily: string;
  usableLots: number;
}

export type ConsumptionStatus = 'auto' | 'confirmed' | 'corrected';

export interface ConsumptionDto {
  id: string;
  protocolId: string;
  ndId: string | null;
  reagentItemId: string;
  reagentItemName: string;
  unit: string;
  requiredQty: number;
  consumedQty: number;
  shortfallQty: number;
  status: ConsumptionStatus;
  correctionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  lots: {
    reagentId: string;
    reagentName: string;
    quantity: number;
    unit: string;
    expiresAt: string | null;
  }[];
  createdAt: string;
}

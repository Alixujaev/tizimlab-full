export type SampleType =
  'raw_material' | 'finished_product' | 'reagent' | 'standard_substance' | 'other';

export type SampleStatus =
  'pending_assignment' | 'in_progress' | 'stopped' | 'submitted' | 'approved' | 'rejected';

export type SampleTrackingEventType =
  | 'sample_created'
  | 'assigned'
  | 'reassigned'
  | 'stopped'
  | 'resumed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'passport_uploaded'
  | 'passport_reviewed'
  | 'passport_deleted'
  | 'deleted';

export interface SampleRow {
  id: string;
  company_id: string;
  type: SampleType;
  status: SampleStatus;
  substance_id: string | null;
  substance_name: string;
  serial_number: string | null;
  lot_number: string | null;
  quantity: string | null;
  manufacturer: string | null;
  manufactured_at: string | null;
  analysis_start: string | null;
  analysis_end: string | null;
  notes: string | null;
  created_by: string;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  stop_reason: string | null;
  stopped_at: string | null;
  deleted_at: string | null;
  passport_file_name: string | null;
  passport_file_path: string | null;
  passport_file_size: number | null;
  passport_status: 'pending' | 'approved' | 'rejected' | null;
  passport_uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleTrackingRow {
  id: string;
  company_id: string;
  sample_id: string;
  event_type: SampleTrackingEventType;
  user_id: string | null;
  from_status: SampleStatus | null;
  to_status: SampleStatus | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SampleDto {
  id: string;
  companyId: string;
  type: SampleType;
  status: SampleStatus;
  substanceId: string | null;
  substanceName: string;
  serialNumber: string | null;
  lotNumber: string | null;
  quantity: string | null;
  manufacturer: string | null;
  manufacturedAt: string | null;
  analysisStart: string | null;
  analysisEnd: string | null;
  notes: string | null;
  createdBy: string;
  assignedTo: string | null;
  assignedToName?: string | null;
  assigned_to_name?: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  stopReason: string | null;
  stoppedAt: string | null;
  deletedAt: string | null;
  passportFileName?: string | null;
  passportStatus?: 'pending' | 'approved' | 'rejected' | null;
  passportFileSize?: number | null;
  passportUploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleTrackingDto {
  id: string;
  sampleId: string;
  eventType: SampleTrackingEventType;
  userId: string | null;
  userFullName?: string | null;
  fromStatus: SampleStatus | null;
  toStatus: SampleStatus | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SampleDetailDto extends SampleDto {
  tracking: SampleTrackingDto[];
}

export function toSampleDto(row: SampleRow): SampleDto {
  return {
    id: row.id,
    companyId: row.company_id,
    type: row.type,
    status: row.status,
    substanceId: row.substance_id,
    substanceName: row.substance_name,
    serialNumber: row.serial_number,
    lotNumber: row.lot_number,
    quantity: row.quantity,
    manufacturer: row.manufacturer,
    manufacturedAt: row.manufactured_at ? String(row.manufactured_at).slice(0, 10) : null,
    analysisStart: row.analysis_start ? String(row.analysis_start).slice(0, 10) : null,
    analysisEnd: row.analysis_end ? String(row.analysis_end).slice(0, 10) : null,
    notes: row.notes,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    assigned_to_name: row.assigned_to_name ?? null,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    stopReason: row.stop_reason,
    stoppedAt: row.stopped_at,
    deletedAt: row.deleted_at,
    passportFileName: row.passport_file_name,
    passportStatus: row.passport_status,
    passportFileSize: row.passport_file_size,
    passportUploadedBy: row.passport_uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSampleTrackingDto(
  row: SampleTrackingRow & { user_full_name?: string | null },
): SampleTrackingDto {
  return {
    id: row.id,
    sampleId: row.sample_id,
    eventType: row.event_type,
    userId: row.user_id,
    userFullName: row.user_full_name ?? null,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

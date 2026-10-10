export type StabilityStudyStatus = 'active' | 'completed';
export type StabilityCheckpointStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type StabilityResultStatus = 'pass' | 'fail' | 'warning';

export interface StabilityStudyRow {
  id: string;
  company_id: string;
  sample_id: string;
  started_at: string | Date;
  storage_conditions: string | null;
  status: StabilityStudyStatus;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
  serial_number?: string | null;
  substance_name?: string;
  sample_name?: string;
  created_by_name?: string;
  total_checkpoints?: string;
  completed_checkpoints?: string;
}

export interface StabilityCheckpointRow {
  id: string;
  company_id: string;
  study_id: string;
  interval_tag: string;
  due_date: string | Date;
  status: StabilityCheckpointStatus;
  assigned_to: string | null;
  completed_at: string | Date | null;
  completed_by: string | null;
  notes: string | null;
  last_due_soon_notified_at: string | Date | null;
  overdue_notified_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  assigned_to_name?: string;
  completed_by_name?: string;
  substance_name?: string;
  serial_number?: string | null;
}

export interface StabilityResultRow {
  id: string;
  company_id: string;
  checkpoint_id: string;
  parameter: string;
  initial_value: string | null;
  current_value: string | null;
  specification: string | null;
  result_status: StabilityResultStatus;
  recorded_by: string;
  recorded_at: string | Date;
  recorded_by_name?: string;
}

export interface StabilityStudyDto {
  id: string;
  companyId: string;
  sampleId: string;
  serialNumber: string | null;
  substanceName: string;
  sampleName: string;
  startedAt: string;
  storageConditions: string | null;
  status: StabilityStudyStatus;
  createdBy: string;
  createdByName: string | null;
  totalCheckpoints: number;
  completedCheckpoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface StabilityCheckpointDto {
  id: string;
  companyId: string;
  studyId: string;
  intervalTag: string;
  dueDate: string;
  status: StabilityCheckpointStatus;
  isDueSoon: boolean;
  assignedTo: string | null;
  assignedToName: string | null;
  completedAt: string | null;
  completedBy: string | null;
  completedByName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  results?: StabilityResultDto[];
}

export interface StabilityResultDto {
  id: string;
  companyId: string;
  checkpointId: string;
  parameter: string;
  initialValue: string | null;
  currentValue: string | null;
  specification: string | null;
  resultStatus: StabilityResultStatus;
  recordedBy: string;
  recordedByName: string | null;
  recordedAt: string;
}

export const DEFAULT_STABILITY_PARAMETERS: readonly string[] = [
  'Tavsif (Description)',
  'Assay',
  'Namlik miqdori (Water content)',
  "Qo'shimcha aralashmalar (Related substances)",
  'Eruvchanlik (Dissolution)',
];

export interface StabilityStudyDetailDto extends StabilityStudyDto {
  checkpoints: StabilityCheckpointDto[];
  parameters: Array<{
    parameter: string;
    initialValue: string | null;
    specification: string | null;
  }>;
}

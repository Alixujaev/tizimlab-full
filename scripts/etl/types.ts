export type LegacyRole =
  | 'chemist'
  | 'lab_head'
  | 'director'
  | 'kontrolyor'
  | 'admin'
  | 'super_admin';

export type LegacySampleType =
  | 'raw_material'
  | 'finished_product'
  | 'in_process'
  | 'reagent'
  | 'standard_substance'
  | 'other';

export type LegacySampleStatus =
  | 'pending_assignment'
  | 'in_progress'
  | 'stopped'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type LegacyProtocolStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'finalized';

export type LegacyProtocolRole = 'standard' | 'final' | 'in_process';

export interface LegacyCompany {
  id: string;
  name: string;
  slug: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: LegacyRole;
  is_active?: boolean;
  company_id?: string | null;
  created_by?: string | null;
  last_login_at?: string | null;
  telegram_chat_id?: number | null;
  telegram_linked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyUserPermission {
  id: string;
  user_id: string;
  resource: string;
  action: string;
  granted_by: string;
  created_at?: string;
}

export interface LegacySubstance {
  id: string;
  name_uz: string;
  name_ru?: string | null;
  name_en?: string | null;
  pharmacopoeia: 'EP' | 'BP' | 'UzDSt' | 'USP' | 'OTHER';
  cas_number?: string | null;
  description?: string | null;
  is_active?: boolean;
  created_by: string;
  company_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface LegacySubstanceParameter {
  id: string;
  substance_id: string;
  parameter_name: string;
  unit?: string | null;
  spec_min?: number | null;
  spec_max?: number | null;
  method?: string | null;
  sort_order?: number;
  created_at?: string;
}

export interface LegacySample {
  id: string;
  company_id: string;
  type: LegacySampleType;
  status: LegacySampleStatus;
  substance_id?: string | null;
  substance_name: string;
  serial_number?: string | null;
  lot_number?: string | null;
  quantity?: string | null;
  manufacturer?: string | null;
  manufactured_at?: string | null;
  expires_at?: string | null;
  deadline?: string | null;
  analysis_start?: string | null;
  analysis_end?: string | null;
  notes?: string | null;
  created_by: string;
  assigned_to?: string | null;
  assigned_by?: string | null;
  assigned_at?: string | null;
  stop_reason?: string | null;
  stopped_at?: string | null;
  passport_file_name?: string | null;
  passport_file_path?: string | null;
  passport_file_size?: number | null;
  passport_status?: 'pending' | 'approved' | 'rejected' | null;
  passport_uploaded_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyProtocol {
  id: string;
  company_id: string;
  sample_id: string | null;
  substance_id?: string | null;
  batch_number?: string | null;
  sample_source?: string | null;
  notes?: string | null;
  created_by: string;
  status: LegacyProtocolStatus;
  protocol_role?: LegacyProtocolRole | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  passport_file_name?: string | null;
  passport_file_path?: string | null;
  passport_file_size?: number | null;
  passport_file_mime?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  finalized_at?: string | null;
  rejected_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyProtocolSignature {
  id: string;
  protocol_id: string;
  user_id: string;
  role: LegacyRole;
  signature_hash: string;
  ip_address?: string | null;
  signed_at?: string;
}

export interface LegacyProtocolFile {
  id: string;
  protocol_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  file_mime?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
}

export interface LegacyFile {
  id: string;
  company_id: string;
  sample_id?: string | null;
  r2_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at?: string;
}

export interface LegacyNotification {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_id?: string | null;
  is_read?: boolean;
  created_at?: string;
}

export interface LegacyReagent {
  id: string;
  company_id: string;
  name: string;
  cas_number?: string | null;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  expires_at?: string | null;
  supplier?: string | null;
  storage_conditions?: string | null;
  is_hazardous?: boolean;
  is_active?: boolean;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyReagentTransaction {
  id: string;
  reagent_id: string;
  type: 'in' | 'out' | 'adjustment' | 'disposal';
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  notes?: string | null;
  performed_by: string;
  created_at?: string;
}

export interface LegacyReagentDocument {
  id: string;
  reagent_id: string;
  doc_type: 'passport' | 'analysis';
  file_id: string;
  created_at?: string;
}

export interface LegacySensorConfig {
  id: string;
  company_id: string;
  sensor_id: string;
  location_name: string;
  temp_min: number;
  temp_max: number;
  humidity_min?: number | null;
  humidity_max?: number | null;
  is_active?: boolean;
  api_key?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyTemperatureReading {
  id: string;
  sensor_id: string;
  temperature: number;
  humidity?: number | null;
  alert_triggered?: boolean;
  recorded_at?: string;
  is_manual?: boolean;
  recorded_by?: string | null;
}

export interface LegacyTemperatureAlert {
  id: string;
  sensor_id: string;
  reading_id?: string;
  temperature: number;
  alert_type: string;
  notified_at?: string | null;
  created_at?: string;
}

export interface LegacyTelegramLinkToken {
  id: string;
  user_id: string;
  token?: string;
  token_hash?: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
}

export interface LegacyStabilityStudy {
  id: string;
  company_id: string;
  sample_id: string;
  study_type?: string;
  storage_condition?: string;
  storage_conditions?: string;
  start_date?: string;
  started_at?: string;
  status: string; // 'active' | 'completed' | 'cancelled'
  notes?: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyStabilityCheckpoint {
  id: string;
  study_id: string;
  interval_months?: number;
  interval_tag?: string;
  planned_date?: string;
  due_date?: string;
  status: string;
  actual_date?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyStabilityResult {
  id: string;
  checkpoint_id: string;
  parameter?: string;
  parameter_name?: string;
  specification?: string | null;
  initial_value?: string | null;
  current_value?: string | null;
  result_status?: 'pass' | 'fail' | 'warning' | null;
  recorded_by?: string | null;
  recorded_at?: string | null;
  tested_by?: string | null;
  tested_at?: string | null;
  created_at?: string;
}

export interface LegacyDataset {
  companies?: LegacyCompany[];
  users?: LegacyUser[];
  user_permissions?: LegacyUserPermission[];
  substances?: LegacySubstance[];
  substance_parameters?: LegacySubstanceParameter[];
  samples?: LegacySample[];
  protocols?: LegacyProtocol[];
  protocol_signatures?: LegacyProtocolSignature[];
  protocol_files?: LegacyProtocolFile[];
  files?: LegacyFile[];
  notifications?: LegacyNotification[];
  reagents?: LegacyReagent[];
  reagent_transactions?: LegacyReagentTransaction[];
  reagent_documents?: LegacyReagentDocument[];
  sensor_configs?: LegacySensorConfig[];
  temperature_readings?: LegacyTemperatureReading[];
  temperature_alerts?: LegacyTemperatureAlert[];
  stability_studies?: LegacyStabilityStudy[];
  stability_checkpoints?: LegacyStabilityCheckpoint[];
  stability_results?: LegacyStabilityResult[];
  telegram_link_tokens?: LegacyTelegramLinkToken[];
  sample_documents?: unknown[];
  protocol_values?: unknown[];
  audit_logs?: unknown[];
  sessions?: unknown[];
}

export interface UserSetupInfo {
  userId: string;
  email: string;
  temporaryPassword: string;
  setupToken: string;
  setupTokenHash: string;
}

export interface ETLValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    companiesCount: number;
    usersCount: number;
    samplesCount: number;
    protocolsCount: number;
    substancesCount: number;
    reagentsCount: number;
    stabilityStudiesCount: number;
    sensorConfigsCount: number;
  };
}

export interface ETLReport {
  mode: 'dry-run' | 'apply';
  success: boolean;
  counts: {
    companies: number;
    users: number;
    user_permissions: number;
    substances: number;
    substance_parameters: number;
    samples: number;
    sample_tracking: number;
    protocols: number;
    protocol_signatures: number;
    files: number;
    notifications: number;
    reagents: number;
    reagent_transactions: number;
    sensor_configs: number;
    temperature_readings: number;
    temperature_alerts: number;
    stability_studies: number;
    stability_checkpoints: number;
    stability_results: number;
    telegram_link_tokens: number;
  };
  userSetupCredentials: UserSetupInfo[];
  problematicRows: Array<{ entity: string; id: string; reason: string }>;
  warnings: string[];
  errors: string[];
}


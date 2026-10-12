import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type {
  LegacyDataset,
  UserSetupInfo,
} from './types.js';

export interface MappedDataset {
  companies: Array<{
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  users: Array<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
    is_active: boolean;
    company_id: string | null;
    created_by: string | null;
    last_login_at: string | null;
    telegram_chat_id: number | null;
    telegram_linked_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  user_permissions: Array<{
    id: string;
    user_id: string;
    resource: string;
    action: string;
    granted_by: string;
    company_id: string;
    created_at: string;
  }>;
  substances: Array<{
    id: string;
    name_uz: string;
    name_ru: string | null;
    name_en: string | null;
    pharmacopoeia: string;
    cas_number: string | null;
    description: string | null;
    is_active: boolean;
    created_by: string;
    company_id: string;
    created_at: string;
    updated_at: string;
  }>;
  substance_parameters: Array<{
    id: string;
    substance_id: string;
    parameter_name: string;
    unit: string | null;
    spec_min: number | null;
    spec_max: number | null;
    method: string | null;
    sort_order: number;
    company_id: string;
    created_at: string;
  }>;
  samples: Array<{
    id: string;
    company_id: string;
    type: string;
    status: string;
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
    assigned_by: string | null;
    assigned_at: string | null;
    stop_reason: string | null;
    stopped_at: string | null;
    passport_file_name: string | null;
    passport_file_path: string | null;
    passport_file_size: number | null;
    passport_status: string | null;
    passport_uploaded_by: string | null;
    deleted_at: null;
    created_at: string;
    updated_at: string;
  }>;
  sample_tracking: Array<{
    id: string;
    company_id: string;
    sample_id: string;
    event_type: string;
    user_id: string | null;
    from_status: string | null;
    to_status: string | null;
    reason: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  protocols: Array<{
    id: string;
    company_id: string;
    sample_id: string;
    created_by: string;
    status: string;
    protocol_role: string;
    file_path: string | null;
    file_name: string | null;
    file_size: number | null;
    file_mime: string | null;
    passport_file_name: string | null;
    passport_file_path: string | null;
    passport_file_size: number | null;
    passport_file_mime: string | null;
    passport_uploaded_by: string | null;
    passport_uploaded_at: string | null;
    rejection_reason: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    finalized_at: string | null;
    rejected_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  protocol_signatures: Array<{
    id: string;
    company_id: string;
    protocol_id: string;
    user_id: string;
    role: string;
    action: string;
    signature_hash: string;
    ip_address: string | null;
    signed_at: string;
  }>;
  files: Array<{
    id: string;
    company_id: string;
    sample_id: string | null;
    r2_key: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    uploaded_by: string;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    company_id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    reference_id: string | null;
    is_read: boolean;
    created_at: string;
  }>;
  reagents: Array<{
    id: string;
    company_id: string;
    name: string;
    cas_number: string | null;
    unit: string;
    quantity: number;
    low_stock_threshold: number;
    expires_at: string | null;
    supplier: string | null;
    storage_conditions: string | null;
    is_hazardous: boolean;
    created_at: string;
    updated_at: string;
  }>;
  reagent_transactions: Array<{
    id: string;
    company_id: string;
    reagent_id: string;
    user_id: string;
    type: string;
    quantity: number;
    quantity_before: number;
    quantity_after: number;
    note: string | null;
    recorded_date: string;
    created_at: string;
  }>;
  sensor_configs: Array<{
    id: string;
    company_id: string;
    sensor_id: string;
    location_name: string;
    temp_min: number;
    temp_max: number;
    humidity_min: number | null;
    humidity_max: number | null;
    is_active: boolean;
    api_key: string | null;
    created_at: string;
    updated_at: string;
  }>;
  temperature_readings: Array<{
    id: string;
    company_id: string;
    sensor_config_id: string;
    temperature: number;
    humidity: number | null;
    alert_triggered: boolean;
    recorded_at: string;
    is_manual: boolean;
    recorded_by: string | null;
  }>;
  temperature_alerts: Array<{
    id: string;
    company_id: string;
    sensor_config_id: string;
    reading_id: string;
    temperature: number;
    alert_type: string;
    notified_at: string | null;
    created_at: string;
  }>;
  stability_studies: Array<{
    id: string;
    company_id: string;
    sample_id: string;
    started_at: string;
    storage_conditions: string;
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
  stability_checkpoints: Array<{
    id: string;
    company_id: string;
    study_id: string;
    interval_tag: string;
    due_date: string;
    status: string;
    assigned_to: string | null;
    completed_at: string | null;
    completed_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>;
  stability_results: Array<{
    id: string;
    company_id: string;
    checkpoint_id: string;
    parameter: string;
    specification: string | null;
    initial_value: string | null;
    current_value: string | null;
    result_status: 'pass' | 'fail' | 'warning';
    recorded_by: string;
    recorded_at: string;
  }>;
  telegram_link_tokens: Array<{
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    used_at: string | null;
    created_at: string;
  }>;
  userSetupCredentials: UserSetupInfo[];
  problematicRows: Array<{ entity: string; id: string; reason: string }>;
}

/**
 * SCHEMA_DIFF va baseline talablariga muvofiq eski sxemadagi ma'lumotlarni
 * yangi sxemaga o'girish.
 */
export function mapLegacyDataset(
  dataset: LegacyDataset,
  options: {
    copyLegacyPasswords?: boolean;
    breakCompanyIdMapping?: boolean;
    breakTargetTableName?: boolean;
  } = {},
): MappedDataset {
  const now = () => new Date().toISOString();
  const problematicRows: Array<{ entity: string; id: string; reason: string }> = [];

  // =========================================================================
  // 1. Companies
  // =========================================================================
  const companies = (dataset.companies || []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    is_active: c.is_active ?? true,
    created_at: c.created_at || now(),
    updated_at: c.updated_at || now(),
  }));

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  // =========================================================================
  // 2. Users (D-82, D-151: eski parollar ko'chirilmasin, yangi xavfsiz vaqtinchalik parol)
  // =========================================================================
  const userSetupCredentials: UserSetupInfo[] = [];
  const users = (dataset.users || []).map((u) => {
    // Parol xavfsizligi: eski xesh mutlaqo ko'chirilmaydi (agar mutatsiya testi bilan majburlanmagan bo'lsa)
    let passwordHash: string;
    let tempPassword = '';
    const setupToken = `tok_${randomUUID()}`;
    const setupTokenHash = createHash('sha256').update(setupToken).digest('hex');

    if (options.copyLegacyPasswords) {
      // Mutatsiya (c) uchun buzg'unchi holat
      passwordHash = u.password_hash;
    } else {
      // Standart xavfsiz holat: yangi 10-round bcrypt xesh va vaqtinchalik parol
      tempPassword = `Temp_${randomBytes(4).toString('hex')}1A`;
      passwordHash = bcrypt.hashSync(tempPassword, 10);
    }

    userSetupCredentials.push({
      userId: u.id,
      email: u.email.trim().toLowerCase(),
      temporaryPassword: tempPassword,
      setupToken,
      setupTokenHash,
    });

    const isSuperAdmin = u.role === 'super_admin';
    const companyId = isSuperAdmin ? null : (u.company_id ?? null);

    return {
      id: u.id,
      email: u.email.trim().toLowerCase(),
      password_hash: passwordHash,
      full_name: u.full_name,
      role: u.role,
      is_active: u.is_active ?? true,
      company_id: companyId,
      created_by: u.created_by ?? null,
      last_login_at: u.last_login_at ?? null,
      telegram_chat_id: u.telegram_chat_id ?? null,
      telegram_linked_at: u.telegram_linked_at ?? null,
      created_at: u.created_at || now(),
      updated_at: u.updated_at || now(),
    };
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // =========================================================================
  // 3. User Permissions (company_id qo'shiladi)
  // =========================================================================
  const user_permissions = (dataset.user_permissions || []).map((up) => {
    const parentUser = userMap.get(up.user_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (parentUser?.company_id ?? companies[0]?.id ?? '');

    return {
      id: up.id,
      user_id: up.user_id,
      resource: up.resource,
      action: up.action,
      granted_by: up.granted_by,
      company_id: companyId,
      created_at: up.created_at || now(),
    };
  });

  // =========================================================================
  // 4. Substances & Parameters (company_id qo'shiladi)
  // =========================================================================
  const substances = (dataset.substances || []).map((s) => ({
    id: s.id,
    name_uz: s.name_uz,
    name_ru: s.name_ru ?? null,
    name_en: s.name_en ?? null,
    pharmacopoeia: s.pharmacopoeia,
    cas_number: s.cas_number ?? null,
    description: s.description ?? null,
    is_active: s.is_active ?? true,
    created_by: s.created_by,
    company_id: options.breakCompanyIdMapping ? randomUUID() : s.company_id,
    created_at: s.created_at || now(),
    updated_at: s.updated_at || now(),
  }));

  const substanceMap = new Map(substances.map((s) => [s.id, s]));

  const substance_parameters = (dataset.substance_parameters || []).map((sp) => {
    const sub = substanceMap.get(sp.substance_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (sub?.company_id ?? companies[0]?.id ?? '');

    return {
      id: sp.id,
      substance_id: sp.substance_id,
      parameter_name: sp.parameter_name,
      unit: sp.unit ?? null,
      spec_min: sp.spec_min ?? null,
      spec_max: sp.spec_max ?? null,
      method: sp.method ?? null,
      sort_order: sp.sort_order ?? 0,
      company_id: companyId,
      created_at: sp.created_at || now(),
    };
  });

  // =========================================================================
  // 5. Samples & Synthetic Sample Tracking (D-63, D-71)
  // =========================================================================
  const sample_tracking: MappedDataset['sample_tracking'] = [];

  const samples = (dataset.samples || []).map((s) => {
    // D-71: expires_at va deadline yangi sxemada yo'q, tracking voqeasiga yoziladi
    const hasLegacyDates = Boolean(s.expires_at || s.deadline);
    if (hasLegacyDates) {
      problematicRows.push({
        entity: 'samples',
        id: s.id,
        reason: `D-71 bo'yicha expires_at (${s.expires_at || 'NULL'}) va deadline (${s.deadline || 'NULL'}) tracking izohiga o'tkazildi`,
      });
    }

    const trackingEventType =
      s.status === 'pending_assignment'
        ? 'sample_created'
        : s.status === 'in_progress'
          ? 'assigned'
          : s.status === 'approved'
            ? 'approved'
            : s.status === 'rejected'
              ? 'rejected'
              : s.status === 'stopped'
                ? 'stopped'
                : 'submitted';

    const trackingReason = hasLegacyDates
      ? `legacy'dan ko'chirildi; expires_at: ${s.expires_at ?? '-'}; deadline: ${s.deadline ?? '-'}`
      : "legacy'dan ko'chirildi";

    // D-63 sintetik tracking yozuvi
    sample_tracking.push({
      id: randomUUID(),
      company_id: options.breakCompanyIdMapping ? randomUUID() : s.company_id,
      sample_id: s.id,
      event_type: trackingEventType,
      user_id: s.created_by,
      from_status: null,
      to_status: s.status,
      reason: trackingReason,
      metadata: {
        legacy_import: true,
        ...(s.expires_at ? { legacy_expires_at: s.expires_at } : {}),
        ...(s.deadline ? { legacy_deadline: s.deadline } : {}),
      },
      created_at: s.created_at || now(),
    });

    return {
      id: s.id,
      company_id: options.breakCompanyIdMapping ? randomUUID() : s.company_id,
      type: s.type,
      status: s.status,
      substance_id: s.substance_id ?? null,
      substance_name: s.substance_name,
      serial_number: s.serial_number ?? null,
      lot_number: s.lot_number ?? null,
      quantity: s.quantity ?? null,
      manufacturer: s.manufacturer ?? null,
      manufactured_at: s.manufactured_at ?? null,
      analysis_start: s.analysis_start ?? null,
      analysis_end: s.analysis_end ?? null,
      notes: s.notes ?? null,
      created_by: s.created_by,
      assigned_to: s.assigned_to ?? null,
      assigned_by: s.assigned_by ?? null,
      assigned_at: s.assigned_at ?? null,
      stop_reason: s.stop_reason ?? null,
      stopped_at: s.stopped_at ?? null,
      passport_file_name: s.passport_file_name ?? null,
      passport_file_path: s.passport_file_path ?? null,
      passport_file_size: s.passport_file_size ?? null,
      passport_status: s.passport_status ?? null,
      passport_uploaded_by: s.passport_uploaded_by ?? null,
      deleted_at: null,
      created_at: s.created_at || now(),
      updated_at: s.updated_at || now(),
    };
  });

  // =========================================================================
  // 6. Protocols & Signatures (D-63, D-74)
  // =========================================================================
  const protocols = (dataset.protocols || []).map((p) => {
    const role = p.protocol_role || 'standard';

    // D-63 sintetik tracking yozuvi har bir protokol uchun
    if (p.sample_id) {
      const protoEventType =
        p.status === 'submitted'
          ? 'submitted'
          : p.status === 'approved'
            ? 'approved'
            : p.status === 'rejected'
              ? 'rejected'
              : 'sample_created';

      sample_tracking.push({
        id: randomUUID(),
        company_id: options.breakCompanyIdMapping ? randomUUID() : p.company_id,
        sample_id: p.sample_id,
        event_type: protoEventType,
        user_id: p.created_by,
        from_status: null,
        to_status: null,
        reason: `legacy'dan ko'chirildi (protokol: ${p.status})`,
        metadata: {
          legacy_import: true,
          protocol_id: p.id,
          protocol_role: role,
          protocol_status: p.status,
        },
        created_at: p.created_at || now(),
      });
    }

    return {
      id: p.id,
      company_id: options.breakCompanyIdMapping ? randomUUID() : p.company_id,
      sample_id: p.sample_id as string,
      created_by: p.created_by,
      status: p.status,
      protocol_role: role,
      file_path: p.file_path ?? null,
      file_name: p.file_name ?? null,
      file_size: p.file_size ?? null,
      file_mime: p.file_mime ?? null,
      passport_file_name: p.passport_file_name ?? null,
      passport_file_path: p.passport_file_path ?? null,
      passport_file_size: p.passport_file_size ?? null,
      passport_file_mime: p.passport_file_mime ?? null,
      passport_uploaded_by: null,
      passport_uploaded_at: null,
      rejection_reason: p.rejection_reason ?? null,
      submitted_at: p.submitted_at ?? null,
      approved_at: p.approved_at ?? null,
      finalized_at: p.finalized_at ?? null,
      rejected_at: p.rejected_at ?? null,
      created_at: p.created_at || now(),
      updated_at: p.updated_at || now(),
    };
  });

  const protocolMap = new Map(protocols.map((p) => [p.id, p]));

  const protocol_signatures = (dataset.protocol_signatures || []).map((ps) => {
    const proto = protocolMap.get(ps.protocol_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (proto?.company_id ?? companies[0]?.id ?? '');

    const action =
      ps.role === 'chemist'
        ? 'submitted'
        : ps.role === 'lab_head'
          ? 'approved'
          : ps.role === 'director'
            ? 'finalized'
            : 'submitted';

    return {
      id: ps.id,
      company_id: companyId,
      protocol_id: ps.protocol_id,
      user_id: ps.user_id,
      role: ps.role,
      action,
      signature_hash: ps.signature_hash,
      ip_address: ps.ip_address ?? null,
      signed_at: ps.signed_at || now(),
    };
  });

  // =========================================================================
  // 7. Files & Notifications
  // =========================================================================
  const files = (dataset.files || []).map((f) => ({
    id: f.id,
    company_id: options.breakCompanyIdMapping ? randomUUID() : f.company_id,
    sample_id: f.sample_id ?? null,
    r2_key: f.r2_key,
    filename: f.filename,
    mime_type: f.mime_type,
    size_bytes: f.size_bytes,
    uploaded_by: f.uploaded_by,
    created_at: f.created_at || now(),
  }));

  const notifications = (dataset.notifications || []).map((n) => ({
    id: n.id,
    company_id: options.breakCompanyIdMapping ? randomUUID() : n.company_id,
    user_id: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    reference_id: n.reference_id ?? null,
    is_read: n.is_read ?? false,
    created_at: n.created_at || now(),
  }));

  // =========================================================================
  // 8. Reagents & Transactions (company_id qo'shiladi)
  // =========================================================================
  const reagents = (dataset.reagents || []).map((r) => ({
    id: r.id,
    company_id: options.breakCompanyIdMapping ? randomUUID() : r.company_id,
    name: r.name,
    cas_number: r.cas_number ?? null,
    unit: r.unit,
    quantity: r.quantity,
    low_stock_threshold: r.low_stock_threshold,
    expires_at: r.expires_at ?? null,
    supplier: r.supplier ?? null,
    storage_conditions: r.storage_conditions ?? null,
    is_hazardous: r.is_hazardous ?? false,
    created_at: r.created_at || now(),
    updated_at: r.updated_at || now(),
  }));

  const reagentMap = new Map(reagents.map((r) => [r.id, r]));

  const reagent_transactions = (dataset.reagent_transactions || []).map((rt) => {
    const reag = reagentMap.get(rt.reagent_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (reag?.company_id ?? companies[0]?.id ?? '');

    return {
      id: rt.id,
      company_id: companyId,
      reagent_id: rt.reagent_id,
      user_id: rt.performed_by,
      type: rt.type,
      quantity: rt.quantity,
      quantity_before: rt.quantity_before,
      quantity_after: rt.quantity_after,
      note: rt.notes ?? null,
      recorded_date: rt.created_at ? rt.created_at.slice(0, 10) : now().slice(0, 10),
      created_at: rt.created_at || now(),
    };
  });

  // =========================================================================
  // 9. Sensor Configs & Readings (D-78: sensor_config_id FK)
  // =========================================================================
  const sensor_configs = (dataset.sensor_configs || []).map((sc) => {
    let apiKey = sc.api_key ?? null;
    if (apiKey && apiKey.length !== 64) {
      apiKey = createHash('sha256').update(apiKey).digest('hex');
    }

    return {
      id: sc.id,
      company_id: options.breakCompanyIdMapping ? randomUUID() : sc.company_id,
      sensor_id: sc.sensor_id,
      location_name: sc.location_name,
      temp_min: sc.temp_min,
      temp_max: sc.temp_max,
      humidity_min: sc.humidity_min ?? null,
      humidity_max: sc.humidity_max ?? null,
      is_active: sc.is_active ?? true,
      api_key: apiKey,
      created_at: sc.created_at || now(),
      updated_at: sc.updated_at || now(),
    };
  });

  const sensorConfigBySensorId = new Map(sensor_configs.map((sc) => [sc.sensor_id, sc]));

  const temperature_readings = (dataset.temperature_readings || []).map((tr) => {
    const sc = sensorConfigBySensorId.get(tr.sensor_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (sc?.company_id ?? companies[0]?.id ?? '');

    return {
      id: tr.id,
      company_id: companyId,
      sensor_config_id: sc?.id ?? randomUUID(),
      temperature: tr.temperature,
      humidity: tr.humidity ?? null,
      alert_triggered: tr.alert_triggered ?? false,
      recorded_at: tr.recorded_at || now(),
      is_manual: tr.is_manual ?? false,
      recorded_by: tr.recorded_by ?? null,
    };
  });

  const readingMap = new Map(temperature_readings.map((r) => [r.id, r]));

  const temperature_alerts = (dataset.temperature_alerts || []).map((ta) => {
    const sc = sensorConfigBySensorId.get(ta.sensor_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (sc?.company_id ?? companies[0]?.id ?? '');

    // D-78: reading_id references temperature_readings(id)
    const readingId =
      (ta.reading_id && readingMap.has(ta.reading_id) ? ta.reading_id : null) ||
      temperature_readings.find((r) => r.sensor_config_id === sc?.id)?.id ||
      temperature_readings[0]?.id ||
      randomUUID();

    return {
      id: ta.id,
      company_id: companyId,
      sensor_config_id: sc?.id ?? randomUUID(),
      reading_id: readingId,
      temperature: ta.temperature,
      alert_type: ta.alert_type,
      notified_at: ta.notified_at ?? null,
      created_at: ta.created_at || now(),
    };
  });

  // =========================================================================
  // 10. Stability Studies, Checkpoints, Results (company_id qo'shiladi)
  // =========================================================================
  const stability_studies = (dataset.stability_studies || []).map((ss) => ({
    id: ss.id,
    company_id: options.breakCompanyIdMapping ? randomUUID() : ss.company_id,
    sample_id: ss.sample_id,
    started_at: ss.started_at
      ? ss.started_at.slice(0, 10)
      : ss.start_date
        ? ss.start_date.slice(0, 10)
        : now().slice(0, 10),
    storage_conditions: ss.storage_conditions || ss.storage_condition || '25°C / 60% RH',
    status: ss.status,
    created_by: ss.created_by,
    created_at: ss.created_at || now(),
    updated_at: ss.updated_at || now(),
  }));

  const studyMap = new Map(stability_studies.map((ss) => [ss.id, ss]));

  const stability_checkpoints = (dataset.stability_checkpoints || []).map((cp) => {
    const st = studyMap.get(cp.study_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (st?.company_id ?? companies[0]?.id ?? '');

    return {
      id: cp.id,
      company_id: companyId,
      study_id: cp.study_id,
      interval_tag: cp.interval_tag || (cp.interval_months !== undefined ? `M${cp.interval_months}` : 'M0'),
      due_date: cp.due_date
        ? cp.due_date.slice(0, 10)
        : cp.planned_date
          ? cp.planned_date.slice(0, 10)
          : now().slice(0, 10),
      status: cp.status,
      assigned_to: cp.assigned_to ?? null,
      completed_at: cp.completed_at || cp.actual_date || null,
      completed_by: cp.completed_by ?? null,
      notes: cp.notes ?? null,
      created_at: cp.created_at || now(),
      updated_at: cp.updated_at || now(),
    };
  });

  const checkpointMap = new Map(stability_checkpoints.map((cp) => [cp.id, cp]));

  const stability_results = (dataset.stability_results || []).map((sr) => {
    const cp = checkpointMap.get(sr.checkpoint_id);
    const companyId = options.breakCompanyIdMapping
      ? randomUUID()
      : (cp?.company_id ?? companies[0]?.id ?? '');

    const parameter = sr.parameter || sr.parameter_name || 'Standart parametr';
    const resultStatus = (sr.result_status || 'pass') as 'pass' | 'fail' | 'warning';
    const recordedBy = sr.recorded_by || sr.tested_by || users[0]?.id || '';
    const recordedAt = sr.recorded_at || sr.tested_at || sr.created_at || now();

    return {
      id: sr.id,
      company_id: companyId,
      checkpoint_id: sr.checkpoint_id,
      parameter,
      specification: sr.specification ?? null,
      initial_value: sr.initial_value ?? null,
      current_value: sr.current_value ?? null,
      result_status: resultStatus,
      recorded_by: recordedBy,
      recorded_at: recordedAt,
    };
  });

  // =========================================================================
  // 11. Telegram Link Tokens (D-65: bazada faqat sha256 xesh)
  // =========================================================================
  const telegram_link_tokens = (dataset.telegram_link_tokens || []).map((t) => {
    let tokenHash = t.token_hash || '';
    if (!tokenHash && t.token) {
      tokenHash = t.token.length === 64 ? t.token : createHash('sha256').update(t.token).digest('hex');
    }
    if (!tokenHash) {
      tokenHash = createHash('sha256').update(`link_${randomUUID()}`).digest('hex');
    }

    return {
      id: t.id,
      user_id: t.user_id,
      token_hash: tokenHash,
      expires_at: t.expires_at || new Date(Date.now() + 86400000).toISOString(),
      used_at: t.used_at ?? null,
      created_at: t.created_at || now(),
    };
  });

  // Tekshiruv: agar company_id xaritalashida xatolik bo'lsa
  for (const u of users) {
    if (u.company_id && !companyMap.has(u.company_id)) {
      problematicRows.push({
        entity: 'users',
        id: u.id,
        reason: `Kompaniya topilmadi: ${u.company_id}`,
      });
    }
  }

  return {
    companies,
    users,
    user_permissions,
    substances,
    substance_parameters,
    samples,
    sample_tracking,
    protocols,
    protocol_signatures,
    files,
    notifications,
    reagents,
    reagent_transactions,
    sensor_configs,
    temperature_readings,
    temperature_alerts,
    stability_studies,
    stability_checkpoints,
    stability_results,
    telegram_link_tokens,
    userSetupCredentials,
    problematicRows,
  };
}

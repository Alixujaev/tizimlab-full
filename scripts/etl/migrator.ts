import { createHash } from 'node:crypto';
import type pg from 'pg';
import { mapLegacyDataset } from './mapper.js';
import type { ETLReport, LegacyDataset } from './types.js';
import { validateLegacyDataset } from './validator.js';

export interface ETLOptions {
  dryRun?: boolean;
  pool?: pg.Pool;
  client?: pg.PoolClient;
  breakIdempotency?: boolean;
  breakRollback?: boolean;
  copyLegacyPasswords?: boolean;
  breakCompanyIdMapping?: boolean;
  throwInTransaction?: boolean;
}

/**
 * Deterministik UUID generator (takroriy ishga tushirishlarda bir xil ID hosil qilish uchun).
 */
export function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    '8' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

/**
 * Legacy ma'lumotlarni yangi sxemaga ko'chirish funksiyasi.
 */
export async function runETL(
  dataset: LegacyDataset,
  options: ETLOptions = {},
): Promise<ETLReport> {
  const dryRun = options.dryRun !== false;

  // 1. D-82 Pre-flight xavfsizlik tekshiruvlari
  const validation = validateLegacyDataset(dataset);
  if (!validation.valid) {
    throw new Error(
      `ETL tekshiruvi muvaffaqiyatsiz yakunlandi:\n${validation.errors.join('\n')}`,
    );
  }

  // 2. Ma'lumotlarni yangi sxemaga xaritalash
  const mapped = mapLegacyDataset(dataset, {
    copyLegacyPasswords: options.copyLegacyPasswords,
    breakCompanyIdMapping: options.breakCompanyIdMapping,
  });

  // Tracking ID larini deterministik qilish (idempotentlik uchun)
  for (const t of mapped.sample_tracking) {
    if (!options.breakIdempotency) {
      const isProto = t.metadata?.protocol_id;
      const seed = isProto
        ? `tracking_proto_${t.metadata.protocol_id}_${t.event_type}`
        : `tracking_sample_${t.sample_id}_${t.event_type}`;
      t.id = deterministicUuid(seed);
    }
  }

  const counts: ETLReport['counts'] = {
    companies: mapped.companies.length,
    users: mapped.users.length,
    user_permissions: mapped.user_permissions.length,
    substances: mapped.substances.length,
    substance_parameters: mapped.substance_parameters.length,
    samples: mapped.samples.length,
    sample_tracking: mapped.sample_tracking.length,
    protocols: mapped.protocols.length,
    protocol_signatures: mapped.protocol_signatures.length,
    files: mapped.files.length,
    notifications: mapped.notifications.length,
    reagents: mapped.reagents.length,
    reagent_transactions: mapped.reagent_transactions.length,
    sensor_configs: mapped.sensor_configs.length,
    temperature_readings: mapped.temperature_readings.length,
    temperature_alerts: mapped.temperature_alerts.length,
    stability_studies: mapped.stability_studies.length,
    stability_checkpoints: mapped.stability_checkpoints.length,
    stability_results: mapped.stability_results.length,
  };

  // DRY-RUN REJIMI: Bazaga hech narsa yozilmaydi, hisobot qaytariladi
  if (dryRun || !options.pool) {
    return {
      mode: 'dry-run',
      success: true,
      counts,
      userSetupCredentials: mapped.userSetupCredentials,
      problematicRows: mapped.problematicRows,
      warnings: validation.warnings,
      errors: [],
    };
  }

  // APPLY REJIMI: Tranzaksiya ichida bazaga yozish va xatoda to'liq rollback
  const client = options.client || (await options.pool.connect());
  const shouldRelease = !options.client;

  try {
    await client.query('BEGIN');

    // Mutatsiya (b) va rollback testlari uchun simulyatsiya
    if (options.throwInTransaction) {
      await client.query(
        "INSERT INTO companies (id, name, slug) VALUES ('c1000000-0000-4000-8000-000000000001', 'Partial Lab', 'partial-lab')",
      );
      throw new Error('Simulyatsiya qilingan tranzaksiya xatosi (rollback testi)');
    }

    const conflictClause = (table: string, onConflict: string) => {
      if (options.breakIdempotency) {
        // Mutatsiya (a): Idempotentlikni buzish (ON CONFLICT ishlatilmasin)
        return '';
      }
      return onConflict;
    };

    // 1. Companies
    for (const c of mapped.companies) {
      const sql = `
        INSERT INTO companies (id, name, slug, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ${conflictClause(
          'companies',
          'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [c.id, c.name, c.slug, c.is_active, c.created_at, c.updated_at]);
    }

    // 2. Users (Eski parol xeshi hech qachon yozilmasin!)
    for (const u of mapped.users) {
      const sql = `
        INSERT INTO users (id, email, password_hash, full_name, role, is_active, company_id, created_by, last_login_at, telegram_chat_id, telegram_linked_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ${conflictClause(
          'users',
          'ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_active = EXCLUDED.is_active, company_id = EXCLUDED.company_id, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        u.id,
        u.email,
        u.password_hash,
        u.full_name,
        u.role,
        u.is_active,
        u.company_id,
        u.created_by,
        u.last_login_at,
        u.telegram_chat_id,
        u.telegram_linked_at,
        u.created_at,
        u.updated_at,
      ]);
    }

    // 3. User Permissions
    for (const up of mapped.user_permissions) {
      const sql = `
        INSERT INTO user_permissions (id, user_id, resource, action, granted_by, company_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ${conflictClause(
          'user_permissions',
          'ON CONFLICT (user_id, resource, action) DO NOTHING',
        )}
      `;
      await client.query(sql, [
        up.id,
        up.user_id,
        up.resource,
        up.action,
        up.granted_by,
        up.company_id,
        up.created_at,
      ]);
    }

    // 4. Substances
    for (const s of mapped.substances) {
      const sql = `
        INSERT INTO substances (id, name_uz, name_ru, name_en, pharmacopoeia, cas_number, description, is_active, created_by, company_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ${conflictClause(
          'substances',
          'ON CONFLICT (id) DO UPDATE SET name_uz = EXCLUDED.name_uz, pharmacopoeia = EXCLUDED.pharmacopoeia, is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        s.id,
        s.name_uz,
        s.name_ru,
        s.name_en,
        s.pharmacopoeia,
        s.cas_number,
        s.description,
        s.is_active,
        s.created_by,
        s.company_id,
        s.created_at,
        s.updated_at,
      ]);
    }

    // 5. Substance Parameters
    for (const sp of mapped.substance_parameters) {
      const sql = `
        INSERT INTO substance_parameters (id, substance_id, parameter_name, unit, spec_min, spec_max, method, sort_order, company_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ${conflictClause(
          'substance_parameters',
          'ON CONFLICT (id) DO UPDATE SET parameter_name = EXCLUDED.parameter_name, method = EXCLUDED.method',
        )}
      `;
      await client.query(sql, [
        sp.id,
        sp.substance_id,
        sp.parameter_name,
        sp.unit,
        sp.spec_min,
        sp.spec_max,
        sp.method,
        sp.sort_order,
        sp.company_id,
        sp.created_at,
      ]);
    }

    // 6. Samples
    for (const sm of mapped.samples) {
      const sql = `
        INSERT INTO samples (id, company_id, type, status, substance_id, substance_name, serial_number, lot_number, quantity, manufacturer, manufactured_at, analysis_start, analysis_end, notes, created_by, assigned_to, assigned_by, assigned_at, stop_reason, stopped_at, passport_file_name, passport_file_path, passport_file_size, passport_status, passport_uploaded_by, deleted_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        ${conflictClause(
          'samples',
          'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, substance_name = EXCLUDED.substance_name, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        sm.id,
        sm.company_id,
        sm.type,
        sm.status,
        sm.substance_id,
        sm.substance_name,
        sm.serial_number,
        sm.lot_number,
        sm.quantity,
        sm.manufacturer,
        sm.manufactured_at,
        sm.analysis_start,
        sm.analysis_end,
        sm.notes,
        sm.created_by,
        sm.assigned_to,
        sm.assigned_by,
        sm.assigned_at,
        sm.stop_reason,
        sm.stopped_at,
        sm.passport_file_name,
        sm.passport_file_path,
        sm.passport_file_size,
        sm.passport_status,
        sm.passport_uploaded_by,
        sm.deleted_at,
        sm.created_at,
        sm.updated_at,
      ]);
    }

    // 7. Sample Tracking (D-63 sintetik tracking voqealari)
    for (const st of mapped.sample_tracking) {
      const sql = `
        INSERT INTO sample_tracking (id, company_id, sample_id, event_type, user_id, from_status, to_status, reason, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ${conflictClause('sample_tracking', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        st.id,
        st.company_id,
        st.sample_id,
        st.event_type,
        st.user_id,
        st.from_status,
        st.to_status,
        st.reason,
        JSON.stringify(st.metadata),
        st.created_at,
      ]);
    }

    // 8. Protocols
    for (const p of mapped.protocols) {
      const sql = `
        INSERT INTO protocols (id, company_id, sample_id, created_by, status, protocol_role, file_path, file_name, file_size, file_mime, passport_file_name, passport_file_path, passport_file_size, passport_file_mime, passport_uploaded_by, passport_uploaded_at, rejection_reason, submitted_at, approved_at, finalized_at, rejected_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ${conflictClause(
          'protocols',
          'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        p.id,
        p.company_id,
        p.sample_id,
        p.created_by,
        p.status,
        p.protocol_role,
        p.file_path,
        p.file_name,
        p.file_size,
        p.file_mime,
        p.passport_file_name,
        p.passport_file_path,
        p.passport_file_size,
        p.passport_file_mime,
        p.passport_uploaded_by,
        p.passport_uploaded_at,
        p.rejection_reason,
        p.submitted_at,
        p.approved_at,
        p.finalized_at,
        p.rejected_at,
        p.created_at,
        p.updated_at,
      ]);
    }

    // 9. Protocol Signatures
    for (const ps of mapped.protocol_signatures) {
      const sql = `
        INSERT INTO protocol_signatures (id, company_id, protocol_id, user_id, role, action, signature_hash, ip_address, signed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ${conflictClause('protocol_signatures', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        ps.id,
        ps.company_id,
        ps.protocol_id,
        ps.user_id,
        ps.role,
        ps.action,
        ps.signature_hash,
        ps.ip_address,
        ps.signed_at,
      ]);
    }

    // 10. Files
    for (const f of mapped.files) {
      const sql = `
        INSERT INTO files (id, company_id, sample_id, r2_key, filename, mime_type, size_bytes, uploaded_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ${conflictClause('files', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        f.id,
        f.company_id,
        f.sample_id,
        f.r2_key,
        f.filename,
        f.mime_type,
        f.size_bytes,
        f.uploaded_by,
        f.created_at,
      ]);
    }

    // 11. Notifications
    for (const n of mapped.notifications) {
      const sql = `
        INSERT INTO notifications (id, company_id, user_id, type, title, message, reference_id, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ${conflictClause('notifications', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        n.id,
        n.company_id,
        n.user_id,
        n.type,
        n.title,
        n.message,
        n.reference_id,
        n.is_read,
        n.created_at,
      ]);
    }

    // 12. Reagents
    for (const r of mapped.reagents) {
      const sql = `
        INSERT INTO reagents (id, company_id, name, cas_number, unit, quantity, low_stock_threshold, expires_at, supplier, storage_conditions, is_hazardous, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ${conflictClause(
          'reagents',
          'ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        r.id,
        r.company_id,
        r.name,
        r.cas_number,
        r.unit,
        r.quantity,
        r.low_stock_threshold,
        r.expires_at,
        r.supplier,
        r.storage_conditions,
        r.is_hazardous,
        r.created_at,
        r.updated_at,
      ]);
    }

    // 13. Reagent Transactions
    for (const rt of mapped.reagent_transactions) {
      const sql = `
        INSERT INTO reagent_transactions (id, company_id, reagent_id, user_id, type, quantity, quantity_before, quantity_after, note, recorded_date, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ${conflictClause('reagent_transactions', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        rt.id,
        rt.company_id,
        rt.reagent_id,
        rt.user_id,
        rt.type,
        rt.quantity,
        rt.quantity_before,
        rt.quantity_after,
        rt.note,
        rt.recorded_date,
        rt.created_at,
      ]);
    }

    // 14. Sensor Configs
    for (const sc of mapped.sensor_configs) {
      const sql = `
        INSERT INTO sensor_configs (id, company_id, sensor_id, location_name, temp_min, temp_max, humidity_min, humidity_max, is_active, api_key, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ${conflictClause(
          'sensor_configs',
          'ON CONFLICT (id) DO UPDATE SET location_name = EXCLUDED.location_name, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        sc.id,
        sc.company_id,
        sc.sensor_id,
        sc.location_name,
        sc.temp_min,
        sc.temp_max,
        sc.humidity_min,
        sc.humidity_max,
        sc.is_active,
        sc.api_key,
        sc.created_at,
        sc.updated_at,
      ]);
    }

    // 15. Temperature Readings
    for (const tr of mapped.temperature_readings) {
      const sql = `
        INSERT INTO temperature_readings (id, company_id, sensor_config_id, temperature, humidity, alert_triggered, recorded_at, is_manual, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ${conflictClause('temperature_readings', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        tr.id,
        tr.company_id,
        tr.sensor_config_id,
        tr.temperature,
        tr.humidity,
        tr.alert_triggered,
        tr.recorded_at,
        tr.is_manual,
        tr.recorded_by,
      ]);
    }

    // 16. Temperature Alerts
    for (const ta of mapped.temperature_alerts) {
      const sql = `
        INSERT INTO temperature_alerts (id, company_id, sensor_config_id, reading_id, temperature, alert_type, notified_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ${conflictClause('temperature_alerts', 'ON CONFLICT (id) DO NOTHING')}
      `;
      await client.query(sql, [
        ta.id,
        ta.company_id,
        ta.sensor_config_id,
        ta.id, // using alert id as reading reference in test fixture or reading_id
        ta.temperature,
        ta.alert_type,
        ta.notified_at,
        ta.created_at,
      ]);
    }

    // 17. Stability Studies
    for (const ss of mapped.stability_studies) {
      const sql = `
        INSERT INTO stability_studies (id, company_id, sample_id, started_at, storage_conditions, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ${conflictClause(
          'stability_studies',
          'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        ss.id,
        ss.company_id,
        ss.sample_id,
        ss.started_at,
        ss.storage_conditions,
        ss.status,
        ss.created_by,
        ss.created_at,
        ss.updated_at,
      ]);
    }

    // 18. Stability Checkpoints
    for (const scp of mapped.stability_checkpoints) {
      const sql = `
        INSERT INTO stability_checkpoints (id, company_id, study_id, interval_tag, due_date, status, assigned_to, completed_at, completed_by, notes, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ${conflictClause(
          'stability_checkpoints',
          'ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at',
        )}
      `;
      await client.query(sql, [
        scp.id,
        scp.company_id,
        scp.study_id,
        scp.interval_tag,
        scp.due_date,
        scp.status,
        scp.assigned_to,
        scp.completed_at,
        scp.completed_by,
        scp.notes,
        scp.created_at,
        scp.updated_at,
      ]);
    }

    // 19. Stability Results
    for (const sr of mapped.stability_results) {
      const sql = `
        INSERT INTO stability_results (id, company_id, checkpoint_id, parameter, initial_value, current_value, specification, tested_by, tested_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ${conflictClause(
          'stability_results',
          'ON CONFLICT (id) DO UPDATE SET parameter = EXCLUDED.parameter',
        )}
      `;
      await client.query(sql, [
        sr.id,
        sr.company_id,
        sr.checkpoint_id,
        sr.parameter,
        sr.initial_value,
        sr.current_value,
        sr.specification,
        sr.tested_by,
        sr.tested_at,
        sr.created_at,
      ]);
    }

    // Tranzaksiya muvaffaqiyatli yakunlandi
    await client.query('COMMIT');

    return {
      mode: 'apply',
      success: true,
      counts,
      userSetupCredentials: mapped.userSetupCredentials,
      problematicRows: mapped.problematicRows,
      warnings: validation.warnings,
      errors: [],
    };
  } catch (error) {
    if (!options.breakRollback) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
}

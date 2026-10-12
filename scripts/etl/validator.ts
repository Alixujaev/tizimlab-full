import type { ETLValidationResult, LegacyDataset } from './types.js';

/**
 * D-82 va SCHEMA_DIFF bo'yicha ETL xavfsizlik va ma'lumotlar yaxlitligi tekshiruvi.
 */
export function validateLegacyDataset(dataset: LegacyDataset): ETLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const companies = dataset.companies || [];
  const users = dataset.users || [];
  const samples = dataset.samples || [];
  const protocols = dataset.protocols || [];
  const sampleDocuments = dataset.sample_documents || [];
  const protocolValues = dataset.protocol_values || [];
  const protocolFiles = dataset.protocol_files || [];
  const stabilityStudies = dataset.stability_studies || [];

  // =========================================================================
  // 1. D-82 Pre-flight xavfsizlik tekshiruvlari (hammasi 0 bo'lishi SHART)
  // =========================================================================
  if (sampleDocuments.length > 0) {
    errors.push(
      `D-82 Xavfsizlik xatosi: 'sample_documents' jadvalida ${sampleDocuments.length} ta qator mavjud (0 bo'lishi shart)`,
    );
  }

  if (protocolValues.length > 0) {
    errors.push(
      `D-82 Xavfsizlik xatosi: 'protocol_values' jadvalida ${protocolValues.length} ta qator mavjud (0 bo'lishi shart)`,
    );
  }

  const nullSampleProtocols = protocols.filter((p) => !p.sample_id);
  if (nullSampleProtocols.length > 0) {
    errors.push(
      `D-82 Xavfsizlik xatosi: ${nullSampleProtocols.length} ta protokolda sample_id IS NULL (0 bo'lishi shart)`,
    );
  }

  // sample lookup map
  const sampleMap = new Map(samples.map((s) => [s.id, s]));

  // finished_product bo'lmagan protokollardagi protocol_files soni
  const protocolMap = new Map(protocols.map((p) => [p.id, p]));
  const invalidProtocolFiles = protocolFiles.filter((pf) => {
    const proto = protocolMap.get(pf.protocol_id);
    if (!proto || !proto.sample_id) return true;
    const sample = sampleMap.get(proto.sample_id);
    return !sample || sample.type !== 'finished_product';
  });
  if (invalidProtocolFiles.length > 0) {
    errors.push(
      `D-82 Xavfsizlik xatosi: finished_product bo'lmagan protokollarda ${invalidProtocolFiles.length} ta protocol_file mavjud (0 bo'lishi shart)`,
    );
  }

  // cancelled stability studies soni
  const cancelledStudies = stabilityStudies.filter((s) => s.status === 'cancelled');
  if (cancelledStudies.length > 0) {
    errors.push(
      `D-82 Xavfsizlik xatosi: cancelled holatidagi stabilizatsiya tadqiqotlari soni ${cancelledStudies.length} (0 bo'lishi shart)`,
    );
  }

  // in_process turidagi namunalar soni
  const inProcessSamples = samples.filter((s) => s.type === 'in_process');
  if (inProcessSamples.length > 0) {
    errors.push(
      `D-82 Xavfsizlik xatosi: 'in_process' turidagi namunalar soni ${inProcessSamples.length} (0 bo'lishi shart)`,
    );
  }

  // =========================================================================
  // 2. Foydalanuvchi emaillari (D-91, R-ARCH-85: kichik harf va dublikatlar)
  // =========================================================================
  const emailSet = new Set<string>();
  for (const user of users) {
    const normalizedEmail = user.email.trim().toLowerCase();
    if (emailSet.has(normalizedEmail)) {
      errors.push(`R-ARCH-85 E-pochta dublikati (case-insensitive): ${normalizedEmail}`);
    }
    emailSet.add(normalizedEmail);

    // super_admin va company_id qoidasi (D-70)
    if (user.role === 'super_admin' && user.company_id) {
      warnings.push(
        `Foydalanuvchi ${user.email} super_admin bo'la turib company_id ga ega; yangi sxemada NULL ga o'tkaziladi`,
      );
    }
    if (user.role !== 'super_admin' && !user.company_id) {
      errors.push(
        `Foydalanuvchi ${user.email} (${user.role}) company_id ga ega emas; super_admin bo'lmagan foydalanuvchilar kompaniyaga bog'lanishi shart`,
      );
    }
  }

  // =========================================================================
  // 3. FK yaxlitligi (Companies, Users, Samples)
  // =========================================================================
  const companyIds = new Set(companies.map((c) => c.id));
  for (const user of users) {
    if (user.company_id && !companyIds.has(user.company_id)) {
      errors.push(
        `FK xatosi: Foydalanuvchi ${user.id} mavjud bo'lmagan kompaniyaga bog'langan (${user.company_id})`,
      );
    }
  }

  for (const sample of samples) {
    if (!companyIds.has(sample.company_id)) {
      errors.push(
        `FK xatosi: Namuna ${sample.id} mavjud bo'lmagan kompaniyaga bog'langan (${sample.company_id})`,
      );
    }
    if (sample.expires_at || sample.deadline) {
      warnings.push(
        `Namuna ${sample.id} legacy expires_at/deadline ga ega; yangi sxemada tracking voqeasiga o'tkaziladi (D-71)`,
      );
    }
  }

  for (const protocol of protocols) {
    if (protocol.sample_id && !sampleMap.has(protocol.sample_id)) {
      errors.push(
        `FK xatosi: Protokol ${protocol.id} mavjud bo'lmagan namunaga bog'langan (${protocol.sample_id})`,
      );
    }
    if (!companyIds.has(protocol.company_id)) {
      errors.push(
        `FK xatosi: Protokol ${protocol.id} mavjud bo'lmagan kompaniyaga bog'langan (${protocol.company_id})`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      companiesCount: companies.length,
      usersCount: users.length,
      samplesCount: samples.length,
      protocolsCount: protocols.length,
      substancesCount: (dataset.substances || []).length,
      reagentsCount: (dataset.reagents || []).length,
      stabilityStudiesCount: stabilityStudies.length,
      sensorConfigsCount: (dataset.sensor_configs || []).length,
    },
  };
}

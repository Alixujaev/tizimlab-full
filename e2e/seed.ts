import type pg from 'pg';
import { hashPassword } from '../backend/src/modules/auth/password.js';

/**
 * P20 (D-199): E2E bazaviy ma'lumoti. Har oqim o'z namunasi/reaktivi/ND sini o'zi yaratadi (parallel xavfsiz);
 * bu yerda faqat umumiy "dunyo": kompaniyalar, har rol uchun foydalanuvchi, xona (harorat yozuvlari bilan),
 * apparatlar, reaktiv katalogi va ND moslik holatlari uchun tasdiqlangan ND.
 */

export const E2E_PASSWORD = 'E2eParol2026';

export type RoleKey =
  | 'kontrolyor'
  | 'chemist'
  | 'chemist2'
  | 'labHead'
  | 'director'
  | 'admin'
  | 'kontrolyorB'
  | 'labHeadB'
  | 'chemistB'
  | 'superAdmin'
  /** Faqat R-FLOW-08 (stabilizatsiya eslatmalari) — boshqa oqimlar xabarnomalari bilan aralashmasin */
  | 'stabChemist';

export interface SeedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

/**
 * Parallel slotlar soni (Playwright `parallelIndex` 0..workers-1). D-89: bir foydalanuvchiga ko'pi bilan 3 sessiya —
 * shuning uchun har slot (bir vaqtda bitta test) o'z foydalanuvchilari bilan ishlaydi, sessiyalar bir-birini siqmaydi.
 */
export const SLOTS = 4;

/** Bir slot (parallel ishchi) uchun A kompaniyasi "dunyosi" — boshqa slot testlari bilan umumiy narsa yo'q. */
export interface World {
  companyA: string;
  roomA: string;
  equipment: { hplc: string; muffle: string; spectro: string };
  nd: { feasibility: string; ok: string };
  reagentItems: { sulfat: string; atseton: string; natriy: string };
  /** R-FLOW-08: fon job'i server startida eslatma yuboradigan stabilizatsiya */
  stability: { substanceName: string; studyId: string; overdueTag: string; soonTag: string };
}

export interface SeedState {
  password: string;
  companyB: string;
  roomB: string;
  hplcB: string;
  /** `users[role][slot]` — slot s dagi A-rollari `worlds[s].companyA` da, B-rollari umumiy B kompaniyasida */
  users: Record<RoleKey, SeedUser[]>;
  /** `worlds[slot]` */
  worlds: World[];
  /** Toshkent bo'yicha bugungi sana (YYYY-MM-DD) — harorat yozuvlari shu kunga */
  today: string;
  yesterday: string;
}

const ROLE_OF: Record<RoleKey, string> = {
  kontrolyor: 'kontrolyor',
  chemist: 'chemist',
  chemist2: 'chemist',
  labHead: 'lab_head',
  director: 'director',
  admin: 'admin',
  kontrolyorB: 'kontrolyor',
  labHeadB: 'lab_head',
  chemistB: 'chemist',
  superAdmin: 'super_admin',
  stabChemist: 'chemist',
};

const NAMES: Record<RoleKey, string> = {
  kontrolyor: 'Kamola Kontrolyor',
  chemist: 'Kamron Kimyogar',
  chemist2: 'Karim Kimyogar',
  labHead: 'Laylo Mudir',
  director: 'Dilshod Direktor',
  admin: 'Aziz Admin',
  kontrolyorB: 'B Kontrolyor',
  labHeadB: 'B Mudir',
  chemistB: 'B Kimyogar',
  superAdmin: 'Super Admin',
  stabChemist: 'Sitora Kimyogar',
};

const tashkentDay = (offsetDays: number) =>
  new Date(Date.now() + 5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

export async function seed(pool: pg.Pool): Promise<SeedState> {
  const q = async <T extends pg.QueryResultRow = { id: string }>(
    sql: string,
    params: unknown[] = [],
  ) => (await pool.query<T>(sql, params)).rows;
  const hash = await hashPassword(E2E_PASSWORD);
  const today = tashkentDay(0);
  const yesterday = tashkentDay(-1);

  // Parallel slotlar izolyatsiyasi: har slot o'z A kompaniyasida. Rol bo'yicha xabarnomalar (lab_head ga va h.k.)
  // va real vaqtli toastlar boshqa slot testlariga tushmaydi; xona/ND/reaktiv qoldiqlari ham ajralgan.
  const companiesA: string[] = [];
  for (let slot = 0; slot < SLOTS; slot++) {
    const [c] = await q(
      `INSERT INTO companies (name, slug, is_active, ai_enabled) VALUES ($1, $2, true, true) RETURNING id`,
      [`E2E Laboratoriya A${slot + 1}`, `e2e-a${slot + 1}`],
    );
    companiesA.push(c!.id);
  }
  const [companyB] = await q(
    `INSERT INTO companies (name, slug, is_active, ai_enabled) VALUES ('E2E Laboratoriya B', 'e2e-b', true, true) RETURNING id`,
  );

  const users = {} as SeedState['users'];
  for (const key of Object.keys(ROLE_OF) as RoleKey[]) {
    const role = ROLE_OF[key];
    users[key] = [];
    for (let slot = 0; slot < SLOTS; slot++) {
      const company =
        role === 'super_admin' ? null : key.endsWith('B') ? companyB!.id : companiesA[slot]!;
      const email = `${key.toLowerCase()}${slot}@e2e.tizimlab.uz`;
      const fullName = `${NAMES[key]} ${slot + 1}`;
      const [u] = await q(
        `INSERT INTO users (email, password_hash, full_name, role, company_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
        [email, hash, fullName, role, company],
      );
      users[key].push({ id: u!.id, email, fullName, role });
    }
  }

  const eq = async (
    company: string,
    name: string,
    category: string,
    serial: string,
    status: string,
    due: string | null,
  ) =>
    (
      await q(
        `INSERT INTO equipment (company_id, name, category, serial_number, status, calibration_due)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [company, name, category, serial, status, due],
      )
    )[0]!.id;

  const [roomB] = await q(
    `INSERT INTO sensor_configs (company_id, sensor_id, location_name, temp_min, temp_max)
     VALUES ($1, 'E2E-S1', 'B Maxfiy xona', 15, 25) RETURNING id`,
    [companyB!.id],
  );
  const hplcB = await eq(companyB!.id, 'B Maxfiy HPLC', 'HPLC', 'B-H1', 'active', null);

  const worlds: World[] = [];
  for (let slot = 0; slot < SLOTS; slot++) {
    const companyA = companiesA[slot]!;

    // Xona (me'yor 15–25 °C): bugun 12:00 da me'yorda, kecha 12:00 da me'yordan YUQORI
    const [roomA] = await q(
      `INSERT INTO sensor_configs (company_id, sensor_id, location_name, temp_min, temp_max)
       VALUES ($1, 'E2E-S1', 'E2E Xona-1', 15, 25) RETURNING id`,
      [companyA],
    );
    await q(
      `INSERT INTO temperature_readings (company_id, sensor_config_id, temperature, humidity, recorded_at, is_manual, alert_triggered)
       VALUES ($1, $2, 21.5, 45, ($3::date + time '12:00') AT TIME ZONE 'Asia/Tashkent', true, false),
              ($1, $2, 27.3, 44, ($4::date + time '12:00') AT TIME ZONE 'Asia/Tashkent', true, true)`,
      [companyA, roomA!.id, today, yesterday],
    );

    // Apparatlar: faol HPLC; texnik xizmatdagi mufel; kalibrlash muddati o'tgan spektrofotometr
    const equipment = {
      hplc: await eq(companyA, 'E2E HPLC-1', 'HPLC', 'E2E-H1', 'active', tashkentDay(180)),
      muffle: await eq(companyA, 'E2E Mufel pech', 'Muffel pech', 'E2E-M1', 'maintenance', null),
      spectro: await eq(
        companyA,
        'E2E Spektrofotometr',
        'Spektrofotometr',
        'E2E-SP1',
        'active',
        tashkentDay(-3),
      ),
    };

    // Reaktiv katalogi (lotlar tasdiqlangan): sulfat — yetarli; atseton — faqat muddati o'tgan; natriy — kam
    const item = async (name: string, family: string) =>
      (
        await q(
          `INSERT INTO reagent_items (company_id, name, name_key, unit_family)
           VALUES ($1, reagent_display_name($2::text), reagent_name_key($2::text), $3) RETURNING id`,
          [companyA, name, family],
        )
      )[0]!.id;
    const reagentItems = {
      sulfat: await item('E2E Sulfat kislota', 'volume'),
      atseton: await item('E2E Atseton', 'volume'),
      natriy: await item('E2E Natriy xlorid', 'mass'),
    };
    const lot = async (itemId: string, name: string, unit: string, qty: number, expires: string) =>
      q(
        `INSERT INTO reagents (company_id, name, unit, quantity, expires_at, approval_status, approved_at, reagent_item_id)
         VALUES ($1, $2, $3, $4, $5, 'approved', now(), $6)`,
        [companyA, name, unit, qty, expires, itemId],
      );
    await lot(reagentItems.sulfat, 'E2E Sulfat kislota', 'ml', 500, tashkentDay(365));
    await lot(reagentItems.atseton, 'E2E Atseton', 'ml', 100, tashkentDay(-10));
    await lot(reagentItems.natriy, 'E2E Natriy xlorid', 'g', 1, tashkentDay(200));

    // ND moslik holatlari: apparat yo'q, xizmatda, kalibrlash o'tgan; reaktiv yetmaydi, muddati o'tgan
    const nd = async (code: string, name: string) =>
      (
        await q(
          `INSERT INTO normative_documents (company_id, code, name, status, approved_at) VALUES ($1, $2, $3, 'approved', now()) RETURNING id`,
          [companyA, code, name],
        )
      )[0]!.id;
    const reqEq = (ndId: string, category: string) =>
      q(
        `INSERT INTO nd_requirements (company_id, nd_id, kind, method_name, equipment_category) VALUES ($1, $2, 'equipment', 'E2E', $3)`,
        [companyA, ndId, category],
      );
    const reqRe = (ndId: string, itemId: string, qty: number, unit: string) =>
      q(
        `INSERT INTO nd_requirements (company_id, nd_id, kind, method_name, reagent_item_id, quantity_per_analysis, unit)
         VALUES ($1, $2, 'reagent', 'E2E', $3, $4, $5)`,
        [companyA, ndId, itemId, qty, unit],
      );
    const feasibility = await nd('ND-E2E-MOSLIK', 'E2E moslik tekshiruvi');
    await reqEq(feasibility, 'Gaz xromatograf');
    await reqEq(feasibility, 'Muffel pech');
    await reqEq(feasibility, 'Spektrofotometr');
    await reqRe(feasibility, reagentItems.natriy, 10, 'g');
    await reqRe(feasibility, reagentItems.atseton, 5, 'ml');
    const ok = await nd('ND-E2E-OK', 'E2E bajariladigan metodika');
    await reqEq(ok, 'HPLC');
    await reqRe(ok, reagentItems.sulfat, 2, 'ml');

    // R-FLOW-08: tasdiqlangan namuna + faol stabilizatsiya; muddati o'tgan va 14 kun ichida tugaydigan checkpoint
    // (alohida `stabChemist` ga — boshqa oqimlar xabarnomalari bilan aralashmasin). Server start'idagi
    // `runStabilityReminderJob` xabar yuboradi va holatni `overdue` qiladi.
    const stabSubstance = 'E2E Stabil Paratsetamol';
    const [stabSample] = await q(
      `INSERT INTO samples (company_id, type, status, substance_name, serial_number, created_by)
       VALUES ($1, 'finished_product', 'approved', $2, 'E2E-STAB-01', $3) RETURNING id`,
      [companyA, stabSubstance, users.kontrolyor[slot]!.id],
    );
    const [study] = await q(
      `INSERT INTO stability_studies (company_id, sample_id, started_at, storage_conditions, created_by)
       VALUES ($1, $2, $3, '25°C / 60% RH', $4) RETURNING id`,
      [companyA, stabSample!.id, tashkentDay(-200), users.labHead[slot]!.id],
    );
    await q(
      `INSERT INTO stability_checkpoints (company_id, study_id, interval_tag, due_date, assigned_to)
       VALUES ($1, $2, 'T-OVERDUE', $3, $5), ($1, $2, 'T-SOON', $4, $5)`,
      [companyA, study!.id, tashkentDay(-5), tashkentDay(3), users.stabChemist[slot]!.id],
    );

    worlds.push({
      companyA,
      roomA: roomA!.id,
      equipment,
      nd: { feasibility, ok },
      reagentItems,
      stability: {
        substanceName: stabSubstance,
        studyId: study!.id,
        overdueTag: 'T-OVERDUE',
        soonTag: 'T-SOON',
      },
    });
  }

  return {
    password: E2E_PASSWORD,
    companyB: companyB!.id,
    roomB: roomB!.id,
    hplcB,
    users,
    worlds,
    today,
    yesterday,
  };
}

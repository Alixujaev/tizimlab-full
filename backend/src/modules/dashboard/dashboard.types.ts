import type { ProtocolStatus } from '../protocols/protocols.types.js';
import type { SampleStatus } from '../samples/samples.types.js';

export type StatusCounts<S extends string> = Record<S, number>;

/** Unfinalized = `finalized` dan boshqa barcha protokol statuslari. */
export type OpenProtocolStatus = Exclude<ProtocolStatus, 'finalized'>;

interface SamplesSummary {
  samplesByStatus: StatusCounts<SampleStatus>;
  totalSamples: number;
}

/**
 * D-33: dashboard tarkibi rol bo'yicha. `admin` — LabHead dashboardi.
 * lab_head ning harorat/low_stock/is_expired/stabilizatsiya kartalari tegishli modullar (P7–P9) bilan qo'shiladi.
 */
export type DashboardDto =
  | ({ view: 'chemist' } & SamplesSummary)
  | ({ view: 'inspector' } & SamplesSummary)
  | ({
      view: 'lab_head';
      pendingAssignment: number;
      awaitingApproval: number;
    } & SamplesSummary)
  | ({
      view: 'director';
      openProtocolsByStatus: StatusCounts<OpenProtocolStatus>;
      openProtocolsTotal: number;
    } & SamplesSummary);

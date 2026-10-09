import type pg from 'pg';
import { notifyProtocolStatus } from '../notifications/notifications.events.js';
import type { SampleLookup } from './protocols.service.js';
import type { ProtocolRow, ProtocolStatus, RequestMeta } from './protocols.types.js';

export interface ProtocolStatusContext {
  tx: pg.PoolClient;
  actorId: string;
  sample: SampleLookup;
  meta: RequestMeta;
}

export interface ProtocolHooks {
  /** Tranzaksiya ichida chaqiriladi; xabarnoma push'i COMMIT dan keyin ketadi (`onCommit`). */
  onProtocolStatusChanged?: (
    protocol: ProtocolRow,
    fromStatus: ProtocolStatus,
    toStatus: ProtocolStatus,
    ctx: ProtocolStatusContext,
  ) => Promise<void> | void;
}

export const protocolHooks: ProtocolHooks = {
  // Xabarnomalar (spec §9, D-13)
  onProtocolStatusChanged: async (protocol, _from, toStatus, ctx) => {
    await notifyProtocolStatus(ctx.tx, protocol, toStatus, ctx.sample, ctx.actorId);
  },
};

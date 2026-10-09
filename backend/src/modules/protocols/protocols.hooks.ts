import type { ProtocolRow, ProtocolStatus } from './protocols.types.js';

export interface ProtocolHooks {
  onProtocolStatusChanged?: (
    protocol: ProtocolRow,
    fromStatus: ProtocolStatus,
    toStatus: ProtocolStatus,
    meta?: unknown,
  ) => Promise<void> | void;
}

export const protocolHooks: ProtocolHooks = {
  // P6 da Socket.IO va xabarnomalar moduli ulanadi
  onProtocolStatusChanged: async () => {},
};

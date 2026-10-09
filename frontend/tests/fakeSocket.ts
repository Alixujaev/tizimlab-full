import type { AppSocket } from '@/lib/socket';

type Handler = (...args: never[]) => void;

/** Testlar uchun soxta Socket.IO client: `emit` serverdan kelgan hodisani taqlid qiladi. */
export class FakeSocket implements AppSocket {
  auth: AppSocket['auth'];
  connected = false;
  private handlers = new Map<string, Set<Handler>>();

  constructor(token: string) {
    this.auth = { token };
  }

  on = ((event: string, fn: Handler) => {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return this;
  }) as unknown as AppSocket['on'];

  off = ((event: string, fn: Handler) => {
    this.handlers.get(event)?.delete(fn);
    return this;
  }) as unknown as AppSocket['off'];

  connect = (() => {
    this.connected = true;
    return this;
  }) as unknown as AppSocket['connect'];

  disconnect = (() => {
    this.connected = false;
    return this;
  }) as unknown as AppSocket['disconnect'];

  emit(event: string, payload: unknown): void {
    for (const fn of this.handlers.get(event) ?? []) (fn as (p: unknown) => void)(payload);
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

export const fakeSockets: FakeSocket[] = [];
export const fakeSocketFactory = (token: string): AppSocket => {
  const s = new FakeSocket(token);
  fakeSockets.push(s);
  return s;
};

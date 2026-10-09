import { io, type Socket } from 'socket.io-client';

export const NOTIFICATION_EVENT = 'notification:new';

/** Minimal interfeys — testlarda soxta socket bilan almashtiriladi. */
export type AppSocket = Pick<Socket, 'on' | 'off' | 'connect' | 'disconnect'> & {
  auth: Socket['auth'];
};

type SocketFactory = (token: string) => AppSocket;

// Bir xil origin: dev'da Vite `/socket.io` ni backend'ga proxy qiladi, prod'da backend bilan bir domen
const defaultFactory: SocketFactory = (token) =>
  io({ auth: { token }, transports: ['websocket'], autoConnect: false });

let factory: SocketFactory = defaultFactory;
let socket: AppSocket | null = null;

/** Testlar uchun: socket yaratishni almashtirish (`null` — standart). */
export function setSocketFactory(f: SocketFactory | null): void {
  factory = f ?? defaultFactory;
}

/** Yagona ulanish: mavjud bo'lsa token yangilanadi (keyingi qayta ulanish shu token bilan). */
export function connectSocket(token: string): AppSocket {
  if (socket) {
    socket.auth = { token };
    return socket;
  }
  socket = factory(token);
  socket.connect();
  return socket;
}

/** Logout'da va sessiya tugaganda chaqiriladi (R-FE-06). */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): AppSocket | null {
  return socket;
}

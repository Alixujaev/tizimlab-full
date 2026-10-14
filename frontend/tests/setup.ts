import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import '@/i18n';
import { disconnectSocket, setSocketFactory } from '@/lib/socket';
import { fakeSocketFactory, fakeSockets } from './fakeSocket';

expect.extend(matchers);

// jsdom'da Pointer Capture API yo'q — sonner toast'ni bosganda chaqiradi
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

// Sekin kompyuter / parallel jsdom yuklamasida async kutishlar uchun barqaror timeout (5000ms)
configure({ asyncUtilTimeout: 5000 });

// Testlarda haqiqiy Socket.IO ulanishi yo'q
setSocketFactory(fakeSocketFactory);

afterEach(() => {
  cleanup();
  disconnectSocket();
  fakeSockets.length = 0;
});

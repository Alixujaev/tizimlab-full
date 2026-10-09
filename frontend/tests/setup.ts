import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import '@/i18n';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
